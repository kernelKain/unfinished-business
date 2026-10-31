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
import { providerErrorSchema } from "../src/shared/workflow.ts";
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
    providerError: null,
    intent: "maker-run",
    sectionId: null,
    startingRevision: 0,
    idempotencyKey: "legacy-action-1",
    expectedOutput: "MAKER_DIFF",
    retryOf: null,
    progress: null,
    oracleProceedWithAssumptions: false,
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
    operations: current.operations.map(({ model: _model, agent: _agent, startedAt: _startedAt, finishedAt: _finishedAt, statusReason: _statusReason, lastObservedAt: _lastObservedAt, appliedAt: _appliedAt, intent: _intent, sectionId: _sectionId, startingRevision: _startingRevision, idempotencyKey: _idempotencyKey, expectedOutput: _expectedOutput, retryOf: _retryOf, progress: _progress, ...operation }) => operation),
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
    operations: current.operations.map(({ statusReason: _statusReason, lastObservedAt: _lastObservedAt, appliedAt: _appliedAt, intent: _intent, sectionId: _sectionId, startingRevision: _startingRevision, idempotencyKey: _idempotencyKey, expectedOutput: _expectedOutput, retryOf: _retryOf, progress: _progress, ...operation }) => operation),
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

function legacyProjectV3() {
  const current = populatedProject();
  return {
    ...legacyProjectV5(current),
    schemaVersion: 3,
    operations: current.operations.map(({ providerError: _providerError, progress: _progress, oracleProceedWithAssumptions: _oracleProceed, ...operation }) => operation),
    modelPreferences: {
      access: {
        requireFreeOrLocal: true,
        allowedProviders: ["opencode"],
        allowedModels: [{ providerID: "opencode", id: "selected-model", variant: "low" }],
        dataPolicy: "NO_TRAINING_REQUIRED",
      },
      budget: { maxCostUsd: 2.5, maxTotalTokens: 150_000, maxRunDurationMs: 120_000 },
    },
  };
}

function legacyProjectV5(input = populatedProject()) {
  const { structuredProposal: _structuredProposal, ...product } = input.product;
  return {
    ...input,
    schemaVersion: 5,
    product,
    source: { kind: "workspace", label: "Saved fixture", externalId: null, importedAt: null },
    oracleIntake: {
      status: "COLLECTING",
      summary: "Preserved intake summary.",
      questions: [{ prompt: "Preserved question?", answer: null }],
      constraints: ["Preserved constraint."],
      successCriteria: ["Preserved success criterion."],
      updatedAt: "2026-10-31T10:06:00.000Z",
    },
    memory: {
      facts: input.memory.facts.map(({ field: _field, status: _status, supersedesId: _supersedesId, ...entry }) => entry),
      decisions: input.memory.decisions.map(({ field: _field, status: _status, supersedesId: _supersedesId, ...entry }) => entry),
      constraints: input.memory.constraints.map(({ field: _field, status: _status, supersedesId: _supersedesId, ...entry }) => entry),
      risks: input.memory.risks.map(({ field: _field, status: _status, supersedesId: _supersedesId, ...entry }) => entry),
    },
    operations: input.operations.map(({ oracleProceedWithAssumptions: _oracleProceed, ...operation }) => operation),
  };
}

test("v1 fixed-model projects migrate to v7 without losing workflow history", () => {
  const migrated = migrateProject(legacyProjectV1()).project;
  assert.equal(migrated.schemaVersion, 7);
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
  assert.equal(migrated.modelPreferences.access.mode, "FREE_OR_LOCAL_ONLY");
  assert.equal(migrated.modelPreferences.access.paidOrUnknownAcceptedAt, null);
  assert.equal(migrated.operations[0].providerError, null);
});

test("v2 projects preserve proposals, approvals, evidence, operations, and selected model", () => {
  const legacy = legacyProjectV2();
  const migrated = migrateProject(legacy).project;
  assert.equal(migrated.schemaVersion, 7);
  assert.equal(migrated.product.proposal, legacy.product.proposal);
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
  // Old unknown operations stay recoverable through migration: the recovery
  // phase is deterministic and points at reconciliation instead of repeating.
  assert.deepEqual(operation.progress, {
    phase: "AWAITING_RECONCILIATION",
    detail: "Migrated from a legacy record; the native session can still be reconciled.",
    updatedAt: MIGRATION_TIMESTAMP,
  });
});

test("v3 projects migrate to v7 with their access policy, limits, and selected model preserved", () => {
  const legacy = legacyProjectV3();
  legacy.engine = {
    model: { providerID: "acme", id: "paid-model", variant: "high" },
    source: "user",
    updatedAt: "2026-10-31T10:06:00.000Z",
    legacyModel: null,
  };
  legacy.modelPreferences.access.requireFreeOrLocal = false;
  const migrated = migrateProject(legacy);
  assert.equal(migrated.fromVersion, 3);
  assert.equal(migrated.migrated, true);
  assert.equal(migrated.project.schemaVersion, 7);
  assert.deepEqual(migrated.project.engine.model, legacy.engine.model);
  assert.equal(migrated.project.modelPreferences.access.mode, "ALL_ACCESSIBLE");
  assert.equal(migrated.project.modelPreferences.access.dataPolicy, "NO_TRAINING_REQUIRED");
  assert.deepEqual(migrated.project.modelPreferences.access.allowedProviders, ["opencode"]);
  assert.equal(migrated.project.modelPreferences.access.allowedModels[0].id, "selected-model");
  assert.equal(migrated.project.modelPreferences.access.paidOrUnknownAcceptedAt, null);
  assert.equal(migrated.project.modelPreferences.budget.maxCostUsd, 2.5);
  assert.equal(migrated.project.modelPreferences.budget.maxTotalTokens, 150_000);
  assert.equal(migrated.project.operations[0].providerError, null);

  const freeOnly = legacyProjectV3();
  freeOnly.modelPreferences.budget.maxCostUsd = 0;
  const freeMigration = migrateProject(freeOnly).project;
  assert.equal(freeMigration.modelPreferences.access.mode, "FREE_OR_LOCAL_ONLY");
  assert.equal(freeMigration.modelPreferences.budget.maxCostUsd, null);
});

test("v4 projects migrate to v7 with recovery metadata and keep prior run history", () => {
  const legacy = legacyProjectV5();
  legacy.operations[0].status = "ABANDONED";
  legacy.operations[0].appliedAt = null;
  const v4 = {
    ...legacy,
    schemaVersion: 4,
    operations: legacy.operations.map(({ progress: _progress, ...operation }) => operation),
  };
  const migrated = migrateProject(v4);
  assert.equal(migrated.fromVersion, 4);
  assert.equal(migrated.migrated, true);
  assert.equal(migrated.project.schemaVersion, 7);

  // v4 rows that already carry progress are preserved.
  const operation = migrated.project.operations[0];
  assert.equal(operation.intent, "maker-run");
  assert.equal(operation.idempotencyKey, "legacy-action-1");

  const withProgress = legacyProjectV5();
  withProgress.operations[0].status = "ABANDONED";
  withProgress.operations[0].progress = {
    phase: "WAITING_PERMISSION",
    detail: null,
    updatedAt: "2026-10-31T12:00:00.000Z",
  };
  const preserved = migrateProject(withProgress).project.operations[0];
  assert.deepEqual(preserved.progress, {
    phase: "WAITING_PERMISSION",
    detail: null,
    updatedAt: "2026-10-31T12:00:00.000Z",
  });
});

test("migration is deterministic and idempotent", () => {
  const legacy = legacyProjectV2();
  const first = migrateProject(legacy);
  const second = migrateProject(structuredClone(legacy));
  assert.deepEqual(first.project, second.project);

  const repeated = migrateProject(first.project);
  assert.equal(repeated.migrated, false);
  assert.equal(repeated.fromVersion, 7);
  assert.deepEqual(repeated.project, first.project);
});

test("loading and saving a migrated project persists schema v7", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ub-migration-"));
  const path = join(directory, "project.json");
  await writeFile(path, JSON.stringify(legacyProjectV1()), "utf8");
  const store = new AtomicProjectStore(path);
  const loaded = await store.load();
  assert.equal(loaded.state.schemaVersion, 7);
  const revised = reviseSection(loaded.state, "control", "migrated scope");
  await store.save(loaded.state.revision, revised);
  const persisted = JSON.parse(await readFile(path, "utf8"));
  assert.equal(persisted.schemaVersion, 7);
  assert.equal(persisted.engine.legacyModel, LEGACY_FIXED_MODEL_KEY);
  assert.equal(projectSchema.parse(persisted).schemaVersion, 7);
});

test("new v7 projects serialize guided discovery state and default to all accessible models", () => {
  const project = createProject("/workspace", "local", { now: "2026-11-01T00:00:00.000Z" });
  project.source = {
    kind: "REMOTE_REPOSITORY",
    status: "CONFIRMED",
    label: "Fixture import",
    repositoryUrl: "https://github.com/example/fixture.git",
    workspacePath: "/managed/fixture",
    managedWorkspace: true,
    importedAt: "2026-11-01T00:00:01.000Z",
    confirmedAt: "2026-11-01T00:00:01.000Z",
    repositoryCondition: "Imported fixture.",
  };
  project.oracleIntake = {
    status: "COLLECTING",
    intendedUser: { value: "A test builder.", source: "USER", updatedAt: "2026-11-01T00:00:02.000Z" },
    problem: null,
    desiredOutcome: null,
    deadlineEvent: null,
    mustHaveFeatures: null,
    optionalFeatures: null,
    budget: null,
    privacyRequirements: null,
    platforms: null,
    repositoryCondition: { value: "Imported fixture.", source: "SYSTEM", updatedAt: "2026-11-01T00:00:02.000Z" },
    nonGoals: null,
    unresolvedQuestions: [{ id: "user", field: "intendedUser", prompt: "Who is this for?", whyItMatters: "Scope depends on it.", suggestedChoices: [] }],
    assumptions: [],
    knownConstraints: ["No network."],
    unresolvedRisks: [],
    recommendedNextAction: "Answer the open question.",
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
    baseVersion: 0,
    baseHash: "",
    summary: "Candidate summary.",
    requestedChange: "Add the missing detail.",
    decidedAt: null,
  });
  project.modelPreferences.access.dataPolicy = "NO_TRAINING_REQUIRED";
  project.modelPreferences.budget.maxCostUsd = 1;
  const serialized = JSON.stringify(project);
  const roundTripped = projectSchema.parse(JSON.parse(serialized));
  assert.deepEqual(roundTripped, project);
  assert.equal(roundTripped.schemaVersion, 7);
  assert.equal(roundTripped.source.kind, "REMOTE_REPOSITORY");
  assert.equal(roundTripped.oracleIntake.status, "COLLECTING");
  assert.equal(roundTripped.memory.facts[0].id, "memory-1");
  assert.equal(roundTripped.sections[0].candidateRevisions[0].id, "candidate-1");
  assert.equal(roundTripped.modelPreferences.access.mode, "ALL_ACCESSIBLE");
  assert.equal(roundTripped.modelPreferences.access.paidOrUnknownAcceptedAt, null);
  assert.equal(roundTripped.modelPreferences.budget.maxCostUsd, 1);
});

test("provider errors round-trip on v7 operations without losing their safe references", () => {
  const project = populatedProject();
  project.operations[0].providerError = providerErrorSchema.parse({
    category: "PROVIDER_RATE_LIMIT",
    whatHappened: "The provider is temporarily limiting request volume.",
    savedWorkChanged: "possibly",
    savedWorkMessage: "The saved workshop plan was not replaced, but the native session may have changed files.",
    repair: "Wait for the limit window, then retry once.",
    action: "retry",
    retryable: true,
    technical: {
      provider: "acme",
      statusCode: 429,
      providerCode: "rate_limit",
      sessionReference: "ses_old",
      diagnosticReference: "provider-fixture-roundtrip",
      safeDetail: "No credentials are present in this safe detail.",
    },
  });
  const roundTripped = projectSchema.parse(JSON.parse(JSON.stringify(project)));
  assert.deepEqual(roundTripped.operations[0].providerError, project.operations[0].providerError);
  const repeated = migrateProject(roundTripped);
  assert.equal(repeated.migrated, false);
  assert.equal(repeated.fromVersion, 7);
});

test("v6 saved projects migrate candidates to explicit review metadata", () => {
  const current = populatedProject();
  const legacy = JSON.parse(JSON.stringify(current)) as {
    schemaVersion: number;
    sections: Array<{ candidateRevisions: Array<Record<string, unknown>> }>;
  };
  legacy.schemaVersion = 6;
  legacy.sections[0].candidateRevisions = [{
    id: "candidate-v6",
    version: 2,
    content: "A preserved v6 candidate.",
    hash: "candidate-v6-hash",
    status: "PENDING",
    sourceOperationId: "op-v6",
    createdAt: "2026-10-31T11:00:00.000Z",
  }];
  const migrated = migrateProject(legacy);
  assert.equal(migrated.fromVersion, 6);
  assert.equal(migrated.migrated, true);
  assert.equal(migrated.project.schemaVersion, 7);
  const candidate = migrated.project.sections[0].candidateRevisions[0];
  assert.equal(candidate.id, "candidate-v6");
  assert.equal(candidate.version, 2);
  assert.equal(candidate.baseVersion, 1);
  assert.equal(candidate.baseHash, "");
  assert.equal(candidate.requestedChange, "");
  assert.equal(candidate.decidedAt, null);
  assert.match(candidate.summary, /Legacy candidate/);

  const repeated = migrateProject(migrated.project);
  assert.equal(repeated.fromVersion, 7);
  assert.equal(repeated.migrated, false);
  assert.deepEqual(repeated.project, migrated.project);
});

test("v5 saved projects migrate explicitly to guided discovery memory", () => {
  const migrated = migrateProject(legacyProjectV5());
  assert.equal(migrated.fromVersion, 5);
  assert.equal(migrated.project.schemaVersion, 7);
  assert.equal(migrated.project.source.kind, "SAVED_PROJECT");
  assert.equal(migrated.project.source.status, "CONFIRMED");
  assert.equal(migrated.project.oracleIntake.desiredOutcome?.value, "Preserved intake summary.");
  assert.equal(migrated.project.oracleIntake.unresolvedQuestions[0]?.prompt, "Preserved question?");
  assert.deepEqual(migrated.project.memory.answers, []);
  assert.deepEqual(migrated.project.memory.assumptions, []);
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
