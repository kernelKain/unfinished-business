import { randomUUID } from "node:crypto";
import type { OpenCodeDiscovery } from "../../shared/opencode.ts";
import type { ProviderErrorDetails } from "../../shared/workflow.ts";
import { LEGACY_FIXED_MODEL_KEY, payloadHash, refreshNextAction, type ModelRef, type Project, type SpiritRole } from "../workflow/model.ts";
import { AtomicProjectStore, RevisionConflict, StateError } from "../store/atomic-project-store.ts";
import { loadStagePrompt, type Stage } from "../prompts/loader.ts";
import { WorkflowService } from "../workflow/service.ts";
import {
  approveProduct,
  compileApprovedPlan,
  grantMakerScope,
  recordOracleProposal,
  recordWitnessDrafts,
  rememberSession,
  rememberTranscript,
  reviseSection,
  WorkflowConflict,
} from "../workflow/transitions.ts";
import type { GuideBudgets, SpiritGuide } from "./guide.ts";
import { NativeBudgetError, NativeSessionError, NativeTimeoutError } from "./guide.ts";
import { NetworkPolicyError } from "../security/network.ts";
import { redactText, type RedactOptions } from "../security/redaction.ts";
import { runApprovedNodeCheck } from "./node-check.ts";
import {
  extractJsonObject,
  formatSectionDraft,
  oracleReplySchema,
  sectionReplySchema,
  witnessReplySchema,
} from "./parse.ts";
import { MakerRunCoordinator } from "./runs.ts";
import { traceAgentOperation, traceToolOperation } from "./telemetry.ts";
import { classifyProviderError, isProviderFailureCandidate, ProviderRequestError } from "../opencode/provider-errors.ts";

export class ExperienceFailure extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly retryable: boolean,
    readonly operationId: string | null = null,
    readonly providerError: ProviderErrorDetails | null = null,
  ) {
    super(message);
    this.name = "ExperienceFailure";
  }
}

export interface EngineSelectionService {
  discovery(options?: { selected?: ModelRef | null; accessMode?: Project["modelPreferences"]["access"]["mode"] }): Promise<OpenCodeDiscovery>;
  resolveModel(selection: ModelRef | null, discovery?: OpenCodeDiscovery, accessMode?: Project["modelPreferences"]["access"]["mode"]): Promise<{ model: import("../../shared/opencode.ts").DiscoveredModel; source: "selected" | "legacy" | "auto-discovery" } | null>;
  chooseDefaultModel(legacyModel?: string | null): Promise<{ model: import("../../shared/opencode.ts").DiscoveredModel; source: "selected" | "legacy" | "auto-discovery" } | null>;
  validateSelection(discovery: OpenCodeDiscovery, model: ModelRef, accessMode?: Project["modelPreferences"]["access"]["mode"]): import("../../shared/opencode.ts").DiscoveredModel;
}

export interface ExperienceOptions {
  safeDirectory: string;
  demoWorkspace: string;
  promptRoot?: string;
  budgets?: Partial<GuideBudgets> & { nodeCheckTimeoutMs?: number };
  redact?: RedactOptions;
  redactPrompts?: boolean;
  mode?: Project["mode"];
  engine?: EngineSelectionService;
}

interface Claimed {
  project: Project;
  duplicate: boolean;
}

interface ModelContext {
  model: ModelRef;
  source: "selected" | "legacy" | "auto-discovery" | "none";
  roleAgents: Record<"oracle" | "architect" | "maker" | "witness", string | null>;
}

const stagePrompt: Record<"oracle" | "architect" | "witness", Stage> = {
  oracle: "oracle",
  architect: "architect",
  witness: "witness",
};

const defaultBudgets: GuideBudgets & { nodeCheckTimeoutMs: number } = {
  guideTimeoutMs: 90_000,
  makerTimeoutMs: 180_000,
  nodeCheckTimeoutMs: 30_000,
  maxSessionTokens: 200_000,
  maxSessionCostUsd: null,
};

const legacyModel: ModelRef = { providerID: "opencode", id: "deepseek-v4.1-flash-free", variant: null };

export class ExperienceService {
  private readonly runs: MakerRunCoordinator;
  private readonly budgets: typeof defaultBudgets;

  constructor(
    private readonly workflow: WorkflowService,
    private readonly store: AtomicProjectStore,
    private readonly guide: SpiritGuide,
    private readonly options: ExperienceOptions,
  ) {
    this.budgets = { ...defaultBudgets, ...options.budgets };
    this.runs = new MakerRunCoordinator({
      workflow,
      guide,
      demoWorkspace: options.demoWorkspace,
      nodeCheckTimeoutMs: this.budgets.nodeCheckTimeoutMs,
    });
  }

  async sendMessage(actionId: string, expectedRevision: number, intent: "clarify" | "draft" | "question" | "witness", text: string) {
    const payload = { intent, text };
    const claimed = await this.claim(actionId, payload, expectedRevision);
    if (claimed.duplicate) return { project: claimed.project, duplicate: true };
    const project = claimed.project;
    try {
      if (intent === "clarify") return await this.clarify(actionId, payload, expectedRevision, project, text);
      if (intent === "draft") return await this.draft(actionId, payload, expectedRevision, project, text);
      if (intent === "question") return await this.question(actionId, payload, expectedRevision, project, text);
      return await this.witness(actionId, payload, expectedRevision, project, text);
    } catch (error) {
      if (error instanceof ExperienceFailure
        || error instanceof WorkflowConflict
        || error instanceof RevisionConflict
        || error instanceof StateError) throw error;
      return this.recordUncertain(actionId, payload, expectedRevision, intent, error);
    }
  }

  async approve(actionId: string, expectedRevision: number, kind: "product" | "maker-scope", statement?: string) {
    const payload = { kind, statement: statement ?? null };
    return this.workflow.execute(actionId, payload, expectedRevision, (project) => {
      if (kind === "product") return approveProduct(project);
      return grantMakerScope(project, statement ?? "");
    });
  }

  async runMaker(actionId: string, expectedRevision: number) {
    const payload = { intent: "maker" };
    const claimed = await this.claim(actionId, payload, expectedRevision);
    if (claimed.duplicate) return { project: claimed.project, duplicate: true, accepted: false };
    const project = claimed.project;
    if (project.makerScope.status !== "GRANTED" || !project.makerScope.statement) {
      throw new ExperienceFailure("Grant a separate Maker scope before a native run.", "MAKER_SCOPE_REQUIRED", 409, false);
    }
    if (project.operations.some((operation) => ["QUEUED", "RUNNING", "WAITING_PERMISSION", "COMPLETED_UNAPPLIED", "ABANDONED"].includes(operation.status))) {
      throw new ExperienceFailure("An earlier native run is unresolved. Reconcile it before starting another.", "RUN_UNRESOLVED", 409, false);
    }
    const makerScope = project.makerScope.statement;
    const context = await this.modelContext(project);
    const startedAt = new Date().toISOString();
    const queued = await this.workflow.execute(actionId, payload, expectedRevision, (current) => {
      const next = structuredClone(current);
      next.engine = {
        model: context.model,
        source: context.source === "selected"
          ? current.engine.source
          : context.source === "legacy"
            ? "migrated-legacy"
            : context.source === "auto-discovery"
              ? "auto-discovery"
              : current.engine.source,
        updatedAt: startedAt,
        legacyModel: current.engine.legacyModel,
      };
      next.operations.push({
        id: randomUUID(),
        kind: "maker",
        payloadHash: payloadHash(payload),
        nativeSessionId: null,
        nativeMessageId: null,
        status: "QUEUED",
        result: `Queued for OpenCode with ${context.model.providerID}/${context.model.id}${context.model.variant ? `#${context.model.variant}` : ""}.`,
        model: context.model,
        agent: context.roleAgents.maker,
        startedAt,
        finishedAt: null,
        statusReason: null,
        lastObservedAt: null,
        appliedAt: null,
        providerError: null,
      });
      rememberTranscript(next, "user", this.redactPrompt(`Queued a Maker run with ${context.model.providerID}/${context.model.id}${context.model.variant ? `#${context.model.variant}` : ""}.`));
      return refreshNextAction(next);
    });
    const operation = queued.project.operations.at(-1);
    if (!operation) throw new ExperienceFailure("The Maker run was not recorded.", "RUN_NOT_RECORDED", 500, true);
    try {
      const prompt = await this.instructions("maker", queued.project, makerScope, context.model);
      this.runs.start({
        operationId: operation.id,
        projectId: queued.project.id,
        actionId,
        payload,
        sessionId: sessionFor(queued.project, "maker"),
        prompt,
        workspace: this.options.demoWorkspace,
        model: context.model,
        agent: context.roleAgents.maker,
        budget: queued.project.modelPreferences.budget,
      });
    } catch (error) {
      await this.runs.markFailed(operation.id, error, context.model, context.roleAgents.maker);
      throw error instanceof ExperienceFailure
        ? error
        : new ExperienceFailure(error instanceof Error ? this.redact(error.message) : "The Maker run could not start.", "RUN_START_FAILED", 500, true, operation.id);
    }
    return { project: queued.project, duplicate: false, accepted: true, operation };
  }

  async cancel(actionId: string, expectedRevision: number, operationId: string) {
    void expectedRevision;
    const active = this.runs.active(operationId);
    if (!active) {
      const project = (await this.store.load()).state;
      const operation = project.operations.find((item) => item.id === operationId);
      if (!operation) throw new WorkflowConflict("That operation is not in this project.");
      if (["SUCCEEDED", "FAILED", "CANCELLED", "COMPLETED_UNAPPLIED", "ABANDONED"].includes(operation.status)) {
        throw new WorkflowConflict("A finished or abandoned operation cannot be cancelled. Reconcile an abandoned operation instead.");
      }
      throw new ExperienceFailure("The in-process runner is no longer present. Reconcile the native session before taking another action.", "RUN_NOT_ACTIVE", 409, false, operationId);
    }
    let interrupted = false;
    if (active.sessionId && this.guide.interrupt) {
      try {
        interrupted = await this.guide.interrupt(active.sessionId);
      } catch (error) {
        throw new ExperienceFailure(
          `The native session could not be interrupted, so it was not marked cancelled: ${this.redact(error instanceof Error ? error.message : "unknown error")}`,
          "CANCEL_UNAVAILABLE",
          503,
          false,
          operationId,
        );
      }
    }
    this.runs.markCancelled(operationId);
    return this.workflow.executeLatest(actionId, { operationId, intent: "cancel" }, (project) => {
      const next = structuredClone(project);
      const operation = next.operations.find((item) => item.id === operationId);
      if (!operation) throw new WorkflowConflict("That operation is not in this project.");
      if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(operation.status)) {
        if (operation.status === "CANCELLED") return next;
        throw new WorkflowConflict("A finished operation cannot be cancelled.");
      }
      operation.status = "CANCELLED";
      operation.finishedAt = new Date().toISOString();
      operation.lastObservedAt = operation.finishedAt;
      operation.statusReason = "user-cancelled";
      operation.result = interrupted
        ? "Interrupted the native OpenCode session; the run was cancelled."
        : "Cancellation recorded. The native session was already idle or did not report an active request.";
      rememberTranscript(next, "system", operation.result);
      return refreshNextAction(next);
    });
  }

  async reconcile(actionId: string, expectedRevision: number, operationId: string) {
    const payload = { operationId, intent: "reconcile" };
    const claimed = await this.claim(actionId, payload, expectedRevision);
    if (claimed.duplicate) return { project: claimed.project, duplicate: true };
    const operation = claimed.project.operations.find((item) => item.id === operationId);
    if (!operation?.nativeSessionId) {
      throw new ExperienceFailure("This operation has no native session to reconcile.", "NOTHING_TO_RECONCILE", 409, false);
    }
    if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(operation.status)) {
      throw new ExperienceFailure("A finished operation does not need reconciliation.", "ALREADY_FINISHED", 409, false);
    }
    const role = operation.kind === "maker" ? "maker" : operation.kind === "witness" ? "witness" : "architect";
    const observed = await this.guide.inspect(operation.nativeSessionId, {
      conversationId: claimed.project.id,
      role,
    });
    return this.workflow.execute(actionId, payload, expectedRevision, (project) => {
      const next = structuredClone(project);
      const current = next.operations.find((item) => item.id === operationId);
      if (!current) throw new WorkflowConflict("That operation is not in this project.");
      if (observed === "running") {
        current.status = "RUNNING";
        current.result = "Native session is still running. It was not started again.";
      } else if (observed === "succeeded") {
        current.status = "SUCCEEDED";
        current.finishedAt ??= new Date().toISOString();
        current.result = "Reconciled from the native session outcome.";
      } else if (observed === "failed") {
        current.status = "FAILED";
        current.finishedAt ??= new Date().toISOString();
        current.result = "Reconciled from a failed or interrupted native session.";
      } else {
        current.status = "ABANDONED";
        current.statusReason = "native-outcome-unconfirmed";
        current.lastObservedAt = new Date().toISOString();
        current.result = "Native outcome is still unknown. This action was not repeated.";
      }
      return refreshNextAction(next);
    });
  }

  isRunActive(operationId: string): boolean {
    return this.runs.active(operationId) !== null;
  }

  async exportApproved() {
    const project = await this.workflow.get();
    const unresolved = project.sections.filter((section) => section.status !== "APPROVED");
    let plan: string | null = null;
    if (unresolved.length === 0) plan = this.redact(compileApprovedPlan(project));
    return {
      schemaVersion: project.schemaVersion,
      mode: project.mode,
      generatedAt: new Date().toISOString(),
      plan,
      unresolved: unresolved.map((section) => section.id),
      drafts: project.witnessDrafts.map((draft) => ({
        title: this.redact(draft.title),
        content: this.redact(draft.content),
      })),
      engine: project.engine,
      redacted: true,
      limitation: "Witness drafts are in-app review notes. They are not a submitted article, video, or entry.",
    };
  }

  private async clarify(actionId: string, payload: object, expectedRevision: number, project: Project, text: string) {
    return traceAgentOperation("oracle", project.id, async () => {
      if (project.product.status === "APPROVED") {
        throw new ExperienceFailure("The product proposal is already approved.", "PRODUCT_ALREADY_APPROVED", 409, false);
      }
      const context = await this.modelContext(project);
      const spoken = await this.guide.speak({
        role: "oracle",
        conversationId: project.id,
        sessionId: sessionFor(project, "oracle"),
        prompt: await this.instructions("oracle", project, text, context.model),
        workspace: this.options.safeDirectory,
        model: context.model,
        agent: context.roleAgents.oracle,
        budget: project.modelPreferences.budget,
      });
      const reply = oracleReplySchema.parse(extractJsonObject(spoken.text));
      return this.workflow.execute(actionId, payload, expectedRevision, (current) => {
        const seeded = structuredClone(current);
        rememberTranscript(seeded, "user", this.redactPrompt(text));
        const next = recordOracleProposal(seeded, {
          ...reply,
          proposal: this.redact(reply.proposal),
          clarification: this.redact(reply.clarification),
          openQuestions: reply.openQuestions.map((question) => this.redact(question)),
          sessionId: spoken.sessionId,
        });
        next.operations.push(operation("guide", payload, spoken, "SUCCEEDED", "Oracle proposal stored. It is not approved.", context.model));
        return refreshNextAction(next);
      });
    });
  }

  private async draft(actionId: string, payload: object, expectedRevision: number, project: Project, text: string) {
    return traceAgentOperation("architect", project.id, async () => {
      if (project.product.status !== "APPROVED" || !project.currentSectionId) {
        throw new ExperienceFailure("Drafting waits for an approved product and an active section.", "SECTION_NOT_READY", 409, false);
      }
      const sectionId = project.currentSectionId;
      const context = await this.modelContext(project);
      const spoken = await this.guide.speak({
        role: "architect",
        conversationId: project.id,
        sessionId: sessionFor(project, "architect"),
        prompt: await this.instructions("architect", project, text, context.model),
        workspace: this.options.safeDirectory,
        model: context.model,
        agent: context.roleAgents.architect,
        budget: project.modelPreferences.budget,
      });
      let reply;
      try {
        reply = sectionReplySchema.parse(extractJsonObject(spoken.text));
      } catch {
        const prose = spoken.text.trim();
        if (prose.length < 80) {
          return this.recordFailure(actionId, payload, expectedRevision, "architect", spoken.sessionId, `The Architect reply was malformed, so the section was left unchanged. Reply began: ${this.redact(prose.slice(0, 240))}`);
        }
        reply = {
          content: prose.slice(0, 12_000),
          recommendation: "The Architect returned prose. Review the draft before approval.",
          tradeoff: "Separate recommendation and tradeoff fields were not returned.",
        };
      }
      const content = this.redact(formatSectionDraft(reply));
      return this.workflow.execute(actionId, payload, expectedRevision, (current) => {
        const next = reviseSection(current, sectionId, content);
        rememberSession(next, "architect", spoken.sessionId);
        rememberTranscript(next, "user", this.redactPrompt(text));
        rememberTranscript(next, "architect", content);
        next.operations.push(operation("guide", payload, spoken, "SUCCEEDED", "Draft stored as the current section version.", context.model));
        return refreshNextAction(next);
      });
    });
  }

  private async question(actionId: string, payload: object, expectedRevision: number, project: Project, text: string) {
    const role = project.stage === "ORACLE" ? "oracle" : "architect";
    return traceAgentOperation(role, project.id, async () => {
      const context = await this.modelContext(project);
      const spoken = await this.guide.speak({
        role,
        conversationId: project.id,
        sessionId: sessionFor(project, role),
        prompt: await this.instructions(role, project, `The user is asking a question. This is not approval and must not change an approved artifact.\n\n${text}`, context.model),
        workspace: this.options.safeDirectory,
        model: context.model,
        agent: context.roleAgents[role],
        budget: project.modelPreferences.budget,
      });
      return this.workflow.execute(actionId, payload, expectedRevision, (current) => {
        const next = structuredClone(current);
        rememberSession(next, role, spoken.sessionId);
        rememberTranscript(next, "user", this.redactPrompt(text));
        rememberTranscript(next, role, this.redactPrompt(spoken.text.slice(0, 4_000)));
        next.operations.push(operation("guide", payload, spoken, "SUCCEEDED", "Question answered without changing approvals.", context.model));
        return refreshNextAction(next);
      });
    });
  }

  private async witness(actionId: string, payload: object, expectedRevision: number, project: Project, text: string) {
    return traceAgentOperation("witness", project.id, async () => {
      const makerDone = project.operations.some((operation) => operation.kind === "maker" && operation.status === "SUCCEEDED");
      if (!makerDone) throw new ExperienceFailure("Witness review waits for a completed Maker run.", "WITNESS_NOT_READY", 409, false);
      const context = await this.modelContext(project);
      const spoken = await this.guide.speak({
        role: "witness",
        conversationId: project.id,
        sessionId: null,
        prompt: await this.instructions("witness", project, text, context.model),
        workspace: this.options.safeDirectory,
        model: context.model,
        agent: context.roleAgents.witness,
        budget: project.modelPreferences.budget,
      });
      let reply;
      try {
        reply = witnessReplySchema.parse(extractJsonObject(spoken.text));
      } catch {
        const prose = spoken.text.trim();
        if (prose.length < 80) {
          return this.recordFailure(actionId, payload, expectedRevision, "witness", spoken.sessionId, `The Witness reply was malformed, so no draft was stored. Reply began: ${this.redact(prose.slice(0, 240))}`);
        }
        reply = {
          findings: prose.slice(0, 8_000),
          limitations: "The Witness returned prose rather than separate fields.",
          draftNotes: "These notes are an in-app review. They are not a submitted article or video.",
        };
      }
      return this.workflow.execute(actionId, payload, expectedRevision, (current) => {
        const next = recordWitnessDrafts(current, [
          { title: "Findings", content: this.redact(reply.findings) },
          { title: "Limitations", content: this.redact(reply.limitations) },
          { title: "Draft notes", content: this.redact(reply.draftNotes) },
        ], spoken.sessionId);
        next.operations.push(operation("witness", payload, spoken, "SUCCEEDED", "Witness drafts stored from a fresh session.", context.model));
        return refreshNextAction(next);
      });
    });
  }

  private async instructions(role: "oracle" | "architect" | "maker" | "witness", project: Project, text: string, model: ModelRef): Promise<string> {
    const procedure = await loadStagePrompt(role === "maker" ? "maker" : stagePrompt[role], this.options.promptRoot);
    const section = project.sections.find((item) => item.id === project.currentSectionId);
    const shape = role === "oracle"
      ? '{"clarification":"...","proposal":"...","openQuestions":["..."]}'
      : role === "architect"
        ? '{"content":"...","recommendation":"...","tradeoff":"..."}'
        : role === "witness"
          ? '{"findings":"...","limitations":"...","draftNotes":"..."}'
          : "a code change, not JSON";
    return [
      procedure,
      "",
      "Current workshop state:",
      `stage ${project.stage}; product ${project.product.status}; next ${project.nextAction}`,
      `selected model ${model.providerID}/${model.id}${model.variant ? `#${model.variant}` : ""}`,
      section ? `active section ${section.order}. ${section.title}; version ${section.version}; status ${section.status}` : "no active section",
      project.product.proposal ? `approved-or-proposed product:\n${project.product.proposal}` : "no product proposal yet",
      project.evidence.length ? `observed checks:\n${project.evidence.map((item) => `${item.checkId} ${item.result}. ${item.limitation ?? ""}`).join("\n")}` : "no observed checks yet",
      project.operations.some((item) => item.kind === "maker")
        ? `maker results:\n${project.operations.filter((item) => item.kind === "maker").map((item) => item.result ?? item.status).join("\n")}`
        : "no maker result yet",
      "The spirit session directory is empty on purpose. Do not treat it as the demo workspace, and do not claim files are missing when a maker result or check is listed above.",
      "",
      "User message:",
      text,
      "",
      role === "maker"
        ? "The session directory is an isolated demo workspace. Implement the approved plan and Maker scope there as a dependency-free Node module plus a node:test file. Do not edit the Unfinished Business repository, do not run shell commands, and do not claim a test passed."
        : `Reply with one JSON object only, matching ${shape}. Do not approve, advance, or claim the user approved. A question is not approval.`,
    ].join("\n");
  }

  private async modelContext(project: Project): Promise<ModelContext> {
    if (!this.options.engine) {
      return {
        model: project.engine.model ?? legacyModel,
        source: "none",
        roleAgents: { oracle: null, architect: null, maker: null, witness: null },
      };
    }
    let discovery: OpenCodeDiscovery;
    try {
      discovery = await this.options.engine.discovery({
        selected: project.engine.model,
        accessMode: project.modelPreferences.access.mode,
      });
    } catch (error) {
      throw new ExperienceFailure(
        `OpenCode discovery is unavailable: ${this.redact(error instanceof Error ? error.message : "unknown error")}`,
        "OPENCODE_UNAVAILABLE",
        503,
        true,
      );
    }
    const reportedSelection = project.engine.model
      ? discovery.models.find((model) => model.providerID === project.engine.model?.providerID && model.id === project.engine.model?.id)
      : null;
    if (reportedSelection
      && project.modelPreferences.access.mode === "FREE_OR_LOCAL_ONLY"
      && reportedSelection.pricing !== "free"
      && reportedSelection.local !== true) {
      throw new ExperienceFailure(
        "This project is set to Free and local only. Choose a free/local model or deliberately change the model access preference.",
        "MODEL_ACCESS_POLICY_BLOCKED",
        409,
        false,
      );
    }
    let resolution = project.engine.model
      ? await this.options.engine.resolveModel(project.engine.model, discovery, project.modelPreferences.access.mode)
      : null;
    if (project.engine.model && !resolution) {
      const reported = discovery.models.find((model) =>
        model.providerID === project.engine.model?.providerID && model.id === project.engine.model?.id);
      throw new ExperienceFailure(
        reported
          ? `The selected model ${project.engine.model.providerID}/${project.engine.model.id} is not available. Choose another model in the OpenCode panel.`
          : `The selected model ${project.engine.model.providerID}/${project.engine.model.id} is no longer reported by OpenCode. Choose another model in the OpenCode panel.`,
        "MODEL_UNAVAILABLE",
        409,
        false,
      );
    }
    if (!resolution) {
      if (project.engine.legacyModel) {
        resolution = await this.options.engine.chooseDefaultModel(project.engine.legacyModel);
      }
      if (!resolution) {
        throw new ExperienceFailure(
          "Choose a model reported by OpenCode before starting a run.",
          "MODEL_SELECTION_REQUIRED",
          409,
          false,
        );
      }
    }
    if (project.engine.model?.variant) {
      this.options.engine.validateSelection(discovery, project.engine.model, project.modelPreferences.access.mode);
    }
    if (resolution.model.local !== true
      && resolution.model.pricing !== "free"
      && !project.modelPreferences.access.paidOrUnknownAcceptedAt) {
      throw new ExperienceFailure(
        resolution.model.pricing === "paid"
          ? "Confirm the paid-model policy in OpenCode settings before the first request. No provider request was made."
          : "Confirm the unknown-price policy in OpenCode settings before the first request. No provider request was made.",
        "MODEL_COST_CONFIRMATION_REQUIRED",
        409,
        false,
      );
    }
    const roleAgents = Object.fromEntries(
      discovery.roles.map((role) => [role.role, role.available ? role.agent : null]),
    ) as Record<"oracle" | "architect" | "maker" | "witness", string | null>;
    return {
      model: { providerID: resolution.model.providerID, id: resolution.model.id, variant: project.engine.model?.variant ?? null },
      source: resolution.source,
      roleAgents,
    };
  }

  private async claim(actionId: string, payload: object, expectedRevision: number): Promise<Claimed> {
    const loaded = await this.store.load();
    const hash = payloadHash(payload);
    const existing = loaded.state.actions.find((action) => action.id === actionId);
    if (existing) {
      if (existing.payloadHash !== hash) throw new RevisionConflict("Action ID was already used with a different payload.");
      return { project: loaded.state, duplicate: true };
    }
    if (loaded.state.revision !== expectedRevision) {
      throw new RevisionConflict(`Expected revision ${expectedRevision}, found ${loaded.state.revision}.`);
    }
    return { project: loaded.state, duplicate: false };
  }

  private async recordFailure(
    actionId: string,
    payload: object,
    expectedRevision: number,
    role: SpiritRole,
    sessionId: string | null,
    message: string,
  ) {
    const safeMessage = this.redact(message);
    const saved = await this.workflow.execute(actionId, payload, expectedRevision, (project) => {
      const next = structuredClone(project);
      next.operations.push({
        id: randomUUID(),
        kind: role === "witness" ? "witness" : "guide",
        payloadHash: payloadHash(payload),
        nativeSessionId: sessionId,
        nativeMessageId: null,
        status: "FAILED",
        result: safeMessage,
        model: project.engine.model,
        agent: null,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        statusReason: "malformed-response",
        lastObservedAt: new Date().toISOString(),
        appliedAt: null,
        providerError: null,
      });
      rememberTranscript(next, "system", safeMessage);
      return refreshNextAction(next);
    });
    throw new ExperienceFailure(safeMessage, "MALFORMED_RESPONSE", 400, true, saved.project.operations.at(-1)?.id ?? null);
  }

  private async recordUncertain(actionId: string, payload: object, expectedRevision: number, intent: string, error: unknown) {
    const nativeSessionId = typeof (error as { nativeSessionId?: unknown })?.nativeSessionId === "string"
      ? (error as { nativeSessionId: string }).nativeSessionId
      : null;
    const current = (await this.store.load()).state;
    const providerFailure = providerErrorFor(
      error,
      current.engine.model?.providerID ?? "unknown",
      nativeSessionId,
      intent === "maker" && nativeSessionId ? "possibly" : "no",
    );
    const classification = classifyNativeError(providerFailure ?? error);
    const message = this.redact(classification.message);
    const uncertain = classification.unknown || (intent === "maker" && Boolean(nativeSessionId));
    const saved = await this.workflow.execute(actionId, payload, expectedRevision, (project) => {
      const next = structuredClone(project);
      next.operations.push({
        id: randomUUID(),
        kind: intent === "maker" ? "maker" : intent === "witness" ? "witness" : "guide",
        payloadHash: payloadHash(payload),
        nativeSessionId,
        nativeMessageId: null,
        status: uncertain ? "ABANDONED" : "FAILED",
        result: message,
        model: project.engine.model,
        agent: null,
        startedAt: new Date().toISOString(),
        finishedAt: uncertain ? null : new Date().toISOString(),
        statusReason: uncertain ? "native-outcome-unconfirmed" : classification.code.toLowerCase(),
        lastObservedAt: new Date().toISOString(),
        appliedAt: null,
        providerError: providerFailure?.details ?? null,
      });
      rememberTranscript(next, "system", uncertain ? `${message} The native run was not repeated.` : message);
      return refreshNextAction(next);
    });
    throw new ExperienceFailure(
      message,
      uncertain ? "NATIVE_UNKNOWN" : classification.code,
      uncertain ? 503 : classification.status,
      uncertain ? false : classification.retryable,
      saved.project.operations.at(-1)?.id ?? null,
      providerFailure?.details ?? null,
    );
  }

  private redact(value: string): string {
    return redactText(value, this.options.redact ?? {});
  }

  private redactPrompt(value: string): string {
    return this.options.redactPrompts ? "[REDACTED_PROMPT]" : this.redact(value);
  }
}

function classifyNativeError(error: unknown): {
  code: string;
  status: number;
  retryable: boolean;
  unknown: boolean;
  message: string;
} {
  const declared = typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string }).code : null;
  if (declared === "ENGINE_AUTH") {
    return { code: "ENGINE_AUTH", status: 503, retryable: false, unknown: false, message: "OpenCode rejected the configured credentials." };
  }
  if (error instanceof ProviderRequestError) {
    return {
      code: error.details.category,
      status: error.details.technical.statusCode && error.details.technical.statusCode >= 400
        ? error.details.technical.statusCode
        : 502,
      retryable: error.details.retryable,
      unknown: false,
      message: error.details.whatHappened,
    };
  }
  if (declared === "ENGINE_INCOMPATIBLE" || declared === "MODEL_UNAVAILABLE" || declared === "MODEL_CHANGED") {
    return { code: declared, status: 503, retryable: false, unknown: false, message: error instanceof Error ? error.message : "OpenCode is not ready for this build." };
  }
  if (declared === "ENGINE_UNAVAILABLE") {
    return { code: "ENGINE_UNAVAILABLE", status: 503, retryable: true, unknown: false, message: "OpenCode is unavailable. No native work was started." };
  }
  if (error instanceof NativeBudgetError) {
    return { code: "BUDGET_EXCEEDED", status: 409, retryable: false, unknown: false, message: error.message };
  }
  if (error instanceof NativeSessionError) {
    return { code: error.code, status: 502, retryable: false, unknown: false, message: error.message };
  }
  if (error instanceof NativeTimeoutError) {
    return { code: "NATIVE_UNKNOWN", status: 503, retryable: false, unknown: true, message: "The native run timed out. Reconcile the native session before any new run." };
  }
  if (error instanceof NetworkPolicyError) {
    return { code: "NATIVE_UNKNOWN", status: 503, retryable: false, unknown: true, message: error.message };
  }
  const message = error instanceof Error ? error.message : "The native spirit could not be reached.";
  if (/\b429\b|rate limit|quota|provider limit|too many requests/i.test(message)) {
    return { code: "PROVIDER_LIMITED", status: 429, retryable: true, unknown: false, message: "The provider is limiting requests. No automatic retry was attempted." };
  }
  if (/\b401\b|\b403\b|unauthori[sz]ed|forbidden|authentication/i.test(message)) {
    return { code: "ENGINE_AUTH", status: 503, retryable: false, unknown: false, message: "OpenCode rejected the configured credentials." };
  }
  if (/\b404\b|version|incompatible/i.test(message)) {
    return { code: "ENGINE_INCOMPATIBLE", status: 503, retryable: false, unknown: false, message: "OpenCode is not compatible with this build." };
  }
  if (/permission|approval required/i.test(message)) {
    return { code: "PERMISSION_PENDING", status: 409, retryable: false, unknown: false, message: "A native permission is pending. Resolve it in OpenCode, then reconcile." };
  }
  if (/timed out|timeout|ECONN|fetch|network|socket|unavailable/i.test(message)) {
    return { code: "NATIVE_UNKNOWN", status: 503, retryable: false, unknown: true, message: "Disconnected or timed out. Reconcile the native session before any new run." };
  }
  return { code: "NATIVE_FAILED", status: 502, retryable: true, unknown: false, message };
}

function providerErrorFor(
  error: unknown,
  provider: string,
  sessionReference: string | null,
  savedWorkChanged: "no" | "possibly",
): ProviderRequestError | null {
  const code = typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string }).code : "";
  if ([
    "ENGINE_AUTH",
    "ENGINE_INCOMPATIBLE",
    "ENGINE_UNAVAILABLE",
    "MODEL_CHANGED",
    "BUDGET_EXCEEDED",
    "NATIVE_TIMEOUT",
    "EMPTY_RESPONSE",
  ].includes(code) || error instanceof NetworkPolicyError) return null;
  if (!isProviderFailureCandidate(error)) return null;
  return classifyProviderError(error, { provider, sessionReference, savedWorkChanged });
}

function sessionFor(project: Project, role: SpiritRole): string | null {
  return project.nativeSessions.find((item) => item.role === role)?.sessionId ?? null;
}

function operation(
  kind: Project["operations"][number]["kind"],
  payload: object,
  spoken: { sessionId: string; messageId: string | null },
  status: Project["operations"][number]["status"],
  result: string,
  model: ModelRef,
): Project["operations"][number] {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    kind,
    payloadHash: payloadHash(payload),
    nativeSessionId: spoken.sessionId,
    nativeMessageId: spoken.messageId,
    status,
    result,
    model,
    agent: null,
    startedAt: now,
    finishedAt: status === "SUCCEEDED" || status === "FAILED" ? now : null,
    statusReason: null,
    lastObservedAt: now,
    appliedAt: status === "SUCCEEDED" ? now : null,
    providerError: null,
  };
}
