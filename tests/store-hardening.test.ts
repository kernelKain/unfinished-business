import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AtomicProjectStore, RevisionConflict, StateError } from "../src/server/store/atomic-project-store.ts";
import { createProject, migrateProject, payloadHash, projectSchema } from "../src/server/workflow/model.ts";
import { WorkflowService } from "../src/server/workflow/service.ts";
import { reviseSection } from "../src/server/workflow/transitions.ts";
import { applyRetention } from "../src/server/workflow/retention.ts";

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "ub-store-hardening-"));
  const path = join(directory, "project.json");
  const store = new AtomicProjectStore(path, { backups: 3, corruptFiles: 3, lockTimeoutMs: 100 });
  await store.initialize(createProject("/workspace"));
  return { directory, path, store };
}

test("preserves the corrupt current file and quarantines it before recovery", async () => {
  const { directory, path, store } = await fixture();
  await store.save(0, reviseSection((await store.load()).state, "control", "v1"));
  await writeFile(path, "{corrupt", "utf8");
  const recovered = await store.load();
  assert.equal(recovered.source, "previous");
  assert.equal(recovered.corruptPath, path);
  assert.ok(recovered.quarantinePath);
  assert.equal(await readFile(path, "utf8"), "{corrupt");
  assert.equal(await readFile(recovered.quarantinePath!, "utf8"), "{corrupt");
  assert.match(recovered.quarantinePath!, /project\.json\.corrupt-/);
  assert.ok((await readdir(directory)).some((name) => name.startsWith("backups")));
});

test("rejects corrupt state when no valid previous snapshot exists without overwriting it", async () => {
  const { directory, path, store } = await fixture();
  await writeFile(path, "{totally broken");
  await writeFile(`${path}.previous`, "{also broken");
  await assert.rejects(store.load(), (error: unknown) => error instanceof StateError && error.code === "STATE_CORRUPT");
  assert.equal(await readFile(path, "utf8"), "{totally broken");
  assert.equal(await readFile(`${path}.previous`, "utf8"), "{also broken");
});

test("refuses a newer schema version and preserves the original", async () => {
  const { path, store } = await fixture();
  await writeFile(path, JSON.stringify({ ...createProject("/workspace"), schemaVersion: 99 }));
  await assert.rejects(store.load(), /newer than this build/i);
  assert.match(await readFile(path, "utf8"), /"schemaVersion":99/);
});

test("migrates a v1 snapshot to the current schema without resetting content", () => {
  const current = createProject("/workspace");
  const legacy = { ...current, schemaVersion: 1, createdAt: undefined, updatedAt: undefined, mode: undefined };
  const migrated = migrateProject(legacy);
  assert.equal(migrated.migrated, true);
  assert.equal(migrated.fromVersion, 1);
  assert.equal(migrated.project.schemaVersion, 5);
  assert.equal(migrated.project.mode, "local");
  assert.equal(migrated.project.demoWorkspace, true);
  assert.equal(projectSchema.parse(migrated.project).revision, current.revision);
});

test("reports lock contention and maps write failures without replacing state", async () => {
  const { path, store } = await fixture();
  await writeFile(`${path}.lock`, "held", { mode: 0o600 });
  await assert.rejects(store.save(0, (await store.load()).state), (error: unknown) => error instanceof StateError && error.code === "STATE_BUSY");
  await writeFile(`${path}.lock`, "", { mode: 0o600 });

  const parentFile = join(await mkdtemp(join(tmpdir(), "ub-disk-")), "not-a-directory");
  await writeFile(parentFile, "file");
  const broken = new AtomicProjectStore(join(parentFile, "project.json"));
  await assert.rejects(
    broken.initialize(createProject("/workspace")),
    (error: unknown) => error instanceof StateError && ["STATE_WRITE_FAILED", "STATE_READ_ONLY"].includes(error.code),
  );

  const readOnlyDirectory = await mkdtemp(join(tmpdir(), "ub-readonly-"));
  const readOnly = new AtomicProjectStore(join(readOnlyDirectory, "project.json"));
  await readOnly.initialize(createProject("/workspace"));
  await chmod(readOnlyDirectory, 0o500);
  try {
    await assert.rejects(
      readOnly.save(0, (await readOnly.load()).state),
      (error: unknown) => error instanceof StateError && ["STATE_WRITE_FAILED", "STATE_READ_ONLY", "STATE_DISK_FULL"].includes(error.code),
    );
  } finally {
    await chmod(readOnlyDirectory, 0o700);
  }
});

test("retains bounded actions, operations, evidence, transcript, and drafts", () => {
  const project = createProject("/workspace");
  for (let index = 0; index < 10; index += 1) {
    project.actions.push({ id: `a-${index}`, payloadHash: payloadHash({ index }), resultRevision: index, createdAt: new Date().toISOString() });
    project.operations.push({ id: `o-${index}`, kind: "guide", payloadHash: "x", nativeSessionId: null, nativeMessageId: null, status: "FAILED", result: "x", model: null, agent: null, startedAt: null, finishedAt: null, statusReason: null, lastObservedAt: null, appliedAt: null, providerError: null, intent: null, sectionId: null, startingRevision: null, idempotencyKey: null, expectedOutput: null, retryOf: null, progress: null });
    project.transcript.push({ id: `t-${index}`, spirit: "system", text: "x", createdAt: new Date().toISOString() });
  }
  const retained = applyRetention(project, {
    actions: 3,
    approvals: 2,
    operations: 2,
    evidence: 2,
    transcript: 4,
    witnessDrafts: 2,
    backups: 1,
    corruptFiles: 1,
    backupMaxAgeDays: 1,
  });
  assert.deepEqual(retained.project.actions.map((item) => item.id), ["a-7", "a-8", "a-9"]);
  assert.deepEqual(retained.project.operations.map((item) => item.id), ["o-8", "o-9"]);
  assert.equal(retained.project.transcript.length, 4);
});

test("aligns runtime mode and demo workspace without changing approvals", async () => {
  const { store } = await fixture();
  const workflow = new WorkflowService(store);
  const result = await workflow.ensureRuntimeMetadata("private-hosted", "/demo-workspace");
  assert.equal(result.updated, true);
  const state = (await store.load()).state;
  assert.equal(state.mode, "private-hosted");
  assert.equal(state.demoWorkspace, true);
  assert.equal(state.workspace, "/demo-workspace");
  assert.equal((await workflow.ensureRuntimeMetadata("private-hosted", "/demo-workspace")).updated, false);
});

test("marks in-flight operations abandoned after restart and never repeats them", async () => {
  const { store } = await fixture();
  const workflow = new WorkflowService(store);
  const project = (await store.load()).state;
  project.operations.push({
    id: "11111111-1111-4111-8111-111111111111",
    kind: "maker",
    payloadHash: "hash",
    nativeSessionId: "ses_restart",
    nativeMessageId: null,
    status: "RUNNING",
    result: null,
    model: null,
    agent: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    statusReason: null,
    lastObservedAt: null,
    appliedAt: null,
    providerError: null,
    intent: null,
    sectionId: null,
    startingRevision: null,
    idempotencyKey: null,
    expectedOutput: null,
    retryOf: null,
    progress: { phase: "CONNECTING", detail: "store fixture", updatedAt: new Date().toISOString() },
  });
  project.operations.push({
    id: "22222222-2222-4222-8222-222222222222",
    kind: "guide",
    payloadHash: "hash",
    nativeSessionId: null,
    nativeMessageId: null,
    status: "WAITING_PERMISSION",
    result: null,
    model: null,
    agent: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    statusReason: null,
    lastObservedAt: null,
    appliedAt: null,
    providerError: null,
    intent: null,
    sectionId: null,
    startingRevision: null,
    idempotencyKey: null,
    expectedOutput: null,
    retryOf: null,
    progress: { phase: "CONNECTING", detail: "store fixture", updatedAt: new Date().toISOString() },
  });
  await store.save(0, project);

  const recovered = await workflow.recoverAfterRestart();
  assert.equal(recovered?.recovered, 2);
  const after = await store.load();
  for (const operation of after.state.operations) {
    assert.equal(operation.status, "ABANDONED");
    assert.match(operation.result ?? "", /restarted|not repeated/i);
  }
  assert.match(after.state.nextAction, /Reconcile/i);
  assert.equal(await workflow.recoverAfterRestart(), null);
});

test("keeps rolling backups bounded and does not overwrite a corrupt current with a backup", async () => {
  const { directory, path, store } = await fixture();
  let project = (await store.load()).state;
  for (let revision = 0; revision < 5; revision += 1) {
    project = await store.save(revision, reviseSection(project, "control", `revision ${revision}`));
  }
  const backups = await readdir(join(directory, "backups"));
  assert.ok(backups.length <= 3, backups.join(", "));
  assert.equal(await readFile(`${path}.previous`, "utf8") !== "", true);
});

test("prunes quarantined corrupt files by the configured count", async () => {
  const { directory, store } = await fixture();
  for (let index = 0; index < 6; index += 1) {
    await writeFile(join(directory, `project.json.corrupt-test-${index}`), "{bad", { mode: 0o600 });
  }
  await store.save(0, (await store.load()).state);
  const corrupt = (await readdir(directory)).filter((name) => name.startsWith("project.json.corrupt-"));
  assert.ok(corrupt.length <= 3, corrupt.join(", "));
});

test("rejects a reused action with a different payload and nested payload hashes are canonical", async () => {
  const { store } = await fixture();
  const workflow = new WorkflowService(store);
  assert.equal(payloadHash({ a: 1, b: { c: 2, d: 3 } }), payloadHash({ b: { d: 3, c: 2 }, a: 1 }));
  const first = await workflow.execute("action", { content: "v1" }, 0, (project) => reviseSection(project, "control", "v1"));
  assert.equal(first.duplicate, false);
  const duplicate = await workflow.execute("action", { content: "v1" }, 0, (project) => project);
  assert.equal(duplicate.duplicate, true);
  await assert.rejects(workflow.execute("action", { content: "v2" }, 1, (project) => project), RevisionConflict);
});
