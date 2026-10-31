import assert from "node:assert/strict";
import test from "node:test";
import { markDisconnected, queueOperation, reconcileOperation } from "../src/server/opencode/operations.ts";

test("disconnect becomes unknown until native reconciliation", () => {
  const queued = queueOperation({ task: "bounded edit" });
  const unknown = markDisconnected(queued);
  assert.equal(unknown.status, "UNKNOWN");
  const reconciled = reconcileOperation(unknown, {
    sessionId: "ses_native",
    messageId: "msg_native",
    status: "succeeded",
    result: "verified",
  });
  assert.equal(reconciled.status, "SUCCEEDED");
  assert.equal(reconciled.nativeSessionId, "ses_native");
});
