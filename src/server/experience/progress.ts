import type { OperationPhase, OperationProgress, Project } from "../../shared/workflow.ts";
import { refreshNextAction } from "../workflow/model.ts";
import type { WorkflowService } from "../workflow/service.ts";

/**
 * Observable run phases in their natural order. A run may revisit only the
 * later WAITING_PERMISSION phase; everything else moves forward and phase
 * regressions are ignored so late observations cannot undo an earlier phase.
 */
export const PHASE_ORDER: OperationPhase[] = [
  "CONNECTING",
  "SESSION_CREATED",
  "WAITING_FOR_MODEL",
  "RECEIVING_OUTPUT",
  "VALIDATING_RESULT",
  "WAITING_PERMISSION",
  "APPLYING_RESULT",
  "RUNNING_CHECKS",
  "AWAITING_RECONCILIATION",
];

export function phaseRank(phase: OperationPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

export function setProgress(
  progress: OperationProgress | null,
  phase: OperationPhase,
  detail: string | null,
  now: string,
): OperationProgress {
  if (progress && phaseRank(phase) < phaseRank(progress.phase)) {
    return progress;
  }
  return { phase, detail, updatedAt: now };
}

const TERMINAL_STATUSES = new Set(["SUCCEEDED", "FAILED", "CANCELLED"]);

export interface ProgressWriterOptions {
  operationId: string;
}

/**
 * Persists one progress phase for one operation. The write is skipped when the
 * operation is missing, already terminal, or already at the same or a later
 * phase, so background observation can never record empty actions after a
 * terminal write or bump the revision pointlessly.
 */
export async function writeProgress(
  workflow: WorkflowService,
  operationId: string,
  phase: OperationPhase,
  detail: string | null,
): Promise<void> {
  const project = await workflow.get();
  const operation = project.operations.find((item) => item.id === operationId);
  if (!operation || TERMINAL_STATUSES.has(operation.status)) return;
  if (operation.progress) {
    if (operation.progress.phase === phase) return;
    if (operation.progress.phase !== "AWAITING_RECONCILIATION" && phaseRank(operation.progress.phase) > phaseRank(phase)) return;
  }
  await workflow.executeLatest(
    `run:${operationId}:phase:${phase}`,
    { operationId, phase },
    (latest) => markProgress(latest, operationId, phase, detail),
  );
}

/** Pure mutation used by writers and tests. Throws on a no-op so the action
 * record (and revision bump) of an empty background write is never persisted. */
export function markProgress(
  project: Project,
  operationId: string,
  phase: OperationPhase,
  detail: string | null,
): Project {
  const next = structuredClone(project);
  const operation = next.operations.find((item) => item.id === operationId);
  if (!operation) return refreshNextAction(next);
  if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(operation.status)) {
    throw new ProgressWriteRace("The operation already finished; progress is not recorded.");
  }
  const current = operation.progress;
  const samePhase = current?.phase === phase;
  const regression = current ? phaseRank(phase) < phaseRank(current.phase) : false;
  if (samePhase || regression) {
    throw new ProgressWriteRace("This progress phase is already recorded or superseded.");
  }
  operation.progress = setProgress(operation.progress, phase, detail, new Date().toISOString());
  operation.lastObservedAt = operation.progress.updatedAt;
  return refreshNextAction(next);
}

export class ProgressWriteRace extends Error {}

