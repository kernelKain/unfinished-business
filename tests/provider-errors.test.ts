import assert from "node:assert/strict";
import test from "node:test";
import { classifyProviderError, isProviderFailureCandidate, ProviderRequestError } from "../src/server/opencode/provider-errors.ts";
import { providerErrorSchema } from "../src/shared/workflow.ts";
import { providerFailureFixtures } from "./fixtures/provider-scenarios.ts";

function providerError(input: {
  message: string;
  status?: number | string;
  code?: string;
  cause?: unknown;
}) {
  return Object.assign(new Error(input.message), {
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.code !== undefined ? { code: input.code } : {}),
    ...(input.cause !== undefined ? { cause: input.cause } : {}),
  });
}

test("provider failures map to the required safe categories", () => {
  const cases = [
    {
      input: {
        message: "The provider requires training on request data and rejected this privacy policy.",
        status: 403,
        code: "PROVIDER_POLICY_REJECTED",
      },
      category: "PROVIDER_DATA_POLICY",
      action: "review-privacy",
      retryable: false,
    },
    {
      input: { message: "Invalid API key supplied by the provider.", status: 401 },
      category: "PROVIDER_AUTH",
      action: "reconnect-provider",
      retryable: false,
    },
    {
      input: { message: "OpenCode could not use this provider account.", status: "401", code: "ProviderAuthError" },
      category: "PROVIDER_AUTH",
      action: "reconnect-provider",
      retryable: false,
    },
    {
      input: { message: "Too many requests; rate limit reached.", status: 429 },
      category: "PROVIDER_RATE_LIMIT",
      action: "retry",
      retryable: true,
    },
    {
      input: { message: "Insufficient credit balance; billing quota exhausted.", status: 402 },
      category: "PROVIDER_QUOTA",
      action: "check-quota",
      retryable: false,
    },
    {
      input: { message: "The selected model is unavailable or not found.", status: 404 },
      category: "MODEL_UNAVAILABLE",
      action: "change-model",
      retryable: false,
    },
    {
      input: { message: "This request exceeds the maximum context length.", status: 400 },
      category: "MODEL_CONTEXT_LIMIT",
      action: "reduce-context",
      retryable: false,
    },
    {
      input: { message: "The provider is temporarily overloaded.", status: 503 },
      category: "PROVIDER_TEMPORARY",
      action: "retry",
      retryable: true,
    },
    {
      input: { message: "Something unexplained happened." },
      category: "UNKNOWN_PROVIDER_FAILURE",
      action: "retry",
      retryable: true,
    },
  ] as const;

  for (const item of cases) {
    const details = classifyProviderError(providerError(item.input), {
      provider: "acme",
      sessionReference: null,
      savedWorkChanged: "no",
    }).details;
    assert.equal(details.category, item.category);
    assert.equal(details.action, item.action);
    assert.equal(details.retryable, item.retryable);
    assert.equal(providerErrorSchema.parse(details).category, item.category);
  }
});

test("nested provider status and safe details survive redaction", () => {
  const error = providerError({
    message: [
      "Provider request failed.",
      "Authorization: Bearer abc.def.ghijklmnop",
      "apiKey=sk-ABCDEFGHIJKLMNOPQRSTUV",
      "password=hunter2",
      "local file /home/example/private/secret.txt",
    ].join(" "),
    cause: { status: 429 },
  });
  const details = classifyProviderError(error, {
    provider: "acme",
    sessionReference: "ses_provider_123",
    savedWorkChanged: "possibly",
  }).details;

  assert.equal(details.category, "PROVIDER_RATE_LIMIT");
  assert.equal(details.technical.statusCode, 429);
  assert.equal(details.technical.sessionReference, "ses_provider_123");
  assert.equal(details.savedWorkChanged, "possibly");
  assert.match(details.savedWorkMessage, /native OpenCode session may have changed workspace files/i);
  assert.match(details.technical.diagnosticReference, /^provider-[0-9a-f-]{36}$/);
  const serialized = JSON.stringify(details);
  for (const secret of ["abc.def.ghijklmnop", "sk-ABCDEFGHIJKLMNOPQRSTUV", "hunter2", "/home/example/private"]) {
    assert.doesNotMatch(serialized, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("unrelated local failures are not presented as provider failures", () => {
  assert.equal(isProviderFailureCandidate(providerError({ message: "ENOENT: no such file or directory", code: "ENOENT" })), false);
  assert.equal(isProviderFailureCandidate(providerError({ message: "The section draft could not be stored." })), false);
  assert.equal(isProviderFailureCandidate(providerError({ message: "Model call failed." })), true);
  assert.equal(isProviderFailureCandidate(providerError({ message: "quota exceeded", status: 402 })), true);
  assert.equal(isProviderFailureCandidate(providerError({ message: "unknown", code: "ProviderAuthError" })), true);
});

test("reclassifying an already structured provider error is stable", () => {
  const first = classifyProviderError(providerError({
    message: "The provider route conflicts with the workspace privacy policy.",
    status: 403,
  }), { provider: "acme", savedWorkChanged: "no" });
  const second = classifyProviderError(first, { provider: "other", savedWorkChanged: "possibly" });
  assert.equal(second, first);
  assert.equal(second instanceof ProviderRequestError, true);
});

test("the synthetic provider fixtures remain representative of the required categories", () => {
  const expected: Record<keyof typeof providerFailureFixtures, string> = {
    privacyTrainingPolicyRejection: "PROVIDER_DATA_POLICY",
    authenticationFailure: "PROVIDER_AUTH",
    rateLimit: "PROVIDER_RATE_LIMIT",
    genericFailure: "PROVIDER_TEMPORARY",
  };
  for (const [key, fixture] of Object.entries(providerFailureFixtures)) {
    const details = classifyProviderError(providerError({
      message: fixture.message,
      status: fixture.httpStatus,
      code: fixture.code,
    }), { provider: "fixture", savedWorkChanged: "no" }).details;
    assert.equal(details.category, expected[key as keyof typeof providerFailureFixtures]);
    assert.equal(details.retryable, fixture.retryable);
  }
});
