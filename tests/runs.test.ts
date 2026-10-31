import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { OpenCodeDiscovery, DiscoveredModel } from "../src/shared/opencode.ts";
import type { SpiritGuide } from "../src/server/experience/guide.ts";
import { ExperienceService } from "../src/server/experience/service.ts";
import { AtomicProjectStore } from "../src/server/store/atomic-project-store.ts";
import {
  createProject,
  refreshNextAction,
  type Project,
} from "../src/server/workflow/model.ts";
import { WorkflowService } from "../src/server/workflow/service.ts";
import { approveProduct, approveSection, grantMakerScope, reviseSection } from "../src/server/workflow/transitions.ts";
import { confirmNewProjectSource } from "./fixtures/oracle-replies.ts";

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

const discovery: OpenCodeDiscovery = {
  server: { version: "2.0.32", compatible: true, testedVersion: "2.0.32", warning: null },
  providers: [{ id: "opencode", name: "OpenCode", activation: "enabled", ready: "ready", modelCount: 1, detail: "1 model." }],
  models: [model],
  agents: [{ id: "build", name: "Build", mode: "primary", hidden: false, description: null, permissionCount: 1 }],
  roles: (["oracle", "architect", "maker", "witness"] as const).map((role) => ({ role, agent: role === "maker" ? "build" : "plan", available: true, detail: "mapped" })),
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

const engine = {
  async discovery() { return discovery; },
  async resolveModel() { return { model, source: "selected" as const }; },
  async chooseDefaultModel() { return null; },
  validateSelection() { return model; },
};

function approvedProject(): Project {
  let project = createProject("/workspace");
  confirmNewProjectSource(project);
  project.engine = {
    model: { providerID: "opencode", id: "flint-40b-free", variant: null },
    source: "user",
    updatedAt: null,
    legacyModel: null,
  };
  project.product = { status: "APPROVED", proposal: "Build a ledger.", openQuestions: [] };
  project = refreshNextAction(project);
  for (const section of [...project.sections]) {
    project = reviseSection(project, section.id, `${section.id} approved`);
    const current = project.sections.find((item) => item.id === section.id)!;
    project = approveSection(project, section.id, current.version, current.hash);
  }
  return grantMakerScope(project, "Build the ledger in the isolated workspace.");
}

interface Harness {
  experience: ExperienceService;
  store: AtomicProjectStore;
  interrupts: () => number;
  started: Promise<void>;
  release: () => void;
}

async function harness(options: { hold?: boolean; fail?: string | null; missingModel?: boolean } = {}): Promise<Harness> {
  const directory = await mkdtemp(join(tmpdir(), "ub-runs-"));
  await writeFile(join(directory, "ledger.test.mjs"), "import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('ledger', () => assert.equal(1, 1));\n");
  const store = new AtomicProjectStore(join(directory, "project.json"));
  await store.initialize(approvedProject());
  const workflow = new WorkflowService(store);
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => { markStarted = resolve; });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let interrupts = 0;
  const guide: SpiritGuide = {
    async speak() { return { sessionId: "ses_guide", messageId: null, text: "{}", cost: 0 }; },
    async perform(input) {
      input.onSession?.("ses_maker");
      markStarted();
      if (options.hold !== false) await gate;
      if (options.fail) throw new Error(options.fail);
      return { sessionId: "ses_maker", messageId: "msg_1", text: "diff", diff: "added ledger.mjs (+2/-0)", cost: 0 };
    },
    async inspect() { return "succeeded"; },
    async interrupt() { interrupts += 1; release(); return true; },
  };
  const experience = new ExperienceService(workflow, store, guide, {
    safeDirectory: directory,
    demoWorkspace: directory,
    promptRoot: process.cwd(),
    engine: options.missingModel
      ? { ...engine, resolveModel: async () => null }
      : engine,
  });
  return { experience, store, interrupts: () => interrupts, started, release };
}

async function waitFor<T>(work: () => Promise<T | null>, timeout = 5_000): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await work();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for run state.");
}

test("a Maker run returns before the native turn completes and records its model", async () => {
  const run = await harness();
  const project = (await run.store.load()).state;
  const before = Date.now();
  const accepted = await run.experience.runMaker("maker-1", project.revision);
  assert.ok(Date.now() - before < 2_000, "run must not block on the native turn");
  assert.equal(accepted.accepted, true);
  const operationId = accepted.project.operations.at(-1)!.id;
  assert.equal(accepted.project.operations.at(-1)!.status, "QUEUED");

  await run.started;
  const running = await waitFor(async () => {
    const current = (await run.store.load()).state;
    const operation = current.operations.find((item) => item.id === operationId);
    return operation?.status === "RUNNING" && operation.nativeSessionId === "ses_maker" ? current : null;
  });
  assert.equal(running.operations.find((item) => item.id === operationId)?.model?.id, "flint-40b-free");

  run.release();
  const finished = await waitFor(async () => {
    const current = (await run.store.load()).state;
    const operation = current.operations.find((item) => item.id === operationId);
    return operation?.status === "SUCCEEDED" ? current : null;
  });
  const operation = finished.operations.find((item) => item.id === operationId)!;
  assert.equal(`${operation.model?.providerID}/${operation.model?.id}`, "opencode/flint-40b-free");
  assert.equal(operation.agent, "build");
  assert.match(operation.result ?? "", /added ledger.mjs/);
  assert.match(operation.result ?? "", /Node check exit 0/);
  assert.equal(finished.evidence.at(-1)?.model?.id, "flint-40b-free");
  assert.equal(finished.stage, "WITNESS");
});

test("cancel interrupts the native session and does not let completion overwrite CANCELLED", async () => {
  const run = await harness();
  const project = (await run.store.load()).state;
  const accepted = await run.experience.runMaker("maker-cancel", project.revision);
  const operationId = accepted.project.operations.at(-1)!.id;
  await run.started;
  const current = await waitFor(async () => {
    const state = (await run.store.load()).state;
    return state.operations.find((item) => item.id === operationId)?.status === "RUNNING" ? state : null;
  });
  const cancelled = await run.experience.cancel("cancel-1", current.revision, operationId);
  assert.equal(run.interrupts(), 1);
  const operation = cancelled.project.operations.find((item) => item.id === operationId);
  assert.equal(operation?.status, "CANCELLED");
  await new Promise((resolve) => setTimeout(resolve, 50));
  const settled = (await run.store.load()).state.operations.find((item) => item.id === operationId);
  assert.equal(settled?.status, "CANCELLED");
});

test("a failed native turn becomes FAILED with its model retained", async () => {
  const run = await harness({ hold: false, fail: "Model call failed." });
  const project = (await run.store.load()).state;
  const accepted = await run.experience.runMaker("maker-fail", project.revision);
  const operationId = accepted.project.operations.at(-1)!.id;
  const failed = await waitFor(async () => {
    const state = (await run.store.load()).state;
    const operation = state.operations.find((item) => item.id === operationId);
    return operation?.status === "FAILED" ? state : null;
  });
  const operation = failed.operations.find((item) => item.id === operationId)!;
  assert.match(operation.result ?? "", /provider failed without a recognized safe category/i);
  assert.equal(operation.providerError?.category, "UNKNOWN_PROVIDER_FAILURE");
  assert.match(operation.providerError?.technical.diagnosticReference ?? "", /^provider-/);
  assert.equal(operation.model?.id, "flint-40b-free");
});

test("a duplicate run action never starts a second native turn", async () => {
  const run = await harness();
  const project = (await run.store.load()).state;
  const first = await run.experience.runMaker("same-run", project.revision);
  assert.equal(first.accepted, true);
  const duplicate = await run.experience.runMaker("same-run", project.revision);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.accepted, false);
  run.release();
  await waitFor(async () => {
    const state = (await run.store.load()).state;
    return state.operations.filter((operation) => operation.kind === "maker" && operation.status === "SUCCEEDED").length === 1 ? state : null;
  });
  assert.equal((await run.store.load()).state.operations.filter((item) => item.kind === "maker").length, 1);
});

test("a disappeared selected model blocks the run before any native work", async () => {
  const run = await harness({ hold: false, missingModel: true });
  const project = (await run.store.load()).state;
  await assert.rejects(run.experience.runMaker("missing-model", project.revision), /not available|no longer reported/);
  assert.equal((await run.store.load()).state.operations.length, 0);
});

test("an inactive in-process runner is not silently cancelled", async () => {
  const run = await harness();
  const project = (await run.store.load()).state;
  const accepted = await run.experience.runMaker("orphan", project.revision);
  const operationId = accepted.project.operations.at(-1)!.id;
  await run.started;
  run.release();
  await waitFor(async () => {
    const state = (await run.store.load()).state;
    return state.operations.find((item) => item.id === operationId)?.status === "SUCCEEDED" ? state : null;
  });
  await assert.rejects(
    run.experience.cancel("cancel-finished", (await run.store.load()).state.revision, operationId),
    /finished or abandoned operation/,
  );
});
