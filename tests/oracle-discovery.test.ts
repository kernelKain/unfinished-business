import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../src/server/app.ts";
import type { SpiritGuide } from "../src/server/experience/guide.ts";
import { ExperienceService } from "../src/server/experience/service.ts";
import { ExperienceFailure } from "../src/server/experience/service.ts";
import { oracleReplySchema } from "../src/server/experience/parse.ts";
import { ProjectSourceError, ProjectSourceService } from "../src/server/project-sources.ts";
import { AtomicProjectStore } from "../src/server/store/atomic-project-store.ts";
import { createProject } from "../src/server/workflow/model.ts";
import { WorkflowService } from "../src/server/workflow/service.ts";
import { oracleProposalReply, oracleQuestionsReply } from "./fixtures/oracle-replies.ts";

const publicResolver = async () => [{ address: "203.0.113.20", family: 4 }];

async function sourceFixture() {
  const directory = await mkdtemp(join(tmpdir(), "ub-source-onboarding-"));
  const store = new AtomicProjectStore(join(directory, "project.json"));
  await store.initialize(createProject(join(directory, "demo-workspace")));
  const workflow = new WorkflowService(store);
  const imported: Array<{ url: string; target: string }> = [];
  const sources = new ProjectSourceService(workflow, {
    managedImportRoot: join(directory, "managed-imports"),
    resolver: publicResolver,
    importer: async (url, target) => {
      imported.push({ url: url.toString(), target });
      await mkdir(target, { recursive: true });
    },
  });
  return { directory, store, workflow, sources, imported };
}

test("every fresh project waits for one of the four source paths", async () => {
  const fresh = await sourceFixture();
  assert.equal((await fresh.workflow.get()).source.status, "UNSELECTED");
  assert.match((await fresh.workflow.get()).nextAction, /choose where/i);

  const created = await fresh.sources.select("source-new", 0, { kind: "NEW_PROJECT", label: "Fresh idea" });
  assert.equal(created.project.source.kind, "NEW_PROJECT");
  assert.equal(created.project.source.status, "CONFIRMED");

  const savedFixture = await sourceFixture();
  const saved = await savedFixture.sources.select("source-saved", 0, { kind: "SAVED_PROJECT" });
  assert.equal(saved.project.source.kind, "SAVED_PROJECT");
  assert.equal(saved.project.source.status, "CONFIRMED");

  const localFixture = await sourceFixture();
  const repository = join(localFixture.directory, "local-repository");
  await mkdir(join(repository, ".git"), { recursive: true });
  const local = await localFixture.sources.select("source-local", 0, { kind: "LOCAL_REPOSITORY", path: repository });
  assert.equal(local.project.source.kind, "LOCAL_REPOSITORY");
  assert.equal(local.project.source.workspacePath, await realpath(repository));
  assert.match(local.project.source.repositoryCondition ?? "", /Git metadata is present/);

  const remoteFixture = await sourceFixture();
  const staged = await remoteFixture.sources.select("source-remote", 0, {
    kind: "REMOTE_REPOSITORY",
    url: "https://github.com/example/project.git",
  });
  assert.equal(staged.project.source.status, "PENDING_CONFIRMATION");
  assert.equal(remoteFixture.imported.length, 0, "selection alone must not import or grant write access");
  const confirmed = await remoteFixture.sources.confirmRemote("source-confirm", staged.project.revision);
  assert.equal(confirmed.project.source.status, "CONFIRMED");
  assert.equal(remoteFixture.imported.length, 1);
  assert.ok(remoteFixture.imported[0].target.startsWith(join(await realpath(remoteFixture.directory), "managed-imports")));
  const duplicateConfirmation = await remoteFixture.sources.confirmRemote("source-confirm", staged.project.revision);
  assert.equal(duplicateConfirmation.duplicate, true);
  assert.equal(remoteFixture.imported.length, 1, "a duplicate confirmation must not clone twice");

  const replacementFixture = await sourceFixture();
  const pending = await replacementFixture.sources.select("remote-to-replace", 0, {
    kind: "REMOTE_REPOSITORY",
    url: "https://github.com/example/replace-me.git",
  });
  const replacement = await replacementFixture.sources.select("replace-source", pending.project.revision, { kind: "NEW_PROJECT" });
  assert.equal(replacement.project.source.kind, "NEW_PROJECT");
  assert.match(replacement.project.oracleIntake.repositoryCondition?.value ?? "", /No repository exists/);
});

test("source action IDs are idempotent without treating different private paths as the same input", async () => {
  const fixture = await sourceFixture();
  const firstPath = join(fixture.directory, "repository-one");
  const secondPath = join(fixture.directory, "repository-two");
  await mkdir(firstPath, { recursive: true });
  await mkdir(secondPath, { recursive: true });
  const selected = await fixture.sources.select("local-idempotency", 0, { kind: "LOCAL_REPOSITORY", path: firstPath });
  const duplicate = await fixture.sources.select("local-idempotency", 0, { kind: "LOCAL_REPOSITORY", path: firstPath });
  assert.equal(duplicate.duplicate, true);
  await assert.rejects(
    fixture.sources.select("local-idempotency", selected.project.revision, { kind: "LOCAL_REPOSITORY", path: secondPath }),
    (error: unknown) => error instanceof ProjectSourceError && error.code === "ACTION_REUSED",
  );
});

test("Oracle is blocked before source selection and limits each turn to three questions", async () => {
  const fixture = await sourceFixture();
  let calls = 0;
  const experience = new ExperienceService(fixture.workflow, fixture.store, {
    async speak() { calls += 1; throw new Error("not expected"); },
    async perform() { throw new Error("not expected"); },
    async inspect() { return "unknown"; },
  }, { safeDirectory: fixture.directory, demoWorkspace: fixture.directory, promptRoot: process.cwd() });
  await assert.rejects(
    experience.sendMessage("oracle-before-source", 0, "clarify", "Build a campus tool."),
    (error: unknown) => error instanceof ExperienceFailure && error.code === "PROJECT_SOURCE_REQUIRED",
  );
  assert.equal(calls, 0);
  const tooMany = oracleQuestionsReply();
  tooMany.questions = Array.from({ length: 4 }, (_, index) => ({
    id: `question-${index}`,
    field: "problem",
    prompt: `Question ${index}?`,
    whyItMatters: "It changes scope.",
    suggestedChoices: [],
  }));
  assert.equal(oracleReplySchema.safeParse(tooMany).success, false);
});

test("remote source validation rejects credentials and private hosts without persisting them", async () => {
  const fixture = await sourceFixture();
  await assert.rejects(
    fixture.sources.select("secret-url", 0, {
      kind: "REMOTE_REPOSITORY",
      url: "https://token:secret@github.com/example/project.git",
    }),
    (error: unknown) => error instanceof ProjectSourceError && error.code === "REMOTE_URL_CREDENTIALS",
  );
  assert.equal(JSON.stringify(await fixture.workflow.get()).includes("token:secret"), false);

  const privateFixture = await sourceFixture();
  const privateSources = new ProjectSourceService(privateFixture.workflow, {
    managedImportRoot: join(privateFixture.directory, "imports"),
    resolver: async () => [{ address: "127.0.0.1", family: 4 }],
  });
  await assert.rejects(
    privateSources.select("private-url", 0, { kind: "REMOTE_REPOSITORY", url: "https://internal.example/repo/project.git" }),
    (error: unknown) => error instanceof ProjectSourceError && error.code === "REMOTE_HOST_BLOCKED",
  );
});

test("project source routes require authorization and never expose canonical local paths", async () => {
  const fixture = await sourceFixture();
  const repository = join(fixture.directory, "private-local-repository");
  await mkdir(join(repository, ".git"), { recursive: true });
  const app = createApp({ service: fixture.workflow, sources: fixture.sources, sessionToken: "source-token" });
  const body = JSON.stringify({
    actionId: "http-local-source",
    expectedRevision: 0,
    kind: "LOCAL_REPOSITORY",
    path: repository,
  });
  assert.equal((await app.request("/api/project/source", { method: "POST", headers: { "content-type": "application/json" }, body })).status, 403);
  const selected = await app.request("/api/project/source", {
    method: "POST",
    headers: { "content-type": "application/json", "x-ub-session-token": "source-token" },
    body,
  });
  assert.equal(selected.status, 200);
  const selectedResult = await selected.json();
  assert.equal(selectedResult.project.workspace, undefined);
  assert.equal(selectedResult.project.source.workspacePath, undefined);
  assert.equal(JSON.stringify(selectedResult).includes(repository), false);
  const missingPrivatePath = join(fixture.directory, "private-name-that-must-not-leak");
  const rejected = await app.request("/api/project/source", {
    method: "POST",
    headers: { "content-type": "application/json", "x-ub-session-token": "source-token" },
    body: JSON.stringify({
      actionId: "http-invalid-local-source",
      expectedRevision: selectedResult.project.revision,
      kind: "LOCAL_REPOSITORY",
      path: missingPrivatePath,
    }),
  });
  assert.equal(rejected.status, 400);
  assert.equal((await rejected.text()).includes(missingPrivatePath), false);
  const publicProject = await (await app.request("/api/project", { headers: { "x-ub-session-token": "source-token" } })).json();
  assert.equal(publicProject.workspace, undefined);
  assert.equal(publicProject.source.workspacePath, undefined);
  assert.equal(JSON.stringify(publicProject).includes(repository), false);
});

async function oracleFixture(replies: object[]) {
  const source = await sourceFixture();
  const selected = await source.sources.select("select-source", 0, { kind: "NEW_PROJECT", label: "Oracle test" });
  let calls = 0;
  const guide: SpiritGuide = {
    async speak() {
      const reply = replies[calls++] ?? oracleQuestionsReply();
      return { sessionId: `ses_oracle_${calls}`, messageId: null, text: JSON.stringify(reply), cost: 0 };
    },
    async perform() { throw new Error("Maker was not expected."); },
    async inspect() { return "succeeded"; },
  };
  const experience = new ExperienceService(source.workflow, source.store, guide, {
    safeDirectory: source.directory,
    demoWorkspace: source.directory,
    promptRoot: process.cwd(),
  });
  return { ...source, experience, revision: selected.project.revision };
}

async function waitForProject(
  store: AtomicProjectStore,
  predicate: (project: Awaited<ReturnType<WorkflowService["get"]>>) => boolean,
) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const project = (await store.load()).state;
    if (predicate(project)) return project;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Oracle project state did not settle.");
}

test("incomplete intake produces at most three explained questions and survives reload", async () => {
  const fixture = await oracleFixture([oracleQuestionsReply({ intendedUser: "Students", problem: "Lost items are hard to return." })]);
  await fixture.experience.sendMessage("oracle-questions", fixture.revision, "clarify", "Students keep losing umbrellas.");
  const project = await waitForProject(fixture.store, (state) => state.oracleIntake.status === "COLLECTING"
    && state.operations.at(-1)?.status === "SUCCEEDED"
    && state.actions.some((action) => action.id.endsWith(":finish")));
  assert.equal(project.product.status, "NONE");
  assert.ok(project.oracleIntake.unresolvedQuestions.length >= 1 && project.oracleIntake.unresolvedQuestions.length <= 3);
  assert.ok(project.oracleIntake.unresolvedQuestions.every((question) => question.whyItMatters.length > 0));
  assert.equal(project.oracleIntake.intendedUser?.value, "Students");
  const reloaded = (await fixture.store.load()).state;
  assert.equal(reloaded.memory.answers?.find((entry) => entry.field === "intendedUser" && entry.status === "ACTIVE")?.text, "Students");
  await assert.rejects(
    fixture.sources.select("late-source-change", project.revision, { kind: "SAVED_PROJECT" }),
    (error: unknown) => error instanceof ProjectSourceError && error.code === "PROJECT_SOURCE_LOCKED",
  );
});

test("Oracle keeps the complete discovery procedure ahead of the persistence contract", async () => {
  const source = await sourceFixture();
  const selected = await source.sources.select("prompt-source", 0, { kind: "NEW_PROJECT" });
  let observedPrompt = "";
  const experience = new ExperienceService(source.workflow, source.store, {
    async speak(input) {
      observedPrompt = input.prompt;
      return { sessionId: "ses_prompt", messageId: null, text: JSON.stringify(oracleQuestionsReply()), cost: 0 };
    },
    async perform() { throw new Error("not expected"); },
    async inspect() { return "succeeded"; },
  }, { safeDirectory: source.directory, demoWorkspace: source.directory, promptRoot: process.cwd() });
  await experience.sendMessage("oracle-prompt", selected.project.revision, "clarify", "Help me scope this.");
  await waitForProject(source.store, (state) => state.operations.at(-1)?.status === "SUCCEEDED");
  assert.match(observedPrompt, /^# Prompt 0 — Product Discovery/);
  assert.match(observedPrompt, /complete Prompt 0 procedure above active/);
  assert.match(observedPrompt, /Ask no more than two or three high-value questions/);
  assert.ok(observedPrompt.length > 10_000);
});

test("proposal generation distinguishes facts, decisions, and assumptions", async () => {
  const reply = oracleProposalReply();
  const fixture = await oracleFixture([reply]);
  await fixture.experience.sendMessage("oracle-proposal", fixture.revision, "clarify", "Build a focused campus lost-and-found.");
  const project = await waitForProject(fixture.store, (state) => state.product.status === "PROPOSED");
  assert.equal(project.product.structuredProposal?.facts[0], "The project starts without an existing repository.");
  assert.equal(project.product.structuredProposal?.userDecisions[0], "Focus on found-item tracking.");
  assert.deepEqual(project.product.structuredProposal?.assumptions, []);
  assert.ok(project.memory.facts.some((entry) => entry.text.includes("without an existing repository")));
  assert.ok(project.memory.decisions.some((entry) => entry.text.includes("found-item tracking")));
});

test("assumed essential answers require explicit proceed permission", async () => {
  const reply = oracleProposalReply({
    intendedUser: "Campus students",
    assumptions: [{
      id: "assume-user",
      field: "intendedUser",
      statement: "Campus students are the first users.",
      reason: "The user asked to proceed before naming a narrower group.",
    }],
  });
  reply.intake.intendedUser = { value: "Campus students", source: "ASSUMPTION" };

  const denied = await oracleFixture([reply]);
  await denied.experience.sendMessage("oracle-assumption-denied", denied.revision, "clarify", "Proceed now.");
  const failed = await waitForProject(denied.store, (state) => state.operations.at(-1)?.status === "FAILED");
  assert.equal(failed.product.status, "NONE");

  const allowed = await oracleFixture([reply]);
  await allowed.experience.sendMessage("oracle-assumption-allowed", allowed.revision, "clarify", "Proceed with that assumption.", true);
  const proposed = await waitForProject(allowed.store, (state) => state.product.status === "PROPOSED");
  assert.equal(proposed.oracleIntake.intendedUser?.source, "ASSUMPTION");
  assert.equal(proposed.memory.assumptions?.find((entry) => entry.field === "intendedUser" && entry.status === "ACTIVE")?.text, "Campus students are the first users.");

  const completeButAssumed = oracleProposalReply({ assumptions: [{
    id: "assume-user-without-intake",
    field: "intendedUser",
    statement: "Campus students are the first users.",
    reason: "The user asked to proceed.",
  }] });
  const incomplete = { ...completeButAssumed, intake: { ...completeButAssumed.intake, intendedUser: null } };
  const incompleteFixture = await oracleFixture([incomplete]);
  await incompleteFixture.experience.sendMessage(
    "oracle-assumption-not-consolidated",
    incompleteFixture.revision,
    "clarify",
    "Proceed with that assumption.",
    true,
  );
  const incompleteProject = await waitForProject(incompleteFixture.store, (state) => state.operations.at(-1)?.status === "FAILED");
  assert.equal(incompleteProject.product.status, "NONE");
});

test("a corrected answer supersedes earlier answer memory", async () => {
  const first = oracleQuestionsReply({ intendedUser: "Students", problem: "Lost items are hard to return." });
  const second = oracleProposalReply({ intendedUser: "Campus staff" });
  const fixture = await oracleFixture([first, second]);
  await fixture.experience.sendMessage("oracle-first", fixture.revision, "clarify", "Students use it.");
  const collecting = await waitForProject(fixture.store, (state) => state.oracleIntake.status === "COLLECTING"
    && state.operations.at(-1)?.status === "SUCCEEDED"
    && state.actions.some((action) => action.id.endsWith(":finish")));
  await fixture.experience.sendMessage("oracle-correction", collecting.revision, "clarify", "Correction: campus staff are the first users.");
  const corrected = await waitForProject(fixture.store, (state) => state.product.status === "PROPOSED");
  const entries = (corrected.memory.answers ?? []).filter((entry) => entry.field === "intendedUser");
  assert.equal(entries.find((entry) => entry.status === "ACTIVE")?.text, "Campus staff");
  assert.equal(entries.find((entry) => entry.text === "Students")?.status, "SUPERSEDED");
});
