import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../src/server/app.ts";
import { AtomicProjectStore } from "../src/server/store/atomic-project-store.ts";
import { createProject } from "../src/server/workflow/model.ts";
import { WorkflowService } from "../src/server/workflow/service.ts";

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "ub-http-"));
  const store = new AtomicProjectStore(join(directory, "project.json"));
  await store.initialize(createProject("/workspace"));
  const app = createApp({ service: new WorkflowService(store), sessionToken: "test-token" });
  return app;
}

test("rejects workflow mutation without the local session token", async () => {
  const response = await (await fixture()).request("/api/sections/control/revisions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ actionId: "one", expectedRevision: 0, content: "scope" }),
  });
  assert.equal(response.status, 403);
});

test("protects hosted routes while leaving health checks public", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ub-http-auth-"));
  const store = new AtomicProjectStore(join(directory, "project.json"));
  await store.initialize(createProject("/workspace"));
  const app = createApp({
    service: new WorkflowService(store),
    sessionToken: "test-token",
    access: { username: "builder", password: "secret" },
  });

  assert.equal((await app.request("/api/health")).status, 200);
  assert.equal((await app.request("/api/project")).status, 401);
  const authorization = `Basic ${Buffer.from("builder:secret").toString("base64")}`;
  const session = await app.request("/api/session", { headers: { authorization } });
  assert.equal(session.status, 200);
  assert.deepEqual(await session.json(), { token: "test-token" });
});

test("persists revision and exact approval through validated routes", async () => {
  const app = await fixture();
  const headers = { "content-type": "application/json", "x-ub-session-token": "test-token" };
  const revision = await app.request("/api/sections/control/revisions", {
    method: "POST", headers,
    body: JSON.stringify({ actionId: "revise", expectedRevision: 0, content: "approved scope" }),
  });
  assert.equal(revision.status, 200);
  const revised = await revision.json();
  const section = revised.project.sections[0];
  const approval = await app.request("/api/sections/control/approve", {
    method: "POST", headers,
    body: JSON.stringify({ actionId: "approve", expectedRevision: 1, version: section.version, hash: section.hash }),
  });
  assert.equal(approval.status, 200);
  const approved = await approval.json();
  assert.equal(approved.project.currentSectionId, "architecture");
});
