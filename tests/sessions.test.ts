import assert from "node:assert/strict";
import test from "node:test";
import type { ConnectionService } from "../src/server/opencode/connection.ts";
import {
  SessionActionsService,
  SessionActionError,
  type SessionClientLike,
} from "../src/server/opencode/sessions.ts";
import { createProject } from "../src/server/workflow/model.ts";

function project() {
  const created = createProject("/workspace");
  created.nativeSessions = [
    { role: "oracle", sessionId: "ses_oracle" },
    { role: "maker", sessionId: "ses_maker" },
  ];
  return created;
}

function fakeClient(overrides: Partial<SessionClientLike["session"]> = {}): SessionClientLike {
  return {
    session: {
      get: async ({ sessionID }) => ({
        id: sessionID,
        title: `Session ${sessionID}`,
        model: { providerID: "opencode", id: "flint-40b-free", variant: "default" },
        cost: sessionID === "ses_maker" ? 0.25 : 0,
        tokens: { input: 100, output: 20, reasoning: 5, cache: { read: 10, write: 2 } },
        outcome: "succeeded",
        time: { created: 1, updated: sessionID === "ses_maker" ? 3 : 2, idle: 2 },
      }),
      interrupt: async () => ({ interrupted: true }),
      fork: async ({ sessionID }) => ({ id: "ses_fork", title: `Fork of ${sessionID}`, time: { created: 4, updated: 4 } }),
      compact: async () => ({ id: "msg_compact" }),
      revert: {
        stage: async ({ messageID }) => ({ messageID }),
        clear: async () => undefined,
        commit: async () => undefined,
      },
      ...overrides,
    },
    message: {
      list: async () => ({ data: [{ id: "msg_1" }, { id: "msg_2" }] }),
    },
    permission: {
      request: {
        list: async () => ({
          data: [
            { id: "perm_1", sessionID: "ses_maker", action: "edit", resources: ["src/a.ts"] },
            { id: "perm_2", sessionID: "ses_other", action: "shell", resources: ["rm -rf /"] },
          ],
        }),
      },
      reply: async () => undefined,
    },
  };
}

function service(client: SessionClientLike) {
  return new SessionActionsService(
    { client: () => client, status: () => ({ discovery: null }) } as unknown as ConnectionService,
    async () => project(),
  );
}

test("session listing is restricted to project-owned native sessions", async () => {
  const sessions = await service(fakeClient()).list();
  assert.deepEqual(sessions.map((session) => session.id).sort(), ["ses_maker", "ses_oracle"]);
  const maker = sessions.find((session) => session.id === "ses_maker");
  assert.equal(maker?.role, "maker");
  assert.equal(maker?.messageCount, 2);
  assert.equal(maker?.cost, 0.25);
  assert.equal(maker?.tokens.input, 100);
  assert.equal(maker?.model, "opencode/flint-40b-free#default");
});

test("an unrelated session cannot be inspected or interrupted", async () => {
  const actions = service(fakeClient());
  await assert.rejects(actions.resume("ses_other"), (error: unknown) => {
    assert.ok(error instanceof SessionActionError);
    assert.equal(error.code, "SESSION_NOT_AUTHORIZED");
    return true;
  });
  await assert.rejects(actions.interrupt("ses_other"), /not owned by this project/);
});

test("fork, compact, and revert expose OpenCode semantics and errors", async () => {
  const actions = service(fakeClient());
  assert.equal((await actions.fork("ses_maker")).id, "ses_fork");
  assert.deepEqual(await actions.compact("ses_maker"), { queued: true, inboxId: "msg_compact" });
  assert.deepEqual(await actions.revertStage("ses_maker", "msg_2"), { messageID: "msg_2" });

  const empty = service(fakeClient({
    fork: async () => { throw new Error("Cannot fork empty session: ses_maker"); },
  }));
  await assert.rejects(empty.fork("ses_maker"), (error: unknown) => {
    assert.ok(error instanceof SessionActionError);
    assert.equal(error.code, "SESSION_EMPTY");
    return true;
  });
});

test("permission replies are limited to pending requests for project-owned sessions", async () => {
  const actions = service(fakeClient());
  const pending = await actions.pendingPermissions();
  assert.deepEqual(pending.map((request) => request.id), ["perm_1"]);
  await assert.rejects(actions.replyPermission({
    sessionID: "ses_maker",
    requestID: "perm_2",
    decision: "once",
  }), /not pending for this project/);
  await actions.replyPermission({ sessionID: "ses_maker", requestID: "perm_1", decision: "once" });
});

test("usage is only reported from project-owned session values", async () => {
  const usage = await service(fakeClient()).usage();
  assert.equal(usage.supported, true);
  assert.equal(usage.quotaSupported, false);
  assert.equal(usage.totals.cost, 0.25);
  assert.equal(usage.totals.tokens.input, 200);
  assert.equal(usage.sessions.length, 2);
});
