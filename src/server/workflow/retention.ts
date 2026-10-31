import type { RetentionConfig } from "../config.ts";
import type { Project } from "./model.ts";

export interface RetentionResult {
  project: Project;
  removed: {
    actions: number;
    approvals: number;
    operations: number;
    evidence: number;
    transcript: number;
    witnessDrafts: number;
  };
}

/**
 * Bounds persisted collections. Actions are retained for the idempotency window;
 * an action older than the window may be replayed by the client with a new ID.
 */
export function applyRetention(project: Project, retention: RetentionConfig): RetentionResult {
  const next = structuredClone(project);
  const removed = { actions: 0, approvals: 0, operations: 0, evidence: 0, transcript: 0, witnessDrafts: 0 };

  if (next.actions.length > retention.actions) {
    removed.actions = next.actions.length - retention.actions;
    next.actions = next.actions.slice(-retention.actions);
  }
  if (next.approvals.length > retention.approvals) {
    removed.approvals = next.approvals.length - retention.approvals;
    next.approvals = next.approvals.slice(-retention.approvals);
  }
  if (next.operations.length > retention.operations) {
    removed.operations = next.operations.length - retention.operations;
    next.operations = next.operations.slice(-retention.operations);
  }
  if (next.evidence.length > retention.evidence) {
    removed.evidence = next.evidence.length - retention.evidence;
    next.evidence = next.evidence.slice(-retention.evidence);
  }
  if (next.transcript.length > retention.transcript) {
    removed.transcript = next.transcript.length - retention.transcript;
    next.transcript = next.transcript.slice(-retention.transcript);
  }
  if (next.witnessDrafts.length > retention.witnessDrafts) {
    removed.witnessDrafts = next.witnessDrafts.length - retention.witnessDrafts;
    next.witnessDrafts = next.witnessDrafts.slice(-retention.witnessDrafts);
  }
  return { project: next, removed };
}

