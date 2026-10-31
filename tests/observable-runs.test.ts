import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { DiscoveredModel, OpenCodeDiscovery } from "../src/shared/opencode.ts";
import type { NativeFileDiff, SpiritGuide } from "../src/server/experience/guide.ts";
import { NativeTimeoutError } from "../src/server/experience/guide.ts";
import { ExperienceService } from "../src/server/experience/service.ts";
import { AtomicProjectStore } from "../src/server/store/atomic-project-store.ts";
import {
  createProject,
  refreshNextAction,
  type Project,
} from "../src/server/workflow/model.ts";
import { WorkflowService } from "../src/server/workflow/service.ts";
import {
  acceptSectionCandidate,
  approveProduct,
  approveSection,
  grantMakerScope,
  reviseSection,
} from "../src/server/workflow/transitions.ts";
import { confirmNewProjectSource, oracleProposalReply } from "./fixtures/oracle-replies.ts";
import { compliantSectionDraft } from "./fixtures/section-drafts.ts";

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
  agents: [{ id: "plan", name: "Plan", mode: "primary", hidden: false, description: null, permissionCount: 0 }],
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

const engine = {
  async discovery() { return discovery; },
  async resolveModel() { return { model, source: "selected" as const }; },
  async chooseDefaultModel() { return null; },
  validateSelection() { return model; },
};

let callCounter = 0;
void callCounter;

function timedOut(message: string, sessionId: string): Error {
  const error = new NativeTimeoutError(message);
  return Object.assign(error, { nativeSessionId: sessionId });
}

interface GuideCalls {
  speak: number;
  perform: number;
  inspect: number;
  interrupt: number;
}

async function workshop(guide: SpiritGuide, options: { makerReady?: boolean } = {}): Promise<{
  experience: ExperienceService;
  workflow: WorkflowService;
  store: AtomicProjectStore;
  directory: string;
  calls: GuideCalls;
}> {
  const directory = await mkdtemp(join(tmpdir(), "ub-observable-"));
  await writeFile(join(directory, "ledger.test.mjs"), "import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('ledger', () => assert.equal(1, 1));\n", "utf8");
  const store = new AtomicProjectStore(join(directory, "project.json"));
  let project = createProject(directory);
  confirmNewProjectSource(project);
  project.engine = {
    model: { providerID: model.providerID, id: model.id, variant: null },
    source: "user",
    updatedAt: null,
    legacyModel: null,
  };
  if (options.makerReady) {
    project = await approvedProject(project);
  }
  await store.initialize(project);
  const workflow = new WorkflowService(store);
  const calls: GuideCalls = { speak: 0, perform: 0, inspect: 0, interrupt: 0 };
    const experience = new ExperienceService(workflow, store, guide, {
    safeDirectory: directory,
    demoWorkspace: directory,
    promptRoot: process.cwd(),
    engine,
    budgets: { guideTimeoutMs: 90_000, makerTimeoutMs: 90_000 },
    progressPollIntervalMs: 30,
  });
  trackCalls(guide, calls);
  return { experience, workflow, store, directory, calls };
}

function trackCalls(guide: SpiritGuide, calls: GuideCalls): void {
  const speak = guide.speak;
  guide.speak = async (input) => {
    calls.speak += 1;
    return speak(input as never) as never;
  };
  const perform = guide.perform;
  guide.perform = async (input) => {
    calls.perform += 1;
    return perform(input as never) as never;
  };
  const inspect = guide.inspect;
  if (inspect) {
    guide.inspect = async (sessionId, context) => {
      calls.inspect += 1;
      return inspect(sessionId, context);
    };
  }
  const interrupt = guide.interrupt;
  if (interrupt) {
    guide.interrupt = async (sessionId) => {
      calls.interrupt += 1;
      return interrupt(sessionId);
    };
  }
}

async function approvedProject(project: Project): Promise<Project> {
  let next = refreshNextAction(structuredClone(project));
  next.engine = {
    model: { providerID: model.providerID, id: model.id, variant: null },
    source: "user",
    updatedAt: null,
    legacyModel: null,
  };
  next.product = { status: "APPROVED", proposal: "Build a ledger.", openQuestions: [] };
  next = refreshNextAction(next);
  for (const section of [...next.sections]) {
    next = reviseSection(next, section.id, `${section.id} approved`);
    const current = next.sections.find((item) => item.id === section.id)!;
    next = approveSection(next, section.id, current.version, current.hash);
  }
  return grantMakerScope(next, "Build the approved ledger in the isolated demo workspace.");
}

async function waitFor<T>(work: () => Promise<T | null>, timeout = 5_000): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await work();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for observable run state.");
}

/** Narrows the async queue response out of the synchronous question branch. */
function awaitedOp(
  sent: unknown,
): { accepted: boolean; operation: Project["operations"][number] } {
  const maybe = sent as { accepted?: boolean; operation?: Project["operations"][number] };
  if (!maybe.operation) throw new Error("the message did not queue an operation");
  return { accepted: Boolean(maybe.accepted), operation: maybe.operation };
}

function assertQueued(result: unknown): Project["operations"][number] {
  const maybe = result as { operation?: Project["operations"][number] };
  if (!maybe.operation) throw new Error("the run was not queued");
  return maybe.operation;
}

function operationOf(project: Project, operationId: string): Project["operations"][number] {
  const operation = project.operations.find((item) => item.id === operationId);
  if (!operation) throw new Error(`Operation ${operationId} is missing from the project.`);
  return operation;
}

test("a slow Oracle run reports persisted progress before it finishes", async () => {
  const oracleReply = JSON.stringify(oracleProposalReply());
  const guideWithHold: SpiritGuide = {
    async perform() { throw new Error("unexpected"); },
    async inspect() { return "unknown"; },
    async speak(input) {
      input.onSession?.("ses_oracle");
      await new Promise((resolve) => setTimeout(resolve, 250));
      return { sessionId: "ses_oracle", messageId: null, text: oracleReply, cost: 0 };
    },
    async lastAssistantText(sessionId) {
      return sessionId === "ses_oracle" ? { messageId: "msg_oracle", text: oracleReply } : null;
    },
  };
  const run = await workshop(guideWithHold);
  const before = Date.now();
  const sent = await run.experience.sendMessage("oracle-progress", (await run.store.load()).state.revision, "clarify", "Students lose umbrellas.");
  assert.ok(awaitedOp(sent).accepted, "the request must queue the run instead of blocking");
  const queued = operationOf(sent.project, awaitedOp(sent).operation.id);
  assert.equal(queued.status, "QUEUED");
  assert.equal(queued.progress?.phase, "CONNECTING");
  assert.equal(queued.intent, "clarify");
  assert.equal(queued.idempotencyKey, "oracle-progress");
  assert.equal(queued.expectedOutput, "ORACLE_REPLY");

  const connectedOp = awaitedOp(sent).operation;
  const connected = await waitFor(async () => {
    const state = (await run.store.load()).state;
    const phase = operationOf(state, connectedOp.id).progress?.phase;
    return phase && phase !== "CONNECTING" ? phase : null;
  }, 4_000);
  assert.ok(connected === "SESSION_CREATED" || connected === "WAITING_FOR_MODEL" || connected === "RECEIVING_OUTPUT", `live progress appears promptly, saw ${String(connected)}`);

  const finished = await waitFor(async () => {
    const state = (await run.store.load()).state;
    const operation = operationOf(state, awaitedOp(sent).operation.id);
    return operation.status === "SUCCEEDED" ? operation : null;
  });
  assert.equal(finished.result, "Oracle proposal stored. It is not approved.");
  assert.equal(finished.appliedAt !== null, true);
  assert.equal(finished.progress, null);
  assert.ok(Date.now() - before < 10_000);
  const state = (await run.store.load()).state;
  assert.equal(state.product.status, "PROPOSED");
});

test("a late Oracle response is reconciled and applied exactly once", async () => {
  const oracleReply = JSON.stringify(oracleProposalReply({ questions: [{
    id: "claimant",
    field: "unresolvedQuestions",
    prompt: "Who may claim an item?",
    whyItMatters: "The answer defines the trust boundary.",
    suggestedChoices: [],
  }] }));
  const guide: SpiritGuide = {
    async speak(input) {
      input.onSession?.("ses_oracle");
      await new Promise((resolve) => setTimeout(resolve, 60));
      throw timedOut("Native spirit did not finish within the deadline.", "ses_oracle");
    },
    async perform() { throw new Error("unexpected"); },
    async inspect() { return "succeeded"; },
    async lastAssistantText(sessionId) {
      return sessionId === "ses_oracle" ? { messageId: "msg_late_oracle", text: oracleReply } : null;
    },
  };
  const run = await workshop(guide);
  const sent = await run.experience.sendMessage("oracle-late", (await run.store.load()).state.revision, "clarify", "Students lose umbrellas.");
  const abandoned = await waitFor(async () => {
    const state = (await run.store.load()).state;
    const operation = operationOf(state, awaitedOp(sent).operation.id);
    return operation.status === "ABANDONED" ? operation : null;
  });
  assert.equal(abandoned.nativeSessionId, "ses_oracle");
  assert.equal(abandoned.progress?.phase, "AWAITING_RECONCILIATION");
  assert.equal((await run.store.load()).state.product.status, "NONE");

  const reconciled = await run.experience.reconcile("reconcile-oracle", (await run.store.load()).state.revision, awaitedOp(sent).operation.id);
  const operation = operationOf(reconciled.project, awaitedOp(sent).operation.id);
  assert.equal(operation.status, "SUCCEEDED");
  assert.ok(operation.appliedAt, "the validated late reply is applied once");
  assert.equal(reconciled.project.product.status, "PROPOSED");
  assert.equal(reconciled.project.product.structuredProposal?.title, "Campus Lost-and-Found");
  assert.equal(operation.nativeMessageId, "msg_late_oracle");

  await assert.rejects(
    run.experience.reconcile("reconcile-oracle-again", (await run.store.load()).state.revision, awaitedOp(sent).operation.id),
    /finished/i,
  );
  const after = operationOf((await run.store.load()).state, awaitedOp(sent).operation.id);
  assert.equal(after.appliedAt, operation.appliedAt, "a duplicate reconcile cannot reapply the reply");
  const proposal = (await run.store.load()).state.product.proposal;
  assert.equal((await run.store.load()).state.product.proposal, proposal);
  assert.equal(run.calls.speak, 1, "no native run is repeated by reconciliation");
});

test("a section 06 Architect timeout is recovered when the late reply finally lands", async () => {
  const sectionReply = JSON.stringify({
    content: compliantSectionDraft("phases", "Sequence the queue by dependency with a checkpoint after each phase."),
    summary: "Sequenced the phases with gates and a rollback checkpoint.",
    recommendation: "Sequence the queue by dependency.",
    tradeoff: "Fewer checkpoints would be faster but riskier.",
  });
  let holdUntilLate = true;
  const guide: SpiritGuide = {
    async perform() { throw new Error("unexpected"); },
    async speak(input) {
      input.onSession?.("ses_architect");
      if (holdUntilLate) throw timedOut("Native spirit did not finish.", "ses_architect");
      return { sessionId: "ses_architect", messageId: null, text: sectionReply, cost: 0 };
    },
    async inspect() { return "succeeded"; },
    async lastAssistantText(sessionId) {
      return sessionId === "ses_architect" ? { messageId: "msg_late_section", text: sectionReply } : null;
    },
  };
  const run = await workshop(guide);
  let state = (await run.store.load()).state;
  await run.workflow.execute("approve-product", { kind: "product" }, state.revision, (project) => {
    project.product = { status: "APPROVED", proposal: "Track found items.", openQuestions: [] };
    return refreshNextAction(project);
  });
  for (const sectionId of ["control", "architecture", "experience", "tools", "verification"]) {
    state = (await run.store.load()).state;
    await run.workflow.execute(`revise-${sectionId}`, { sectionId }, state.revision, (project) =>
      reviseSection(project, sectionId, `${sectionId} approved early for recovery testing.`));
    state = (await run.store.load()).state;
    const current = state.sections.find((item) => item.id === sectionId)!;
    await run.workflow.execute(`approve-${sectionId}`, { sectionId }, state.revision, (project) =>
      approveSection(project, sectionId, current.version, current.hash));
  }
  state = (await run.store.load()).state;
  assert.equal(state.stage, "ARCHITECT");
  assert.equal(state.currentSectionId, "phases", "section 06 is the cleared current section");

  const sent = await run.experience.sendMessage("section-06", state.revision, "draft", "Draft the phases section.");
  const abandoned = await waitFor(async () => {
    const next = (await run.store.load()).state;
    const operation = operationOf(next, awaitedOp(sent).operation.id);
    return operation.status === "ABANDONED" ? next : null;
  });
  const phasesBefore = abandoned.sections.find((item) => item.id === "phases");
  assert.equal(phasesBefore?.version, 0);

  holdUntilLate = false;
  const reconciled = await run.experience.reconcile("reconcile-section-06", (await run.store.load()).state.revision, awaitedOp(sent).operation.id);
  assert.equal(operationOf(reconciled.project, awaitedOp(sent).operation.id).status, "SUCCEEDED");
  const phasesBeforeAccept = reconciled.project.sections.find((item) => item.id === "phases");
  assert.equal(phasesBeforeAccept?.version, 0, "a reconciled candidate does not replace the draft");
  const pending = phasesBeforeAccept?.candidateRevisions.find((candidate) => candidate.status === "PENDING");
  assert.ok(pending, "the recovered reply is a pending candidate");
  const accepted = await run.workflow.execute(
    "accept-section-06",
    { candidateId: pending.id },
    reconciled.project.revision,
    (project) => acceptSectionCandidate(project, "phases", pending.id),
  );
  const phases = accepted.project.sections.find((item) => item.id === "phases");
  assert.equal(phases?.version, 1);
  assert.match(phases?.content ?? "", /Phases and queue/);

  await assert.rejects(
    run.experience.reconcile("reconcile-section-06-again", (await run.store.load()).state.revision, awaitedOp(sent).operation.id),
    /finished/i,
  );
  const unchanged = (await run.store.load()).state.sections.find((item) => item.id === "phases");
  assert.equal(unchanged?.version, 1, "duplicate reconciliation does not revise the section again");
});

test("a late Maker diff is applied exactly once with its observed check result", async () => {
  let diff: NativeFileDiff[] | null = null;
  const guide: SpiritGuide = {
    async speak() { throw new Error("unexpected"); },
    async perform(input) {
      input.onSession?.("ses_maker");
      return {
        sessionId: "ses_maker",
        messageId: "msg_maker",
        text: "timed out",
        diff: "Native Maker run timed out before it became idle, without a file diff.",
        cost: 0,
        outcome: "running",
        timedOut: true,
      };
    },
    async inspect() { return "succeeded"; },
    async sessionDiff() { return diff; },
  };
  const run = await workshop(guide, { makerReady: true });
  const started = await run.experience.runMaker("maker-late", (await run.store.load()).state.revision);
  const startedOp = assertQueued(started);
  const abandoned = await waitFor(async () => {
    const state = (await run.store.load()).state;
    const operation = operationOf(state, startedOp.id);
    return operation.status === "ABANDONED" ? state : null;
  });
  assert.match(abandoned.nextAction, /Reconcile/i);

  // First reconcile: the session succeeded but the diff has not landed yet.
  const unapplied = await run.experience.reconcile("reconcile-maker-1", (await run.store.load()).state.revision, startedOp.id);
  assert.equal(operationOf(unapplied.project, startedOp.id).status, "COMPLETED_UNAPPLIED");
  assert.equal(operationOf(unapplied.project, startedOp.id).progress?.phase, "AWAITING_RECONCILIATION");

  // The late diff lands; reconciling now retrieves and validates it once.
  diff = [{ status: "added", file: "ledger.mjs", additions: 2, deletions: 0 }];
  const reconciled = await run.experience.reconcile("reconcile-maker-2", (await run.store.load()).state.revision, startedOp.id);
  const operation = operationOf(reconciled.project, startedOp.id);
  assert.equal(operation.status, "SUCCEEDED");
  assert.match(operation.result ?? "", /Reconciled from the native session outcome/);
  assert.match(operation.result ?? "", /Node check exit 0/);
  assert.match(operation.result ?? "", /added ledger\.mjs/);
  assert.ok(operation.appliedAt);
  const evidence = reconciled.project.evidence.at(-1);
  assert.equal(evidence?.result, "PASS");

  await assert.rejects(
    run.experience.reconcile("reconcile-maker-3", (await run.store.load()).state.revision, startedOp.id),
    /finished/i,
  );
  const final = (await run.store.load()).state;
  assert.equal(final.evidence.length, 1, "duplicate reconciliation cannot double the evidence");
  assert.equal(final.operations.filter((item) => item.kind === "maker").length, 1);
  assert.equal(run.calls.perform, 1, "reconciliation never repeats the native run");
  assert.match(final.nextAction, /Witness|evidence/i);
});

test("a resolved permission is required before reconciliation applies a Maker diff", async () => {
  let permissionPending = true;
  const diff: NativeFileDiff[] = [{ status: "modified", file: "ledger.test.mjs", additions: 1, deletions: 0 }];
  const guide: SpiritGuide = {
    async speak() { throw new Error("unexpected"); },
    async perform(input) {
      input.onSession?.("ses_permission");
      return {
        sessionId: "ses_permission",
        messageId: "msg_permission",
        text: "waiting for permission",
        diff: "Native session finished without a file diff.",
        cost: 0,
        outcome: "running",
        pendingPermission: true,
        timedOut: true,
      };
    },
    async inspect() { return "succeeded"; },
    async sessionDiff() { return diff; },
    async hasPendingPermission() { return permissionPending; },
  };
  const run = await workshop(guide, { makerReady: true });
  const started = await run.experience.runMaker("maker-permission", (await run.store.load()).state.revision);
  const startedOp = assertQueued(started);
  const waiting = await waitFor(async () => {
    const state = (await run.store.load()).state;
    const operation = operationOf(state, startedOp.id);
    return operation.status === "WAITING_PERMISSION" ? operation : null;
  });
  assert.equal(waiting.progress?.phase, "WAITING_PERMISSION");

  const stillPending = await run.experience.reconcile("reconcile-pending", (await run.store.load()).state.revision, startedOp.id);
  assert.equal(operationOf(stillPending.project, startedOp.id).status, "WAITING_PERMISSION");
  assert.match(operationOf(stillPending.project, startedOp.id).result ?? "", /still pending/i);

  permissionPending = false;
  const resolved = await run.experience.reconcile("reconcile-resolved", (await run.store.load()).state.revision, startedOp.id);
  assert.equal(operationOf(resolved.project, startedOp.id).status, "SUCCEEDED");
  assert.equal(run.calls.perform, 1);
});

test("cancellation leaves a guide run cancelled even when its late reply arrives", async () => {
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const guide: SpiritGuide = {
    async speak(input) {
      input.onSession?.("ses_cancel");
      await blocked;
      return {
        sessionId: "ses_cancel",
        messageId: null,
        text: JSON.stringify(oracleProposalReply({ summary: "Late proposal." })),
        cost: 0,
      };
    },
    async perform() { throw new Error("unexpected"); },
    async inspect() { return "running"; },
    async interrupt() { return true; },
  };
  try {
    const run = await workshop(guide);
    const sent = await run.experience.sendMessage("oracle-cancel", (await run.store.load()).state.revision, "clarify", "Students lose umbrellas.");
    const running = await waitFor(async () => {
      const state = (await run.store.load()).state;
      const operation = operationOf(state, awaitedOp(sent).operation.id);
      return operation.status === "RUNNING" && operation.nativeSessionId === "ses_cancel" ? state : null;
    });
    const cancelled = await run.experience.cancel("cancel-guide", running.revision, awaitedOp(sent).operation.id);
    assert.equal(operationOf(cancelled.project, awaitedOp(sent).operation.id).status, "CANCELLED");
    release();
    await new Promise((resolve) => setTimeout(resolve, 80));
    const settled = operationOf((await run.store.load()).state, awaitedOp(sent).operation.id);
    assert.equal(settled.status, "CANCELLED", "a late reply must not overwrite the cancellation");
    assert.equal((await run.store.load()).state.product.status, "NONE");
    assert.equal(run.calls.interrupt, 1);
  } finally {
    release();
  }
});

test("a retry runs a new native turn and cannot reconcile or duplicate the failed one", async () => {
  let attempt = 0;
  const guide: SpiritGuide = {
    async speak() { throw new Error("unexpected"); },
    async perform(input) {
      attempt += 1;
      input.onSession?.(`ses_maker_${attempt}`);
      if (attempt === 1) throw new Error("Model call failed.");
      return {
        sessionId: `ses_maker_${attempt}`,
        messageId: "msg_retry",
        text: "added",
        diff: "added ledger.mjs (+2/-0)",
        cost: 0,
      };
    },
    async inspect() { return "succeeded"; },
    async sessionDiff() { return [{ status: "added", file: "ledger.mjs", additions: 2, deletions: 0 }]; },
    async lastAssistantText() { return null; },
  };
  const run = await workshop(guide, { makerReady: true });
  const first = await run.experience.runMaker("maker-fail", (await run.store.load()).state.revision);
  const firstOp = assertQueued(first);
  const failed = await waitFor(async () => {
    const state = (await run.store.load()).state;
    const operation = operationOf(state, firstOp.id);
    return operation.status === "FAILED" ? operation : null;
  });
  assert.equal(failed.statusReason?.startsWith("unknown") === true || failed.providerError !== null, true);

  const retried = await run.experience.retryRun("retry-maker", (await run.store.load()).state.revision, firstOp.id);
  assert.equal(retried.accepted, true);
  assert.equal(assertQueued(retried).retryOf, firstOp.id, "the retry keeps explicit recovery lineage");
  assert.notEqual(assertQueued(retried).id, firstOp.id);
  assert.equal(operationOf((await run.store.load()).state, firstOp.id).status, "FAILED", "the original stays a confirmed failure");

  const succeeded = await waitFor(async () => {
    const state = (await run.store.load()).state;
    const operation = operationOf(state, assertQueued(retried).id);
    return operation.status === "SUCCEEDED" ? state : null;
  });
  assert.equal(succeeded.operations.filter((item) => item.kind === "maker" && item.status === "SUCCEEDED").length, 1, "no duplicate native run");
  assert.equal(attempt, 2);

  // A finished operation cannot be retried again, replayed, or reconciled.
  await assert.rejects(
    run.experience.retryRun("retry-again", (await run.store.load()).state.revision, assertQueued(retried).id),
    /confirmed/i,
  );
  await assert.rejects(
    run.experience.reconcile("reconcile-finished", (await run.store.load()).state.revision, assertQueued(retried).id),
    /finished/i,
  );
  assert.equal(succeeded.operations.length, 2);
});

test("reconnecting after a server restart reconciles the persisted late maker diff", async () => {
  const diff: NativeFileDiff[] = [{ status: "added", file: "ledger.mjs", additions: 3, deletions: 1 }];
  const guideBeforeRestart: SpiritGuide = {
    async speak() { throw new Error("unexpected"); },
    async perform(input) {

      input.onSession?.("ses_maker_restart");
      return {
        sessionId: "ses_maker_restart",
        messageId: "msg_restart",
        text: "still running",
        diff: "Native session finished without a file diff.",
        cost: 0,
        outcome: "running",
      };
    },
    async inspect() { return "succeeded"; },
    async sessionDiff() { return null; },
  };
  const run = await workshop(guideBeforeRestart, { makerReady: true });
  const started = await run.experience.runMaker("maker-restart", (await run.store.load()).state.revision);
  const startedOp = assertQueued(started);
  await waitFor(async () => {
    const state = (await run.store.load()).state;
    const operation = operationOf(state, startedOp.id);
    return operation.status === "RUNNING" && operation.nativeSessionId === "ses_maker_restart" ? operation : null;
  });

  await run.workflow.recoverAfterRestart();

  const afterRestart = operationOf((await run.store.load()).state, startedOp.id);
  assert.equal(afterRestart.status, "ABANDONED");
  assert.equal(afterRestart.progress?.phase, "AWAITING_RECONCILIATION");
  assert.equal(afterRestart.nativeSessionId, "ses_maker_restart");

  const guideAfterRestart: SpiritGuide = {
    async speak() { throw new Error("unexpected"); },
    async perform() { throw new Error("unexpected"); },
    async inspect() { return "succeeded"; },
    async sessionDiff() { return diff; },
  };
  const recovered = new ExperienceService(run.workflow, run.store, guideAfterRestart, {
    safeDirectory: run.directory,
    demoWorkspace: run.directory,
    promptRoot: process.cwd(),
    engine,
  });
  const reconciled = await recovered.reconcile("reconcile-restart", (await run.store.load()).state.revision, startedOp.id);
  const operation = operationOf(reconciled.project, startedOp.id);
  assert.equal(operation.status, "SUCCEEDED");
  assert.ok(operation.appliedAt);
  assert.match(operation.result ?? "", /added ledger\.mjs/);
  assert.equal(run.calls.perform, 1);
});

test("a lost native session stays reconcilable instead of blocking the project", async () => {
  const guide: SpiritGuide = {
    async speak(input) {
      input.onSession?.("ses_lost");
      throw Object.assign(new Error("Connection reset before the reply."), { nativeSessionId: "ses_lost" });
    },
    async perform() { throw new Error("unexpected"); },
    async inspect() { return "unknown"; },
    async lastAssistantText() { return null; },
  };
  const run = await workshop(guide);
  const sent = await run.experience.sendMessage("oracle-lost", (await run.store.load()).state.revision, "clarify", "Students lose umbrellas.");
  const abandoned = await waitFor(async () => {
    const state = (await run.store.load()).state;
    const operation = operationOf(state, awaitedOp(sent).operation.id);
    return operation.status === "ABANDONED" ? operation : null;
  });
  assert.equal(abandoned.nativeSessionId, "ses_lost");

  const stillUnknown = await run.experience.reconcile("reconcile-unknown", (await run.store.load()).state.revision, awaitedOp(sent).operation.id);
  assert.equal(operationOf(stillUnknown.project, awaitedOp(sent).operation.id).status, "ABANDONED");
  assert.match(operationOf(stillUnknown.project, awaitedOp(sent).operation.id).result ?? "", /not repeated/i);

  // An already-abandoned operation is never re-marked; the operator decision
  // is recorded while a run is still genuinely outstanding.
  await assert.rejects(
    run.experience.abandonRun("mark-abandoned", (await run.store.load()).state.revision, awaitedOp(sent).operation.id),
    /already abandoned/i,
  );
});

test("mark abandoned records the operator decision for an outstanding run", async () => {
  const guide: SpiritGuide = {
    async perform() { throw new Error("unexpected"); },
    async speak() { throw new Error("unexpected"); },
    async inspect() { return "running"; },
    async lastAssistantText() { return null; },
  };
  const run = await workshop(guide, { makerReady: true });
  const state = (await run.store.load()).state;
  const operationId = "11111111-1111-4111-8111-111111111111";
  await run.workflow.execute("outstanding", { seeded: true }, state.revision, (project) => {
    const next = structuredClone(project);
    next.operations.push({
      id: operationId,
      kind: "maker",
      payloadHash: "hash",
      nativeSessionId: "ses_outstanding",
      nativeMessageId: null,
      status: "RUNNING",
      result: "Running in OpenCode with opencode/flint-40b-free.",
      model: null,
      agent: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      statusReason: null,
      lastObservedAt: null,
      appliedAt: null,
      providerError: null,
      intent: "maker-run",
      sectionId: null,
      startingRevision: state.revision,
      idempotencyKey: "outstanding",
      expectedOutput: "MAKER_DIFF",
      retryOf: null,
      progress: { phase: "RECEIVING_OUTPUT", detail: "Receiving the native output.", updatedAt: new Date().toISOString() },
    });
    return refreshNextAction(next);
  });

  const marked = await run.experience.abandonRun("mark-outstanding", (await run.store.load()).state.revision, operationId);
  const recorded = operationOf(marked.project, operationId);
  assert.equal(recorded.status, "ABANDONED");
  assert.equal(recorded.statusReason, "user-marked-abandoned");
  assert.equal(recorded.progress, null);
  assert.match(recorded.result ?? "", /Marked abandoned/);
});
