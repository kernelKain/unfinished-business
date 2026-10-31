import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../src/server/app.ts";
import { NativeBudgetError, type SpiritGuide } from "../src/server/experience/guide.ts";
import { ExperienceService } from "../src/server/experience/service.ts";
import { AtomicProjectStore } from "../src/server/store/atomic-project-store.ts";
import { createProject, refreshNextAction, type Project } from "../src/server/workflow/model.ts";
import { approveSection, grantMakerScope, reviseSection } from "../src/server/workflow/transitions.ts";
import { WorkflowService } from "../src/server/workflow/service.ts";

const headers = { "content-type": "application/json", "x-ub-session-token": "token" };
const engine = async () => ({
  available: true,
  serverVersion: "2.0.32",
  versionCompatible: true,
  authenticated: true,
  mode: "local",
  model: "opencode/deepseek-v4.1-flash-free",
  modelAvailable: true,
  limitation: null,
});

async function makerReady(guide: SpiritGuide, options: { testBody?: string } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "ub-maker-hardening-"));
  if (options.testBody) await writeFile(join(directory, "project.test.mjs"), options.testBody);
  const store = new AtomicProjectStore(join(directory, "project.json"));
  let project = createProject(directory);
  project.product = { status: "APPROVED", proposal: "Track found items.", openQuestions: [] };
  for (const section of project.sections) {
    project = reviseSection(project, section.id, `${section.id} approved`);
    const current = project.sections.find((item) => item.id === section.id)!;
    project = approveSection(project, section.id, current.version, current.hash);
  }
  project = grantMakerScope(project, "Build the approved plan in the demo workspace.");
  assert.equal(project.stage, "MAKER");
  project = refreshNextAction(project);
  await store.initialize(project);
  const service = new WorkflowService(store);
  const experience = new ExperienceService(service, store, guide, {
    safeDirectory: directory,
    demoWorkspace: directory,
    promptRoot: process.cwd(),
    budgets: { makerTimeoutMs: 1_000, nodeCheckTimeoutMs: 10_000 },
  });
  const app = createApp(engine, { service, sessionToken: "token", experience });
  return { app, store, service, directory };
}

async function waitFor(
  service: WorkflowService,
  predicate: (project: Project) => boolean,
  timeoutMs = 3_000,
): Promise<Project> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const project = await service.get();
    if (predicate(project)) return project;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("Timed out waiting for the asynchronous Maker run.");
}

test("a timed-out Maker run becomes ABANDONED and cannot be retried automatically", async () => {
  let calls = 0;
  const guide: SpiritGuide = {
    async speak() { throw new Error("unexpected"); },
    async perform() {
      calls += 1;
      return {
        sessionId: "ses_unknown",
        messageId: "msg_unknown",
        text: "timed out",
        diff: "Native Maker run timed out before it became idle, without a file diff.",
        cost: 0,
        outcome: "running",
        timedOut: true,
      };
    },
    async inspect() { return "unknown"; },
  };
  const { app, service } = await makerReady(guide);
  const project = await service.get();
  const run = await app.request("/api/runs", {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "run-1", expectedRevision: project.revision }),
  });
  assert.equal(run.status, 202);
  const after = await waitFor(service, (state) => state.operations[0]?.status === "ABANDONED");
  assert.equal(calls, 1);
  assert.match(after.nextAction, /Reconcile/i);

  const retry = await app.request("/api/runs", {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "run-2", expectedRevision: after.revision }),
  });
  assert.equal(retry.status, 409);
  assert.equal((await retry.json()).code, "RUN_UNRESOLVED");
  assert.equal(calls, 1);
});

test("a pending native permission is visible and is not approved by the app", async () => {
  const guide: SpiritGuide = {
    async speak() { throw new Error("unexpected"); },
    async perform() {
      return {
        sessionId: "ses_permission",
        messageId: "msg_permission",
        text: "permission pending",
        diff: "Native session finished without a file diff.",
        cost: 0,
        outcome: "running",
        pendingPermission: true,
        timedOut: true,
      };
    },
    async inspect() { return "running"; },
  };
  const { app, service } = await makerReady(guide);
  const project = await service.get();
  const run = await app.request("/api/runs", {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "permission-run", expectedRevision: project.revision }),
  });
  assert.equal(run.status, 202);
  const after = await waitFor(service, (state) => state.operations[0]?.status === "WAITING_PERMISSION");
  assert.match(after.nextAction, /permission/i);
});

test("a budget failure is persisted as a non-retryable failure with the native session", async () => {
  const guide: SpiritGuide = {
    async speak() { throw new Error("unexpected"); },
    async perform() {
      const error = new NativeBudgetError("Native session used 999999 tokens, above the configured 200000 token budget.");
      throw Object.assign(error, { nativeSessionId: "ses_budget" });
    },
    async inspect() { return "unknown"; },
  };
  const { app, service } = await makerReady(guide);
  const project = await service.get();
  const run = await app.request("/api/runs", {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "budget-run", expectedRevision: project.revision }),
  });
  assert.equal(run.status, 202);
  const after = await waitFor(service, (state) => state.operations[0]?.status === "ABANDONED");
  assert.equal(after.operations[0].nativeSessionId, "ses_budget");
});

test("a failed Node check is recorded as evidence, not as a passing run", async () => {
  const guide: SpiritGuide = {
    async speak() { throw new Error("unexpected"); },
    async perform() {
      return {
        sessionId: "ses_check",
        messageId: "msg_check",
        text: "modified",
        diff: "modified project.test.mjs (+1/-0)",
        cost: 0,
        outcome: "succeeded",
      };
    },
    async inspect() { return "succeeded"; },
  };
  const { app, service } = await makerReady(guide, {
    testBody: "import test from 'node:test'; import assert from 'node:assert/strict'; test('fails', () => assert.equal(1, 2));",
  });
  const project = await service.get();
  const run = await app.request("/api/runs", {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "check-run", expectedRevision: project.revision }),
  });
  assert.equal(run.status, 202);
  const after = await waitFor(service, (state) => state.evidence.length > 0);
  assert.equal(after.evidence[0].result, "FAIL");
  assert.match(after.evidence[0].limitation ?? "", /did not leave a passing Node test/);
});

test("reconciliation records the native outcome without starting a second run", async () => {
  let calls = 0;
  const guide: SpiritGuide = {
    async speak() { throw new Error("unexpected"); },
    async perform() {
      calls += 1;
      return {
        sessionId: "ses_reconcile",
        messageId: "msg_reconcile",
        text: "timed out",
        diff: "Native Maker run timed out before it became idle, without a file diff.",
        cost: 0,
        outcome: "running",
        timedOut: true,
      };
    },
    async inspect() { return "succeeded"; },
    async sessionDiff() { return [{ status: "modified", file: "project.test.mjs", additions: 1, deletions: 0 }]; },
  };
  const { app, service } = await makerReady(guide);
  const project = await service.get();
  await app.request("/api/runs", {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "reconcile-run", expectedRevision: project.revision }),
  });
  const abandoned = await waitFor(service, (state) => state.operations[0]?.status === "ABANDONED");
  const operationId = abandoned.operations[0].id;
  const reconciled = await app.request(`/api/runs/${operationId}/reconcile`, {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "reconcile-action", expectedRevision: abandoned.revision }),
  });
  assert.equal(reconciled.status, 200);
  const after = await service.get();
  assert.equal(after.operations[0].status, "SUCCEEDED");
  assert.match(after.operations[0].result ?? "", /Reconciled/);
  assert.equal(calls, 1);
});

test("cancellation interrupts natively and refuses to mark cancelled when interruption fails", async () => {
  let interruptCalls = 0;
  let release!: () => void;
  let started!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const performing = new Promise<void>((resolve) => { started = resolve; });
  const guide: SpiritGuide = {
    async speak() { throw new Error("unexpected"); },
    async perform(input) {
      input.onSession?.("ses_cancel");
      started();
      await blocked;
      return {
        sessionId: "ses_cancel",
        messageId: null,
        text: "done",
        diff: "modified project.test.mjs (+1/-0)",
        cost: 0,
        outcome: "succeeded",
      };
    },
    async inspect() { return "running"; },
    async interrupt() {
      interruptCalls += 1;
      throw new Error("interrupt unavailable");
    },
  };
  const { app, service } = await makerReady(guide);
  const project = await service.get();
  const run = await app.request("/api/runs", {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "cancel-run", expectedRevision: project.revision }),
  });
  assert.equal(run.status, 202);
  await performing;
  const active = await waitFor(service, (state) => state.operations[0]?.status === "RUNNING");
  const operationId = active.operations[0].id;
  const cancelled = await app.request(`/api/runs/${operationId}/cancel`, {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "cancel-action", expectedRevision: active.revision }),
  });
  assert.equal(cancelled.status, 503);
  assert.equal((await cancelled.json()).code, "CANCEL_UNAVAILABLE");
  assert.equal(interruptCalls, 1);
  assert.notEqual((await service.get()).operations[0].status, "CANCELLED");
  release();
});
