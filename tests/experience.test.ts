import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { OpenCodeDiscovery, DiscoveredModel } from "../src/shared/opencode.ts";
import { createApp } from "../src/server/app.ts";
import type { SpiritGuide } from "../src/server/experience/guide.ts";
import { ExperienceService } from "../src/server/experience/service.ts";
import { AtomicProjectStore } from "../src/server/store/atomic-project-store.ts";
import { createProject, refreshNextAction } from "../src/server/workflow/model.ts";
import { WorkflowService } from "../src/server/workflow/service.ts";

const model: DiscoveredModel = {
  key: "opencode/flint-40b-free",
  providerID: "opencode",
  id: "flint-40b-free",
  name: "Flint 40B Free",
  family: "flint",
  availability: "available",
  status: "active",
  enabled: true,
  pricing: "free",
  local: false,
  limits: { context: 262_144, input: null, output: 65_536 },
  modalities: { input: ["text"], output: ["text"] },
  tools: true,
  reasoning: { supported: true, source: "variants" },
  variants: ["low", "high"],
  cost: [{ tierSize: null, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }],
};

const paidModel: DiscoveredModel = {
  ...model,
  key: "acme/paid-model",
  providerID: "acme",
  id: "paid-model",
  name: "Paid Model",
  local: false,
  pricing: "paid",
  cost: [{ tierSize: null, input: 3, output: 15, cacheRead: 1, cacheWrite: 2 }],
};

const discovery: OpenCodeDiscovery = {
  server: { version: "2.0.32", compatible: true, testedVersion: "2.0.32", warning: null },
  providers: [{ id: "opencode", name: "OpenCode", activation: "enabled", ready: "ready", modelCount: 1, detail: "1 model." }],
  models: [model],
  agents: [{ id: "build", name: "Build", mode: "primary", hidden: false, description: null, permissionCount: 1 }],
  roles: (["oracle", "architect", "maker", "witness"] as const).map((role) => ({
    role,
    agent: role === "maker" ? "build" : "plan",
    available: true,
    detail: "mapped",
  })),
  permissions: [],
  commands: [],
  skills: [],
  mcpServers: [],
  formatters: [],
  lspServers: [],
  capabilities: [],
  usage: { supported: true, quotaSupported: false, links: [], detail: "usage" },
  limitations: [],
};

function engine(selected: DiscoveredModel = model) {
  const selectedDiscovery = selected === model
    ? discovery
    : {
        ...discovery,
        providers: [{ id: selected.providerID, name: selected.providerID, activation: "enabled" as const, ready: "ready" as const, modelCount: 1, detail: "1 model." }],
        models: [selected],
      };
  return {
    async discovery() { return selectedDiscovery; },
    async resolveModel(selection: { providerID: string; id: string } | null) {
      return selection?.providerID === selected.providerID && selection.id === selected.id
        ? { model: selected, source: "selected" as const }
        : null;
    },
    async chooseDefaultModel() { return null; },
    validateSelection() { return selected; },
  };
}

function guide(speakText: string[], options?: { diff?: string; calls?: { speak: number }; inspect?: "running" | "succeeded" | "failed" | "unknown" }): SpiritGuide {
  const calls = options?.calls ?? { speak: 0 };
  return {
    async speak() {
      calls.speak += 1;
      return { sessionId: `ses_${calls.speak}`, messageId: null, text: speakText.shift() ?? "{}", cost: 0 };
    },
    async perform(input) {
      input.onSession?.("ses_maker");
      return {
        sessionId: "ses_maker",
        messageId: "msg_maker",
        text: "diff",
        diff: options?.diff ?? "added lost-and-found.test.mjs (+3/-0)",
        cost: 0,
      };
    },
    async inspect() {
      return options?.inspect ?? "succeeded";
    },
    async interrupt() {
      return true;
    },
  };
}

async function workshop(spirit: SpiritGuide, selected: DiscoveredModel = model) {
  const directory = await mkdtemp(join(tmpdir(), "ub-experience-"));
  const store = new AtomicProjectStore(join(directory, "project.json"));
  const initial = createProject(directory);
  initial.engine = {
    model: { providerID: selected.providerID, id: selected.id, variant: null },
    source: "user",
    updatedAt: null,
    legacyModel: null,
  };
  await store.initialize(initial);
  await writeFile(join(directory, "lost-and-found.test.mjs"), `import test from 'node:test';
import assert from 'node:assert/strict';
test('ledger', () => assert.equal(1, 1));
`);
  const service = new WorkflowService(store);
  const experience = new ExperienceService(service, store, spirit, {
    safeDirectory: directory,
    demoWorkspace: directory,
    promptRoot: process.cwd(),
    engine: engine(selected),
  });
  const app = createApp({ service, sessionToken: "test-token", experience });
  return { app, store, service };
}

const headers = { "content-type": "application/json", "x-ub-session-token": "test-token" };

async function waitFor<T>(work: () => Promise<T | null>, timeout = 5_000): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const result = await work();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for background state.");
}

test("a paid model cannot make its first request before the user confirms the policy", async () => {
  let calls = 0;
  const spirit = guide([]);
  spirit.speak = async () => {
    calls += 1;
    return { sessionId: "ses_paid", messageId: null, text: "{}", cost: 0 };
  };
  const { app, store } = await workshop(spirit, paidModel);
  const response = await app.request("/api/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "paid-unconfirmed", expectedRevision: 0, intent: "clarify", text: "Students lose umbrellas." }),
  });
  assert.equal(response.status, 409);
  const body = await response.json();
  assert.equal(body.code, "MODEL_COST_CONFIRMATION_REQUIRED");
  assert.match(body.message, /confirm/i);
  assert.equal(calls, 0);
  assert.equal((await store.load()).state.operations.length, 0);
});

test("a provider privacy rejection returns a structured, redacted repair path", async () => {
  const spirit = guide([]);
  spirit.speak = async () => {
    throw Object.assign(
      new Error("Provider policy rejected this route: it requires training on request data. apiKey=sk-live-secret-1234567890"),
      { status: 403, code: "PROVIDER_POLICY_REJECTED" },
    );
  };
  const { app, store } = await workshop(spirit);
  const response = await app.request("/api/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "provider-policy", expectedRevision: 0, intent: "clarify", text: "Students lose umbrellas." }),
  });
  assert.equal(response.status, 202);
  assert.equal(JSON.stringify(await response.json()).includes("sk-live-secret-1234567890"), false);
  const operation = await waitFor(async () => {
    const state = (await store.load()).state;
    const candidate = state.operations.at(-1);
    return candidate?.status === "FAILED" ? candidate : null;
  });
  assert.equal(operation.providerError?.category, "PROVIDER_DATA_POLICY");
  assert.equal(operation.providerError?.action, "review-privacy");
  assert.equal(operation.providerError?.savedWorkChanged, "no");
  assert.match(operation.providerError?.technical.diagnosticReference ?? "", /^provider-/);
  assert.match(operation.providerError?.repair ?? "", /privacy|provider/i);
  assert.doesNotMatch(JSON.stringify(operation), /sk-live-secret-1234567890/);
  assert.equal(operation.providerError?.technical.statusCode, 403);
});

test("oracle proposal cannot approve the product by itself", async () => {
  const { app, store } = await workshop(guide([
    JSON.stringify({ clarification: "A campus lost-and-found.", proposal: "Track found items.", openQuestions: ["Who may claim an item?"] }),
  ]));
  const response = await app.request("/api/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "idea", expectedRevision: 0, intent: "clarify", text: "Students lose umbrellas." }),
  });
  assert.equal(response.status, 202);
  const queued = await response.json();
  assert.equal(queued.accepted, true);
  const project = await waitFor(async () => {
    const state = (await store.load()).state;
    return state.product.status === "PROPOSED" ? state : null;
  });
  const body = { project };
  assert.equal(body.project.product.status, "PROPOSED");
  assert.equal(body.project.oracleIntake.status, "READY");
  assert.equal(body.project.oracleIntake.summary, "Track found items.");
  assert.deepEqual(body.project.oracleIntake.questions, [{ prompt: "Who may claim an item?", answer: null }]);
  assert.equal(body.project.stage, "ORACLE");
  assert.equal(body.project.sections[0].status, "NOT_STARTED");
  assert.equal(body.project.engine.model?.id, "flint-40b-free");
});

test("a malformed architect reply leaves the section unchanged", async () => {
  const { app, store } = await workshop(guide(["this is not a section"]));
  let project = (await store.load()).state;
  project = (await new WorkflowService(store).execute("product", { kind: "product" }, 0, (current) => {
    current.product = { status: "APPROVED", proposal: "Track found items.", openQuestions: [] };
    return refreshNextAction(current);
  })).project;
  const before = project.sections[0].hash;
  const response = await app.request("/api/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "draft", expectedRevision: project.revision, intent: "draft", text: "Draft the control section." }),
  });
  assert.equal(response.status, 202);
  await waitFor(async () => {
    const state = (await store.load()).state;
    return state.operations.at(-1)?.status === "FAILED" ? state : null;
  });
  const after = (await store.load()).state;
  assert.equal(after.operations.at(-1)?.statusReason, "malformed-response");
  assert.equal(after.sections[0].hash, before);
  assert.equal(after.sections[0].status, "NOT_STARTED");
});

test("a prose architect reply is stored as an unapproved draft", async () => {
  const prose = "Keep a ledger of pooled umbrellas, with a checkout time, a due time, and a return scan. ".repeat(3);
  const { app, store } = await workshop(guide([prose]));
  const project = (await new WorkflowService(store).execute("product", { kind: "product" }, 0, (current) => {
    current.product = { status: "APPROVED", proposal: "Track found items.", openQuestions: [] };
    return refreshNextAction(current);
  })).project;
  const response = await app.request("/api/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "prose", expectedRevision: project.revision, intent: "draft", text: "Draft the control section." }),
  });
  assert.equal(response.status, 202);
  const body = { project: await waitFor(async () => {
    const state = (await store.load()).state;
    return state.sections[0].status === "DRAFT" ? state : null;
  }) };
  assert.equal(body.project.sections[0].status, "DRAFT");
  assert.match(body.project.sections[0].content, /pooled umbrellas/);
  assert.notEqual(body.project.sections[0].status, "APPROVED");
});

test("the same action does not call the spirit twice", async () => {
  const calls = { speak: 0 };
  const { app } = await workshop(guide([
    JSON.stringify({ clarification: "Clear.", proposal: "A useful board.", openQuestions: [] }),
  ], { calls }));
  const body = { actionId: "once", expectedRevision: 0, intent: "clarify", text: "A short idea." };
  assert.equal((await app.request("/api/messages", { method: "POST", headers, body: JSON.stringify(body) })).status, 202);
  const repeat = await app.request("/api/messages", { method: "POST", headers, body: JSON.stringify(body) });
  assert.equal(repeat.status, 200);
  assert.equal((await repeat.json()).duplicate, true);
  await waitFor(async () => {
    const state = await (await app.request("/api/project", { headers })).json() as { product: { status: string } };
    return state.product.status === "PROPOSED" ? state : null;
  });
  assert.equal(calls.speak, 1);
});

test("maker and witness stay gated until their approvals exist", async () => {
  const { app } = await workshop(guide([]));
  const denied = await app.request("/api/runs", {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "run", expectedRevision: 0 }),
  });
  assert.equal(denied.status, 409);
  const witness = await app.request("/api/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "review", expectedRevision: 0, intent: "witness", text: "Review the evidence." }),
  });
  assert.equal(witness.status, 409);
});

test("approved sections compile, Maker runs asynchronously, and Witness reads a fresh result", async () => {
  const { app, store, service } = await workshop(guide([
    JSON.stringify({ findings: "The Node check passed.", limitations: "No live sponsor call.", draftNotes: "Describe the actual diff." }),
  ]));
  const workflow = service;
  let project = (await workflow.execute("product", { kind: "product" }, 0, (current) => {
    current.product = { status: "APPROVED", proposal: "Track found items.", openQuestions: [] };
    return refreshNextAction(current);
  })).project;

  for (const section of [...project.sections]) {
    const revised = await app.request(`/api/sections/${section.id}/revisions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        actionId: `revise-${section.id}`,
        expectedRevision: project.revision,
        content: `Approved ${section.id} for a campus lost-and-found.`,
      }),
    });
    assert.equal(revised.status, 200);
    project = (await revised.json()).project;
    const current = project.sections.find((item) => item.id === section.id);
    assert.ok(current);
    const approved = await app.request(`/api/sections/${section.id}/approve`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        actionId: `approve-${section.id}`,
        expectedRevision: project.revision,
        version: current.version,
        hash: current.hash,
      }),
    });
    const approvedBody = await approved.json();
    assert.equal(approved.status, 200, JSON.stringify(approvedBody));
    project = approvedBody.project;
  }

  const scope = await app.request("/api/approvals", {
    method: "POST",
    headers,
    body: JSON.stringify({
      actionId: "scope",
      expectedRevision: project.revision,
      kind: "maker-scope",
      statement: "Build the lost-and-found check in the demo workspace.",
    }),
  });
  assert.equal(scope.status, 200);
  project = (await scope.json()).project;

  const run = await app.request("/api/runs", {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "make", expectedRevision: project.revision }),
  });
  assert.equal(run.status, 202);
  const started = await run.json();
  assert.equal(started.accepted, true);
  assert.equal(started.project.operations.at(-1).status, "QUEUED");
  assert.equal(`${started.project.operations.at(-1).model.providerID}/${started.project.operations.at(-1).model.id}`, "opencode/flint-40b-free");

  const made = await waitFor(async () => {
    const current = (await store.load()).state;
    return current.operations.some((operation) => operation.kind === "maker" && operation.status === "SUCCEEDED") ? current : null;
  });
  assert.equal(made.stage, "WITNESS");
  const maker = made.operations.findLast((operation) => operation.kind === "maker");
  assert.equal(maker?.model?.providerID, "opencode");
  assert.equal(maker?.model?.id, "flint-40b-free");
  assert.equal(made.evidence.at(-1)?.model?.id, "flint-40b-free");
  assert.match(maker?.result ?? "", /Node check exit 0/);

  const review = await app.request("/api/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "witness", expectedRevision: made.revision, intent: "witness", text: "Review the maker diff." }),
  });
  assert.equal(review.status, 202);
  const witnessed = { project: await waitFor(async () => {
    const current = (await store.load()).state;
    return current.witnessDrafts.length === 3 ? current : null;
  }) };
  const exported = await (await app.request("/api/export", { headers })).json();
  assert.match(exported.plan, /Approved control/);
  assert.equal(exported.drafts[0].title, "Findings");
  assert.match(exported.limitation, /not a submitted article/);
  assert.equal(exported.engine.model.id, "flint-40b-free");
});
