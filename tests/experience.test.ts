import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../src/server/app.ts";
import type { SpiritGuide } from "../src/server/experience/guide.ts";
import { ExperienceService } from "../src/server/experience/service.ts";
import { AtomicProjectStore } from "../src/server/store/atomic-project-store.ts";
import { createProject } from "../src/server/workflow/model.ts";
import { WorkflowService } from "../src/server/workflow/service.ts";
import { refreshNextAction } from "../src/server/workflow/model.ts";

const engine = async () => ({
  available: true,
  serverVersion: "2.0.32",
  model: "opencode/deepseek-v4.1-flash-free" as const,
  modelAvailable: true,
  limitation: null,
});

function guide(speakText: string[], options?: { diff?: string; calls?: { speak: number } }): SpiritGuide {
  const calls = options?.calls ?? { speak: 0 };
  return {
    async speak() {
      calls.speak += 1;
      return { sessionId: `ses_${calls.speak}`, messageId: null, text: speakText.shift() ?? "{}", cost: 0 };
    },
    async perform() {
      return {
        sessionId: "ses_maker",
        messageId: "msg_maker",
        text: "diff",
        diff: options?.diff ?? "added lost-and-found.test.mjs (+3/-0)",
        cost: 0,
      };
    },
    async inspect() {
      return "unknown";
    },
  };
}

async function workshop(spirit: SpiritGuide) {
  const directory = await mkdtemp(join(tmpdir(), "ub-experience-"));
  const store = new AtomicProjectStore(join(directory, "project.json"));
  await store.initialize(createProject(directory));
  const service = new WorkflowService(store);
  const experience = new ExperienceService(service, store, spirit, {
    safeDirectory: directory,
    demoWorkspace: directory,
    promptRoot: process.cwd(),
  });
  const app = createApp(engine, { service, sessionToken: "test-token", experience });
  return { app, store };
}

const headers = { "content-type": "application/json", "x-ub-session-token": "test-token" };

test("oracle proposal cannot approve the product by itself", async () => {
  const { app } = await workshop(guide([
    JSON.stringify({ clarification: "A campus lost-and-found.", proposal: "Track found items.", openQuestions: ["Who may claim an item?"] }),
  ]));
  const response = await app.request("/api/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "idea", expectedRevision: 0, intent: "clarify", text: "Students lose umbrellas." }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.project.product.status, "PROPOSED");
  assert.equal(body.project.stage, "ORACLE");
  assert.equal(body.project.sections[0].status, "NOT_STARTED");
});

test("a malformed architect reply leaves the section unchanged", async () => {
  const { app, store } = await workshop(guide(["this is not a section"]));
  let project = (await store.load()).state;
  project = (await new WorkflowService(store).execute("product", { kind: "product" }, 0, (current) => {
    current.product = { status: "APPROVED", proposal: "Track found items.", openQuestions: [] };
    return current;
  })).project;
  const before = project.sections[0].hash;
  const response = await app.request("/api/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "draft", expectedRevision: project.revision, intent: "draft", text: "Draft the control section." }),
  });
  assert.equal(response.status, 400);
  const after = (await store.load()).state;
  assert.equal(after.sections[0].hash, before);
  assert.equal(after.sections[0].status, "NOT_STARTED");
});

test("a prose architect reply is stored as an unapproved draft", async () => {
  const prose = "Keep a ledger of pooled umbrellas, with a checkout time, a due time, and a return scan. ".repeat(3);
  const { app, store } = await workshop(guide([prose]));
  const project = (await new WorkflowService(store).execute("product", { kind: "product" }, 0, (current) => {
    current.product = { status: "APPROVED", proposal: "Track found items.", openQuestions: [] };
    return current;
  })).project;
  const response = await app.request("/api/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "prose", expectedRevision: project.revision, intent: "draft", text: "Draft the control section." }),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.project.sections[0].status, "DRAFT");
  assert.match(body.project.sections[0].content, /pooled umbrellas/);
  assert.equal(body.project.sections[0].status === "APPROVED", false);
});

test("the same action does not call the spirit twice", async () => {
  const calls = { speak: 0 };
  const { app } = await workshop(guide([
    JSON.stringify({ clarification: "Clear.", proposal: "A useful board.", openQuestions: [] }),
  ], { calls }));
  const body = { actionId: "once", expectedRevision: 0, intent: "clarify", text: "A short idea." };
  assert.equal((await app.request("/api/messages", { method: "POST", headers, body: JSON.stringify(body) })).status, 200);
  const repeat = await app.request("/api/messages", { method: "POST", headers, body: JSON.stringify(body) });
  assert.equal(repeat.status, 200);
  assert.equal((await repeat.json()).duplicate, true);
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

test("approved sections compile and a fresh witness draft is exported", async () => {
  const { app, store } = await workshop(guide([
    JSON.stringify({ findings: "The Node check failed.", limitations: "No live sponsor call.", draftNotes: "Describe the actual diff." }),
  ]));
  const workflow = new WorkflowService(store);
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
    const current = project.sections.find((item: { id: string }) => item.id === section.id);
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
  assert.equal(run.status, 200);
  const made = await run.json();
  assert.equal(made.project.stage, "WITNESS");
  const review = await app.request("/api/messages", {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "witness", expectedRevision: made.project.revision, intent: "witness", text: "Review the maker diff." }),
  });
  assert.equal(review.status, 200);
  const witnessed = await review.json();
  assert.equal(witnessed.project.witnessDrafts.length, 3);
  const exported = await (await app.request("/api/export")).json();
  assert.match(exported.plan, /Approved control/);
  assert.equal(exported.drafts[0].title, "Findings");
  assert.match(exported.limitation, /not a submitted article/);
});
