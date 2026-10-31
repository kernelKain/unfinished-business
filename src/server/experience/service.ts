import { randomUUID } from "node:crypto";
import { payloadHash, refreshNextAction, type Project, type SpiritRole } from "../workflow/model.ts";
import { AtomicProjectStore, RevisionConflict } from "../store/atomic-project-store.ts";
import { loadStagePrompt, type Stage } from "../prompts/loader.ts";
import { WorkflowService } from "../workflow/service.ts";
import {
  approveProduct,
  grantMakerScope,
  recordOracleProposal,
  recordWitnessDrafts,
  rememberSession,
  rememberTranscript,
  reviseSection,
  WorkflowConflict,
} from "../workflow/transitions.ts";
import type { SpiritGuide } from "./guide.ts";
import { runApprovedNodeCheck } from "./node-check.ts";
import {
  extractJsonObject,
  formatSectionDraft,
  oracleReplySchema,
  sectionReplySchema,
  witnessReplySchema,
} from "./parse.ts";
import { traceAgentOperation, traceToolOperation } from "./telemetry.ts";

export class ExperienceFailure extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly retryable: boolean,
    readonly operationId: string | null = null,
  ) {
    super(message);
  }
}

interface Claimed {
  project: Project;
  duplicate: boolean;
}

const stagePrompt: Record<"oracle" | "architect" | "witness", Stage> = {
  oracle: "oracle",
  architect: "architect",
  witness: "witness",
};

export class ExperienceService {
  constructor(
    private readonly workflow: WorkflowService,
    private readonly store: AtomicProjectStore,
    private readonly guide: SpiritGuide,
    private readonly options: { safeDirectory: string; demoWorkspace: string; promptRoot?: string },
  ) {}

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
      if (error instanceof ExperienceFailure || error instanceof WorkflowConflict || error instanceof RevisionConflict) throw error;
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
    if (claimed.duplicate) return { project: claimed.project, duplicate: true };
    const project = claimed.project;
    if (project.makerScope.status !== "GRANTED" || !project.makerScope.statement) {
      throw new ExperienceFailure("Grant a separate Maker scope before a native run.", "MAKER_SCOPE_REQUIRED", 409, false);
    }
    const makerScope = project.makerScope.statement;
    return traceAgentOperation("maker", project.id, async () => {
      const prompt = await this.instructions("maker", project, makerScope);
      let performed;
      try {
        performed = await this.guide.perform({
          conversationId: project.id,
          sessionId: sessionFor(project, "maker"),
          prompt,
          workspace: this.options.demoWorkspace,
        });
      } catch (error) {
        return this.recordUncertain(actionId, payload, expectedRevision, "maker", error);
      }
      const edited = !performed.diff.includes("without a file diff");
      const check = edited
        ? await traceToolOperation("maker", project.id, "node.test", () => runApprovedNodeCheck(this.options.demoWorkspace))
        : null;
      return this.workflow.execute(actionId, payload, expectedRevision, (current) => {
        const next = structuredClone(current);
        rememberSession(next, "maker", performed.sessionId);
        const checkText = check
          ? `Node check exit ${check.code ?? "unavailable"}. ${check.output}`
          : "No native diff, so the Node check did not run.";
        next.operations.push({
          id: randomUUID(),
          kind: "maker",
          payloadHash: payloadHash(payload),
          nativeSessionId: performed.sessionId,
          nativeMessageId: performed.messageId,
          status: edited ? "SUCCEEDED" : "FAILED",
          result: `${performed.diff}\n\n${checkText}`,
        });
        if (check) {
          next.evidence.push({
            id: randomUUID(),
            checkId: "CK-06",
            nativeResultReference: performed.sessionId,
            testedFingerprint: payloadHash(check.output),
            result: check.code === 0 ? "PASS" : "FAIL",
            observedAt: new Date().toISOString(),
            limitation: check.code === 0 ? null : "The native edit did not leave a passing Node test.",
          });
          const capability = next.capabilities.find((item) => item.id === "node-check");
          if (capability) {
            capability.availability = "available";
            capability.observedOutcome = check.code === 0 ? "PASS" : "FAIL";
          }
          const inspection = next.capabilities.find((item) => item.id === "inspect-changes");
          if (inspection) {
            inspection.availability = "available";
            inspection.observedOutcome = performed.diff;
          }
        }
        rememberTranscript(next, "maker", edited ? performed.diff : "Maker finished without a file change.");
        return refreshNextAction(next);
      });
    });
  }

  async cancel(actionId: string, expectedRevision: number, operationId: string) {
    return this.workflow.execute(actionId, { operationId }, expectedRevision, (project) => {
      const next = structuredClone(project);
      const operation = next.operations.find((item) => item.id === operationId);
      if (!operation) throw new WorkflowConflict("That operation is not in this project.");
      if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(operation.status)) {
        throw new WorkflowConflict("A finished operation cannot be cancelled.");
      }
      operation.status = "CANCELLED";
      operation.result = "Cancelled before another native attempt.";
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
        current.result = "Reconciled from the native session outcome.";
      } else if (observed === "failed") {
        current.status = "FAILED";
        current.result = "Reconciled from a failed or interrupted native session.";
      } else {
        current.status = "UNKNOWN";
        current.result = "Native outcome is still unknown. This action was not repeated.";
      }
      return refreshNextAction(next);
    });
  }

  async exportApproved() {
    const project = await this.workflow.get();
    const unresolved = project.sections.filter((section) => section.status !== "APPROVED");
    const plan = unresolved.length
      ? null
      : project.sections
        .toSorted((left, right) => left.order - right.order)
        .map((section) => `## ${section.title}\n\n${section.content}`)
        .join("\n\n");
    return {
      plan,
      unresolved: unresolved.map((section) => section.id),
      drafts: project.witnessDrafts.map((draft) => ({ title: draft.title, content: draft.content })),
      limitation: "Witness drafts are in-app review notes. They are not a submitted article, video, or entry.",
    };
  }

  private async clarify(actionId: string, payload: object, expectedRevision: number, project: Project, text: string) {
    return traceAgentOperation("oracle", project.id, async () => {
      if (project.product.status === "APPROVED") {
        throw new ExperienceFailure("The product proposal is already approved.", "PRODUCT_ALREADY_APPROVED", 409, false);
      }
      const spoken = await this.guide.speak({
        role: "oracle",
        conversationId: project.id,
        sessionId: sessionFor(project, "oracle"),
        prompt: await this.instructions("oracle", project, text),
        workspace: this.options.safeDirectory,
      });
      const reply = oracleReplySchema.parse(extractJsonObject(spoken.text));
      return this.workflow.execute(actionId, payload, expectedRevision, (current) => {
        const seeded = structuredClone(current);
        rememberTranscript(seeded, "user", text);
        const next = recordOracleProposal(seeded, { ...reply, sessionId: spoken.sessionId });
        next.operations.push(operation("guide", payload, spoken, "Oracle proposal stored. It is not approved."));
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
      const spoken = await this.guide.speak({
        role: "architect",
        conversationId: project.id,
        sessionId: sessionFor(project, "architect"),
        prompt: await this.instructions("architect", project, text),
        workspace: this.options.safeDirectory,
      });
      let reply;
      try {
        reply = sectionReplySchema.parse(extractJsonObject(spoken.text));
      } catch {
        const prose = spoken.text.trim();
        if (prose.length < 80) {
          return this.recordFailure(actionId, payload, expectedRevision, "architect", spoken.sessionId, `The Architect reply was malformed, so the section was left unchanged. Reply began: ${prose.slice(0, 240)}`);
        }
        reply = {
          content: prose.slice(0, 12_000),
          recommendation: "The Architect returned prose. Review the draft before approval.",
          tradeoff: "Separate recommendation and tradeoff fields were not returned.",
        };
      }
      const content = formatSectionDraft(reply);
      return this.workflow.execute(actionId, payload, expectedRevision, (current) => {
        const next = reviseSection(current, sectionId, content);
        rememberSession(next, "architect", spoken.sessionId);
        rememberTranscript(next, "user", text);
        rememberTranscript(next, "architect", content);
        next.operations.push(operation("guide", payload, spoken, "Draft stored as the current section version."));
        return refreshNextAction(next);
      });
    });
  }

  private async question(actionId: string, payload: object, expectedRevision: number, project: Project, text: string) {
    const role = project.stage === "ORACLE" ? "oracle" : "architect";
    return traceAgentOperation(role, project.id, async () => {
      const spoken = await this.guide.speak({
        role,
        conversationId: project.id,
        sessionId: sessionFor(project, role),
        prompt: await this.instructions(role, project, `The user is asking a question. This is not approval and must not change an approved artifact.\n\n${text}`),
        workspace: this.options.safeDirectory,
      });
      return this.workflow.execute(actionId, payload, expectedRevision, (current) => {
        const next = structuredClone(current);
        rememberSession(next, role, spoken.sessionId);
        rememberTranscript(next, "user", text);
        rememberTranscript(next, role, spoken.text.slice(0, 4_000));
        next.operations.push(operation("guide", payload, spoken, "Question answered without changing approvals."));
        return refreshNextAction(next);
      });
    });
  }

  private async witness(actionId: string, payload: object, expectedRevision: number, project: Project, text: string) {
    return traceAgentOperation("witness", project.id, async () => {
      const makerDone = project.operations.some((operation) => operation.kind === "maker" && operation.status === "SUCCEEDED");
      if (!makerDone) throw new ExperienceFailure("Witness review waits for a completed Maker run.", "WITNESS_NOT_READY", 409, false);
      const spoken = await this.guide.speak({
        role: "witness",
        conversationId: project.id,
        sessionId: null,
        prompt: await this.instructions("witness", project, text),
        workspace: this.options.safeDirectory,
      });
      let reply;
      try {
        reply = witnessReplySchema.parse(extractJsonObject(spoken.text));
      } catch {
        const prose = spoken.text.trim();
        if (prose.length < 80) {
          return this.recordFailure(actionId, payload, expectedRevision, "witness", spoken.sessionId, `The Witness reply was malformed, so no draft was stored. Reply began: ${prose.slice(0, 240)}`);
        }
        reply = {
          findings: prose.slice(0, 8_000),
          limitations: "The Witness returned prose rather than separate fields.",
          draftNotes: "These notes are an in-app review. They are not a submitted article or video.",
        };
      }
      return this.workflow.execute(actionId, payload, expectedRevision, (current) => {
        const next = recordWitnessDrafts(current, [
          { title: "Findings", content: reply.findings },
          { title: "Limitations", content: reply.limitations },
          { title: "Draft notes", content: reply.draftNotes },
        ], spoken.sessionId);
        next.operations.push(operation("witness", payload, spoken, "Witness drafts stored from a fresh session."));
        return refreshNextAction(next);
      });
    });
  }

  private async instructions(role: "oracle" | "architect" | "maker" | "witness", project: Project, text: string): Promise<string> {
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
    const saved = await this.workflow.execute(actionId, payload, expectedRevision, (project) => {
      const next = structuredClone(project);
      const operationId = randomUUID();
      next.operations.push({
        id: operationId,
        kind: role === "witness" ? "witness" : "guide",
        payloadHash: payloadHash(payload),
        nativeSessionId: sessionId,
        nativeMessageId: null,
        status: "FAILED",
        result: message,
      });
      rememberTranscript(next, "system", message);
      return refreshNextAction(next);
    });
    throw new ExperienceFailure(message, "MALFORMED_RESPONSE", 400, true, saved.project.operations.at(-1)?.id ?? null);
  }

  private async recordUncertain(actionId: string, payload: object, expectedRevision: number, intent: string, error: unknown) {
    const message = error instanceof Error ? error.message : "The native spirit could not be reached.";
    const uncertain = /timed out|ECONN|fetch|network|socket|unavailable/i.test(message);
    const saved = await this.workflow.execute(actionId, payload, expectedRevision, (project) => {
      const next = structuredClone(project);
      next.operations.push({
        id: randomUUID(),
        kind: intent === "maker" ? "maker" : intent === "witness" ? "witness" : "guide",
        payloadHash: payloadHash(payload),
        nativeSessionId: null,
        nativeMessageId: null,
        status: uncertain ? "UNKNOWN" : "FAILED",
        result: uncertain
          ? "Disconnected or timed out. Reconcile the native session before any new run."
          : message,
      });
      rememberTranscript(next, "system", uncertain
        ? "The native run is unknown. It was not repeated."
        : message);
      return refreshNextAction(next);
    });
    throw new ExperienceFailure(
      saved.project.operations.at(-1)?.result ?? message,
      uncertain ? "NATIVE_UNKNOWN" : "NATIVE_FAILED",
      uncertain ? 503 : 502,
      !uncertain,
      saved.project.operations.at(-1)?.id ?? null,
    );
  }
}

function sessionFor(project: Project, role: SpiritRole): string | null {
  return project.nativeSessions.find((item) => item.role === role)?.sessionId ?? null;
}

function operation(
  kind: Project["operations"][number]["kind"],
  payload: object,
  spoken: { sessionId: string; messageId: string | null },
  result: string,
): Project["operations"][number] {
  return {
    id: randomUUID(),
    kind,
    payloadHash: payloadHash(payload),
    nativeSessionId: spoken.sessionId,
    nativeMessageId: spoken.messageId,
    status: "SUCCEEDED",
    result,
  };
}
