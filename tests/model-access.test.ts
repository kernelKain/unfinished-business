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

const headers = { "content-type": "application/json", "x-ub-session-token": "test-token" };

function client(): NativeClientLike {
  return {
    server: { info: async () => ({ version: "2.0.32" }) },
    model: {
      list: async () => ({
        data: [
          {
            id: "flint-free",
            providerID: "opencode",
            name: "Flint Free",
            variants: [{ id: "high" }],
            cost: [{ input: 0, output: 0, cache: { read: 0, write: 0 } }],
            status: "active" as const,
            enabled: true,
            limit: { context: 100_000, output: 8_000 },
            capabilities: { tools: true, input: ["text"], output: ["text"] },
          },
          {
            id: "acme-paid",
            providerID: "acme",
            name: "Acme Paid",
            cost: [{ input: 3, output: 15, cache: { read: 1, write: 2 } }],
            status: "active" as const,
            enabled: true,
            limit: { context: 32_000, output: 4_000 },
            capabilities: { tools: true, input: ["text"], output: ["text"] },
          },
          {
            id: "mystery-model",
            providerID: "acme",
            name: "Mystery Model",
            status: "active" as const,
            enabled: true,
            limit: { context: 64_000, output: 8_000 },
            capabilities: { tools: true, input: ["text"], output: ["text"] },
          },
          {
            id: "local-model",
            providerID: "ollama",
            name: "Local Model",
            cost: [{ input: 0, output: 0, cache: { read: 0, write: 0 } }],
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
          { id: "opencode", name: "OpenCode", activation: "enabled" as const },
          { id: "acme", name: "Acme", activation: "enabled" as const },
          { id: "ollama", name: "Ollama", activation: "enabled" as const, settings: { baseURL: "http://127.0.0.1:11434/v1" } },
        ],
      }),
    },
    integration: { list: async () => ({ data: [] }) },
    agent: {
      list: async () => ({
        data: [{ id: "build", name: "Build", mode: "primary" as const, hidden: false, permissions: [] }],
      }),
    },
    permission: { request: { list: async () => ({ data: [] }) } },
    command: { list: async () => ({ data: [] }) },
    skill: { list: async () => ({ data: [] }) },
    mcp: { list: async () => ({ data: [] }) },
    config: { get: async () => [] },
  } as NativeClientLike;
}

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "ub-model-access-"));
  const store = new AtomicProjectStore(join(directory, "project.json"));
  await store.initialize(createProject(directory));
  const service = new WorkflowService(store);
  const connection = new ConnectionService({
    dataDir: directory,
    deploymentMode: "local",
    clientFactory: () => client(),
  });
  await connection.load();
  const app = createApp({ service, sessionToken: "test-token", connection });
  const configured = await app.request("/api/connection/configure", {
    method: "POST",
    headers,
    body: JSON.stringify({ baseUrl: "http://127.0.0.1:4096" }),
  });
  assert.equal(configured.status, 200);
  return { app, store };
}

async function project(app: ReturnType<typeof createApp>) {
  const response = await app.request("/api/project", { headers });
  assert.equal(response.status, 200);
  return response.json();
}

function selectModel(
  app: ReturnType<typeof createApp>,
  input: {
    actionId: string;
    expectedRevision: number;
    providerID: string;
    id: string;
    variant?: string | null;
    acceptPaidOrUnknown?: boolean;
  },
) {
  return app.request("/api/engine/selection", {
    method: "POST",
    headers,
    body: JSON.stringify({ variant: null, ...input }),
  });
}

test("new projects default to all accessible models with no spending limit", async () => {
  const { app } = await fixture();
  const current = await project(app);
  assert.equal(current.schemaVersion, 4);
  assert.equal(current.modelPreferences.access.mode, "ALL_ACCESSIBLE");
  assert.equal(current.modelPreferences.access.paidOrUnknownAcceptedAt, null);
  assert.equal(current.modelPreferences.budget.maxCostUsd, null);

  const runtime = await app.request("/api/runtime", { headers });
  assert.equal(runtime.status, 200);
  assert.equal((await runtime.json()).budgets.maxSessionCostUsd, null);
});

test("free and local models can be selected without a cost confirmation", async () => {
  const { app, store } = await fixture();
  const current = await project(app);

  const free = await selectModel(app, {
    actionId: "select-free",
    expectedRevision: current.revision,
    providerID: "opencode",
    id: "flint-free",
  });
  assert.equal(free.status, 200);
  const freeProject = (await free.json()).project;
  assert.equal(freeProject.engine.model.id, "flint-free");
  assert.equal(freeProject.modelPreferences.access.paidOrUnknownAcceptedAt, null);

  const local = await selectModel(app, {
    actionId: "select-local",
    expectedRevision: freeProject.revision,
    providerID: "ollama",
    id: "local-model",
  });
  assert.equal(local.status, 200);
  assert.equal((await local.json()).project.engine.model.id, "local-model");
  assert.equal((await store.load()).state.engine.model?.id, "local-model");
});

test("paid and unknown-price models require an explicit first-use confirmation", async () => {
  const { app, store } = await fixture();
  const current = await project(app);

  for (const model of [
    { providerID: "acme", id: "acme-paid", actionId: "paid-unconfirmed" },
    { providerID: "acme", id: "mystery-model", actionId: "unknown-unconfirmed" },
  ]) {
    const blocked = await selectModel(app, {
      actionId: model.actionId,
      expectedRevision: current.revision,
      providerID: model.providerID,
      id: model.id,
    });
    assert.equal(blocked.status, 409);
    const body = await blocked.json();
    assert.equal(body.code, "MODEL_COST_CONFIRMATION_REQUIRED");
    assert.match(body.message, /charge|pricing|price/i);
    assert.equal((await store.load()).state.engine.model, null);
  }

  const accepted = await selectModel(app, {
    actionId: "paid-confirmed",
    expectedRevision: current.revision,
    providerID: "acme",
    id: "acme-paid",
    acceptPaidOrUnknown: true,
  });
  assert.equal(accepted.status, 200);
  const acceptedProject = (await accepted.json()).project;
  assert.equal(acceptedProject.engine.model.id, "acme-paid");
  assert.match(acceptedProject.modelPreferences.access.paidOrUnknownAcceptedAt, /^\d{4}-\d{2}-\d{2}T/);

  const laterUnknown = await selectModel(app, {
    actionId: "unknown-after-policy",
    expectedRevision: acceptedProject.revision,
    providerID: "acme",
    id: "mystery-model",
  });
  assert.equal(laterUnknown.status, 200);
});

test("free/local-only mode blocks paid and unknown-price models even with a confirmation flag", async () => {
  const { app } = await fixture();
  const current = await project(app);
  const preferences = await app.request("/api/model-preferences", {
    method: "POST",
    headers,
    body: JSON.stringify({
      actionId: "free-only-policy",
      expectedRevision: current.revision,
      accessMode: "FREE_OR_LOCAL_ONLY",
      dataPolicy: "NO_TRAINING_REQUIRED",
      maxCostUsd: 2.5,
    }),
  });
  assert.equal(preferences.status, 200);
  const updated = (await preferences.json()).project;
  assert.equal(updated.modelPreferences.access.mode, "FREE_OR_LOCAL_ONLY");
  assert.equal(updated.modelPreferences.access.dataPolicy, "NO_TRAINING_REQUIRED");
  assert.equal(updated.modelPreferences.budget.maxCostUsd, 2.5);

  for (const model of [
    { id: "acme-paid", actionId: "free-only-paid" },
    { id: "mystery-model", actionId: "free-only-unknown" },
  ]) {
    const blocked = await selectModel(app, {
      actionId: model.actionId,
      expectedRevision: updated.revision,
      providerID: "acme",
      id: model.id,
      acceptPaidOrUnknown: true,
    });
    assert.equal(blocked.status, 409);
    assert.match((await blocked.json()).message, /Free and local only/);
  }

  const free = await selectModel(app, {
    actionId: "free-only-free",
    expectedRevision: updated.revision,
    providerID: "opencode",
    id: "flint-free",
  });
  assert.equal(free.status, 200);
});

test("the spending limit can be disabled or made positive, and rejects zero", async () => {
  const { app } = await fixture();
  let current = await project(app);

  const disabled = await app.request("/api/model-preferences", {
    method: "POST",
    headers,
    body: JSON.stringify({
      actionId: "limit-disabled",
      expectedRevision: current.revision,
      accessMode: "ALL_ACCESSIBLE",
      dataPolicy: "PROVIDER_DEFAULT",
      maxCostUsd: null,
    }),
  });
  assert.equal(disabled.status, 200);
  current = (await disabled.json()).project;
  assert.equal(current.modelPreferences.budget.maxCostUsd, null);

  const invalid = await app.request("/api/model-preferences", {
    method: "POST",
    headers,
    body: JSON.stringify({
      actionId: "limit-zero",
      expectedRevision: current.revision,
      accessMode: "ALL_ACCESSIBLE",
      dataPolicy: "PROVIDER_DEFAULT",
      maxCostUsd: 0,
    }),
  });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).code, "INVALID_REQUEST");

  const positive = await app.request("/api/model-preferences", {
    method: "POST",
    headers,
    body: JSON.stringify({
      actionId: "limit-positive",
      expectedRevision: current.revision,
      accessMode: "ALL_ACCESSIBLE",
      dataPolicy: "PROVIDER_DEFAULT",
      maxCostUsd: 4.25,
    }),
  });
  assert.equal(positive.status, 200);
  assert.equal((await positive.json()).project.modelPreferences.budget.maxCostUsd, 4.25);
});
