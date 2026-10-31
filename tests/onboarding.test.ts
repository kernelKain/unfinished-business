import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../src/server/app.ts";
import { ConnectionService, type NativeClientLike } from "../src/server/opencode/connection.ts";
import { AtomicProjectStore } from "../src/server/store/atomic-project-store.ts";
import { createProject } from "../src/server/workflow/model.ts";
import { WorkflowService } from "../src/server/workflow/service.ts";

function client(passwordRequired: string): NativeClientLike {
  return {
    server: {
      info: async () => {
        throw { cause: { status: 401 } };
      },
    },
    model: { list: async () => ({ data: [] }) },
    provider: { list: async () => ({ data: [] }) },
    integration: { list: async () => ({ data: [] }) },
    agent: { list: async () => ({ data: [] }) },
    permission: { request: { list: async () => ({ data: [] }) } },
    command: { list: async () => ({ data: [] }) },
    skill: { list: async () => ({ data: [] }) },
    mcp: { list: async () => ({ data: [] }) },
    config: { get: async () => [] },
  } as NativeClientLike;
}

function goodClient(): NativeClientLike {
  return {
    server: { info: async () => ({ version: "2.0.32" }) },
    model: {
      list: async () => ({
        data: [{
          id: "flint-40b-free",
          providerID: "opencode",
          name: "Flint 40B Free",
          variants: [{ id: "low" }, { id: "high" }],
          cost: [{ input: 0, output: 0, cache: { read: 0, write: 0 } }],
          status: "active" as const,
          enabled: true,
          limit: { context: 100_000, output: 8_000 },
          capabilities: { tools: true, input: ["text"], output: ["text"] },
        }],
      }),
    },
    provider: { list: async () => ({ data: [{ id: "opencode", name: "OpenCode", activation: "enabled" as const }] }) },
    integration: { list: async () => ({ data: [] }) },
    agent: { list: async () => ({ data: [{ id: "build", name: "Build", mode: "primary" as const, hidden: false, permissions: [] }] }) },
    permission: { request: { list: async () => ({ data: [] }) } },
    command: { list: async () => ({ data: [] }) },
    skill: { list: async () => ({ data: [] }) },
    mcp: { list: async () => ({ data: [] }) },
    config: { get: async () => [] },
  } as NativeClientLike;
}

async function fixture(options: { managed?: boolean } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "ub-onboarding-"));
  const store = new AtomicProjectStore(join(directory, "project.json"));
  await store.initialize(createProject(directory));
  const service = new WorkflowService(store);
  let password: string | undefined;
  const connection = new ConnectionService({
    dataDir: directory,
    deploymentMode: options.managed ? "hosted-private" : "local",
    clientFactory: (clientOptions) => {
      password = clientOptions.password;
      return clientOptions.password === "correct-password" ? goodClient() : client("correct-password");
    },
  });
  await connection.load();
  const app = createApp({ service, sessionToken: "test-token", connection });
  return { app, store, connection, directory, password: () => password };
}

const headers = { "content-type": "application/json", "x-ub-session-token": "test-token" };

test("a clean deployment reports not configured without inventing a connection", async () => {
  const { app } = await fixture();
  const response = await app.request("/api/connection");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.state, "not_configured");
  assert.equal(body.baseUrl, null);
  assert.equal(body.auth.hasPassword, false);
});

test("the wizard rejects remote HTTP and provider-key payloads", async () => {
  const { app } = await fixture();
  const remote = await app.request("/api/connection/configure", {
    method: "POST",
    headers,
    body: JSON.stringify({ baseUrl: "http://opencode.example:4096" }),
  });
  assert.equal(remote.status, 400);
  assert.match((await remote.json()).message, /requires HTTPS/);

  const secret = await app.request("/api/connection/configure", {
    method: "POST",
    headers,
    body: JSON.stringify({ baseUrl: "http://127.0.0.1:4096", providerKey: "sk-not-accepted" }),
  });
  assert.equal(secret.status, 400);
  assert.match((await secret.json()).message, /Provider API keys/);
});

test("authentication failure is precise and a correct password recovers", async () => {
  const { app } = await fixture();
  const failed = await app.request("/api/connection/configure", {
    method: "POST",
    headers,
    body: JSON.stringify({ baseUrl: "http://127.0.0.1:4096", password: "wrong-password" }),
  });
  assert.equal(failed.status, 200);
  const failedBody = await failed.json();
  assert.equal(failedBody.state, "authentication_required");
  assert.equal(failedBody.diagnostics[0].code, "PASSWORD_MISMATCH");
  assert.doesNotMatch(JSON.stringify(failedBody), /wrong-password/);

  const recovered = await app.request("/api/connection/check", {
    method: "POST",
    headers,
    body: JSON.stringify({ password: "correct-password" }),
  });
  assert.equal(recovered.status, 200);
  const body = await recovered.json();
  assert.equal(body.state, "connected");
  assert.equal(body.auth.hasPassword, true);
  assert.equal(body.discovery.models[0].key, "opencode/flint-40b-free");
  assert.doesNotMatch(JSON.stringify(body), /correct-password/);
});

test("model selection accepts only discovered models and reported variants", async () => {
  const { app, store } = await fixture();
  await app.request("/api/connection/configure", {
    method: "POST",
    headers,
    body: JSON.stringify({ baseUrl: "http://127.0.0.1:4096", password: "correct-password" }),
  });
  const variant = await app.request("/api/engine/selection", {
    method: "POST",
    headers,
    body: JSON.stringify({
      actionId: "bad-variant",
      expectedRevision: 0,
      providerID: "opencode",
      id: "flint-40b-free",
      variant: "max",
    }),
  });
  assert.equal(variant.status, 409);
  assert.match((await variant.json()).message, /not reported/);

  const missing = await app.request("/api/engine/selection", {
    method: "POST",
    headers,
    body: JSON.stringify({
      actionId: "missing",
      expectedRevision: 0,
      providerID: "opencode",
      id: "removed-model",
      variant: null,
    }),
  });
  assert.equal(missing.status, 409);

  const selected = await app.request("/api/engine/selection", {
    method: "POST",
    headers,
    body: JSON.stringify({
      actionId: "choose",
      expectedRevision: 0,
      providerID: "opencode",
      id: "flint-40b-free",
      variant: "high",
    }),
  });
  assert.equal(selected.status, 200);
  const body = await selected.json();
  assert.deepEqual(body.project.engine.model, {
    providerID: "opencode",
    id: "flint-40b-free",
    variant: "high",
  });
  assert.equal(body.project.engine.source, "user");
  assert.equal((await store.load()).state.engine.model?.id, "flint-40b-free");
});

test("managed hosted deployments do not expose browser connection editing", async () => {
  const { app } = await fixture({ managed: true });
  const response = await app.request("/api/connection/configure", {
    method: "POST",
    headers,
    body: JSON.stringify({ baseUrl: "https://opencode.example", password: "secret" }),
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "CONNECTION_MANAGED");
});

test("connection and session mutations require the local browser session token", async () => {
  const { app } = await fixture();
  const connection = await app.request("/api/connection/check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(connection.status, 403);
  const session = await app.request("/api/opencode/sessions/ses_missing/interrupt", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(session.status, 403);
});
