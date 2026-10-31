import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ConnectionService, type NativeClientLike } from "../src/server/opencode/connection.ts";
import { validateServerUrl, redactSecrets, checkVersionCompatibility } from "../src/server/opencode/client.ts";

function rawClient(overrides: Partial<Record<keyof NativeClientLike, unknown>> = {}, version = "2.0.32"): NativeClientLike {
  const base: NativeClientLike = {
    server: { info: async () => ({ version }) },
    model: {
      list: async () => ({
        data: [
          {
            id: "flint-40b-free",
            providerID: "opencode",
            name: "Flint 40B Free",
            family: "flint",
            variants: [{ id: "low" }, { id: "high" }],
            compatibility: { reasoningField: "reasoning_content" },
            cost: [{ input: 0, output: 0, cache: { read: 0, write: 0 } }],
            status: "active" as const,
            enabled: true,
            limit: { context: 262_144, output: 65_536 },
            capabilities: { tools: true, input: ["text"], output: ["text"] },
          },
          {
            id: "paid-model",
            providerID: "acme",
            name: "Paid Model",
            cost: [{ input: 3, output: 15, cache: { read: 1, write: 2 } }],
            status: "active" as const,
            enabled: true,
            limit: { context: 32_000, output: 4_000 },
            capabilities: { tools: true, input: ["text", "image"], output: ["text"] },
          },
          {
            id: "gemma4:e4b",
            providerID: "ollama",
            name: "gemma4:e4b",
            cost: [{ input: 0, output: 0, cache: { read: 0, write: 0 } }],
            status: "active" as const,
            enabled: true,
            limit: { context: 4_096, output: 512 },
            capabilities: { tools: false, input: ["text"], output: ["text"] },
          },
          {
            id: "mystery-model",
            providerID: "acme",
            name: "Mystery Model",
            status: "active" as const,
            enabled: true,
            limit: { context: 32_000, output: 4_000 },
            capabilities: { tools: true, input: ["text"], output: ["text"] },
          },
        ],
      }),
    },
    provider: {
      list: async () => ({
        data: [
          { id: "opencode", name: "OpenCode", activation: "enabled" as const, settings: { apiKey: "super-secret" } },
          { id: "acme", name: "Acme", activation: "enabled" as const, settings: { apiKey: "other-secret" } },
          { id: "ollama", name: "Ollama", activation: "enabled" as const, settings: { baseURL: "http://127.0.0.1:11434/v1", apiKey: "local-secret" } },
        ],
      }),
    },
    integration: {
      list: async () => ({
        data: [
          { id: "opencode", connections: [] },
          { id: "acme", connections: [{ type: "env", status: { status: "needs_auth" } }] },
        ],
      }),
    },
    agent: {
      list: async () => ({
        data: [
          { id: "build", name: "Build", mode: "primary" as const, hidden: false, permissions: [{ action: "*", resource: "*", effect: "allow" }] },
          { id: "plan", name: "Plan", mode: "primary" as const, hidden: false, permissions: [] },
          { id: "maker", name: "Maker", mode: "primary" as const, hidden: false, permissions: [] },
        ],
      }),
    },
    permission: { request: { list: async () => ({ data: [] }) } },
    command: { list: async () => ({ data: [{ name: "review", description: "Review changes" }] }) },
    skill: { list: async () => ({ data: [{ id: "browser", name: "Browser", description: "Use a browser" }] }) },
    mcp: { list: async () => ({ data: [{ name: "docs", status: { status: "connected" } }] }) },
    config: {
      get: async () => [
        { type: "document" as const, info: { formatter: { prettier: { disabled: false } }, lsp: { typescript: { disabled: false } } } },
      ],
    },
  };
  return { ...base, ...(overrides as Partial<NativeClientLike>) };
}

async function service(client: NativeClientLike, overrides: { managed?: boolean } = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), "ub-connection-"));
  const connection = new ConnectionService({
    dataDir,
    deploymentMode: overrides.managed ? "hosted-private" : "local",
    envBaseUrl: "http://127.0.0.1:4096",
    clientFactory: () => client,
    now: () => new Date("2026-10-31T10:00:00.000Z"),
  });
  await connection.load();
  return { connection, dataDir };
}

test("server URL rules allow loopback HTTP and require HTTPS remotely", () => {
  assert.equal(validateServerUrl("http://127.0.0.1:4096").loopback, true);
  assert.equal(validateServerUrl("http://localhost:4096").loopback, true);
  assert.equal(validateServerUrl("https://opencode.example").https, true);
  assert.throws(() => validateServerUrl("http://opencode.example"), /requires HTTPS/);
  assert.throws(() => validateServerUrl("http://user:pass@127.0.0.1:4096"), /credentials/);
  assert.throws(() => validateServerUrl("ftp://127.0.0.1"), /Only http/);
});

test("version compatibility records the tested surface and degrades other 2.x patches", () => {
  assert.equal(checkVersionCompatibility("2.0.32").compatible, true);
  assert.equal(checkVersionCompatibility("2.0.31").compatible, true);
  assert.match(checkVersionCompatibility("2.0.31").warning ?? "", /tested against 2.0.32/);
  assert.equal(checkVersionCompatibility("1.18.0").compatible, false);
  assert.equal(checkVersionCompatibility("nonsense").compatible, false);
});

test("authentication failure is precise, password-free, and recoverable", async () => {
  const { connection, dataDir } = await service(rawClient({
    server: { info: async () => { throw { cause: { status: 401 } }; } },
  }));
  const failed = await connection.check({ baseUrl: "http://127.0.0.1:4096", password: "wrong-password" });
  assert.equal(failed.state, "authentication_required");
  assert.equal(failed.auth.hasPassword, true);
  assert.equal(failed.diagnostics[0].code, "PASSWORD_MISMATCH");
  assert.doesNotMatch(JSON.stringify(failed), /wrong-password/);

  const recovered = await service(rawClient());
  assert.equal((await recovered.connection.check({ baseUrl: "http://127.0.0.1:4096" })).state, "degraded");
  const file = await readFile(join(dataDir, "connection.json"), "utf8").catch(() => "");
  assert.doesNotMatch(file, /wrong-password/);
});

test("incompatible server versions stop before discovery", async () => {
  const { connection } = await service(rawClient({}, "1.18.26"));
  const status = await connection.check({ baseUrl: "http://127.0.0.1:4096" });
  assert.equal(status.state, "incompatible_version");
  assert.equal(status.compatible, false);
  assert.equal(status.discovery, null);
  assert.match(status.diagnostics[0].repair, /2\.x/);
});

test("discovery normalizes providers, models, variants, modalities, and usage without leaking secrets", async () => {
  const { connection } = await service(rawClient());
  const status = await connection.check({ baseUrl: "http://127.0.0.1:4096" });
  assert.equal(status.state, "degraded");
  assert.ok(status.discovery);
  const flint = status.discovery.models.find((model) => model.id === "flint-40b-free");
  assert.equal(flint?.pricing, "free");
  assert.deepEqual(flint?.variants, ["low", "high"]);
  assert.equal(flint?.tools, true);
  assert.equal(flint?.reasoning.supported, true);
  assert.deepEqual(flint?.modalities.input, ["text"]);
  assert.equal(flint?.limits.context, 262_144);

  const paid = status.discovery.models.find((model) => model.id === "paid-model");
  assert.equal(paid?.pricing, "paid");
  assert.deepEqual(paid?.modalities.input, ["text", "image"]);

  const local = status.discovery.models.find((model) => model.id === "gemma4:e4b");
  assert.equal(local?.local, true);
  assert.equal(status.discovery.providers.find((provider) => provider.id === "acme")?.ready, "needs_auth");
  assert.equal(status.discovery.roles.find((role) => role.role === "maker")?.agent, "maker");
  assert.deepEqual(status.discovery.commands, [{ name: "review", description: "Review changes" }]);
  assert.deepEqual(status.discovery.mcpServers, [{ name: "docs", status: "connected", error: null }]);
  assert.equal(status.discovery.formatters[0].name, "prettier");
  assert.equal(status.discovery.lspServers[0].name, "typescript");
  assert.equal(status.discovery.capabilities.find((capability) => capability.id === "tools")?.supported, false);
  assert.match(JSON.stringify(status), /Provider credentials/);
  assert.doesNotMatch(JSON.stringify(status), /super-secret|other-secret|local-secret/);
});

test("an unavailable model and an unreported variant are rejected precisely", async () => {
  const { connection } = await service(rawClient());
  const status = await connection.check({ baseUrl: "http://127.0.0.1:4096" });
  assert.ok(status.discovery);
  assert.throws(() => connection.validateSelection(status.discovery!, {
    providerID: "opencode",
    id: "flint-40b-free",
    variant: "max",
  }), /not reported/);
  assert.throws(() => connection.validateSelection(status.discovery!, {
    providerID: "opencode",
    id: "missing-model",
    variant: null,
  }), /not an available model/);
});

test("selected local model limits produce actionable diagnostics", async () => {
  const { connection } = await service(rawClient());
  const status = await connection.check({
    baseUrl: "http://127.0.0.1:4096",
    selected: { providerID: "ollama", id: "gemma4:e4b", variant: null },
  });
  assert.equal(status.state, "degraded");
  assert.ok(status.diagnostics.some((diagnostic) => diagnostic.code === "LOCAL_MODEL_LIMITS"));
});

test("access policy allows every reported model or intentionally restricts to free/local", async () => {
  const { connection } = await service(rawClient());
  const all = await connection.check({
    baseUrl: "http://127.0.0.1:4096",
    selected: { providerID: "acme", id: "paid-model", variant: null },
    accessMode: "ALL_ACCESSIBLE",
  });
  assert.ok(all.discovery);
  assert.equal(all.state, "degraded");
  const paid = connection.validateSelection(all.discovery!, {
    providerID: "acme",
    id: "paid-model",
    variant: null,
  }, "ALL_ACCESSIBLE");
  assert.equal(paid.pricing, "paid");
  const unknown = connection.validateSelection(all.discovery!, {
    providerID: "acme",
    id: "mystery-model",
    variant: null,
  }, "ALL_ACCESSIBLE");
  assert.equal(unknown.pricing, "unknown");

  const freeOnly = await connection.check({
    baseUrl: "http://127.0.0.1:4096",
    selected: { providerID: "acme", id: "paid-model", variant: null },
    accessMode: "FREE_OR_LOCAL_ONLY",
  });
  assert.ok(freeOnly.diagnostics.some((diagnostic) => diagnostic.code === "MODEL_ACCESS_POLICY_BLOCKED"));
  assert.throws(() => connection.validateSelection(freeOnly.discovery!, {
    providerID: "acme",
    id: "paid-model",
    variant: null,
  }, "FREE_OR_LOCAL_ONLY"), /Free and local only/);
  assert.equal(connection.validateSelection(freeOnly.discovery!, {
    providerID: "ollama",
    id: "gemma4:e4b",
    variant: null,
  }, "FREE_OR_LOCAL_ONLY").local, true);
});

test("connection recovers after the server becomes reachable", async () => {
  let reachable = false;
  const client = rawClient();
  client.server.info = async () => {
    if (!reachable) throw { cause: { code: "ECONNREFUSED" } };
    return { version: "2.0.32" };
  };
  const { connection } = await service(client);
  const unavailable = await connection.check({ baseUrl: "http://127.0.0.1:4096" });
  assert.equal(unavailable.state, "unavailable");
  assert.match(unavailable.diagnostics[0].repair, /npm run diagnose:platform/);
  reachable = true;
  assert.equal((await connection.check({ baseUrl: "http://127.0.0.1:4096" })).state, "degraded");
});

test("legacy fixed model is preserved only when discovery still reports it", async () => {
  const { connection } = await service(rawClient());
  const preserved = await connection.chooseDefaultModel("opencode/flint-40b-free");
  assert.equal(preserved?.model.key, "opencode/flint-40b-free");
  assert.equal(preserved?.source, "legacy");
  const replaced = await connection.chooseDefaultModel("opencode/deepseek-v4.1-flash-free");
  assert.equal(replaced, null);
});

test("managed deployments refuse browser-supplied connection changes", async () => {
  const { connection } = await service(rawClient(), { managed: true });
  await assert.rejects(connection.configure({ baseUrl: "https://opencode.example", password: "secret" }), /manages the OpenCode connection/);
  assert.equal(connection.managed, true);
});

test("redaction removes credentials from diagnostic-shaped strings", () => {
  assert.equal(redactSecrets("password=hunter2"), "password=[redacted]");
  assert.equal(redactSecrets("Authorization: Basic abcdefghijkl"), "Authorization: [redacted]");
  assert.doesNotMatch(redactSecrets("OPENCODE_API_KEY=abc123"), /abc123/);
});
