import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../src/server/app.ts";
import { AtomicProjectStore } from "../src/server/store/atomic-project-store.ts";
import { createProject } from "../src/server/workflow/model.ts";
import { recordMemoryEntry, WorkflowConflict } from "../src/server/workflow/transitions.ts";
import { WorkflowService } from "../src/server/workflow/service.ts";

test("project memory can be added and corrected without touching sections or approvals", () => {
  const project = createProject("/workspace", "local", { now: "2026-11-01T00:00:00.000Z" });
  const originalSection = structuredClone(project.sections[0]);

  const added = recordMemoryEntry(project, {
    kind: "decision",
    text: "Use the bounded Node check.",
    supersedesId: null,
  });
  assert.equal(added.memory.decisions.length, 1);
  assert.equal(added.memory.decisions[0].text, "Use the bounded Node check.");
  assert.equal(added.memory.decisions[0].source, "user");
  assert.equal(added.memory.decisions[0].status, "ACTIVE");
  assert.equal(added.approvals.length, 0);
  assert.deepEqual(added.sections[0], originalSection);

  const corrected = recordMemoryEntry(added, {
    kind: "decision",
    text: "Use the bounded Node check and keep the demo workspace isolated.",
    supersedesId: added.memory.decisions[0].id,
  });
  assert.equal(corrected.memory.decisions.length, 2);
  assert.equal(corrected.memory.decisions[0].status, "SUPERSEDED");
  assert.equal(corrected.memory.decisions[1].status, "ACTIVE");
  assert.equal(corrected.memory.decisions[1].supersedesId, added.memory.decisions[0].id);
  assert.match(corrected.memory.decisions[1].text, /demo workspace isolated/);
  assert.deepEqual(corrected.sections[0], originalSection);
  assert.equal(corrected.approvals.length, 0);

  assert.throws(
    () => recordMemoryEntry(project, { kind: "constraint", text: "No spend.", supersedesId: "missing-entry" }),
    (error: unknown) => error instanceof WorkflowConflict && /no longer exists/.test(error.message),
  );
});

test("the memory route requires the session token and keeps a superseded history", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ub-memory-"));
  const store = new AtomicProjectStore(join(directory, "project.json"));
  await store.initialize(createProject("/workspace"));
  const service = new WorkflowService(store);
  const app = createApp({ service, sessionToken: "test-token" });
  const headers = { "content-type": "application/json", "x-ub-session-token": "test-token" };

  const denied = await app.request("/api/memory", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ actionId: "memory-denied", expectedRevision: 0, kind: "constraint", text: "No cloud." }),
  });
  assert.equal(denied.status, 403);

  const created = await app.request("/api/memory", {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "memory-one", expectedRevision: 0, kind: "constraint", text: "No cloud services." }),
  });
  assert.equal(created.status, 200);
  const first = await created.json();
  assert.equal(first.project.memory.constraints[0].text, "No cloud services.");
  assert.equal(first.project.memory.constraints[0].status, "ACTIVE");

  const corrected = await app.request("/api/memory", {
    method: "POST",
    headers,
    body: JSON.stringify({
      actionId: "memory-two",
      expectedRevision: first.project.revision,
      kind: "constraint",
      text: "No cloud services except an explicitly selected hosted import.",
      supersedesId: first.project.memory.constraints[0].id,
    }),
  });
  assert.equal(corrected.status, 200);
  const second = await corrected.json();
  assert.equal(second.project.memory.constraints.length, 2);
  assert.equal(second.project.memory.constraints[0].status, "SUPERSEDED");
  assert.equal(second.project.memory.constraints[1].status, "ACTIVE");
  assert.equal(second.project.memory.constraints[1].supersedesId, first.project.memory.constraints[0].id);
});
