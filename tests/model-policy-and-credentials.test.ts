import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { normalizeModel, type RawModel } from "../src/server/opencode/discovery.ts";
import { parseOpenCodeAuth, seedOpenCodeAuth } from "../src/server/opencode/auth-seed.ts";
import { redactText } from "../src/server/security/redaction.ts";
import { DEFAULT_WORKSHOP_MODEL_KEY, preferredWorkshopModel } from "../src/shared/workflow.ts";

function rawModel(overrides: Partial<RawModel> & { cost?: RawModel["cost"] }): RawModel {
  return {
    id: "deepseek-v4.1-flash",
    providerID: "opencode-go",
    name: "DeepSeek V4.1 Flash",
    capabilities: { tools: true, input: ["text"], output: ["text"] },
    variants: [{ id: "high" }],
    status: "active",
    enabled: true,
    limit: { context: 262144, output: 65536 },
    ...overrides,
  } as unknown as RawModel;
}

function entry(key: string, pricing: "free" | "paid" | "unknown", tools = true) {
  return { key, availability: "available", pricing, tools };
}

test("the workshop default is preferred over any free model when OpenCode reports it", () => {
  const models = [entry("opencode/nemotron-free", "free"), entry(DEFAULT_WORKSHOP_MODEL_KEY, "paid")];
  assert.equal(preferredWorkshopModel(models)?.key, DEFAULT_WORKSHOP_MODEL_KEY);
});

test("without the workshop default, the first free tool-capable model is chosen, then any available model", () => {
  assert.equal(preferredWorkshopModel([entry("a/paid", "paid"), entry("b/free", "free")])?.key, "b/free");
  assert.equal(preferredWorkshopModel([entry("a/paid", "paid")])?.key, "a/paid");
  assert.equal(preferredWorkshopModel([{ key: "x", availability: "unavailable", pricing: "free", tools: true }]), undefined);
});

test("DeepSeek V4.1 Flash on OpenCode Go is classified as paid, so first use needs confirmation", () => {
  const model = normalizeModel(rawModel({
    cost: [{ input: 0.15, output: 0.6, cache: { read: 0.003, write: 0 } }],
  }));
  assert.equal(model.key, DEFAULT_WORKSHOP_MODEL_KEY);
  assert.equal(model.pricing, "paid");
  assert.notEqual(model.local, true);
});

test("a model priced at zero is free, and one with no reported cost stays unknown", () => {
  assert.equal(normalizeModel(rawModel({ cost: [{ input: 0, output: 0, cache: { read: 0, write: 0 } }] })).pricing, "free");
  assert.equal(normalizeModel(rawModel({ cost: [] })).pricing, "unknown");
});

test("the OpenCode credential seed accepts provider-keyed objects and rejects anything else without echoing it", () => {
  const secret = "sk-test-do-not-print-0123456789";
  assert.equal(parseOpenCodeAuth(JSON.stringify({ opencode: { type: "api", key: secret } })).opencode?.type, "api");
  for (const bad of [`[${JSON.stringify(secret)}]`, `{"opencode":"${secret}"}`, `{"opencode":{"key":"${secret}"}}`, "not json " + secret]) {
    assert.throws(() => parseOpenCodeAuth(bad), (error: Error) => {
      assert.equal(error.message.includes(secret), false);
      return true;
    });
  }
});

test("seeding writes OpenCode's credential file with owner-only permissions, and does nothing when unset", async () => {
  const dataHome = await mkdtemp(join(tmpdir(), "ub-auth-seed-"));
  try {
    assert.equal(await seedOpenCodeAuth(dataHome, undefined), false);
    assert.equal(await seedOpenCodeAuth(dataHome, "   "), false);
    const payload = JSON.stringify({ opencode: { type: "api", key: "seeded-value-123" } });
    assert.equal(await seedOpenCodeAuth(dataHome, payload), true);
    const path = join(dataHome, "opencode", "auth.json");
    assert.equal((await stat(path)).mode & 0o777, 0o600);
    assert.equal(JSON.parse(await readFile(path, "utf8")).opencode.key, "seeded-value-123");
  } finally {
    await rm(dataHome, { recursive: true, force: true });
  }
});

test("log redaction removes the key from JSON credential fields, including the seeded auth file shape", () => {
  const line = JSON.stringify({ opencode: { type: "api", key: "seeded-value-123" }, apiKey: "another-secret-value" });
  const redacted = redactText(line);
  assert.equal(redacted.includes("seeded-value-123"), false);
  assert.equal(redacted.includes("another-secret-value"), false);
  assert.match(redacted, /"type":"api"/);
});
