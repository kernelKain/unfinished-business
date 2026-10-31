import { randomUUID } from "node:crypto";
import type { OperationPhase, OperationProgress, ProviderErrorDetails } from "../../shared/workflow.ts";
import { payloadHash, refreshNextAction, type ModelRef, type Project } from "../workflow/model.ts";
import { WorkflowService } from "../workflow/service.ts";
import { rememberSession, rememberTranscript } from "../workflow/transitions.ts";
import { PHASE_DETAIL, type NativeFileDiff, type SpiritGuide } from "./guide.ts";
import { PHASE_ORDER, setProgress, writeProgress } from "./progress.ts";
import { runApprovedNodeCheck, type NodeCheckResult } from "./node-check.ts";
import { traceToolOperation } from "./telemetry.ts";
import { failureIsUncertain, providerErrorFor } from "./failures.ts";

export interface MakerRunInput {
  operationId: string;
  projectId: string;
  actionId: string;
  payload: object;
  sessionId: string | null;
  prompt: string;
  workspace: string;
  model: ModelRef;
  agent: string | null;
  budget: Project["modelPreferences"]["budget"];
}

interface ActiveRun {
  sessionId: string | null;
  cancelled: boolean;
}

type NodeCheck = NodeCheckResult;

function modelLabel(model: ModelRef | null): string {
  if (!model) return "the recorded model";
  return `${model.providerID}/${model.id}${model.variant ? `#${model.variant}` : ""}`;
}

export function diffSummary(files: NativeFileDiff[]): string {
  return files
    .map((file) => `${file.status} ${file.file} (+${file.additions}/-${file.deletions})`)
    .join("\n");
}

function phaseValue(progress: OperationProgress | null, phase: OperationPhase, detail: string | null): OperationProgress {
  return setProgress(progress, phase, detail, new Date().toISOString());
}

/**
 * Owns the in-process half of a Maker run. Persisted operation state remains the
 * source of truth across process restarts; an interrupted process leaves a
 * reconcilable ABANDONED record rather than silently replaying the native action.
 */
export class MakerRunCoordinator {
  private readonly activeRuns = new Map<string, ActiveRun>();

  constructor(
    private readonly options: {
      workflow: WorkflowService;
      guide: SpiritGuide;
      demoWorkspace: string;
      nodeCheckTimeoutMs?: number;
    },
  ) {}

  start(input: MakerRunInput): void {
    if (this.activeRuns.has(input.operationId)) return;
    const active: ActiveRun = { sessionId: input.sessionId, cancelled: false };
    this.activeRuns.set(input.operationId, active);
    void this.execute(input, active)
      .catch(async (error) => {
        await this.markFailed(input.operationId, error, input.model, input.agent).catch(() => undefined);
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

  async markFailed(operationId: string, error: unknown, model: ModelRef, agent: string | null): Promise<void> {
    const sessionId = typeof (error as { nativeSessionId?: unknown })?.nativeSessionId === "string"
      ? (error as { nativeSessionId: string }).nativeSessionId
      : null;
    const providerFailure = providerErrorFor(error, model.providerID, sessionId);
    const message = providerFailure?.whatHappened ?? (error instanceof Error ? error.message : "The Maker run could not start.");
    const uncertain = failureIsUncertain(message, error);
    await this.finish(operationId, {
      status: uncertain ? "ABANDONED" : "FAILED",
      result: message,
      model,
      agent,
      sessionId,
      diff: null,
      check: null,
      messageId: null,
      providerError: providerFailure,
      recovered: uncertain && sessionId ? "Reconcile the native session; a late result is applied exactly once." : undefined,
    });
  }

  private async execute(input: MakerRunInput, active: ActiveRun): Promise<void> {
    const startedAt = new Date().toISOString();
    const stage = async (state: OperationPhase, detail: string | null = null) => {
      await writeProgress(this.options.workflow, input.operationId, state, detail ?? PHASE_DETAIL[state]).catch(() => {
        // The terminal update retries against the latest revision; a failed
        // intermediate progress write never repeats native work.
      });
    };

    await this.update(input, "start", (project) => {
      const next = structuredClone(project);
      const operation = next.operations.find((item) => item.id === input.operationId);
      if (operation && operation.status === "QUEUED") {
        operation.status = "RUNNING";
        operation.startedAt ??= startedAt;
        operation.progress = phaseValue(operation.progress, "CONNECTING", PHASE_DETAIL.CONNECTING);
        operation.result = `Running in OpenCode with ${modelLabel(input.model)}.`;
      }
      return refreshNextAction(next);
    });

    let settled = false;
    const observation = this.observe(input, active, () => settled);
    try {
      const performed = await this.options.guide.perform({
        role: "maker",
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
              operation.progress = phaseValue(operation.progress, "SESSION_CREATED", PHASE_DETAIL.SESSION_CREATED);
              operation.result = `Running in OpenCode session ${sessionId}.`;
            }
            rememberSession(next, "maker", sessionId);
            return refreshNextAction(next);
          }).catch(() => {
            // The completion update retries against the latest revision.
          });
        },
      });
      active.sessionId = performed.sessionId;
      settled = true;

      if (active.cancelled) {
        await this.finish(input.operationId, {
          status: "CANCELLED",
          result: "Cancellation was recorded before the native run finished.",
          model: input.model,
          agent: input.agent,
          sessionId: performed.sessionId,
          diff: performed.diff,
          messageId: performed.messageId,
          check: null,
          providerError: null,
        });
        return;
      }

      if (performed.pendingPermission) {
        await this.finish(input.operationId, {
          status: "WAITING_PERMISSION",
          result: "A native permission request is pending. Resolve it in OpenCode, then reconcile. The run was not repeated.",
          model: input.model,
          agent: input.agent,
          sessionId: performed.sessionId,
          diff: performed.diff,
          messageId: performed.messageId,
          check: null,
          providerError: null,
        });
        return;
      }

      const nativeFailed = performed.outcome === "failed" || performed.outcome === "interrupted";
      const stillRunning = performed.timedOut || performed.outcome === "running" || performed.outcome === "unknown";
      if (stillRunning) {
        await this.finish(input.operationId, {
          status: "ABANDONED",
          result: "The native Maker run did not become idle before the deadline. It was not repeated; reconcile before another run.",
          model: input.model,
          agent: input.agent,
          sessionId: performed.sessionId,
          diff: performed.diff,
          messageId: performed.messageId,
          check: null,
          providerError: null,
          recovered: "Reconcile the native session; a late result is applied exactly once.",
        });
        return;
      }

      const edited = !nativeFailed && !performed.diff.includes("without a file diff");
      let check: NodeCheck | null = null;
      if (edited) {
        await stage("RUNNING_CHECKS");
        check = await traceToolOperation("maker", input.projectId, input.model, "node.test", () =>
          runApprovedNodeCheck(this.options.demoWorkspace, this.options.nodeCheckTimeoutMs ?? 30_000));
      }
      await this.finish(input.operationId, {
        status: edited ? "SUCCEEDED" : "FAILED",
        result: performed.diff,
        model: input.model,
        agent: input.agent,
        sessionId: performed.sessionId,
        diff: performed.diff,
        messageId: performed.messageId,
        check,
        providerError: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The native Maker run failed.";
      const errorSessionId = typeof (error as { nativeSessionId?: unknown })?.nativeSessionId === "string"
        ? (error as { nativeSessionId: string }).nativeSessionId
        : null;
      const providerFailure = providerErrorFor(error, input.model.providerID, errorSessionId ?? active.sessionId);
      const safeMessage = providerFailure?.whatHappened ?? message;
      const uncertain = failureIsUncertain(safeMessage, error);
      await this.finish(input.operationId, {
        status: active.cancelled ? "CANCELLED" : uncertain ? "ABANDONED" : "FAILED",
        result: active.cancelled
          ? "Cancellation was recorded before the native run finished."
          : uncertain
            ? `Disconnected or interrupted: ${safeMessage}. Reconcile the native session before another run.`
            : safeMessage,
        model: input.model,
        agent: input.agent,
        sessionId: errorSessionId ?? active.sessionId,
        diff: null,
        messageId: null,
        check: null,
        providerError: providerFailure,
        recovered: uncertain ? "Reconcile the native session; a late result is applied exactly once." : undefined,
      });
    } finally {
      settled = true;
      void observation;
    }
  }

  /**
   * Safe polling while the native turn is in flight: it reports that model
   * output has started arriving without exposing any raw stream content.
   */
  private async observe(
    input: MakerRunInput,
    active: ActiveRun,
    finished: () => boolean,
  ): Promise<void> {
    const interval = 700;
    let waitingForModel = false;
    let observedOutput = false;
    while (!finished() && !active.cancelled) {
      const sessionId = active.sessionId;
      if (sessionId && !waitingForModel) {
        waitingForModel = true;
        await writeProgress(this.options.workflow, input.operationId, "WAITING_FOR_MODEL", PHASE_DETAIL.WAITING_FOR_MODEL).catch(() => undefined);
      }
      if (sessionId && this.options.guide.lastAssistantText && !observedOutput) {
        const snapshot = await this.options.guide.lastAssistantText(sessionId);
        if (snapshot && snapshot.text.trim()) {
          observedOutput = true;
          await writeProgress(this.options.workflow, input.operationId, "RECEIVING_OUTPUT", PHASE_DETAIL.RECEIVING_OUTPUT).catch(() => undefined);
        }
      }
      if (finished()) return;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  private async finish(
    operationId: string,
    outcome: {
      status: "SUCCEEDED" | "FAILED" | "CANCELLED" | "ABANDONED" | "WAITING_PERMISSION";
      result: string;
      model: ModelRef;
      agent: string | null;
      sessionId: string | null;
      diff: string | null;
      messageId: string | null;
      check: NodeCheck | null;
      providerError: ProviderErrorDetails | null;
      /** Optional recovery pointer appended when the outcome is still reconcilable. */
      recovered?: string;
    },
  ): Promise<void> {
    await this.options.workflow.executeLatest(`run:${operationId}:finish`, { operationId, status: outcome.status }, (project) => {
      const next = structuredClone(project);
      const operation = next.operations.find((item) => item.id === operationId);
      if (!operation) return refreshNextAction(next);
      if (operation.status === "CANCELLED") {
        operation.result = outcome.diff
          ? `Cancellation was recorded. Native result after cancellation: ${outcome.diff}`
          : operation.result;
        operation.finishedAt ??= new Date().toISOString();
        return refreshNextAction(next);
      }
      if (operation.appliedAt) {
        // The result was already applied by reconciliation; never replay it.
        return refreshNextAction(next);
      }
      operation.status = outcome.status;
      operation.model = outcome.model;
      operation.agent = outcome.agent;
      operation.nativeSessionId = outcome.sessionId ?? operation.nativeSessionId;
      operation.nativeMessageId = outcome.messageId ?? operation.nativeMessageId;
      operation.finishedAt = outcome.status === "WAITING_PERMISSION" || outcome.status === "ABANDONED"
        ? null
        : new Date().toISOString();
      operation.statusReason = outcome.providerError?.category.toLowerCase()
        ?? (outcome.status === "ABANDONED" ? "native-outcome-unconfirmed" : null);
      operation.lastObservedAt = new Date().toISOString();
      operation.appliedAt = outcome.status === "SUCCEEDED" ? operation.lastObservedAt : null;
      operation.providerError = outcome.providerError;
      const checkText = outcome.check
        ? `Node check exit ${outcome.check.code ?? "unavailable"}. ${outcome.check.output}`
        : "No native diff, so the Node check did not run.";
      operation.result = outcome.check ? `${outcome.result}\n\n${checkText}` : outcome.result;
      if (outcome.recovered) operation.result = `${operation.result} ${outcome.recovered}`;
      // Terminal operations carry the outcome in status/result; the transient
      // progress marker is cleared. A pending permission keeps its phase so
      // the interface explains why the run is still blocked, and an abandoned
      // run keeps its recovery marker so the native session remains
      // reconcileable after startup recovery.
      operation.progress = outcome.status === "WAITING_PERMISSION"
        ? phaseValue(operation.progress, "WAITING_PERMISSION", PHASE_DETAIL.WAITING_PERMISSION)
        : outcome.status === "ABANDONED" && operation.progress?.phase === "AWAITING_RECONCILIATION"
          ? operation.progress
          : null;
      if (outcome.sessionId) rememberSession(next, "maker", outcome.sessionId);
      if (outcome.check) {
        next.evidence.push({
          id: randomUUID(),
          checkId: "CK-06",
          nativeResultReference: outcome.sessionId ?? "native-session-unavailable",
          testedFingerprint: payloadHash(outcome.check.output),
          result: outcome.check.code === 0 ? "PASS" : "FAIL",
          observedAt: new Date().toISOString(),
          limitation: outcome.check.code === 0 ? null : "The native edit did not leave a passing Node test.",
          model: outcome.model,
        });
        const capability = next.capabilities.find((item) => item.id === "node-check");
        if (capability) {
          capability.availability = "available";
          capability.observedOutcome = outcome.check.code === 0 ? "PASS" : "FAIL";
        }
        const inspection = next.capabilities.find((item) => item.id === "inspect-changes");
        if (inspection) {
          inspection.availability = "available";
          inspection.observedOutcome = outcome.diff;
        }
      }
      rememberTranscript(
        next,
        "maker",
        outcome.status === "SUCCEEDED"
          ? `${outcome.diff ?? "Maker completed."} (${modelLabel(outcome.model)})`
          : `${outcome.result} (${modelLabel(outcome.model)})`,
      );
      return refreshNextAction(next);
    });
  }

  private async update(input: MakerRunInput, label: string, mutation: (project: Project) => Project): Promise<void> {
    await this.options.workflow.executeLatest(`run:${input.operationId}:${label}`, { operationId: input.operationId, label }, mutation);
  }
}

export interface RecoveredMakerResult {
  status: "SUCCEEDED" | "FAILED" | "COMPLETED_UNAPPLIED" | "RUNNING" | "ABANDONED";
  result: string;
}

/**
 * Applies a recovered Maker outcome to the persisted operation.
 *
 * `observed` comes from the live native session; the diff is retrieved fresh
 * from OpenCode and validated here, and the recovered result is recorded with
 * an exact-once guard (appliedAt) so repeated reconcile or retry actions never
 * duplicate native edits. An idle session without a confirmed outcome is
 * never treated as success.
 */
export async function applyRecoveredMakerResult(
  deps: { workflow: WorkflowService; demoWorkspace: string; nodeCheckTimeoutMs?: number },
  input: {
    projectId: string;
    operationId: string;
    observed: "running" | "succeeded" | "failed" | "unknown";
    diff: NativeFileDiff[] | null;
    sessionId: string | null;
    messageId: string | null;
    model: ModelRef | null;
  },
): Promise<RecoveredMakerResult> {
  const apply = (mutation: Parameters<WorkflowService["executeLatest"]>[2]) =>
    deps.workflow.executeLatest(
      `run:${input.operationId}:reconcile:${randomUUID()}`,
      { operationId: input.operationId, observed: input.observed },
      mutation,
    );

  if (input.observed === "running") {
    await apply((project) => markRecovered(project, input.operationId, {
      status: "RUNNING",
      result: "Native session is still running. It was not started again; keep waiting or reconcile later.",
      sessionId: input.sessionId,
      messageId: input.messageId,
      diff: null,
      check: null,
      phase: "RECEIVING_OUTPUT",
      model: input.model,
    }));
    return { status: "RUNNING", result: "The native session is still running." };
  }

  if (input.observed === "unknown") {
    await apply((project) => markRecovered(project, input.operationId, {
      status: "ABANDONED",
      result: "Native outcome is still unknown. This action was not repeated; reconcile again later or mark it abandoned.",
      sessionId: input.sessionId,
      messageId: input.messageId,
      diff: null,
      check: null,
      phase: "AWAITING_RECONCILIATION",
      model: input.model,
      statusReason: "native-outcome-unconfirmed",
    }));
    return { status: "ABANDONED", result: "The native outcome is still unknown." };
  }

  if (input.observed === "failed") {
    await apply((project) => markRecovered(project, input.operationId, {
      status: "FAILED",
      result: "Reconciled from a failed or interrupted native session.",
      sessionId: input.sessionId,
      messageId: input.messageId,
      diff: null,
      check: null,
      statusReason: "native-failure-confirmed",
      model: input.model,
    }));
    return { status: "FAILED", result: "The native session reported a failed outcome." };
  }

  const diff = input.diff;
  if (diff === null) {
    await apply((project) => markRecovered(project, input.operationId, {
      status: "COMPLETED_UNAPPLIED",
      result: "The native session reported success, but the recovered diff could not be read yet. Reconcile again before any new run.",
      sessionId: input.sessionId,
      messageId: input.messageId,
      diff: null,
      check: null,
      phase: "AWAITING_RECONCILIATION",
      model: input.model,
      statusReason: "native-result-not-retrieved",
    }));
    return { status: "COMPLETED_UNAPPLIED", result: "The late diff could not be retrieved yet." };
  }

  if (diff.length === 0) {
    await apply((project) => markRecovered(project, input.operationId, {
      status: "FAILED",
      result: "Native session finished without a file diff.",
      sessionId: input.sessionId,
      messageId: input.messageId,
      diff: null,
      check: null,
      statusReason: "native-failure-confirmed",
      model: input.model,
    }));
    return { status: "FAILED", result: "The recovered session had no file diff." };
  }

  const check = await traceToolOperation("maker", input.projectId, input.model, "node.test", () =>
    runApprovedNodeCheck(deps.demoWorkspace, deps.nodeCheckTimeoutMs ?? 30_000));
  const summary = diffSummary(diff);
  await apply((project) => markRecovered(project, input.operationId, {
    status: "SUCCEEDED",
    result: `Reconciled from the native session outcome:\n${summary}`,
    sessionId: input.sessionId,
    messageId: input.messageId,
    diff: summary,
    check,
    model: input.model,
  }));
  return { status: "SUCCEEDED", result: `Late native result recovered:\n${summary}` };
}

export function markRecovered(
  project: Project,
  operationId: string,
  outcome: {
    status: "SUCCEEDED" | "FAILED" | "COMPLETED_UNAPPLIED" | "RUNNING" | "ABANDONED";
    result: string;
    sessionId: string | null;
    messageId: string | null;
    diff: string | null;
    check: NodeCheck | null;
    model: ModelRef | null;
    providerError?: ProviderErrorDetails | null;
    statusReason?: string | null;
    phase?: OperationPhase | null;
  },
): Project {
  const next = structuredClone(project);
  const operation = next.operations.find((item) => item.id === operationId);
  if (!operation) return refreshNextAction(next);
  if (operation.appliedAt) {
    // A recovered result is applied exactly once; replays keep the record.
    return refreshNextAction(next);
  }
  if (operation.status === "CANCELLED") {
    operation.result = outcome.diff
      ? `Cancellation was recorded. Native result after cancellation: ${outcome.diff}`
      : operation.result;
    operation.finishedAt ??= new Date().toISOString();
    operation.progress = null;
    return refreshNextAction(next);
  }
  if (outcome.status === "SUCCEEDED") {
    if (!outcome.check) throw new Error("A recovered Maker success records a validated check result.");
    operation.status = "SUCCEEDED";
    const now = new Date().toISOString();
    operation.finishedAt ??= now;
    operation.appliedAt = now;
    operation.lastObservedAt = now;
    operation.nativeSessionId = outcome.sessionId ?? operation.nativeSessionId;
    operation.nativeMessageId = outcome.messageId ?? operation.nativeMessageId;
    operation.statusReason = null;
    operation.providerError = null;
    if (outcome.model) operation.model = outcome.model;
    const checkText = `Node check exit ${outcome.check.code ?? "unavailable"}. ${outcome.check.output}`;
    operation.result = `${outcome.result}\n${checkText}`;
    operation.progress = null;
    if (outcome.sessionId) rememberSession(next, "maker", outcome.sessionId);
    next.evidence.push({
      id: randomUUID(),
      checkId: "CK-06",
      nativeResultReference: outcome.sessionId ?? "native-session-unavailable",
      testedFingerprint: payloadHash(outcome.check.output),
      result: outcome.check.code === 0 ? "PASS" : "FAIL",
      observedAt: now,
      limitation: outcome.check.code === 0 ? null : "The native edit did not leave a passing Node test.",
      model: operation.model,
    });
    const capability = next.capabilities.find((item) => item.id === "node-check");
    if (capability) {
      capability.availability = "available";
      capability.observedOutcome = outcome.check.code === 0 ? "PASS" : "FAIL";
    }
    const inspection = next.capabilities.find((item) => item.id === "inspect-changes");
    if (inspection) {
      inspection.availability = "available";
      inspection.observedOutcome = outcome.diff;
    }
    rememberTranscript(
      next,
      "maker",
      `Reconciled the late native result: ${outcome.diff ?? outcome.result} (${modelLabel(outcome.model)})`,
    );
  } else {
    operation.status = outcome.status;
    const now = new Date().toISOString();
    operation.lastObservedAt = now;
    operation.statusReason = outcome.statusReason ?? null;
    operation.result = outcome.result;
    operation.providerError = outcome.providerError ?? null;
    operation.finishedAt = outcome.status === "FAILED" ? (operation.finishedAt ?? now) : null;
    if (outcome.model) operation.model = outcome.model;
    const phase: OperationPhase = outcome.phase
      ?? (outcome.status === "FAILED" ? "VALIDATING_RESULT" : "AWAITING_RECONCILIATION");
    operation.progress = operation.status === "FAILED"
      ? null
      : phaseValue(operation.progress, phase, PHASE_DETAIL[phase]);
  }
  return refreshNextAction(next);
}

export const RUN_PHASE_ORDER = PHASE_ORDER;
