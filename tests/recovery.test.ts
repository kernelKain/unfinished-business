import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AtomicProjectStore, RevisionConflict } from "../src/server/store/atomic-project-store.ts";
import { createProject } from "../src/server/workflow/model.ts";
import { WorkflowService } from "../src/server/workflow/service.ts";
import { reviseSection } from "../src/server/workflow/transitions.ts";

test("persists one idempotent action and rejects conflicting reuse", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ub-store-"));
  const store = new AtomicProjectStore(join(directory, "project.json"));
  await store.initialize(createProject("/workspace"));
  const service = new WorkflowService(store);
  const first = await service.execute("action-1", { content: "v1" }, 0, (project) => reviseSection(project, "control", "v1"));
  assert.equal(first.project.revision, 1);
  const duplicate = await service.execute("action-1", { content: "v1" }, 0, (project) => project);
  assert.equal(duplicate.duplicate, true);
  await assert.rejects(
    service.execute("action-1", { content: "different" }, 1, (project) => project),
    RevisionConflict,
  );
});

test("offers previous snapshot without overwriting corrupt current data", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ub-recovery-"));
  const path = join(directory, "project.json");
  const store = new AtomicProjectStore(path);
  await store.initialize(createProject("/workspace"));
  await store.save(0, reviseSection((await store.load()).state, "control", "v1"));
  await writeFile(path, "{corrupt", "utf8");
  const recovered = await store.load();
  assert.equal(recovered.source, "previous");
  assert.equal(recovered.corruptPath, path);
  assert.equal(await readFile(path, "utf8"), "{corrupt");
});
