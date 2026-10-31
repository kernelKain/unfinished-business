import { randomUUID } from "node:crypto";
import { operationSchema, payloadHash, type Operation } from "../workflow/model.ts";

export function queueOperation(payload: unknown): Operation {
  return operationSchema.parse({
    id: randomUUID(),
    payloadHash: payloadHash(payload),
    nativeSessionId: null,
    nativeMessageId: null,
    status: "QUEUED",
    result: null,
  });
}

export function markDisconnected(operation: Operation): Operation {
  if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(operation.status)) return operation;
  return operationSchema.parse({ ...operation, status: "UNKNOWN", result: "Disconnected; reconcile native state before retry." });
}

export function reconcileOperation(
  operation: Operation,
  native: { sessionId: string; messageId?: string; status: "running" | "waiting_permission" | "succeeded" | "failed" | "cancelled"; result?: string },
): Operation {
  const statuses = {
    running: "RUNNING",
    waiting_permission: "WAITING_PERMISSION",
    succeeded: "SUCCEEDED",
    failed: "FAILED",
    cancelled: "CANCELLED",
  } as const;
  return operationSchema.parse({
    ...operation,
    nativeSessionId: native.sessionId,
    nativeMessageId: native.messageId ?? operation.nativeMessageId,
    status: statuses[native.status],
    result: native.result ?? null,
  });
}
