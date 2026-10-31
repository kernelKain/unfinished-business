import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AtomicProjectStore } from "../src/server/store/atomic-project-store.ts";
import {
  createProject,
  LEGACY_FIXED_MODEL_KEY,
  migrateProject,
  projectSchema,
} from "../src/server/workflow/model.ts";
import { reviseSection } from "../src/server/workflow/transitions.ts";

function legacyProject() {
  const current = createProject("/workspace");
  const { engine: _engine, ...rest } = current;
  return {
    ...rest,
    schemaVersion: 1,
    operations: [{
      id: "op-1",
      kind: "maker",
      payloadHash: "hash",
      nativeSessionId: "ses_old",
      nativeMessageId: "msg_old",
      status: "SUCCEEDED",
      result: "old result",
    }],
    evidence: [{
      id: "ev-1",
      checkId: "CK-06",
      nativeResultReference: "ses_old",
      testedFingerprint: "fingerprint",
      result: "PASS",
      observedAt: "2026-10-31T10:00:00.000Z",
      limitation: null,
    }],
    nativeSessions: [{ role: "maker", sessionId: "ses_old" }],
  };
}

test("v1 fixed-model projects migrate to v2 without losing history", () => {
  const migrated = migrateProject(legacyProject());
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.engine.model, null);
  assert.equal(migrated.engine.source, "migrated-legacy");
  assert.equal(migrated.engine.legacyModel, LEGACY_FIXED_MODEL_KEY);
  assert.equal(migrated.operations[0].id, "op-1");
  assert.equal(migrated.operations[0].model, null);
  assert.equal(migrated.operations[0].status, "SUCCEEDED");
  assert.equal(migrated.evidence[0].checkId, "CK-06");
  assert.equal(migrated.evidence[0].model, null);
  assert.equal(migrated.nativeSessions[0].sessionId, "ses_old");
});

test("loading and saving a migrated project persists schema v2", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ub-migration-"));
  const path = join(directory, "project.json");
  await writeFile(path, JSON.stringify(legacyProject()), "utf8");
  const store = new AtomicProjectStore(path);
  const loaded = await store.load();
  assert.equal(loaded.state.schemaVersion, 2);
  const revised = reviseSection(loaded.state, "control", "migrated scope");
  await store.save(loaded.state.revision, revised);
  const persisted = JSON.parse(await readFile(path, "utf8"));
  assert.equal(persisted.schemaVersion, 2);
  assert.equal(persisted.engine.legacyModel, LEGACY_FIXED_MODEL_KEY);
  assert.equal(projectSchema.parse(persisted).schemaVersion, 2);
});

test("new projects start with no model selection", () => {
  const project = createProject("/workspace");
  assert.equal(project.schemaVersion, 2);
  assert.equal(project.engine.model, null);
  assert.equal(project.engine.source, "none");
  assert.equal(project.engine.legacyModel, null);
});

test("unsupported project schema versions fail visibly", () => {
  assert.throws(() => migrateProject({ schemaVersion: 99 }), /Unsupported project schema/);
  assert.throws(() => migrateProject(null), /not an object/);
});
