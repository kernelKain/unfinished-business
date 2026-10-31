import assert from "node:assert/strict";
import test from "node:test";
import { engineStatusSchema, connectionStatusSchema, TESTED_OPENCODE_VERSION } from "../src/shared/contracts.ts";
import { normalizeDiscovery } from "../src/server/opencode/discovery.ts";

test("engine status accepts a discovered model without a fixed provider literal", () => {
  const result = engineStatusSchema.parse({
    available: true,
    state: "connected",
    serverVersion: "2.0.32",
    model: "opencode/flint-40b-free",
    modelAvailable: true,
    limitation: null,
  });
  assert.equal(result.modelAvailable, true);
});

test("connection status carries redacted authentication metadata", () => {
  const result = connectionStatusSchema.parse({
    state: "connected",
    baseUrl: "https://opencode.example",
    deploymentMode: "local",
    managed: false,
    auth: { mode: "basic", username: "opencode", hasPassword: true },
    serverVersion: TESTED_OPENCODE_VERSION,
    compatible: true,
    checkedAt: new Date().toISOString(),
    diagnostics: [],
    discovery: null,
  });
  assert.equal(result.auth.hasPassword, true);
  assert.equal("password" in result.auth, false);
});

test("model variants come only from the reported model catalog", () => {
  const discovery = normalizeDiscovery({
    version: "2.0.32",
    providers: [{ id: "opencode", name: "OpenCode", activation: "enabled" }],
    models: [{
      id: "flint-40b-free",
      providerID: "opencode",
      name: "Flint 40B Free",
      variants: [{ id: "low" }, { id: "high" }],
      cost: [{ input: 0, output: 0, cache: { read: 0, write: 0 } }],
      capabilities: { tools: true, input: ["text"], output: ["text"] },
      limit: { context: 100_000, output: 8_000 },
    }],
  });
  assert.deepEqual(discovery.models[0].variants, ["low", "high"]);
  assert.equal(discovery.models[0].pricing, "free");
  assert.equal(discovery.models[0].reasoning.source, "variants");
});
