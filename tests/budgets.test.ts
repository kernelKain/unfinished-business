import assert from "node:assert/strict";
import test from "node:test";
import { effectiveTimeout, sessionBudgetViolation } from "../src/server/experience/guide.ts";

const budgets = {
  maxSessionCostUsd: null,
  maxSessionTokens: 1_000,
  guideTimeoutMs: 90_000,
  makerTimeoutMs: 180_000,
};

test("unlimited spending does not fail a reported cost", () => {
  assert.equal(sessionBudgetViolation({ cost: 25 }, budgets, {
    maxCostUsd: null,
    maxTotalTokens: null,
    maxRunDurationMs: null,
  }), null);
});

test("a positive project spending limit is enforced at or above the reported cost", () => {
  const requested = { maxCostUsd: 1.5, maxTotalTokens: null, maxRunDurationMs: null };
  assert.equal(sessionBudgetViolation({ cost: 1.5 }, budgets, requested), null);
  assert.match(sessionBudgetViolation({ cost: 1.51 }, budgets, requested) ?? "", /1\.5100.*1\.5000/);
});

test("the stricter deployment or project cost limit wins", () => {
  const deployment = { ...budgets, maxSessionCostUsd: 2 };
  assert.match(sessionBudgetViolation({ cost: 3 }, deployment, {
    maxCostUsd: 5,
    maxTotalTokens: null,
    maxRunDurationMs: null,
  }) ?? "", /2\.0000/);
  assert.match(sessionBudgetViolation({ cost: 3 }, budgets, {
    maxCostUsd: 2,
    maxTotalTokens: null,
    maxRunDurationMs: null,
  }) ?? "", /2\.0000/);
});

test("token and duration limits apply the stricter configured value", () => {
  assert.match(sessionBudgetViolation({ cost: 0, tokens: { input: 900, output: 101, reasoning: 0 } }, budgets, {
    maxCostUsd: null,
    maxTotalTokens: null,
    maxRunDurationMs: null,
  }) ?? "", /1001 tokens.*1000/);
  assert.match(sessionBudgetViolation({ cost: 0, tokens: { input: 900, output: 0, reasoning: 0 } }, budgets, {
    maxCostUsd: null,
    maxTotalTokens: 500,
    maxRunDurationMs: null,
  }) ?? "", /900 tokens.*500/);
  assert.equal(effectiveTimeout("maker", budgets, { maxCostUsd: null, maxTotalTokens: null, maxRunDurationMs: 30_000 }), 30_000);
  assert.equal(effectiveTimeout("maker", budgets, { maxCostUsd: null, maxTotalTokens: null, maxRunDurationMs: 300_000 }), 180_000);
  assert.equal(effectiveTimeout("guide", budgets, { maxCostUsd: null, maxTotalTokens: null, maxRunDurationMs: null }), 90_000);
});
