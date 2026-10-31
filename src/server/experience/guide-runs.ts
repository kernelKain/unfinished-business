import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type { ExpectedOutput, ModelRef, OperationPhase, Project } from "../../shared/workflow.ts";
import { refreshNextAction, type Operation } from "../workflow/model.ts";
import { WorkflowService } from "../workflow/service.ts";
import {
  recordSectionCandidate,
  rememberSession,
  rememberTranscript,
  recordOracleProposal,
  recordWitnessDrafts,
} from "../workflow/transitions.ts";
import { PHASE_DETAIL, type SpiritGuide } from "./guide.ts";
import { setProgress, writeProgress } from "./progress.ts";
import { classifyNativeError, failureIsUncertain, providerErrorFor } from "./failures.ts";
import {
  extractJsonObject,
  oracleReplySchema,
  sectionReplySchema,
  witnessReplySchema,
} from "./parse.ts";

export interface GuideRunInput {
  operationId: string;
  /** Idempotency key: the HTTP action id that queued this run. */
  actionId: string;
  projectId: string;
  intent: "clarify" | "draft" | "witness";
  expectedOutput: ExpectedOutput;
  sectionId: string | null;
  userText: string;
  sessionId: string | null;
  prompt: string;
  workspace: string;
  model: ModelRef;
  agent: string | null;
  budget: Project["modelPreferences"]["budget"];
}

export type ValidatedReply =
  | { ok: true; intent: "clarify"; reply: z.infer<typeof oracleReplySchema> }
  | { ok: true; intent: "draft"; reply: z.infer<typeof sectionReplySchema> }
  | { ok: true; intent: "witness"; reply: z.infer<typeof witnessReplySchema> };

export interface ReplyApplyContext {
  redact: (value: string) => string;
  sessionId: string;
  /** Native message id of a recovered late reply, if known. */
  messageId?: string | null;
  /** The user's original change request, retained with the candidate for audit. */
  requestedChange?: string;
}

/**
 * Owns the in-process half of an asynchronous Oracle, Architect, or Witness
 * run. The queued operation is persisted before any native call; the HTTP
 * request never blocks on the model, progress phases are persisted so a
 * browser refresh shows where the run is, and a timeout or disconnect leaves
 * a reconcilable record instead of a broken workflow.
 */
export class GuideRunCoordinator {
  private readonly activeRuns = new Map<string, { sessionId: string | null; cancelled: boolean }>();

  constructor(
    private readonly options: {
      workflow: WorkflowService;
      guide: SpiritGuide;
      redact: (value: string) => string;
      pollIntervalMs?: number;
    },
  ) {}

  start(input: GuideRunInput): void {
    if (this.activeRuns.has(input.operationId)) return;
    const active = { sessionId: input.sessionId, cancelled: false };
    this.activeRuns.set(input.operationId, active);
    void this.execute(input, active)
      .catch(async (error) => {
        await this.markFailed(input, error).catch(() => undefined);
      })
      .finally(() => {
        this.activeRuns.delete(input.operationId);
      });
  }

  active(operationId: string): { sessionId: string | null } | null {
    const found = this.activeRuns.get(operationId);
    return found ? { sessionId: found.sessionId } : null;
  }

  markCancelled(operationId: string): void {
    const found = this.activeRuns.get(operationId);
    if (found) found.cancelled = true;
  }

  async markFailed(input: GuideRunInput, error: unknown): Promise<void> {
    const sessionId = typeof (error as { nativeSessionId?: unknown })?.nativeSessionId === "string"
      ? (error as { nativeSessionId: string }).nativeSessionId
      : this.activeRuns.get(input.operationId)?.sessionId ?? null;
    const providerFailure = providerErrorFor(error, input.model.providerID, sessionId);
    const classification = classifyNativeError(error);
    const message = this.redacted(providerFailure?.whatHappened ?? classification.message);
    const uncertain = classification.unknown || failureIsUncertain(message, error);
    await this.finish(input, {
      status: uncertain ? "ABANDONED" : "FAILED",
      result: uncertain
        ? `${message} The native run was not repeated. Reconcile the native session to recover its result.`
        : message,
      statusReason: uncertain ? "native-outcome-unconfirmed" : "run-failed",
      sessionId,
      messageId: null,
      providerError: providerFailure,
      transcript: uncertain
        ? `${message} The run was not repeated automatically.`
        : message,
    });
  }

  private async execute(input: GuideRunInput, active: { sessionId: string | null; cancelled: boolean }): Promise<void> {
    const stage = async (state: OperationPhase, detail?: string | null) => {
      await writeProgress(this.options.workflow, input.operationId, state, detail ?? null).catch(() => undefined);
    };
    await this.update(input, "start", (project) => {
      const next = structuredClone(project);
      const operation = next.operations.find((item) => item.id === input.operationId);
      if (operation && (operation.status === "QUEUED" || operation.status === "RUNNING")) {
        operation.status = "RUNNING";
        const phase = setProgress(operation.progress, "CONNECTING", PHASE_DETAIL.CONNECTING, new Date().toISOString());
        operation.progress = phase;
        operation.lastObservedAt = phase.updatedAt;
        operation.result = `Running in OpenCode with ${input.model.providerID}/${input.model.id}.`;
      }
      return refreshNextAction(next);
    });

    let settled = false;
    const observation = this.observe(input, active, () => settled);
    try {
      const spoken = await this.options.guide.speak({
        role: input.intent === "witness" ? "witness" : input.intent === "draft" ? "architect" : "oracle",
        conversationId: input.projectId,
        sessionId: input.sessionId,
        prompt: input.prompt,
        workspace: input.workspace,
        model: input.model,
        agent: input.agent,
        budget: input.budget,
        onSession: (sessionId) => {
          active.sessionId = sessionId;
          void this.update(input, "session", (project) => {
            const next = structuredClone(project);
            const operation = next.operations.find((item) => item.id === input.operationId);
            if (operation) {
              operation.nativeSessionId = sessionId;
              const phase = setProgress(operation.progress, "SESSION_CREATED", PHASE_DETAIL.SESSION_CREATED, new Date().toISOString());
              operation.progress = phase;
              operation.lastObservedAt = phase.updatedAt;
              operation.result = `Running in OpenCode session ${sessionId}.`;
            }
            rememberSession(next, input.intent === "witness" ? "witness" : input.intent === "draft" ? "architect" : "oracle", sessionId);
            return refreshNextAction(next);
          }).catch(() => undefined);
        },
        onProgress: (phase, detail) => {
          void stage(phase, detail ?? null);
        },
      });
      settled = true;
      await stage("VALIDATING_RESULT");
      const reply = validateReply(input.intent, spoken.text, (value) => this.redacted(value));
      if (active.cancelled) {
        await this.finish(input, {
          status: "CANCELLED",
          result: "Cancellation was recorded before the reply was applied. The saved section is unchanged.",
          statusReason: "user-cancelled",
          sessionId: spoken.sessionId,
          messageId: spoken.messageId,
          providerError: null,
          transcript: "Cancellation was recorded before the reply was applied.",
        });
        return;
      }
      if (!reply.ok) {
        await this.finish(input, {
          status: "FAILED",
          result: reply.resultText,
          statusReason: "malformed-response",
          sessionId: spoken.sessionId,
          messageId: spoken.messageId,
          providerError: null,
          transcript: reply.resultText,
        });
        return;
      }
      await stage("APPLYING_RESULT");
      const resultText = await this.applyReply(input, reply, spoken.sessionId);
      await this.finish(input, {
        status: "SUCCEEDED",
        result: resultText,
        statusReason: null,
        sessionId: spoken.sessionId,
        messageId: spoken.messageId,
        providerError: null,
        transcript: null,
      });
    } catch (error) {
      settled = true;
      void observation;
      await this.markFailed(input, error);
    }
  }

  /**
   * Safe polling while the native call is in flight. It reads only session
   * presence of produced assistant output, never the content; the phase
   * remains honest about what was actually observed.
   */
  private async observe(
    input: GuideRunInput,
    active: { sessionId: string | null; cancelled: boolean },
    finished: () => boolean,
  ): Promise<void> {
    const interval = this.options.pollIntervalMs ?? 700;
    let observedOutput = false;
    while (!finished() && !active.cancelled) {
      const sessionId = active.sessionId;
      if (sessionId && this.options.guide.lastAssistantText && !observedOutput) {
        const snapshot = await this.options.guide.lastAssistantText(sessionId);
        if (snapshot && snapshot.text.trim()) {
          observedOutput = true;
          await writeProgress(this.options.workflow, input.operationId, "RECEIVING_OUTPUT", PHASE_DETAIL.RECEIVING_OUTPUT)
            .catch(() => undefined);
        }
      }
      if (finished()) return;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  /** Applies a validated reply through the exact-once action record. */
  private async applyReply(
    input: GuideRunInput,
    reply: ValidatedReply,
    sessionId: string,
  ): Promise<string> {
    const context: ReplyApplyContext = {
      redact: (value) => this.redacted(value),
      sessionId,
      requestedChange: input.userText,
    };
    const result = await this.options.workflow.executeLatest(
      `run:${input.operationId}:apply`,
      { operationId: input.operationId },
      (project) => applyValidatedReply(project, input.operationId, reply, context),
    );
    if (result.duplicate) return "The validated reply was already applied.";
    const operation = result.project.operations.find((item) => item.id === input.operationId);
    return operation?.result ?? "Validated reply applied.";
  }

  private redacted(value: string): string {
    return this.options.redact(value);
  }

  private async update(input: GuideRunInput, label: string, mutation: (project: Project) => Project): Promise<void> {
    await this.options.workflow.executeLatest(`run:${input.operationId}:${label}`, { operationId: input.operationId, label }, mutation);
  }

  private async finish(
    input: GuideRunInput,
    outcome: {
      status: "SUCCEEDED" | "FAILED" | "CANCELLED" | "ABANDONED" | "WAITING_PERMISSION";
      result: string;
      statusReason: string | null;
      sessionId: string | null;
      messageId: string | null;
      providerError: Operation["providerError"];
      transcript: string | null;
    },
  ): Promise<void> {
    await this.options.workflow.executeLatest(`run:${input.operationId}:finish`, { operationId: input.operationId, status: outcome.status }, (project) => {
      const next = structuredClone(project);
      const operation = next.operations.find((item) => item.id === input.operationId);
      if (!operation) return refreshNextAction(next);
      if (operation.appliedAt) {
        // The reply was applied; a cancelled/failed late path must not overwrite it.
        if (outcome.status !== "SUCCEEDED") {
          operation.result = `${operation.result} A later terminal notice (${outcome.status.toLowerCase()}) arrived after the result was applied and changed nothing.`;
        }
        operation.progress = null;
        return refreshNextAction(next);
      }
      operation.status = outcome.status;
      operation.nativeSessionId = outcome.sessionId ?? operation.nativeSessionId;
      operation.nativeMessageId = outcome.messageId ?? operation.nativeMessageId;
      operation.finishedAt = outcome.status === "ABANDONED" ? operation.finishedAt : new Date().toISOString();
      operation.lastObservedAt = new Date().toISOString();
      operation.statusReason = outcome.statusReason;
      operation.providerError = outcome.providerError;
      operation.result = outcome.result;
      // Terminal operations carry the outcome in status/result. An abandoned
      // guide run keeps its recovery marker so the interface still offers
      // reconciliation of the native session.
      operation.progress = outcome.status === "ABANDONED"
        ? {
            phase: "AWAITING_RECONCILIATION",
            detail: "Reconcile the native session to recover its result; it is not repeated.",
            updatedAt: new Date().toISOString(),
          }
        : null;
      if (outcome.transcript) {
        rememberTranscript(
          next,
          input.intent === "witness" ? "witness" : input.intent === "draft" ? "architect" : "oracle",
          outcome.transcript.slice(0, 8_000),
        );
      }
      return refreshNextAction(next);
    });
  }
}

/** Applies a validated reply. Used for live completion and late reconciliation. */
export function applyValidatedReply(
  project: Project,
  operationId: string,
  reply: ValidatedReply,
  context: ReplyApplyContext,
): Project {
  const operation = project.operations.find((item) => item.id === operationId);
  if (!operation || operation.appliedAt) {
    // A recovered or repeated application must never double-write.
    return refreshNextAction(structuredClone(project));
  }
  const now = new Date().toISOString();
  let resultText = "Validated reply applied.";
  let next: Project;
  if (reply.intent === "clarify") {
    assertOracleReplyReady(project, operation, reply.reply);
    next = recordOracleProposal(structuredClone(project), {
      mode: reply.reply.mode,
      questions: reply.reply.questions.map((question) => ({
        ...question,
        prompt: context.redact(question.prompt),
        whyItMatters: context.redact(question.whyItMatters),
        suggestedChoices: question.suggestedChoices.map(context.redact),
      })),
      assumptions: reply.reply.assumptions.map((assumption) => ({
        ...assumption,
        statement: context.redact(assumption.statement),
        reason: context.redact(assumption.reason),
      })),
      knownConstraints: reply.reply.knownConstraints.map(context.redact),
      intake: Object.fromEntries(Object.entries(reply.reply.intake).map(([field, answer]) => [
        field,
        answer
          ? {
              ...answer,
              value: Array.isArray(answer.value)
                ? answer.value.map(context.redact)
                : context.redact(answer.value),
            }
          : null,
      ])) as typeof reply.reply.intake,
      proposal: reply.reply.proposal
        ? {
            ...reply.reply.proposal,
            title: context.redact(reply.reply.proposal.title),
            summary: context.redact(reply.reply.proposal.summary),
            intendedUser: context.redact(reply.reply.proposal.intendedUser),
            problem: context.redact(reply.reply.proposal.problem),
            desiredOutcome: context.redact(reply.reply.proposal.desiredOutcome),
            mustHaveFeatures: reply.reply.proposal.mustHaveFeatures.map(context.redact),
            optionalFeatures: reply.reply.proposal.optionalFeatures.map(context.redact),
            nonGoals: reply.reply.proposal.nonGoals.map(context.redact),
            successCriteria: reply.reply.proposal.successCriteria.map(context.redact),
            facts: reply.reply.proposal.facts.map(context.redact),
            userDecisions: reply.reply.proposal.userDecisions.map(context.redact),
            assumptions: reply.reply.proposal.assumptions.map(context.redact),
          }
        : null,
      unresolvedRisks: reply.reply.unresolvedRisks.map(context.redact),
      recommendedNextAction: context.redact(reply.reply.recommendedNextAction),
      sessionId: context.sessionId,
    });
    resultText = reply.reply.mode === "proposal"
      ? "Oracle proposal stored. It is not approved."
      : `Oracle saved the intake and asked ${reply.reply.questions.length} focused question(s).`;
  } else if (reply.intent === "draft") {
    if (!operation.sectionId) throw new Error("A recovered draft names its target section.");
    const content = context.redact(reply.reply.content);
    const summary = context.redact(reply.reply.summary || "Architect revision prepared for review.");
    const candidateProject = recordSectionCandidate(structuredClone(project), operation.sectionId, {
      content,
      summary,
      requestedChange: context.redact(context.requestedChange ?? ""),
      sourceOperationId: operationId,
    });
    rememberSession(candidateProject, "architect", context.sessionId);
    next = candidateProject;
    const candidate = next.sections
      .find((section) => section.id === operation.sectionId)
      ?.candidateRevisions.findLast((item) => item.status === "PENDING");
    resultText = candidate
      ? `Architect proposed revision v${candidate.version} for review. The current section was not changed.`
      : "Architect revision prepared for review. The current section was not changed.";
  } else {
    next = recordWitnessDrafts(structuredClone(project), [
      { title: "Findings", content: context.redact(reply.reply.findings) },
      { title: "Limitations", content: context.redact(reply.reply.limitations) },
      { title: "Draft notes", content: context.redact(reply.reply.draftNotes) },
    ], context.sessionId);
    resultText = "Witness drafts stored from a fresh session.";
  }
  const finalOperation = next.operations.find((item) => item.id === operationId);
  if (finalOperation && !finalOperation.appliedAt) {
    finalOperation.status = "SUCCEEDED";
    finalOperation.finishedAt ??= now;
    finalOperation.appliedAt = now;
    finalOperation.lastObservedAt = now;
    finalOperation.statusReason = null;
    finalOperation.providerError = null;
    finalOperation.progress = null;
    finalOperation.nativeMessageId = context.messageId ?? finalOperation.nativeMessageId;
    finalOperation.result = resultText;
  }
  return refreshNextAction(next);
}

function assertOracleReplyReady(
  project: Project,
  operation: Operation,
  reply: z.infer<typeof oracleReplySchema>,
): void {
  if (reply.mode !== "proposal") return;
  const essential = [
    ["intendedUser", reply.intake.intendedUser],
    ["problem", reply.intake.problem],
    ["desiredOutcome", reply.intake.desiredOutcome],
    ["mustHaveFeatures", reply.intake.mustHaveFeatures?.value.length ? reply.intake.mustHaveFeatures : null],
  ] as const;
  const missing: string[] = essential.filter(([, answer]) => !answer).map(([field]) => field);
  if (project.source.status !== "CONFIRMED") missing.unshift("projectSource");
  if (missing.length) {
    throw new Error(`The Oracle proposed before required intake was consolidated: ${missing.join(", ")}.`);
  }
  const assumedEssential = essential
    .filter(([, answer]) => answer?.source === "ASSUMPTION")
    .map(([field]) => field);
  if (!assumedEssential.length) return;
  if (!operation.oracleProceedWithAssumptions) {
    throw new Error(`The Oracle proposed too early; explicit assumption permission is required for: ${assumedEssential.join(", ")}.`);
  }
  const assumed = new Set(reply.assumptions.map((assumption) => assumption.field));
  const uncovered = assumedEssential.filter((field) => !assumed.has(field));
  if (uncovered.length) {
    throw new Error(`The Oracle did not state assumptions for missing intake fields: ${uncovered.join(", ")}.`);
  }
}

/**
 * Validates a reply for the expected output type. The same schemas and prose
 * fallbacks are used for live replies and late reconciliation, so a response
 * can never bypass validation.
 */
export function validateReply(
  intent: "clarify" | "draft" | "witness" | "question",
  text: string,
  redact: (value: string) => string,
): ValidatedReply | { ok: false; resultText: string } {
  if (intent === "draft") {
    try {
      return { ok: true, intent: "draft", reply: sectionReplySchema.parse(extractJsonObject(text)) };
    } catch {
      const prose = text.trim();
      if (prose.length < 80) {
        return { ok: false, resultText: `The Architect reply was malformed, so the section was left unchanged. Reply began: ${redact(prose.slice(0, 240))}` };
      }
      return {
        ok: true,
        intent: "draft",
        reply: {
          content: prose.slice(0, 24_000),
          summary: "The Architect returned prose without a structured summary. Review the proposed revision before accepting it.",
          recommendation: "The Architect returned prose. Review the draft before approval.",
          tradeoff: "Separate recommendation and tradeoff fields were not returned.",
        },
      };
    }
  }
  if (intent === "witness") {
    try {
      return { ok: true, intent: "witness", reply: witnessReplySchema.parse(extractJsonObject(text)) };
    } catch {
      const prose = text.trim();
      if (prose.length < 80) {
        return { ok: false, resultText: `The Witness reply was malformed, so no draft was stored. Reply began: ${redact(prose.slice(0, 240))}` };
      }
      return {
        ok: true,
        intent: "witness",
        reply: {
          findings: prose.slice(0, 8_000),
          limitations: "The Witness returned prose rather than separate fields.",
          draftNotes: "These notes are an in-app review. They are not a submitted article or video.",
        },
      };
    }
  }
  try {
    return { ok: true, intent: "clarify", reply: oracleReplySchema.parse(extractJsonObject(text)) };
  } catch {
    return { ok: false, resultText: "The Oracle reply was malformed, so no proposal was stored." };
  }
}
