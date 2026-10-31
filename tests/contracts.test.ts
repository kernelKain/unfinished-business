import assert from "node:assert/strict";
import test from "node:test";
import { nativeEngineStatusSchema } from "../src/shared/contracts.ts";

test("accepts a verified V2 free-model status", () => {
  const result = nativeEngineStatusSchema.parse({
    available: true,
    serverVersion: "2.0.32",
    model: "opencode/deepseek-v4.1-flash-free",
    modelAvailable: true,
    limitation: null,
  });
  assert.equal(result.modelAvailable, true);
});

test("rejects a paid or substituted model", () => {
  assert.throws(() => nativeEngineStatusSchema.parse({
    available: true,
    serverVersion: "2.0.32",
    model: "opencode/deepseek-v4.1-flash",
    modelAvailable: true,
    limitation: null,
  }));
});
