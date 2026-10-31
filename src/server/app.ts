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
import type { AppConfig, LimitsConfig } from "./config.ts";
import { isLoopbackHost } from "./config.ts";
import { ExperienceFailure, ExperienceService } from "./experience/service.ts";
import { RevisionConflict, StateError } from "./store/atomic-project-store.ts";
import { clientKey, ConcurrencyGate, RateLimiter, timingSafeEqual } from "./security/limits.ts";
import { NetworkPolicyError } from "./security/network.ts";
import { safePublicError } from "./security/redaction.ts";
import { WorkspacePolicyError } from "./security/workspace.ts";
import { createLogger, requestId, type Logger } from "./observability/logger.ts";
import { WorkflowService } from "./workflow/service.ts";
import { approveSection, reviseSection, WorkflowConflict } from "./workflow/transitions.ts";

export type EngineProbe = () => Promise<unknown>;

const actionIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const sectionIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const operationIdSchema = z.string().uuid();

const actionSchema = z.object({
  actionId: actionIdSchema,
  expectedRevision: z.number().int().nonnegative(),
});
const revisionSchema = actionSchema.extend({ content: z.string().min(1).max(65_536) });
const approvalRequestSchema = actionSchema.extend({
  version: z.number().int().positive(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
});

const messageSchema = actionSchema.extend({
  intent: z.enum(["clarify", "draft", "question", "witness"]),
  text: z.string().min(1).max(8_000),
});
const approvalKindSchema = z.discriminatedUnion("kind", [
  actionSchema.extend({ kind: z.literal("product") }),
  actionSchema.extend({ kind: z.literal("maker-scope"), statement: z.string().min(8).max(2_000) }),
]);

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
  access?: {
    username: string;
    password: string;
  };
  security?: HttpSecurityOptions;
  runtime?: RuntimeConfig;
  logger?: Logger;
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
  maxSessionCostUsd: 0,
};

function defaultRuntime(): RuntimeConfig {
  return runtimeConfigSchema.parse({
    mode: "local",
    production: false,
    demoWorkspace: true,
    authRequired: false,
    originProtection: true,
    opencode: { baseUrlKind: "loopback", model: "opencode/deepseek-v4.1-flash-free" },
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

export function createApp(probe: EngineProbe, workflow?: WorkflowHttpOptions) {
  const app = new Hono();
  const security: HttpSecurityOptions = workflow?.security ?? {
    mode: "local",
    allowedHosts: ["127.0.0.1", "localhost", "::1"],
    allowedOrigins: [],
    trustProxy: false,
    limits: defaultLimits,
  };
  const runtime = workflow?.runtime ?? defaultRuntime();
  const log = workflow?.logger ?? createLogger();
  const rateLimiter = new RateLimiter(security.limits.rateLimitPerMinute);
  const mutationGate = new ConcurrencyGate(security.limits.maxConcurrentMutations);
  const sseGate = new ConcurrencyGate(security.limits.maxSseConnections);

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

  if (workflow?.access) {
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

  if (workflow) {
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
      if (context.req.path === "/api/health" || context.req.path === "/api/session") return next();
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
      const host = context.req.header("host") ?? new URL(context.req.url).host;
      if (!workflow.access && !isLoopbackHost(hostnameOf(host))) {
        return context.json({ code: "INVALID_ORIGIN", message: "The local session token is only available on loopback.", retryable: false }, 403);
      }
      context.header("cache-control", "no-store");
      return context.json({ token: workflow.sessionToken });
    });

    app.get("/api/engine", async (context) => {
      const status = nativeEngineStatusSchema.parse(await probe());
      return context.json(status, status.available ? 200 : 503);
    });

    app.get("/api/runtime", (context) => context.json(runtimeConfigSchema.parse(runtime)));

    app.get("/api/project", async (context) => {
      const project = await workflow.service.get();
      const { workspace: _workspace, ...publicProject } = project;
      return context.json(publicProject);
    });

    app.get("/api/events", async (context) => {
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

    if (workflow.experience) {
      app.get("/api/export", async (context) => context.json(await workflow.experience!.exportApproved()));
    }

    app.post("/api/sections/:id/revisions", async (context) => {
      const id = sectionIdSchema.safeParse(context.req.param("id"));
      if (!id.success) return invalidRequest(context, "Unknown section identifier.");
      try {
        const input = revisionSchema.parse(await context.req.json());
        const result = await workflow.service.execute(
          input.actionId,
          input,
          input.expectedRevision,
          (project) => reviseSection(project, id.data, input.content),
        );
        return context.json(result);
      } catch (error) {
        return workflowError(context, error, "Invalid revision request.", log);
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
        return context.json(result);
      } catch (error) {
        return workflowError(context, error, "Invalid approval request.", log);
      }
    });

    app.post("/api/messages", async (context) => {
      if (!workflow.experience) return unavailable(context);
      try {
        const input = messageSchema.parse(await context.req.json());
        const result = await workflow.experience.sendMessage(input.actionId, input.expectedRevision, input.intent, input.text);
        return context.json(result);
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
        return context.json(result);
      } catch (error) {
        return workflowError(context, error, "Invalid approval.", log);
      }
    });

    app.post("/api/runs", async (context) => {
      if (!workflow.experience) return unavailable(context);
      try {
        const input = actionSchema.parse(await context.req.json());
        const result = await workflow.experience.runMaker(input.actionId, input.expectedRevision);
        return context.json(result);
      } catch (error) {
        return workflowError(context, error, "Invalid Maker run.", log);
      }
    });

    app.post("/api/runs/:id/cancel", async (context) => {
      if (!workflow.experience) return unavailable(context);
      const id = operationIdSchema.safeParse(context.req.param("id"));
      if (!id.success) return invalidRequest(context, "Unknown operation identifier.");
      try {
        const input = actionSchema.parse(await context.req.json());
        const result = await workflow.experience.cancel(input.actionId, input.expectedRevision, id.data);
        return context.json(result);
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
        return context.json(result);
      } catch (error) {
        return workflowError(context, error, "Invalid reconciliation.", log);
      }
    });
  } else {
    app.get("/api/engine", async (context) => {
      const status = nativeEngineStatusSchema.parse(await probe());
      return context.json(status, status.available ? 200 : 503);
    });
  }

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

function invalidRequest(context: Context, message: string) {
  return context.json({ code: "INVALID_REQUEST", message, retryable: false }, 400);
}

function unavailable(context: Context) {
  return context.json({ code: "ENGINE_UNAVAILABLE", message: "The workshop journey is not configured.", retryable: false }, 503);
}

function workflowError(context: Context, error: unknown, validationMessage: string, logger: Logger) {
  if (error instanceof ExperienceFailure) {
    return context.json({
      code: error.code,
      message: safePublicError(error, validationMessage, { hideLocalPaths: true }),
      retryable: error.retryable,
      operationId: error.operationId,
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
  throw error;
}
