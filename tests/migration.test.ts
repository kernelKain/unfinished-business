import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AtomicProjectStore } from "../src/server/store/atomic-project-store.ts";
import {
  createProject,
  LEGACY_FIXED_MODEL_KEY,
  MIGRATION_TIMESTAMP,
  migrateProject,
  operationStatusSchema,
  projectSchema,
} from "../src/server/workflow/model.ts";
import { reviseSection } from "../src/server/workflow/transitions.ts";

function populatedProject() {
  const current = createProject("/workspace", "local", { now: "2026-10-31T10:00:00.000Z" });
  const control = current.sections[0];
  control.content = "Approved legacy control section.";
  control.version = 1;
  control.hash = "legacy-control-hash";
  control.status = "APPROVED";
  current.approvals.push({
    id: "approval-1",
    sectionId: control.id,
    version: control.version,
    hash: control.hash,
    approvedAt: "2026-10-31T10:01:00.000Z",
    staleReason: null,
  });
  current.product = {
    status: "APPROVED",
    proposal: "Preserve this approved proposal.",
    openQuestions: ["Preserve this open question?"],
  };
  current.transcript.push({
    id: "transcript-1",
    spirit: "oracle",
    text: "Preserve this transcript entry.",
    createdAt: "2026-10-31T10:02:00.000Z",
  });
  current.operations.push({
    id: "op-1",
    kind: "maker",
    payloadHash: "hash",
    nativeSessionId: "ses_old",
    nativeMessageId: "msg_old",
    status: "SUCCEEDED",
    result: "old result",
    model: { providerID: "opencode", id: "fixture-model", variant: null },
    agent: "build",
    startedAt: "2026-10-31T10:03:00.000Z",
    finishedAt: "2026-10-31T10:04:00.000Z",
    statusReason: null,
    lastObservedAt: "2026-10-31T10:04:00.000Z",
    appliedAt: "2026-10-31T10:04:00.000Z",
  });
  current.evidence.push({
    id: "ev-1",
    checkId: "CK-06",
    nativeResultReference: "ses_old",
    testedFingerprint: "fingerprint",
    result: "PASS",
    observedAt: "2026-10-31T10:05:00.000Z",
    limitation: null,
    model: { providerID: "opencode", id: "fixture-model", variant: null },
  });
  current.nativeSessions.push({ role: "maker", sessionId: "ses_old" });
  return current;
}

function legacyProjectV1() {
  const current = populatedProject();
  return {
    schemaVersion: 1,
    id: current.id,
    revision: current.revision,
    workspace: current.workspace,
    stage: current.stage,
    currentSectionId: current.currentSectionId,
    sections: current.sections.map(({ candidateRevisions: _candidateRevisions, ...section }) => section),
    approvals: current.approvals,
    actions: current.actions.map(({ createdAt: _createdAt, ...action }) => action),
    operations: current.operations.map(({ model: _model, agent: _agent, startedAt: _startedAt, finishedAt: _finishedAt, statusReason: _statusReason, lastObservedAt: _lastObservedAt, appliedAt: _appliedAt, ...operation }) => operation),
    evidence: current.evidence.map(({ model: _model, ...evidence }) => evidence),
    nextAction: current.nextAction,
    product: current.product,
    makerScope: current.makerScope,
    transcript: current.transcript,
    capabilities: current.capabilities,
    witnessDrafts: current.witnessDrafts.map(({ createdAt: _createdAt, ...draft }) => draft),
    nativeSessions: current.nativeSessions,
  };
}

function legacyProjectV2() {
  const current = populatedProject();
  current.engine = {
    model: { providerID: "opencode", id: "selected-model", variant: "low" },
    source: "user",
    updatedAt: "2026-10-31T10:06:00.000Z",
    legacyModel: null,
  };
  return {
    schemaVersion: 2,
    id: current.id,
    revision: current.revision,
    mode: current.mode,
    demoWorkspace: current.demoWorkspace,
    createdAt: current.createdAt,
    updatedAt: current.updatedAt,
    engine: current.engine,
    workspace: current.workspace,
    stage: current.stage,
    currentSectionId: current.currentSectionId,
    sections: current.sections.map(({ candidateRevisions: _candidateRevisions, ...section }) => section),
    approvals: current.approvals,
    actions: current.actions,
    operations: current.operations.map(({ statusReason: _statusReason, lastObservedAt: _lastObservedAt, appliedAt: _appliedAt, ...operation }) => operation),
    evidence: current.evidence,
    nextAction: current.nextAction,
    product: current.product,
    makerScope: current.makerScope,
    transcript: current.transcript,
    capabilities: current.capabilities,
    witnessDrafts: current.witnessDrafts,
    nativeSessions: current.nativeSessions,
  };
}

test("v1 fixed-model projects migrate to v3 without losing workflow history", () => {
  const migrated = migrateProject(legacyProjectV1()).project;
  assert.equal(migrated.schemaVersion, 3);
  assert.equal(migrated.createdAt, MIGRATION_TIMESTAMP);
  assert.equal(migrated.engine.model, null);
  assert.equal(migrated.engine.source, "migrated-legacy");
  assert.equal(migrated.engine.legacyModel, LEGACY_FIXED_MODEL_KEY);
  assert.equal(migrated.product.proposal, "Preserve this approved proposal.");
  assert.equal(migrated.sections[0].content, "Approved legacy control section.");
  assert.equal(migrated.sections[0].status, "APPROVED");
  assert.equal(migrated.approvals[0].id, "approval-1");
  assert.equal(migrated.transcript[0].id, "transcript-1");
  assert.equal(migrated.operations[0].id, "op-1");
  assert.equal(migrated.operations[0].model, null);
  assert.equal(migrated.evidence[0].checkId, "CK-06");
  assert.equal(migrated.evidence[0].model, null);
  assert.equal(migrated.nativeSessions[0].sessionId, "ses_old");
});

test("v2 projects preserve proposals, approvals, evidence, operations, and selected model", () => {
  const legacy = legacyProjectV2();
  const migrated = migrateProject(legacy).project;
  assert.equal(migrated.schemaVersion, 3);
  assert.deepEqual(migrated.product, legacy.product);
  assert.deepEqual(migrated.approvals, legacy.approvals);
  assert.equal(migrated.sections[0].content, legacy.sections[0].content);
  assert.deepEqual(migrated.transcript, legacy.transcript);
  assert.equal(migrated.operations[0].result, legacy.operations[0].result);
  assert.equal(migrated.evidence[0].testedFingerprint, legacy.evidence[0].testedFingerprint);
  assert.deepEqual(migrated.engine.model, legacy.engine.model);
});

test("v2 UNKNOWN operations migrate to ABANDONED without losing native references", () => {
  const legacy = legacyProjectV2();
  (legacy.operations[0] as { status: string }).status = "UNKNOWN";
  legacy.operations[0].finishedAt = null;
  const operation = migrateProject(legacy).project.operations[0];
  assert.equal(operation.status, "ABANDONED");
  assert.equal(operation.statusReason, "legacy-unknown-outcome");
  assert.equal(operation.nativeSessionId, "ses_old");
  assert.equal(operation.result, "old result");
});

test("migration is deterministic and idempotent", () => {
  const legacy = legacyProjectV2();
  const first = migrateProject(legacy);
  const second = migrateProject(structuredClone(legacy));
  assert.deepEqual(first.project, second.project);

  const repeated = migrateProject(first.project);
  assert.equal(repeated.migrated, false);
  assert.equal(repeated.fromVersion, 3);
  assert.deepEqual(repeated.project, first.project);
});

test("loading and saving a migrated project persists schema v3", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ub-migration-"));
  const path = join(directory, "project.json");
  await writeFile(path, JSON.stringify(legacyProjectV1()), "utf8");
  const store = new AtomicProjectStore(path);
  const loaded = await store.load();
  assert.equal(loaded.state.schemaVersion, 3);
  const revised = reviseSection(loaded.state, "control", "migrated scope");
  await store.save(loaded.state.revision, revised);
  const persisted = JSON.parse(await readFile(path, "utf8"));
  assert.equal(persisted.schemaVersion, 3);
  assert.equal(persisted.engine.legacyModel, LEGACY_FIXED_MODEL_KEY);
  assert.equal(projectSchema.parse(persisted).schemaVersion, 3);
});

test("new v3 projects serialize all additive foundations", () => {
  const project = createProject("/workspace", "local", { now: "2026-11-01T00:00:00.000Z" });
  project.source = { kind: "import", label: "Fixture import", externalId: "fixture-1", importedAt: "2026-11-01T00:00:01.000Z" };
  project.oracleIntake = {
    status: "COLLECTING",
    summary: "A structured fixture idea.",
    questions: [{ prompt: "Who is this for?", answer: "A test builder." }],
    constraints: ["No network."],
    successCriteria: ["Round-trip without drift."],
    updatedAt: "2026-11-01T00:00:02.000Z",
  };
  project.memory.facts.push({
    id: "memory-1",
    text: "The fixture is synthetic.",
    source: "system",
    sourceId: null,
    createdAt: "2026-11-01T00:00:03.000Z",
  });
  project.sections[0].candidateRevisions.push({
    id: "candidate-1",
    version: 1,
    content: "Candidate content.",
    hash: "candidate-hash",
    status: "PENDING",
    sourceOperationId: null,
    createdAt: "2026-11-01T00:00:04.000Z",
  });
  project.modelPreferences.access.dataPolicy = "NO_TRAINING_REQUIRED";
  project.modelPreferences.budget.maxCostUsd = 1;
  const serialized = JSON.stringify(project);
  const roundTripped = projectSchema.parse(JSON.parse(serialized));
  assert.deepEqual(roundTripped, project);
  assert.equal(roundTripped.schemaVersion, 3);
  assert.equal(roundTripped.source.kind, "import");
  assert.equal(roundTripped.oracleIntake.status, "COLLECTING");
  assert.equal(roundTripped.memory.facts[0].id, "memory-1");
  assert.equal(roundTripped.sections[0].candidateRevisions[0].id, "candidate-1");
  assert.equal(roundTripped.modelPreferences.access.requireFreeOrLocal, true);
  assert.equal(roundTripped.modelPreferences.budget.maxCostUsd, 1);
});

test("operation states expose the complete Phase 0 state model", () => {
  assert.deepEqual(operationStatusSchema.options, [
    "QUEUED",
    "RUNNING",
    "WAITING_PERMISSION",
    "COMPLETED_UNAPPLIED",
    "SUCCEEDED",
    "FAILED",
    "CANCELLED",
    "ABANDONED",
  ]);
});

test("accepts both historical v2 variants with deterministic defaults", () => {
  const hardening = legacyProjectV2();
  delete (hardening as Partial<typeof hardening>).engine;
  const hardeningMigrated = migrateProject(hardening).project;
  assert.equal(hardeningMigrated.engine.source, "none");

  const guided = legacyProjectV2();
  delete (guided as Partial<typeof guided>).mode;
  delete (guided as Partial<typeof guided>).createdAt;
  delete (guided as Partial<typeof guided>).updatedAt;
  const guidedMigrated = migrateProject(guided).project;
  assert.equal(guidedMigrated.mode, "local");
  assert.equal(guidedMigrated.createdAt, MIGRATION_TIMESTAMP);
  assert.equal(guidedMigrated.updatedAt, MIGRATION_TIMESTAMP);
});

test("unsupported project schema versions fail visibly", () => {
  assert.throws(() => migrateProject({ schemaVersion: 99 }), /newer than this build/);
  assert.throws(() => migrateProject(null), /JSON object/);
});
