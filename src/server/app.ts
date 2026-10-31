import { sentry } from "@sentry/hono/node";
import { Hono, type Context } from "hono";
import { basicAuth } from "hono/basic-auth";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import {
  healthSchema,
  nativeEngineStatusSchema,
  runtimeConfigSchema,
  type NativeEngineStatus,
  type RuntimeConfig,
} from "../shared/contracts.ts";
import { demoExport, demoFixture } from "../shared/demo.ts";
import { modeDescriptor, type RuntimeMode } from "../shared/modes.ts";
import type { AppConfig, LimitsConfig } from "./config.ts";
import { isLoopbackHost } from "./config.ts";
import { ExperienceFailure, ExperienceService } from "./experience/service.ts";
import { ConnectionConfigError } from "./opencode/client.ts";
import type { ConnectionService } from "./opencode/connection.ts";
import { SessionActionError, type SessionActionsService } from "./opencode/sessions.ts";
import { RevisionConflict, StateError } from "./store/atomic-project-store.ts";
import { clientKey, ConcurrencyGate, RateLimiter, timingSafeEqual } from "./security/limits.ts";
import { NetworkPolicyError } from "./security/network.ts";
import { ProjectSourceError, ProjectSourceService } from "./project-sources.ts";
import { safePublicError } from "./security/redaction.ts";
import { WorkspacePolicyError } from "./security/workspace.ts";
import { createLogger, requestId, type Logger } from "./observability/logger.ts";
import type { Project } from "./workflow/model.ts";
import { WorkflowService } from "./workflow/service.ts";
import {
  acceptSectionCandidate,
  approveSection,
  recordMemoryEntry,
  rejectSectionCandidate,
  WorkflowConflict,
} from "./workflow/transitions.ts";

export type EngineProbe = () => Promise<unknown>;

const actionIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const sectionIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const operationIdSchema = z.string().uuid();

const actionSchema = z.object({
  actionId: actionIdSchema,
  expectedRevision: z.number().int().nonnegative(),
});
const revisionRequestSchema = actionSchema.extend({ request: z.string().min(1).max(8_000) });
const candidateIdSchema = z.string().min(1).max(128);
const approvalRequestSchema = actionSchema.extend({
  version: z.number().int().positive(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
});
const memoryEditSchema = actionSchema.extend({
  kind: z.enum(["decision", "answer", "assumption", "constraint"]),
  text: z.string().min(1).max(2_000),
  supersedesId: z.string().min(1).max(128).nullable().optional(),
});
const messageSchema = actionSchema.extend({
  intent: z.enum(["clarify", "draft", "question", "witness"]),
  text: z.string().min(1).max(8_000),
  proceedWithAssumptions: z.boolean().optional().default(false),
  sectionId: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/).optional(),
});
const approvalKindSchema = z.discriminatedUnion("kind", [
  actionSchema.extend({ kind: z.literal("product") }),
  actionSchema.extend({ kind: z.literal("maker-scope"), statement: z.string().min(8).max(2_000) }),
]);
const connectionInputSchema = z.object({
  baseUrl: z.string().min(1).max(2_048),
  username: z.string().max(128).optional(),
  password: z.string().max(1_024).optional(),
}).strict();
const modelSelectionSchema = actionSchema.extend({
  providerID: z.string().min(1).max(256),
  id: z.string().min(1).max(512),
  variant: z.string().min(1).max(128).nullable().optional(),
  acceptPaidOrUnknown: z.boolean().optional().default(false),
});
const modelPreferencesRequestSchema = actionSchema.extend({
  accessMode: z.enum(["ALL_ACCESSIBLE", "FREE_OR_LOCAL_ONLY"]),
  dataPolicy: z.enum(["PROVIDER_DEFAULT", "NO_TRAINING_REQUIRED"]),
  maxCostUsd: z.number().positive().max(10_000).nullable(),
});
const projectSourceRequestSchema = z.discriminatedUnion("kind", [
  actionSchema.extend({ kind: z.literal("NEW_PROJECT"), label: z.string().max(500).nullable().optional() }),
  actionSchema.extend({ kind: z.literal("LOCAL_REPOSITORY"), path: z.string().min(1).max(4_096) }),
  actionSchema.extend({ kind: z.literal("REMOTE_REPOSITORY"), url: z.string().min(1).max(2_048) }),
  actionSchema.extend({ kind: z.literal("SAVED_PROJECT") }),
]);
const revertStageSchema = z.object({
  messageID: z.string().min(1).max(256),
  files: z.boolean().optional(),
}).strict();
const permissionReplySchema = z.object({
  sessionID: z.string().min(1).max(256),
  decision: z.enum(["once", "always", "reject"]),
  message: z.string().max(2_000).optional(),
}).strict();

export interface HttpSecurityOptions {
  mode: "local" | "hosted-demo" | "private-hosted";
  allowedHosts: string[];
  allowedOrigins: string[];
  trustProxy: boolean;
  limits: LimitsConfig;
}

export interface WorkflowHttpOptions {
  service: WorkflowService;
  sessionToken: string;
  experience?: ExperienceService;
  sources?: ProjectSourceService;
  connection?: ConnectionService;
  sessions?: SessionActionsService;
  access?: {
    username: string;
    password: string;
  };
  security?: HttpSecurityOptions;
  runtime?: RuntimeConfig;
  logger?: Logger;
  /** Browser-facing policy. Demo mode is read-only and serves the fixture. */
  mode?: RuntimeMode;
}

const defaultLimits: LimitsConfig = {
  maxRequestBytes: 64 * 1024,
  rateLimitPerMinute: 120,
  maxConcurrentMutations: 1,
  maxSseConnections: 4,
  guideTimeoutMs: 90_000,
  makerTimeoutMs: 180_000,
  nodeCheckTimeoutMs: 30_000,
  maxSessionTokens: 200_000,
  maxSessionCostUsd: null,
};

function defaultRuntime(): RuntimeConfig {
  return runtimeConfigSchema.parse({
    mode: "local",
    production: false,
    demoWorkspace: true,
    authRequired: false,
    originProtection: true,
    opencode: { baseUrlKind: "loopback", model: null },
    budgets: {
      guideTimeoutMs: defaultLimits.guideTimeoutMs,
      makerTimeoutMs: defaultLimits.makerTimeoutMs,
      nodeCheckTimeoutMs: defaultLimits.nodeCheckTimeoutMs,
      maxSessionTokens: defaultLimits.maxSessionTokens,
      maxSessionCostUsd: defaultLimits.maxSessionCostUsd,
      toolCallBudget: null,
      toolCallBudgetLimitation: "OpenCode does not expose a reliable per-session tool-call count. Elapsed-time and session token budgets are enforced instead.",
    },
    limits: {
      maxRequestBytes: defaultLimits.maxRequestBytes,
      rateLimitPerMinute: defaultLimits.rateLimitPerMinute,
      maxConcurrentMutations: defaultLimits.maxConcurrentMutations,
      maxSseConnections: defaultLimits.maxSseConnections,
    },
    retention: {
      actions: 500,
      approvals: 200,
      operations: 200,
      evidence: 200,
      transcript: 40,
      witnessDrafts: 10,
      backups: 3,
      corruptFiles: 5,
      backupMaxAgeDays: 30,
    },
  });
}

export function httpSecurityFromConfig(config: AppConfig): HttpSecurityOptions {
  return {
    mode: config.mode,
    allowedHosts: config.allowedHosts,
    allowedOrigins: config.allowedOrigins,
    trustProxy: config.trustProxy,
    limits: config.limits,
  };
}

function hostnameOf(hostHeader: string): string {
  const value = hostHeader.trim().toLowerCase();
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    return end > 0 ? value.slice(1, end) : value;
  }
  return value.split(":")[0];
}

function originMatchesRequest(origin: string, context: Context, security: HttpSecurityOptions): boolean {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (security.allowedOrigins.includes(parsed.origin)) return true;
  const requestUrl = new URL(context.req.url);
  const host = context.req.header("host") ?? requestUrl.host;
  const forwardedProto = security.trustProxy ? context.req.header("x-forwarded-proto")?.split(",")[0]?.trim() : undefined;
  const protocol = forwardedProto ?? requestUrl.protocol.replace(":", "");
  return parsed.protocol === `${protocol}:` && parsed.host.toLowerCase() === host.toLowerCase();
}

/**
 * Two compatible call forms are supported so the hardened server and the
 * guided-interface tests can share one implementation:
 *
 *   createApp({ service, sessionToken, ... })
 *   createApp(probe, { service, sessionToken, ... })
 */
export function createApp(workflow: WorkflowHttpOptions): Hono;
export function createApp(probe: EngineProbe, workflow?: WorkflowHttpOptions): Hono;
export function createApp(first: WorkflowHttpOptions | EngineProbe, second?: WorkflowHttpOptions): Hono {
  const probe: EngineProbe | null = typeof first === "function" ? first : null;
  const workflow = (typeof first === "function" ? second : first) as WorkflowHttpOptions;
  const app = new Hono();
  const security: HttpSecurityOptions = workflow.security ?? {
    mode: "local",
    allowedHosts: ["127.0.0.1", "localhost", "::1"],
    allowedOrigins: [],
    trustProxy: false,
    limits: defaultLimits,
  };
  const runtimeMode: RuntimeMode = workflow.mode ?? (security.mode === "hosted-demo" ? "demo" : security.mode === "private-hosted" ? "private-hosted" : "local");
  const runtime = workflow.runtime ?? defaultRuntime();
  const log = workflow.logger ?? createLogger();
  const rateLimiter = new RateLimiter(security.limits.rateLimitPerMinute);
  const mutationGate = new ConcurrencyGate(security.limits.maxConcurrentMutations);
  const sseGate = new ConcurrencyGate(security.limits.maxSseConnections);
  const isDemo = runtimeMode === "demo";
  const noAuthDemoReadOnly = () => contextJson({
    code: "DEMO_READ_ONLY",
    message: modeDescriptor("demo").unavailableActions.mutations,
    retryable: false,
  }, 403);

  if (process.env.SENTRY_DSN) app.use(sentry(app));
  app.use("*", async (context, next) => {
    const id = requestId();
    context.set("requestId" as never, id as never);
    context.header("x-request-id", id);
    await next();
  });
  app.use("*", secureHeaders({
    strictTransportSecurity: security.mode === "local" ? false : "max-age=15552000; includeSubDomains",
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      baseUri: ["'none'"],
      connectSrc: ["'self'", "https://*.sentry.io", "https://*.ingest.sentry.io"],
      fontSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      workerSrc: ["'self'"],
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: "no-referrer",
    xFrameOptions: "DENY",
  }));
  app.use("*", async (context, next) => {
    const hostHeader = context.req.header("host") ?? new URL(context.req.url).host;
    const host = hostnameOf(hostHeader);
    const allowed = security.allowedHosts.some((entry) => entry === host || entry === hostHeader.toLowerCase());
    if (!hostHeader || !allowed) {
      return context.json({ code: "INVALID_HOST", message: "The request host is not allowed.", retryable: false }, 421);
    }
    if (context.req.method === "OPTIONS") {
      const origin = context.req.header("origin");
      if (origin && !originMatchesRequest(origin, context, security)) {
        return context.json({ code: "INVALID_ORIGIN", message: "Cross-origin requests are not allowed.", retryable: false }, 403);
      }
      context.header("access-control-allow-methods", "GET, POST, OPTIONS");
      context.header("access-control-allow-headers", "content-type, x-ub-session-token");
      context.header("access-control-max-age", "600");
      if (origin) context.header("access-control-allow-origin", origin);
      return context.body(null, 204);
    }
    const origin = context.req.header("origin");
    if (origin && !originMatchesRequest(origin, context, security)) {
      return context.json({ code: "INVALID_ORIGIN", message: "Cross-origin requests are not allowed.", retryable: false }, 403);
    }
    const fetchSite = context.req.header("sec-fetch-site");
    if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
      return context.json({ code: "INVALID_ORIGIN", message: "Cross-site requests are not allowed.", retryable: false }, 403);
    }
    return next();
  });

  if (workflow.access && !isDemo) {
    const authenticate = basicAuth({
      username: workflow.access.username,
      password: workflow.access.password,
      realm: "Unfinished Business",
    });
    app.use("*", async (context, next) => {
      if (context.req.path === "/api/health") return next();
      return authenticate(context, next);
    });
  }

  app.get("/api/health", (context) => {
    context.header("cache-control", "no-store");
    return context.json(healthSchema.parse({
      status: "ok",
      service: "unfinished-business",
    }));
  });
  app.get("/api/mode", (context) => context.json(modeDescriptor(runtimeMode)));

  // The hosted demo is a deterministic, read-only sample. Reject every
  // mutation before a body is parsed or a workflow service is touched.
  app.use("/api/*", async (context, next) => {
    if (!isDemo) return next();
    if (context.req.method === "GET" || context.req.method === "HEAD") return next();
    return noAuthDemoReadOnly();
  });

  app.use("/api/*", async (context, next) => {
    const result = rateLimiter.check(clientKey(context.req.raw.headers, security.trustProxy));
    context.header("x-ratelimit-remaining", String(result.remaining));
    if (!result.allowed) {
      context.header("retry-after", String(result.retryAfterSeconds));
      return context.json({
        code: "RATE_LIMITED",
        message: "Too many requests. Wait briefly, then try again.",
        retryable: true,
        retryAfterSeconds: result.retryAfterSeconds,
      }, 429);
    }
    return next();
  });

  app.use("/api/*", bodyLimit({
    maxSize: security.limits.maxRequestBytes,
    onError: (context) => context.json({
      code: "REQUEST_TOO_LARGE",
      message: `The request body exceeds ${security.limits.maxRequestBytes} bytes.`,
      retryable: false,
    }, 413),
  }));

  app.use("/api/*", async (context, next) => {
    if (context.req.method === "GET" || context.req.method === "HEAD" || context.req.method === "OPTIONS") return next();
    const contentType = context.req.header("content-type") ?? "";
    if (!/^application\/json\b/i.test(contentType)) {
      return context.json({ code: "UNSUPPORTED_MEDIA_TYPE", message: "Mutations require application/json.", retryable: false }, 415);
    }
    return next();
  });

  app.use("/api/*", async (context, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(context.req.method)) return next();
    if (context.req.path === "/api/health") return next();
    const release = mutationGate.tryAcquire();
    if (!release) {
      return context.json({
        code: "TOO_MANY_CONCURRENT",
        message: "Another workshop action is still running. Wait for it to finish.",
        retryable: true,
      }, 429);
    }
    try {
      return await next();
    } finally {
      release();
    }
  });

  app.use("/api/*", async (context, next) => {
    if (isDemo) return next();
    if (context.req.path === "/api/health"
      || context.req.path === "/api/session"
      || context.req.path === "/api/mode") return next();
    const supplied = context.req.header("x-ub-session-token") ?? "";
    if (!timingSafeEqual(supplied, workflow.sessionToken)) {
      return context.json({
        code: "INVALID_SESSION",
        message: "Missing or invalid local browser session token.",
        retryable: false,
      }, 403);
    }
    return next();
  });

  app.get("/api/session", (context) => {
    if (isDemo) return noAuthDemoReadOnly();
    const host = context.req.header("host") ?? new URL(context.req.url).host;
    if (!workflow.access && !isLoopbackHost(hostnameOf(host))) {
      return context.json({ code: "INVALID_ORIGIN", message: "The local session token is only available on loopback.", retryable: false }, 403);
    }
    context.header("cache-control", "no-store");
    return context.json({ token: workflow.sessionToken });
  });

  app.get("/api/runtime", (context) => context.json(runtimeConfigSchema.parse(runtime)));

  app.get("/api/engine", async (context) => {
    if (isDemo) return context.json(demoEngineStatus(), 503);
    if (workflow.connection) {
      const status = await currentConnection(workflow);
      const project = await workflow.service.get();
      return context.json(engineSummary(project, status), status.state === "connected" || status.state === "degraded" ? 200 : 503);
    }
    if (probe) {
      const status = nativeEngineStatusSchema.parse(await probe());
      return context.json(status, status.available ? 200 : 503);
    }
    return context.json({
      code: "CONNECTION_UNAVAILABLE",
      message: "OpenCode connection support is not configured in this process.",
      retryable: false,
    }, 503);
  });

  if (workflow.connection) {
    app.get("/api/connection", async (context) => {
      if (isDemo) return context.json(demoConnectionStatus());
      return context.json(await currentConnection(workflow));
    });

    app.post("/api/connection/check", async (context) => {
      try {
        const input = await optionalConnectionBody(context);
        if (workflow.connection!.managed && (input.baseUrl !== undefined || input.password !== undefined)) {
          return context.json({
            code: "CONNECTION_MANAGED",
            message: "This deployment manages the OpenCode URL and credentials through its environment and secret store.",
            retryable: false,
          }, 409);
        }
        const project = await workflow.service.get();
        const status = await workflow.connection!.check({
          ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
          ...(input.username !== undefined ? { username: input.username } : {}),
          ...(input.password !== undefined ? { password: input.password } : {}),
          selected: project.engine.model,
          accessMode: project.modelPreferences.access.mode,
        });
        return context.json(status);
      } catch (error) {
        return connectionError(context, error);
      }
    });

    app.post("/api/connection/configure", async (context) => {
      try {
        if (workflow.connection!.managed) {
          return context.json({
            code: "CONNECTION_MANAGED",
            message: "This deployment manages the OpenCode URL and credentials through its environment and secret store.",
            retryable: false,
          }, 409);
        }
        const input = connectionInputSchema.parse(await context.req.json());
        return context.json(await workflow.connection!.configure(input));
      } catch (error) {
        return connectionError(context, error);
      }
    });

    app.post("/api/connection/reset", async (context) => {
      try {
        return context.json(await workflow.connection!.reset());
      } catch (error) {
        return connectionError(context, error);
      }
    });

    app.get("/api/opencode/discovery", async (context) => {
      try {
        const project = await workflow.service.get();
        return context.json(await workflow.connection!.discovery({
          selected: project.engine.model,
          accessMode: project.modelPreferences.access.mode,
        }));
      } catch (error) {
        return connectionError(context, error);
      }
    });

    app.post("/api/engine/selection", async (context) => {
      try {
        const input = modelSelectionSchema.parse(await context.req.json());
        const project = await workflow.service.get();
        const discovery = await workflow.connection!.discovery({
          selected: project.engine.model,
          accessMode: project.modelPreferences.access.mode,
        });
        const selected = {
          providerID: input.providerID,
          id: input.id,
          variant: input.variant ?? null,
        };
        const discovered = workflow.connection!.validateSelection(
          discovery,
          selected,
          project.modelPreferences.access.mode,
        );
        const requiresConfirmation = discovered.local !== true && discovered.pricing !== "free";
        if (requiresConfirmation
          && !project.modelPreferences.access.paidOrUnknownAcceptedAt
          && !input.acceptPaidOrUnknown) {
          return context.json({
            code: "MODEL_COST_CONFIRMATION_REQUIRED",
            message: discovered.pricing === "paid"
              ? "This remote model reports paid pricing. Confirm that provider charges may apply before saving it."
              : "This remote model does not report pricing. Confirm that charges may apply and the session limit can only enforce cost OpenCode reports.",
            retryable: false,
          }, 409);
        }
        const result = await workflow.service.execute(input.actionId, {
          providerID: input.providerID,
          id: input.id,
          variant: input.variant ?? null,
          acceptPaidOrUnknown: input.acceptPaidOrUnknown,
        }, input.expectedRevision, (current) => {
          const next = structuredClone(current);
          next.engine = {
            model: selected,
            source: "user",
            updatedAt: new Date().toISOString(),
            legacyModel: current.engine.legacyModel,
          };
          if (requiresConfirmation && !next.modelPreferences.access.paidOrUnknownAcceptedAt) {
            next.modelPreferences.access.paidOrUnknownAcceptedAt = new Date().toISOString();
          }
          return next;
        });
        return context.json(publicProjectResult(result));
      } catch (error) {
        if (error instanceof z.ZodError) return invalidRequest(context, "Invalid model selection.");
        return modelSelectionError(context, error);
      }
    });

    app.post("/api/model-preferences", async (context) => {
      try {
        const input = modelPreferencesRequestSchema.parse(await context.req.json());
        const result = await workflow.service.execute(input.actionId, {
          accessMode: input.accessMode,
          dataPolicy: input.dataPolicy,
          maxCostUsd: input.maxCostUsd,
        }, input.expectedRevision, (current) => {
          const next = structuredClone(current);
          next.modelPreferences.access.mode = input.accessMode;
          next.modelPreferences.access.dataPolicy = input.dataPolicy;
          next.modelPreferences.budget.maxCostUsd = input.maxCostUsd;
          return next;
        });
        return context.json(publicProjectResult(result));
      } catch (error) {
        if (error instanceof z.ZodError) return invalidRequest(context, "Invalid model access or spending preference.");
        return workflowError(context, error, "Invalid model preference update.", log);
      }
    });
  } else if (isDemo) {
    app.get("/api/connection", (context) => context.json(demoConnectionStatus()));
  }

  if (workflow.sessions) {
    app.get("/api/opencode/sessions", async (context) => {
      try {
        return context.json({ sessions: await workflow.sessions!.list() });
      } catch (error) {
        return sessionError(context, error);
      }
    });
    app.get("/api/opencode/sessions/:id", async (context) => {
      try {
        return context.json(await workflow.sessions!.resume(context.req.param("id")));
      } catch (error) {
        return sessionError(context, error);
      }
    });
    app.post("/api/opencode/sessions/:id/interrupt", async (context) => {
      try {
        return context.json(await workflow.sessions!.interrupt(context.req.param("id")));
      } catch (error) {
        return sessionError(context, error);
      }
    });
    app.post("/api/opencode/sessions/:id/fork", async (context) => {
      try {
        const input = await optionalJson(context);
        const parsed = z.object({ before: z.string().min(1).optional() }).strict().parse(input);
        return context.json(await workflow.sessions!.fork(context.req.param("id"), parsed.before));
      } catch (error) {
        if (error instanceof z.ZodError) return invalidRequest(context, "Invalid fork request.");
        return sessionError(context, error);
      }
    });
    app.post("/api/opencode/sessions/:id/compact", async (context) => {
      try {
        return context.json(await workflow.sessions!.compact(context.req.param("id")));
      } catch (error) {
        return sessionError(context, error);
      }
    });
    app.post("/api/opencode/sessions/:id/revert/stage", async (context) => {
      try {
        const input = revertStageSchema.parse(await context.req.json());
        return context.json(await workflow.sessions!.revertStage(context.req.param("id"), input.messageID, input.files));
      } catch (error) {
        if (error instanceof z.ZodError) return invalidRequest(context, "A message boundary is required to stage a revert.");
        return sessionError(context, error);
      }
    });
    app.post("/api/opencode/sessions/:id/revert/clear", async (context) => {
      try {
        await workflow.sessions!.revertClear(context.req.param("id"));
        return context.json({ cleared: true });
      } catch (error) {
        return sessionError(context, error);
      }
    });
    app.post("/api/opencode/sessions/:id/revert/commit", async (context) => {
      try {
        await workflow.sessions!.revertCommit(context.req.param("id"));
        return context.json({ committed: true });
      } catch (error) {
        return sessionError(context, error);
      }
    });
    app.get("/api/opencode/permissions", async (context) => {
      try {
        return context.json({ permissions: await workflow.sessions!.pendingPermissions() });
      } catch (error) {
        return sessionError(context, error);
      }
    });
    app.post("/api/opencode/permissions/:requestId/reply", async (context) => {
      try {
        const input = permissionReplySchema.parse(await context.req.json());
        await workflow.sessions!.replyPermission({
          sessionID: input.sessionID,
          requestID: context.req.param("requestId"),
          decision: input.decision,
          ...(input.message ? { message: input.message } : {}),
        });
        return context.json({ replied: true });
      } catch (error) {
        if (error instanceof z.ZodError) return invalidRequest(context, "Invalid permission reply.");
        return sessionError(context, error);
      }
    });
    app.get("/api/opencode/usage", async (context) => {
      try {
        return context.json(await workflow.sessions!.usage());
      } catch (error) {
        return sessionError(context, error);
      }
    });
  }

  app.get("/api/project", async (context) => {
    const project = isDemo ? demoFixture.project : await workflow.service.get();
    return context.json(publicProjectSnapshot(project));
  });

  app.post("/api/project/source", async (context) => {
    if (!workflow.sources) return unavailable(context);
    try {
      const input = projectSourceRequestSchema.parse(await context.req.json());
      const { actionId, expectedRevision, ...selection } = input;
      return context.json(publicProjectResult(await workflow.sources.select(actionId, expectedRevision, selection)));
    } catch (error) {
      return workflowError(context, error, "Invalid project source.", log);
    }
  });

  app.post("/api/project/source/confirm", async (context) => {
    if (!workflow.sources) return unavailable(context);
    try {
      const input = actionSchema.parse(await context.req.json());
      return context.json(publicProjectResult(await workflow.sources.confirmRemote(input.actionId, input.expectedRevision)));
    } catch (error) {
      return workflowError(context, error, "The managed remote workspace could not be confirmed.", log);
    }
  });

  app.get("/api/events", async (context) => {
    if (isDemo) return noAuthDemoReadOnly();
    const release = sseGate.tryAcquire();
    if (!release) {
      return context.json({
        code: "TOO_MANY_EVENT_STREAMS",
        message: "Too many event streams are open. Close one and try again.",
        retryable: true,
      }, 429);
    }
    let released = false;
    const releaseOnce = () => {
      if (released) return;
      released = true;
      release();
    };
    context.header("cache-control", "no-cache, no-transform");
    context.header("x-accel-buffering", "no");
    return streamSSE(context, async (stream) => {
      stream.onAbort(releaseOnce);
      try {
        let lastRevision = -1;
        while (!stream.aborted) {
          try {
            const project = await workflow.service.get();
            if (project.revision !== lastRevision) {
              lastRevision = project.revision;
              await stream.writeSSE({
                event: "snapshot",
                data: JSON.stringify({
                  revision: project.revision,
                  stage: project.stage,
                  nextAction: project.nextAction,
                  updatedAt: project.updatedAt,
                }),
              });
            }
          } catch {
            await stream.writeSSE({ event: "unavailable", data: JSON.stringify({ retryable: true }) });
          }
          await stream.sleep(5_000);
        }
      } finally {
        releaseOnce();
      }
    });
  });

  if (workflow.experience || isDemo) {
    app.get("/api/export", async (context) => context.json(isDemo ? demoExport : await workflow.experience!.exportApproved()));
  }

  app.post("/api/memory", async (context) => {
    try {
      const input = memoryEditSchema.parse(await context.req.json());
      const result = await workflow.service.execute(
        input.actionId,
        { kind: input.kind, text: input.text, supersedesId: input.supersedesId ?? null },
        input.expectedRevision,
        (project) => recordMemoryEntry(project, {
          kind: input.kind,
          text: input.text,
          supersedesId: input.supersedesId ?? null,
        }),
      );
      return context.json(publicProjectResult(result));
    } catch (error) {
      return workflowError(context, error, "Invalid project-memory update.", log);
    }
  });

  app.post("/api/sections/:id/revisions", async (context) => {
    const id = sectionIdSchema.safeParse(context.req.param("id"));
    if (!id.success) return invalidRequest(context, "Unknown section identifier.");
    if (!workflow.experience) return unavailable(context);
    try {
      const input = revisionRequestSchema.parse(await context.req.json());
      const result = await workflow.experience.sendMessage(
        input.actionId,
        input.expectedRevision,
        "draft",
        input.request,
        false,
        id.data,
      );
      const queued = "accepted" in result ? Boolean(result.accepted) : false;
      return context.json(publicProjectResult(result), queued ? 202 : 200);
    } catch (error) {
      return workflowError(context, error, "Invalid revision request.", log);
    }
  });

  app.post("/api/sections/:id/revisions/:candidateId/accept", async (context) => {
    const id = sectionIdSchema.safeParse(context.req.param("id"));
    const candidateId = candidateIdSchema.safeParse(context.req.param("candidateId"));
    if (!id.success || !candidateId.success) return invalidRequest(context, "Unknown section or candidate identifier.");
    try {
      const input = actionSchema.parse(await context.req.json());
      const result = await workflow.service.execute(
        input.actionId,
        { ...input, candidateId: candidateId.data },
        input.expectedRevision,
        (project) => acceptSectionCandidate(project, id.data, candidateId.data),
      );
      return context.json(publicProjectResult(result));
    } catch (error) {
      return workflowError(context, error, "Invalid candidate acceptance.", log);
    }
  });

  app.post("/api/sections/:id/revisions/:candidateId/reject", async (context) => {
    const id = sectionIdSchema.safeParse(context.req.param("id"));
    const candidateId = candidateIdSchema.safeParse(context.req.param("candidateId"));
    if (!id.success || !candidateId.success) return invalidRequest(context, "Unknown section or candidate identifier.");
    try {
      const input = actionSchema.parse(await context.req.json());
      const result = await workflow.service.execute(
        input.actionId,
        { ...input, candidateId: candidateId.data },
        input.expectedRevision,
        (project) => rejectSectionCandidate(project, id.data, candidateId.data),
      );
      return context.json(publicProjectResult(result));
    } catch (error) {
      return workflowError(context, error, "Invalid candidate rejection.", log);
    }
  });

  app.post("/api/sections/:id/approve", async (context) => {
    const id = sectionIdSchema.safeParse(context.req.param("id"));
    if (!id.success) return invalidRequest(context, "Unknown section identifier.");
    try {
      const input = approvalRequestSchema.parse(await context.req.json());
      const result = await workflow.service.execute(
        input.actionId,
        input,
        input.expectedRevision,
        (project) => approveSection(project, id.data, input.version, input.hash),
      );
      return context.json(publicProjectResult(result));
    } catch (error) {
      return workflowError(context, error, "Invalid approval request.", log);
    }
  });

  app.post("/api/messages", async (context) => {
    if (!workflow.experience) return unavailable(context);
    try {
      const input = messageSchema.parse(await context.req.json());
      const result = await workflow.experience.sendMessage(
        input.actionId,
        input.expectedRevision,
        input.intent,
        input.text,
        input.proceedWithAssumptions,
        input.sectionId ?? null,
      );
      const queued = "accepted" in result ? Boolean(result.accepted) : false;
      return context.json(publicProjectResult(result), queued ? 202 : 200);
    } catch (error) {
      return workflowError(context, error, "Invalid message.", log);
    }
  });

  app.post("/api/approvals", async (context) => {
    if (!workflow.experience) return unavailable(context);
    try {
      const input = approvalKindSchema.parse(await context.req.json());
      const statement = input.kind === "maker-scope" ? input.statement : undefined;
      const result = await workflow.experience.approve(input.actionId, input.expectedRevision, input.kind, statement);
      return context.json(publicProjectResult(result));
    } catch (error) {
      return workflowError(context, error, "Invalid approval.", log);
    }
  });

  app.post("/api/runs", async (context) => {
    if (!workflow.experience) return unavailable(context);
    try {
      const input = actionSchema.parse(await context.req.json());
      const result = await workflow.experience.runMaker(input.actionId, input.expectedRevision);
      const accepted = "accepted" in result ? Boolean(result.accepted) : false;
      return context.json(publicProjectResult(result), accepted ? 202 : 200);
    } catch (error) {
      return workflowError(context, error, "Invalid Maker run.", log);
    }
  });

  app.get("/api/runs/:id", async (context) => {
    if (isDemo) return noAuthDemoReadOnly();
    if (!workflow.experience) return unavailable(context);
    const id = operationIdSchema.safeParse(context.req.param("id"));
    if (!id.success) return invalidRequest(context, "Unknown operation identifier.");
    const project = await workflow.service.get();
    const operation = project.operations.find((item) => item.id === id.data);
    if (!operation) return context.json({ code: "RUN_NOT_FOUND", message: "That run is not in this project." }, 404);
    return context.json({ operation, active: workflow.experience.isRunActive(operation.id) });
  });

  app.post("/api/runs/:id/cancel", async (context) => {
    if (!workflow.experience) return unavailable(context);
    const id = operationIdSchema.safeParse(context.req.param("id"));
    if (!id.success) return invalidRequest(context, "Unknown operation identifier.");
    try {
      const input = actionSchema.parse(await context.req.json());
      const result = await workflow.experience.cancel(input.actionId, input.expectedRevision, id.data);
      return context.json(publicProjectResult(result));
    } catch (error) {
      return workflowError(context, error, "Invalid cancellation.", log);
    }
  });

  app.post("/api/runs/:id/reconcile", async (context) => {
    if (!workflow.experience) return unavailable(context);
    const id = operationIdSchema.safeParse(context.req.param("id"));
    if (!id.success) return invalidRequest(context, "Unknown operation identifier.");
    try {
      const input = actionSchema.parse(await context.req.json());
      const result = await workflow.experience.reconcile(input.actionId, input.expectedRevision, id.data);
      return context.json(publicProjectResult(result));
    } catch (error) {
      return workflowError(context, error, "Invalid reconciliation.", log);
    }
  });

  app.post("/api/runs/:id/retry", async (context) => {
    if (!workflow.experience) return unavailable(context);
    const id = operationIdSchema.safeParse(context.req.param("id"));
    if (!id.success) return invalidRequest(context, "Unknown operation identifier.");
    try {
      const input = actionSchema.parse(await context.req.json());
      const result = await workflow.experience.retryRun(input.actionId, input.expectedRevision, id.data);
      const accepted = "accepted" in result ? Boolean(result.accepted) : false;
      return context.json(publicProjectResult(result), accepted ? 202 : 200);
    } catch (error) {
      return workflowError(context, error, "Invalid retry.", log);
    }
  });

  app.post("/api/runs/:id/abandon", async (context) => {
    if (!workflow.experience) return unavailable(context);
    const id = operationIdSchema.safeParse(context.req.param("id"));
    if (!id.success) return invalidRequest(context, "Unknown operation identifier.");
    try {
      const input = actionSchema.parse(await context.req.json());
      const result = await workflow.experience.abandonRun(input.actionId, input.expectedRevision, id.data);
      return context.json(publicProjectResult(result));
    } catch (error) {
      return workflowError(context, error, "Invalid abandon request.", log);
    }
  });

  app.notFound((context) => {
    if (context.req.path.startsWith("/api/")) {
      return context.json({ code: "NOT_FOUND", message: "That API route does not exist.", retryable: false }, 404);
    }
    return context.json({ code: "NOT_FOUND", message: "That page does not exist.", retryable: false }, 404);
  });

  app.onError((error, context) => {
    const id = context.get("requestId" as never) as string | undefined;
    const requestPath = context.req.path;
    const status = errorStatus(error);
    log.error("request_failed", {
      requestId: id,
      method: context.req.method,
      path: requestPath,
      code: errorCode(error),
      status,
    });
    if (error instanceof HTTPException) {
      if (error.status === 401) context.header("www-authenticate", 'Basic realm="Unfinished Business"');
      return context.json({
        code: error.status === 401 ? "UNAUTHORIZED" : "REQUEST_REJECTED",
        message: error.status === 401 ? "Authentication is required." : error.message,
        retryable: false,
      }, error.status);
    }
    if (status === 413) {
      return context.json({ code: "REQUEST_TOO_LARGE", message: "The request body is too large.", retryable: false }, 413);
    }
    if (error instanceof StateError) {
      return context.json({ code: error.code, message: safePublicError(error, error.message, { hideLocalPaths: true }), retryable: error.retryable }, error.status);
    }
    if (error instanceof WorkspacePolicyError) {
      return context.json({ code: error.code, message: error.message, retryable: false }, 403);
    }
    if (error instanceof NetworkPolicyError) {
      return context.json({ code: error.code, message: safePublicError(error, error.message, { hideLocalPaths: true }), retryable: true }, 503);
    }
    if (error instanceof SyntaxError) {
      return context.json({ code: "INVALID_JSON", message: "The request body was not valid JSON.", retryable: false }, 400);
    }
    return context.json({
      code: "INTERNAL_ERROR",
      message: "The workshop could not complete that action. The saved state was not silently replaced.",
      retryable: false,
    }, 500);
  });

  return app;
}

function demoConnectionStatus() {
  return {
    state: "not_configured",
    baseUrl: null,
    deploymentMode: "hosted-demo",
    managed: true,
    auth: { mode: "none", username: "", hasPassword: false },
    serverVersion: null,
    compatible: null,
    checkedAt: null,
    diagnostics: [{
      code: "DEMO_READ_ONLY",
      severity: "info",
      title: "Hosted demo",
      message: "The public demo is read-only. No OpenCode server, provider, repository, or secret is connected.",
      repair: "Run locally and connect OpenCode for live work, or deploy your own private hosted instance.",
    }],
    discovery: null,
  };
}

function demoEngineStatus() {
  return {
    available: false,
    state: "not_configured",
    serverVersion: null,
    model: null,
    modelAvailable: false,
    limitation: "The hosted demo does not connect to OpenCode. Run locally for live execution.",
  };
}

async function currentConnection(workflow: WorkflowHttpOptions) {
  const connection = workflow.connection!;
  const project = await workflow.service.get();
  const cached = connection.status();
  if (cached.checkedAt === null && cached.baseUrl) {
    return connection.check({
      selected: project.engine.model,
      accessMode: project.modelPreferences.access.mode,
    });
  }
  return cached;
}

function engineSummary(
  project: Project,
  status: ReturnType<ConnectionService["status"]>,
) {
  const model = project.engine.model
    ? `${project.engine.model.providerID}/${project.engine.model.id}${project.engine.model.variant ? `#${project.engine.model.variant}` : ""}`
    : null;
  const selected = project.engine.model;
  const discovered = selected
    ? status.discovery?.models.find((candidate) => candidate.providerID === selected.providerID && candidate.id === selected.id)
    : undefined;
  const modelAvailable = Boolean(discovered
    && discovered.availability === "available"
    && (selected?.variant ? discovered.variants.includes(selected.variant) : true)
    && (project.modelPreferences.access.mode === "ALL_ACCESSIBLE"
      || discovered.pricing === "free"
      || discovered.local === true));
  const diagnostic = status.diagnostics.find((item) => item.severity === "error")
    ?? status.diagnostics.find((item) => item.severity === "warning");
  return {
    available: Boolean(status.discovery) && status.state !== "incompatible_version" && status.state !== "authentication_required" && status.state !== "unavailable",
    state: status.state,
    serverVersion: status.serverVersion,
    model,
    modelAvailable,
    limitation: diagnostic?.message ?? null,
  };
}

function contextJson(body: unknown, status: number): Response {
  return Response.json(body, { status });
}

function invalidRequest(context: Context, message: string) {
  return context.json({ code: "INVALID_REQUEST", message, retryable: false }, 400);
}

function unavailable(context: Context) {
  return context.json({ code: "ENGINE_UNAVAILABLE", message: "The workshop journey is not configured.", retryable: false }, 503);
}

function connectionError(context: Context, error: unknown) {
  if (error instanceof ConnectionConfigError) {
    return context.json({
      code: error.code,
      message: error.message,
      retryable: error.code !== "REMOTE_HTTP_FORBIDDEN" && error.code !== "URL_CREDENTIALS_FORBIDDEN",
    }, 400);
  }
  if (error instanceof z.ZodError) {
    const providerKey = error.issues.some((issue) =>
      /apikey|api_key|providerkey|provider_key|token|secret/i.test(`${String(issue.path[0] ?? "")} ${issue.message}`));
    return context.json({
      code: "INVALID_REQUEST",
      message: providerKey
        ? "Provider API keys are managed inside OpenCode and are not accepted by Unfinished Business."
        : "Invalid OpenCode connection request.",
      retryable: true,
    }, 400);
  }
  if (error instanceof SyntaxError) {
    return context.json({ code: "INVALID_REQUEST", message: "The connection request body is not valid JSON.", retryable: true }, 400);
  }
  return context.json({
    code: "OPENCODE_UNAVAILABLE",
    message: error instanceof Error ? error.message : "OpenCode could not be reached.",
    retryable: true,
  }, 503);
}

function modelSelectionError(context: Context, error: unknown) {
  if (error instanceof RevisionConflict || error instanceof WorkflowConflict) {
    return context.json({ code: "WORKFLOW_CONFLICT", message: error.message, retryable: false }, 409);
  }
  return context.json({
    code: "MODEL_UNAVAILABLE",
    message: error instanceof Error ? error.message : "The selected model is not available.",
    retryable: false,
  }, 409);
}

function sessionError(context: Context, error: unknown) {
  if (error instanceof SessionActionError) {
    return context.json({ code: error.code, message: error.message, retryable: false }, error.status as 400);
  }
  return context.json({
    code: "SESSION_ACTION_FAILED",
    message: error instanceof Error ? error.message : "The OpenCode session action failed.",
    retryable: true,
  }, 503);
}

function errorStatus(error: unknown): number {
  if (error instanceof ExperienceFailure) return error.status;
  if (error instanceof RevisionConflict || error instanceof WorkflowConflict) return 409;
  if (error instanceof z.ZodError) return 400;
  if (error instanceof StateError) return error.status;
  if (error instanceof WorkspacePolicyError) return 403;
  if (error instanceof NetworkPolicyError) return 503;
  if (error instanceof HTTPException) return error.status;
  if ((error as { status?: number })?.status === 413) return 413;
  return 500;
}

function errorCode(error: unknown): string {
  if (error instanceof ExperienceFailure) return error.code;
  if (error instanceof RevisionConflict || error instanceof WorkflowConflict) return "WORKFLOW_CONFLICT";
  if (error instanceof z.ZodError) return "INVALID_REQUEST";
  if (error instanceof StateError) return error.code;
  if (error instanceof WorkspacePolicyError) return error.code;
  if (error instanceof NetworkPolicyError) return error.code;
  return "INTERNAL_ERROR";
}

function publicProjectSnapshot(project: Project) {
  const { workspace: _workspace, ...publicProject } = project;
  const { workspacePath: _workspacePath, ...publicSource } = project.source;
  return { ...publicProject, source: publicSource };
}

function publicProjectResult<T>(result: T): T | (Omit<T & { project: Project }, "project"> & { project: ReturnType<typeof publicProjectSnapshot> }) {
  if (!result || typeof result !== "object" || !("project" in result)) return result;
  const value = result as T & { project: Project };
  return { ...value, project: publicProjectSnapshot(value.project) };
}

function workflowError(context: Context, error: unknown, validationMessage: string, logger: Logger) {
  if (error instanceof ExperienceFailure) {
    return context.json({
      code: error.code,
      message: safePublicError(error, validationMessage, { hideLocalPaths: true }),
      retryable: error.retryable,
      operationId: error.operationId,
      providerError: error.providerError,
      requestId: context.get("requestId" as never) as string | undefined,
    }, error.status as 400);
  }
  if (error instanceof RevisionConflict || error instanceof WorkflowConflict) {
    return context.json({ code: "WORKFLOW_CONFLICT", message: error.message, retryable: false }, 409);
  }
  if (error instanceof z.ZodError) {
    logger.warn("request_validation_failed", {
      requestId: context.get("requestId" as never),
      path: context.req.path,
      issues: error.issues.length,
    });
    return context.json({ code: "INVALID_REQUEST", message: validationMessage, retryable: true }, 400);
  }
  if (error instanceof StateError) {
    return context.json({ code: error.code, message: safePublicError(error, error.message, { hideLocalPaths: true }), retryable: error.retryable }, error.status);
  }
  if (error instanceof NetworkPolicyError) {
    return context.json({ code: error.code, message: safePublicError(error, error.message, { hideLocalPaths: true }), retryable: true }, 503);
  }
  if (error instanceof ProjectSourceError) {
    return context.json({
      code: error.code,
      message: safePublicError(error, validationMessage, { hideLocalPaths: true }),
      retryable: error.status >= 500,
    }, error.status as 400);
  }
  throw error;
}

async function optionalConnectionBody(context: Context): Promise<{
  baseUrl?: string;
  username?: string;
  password?: string;
}> {
  const text = (await context.req.text()).trim();
  if (!text) return {};
  return connectionInputSchema.partial().strict().parse(JSON.parse(text));
}

async function optionalJson(context: Context): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    return {};
  }
}
