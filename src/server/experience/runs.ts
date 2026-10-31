import { randomUUID } from "node:crypto";
import { payloadHash, refreshNextAction, type ModelRef, type Project } from "../workflow/model.ts";
import { WorkflowService } from "../workflow/service.ts";
import { rememberSession, rememberTranscript } from "../workflow/transitions.ts";
import type { SpiritGuide } from "./guide.ts";
import { runApprovedNodeCheck } from "./node-check.ts";
import { traceToolOperation } from "./telemetry.ts";

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
}

interface ActiveRun {
  sessionId: string | null;
  cancelled: boolean;
}

function failureIsUncertain(message: string): boolean {
  return /timed out|timeout|ECONN|fetch|network|socket|unavailable|interrupted/i.test(message);
}

function modelLabel(model: ModelRef): string {
  return `${model.providerID}/${model.id}${model.variant ? `#${model.variant}` : ""}`;
}

/**
 * Owns the in-process half of a Maker run. Persisted operation state remains the
 * source of truth across process restarts; an interrupted process leaves a
 * reconciled UNKNOWN record rather than silently replaying the native action.
 */
export class MakerRunCoordinator {
  private readonly activeRuns = new Map<string, ActiveRun>();

  constructor(
    private readonly options: {
      workflow: WorkflowService;
      guide: SpiritGuide;
      demoWorkspace: string;
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
    const message = error instanceof Error ? error.message : "The Maker run could not start.";
    await this.finish(operationId, {
      status: failureIsUncertain(message) ? "UNKNOWN" : "FAILED",
      result: message,
      model,
      agent,
      sessionId: null,
      diff: null,
      check: null,
    });
  }

  private async execute(input: MakerRunInput, active: ActiveRun): Promise<void> {
    const startedAt = new Date().toISOString();
    await this.update(input, "start", (project) => {
      const next = structuredClone(project);
      const operation = next.operations.find((item) => item.id === input.operationId);
      if (operation && operation.status === "QUEUED") {
        operation.status = "RUNNING";
        operation.startedAt ??= startedAt;
        operation.result = `Running in OpenCode with ${modelLabel(input.model)}.`;
      }
      return refreshNextAction(next);
    });

    try {
      const performed = await this.options.guide.perform({
        role: "maker",
        conversationId: input.projectId,
        sessionId: input.sessionId,
        prompt: input.prompt,
        workspace: input.workspace,
        model: input.model,
        agent: input.agent,
        onSession: (sessionId) => {
          active.sessionId = sessionId;
          void this.update(input, "session", (project) => {
            const next = structuredClone(project);
            const operation = next.operations.find((item) => item.id === input.operationId);
            if (operation) {
              operation.nativeSessionId = sessionId;
              operation.result = `Running in OpenCode session ${sessionId}.`;
            }
            rememberSession(next, "maker", sessionId);
            return refreshNextAction(next);
          }).catch(() => {
            // The completion update retries against the latest revision. A
            // failed intermediate write is recoverable and never repeats work.
          });
        },
      });
      active.sessionId = performed.sessionId;
      const edited = !performed.diff.includes("without a file diff");
      const check = edited
        ? await traceToolOperation("maker", input.projectId, input.model, "node.test", () => runApprovedNodeCheck(this.options.demoWorkspace))
        : null;
      await this.finish(input.operationId, {
        status: edited ? "SUCCEEDED" : "FAILED",
        result: performed.diff,
        model: input.model,
        agent: input.agent,
        sessionId: performed.sessionId,
        diff: performed.diff,
        check,
        messageId: performed.messageId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The native Maker run failed.";
      await this.finish(input.operationId, {
        status: active.cancelled ? "CANCELLED" : failureIsUncertain(message) ? "UNKNOWN" : "FAILED",
        result: active.cancelled
          ? "Cancellation was recorded before the native run finished."
          : failureIsUncertain(message)
            ? `Disconnected or interrupted: ${message}. Reconcile the native session before another run.`
            : message,
        model: input.model,
        agent: input.agent,
        sessionId: active.sessionId,
        diff: null,
        check: null,
      });
    }
  }

  private async finish(
    operationId: string,
    outcome: {
      status: "SUCCEEDED" | "FAILED" | "CANCELLED" | "UNKNOWN";
      result: string;
      model: ModelRef;
      agent: string | null;
      sessionId: string | null;
      diff: string | null;
      check: Awaited<ReturnType<typeof runApprovedNodeCheck>> | null;
      messageId?: string | null;
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
      operation.status = outcome.status;
      operation.model = outcome.model;
      operation.agent = outcome.agent;
      operation.nativeSessionId = outcome.sessionId ?? operation.nativeSessionId;
      operation.nativeMessageId = outcome.messageId ?? operation.nativeMessageId;
      operation.finishedAt = new Date().toISOString();
      const checkText = outcome.check
        ? `Node check exit ${outcome.check.code ?? "unavailable"}. ${outcome.check.output}`
        : "No native diff, so the Node check did not run.";
      operation.result = `${outcome.result}\n\n${checkText}`;
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

  private async update(input: MakerRunInput, phase: string, mutation: (project: Project) => Project): Promise<void> {
    await this.options.workflow.executeLatest(`run:${input.operationId}:${phase}`, { operationId: input.operationId, phase }, mutation);
  }
}
