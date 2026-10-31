import { randomUUID } from "node:crypto";
import type { OpenCodeDiscovery } from "../../shared/opencode.ts";
import type { OperationPhase, ProviderErrorDetails } from "../../shared/workflow.ts";
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
  SectionContractError,
  WorkflowConflict,
} from "../workflow/transitions.ts";
import { PHASE_DETAIL, type GuideBudgets, type SpiritGuide } from "./guide.ts";
import { NativeBudgetError, NativeSessionError, NativeTimeoutError } from "./guide.ts";
import { applyValidatedReply, GuideRunCoordinator, validateReply, type ValidatedReply } from "./guide-runs.ts";
import { applyRecoveredMakerResult, MakerRunCoordinator } from "./runs.ts";
import { runApprovedNodeCheck } from "./node-check.ts";
import { classifyNativeError, providerErrorFor as providerFailureFor } from "./failures.ts";
import { NetworkPolicyError } from "../security/network.ts";
import { markRecovered } from "./runs.ts";
import { redactText, type RedactOptions } from "../security/redaction.ts";
import { describeSectionContract, sectionContract } from "../../shared/section-contracts.ts";
import {
  extractJsonObject,
  oracleReplySchema,
  sectionReplySchema,
  witnessReplySchema,
} from "./parse.ts";
import { traceAgentOperation, traceToolOperation } from "./telemetry.ts";
import { isProviderFailureCandidate, ProviderRequestError } from "../opencode/provider-errors.ts";
import { classifyProviderError } from "../opencode/provider-errors.ts";

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
  /** Safe-poll interval for live run observation in milliseconds. */
  progressPollIntervalMs?: number;
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
  private readonly guides: GuideRunCoordinator;
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
    this.guides = new GuideRunCoordinator({
      workflow,
      guide,
      redact: (value) => redactText(value, this.options.redact ?? {}),
      pollIntervalMs: this.options.progressPollIntervalMs,
    });
  }

  async sendMessage(
    actionId: string,
    expectedRevision: number,
    intent: "clarify" | "draft" | "question" | "witness",
    text: string,
    proceedWithAssumptions = false,
    sectionId: string | null = null,
  ) {
    const payload = { intent, text, proceedWithAssumptions, sectionId };
    const claimed = await this.claim(actionId, payload, expectedRevision);
    if (claimed.duplicate) return { project: claimed.project, duplicate: true };
    const project = claimed.project;
    try {
      if (intent === "clarify" || intent === "draft" || intent === "witness") {
        // Oracle, Architect, and Witness stage runs are persisted asynchronous
        // operations: the request returns as soon as the run is queued. The
        // `question` adapter stays synchronous because it changes no saved
        // state and answers directly.
        return await this.queueGuide(actionId, payload, expectedRevision, intent, text, project, proceedWithAssumptions, sectionId);
      }
      return await this.question(actionId, payload, expectedRevision, project, text);
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

  async runMaker(actionId: string, expectedRevision: number, retryOf: string | null = null) {
    const payload = { intent: "maker", retryOf };
    const claimed = await this.claim(actionId, payload, expectedRevision);
    if (claimed.duplicate) return { project: claimed.project, duplicate: true, accepted: false };
    const project = claimed.project;
    if (project.makerScope.status !== "GRANTED" || !project.makerScope.statement) {
      throw new ExperienceFailure("Grant a separate Maker scope before a native run.", "MAKER_SCOPE_REQUIRED", 409, false);
    }
    if (retryOf) {
      const source = project.operations.find((operation) => operation.id === retryOf);
      if (!source || source.kind !== "maker" || source.status !== "FAILED") {
        throw new ExperienceFailure(
          "A Maker run can be retried only after a confirmed failure of that same run. Reconcile uncertain runs first.",
          "RETRY_NOT_CONFIRMED",
          409,
          false,
        );
      }
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
        nativeSessionId: sessionFor(next, "maker"),
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
        intent: "maker-run",
        sectionId: null,
        startingRevision: expectedRevision,
        idempotencyKey: actionId,
        expectedOutput: "MAKER_DIFF",
        retryOf,
        progress: {
          phase: "CONNECTING",
          detail: PHASE_DETAIL.CONNECTING,
          updatedAt: startedAt,
        },
        oracleProceedWithAssumptions: false,
      });
      rememberTranscript(next, "user", retryOf
        ? this.redactPrompt(`Retried the Maker run after a confirmed failure.`)
        : this.redactPrompt(`Queued a Maker run with ${context.model.providerID}/${context.model.id}${context.model.variant ? `#${context.model.variant}` : ""}.`));
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

  /** Retries a Maker run whose previous attempt failed with a confirmed outcome. */
  async retryRun(actionId: string, expectedRevision: number, operationId: string) {
    const project = await this.workflow.get();
    const operation = project.operations.find((item) => item.id === operationId);
    if (!operation) throw new WorkflowConflict("That operation is not in this project.");
    if (operation.kind !== "maker" || operation.status !== "FAILED") {
      throw new ExperienceFailure(
        "Retry after failure is available for a Maker run with a confirmed FAILED outcome. Uncertain runs must be reconciled first.",
        "RETRY_NOT_CONFIRMED",
        409,
        false,
        operationId,
      );
    }
    // A persisted FAILED status is a confirmed terminal outcome. The original
    // runner may still be completing its cleanup; that cannot duplicate work.
    return this.runMaker(actionId, expectedRevision, operationId);
  }

  /** Marks a still-outstanding operation abandoned after the user confirms. */
  async abandonRun(actionId: string, expectedRevision: number, operationId: string) {
    const payload = { operationId, intent: "mark-abandoned" };
    const claimed = await this.claim(actionId, payload, expectedRevision);
    if (claimed.duplicate) return { project: claimed.project, duplicate: true };
    if (this.runs.active(operationId) || this.guides.active(operationId)) {
      throw new ExperienceFailure("An active in-process run must be cancelled instead of abandoned.", "RUN_STILL_ACTIVE", 409, false, operationId);
    }
    return this.workflow.execute(actionId, payload, expectedRevision, (project) => {
      const next = structuredClone(project);
      const operation = next.operations.find((item) => item.id === operationId);
      if (!operation) throw new WorkflowConflict("That operation is not in this project.");
      if (["SUCCEEDED", "FAILED", "CANCELLED", "ABANDONED"].includes(operation.status)) {
        throw new WorkflowConflict("A finished or already abandoned operation cannot be marked abandoned again.");
      }
      operation.status = "ABANDONED";
      operation.statusReason = "user-marked-abandoned";
      operation.finishedAt = new Date().toISOString();
      operation.lastObservedAt = operation.finishedAt;
      operation.result = `${operation.result ?? "The native run is outstanding."} Marked abandoned without a confirmed outcome; reconcile the native session if work must be recovered later.`;
      operation.progress = null;
      rememberTranscript(next, "system", operation.result);
      return refreshNextAction(next);
    });
  }

  async cancel(actionId: string, expectedRevision: number, operationId: string) {
    void expectedRevision;
    const project = (await this.store.load()).state;
    const operation = project.operations.find((item) => item.id === operationId);
    if (!operation) throw new WorkflowConflict("That operation is not in this project.");
    if (["SUCCEEDED", "FAILED", "CANCELLED", "COMPLETED_UNAPPLIED", "ABANDONED"].includes(operation.status)) {
      throw new WorkflowConflict("A finished or abandoned operation cannot be cancelled. Reconcile an abandoned operation instead.");
    }
    const active = this.runs.active(operationId) ?? this.guides.active(operationId);
    if (!active) {
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
    if (operation?.kind === "maker") this.runs.markCancelled(operationId);
    else this.guides.markCancelled(operationId);
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
      operation.progress = null;
      operation.result = interrupted
        ? "Interrupted the native OpenCode session; the run was cancelled."
        : "Cancellation recorded. The native session was already idle or did not report an active request.";
      rememberTranscript(next, "system", operation.result);
      return refreshNextAction(next);
    });
  }

  /**
   * Reconciles an outstanding operation against its native session.
   *
   * The native outcome is observed, then the actual latest response or diff is
   * retrieved and validated before anything is applied. A validation pass marks
   * the operation once (appliedAt); repeated or duplicated reconcile actions
   * can never apply native work twice, and an idle session is never treated as
   * a successful run on its own.
   */
  async reconcile(actionId: string, expectedRevision: number, operationId: string) {
    const payload = { operationId, intent: "reconcile" };
    const claimed = await this.claim(actionId, payload, expectedRevision);
    if (claimed.duplicate) return { project: claimed.project, duplicate: true };
    const current = (await this.store.load()).state;
    const operation = current.operations.find((item) => item.id === operationId);
    if (!operation?.nativeSessionId) {
      throw new ExperienceFailure("This operation has no native session to reconcile.", "NOTHING_TO_RECONCILE", 409, false, operationId);
    }
    if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(operation.status)) {
      throw new ExperienceFailure("A finished operation does not need reconciliation.", "ALREADY_FINISHED", 409, false, operationId);
    }
    const role = operation.kind === "maker"
      ? "maker"
      : operation.kind === "witness"
        ? "witness"
        : operation.intent === "clarify" ? "oracle" : "architect";
    const sessionId = operation.nativeSessionId;

    // A waiting permission stays waiting until OpenCode reports it resolved.
    if (operation.status === "WAITING_PERMISSION" || operation.status === "ABANDONED"
      || operation.progress?.phase === "WAITING_PERMISSION") {
      const pending = this.guide.hasPendingPermission
        ? await this.guide.hasPendingPermission(sessionId, operation.kind === "maker" ? this.options.demoWorkspace : this.options.safeDirectory)
        : null;
      if (pending === true) {
        return this.workflow.execute(actionId, payload, expectedRevision, (project) =>
          markPermissionStillPending(project, operationId));
      }
    }

    const observed = await this.guide.inspect(sessionId, {
      conversationId: current.id,
      role,
    });

    if (observed === "running") {
      return this.workflow.execute(actionId, payload, expectedRevision, (project) =>
        markRecovered(project, operationId, {
          status: "RUNNING",
          result: "The native session is still running. It was not started again; keep waiting or reconcile later.",
          sessionId,
          messageId: operation.nativeMessageId,
          diff: null,
          check: null,
          model: operation.model,
          phase: "RECEIVING_OUTPUT",
        }));
    }

    if (observed === "unknown" && operation.kind !== "maker") {
      // An unknown guide outcome stays reconcilable; nothing is invented here.
      return this.workflow.execute(actionId, payload, expectedRevision, (project) =>
        markRecoveredGuide(project, operationId, {
          status: "ABANDONED",
          result: "Native outcome is still unknown. This action was not repeated; reconcile again later or mark it abandoned.",
          statusReason: "native-outcome-unconfirmed",
          phase: "AWAITING_RECONCILIATION",
        }));
    }

    if (operation.kind === "maker") {
      // An idle Maker session is never success on its own: read the outcome
      // plus the actual recovered diff, then apply it exactly once.
      const diff = observed === "succeeded" && this.guide.sessionDiff
        ? await this.guide.sessionDiff(sessionId, this.options.demoWorkspace)
        : null;
      await applyRecoveredMakerResult(
        { workflow: this.workflow, demoWorkspace: this.options.demoWorkspace, nodeCheckTimeoutMs: this.budgets.nodeCheckTimeoutMs },
        {
          projectId: current.id,
          operationId,
          observed,
          diff,
          sessionId,
          messageId: operation.nativeMessageId,
          model: operation.model,
        },
      );
      const project = (await this.store.load()).state;
      return { project, duplicate: false };
    }

    // Guide operation: retrieve the actual late response before applying it.
    const snapshot = this.guide.lastAssistantText
      ? await this.guide.lastAssistantText(sessionId)
      : null;
    if (observed === "succeeded" && !snapshot) {
      return this.workflow.execute(actionId, payload, expectedRevision, (project) =>
        markRecoveredGuide(project, operationId, {
          status: "COMPLETED_UNAPPLIED",
          result: "The native session reported success, but the recovered reply could not be read yet. Reconcile again before any new run.",
          statusReason: "native-result-not-retrieved",
          phase: "AWAITING_RECONCILIATION",
        }));
    }
    if (observed === "failed") {
      return this.workflow.execute(actionId, payload, expectedRevision, (project) =>
        markRecoveredGuide(project, operationId, {
          status: "FAILED",
          result: "Reconciled from a failed or interrupted native session.",
          statusReason: "native-failure-confirmed",
          phase: null,
        }));
    }
    const intent = operation.intent === "clarify" || operation.intent === "draft" || operation.intent === "witness"
      ? operation.intent
      : null;
    if (!intent) {
      throw new ExperienceFailure(
        "This operation has no replayable guide action. Mark it abandoned and repeat the request.",
        "GUIDE_INTENT_UNKNOWN",
        409,
        false,
        operationId,
      );
    }
    const expected = readExpectedOutput(operation);
    if (expected === "QUESTION_REPLY" && observed === "succeeded") {
      // A question never mutates saved state; record the late confirmation.
      return this.workflow.execute(actionId, payload, expectedRevision, (project) =>
        markRecoveredGuide(project, operationId, {
          status: "SUCCEEDED",
          result: "Reconciled from the native session outcome.",
          statusReason: null,
          phase: null,
          messageId: snapshot?.messageId ?? null,
        }));
    }
    const reply = snapshot
      ? validateReply(intent, snapshot.text, (value) => this.redact(value))
      : { ok: false as const, resultText: "The recovered reply could not be read." };
    if (!reply.ok) {
      return this.workflow.execute(actionId, payload, expectedRevision, (project) =>
        markRecoveredGuide(project, operationId, {
          status: "FAILED",
          result: `The late ${spiritName(intent)} response does not match the expected format, so nothing was applied. Reply summary: ${reply.resultText.slice(0, 200)}`,
          statusReason: "malformed-response",
          phase: null,
          messageId: snapshot?.messageId ?? null,
        }));
    }
    let result;
    try {
      result = await this.workflow.execute(actionId, payload, expectedRevision, (project) =>
        applyValidatedReply(project, operationId, reply, {
          redact: (value) => this.redact(value),
          sessionId,
          messageId: snapshot?.messageId ?? null,
        }));
    } catch (error) {
      if (error instanceof SectionContractError) {
        return this.workflow.execute(actionId, payload, expectedRevision, (project) =>
          markRecoveredGuide(project, operationId, {
            status: "FAILED",
            result: `The late Architect candidate does not satisfy its content contract, so nothing was applied. ${error.message}`,
            statusReason: "contract-invalid",
            phase: null,
            messageId: snapshot?.messageId ?? null,
          }));
      }
      throw error;
    }
    const next = result.project;
    return { project: next, duplicate: result.duplicate };
  }

  isRunActive(operationId: string): boolean {
    return this.runs.active(operationId) !== null || this.guides.active(operationId) !== null;
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

  private async queueGuide(
    actionId: string,
    payload: object,
    expectedRevision: number,
    intent: "clarify" | "draft" | "witness",
    text: string,
    project: Project,
    proceedWithAssumptions: boolean,
    requestedSectionId: string | null,
  ) {
    if (intent === "clarify" && project.product.status === "APPROVED") {
      throw new ExperienceFailure("The product proposal is already approved.", "PRODUCT_ALREADY_APPROVED", 409, false);
    }
    if (intent === "clarify" && project.source.status !== "CONFIRMED") {
      throw new ExperienceFailure(
        project.source.status === "PENDING_CONFIRMATION"
          ? "Confirm the managed remote workspace before starting Oracle discovery."
          : "Choose a project source before starting Oracle discovery.",
        "PROJECT_SOURCE_REQUIRED",
        409,
        false,
      );
    }
    const targetSection = intent === "draft"
      ? project.sections.find((section) => section.id === (requestedSectionId ?? project.currentSectionId)) ?? null
      : null;
    if (intent === "draft" && (project.product.status !== "APPROVED" || !targetSection)) {
      throw new ExperienceFailure("Drafting waits for an approved product and a known section.", "SECTION_NOT_READY", 409, false);
    }
    if (intent === "witness") {
      const makerDone = project.operations.some((operation) => operation.kind === "maker" && operation.status === "SUCCEEDED");
      if (!makerDone) throw new ExperienceFailure("Witness review waits for a completed Maker run.", "WITNESS_NOT_READY", 409, false);
    }
    if (project.operations.some((operation) => ["QUEUED", "RUNNING", "WAITING_PERMISSION", "COMPLETED_UNAPPLIED", "ABANDONED"].includes(operation.status))) {
      throw new ExperienceFailure("An earlier native run is unresolved. Reconcile it before starting another.", "RUN_UNRESOLVED", 409, false);
    }
    const context = await this.modelContext(project);
    const startedAt = new Date().toISOString();
    const expectedOutput = intent === "clarify" ? "ORACLE_REPLY" : intent === "draft" ? "SECTION_DRAFT" : "WITNESS_REPLY";
    const sessionId = sessionFor(project, intent === "witness" ? "witness" : intent === "draft" ? "architect" : "oracle");
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
        kind: intent === "witness" ? "witness" : "guide",
        payloadHash: payloadHash(payload),
        nativeSessionId: sessionId,
        nativeMessageId: null,
        status: "QUEUED",
        result: `Queued for OpenCode with ${context.model.providerID}/${context.model.id}${context.model.variant ? `#${context.model.variant}` : ""}.`,
        model: context.model,
        agent: context.roleAgents[intent === "witness" ? "witness" : intent === "draft" ? "architect" : "oracle"],
        startedAt,
        finishedAt: null,
        statusReason: null,
        lastObservedAt: null,
        appliedAt: null,
        providerError: null,
        intent,
        sectionId: intent === "draft" ? targetSection?.id ?? null : null,
        startingRevision: expectedRevision,
        idempotencyKey: actionId,
        expectedOutput,
        retryOf: null,
        progress: {
          phase: "CONNECTING",
          detail: PHASE_DETAIL.CONNECTING,
          updatedAt: startedAt,
        },
        oracleProceedWithAssumptions: intent === "clarify" && proceedWithAssumptions,
      });
      rememberTranscript(next, "user", this.redactPrompt(text));
      return refreshNextAction(next);
    });
    const operation = queued.project.operations.at(-1);
    if (!operation) throw new ExperienceFailure("The run was not recorded.", "RUN_NOT_RECORDED", 500, true);
    const role: "oracle" | "architect" | "maker" | "witness" = intent === "witness" ? "witness" : intent === "draft" ? "architect" : "oracle";
    try {
      const prompt = await this.instructions(role, queued.project, text, context.model, operation.sectionId);
      this.guides.start({
        operationId: operation.id,
        actionId,
        projectId: queued.project.id,
        intent,
        expectedOutput,
        sectionId: operation.sectionId,
        userText: text,
        sessionId,
        prompt,
        workspace: this.options.safeDirectory,
        model: context.model,
        agent: context.roleAgents[intent === "witness" ? "witness" : intent === "draft" ? "architect" : "oracle"],
        budget: queued.project.modelPreferences.budget,
      });
    } catch (error) {
      await this.guides.markFailed({
        operationId: operation.id,
        actionId,
        projectId: queued.project.id,
        intent,
        expectedOutput,
        sectionId: operation.sectionId,
        userText: text,
        sessionId,
        prompt: "",
        workspace: this.options.safeDirectory,
        model: context.model,
        agent: null,
        budget: queued.project.modelPreferences.budget,
      }, error);
      throw error instanceof ExperienceFailure
        ? error
        : new ExperienceFailure(error instanceof Error ? this.redact(error.message) : "The run could not start.", "RUN_START_FAILED", 500, true, operation.id);
    }
    return { project: queued.project, duplicate: false, accepted: true, operation };
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
        next.operations.push({
          id: randomUUID(),
          kind: "guide",
          payloadHash: payloadHash(payload),
          nativeSessionId: spoken.sessionId,
          nativeMessageId: null,
          status: "SUCCEEDED",
          result: "Question answered without changing approvals.",
          model: context.model,
          agent: context.roleAgents[role],
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          statusReason: null,
          lastObservedAt: new Date().toISOString(),
          appliedAt: new Date().toISOString(),
          providerError: null,
          intent: "question",
          sectionId: null,
          startingRevision: expectedRevision,
          idempotencyKey: actionId,
          expectedOutput: "QUESTION_REPLY",
          retryOf: null,
          progress: null,
          oracleProceedWithAssumptions: false,
        });
        return refreshNextAction(next);
      });
    });
  }

  private async instructions(
    role: "oracle" | "architect" | "maker" | "witness",
    project: Project,
    text: string,
    model: ModelRef,
    sectionId: string | null = null,
  ): Promise<string> {
    const procedure = await loadStagePrompt(role === "maker" ? "maker" : stagePrompt[role], this.options.promptRoot);
    const section = project.sections.find((item) => item.id === (sectionId ?? project.currentSectionId));
    const contract = role === "architect" && section ? sectionContract(section.id) : null;
    const shape = role === "oracle"
      ? '{"mode":"questions|proposal","questions":[{"id":"...","field":"intendedUser|problem|desiredOutcome|deadlineEvent|mustHaveFeatures|optionalFeatures|budget|privacyRequirements|platforms|repositoryCondition|nonGoals|unresolvedQuestions","prompt":"...","whyItMatters":"...","suggestedChoices":["..."]}],"assumptions":[{"id":"...","field":"...","statement":"...","reason":"..."}],"knownConstraints":["..."],"intake":{"intendedUser":{"value":"...","source":"USER|ASSUMPTION|SYSTEM"}|null,"problem":null,"desiredOutcome":null,"deadlineEvent":null,"mustHaveFeatures":{"value":["..."],"source":"USER|ASSUMPTION|SYSTEM"}|null,"optionalFeatures":null,"budget":null,"privacyRequirements":null,"platforms":null,"repositoryCondition":null,"nonGoals":null},"proposal":null|{"title":"...","summary":"...","intendedUser":"...","problem":"...","desiredOutcome":"...","mustHaveFeatures":["..."],"optionalFeatures":["..."],"nonGoals":["..."],"successCriteria":["..."],"facts":["..."],"userDecisions":["..."],"assumptions":["..."]},"unresolvedRisks":["..."],"recommendedNextAction":"..."}'
      : role === "architect"
        ? '{"content":"complete Markdown section","summary":"what changed and why","recommendation":"...","tradeoff":"..."}'
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
      role === "architect" && contract ? `Section content contract:\n${describeSectionContract(contract)}` : "",
      role === "architect" && section
        ? `Current section draft (v${section.version}, ${section.status}):\n${section.content || "(empty; draft the complete section)"}`
        : "",
      role === "oracle"
        ? `project source:\n${JSON.stringify({
            kind: project.source.kind,
            status: project.source.status,
            label: project.source.label,
            repositoryUrl: project.source.repositoryUrl,
            managedWorkspace: project.source.managedWorkspace,
            repositoryCondition: project.source.repositoryCondition,
          })}`
        : "",
      role === "oracle" ? `current structured intake:\n${JSON.stringify(project.oracleIntake)}` : "",
      role === "oracle" ? `active project memory:\n${JSON.stringify({
        answers: (project.memory.answers ?? []).filter((entry) => entry.status !== "SUPERSEDED"),
        assumptions: (project.memory.assumptions ?? []).filter((entry) => entry.status !== "SUPERSEDED"),
        facts: project.memory.facts.filter((entry) => entry.status !== "SUPERSEDED"),
        decisions: project.memory.decisions.filter((entry) => entry.status !== "SUPERSEDED"),
        constraints: project.memory.constraints.filter((entry) => entry.status !== "SUPERSEDED"),
        risks: project.memory.risks.filter((entry) => entry.status !== "SUPERSEDED"),
      })}` : "",
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
        : role === "oracle"
          ? [
              "Keep the complete Prompt 0 procedure above active; this JSON contract is only the persistence adapter for the current turn, not a replacement for those instructions.",
              "Ask no more than two or three high-value questions in a turn. Each question must say why the answer matters and may offer concise choices.",
              "Return the complete consolidated intake on every turn. Preserve prior USER answers unless the user corrects them. Mark inferred values ASSUMPTION and system/source facts SYSTEM.",
              "Use mode questions while essential intake is missing. Use mode proposal only when intended user, problem, desired outcome, and at least one must-have are known, or when the user explicitly asks to proceed with clearly stated assumptions.",
              "In proposal mode, distinguish facts, user decisions, and assumptions in the structured proposal. Never treat an assumption as a user decision.",
              `Reply with one JSON object only, matching ${shape}. Do not approve, advance, or claim the user approved.`,
            ].join("\n")
          : role === "architect"
            ? [
                "Return a complete replacement candidate, not a patch and not a direct edit of saved state.",
                "The content field must be readable GitHub-flavoured Markdown with headings, paragraphs, lists, tables where useful, and fenced code where needed.",
                "Never emit raw HTML, scripts, event handlers, or javascript: links. The app renders only the safe Markdown subset.",
                "Satisfy every required topic, dependency acknowledgement, risk, decision, and acceptance criterion in the contract. Do not pad with repeated text or rely on word count.",
                "The summary field must describe what changed and why in one or two sentences. The candidate is shown to the user as a diff before anything is accepted.",
                `Reply with one JSON object only, matching ${shape}. Do not approve, advance, or claim the user approved. A question is not approval.`,
              ].join("\n")
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

  private async recordUncertain(actionId: string, payload: object, expectedRevision: number, intent: string, error: unknown): Promise<never> {
    const nativeSessionId = typeof (error as { nativeSessionId?: unknown })?.nativeSessionId === "string"
      ? (error as { nativeSessionId: string }).nativeSessionId
      : null;
    const current = (await this.store.load()).state;
    const providerFailure = providerFailureFor(
      error,
      current.engine.model?.providerID ?? "unknown",
      nativeSessionId,
      intent === "maker" && nativeSessionId ? "possibly" : "no",
    );
    const classification = classifyNativeError(error);
    const message = this.redact(providerFailure?.whatHappened ?? classification.message);
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
        providerError: providerFailure ?? null,
        intent: intent === "clarify" || intent === "draft" || intent === "witness" || intent === "question"
          ? intent
          : "maker-run",
        sectionId: null,
        startingRevision: expectedRevision,
        idempotencyKey: actionId,
        expectedOutput: intent === "clarify"
          ? "ORACLE_REPLY"
          : intent === "draft"
            ? "SECTION_DRAFT"
            : intent === "witness"
              ? "WITNESS_REPLY"
              : intent === "question"
                ? "QUESTION_REPLY"
                : "MAKER_DIFF",
        retryOf: null,
        progress: uncertain
          ? {
              phase: "AWAITING_RECONCILIATION",
              detail: PHASE_DETAIL.AWAITING_RECONCILIATION,
              updatedAt: new Date().toISOString(),
            }
          : null,
        oracleProceedWithAssumptions: intent === "clarify" && Boolean((payload as { proceedWithAssumptions?: boolean }).proceedWithAssumptions),
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
      providerFailure ?? null,
    );
  }

  private redact(value: string): string {
    return redactText(value, this.options.redact ?? {});
  }

  private redactPrompt(value: string): string {
    return this.options.redactPrompts ? "[REDACTED_PROMPT]" : this.redact(value);
  }
}

/**
 * Keeps a resolved permission request visible: the operation stays in its
 * pending state until the coordinator or a reconcile observes the session.
 */
function markPermissionStillPending(project: Project, operationId: string): Project {
  const next = structuredClone(project);
  const operation = next.operations.find((item) => item.id === operationId);
  if (!operation) throw new WorkflowConflict("That operation is not in this project.");
  const now = new Date().toISOString();
  operation.lastObservedAt = now;
  operation.statusReason = "permission-pending";
  operation.result = "A native permission request is still pending. Resolve it in OpenCode, then reconcile. The run was not repeated.";
  operation.progress = {
    phase: "WAITING_PERMISSION",
    detail: PHASE_DETAIL.WAITING_PERMISSION,
    updatedAt: now,
  };
  return refreshNextAction(next);
}

/**
 * Records a guide-side reconcile outcome: retrieval, validation, and failure
 * of a late response, each kept exactly once.
 */
function markRecoveredGuide(
  project: Project,
  operationId: string,
  outcome: {
    status: "SUCCEEDED" | "FAILED" | "COMPLETED_UNAPPLIED" | "ABANDONED";
    result: string;
    statusReason: string | null;
    phase: OperationPhase | null;
    messageId?: string | null;
  },
): Project {
  const next = structuredClone(project);
  const operation = next.operations.find((item) => item.id === operationId);
  if (!operation) throw new WorkflowConflict("That operation is not in this project.");
  if (operation.appliedAt) return refreshNextAction(next);
  const now = new Date().toISOString();
  operation.status = outcome.status;
  operation.nativeMessageId = outcome.messageId ?? operation.nativeMessageId;
  operation.statusReason = outcome.statusReason;
  operation.result = outcome.result;
  operation.lastObservedAt = now;
  operation.progress = null;
  operation.finishedAt = outcome.status === "COMPLETED_UNAPPLIED" || outcome.status === "ABANDONED"
    ? operation.finishedAt
    : (operation.finishedAt ?? now);
  if (outcome.phase) {
    operation.progress = {
      phase: outcome.phase,
      detail: PHASE_DETAIL[outcome.phase],
      updatedAt: now,
    };
  }
  rememberTranscript(
    next,
    operation.kind === "witness" ? "witness" : operation.intent === "clarify" ? "oracle" : "architect",
    outcome.result.slice(0, 4_000),
  );
  return refreshNextAction(next);
}

function readExpectedOutput(operation: Project["operations"][number]): Project["operations"][number]["expectedOutput"] {
  return operation.expectedOutput
    ?? (operation.intent === "clarify" ? "ORACLE_REPLY" : operation.intent === "draft" ? "SECTION_DRAFT" : operation.intent === "witness" ? "WITNESS_REPLY" : "QUESTION_REPLY");
}

function spiritName(intent: "clarify" | "draft" | "witness"): string {
  return intent === "clarify" ? "Oracle" : intent === "draft" ? "Architect" : "Witness";
}

function sessionFor(project: Project, role: SpiritRole): string | null {
  return project.nativeSessions.find((item) => item.role === role)?.sessionId ?? null;
}
