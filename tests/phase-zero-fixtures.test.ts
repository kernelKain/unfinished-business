import assert from "node:assert/strict";
import test from "node:test";
import {
  lateMakerDiffFixture,
  pendingPermissionFixture,
  phaseZeroProviderFixtures,
  providerFailureFixtures,
  reconciliationFixture,
  slowResponseFixture,
  timeoutThenLateSuccessFixture,
} from "./fixtures/provider-scenarios.ts";

test("provider failure fixtures cover policy, authentication, rate, and generic failures", () => {
  assert.deepEqual(
    Object.values(providerFailureFixtures).map((fixture) => fixture.kind),
    ["privacy-policy", "authentication", "rate-limit", "provider-failure"],
  );
  assert.equal(providerFailureFixtures.privacyTrainingPolicyRejection.retryable, false);
  assert.equal(providerFailureFixtures.authenticationFailure.httpStatus, 401);
  assert.equal(providerFailureFixtures.rateLimit.httpStatus, 429);
  assert.equal(providerFailureFixtures.genericFailure.httpStatus, 502);
});

test("timing fixtures distinguish slow, timed-out, and late unapplied results", () => {
  assert.ok(slowResponseFixture.responseAfterMs < slowResponseFixture.timeoutMs);
  assert.ok(timeoutThenLateSuccessFixture.responseAfterMs > timeoutThenLateSuccessFixture.timeoutMs);
  assert.equal(timeoutThenLateSuccessFixture.statusAtTimeout, "ABANDONED");
  assert.equal(timeoutThenLateSuccessFixture.statusAfterReply, "COMPLETED_UNAPPLIED");
  assert.equal(lateMakerDiffFixture.status, "COMPLETED_UNAPPLIED");
  assert.match(lateMakerDiffFixture.diff, /^diff --git/m);
});

test("permission and reconciliation fixtures never imply native approval or replay", () => {
  assert.equal(pendingPermissionFixture.status, "WAITING_PERMISSION");
  assert.equal(reconciliationFixture.automaticReplayAllowed, false);
  assert.deepEqual(
    reconciliationFixture.observations.map((observation) => observation.expectedStatus),
    ["RUNNING", "COMPLETED_UNAPPLIED"],
  );
});

test("the complete fixture catalog is deterministic, serializable, and secret-free", () => {
  const serialized = JSON.stringify(phaseZeroProviderFixtures);
  assert.deepEqual(JSON.parse(serialized), phaseZeroProviderFixtures);
  assert.doesNotMatch(serialized, /(?:sk-|api[_-]?key|bearer\s+|password|secret)/i);

  const ids = [
    ...Object.values(providerFailureFixtures).map((fixture) => fixture.id),
    slowResponseFixture.id,
    timeoutThenLateSuccessFixture.id,
    lateMakerDiffFixture.id,
    pendingPermissionFixture.id,
    reconciliationFixture.id,
  ];
  assert.equal(new Set(ids).size, ids.length);
});
