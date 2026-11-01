import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp, type HttpSecurityOptions } from "../src/server/app.ts";
import type { SpiritGuide } from "../src/server/experience/guide.ts";
import { ExperienceService } from "../src/server/experience/service.ts";
import { AtomicProjectStore } from "../src/server/store/atomic-project-store.ts";
import type { LimitsConfig } from "../src/server/config.ts";
import { createProject } from "../src/server/workflow/model.ts";
import { WorkflowService } from "../src/server/workflow/service.ts";
import { confirmNewProjectSource, oracleProposalReply } from "./fixtures/oracle-replies.ts";

const token = "test-session-token";
const jsonHeaders = { "content-type": "application/json", "x-ub-session-token": token };

const baseLimits: LimitsConfig = {
  maxRequestBytes: 64 * 1024,
  rateLimitPerMinute: 1_000,
  maxConcurrentMutations: 2,
  maxSseConnections: 2,
  guideTimeoutMs: 30_000,
  makerTimeoutMs: 30_000,
  nodeCheckTimeoutMs: 10_000,
  maxSessionTokens: 200_000,
  maxSessionCostUsd: null,
};

function security(overrides: Partial<LimitsConfig> = {}): HttpSecurityOptions {
  return {
    mode: "local",
    allowedHosts: ["127.0.0.1", "localhost", "::1"],
    allowedOrigins: [],
    trustProxy: false,
    limits: { ...baseLimits, ...overrides },
  };
}

function guide(overrides: Partial<SpiritGuide> = {}): SpiritGuide {
  return {
    async speak() {
      return {
        sessionId: "ses_guide",
        messageId: null,
        text: JSON.stringify(oracleProposalReply()),
        cost: 0,
      };
    },
    async perform() {
      return { sessionId: "ses_maker", messageId: "msg_maker", text: "diff", diff: "modified lost-and-found.mjs (+2/-0)", cost: 0, outcome: "succeeded", timedOut: false };
    },
    async inspect() {
      return "unknown";
    },
    ...overrides,
  };
}

async function fixture(options: {
  guide?: SpiritGuide;
  limits?: Partial<LimitsConfig>;
  access?: { username: string; password: string };
  redactPrompts?: boolean;
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), "ub-http-hardening-"));
  const store = new AtomicProjectStore(join(directory, "project.json"));
  const initial = createProject(directory);
  confirmNewProjectSource(initial);
  await store.initialize(initial);
  const service = new WorkflowService(store);
  const experience = new ExperienceService(service, store, options.guide ?? guide(), {
    safeDirectory: directory,
    demoWorkspace: directory,
    promptRoot: process.cwd(),
    redactPrompts: options.redactPrompts,
  });
  const app = createApp(async () => ({
    available: true,
    serverVersion: "2.0.32",
    versionCompatible: true,
    authenticated: true,
    mode: "local",
    model: "opencode/deepseek-v4.1-flash-free",
    modelAvailable: true,
    limitation: null,
  }), {
    service,
    sessionToken: token,
    experience,
    access: options.access,
    security: security(options.limits),
  });
  return { app, store, service };
}

test("requires the local session token for state and mutation routes", async () => {
  const { app } = await fixture();
  assert.equal((await app.request("/api/project")).status, 403);
  assert.equal((await app.request("/api/project", { headers: { "x-ub-session-token": "wrong" } })).status, 403);
  assert.equal((await app.request("/api/export")).status, 403);
  assert.equal((await app.request("/api/runtime")).status, 403);
  const projectResponse = await app.request("/api/project", { headers: { "x-ub-session-token": token } });
  assert.equal(projectResponse.status, 200);
  assert.equal((await projectResponse.json()).workspace, undefined);
});

test("enforces host, origin, fetch-site, content type, and request size policy", async () => {
  const { app } = await fixture({ limits: { maxRequestBytes: 100 } });
  assert.equal((await app.request("/api/project", {
    headers: { "x-ub-session-token": token, host: "evil.example" },
  })).status, 421);

  assert.equal((await app.request("/api/project", {
    headers: { "x-ub-session-token": token, origin: "https://evil.example" },
  })).status, 403);

  assert.equal((await app.request("/api/sections/control/revisions", {
    method: "POST",
    headers: { ...jsonHeaders, "sec-fetch-site": "cross-site" },
    body: JSON.stringify({ actionId: "cross", expectedRevision: 0, content: "scope" }),
  })).status, 403);

  // Opening the deployed URL from another site (dashboard, chat, email) is a
  // cross-site top-level navigation and must still render the app shell.
  const shellNavigation = await app.request("/", {
    headers: {
      accept: "text/html",
      "sec-fetch-site": "cross-site",
      "sec-fetch-mode": "navigate",
      "sec-fetch-dest": "document",
    },
  });
  assert.notEqual(shellNavigation.status, 403);

  // The allowance covers the shell only: cross-site API calls and sub-resource
  // loads stay blocked, including API paths opened as a document.
  assert.equal((await app.request("/api/mode", {
    headers: { "sec-fetch-site": "cross-site", "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" },
  })).status, 403);
  assert.equal((await app.request("/api/mode", {
    headers: { "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" },
  })).status, 403);
  assert.equal((await app.request("/", {
    headers: {
      "sec-fetch-site": "cross-site",
      "sec-fetch-mode": "no-cors",
      "sec-fetch-dest": "image",
    },
  })).status, 403);

  assert.equal((await app.request("/api/sections/control/revisions", {
    method: "POST",
    headers: { "x-ub-session-token": token, "content-type": "text/plain" },
    body: "scope",
  })).status, 415);

  assert.equal((await app.request("/api/sections/control/revisions", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ actionId: "large", expectedRevision: 0, content: "x".repeat(500) }),
  })).status, 413);

  const preflight = await app.request("/api/project", {
    method: "OPTIONS",
    headers: { origin: "http://localhost" },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "http://localhost");
  assert.equal((await app.request("/api/project", {
    method: "OPTIONS",
    headers: { origin: "https://evil.example" },
  })).status, 403);
});

test("protects hosted routes with Basic auth and still requires the session token", async () => {
  const { app } = await fixture({ access: { username: "builder", password: "secret" } });
  assert.equal((await app.request("/api/health")).status, 200);
  assert.equal((await app.request("/api/project")).status, 401);
  const authorization = `Basic ${Buffer.from("builder:secret").toString("base64")}`;
  assert.equal((await app.request("/api/project", { headers: { authorization } })).status, 403);
  const session = await app.request("/api/session", { headers: { authorization } });
  assert.equal(session.status, 200);
  assert.deepEqual(await session.json(), { token });
});

/** Waits for the latest queued operation to reach the given status. */
async function waitForOperation(
  store: AtomicProjectStore,
  status: "SUCCEEDED" | "FAILED",
  options: { timeout?: number } = {},
): Promise<void> {
  const deadline = Date.now() + (options.timeout ?? 5_000);
  while (Date.now() < deadline) {
    const state = (await store.load()).state;
    if (state.operations.at(-1)?.status === status) return;
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  throw new Error(`Operation did not reach ${status} in time.`);
}

test("returns understandable rate, concurrency, and duplicate responses", async () => {  const { app } = await fixture({ limits: { rateLimitPerMinute: 2 } });
  assert.equal((await app.request("/api/project", { headers: { "x-ub-session-token": token } })).status, 200);
  assert.equal((await app.request("/api/project", { headers: { "x-ub-session-token": token } })).status, 200);
  const limited = await app.request("/api/project", { headers: { "x-ub-session-token": token } });
  assert.equal(limited.status, 429);
  assert.match((await limited.json()).code, /RATE_LIMITED/);

  let release!: () => void;
  let started!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  const speaking = new Promise<void>((resolve) => { started = resolve; });
  const slowGuide = guide({
    async speak() {
      started();
      await blocked;
      return {
        sessionId: "ses_slow",
        messageId: null,
        text: JSON.stringify(oracleProposalReply({ summary: "A board." })),
        cost: 0,
      };
    },
  });
  const { app: concurrent } = await fixture({ guide: slowGuide, limits: { maxConcurrentMutations: 1 } });
  // The question adapter stays synchronous, so it occupies the mutation gate
  // exactly like a long native call; stage runs are queued asynchronously.
  const first = concurrent.request("/api/messages", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ actionId: "first", expectedRevision: 0, intent: "question", text: "Idea one." }),
  });
  await speaking;
  const second = await concurrent.request("/api/messages", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ actionId: "second", expectedRevision: 0, intent: "question", text: "Idea two." }),
  });
  assert.equal(second.status, 429);
  assert.equal((await second.json()).code, "TOO_MANY_CONCURRENT");
  release();
  assert.equal((await first).status, 200);

  const { app: duplicateApp } = await fixture();
  const body = { actionId: "same", expectedRevision: 0, intent: "clarify", text: "Idea." };
  const one = await duplicateApp.request("/api/messages", { method: "POST", headers: jsonHeaders, body: JSON.stringify(body) });
  assert.equal(one.status, 202);
  const two = await duplicateApp.request("/api/messages", { method: "POST", headers: jsonHeaders, body: JSON.stringify(body) });
  assert.equal(two.status, 200);
  assert.equal((await two.json()).duplicate, true);
});

test("authorizes and bounds the event stream", async () => {
  const { app } = await fixture({ limits: { maxSseConnections: 1 } });
  assert.equal((await app.request("/api/events")).status, 403);
  const stream = await app.request("/api/events", { headers: { "x-ub-session-token": token } });
  assert.equal(stream.status, 200);
  assert.match(stream.headers.get("content-type") ?? "", /text\/event-stream/);
  const reader = stream.body!.getReader();
  const chunk = await Promise.race([
    reader.read(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("event stream did not start")), 2_000)),
  ]);
  assert.ok(chunk.value && Buffer.from(chunk.value).toString("utf8").includes("event: snapshot"));
  await reader.cancel();

  const second = await app.request("/api/events", { headers: { "x-ub-session-token": token } });
  assert.equal(second.status, 200);
  await second.body?.cancel();
});

test("does not leak another project's operation and rejects invalid identifiers", async () => {
  const { app, service } = await fixture();
  const unknownId = randomUUID();
  const cross = await app.request(`/api/runs/${unknownId}/reconcile`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ actionId: "cross-run", expectedRevision: 0 }),
  });
  assert.equal(cross.status, 409);
  assert.equal((await cross.json()).code, "NOTHING_TO_RECONCILE");

  const invalid = await app.request("/api/runs/not-a-uuid/reconcile", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ actionId: "invalid-id", expectedRevision: 0 }),
  });
  assert.equal(invalid.status, 400);
  assert.equal((await service.get()).operations.length, 0);
});

test("redacts secrets from errors, persisted project state, and exports", async () => {
  const secret = "OPENCODE_PASSWORD=hunter2";
  const secretGuide = guide({
    async speak() {
      return {
        sessionId: "ses_secret",
        messageId: null,
        text: JSON.stringify(oracleProposalReply({
          summary: `A board for person@example.com with ${secret}`,
          problem: `A ${secret}`,
          questions: [{ id: "secret", field: "unresolvedQuestions", prompt: `Should we keep ${secret}?`, whyItMatters: "Trust matters.", suggestedChoices: [] }],
        })),
        cost: 0,
      };
    },
  });
  const { app, store } = await fixture({ guide: secretGuide });
  const clarify = await app.request("/api/messages", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ actionId: "secret", expectedRevision: 0, intent: "clarify", text: "Idea." }),
  });
  assert.equal(clarify.status, 202);
  const clarified = await clarify.json();
  assert.equal(JSON.stringify(clarified).includes("hunter2"), false);
  await waitForOperation(store, "SUCCEEDED");
  const projectResponse = await app.request("/api/project", { headers: { "x-ub-session-token": token } });
  assert.equal(JSON.stringify(await projectResponse.json()).includes("hunter2"), false);

  const project = (await store.load()).state;
  project.witnessDrafts.push({
    id: randomUUID(),
    title: "Findings",
    content: `Bearer supersecret and ${secret}`,
    nativeSessionId: null,
    createdAt: new Date().toISOString(),
  });
  // Background writes may still be settling; retry the confined append briefly.
  let saved = false;
  for (let attempt = 0; attempt < 10 && !saved; attempt += 1) {
    const current = (await store.load()).state;
    try {
      const next = structuredClone(current);
      next.witnessDrafts.push({
        id: randomUUID(),
        title: "Findings",
        content: `Bearer supersecret and ${secret}`,
        nativeSessionId: null,
        createdAt: new Date().toISOString(),
      });
      await store.save(current.revision, next);
      saved = true;
    } catch (error) {
      if (attempt === 9) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  const exported = await app.request("/api/export", { headers: { "x-ub-session-token": token } });
  const exportBody = await exported.json();
  assert.equal(JSON.stringify(exportBody).includes("hunter2"), false);
  assert.equal(JSON.stringify(exportBody).includes("supersecret"), false);
});

test("UB_REDACT_PROMPTS-style transcript privacy keeps the product usable", async () => {
  const { app, store } = await fixture({ redactPrompts: true });
  const response = await app.request("/api/messages", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ actionId: "private-prompt", expectedRevision: 0, intent: "clarify", text: "a private prompt" }),
  });
  assert.equal(response.status, 202);
  await waitForOperation(store, "SUCCEEDED");
  const state = (await store.load()).state;
  const userEntry = state.transcript.find((entry) => entry.spirit === "user");
  assert.equal(userEntry?.text, "[REDACTED_PROMPT]");
  assert.match(state.product.proposal ?? "", /Track found items/);
});

test("returns a redacted operational error without repeating a native side effect", async () => {
  const failing = guide({
    async speak() {
      throw new Error("Authorization: Bearer supersecret");
    },
  });
  const { app, store } = await fixture({ guide: failing });
  const response = await app.request("/api/messages", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ actionId: "fail", expectedRevision: 0, intent: "clarify", text: "Idea." }),
  });
  assert.equal(response.status, 202);
  assert.equal(JSON.stringify(await response.json()).includes("supersecret"), false);
  await waitForOperation(store, "FAILED", { timeout: 5_000 });
  const project = await (await app.request("/api/project", { headers: { "x-ub-session-token": token } })).json();
  assert.equal(project.operations[0].status, "FAILED");
  assert.equal(JSON.stringify(project).includes("supersecret"), false);
});
