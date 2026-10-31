import {
  sessionSummarySchema,
  sessionUsageSchema,
  type SessionSummary,
  type SessionUsage,
} from "../../shared/opencode.ts";
import type { Project, SpiritRole } from "../workflow/model.ts";
import type { ConnectionService } from "./connection.ts";

interface RawSessionInfo {
  id: string;
  title?: string;
  model?: { providerID: string; id: string; variant?: string };
  cost?: number;
  tokens?: {
    input?: number;
    output?: number;
    reasoning?: number;
    cache?: { read?: number; write?: number };
  };
  outcome?: "succeeded" | "failed" | "interrupted";
  time?: { created?: number; updated?: number; idle?: number };
}

interface RawPermission {
  id: string;
  sessionID: string;
  action: string;
  resources?: string[];
  message?: string;
}

export interface SessionClientLike {
  session: {
    get: (input: { sessionID: string }) => Promise<RawSessionInfo>;
    interrupt: (input: { sessionID: string }) => Promise<{ interrupted: boolean }>;
    fork: (input: { sessionID: string; before?: string }) => Promise<RawSessionInfo>;
    compact: (input: { sessionID: string }) => Promise<{ id?: string }>;
    revert: {
      stage: (input: { sessionID: string; messageID: string; files?: boolean }) => Promise<unknown>;
      clear: (input: { sessionID: string }) => Promise<void>;
      commit: (input: { sessionID: string }) => Promise<void>;
    };
  };
  message: {
    list: (input: { sessionID: string }) => Promise<{ data?: unknown[] } | unknown[]>;
  };
  permission: {
    request: {
      list: () => Promise<{ data: RawPermission[] }>;
    };
    reply: (input: { sessionID: string; requestID: string; decision: "once" | "always" | "reject"; message?: string }) => Promise<void>;
  };
}

export class SessionActionError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function normalizeTokens(tokens: RawSessionInfo["tokens"]) {
  return {
    input: tokens?.input ?? 0,
    output: tokens?.output ?? 0,
    reasoning: tokens?.reasoning ?? 0,
    cacheRead: tokens?.cache?.read ?? 0,
    cacheWrite: tokens?.cache?.write ?? 0,
  };
}

function roleFor(project: Project, sessionId: string): SessionSummary["role"] {
  const role = project.nativeSessions.find((session) => session.sessionId === sessionId)?.role;
  return (role as SpiritRole | undefined) ?? "unknown";
}

function summarize(project: Project, raw: RawSessionInfo, messageCount = 0): SessionSummary {
  return sessionSummarySchema.parse({
    id: raw.id,
    role: roleFor(project, raw.id),
    title: raw.title ?? null,
    model: raw.model ? `${raw.model.providerID}/${raw.model.id}${raw.model.variant ? `#${raw.model.variant}` : ""}` : null,
    cost: raw.cost ?? 0,
    tokens: normalizeTokens(raw.tokens),
    outcome: raw.outcome ?? null,
    idle: raw.time?.idle !== undefined,
    messageCount,
    created: raw.time?.created ?? 0,
    updated: raw.time?.updated ?? 0,
  });
}

/**
 * Session controls are restricted to native sessions already referenced by the
 * active project. A caller cannot enumerate or act on arbitrary OpenCode
 * sessions through this API.
 */
export class SessionActionsService {
  constructor(
    private readonly connection: ConnectionService,
    private readonly project: () => Promise<Project>,
  ) {}

  async list(): Promise<SessionSummary[]> {
    const project = await this.project();
    const ids = this.authorizedIds(project);
    const client = this.connection.client() as unknown as SessionClientLike;
    const summaries: SessionSummary[] = [];
    for (const id of ids) {
      try {
        const raw = await client.session.get({ sessionID: id });
        summaries.push(summarize(project, raw, await this.messageCount(client, id)));
      } catch {
        // A referenced session can disappear after native cleanup. It is
        // omitted rather than fabricated.
      }
    }
    return summaries.sort((left, right) => right.updated - left.updated);
  }

  async resume(sessionId: string): Promise<SessionSummary> {
    const project = await this.project();
    this.assertAuthorized(project, sessionId);
    const client = this.connection.client() as unknown as SessionClientLike;
    try {
      const raw = await client.session.get({ sessionID: sessionId });
      return summarize(project, raw, await this.messageCount(client, sessionId));
    } catch (error) {
      throw this.translate(error, "SESSION_NOT_FOUND", 404);
    }
  }

  async interrupt(sessionId: string): Promise<{ interrupted: boolean }> {
    const project = await this.project();
    this.assertAuthorized(project, sessionId);
    const client = this.connection.client() as unknown as SessionClientLike;
    try {
      const result = await client.session.interrupt({ sessionID: sessionId });
      return { interrupted: Boolean(result.interrupted) };
    } catch (error) {
      throw this.translate(error, "SESSION_INTERRUPT_FAILED", 409);
    }
  }

  async fork(sessionId: string, before?: string): Promise<SessionSummary> {
    const project = await this.project();
    this.assertAuthorized(project, sessionId);
    const client = this.connection.client() as unknown as SessionClientLike;
    try {
      const raw = await client.session.fork({ sessionID: sessionId, ...(before ? { before } : {}) });
      return summarize(project, raw, 0);
    } catch (error) {
      throw this.translate(error, "SESSION_FORK_FAILED", 409);
    }
  }

  async compact(sessionId: string): Promise<{ queued: boolean; inboxId: string | null }> {
    const project = await this.project();
    this.assertAuthorized(project, sessionId);
    const client = this.connection.client() as unknown as SessionClientLike;
    try {
      const result = await client.session.compact({ sessionID: sessionId });
      return { queued: true, inboxId: typeof result?.id === "string" ? result.id : null };
    } catch (error) {
      throw this.translate(error, "SESSION_COMPACT_FAILED", 409);
    }
  }

  async revertStage(sessionId: string, messageID: string, files?: boolean): Promise<unknown> {
    const project = await this.project();
    this.assertAuthorized(project, sessionId);
    const client = this.connection.client() as unknown as SessionClientLike;
    try {
      return await client.session.revert.stage({ sessionID: sessionId, messageID, ...(files === undefined ? {} : { files }) });
    } catch (error) {
      throw this.translate(error, "SESSION_REVERT_FAILED", 409);
    }
  }

  async revertClear(sessionId: string): Promise<void> {
    const project = await this.project();
    this.assertAuthorized(project, sessionId);
    const client = this.connection.client() as unknown as SessionClientLike;
    try {
      await client.session.revert.clear({ sessionID: sessionId });
    } catch (error) {
      throw this.translate(error, "SESSION_REVERT_CLEAR_FAILED", 409);
    }
  }

  async revertCommit(sessionId: string): Promise<void> {
    const project = await this.project();
    this.assertAuthorized(project, sessionId);
    const client = this.connection.client() as unknown as SessionClientLike;
    try {
      await client.session.revert.commit({ sessionID: sessionId });
    } catch (error) {
      throw this.translate(error, "SESSION_REVERT_COMMIT_FAILED", 409);
    }
  }

  async pendingPermissions(): Promise<RawPermission[]> {
    const project = await this.project();
    const client = this.connection.client() as unknown as SessionClientLike;
    const allowed = this.authorizedIds(project);
    try {
      const result = await client.permission.request.list();
      return result.data.filter((request) => allowed.has(request.sessionID));
    } catch (error) {
      throw this.translate(error, "PERMISSION_LIST_FAILED", 503);
    }
  }

  async replyPermission(input: {
    sessionID: string;
    requestID: string;
    decision: "once" | "always" | "reject";
    message?: string;
  }): Promise<void> {
    const project = await this.project();
    this.assertAuthorized(project, input.sessionID);
    const pending = await this.pendingPermissions();
    const request = pending.find((item) => item.id === input.requestID && item.sessionID === input.sessionID);
    if (!request) throw new SessionActionError("That permission request is not pending for this project.", "PERMISSION_NOT_PENDING", 404);
    const client = this.connection.client() as unknown as SessionClientLike;
    try {
      await client.permission.reply({
        sessionID: input.sessionID,
        requestID: input.requestID,
        decision: input.decision,
        ...(input.message ? { message: input.message } : {}),
      });
    } catch (error) {
      throw this.translate(error, "PERMISSION_REPLY_FAILED", 409);
    }
  }

  async usage(): Promise<SessionUsage> {
    const project = await this.project();
    const sessions = await this.list();
    const totals = sessions.reduce((sum, session) => ({
      cost: sum.cost + session.cost,
      tokens: {
        input: sum.tokens.input + session.tokens.input,
        output: sum.tokens.output + session.tokens.output,
        reasoning: sum.tokens.reasoning + session.tokens.reasoning,
        cacheRead: sum.tokens.cacheRead + session.tokens.cacheRead,
        cacheWrite: sum.tokens.cacheWrite + session.tokens.cacheWrite,
      },
    }), {
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
    });
    const discovery = this.connection.status().discovery;
    const links = discovery?.usage.links ?? [];
    return sessionUsageSchema.parse({
      supported: sessions.length > 0,
      quotaSupported: false,
      sessions,
      totals,
      links,
      detail: sessions.length > 0
        ? "Totals are the cost and token values reported by OpenCode for this project's sessions. Quota and balance are not exposed by the OpenCode HTTP API."
        : "No project-owned session has reported usage yet.",
    });
  }

  private authorizedIds(project: Project): Set<string> {
    const ids = new Set(project.nativeSessions.map((session) => session.sessionId));
    for (const operation of project.operations) {
      if (operation.nativeSessionId) ids.add(operation.nativeSessionId);
    }
    return ids;
  }

  private assertAuthorized(project: Project, sessionId: string): void {
    if (!this.authorizedIds(project).has(sessionId)) {
      throw new SessionActionError(
        "That session is not owned by this project. Session actions are limited to referenced sessions.",
        "SESSION_NOT_AUTHORIZED",
        403,
      );
    }
  }

  private async messageCount(client: SessionClientLike, sessionId: string): Promise<number> {
    try {
      const result = await client.message.list({ sessionID: sessionId });
      return Array.isArray(result) ? result.length : result.data?.length ?? 0;
    } catch {
      return 0;
    }
  }

  private translate(error: unknown, code: string, status: number): SessionActionError {
    const message = error instanceof Error ? error.message : "The OpenCode session action failed.";
    if (/not found/i.test(message)) return new SessionActionError("The native session or message no longer exists.", "SESSION_NOT_FOUND", 404);
    if (/busy/i.test(message)) return new SessionActionError("The native session is busy. Interrupt or wait before this action.", "SESSION_BUSY", 409);
    if (/empty session/i.test(message)) return new SessionActionError("OpenCode cannot fork an empty session. Run at least one turn first.", "SESSION_EMPTY", 409);
    return new SessionActionError(message, code, status);
  }
}
