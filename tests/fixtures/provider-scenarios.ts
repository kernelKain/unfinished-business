export type ProviderFailureKind =
  | "privacy-policy"
  | "authentication"
  | "rate-limit"
  | "provider-failure";

export interface ProviderFailureFixture {
  id: string;
  kind: ProviderFailureKind;
  httpStatus: number;
  code: string;
  retryable: boolean;
  message: string;
}

export const providerFailureFixtures = {
  privacyTrainingPolicyRejection: {
    id: "provider-privacy-training-policy-rejection",
    kind: "privacy-policy",
    httpStatus: 403,
    code: "PROVIDER_POLICY_REJECTED",
    retryable: false,
    message: "The selected provider does not satisfy the project's data-use preference.",
  },
  authenticationFailure: {
    id: "provider-authentication-failure",
    kind: "authentication",
    httpStatus: 401,
    code: "PROVIDER_AUTHENTICATION_FAILED",
    retryable: false,
    message: "The provider rejected the credentials held by OpenCode.",
  },
  rateLimit: {
    id: "provider-rate-limit",
    kind: "rate-limit",
    httpStatus: 429,
    code: "PROVIDER_RATE_LIMITED",
    retryable: true,
    message: "The provider is limiting requests; no automatic retry was attempted.",
  },
  genericFailure: {
    id: "provider-generic-failure",
    kind: "provider-failure",
    httpStatus: 502,
    code: "PROVIDER_FAILED",
    retryable: true,
    message: "The provider could not complete the synthetic fixture request.",
  },
} as const satisfies Record<string, ProviderFailureFixture>;

export const slowResponseFixture = {
  id: "provider-slow-response",
  responseAfterMs: 2_500,
  timeoutMs: 5_000,
  response: {
    sessionId: "fixture-session-slow",
    messageId: "fixture-message-slow",
    text: "Synthetic slow response.",
  },
} as const;

export const timeoutThenLateSuccessFixture = {
  id: "provider-timeout-then-late-success",
  timeoutMs: 1_000,
  responseAfterMs: 1_500,
  statusAtTimeout: "ABANDONED",
  statusAfterReply: "COMPLETED_UNAPPLIED",
  response: {
    sessionId: "fixture-session-late-success",
    messageId: "fixture-message-late-success",
    text: "Synthetic late successful response.",
  },
} as const;

export const lateMakerDiffFixture = {
  id: "maker-late-diff",
  operationId: "fixture-operation-late-diff",
  sessionId: "fixture-session-late-diff",
  status: "COMPLETED_UNAPPLIED",
  receivedAt: "2026-01-01T00:00:05.000Z",
  diff: [
    "diff --git a/fixture/ledger.ts b/fixture/ledger.ts",
    "+export const fixtureValue = 1;",
  ].join("\n"),
} as const;

export const pendingPermissionFixture = {
  id: "maker-pending-permission",
  operationId: "fixture-operation-permission",
  sessionId: "fixture-session-permission",
  permissionId: "fixture-permission-write",
  status: "WAITING_PERMISSION",
  tool: "write",
  paths: ["fixture/ledger.ts"],
} as const;

export const reconciliationFixture = {
  id: "maker-reconciliation",
  operationId: timeoutThenLateSuccessFixture.id,
  observations: [
    { sequence: 1, nativeOutcome: "running", expectedStatus: "RUNNING" },
    { sequence: 2, nativeOutcome: "succeeded", expectedStatus: "COMPLETED_UNAPPLIED" },
  ],
  automaticReplayAllowed: false,
} as const;

export const phaseZeroProviderFixtures = {
  failures: providerFailureFixtures,
  slowResponse: slowResponseFixture,
  timeoutThenLateSuccess: timeoutThenLateSuccessFixture,
  lateMakerDiff: lateMakerDiffFixture,
  pendingPermission: pendingPermissionFixture,
  reconciliation: reconciliationFixture,
} as const;
