import { sentry } from "@sentry/hono/node";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { z } from "zod";
import {
  connectionStatusSchema,
  engineStatusSchema,
  healthSchema,
} from "../shared/contracts.ts";
import { demoExport, demoFixture } from "../shared/demo.ts";
import { modeDescriptor, type RuntimeMode } from "../shared/modes.ts";
import { ExperienceFailure, ExperienceService } from "./experience/service.ts";
import { ConnectionConfigError } from "./opencode/client.ts";
import type { ConnectionService } from "./opencode/connection.ts";
import { SessionActionError, type SessionActionsService } from "./opencode/sessions.ts";
import { RevisionConflict } from "./store/atomic-project-store.ts";
import type { Project } from "./workflow/model.ts";
import { WorkflowService } from "./workflow/service.ts";
import { approveSection, reviseSection, WorkflowConflict } from "./workflow/transitions.ts";

const actionSchema = z.object({
  actionId: z.string().min(1),
  expectedRevision: z.number().int().nonnegative(),
});
const revisionSchema = actionSchema.extend({ content: z.string().min(1).max(65_536) });
const approvalRequestSchema = actionSchema.extend({
  version: z.number().int().positive(),
  hash: z.string().length(64),
});
const messageSchema = actionSchema.extend({
  intent: z.enum(["clarify", "draft", "question", "witness"]),
  text: z.string().min(1).max(8_000),
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
});
const revertStageSchema = z.object({
  messageID: z.string().min(1).max(256),
  files: z.boolean().optional(),
}).strict();
const permissionReplySchema = z.object({
  sessionID: z.string().min(1).max(256),
  decision: z.enum(["once", "always", "reject"]),
  message: z.string().max(2_000).optional(),
}).strict();

export interface WorkflowHttpOptions {
  service: WorkflowService;
  sessionToken: string;
  experience?: ExperienceService;
  connection?: ConnectionService;
  sessions?: SessionActionsService;
  access?: {
    username: string;
    password: string;
  };
  /** The deployment policy. Demo mode is read-only and serves the fixture. */
  mode?: RuntimeMode;
}

export function createApp(workflow: WorkflowHttpOptions) {
  const app = new Hono();
  const mode = workflow.mode ?? "local";

  app.use(sentry(app));

  if (workflow.access) {
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

  app.get("/api/health", (context) => context.json(healthSchema.parse({
    status: "ok",
    service: "unfinished-business",
  })));

  app.get("/api/mode", (context) => context.json(modeDescriptor(mode)));

  // The hosted demo is a deterministic, read-only sample. Reject every
  // mutation before a body is parsed or a workflow service is touched.
  app.use("/api/*", async (context, next) => {
    if (mode !== "demo") return next();
    if (context.req.method === "GET" || context.req.method === "HEAD") return next();
    return context.json({
      code: "DEMO_READ_ONLY",
      message: modeDescriptor("demo").unavailableActions.mutations,
      retryable: false,
    }, 403);
  });

  app.use("/api/connection/check", async (context, next) => guard(context, next, workflow.sessionToken));
  app.use("/api/connection/configure", async (context, next) => guard(context, next, workflow.sessionToken));
  app.use("/api/connection/reset", async (context, next) => guard(context, next, workflow.sessionToken));
  app.use("/api/engine/selection", async (context, next) => guard(context, next, workflow.sessionToken));
  app.use("/api/opencode/*", async (context, next) => {
    if (mode === "demo") {
      return context.json({
        code: "DEMO_READ_ONLY",
        message: modeDescriptor("demo").unavailableActions.engine,
        retryable: false,
      }, 403);
    }
    if (context.req.method === "GET") return next();
    return guard(context, next, workflow.sessionToken);
  });

  app.get("/api/connection", async (context) => {
    if (mode === "demo") return context.json(demoConnectionStatus());
    if (!workflow.connection) return connectionUnavailable(context);
    const status = await currentConnection(workflow);
    return context.json(status);
  });

  app.get("/api/engine", async (context) => {
    if (mode === "demo") return context.json(demoEngineStatus(), 503);
    if (!workflow.connection) return connectionUnavailable(context);
    const status = await currentConnection(workflow);
    const project = await workflow.service.get();
    return context.json(engineSummary(project, status), status.state === "connected" || status.state === "degraded" ? 200 : 503);
  });

  app.post("/api/connection/check", async (context) => {
    if (!workflow.connection) return connectionUnavailable(context);
    try {
      const input = await optionalConnectionBody(context);
      if (workflow.connection.managed && (input.baseUrl !== undefined || input.password !== undefined)) {
        return context.json({
          code: "CONNECTION_MANAGED",
          message: "This deployment manages the OpenCode URL and credentials through its environment and secret store.",
          retryable: false,
        }, 409);
      }
      const project = await workflow.service.get();
      const status = await workflow.connection.check({
        ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
        ...(input.username !== undefined ? { username: input.username } : {}),
        ...(input.password !== undefined ? { password: input.password } : {}),
        selected: project.engine.model,
      });
      return context.json(status);
    } catch (error) {
      return connectionError(context, error);
    }
  });

  app.post("/api/connection/configure", async (context) => {
    if (!workflow.connection) return connectionUnavailable(context);
    try {
      if (workflow.connection.managed) {
        return context.json({
          code: "CONNECTION_MANAGED",
          message: "This deployment manages the OpenCode URL and credentials through its environment and secret store.",
          retryable: false,
        }, 409);
      }
      const input = connectionInputSchema.parse(await context.req.json());
      const status = await workflow.connection.configure(input);
      return context.json(status);
    } catch (error) {
      return connectionError(context, error);
    }
  });

  app.post("/api/connection/reset", async (context) => {
    if (!workflow.connection) return connectionUnavailable(context);
    try {
      return context.json(await workflow.connection.reset());
    } catch (error) {
      return connectionError(context, error);
    }
  });

  app.get("/api/opencode/discovery", async (context) => {
    if (!workflow.connection) return connectionUnavailable(context);
    try {
      const project = await workflow.service.get();
      return context.json(await workflow.connection.discovery({ selected: project.engine.model }));
    } catch (error) {
      return connectionError(context, error);
    }
  });

  app.post("/api/engine/selection", async (context) => {
    if (!workflow.connection) return connectionUnavailable(context);
    try {
      const input = modelSelectionSchema.parse(await context.req.json());
      const project = await workflow.service.get();
      const discovery = await workflow.connection.discovery({ selected: project.engine.model });
      const selected = {
        providerID: input.providerID,
        id: input.id,
        variant: input.variant ?? null,
      };
      workflow.connection.validateSelection(discovery, selected);
      const result = await workflow.service.execute(input.actionId, {
        providerID: input.providerID,
        id: input.id,
        variant: input.variant ?? null,
      }, input.expectedRevision, (current) => {
        const next = structuredClone(current);
        next.engine = {
          model: selected,
          source: "user",
          updatedAt: new Date().toISOString(),
          legacyModel: current.engine.legacyModel,
        };
        return next;
      });
      return context.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) return invalidRequest(context, "Invalid model selection.");
      return modelSelectionError(context, error);
    }
  });

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

  app.get("/api/project", async (context) => context.json(mode === "demo" ? demoFixture.project : await workflow.service.get()));
  app.get("/api/session", (context) => {
    if (mode === "demo") {
      return context.json({
        code: "DEMO_READ_ONLY",
        message: modeDescriptor("demo").unavailableActions.mutations,
        retryable: false,
      }, 403);
    }
    if (workflow.access) return context.json({ token: workflow.sessionToken });
    const host = context.req.header("host") ?? "";
    if (!host.startsWith("127.0.0.1") && !host.startsWith("localhost")) {
      return context.json({ code: "INVALID_ORIGIN", message: "The local session token is only available on loopback.", retryable: false }, 403);
    }
    return context.json({ token: workflow.sessionToken });
  });
  if (workflow.experience || mode === "demo") {
    app.get("/api/export", async (context) => context.json(mode === "demo" ? demoExport : await workflow.experience!.exportApproved()));
  }

  app.use("/api/sections/*", async (context, next) => guard(context, next, workflow.sessionToken));
  app.use("/api/messages", async (context, next) => guard(context, next, workflow.sessionToken));
  app.use("/api/approvals", async (context, next) => guard(context, next, workflow.sessionToken));
  app.use("/api/runs", async (context, next) => guard(context, next, workflow.sessionToken));
  app.use("/api/runs/*", async (context, next) => guard(context, next, workflow.sessionToken));
  app.post("/api/sections/:id/revisions", async (context) => {
    try {
      const input = revisionSchema.parse(await context.req.json());
      const result = await workflow.service.execute(
        input.actionId,
        input,
        input.expectedRevision,
        (project) => reviseSection(project, context.req.param("id"), input.content),
      );
      return context.json(result);
    } catch (error) {
      if (error instanceof RevisionConflict || error instanceof WorkflowConflict) {
        return context.json({ code: "WORKFLOW_CONFLICT", message: error.message }, 409);
      }
      if (error instanceof z.ZodError) return context.json({ code: "INVALID_REQUEST", message: "Invalid revision request." }, 400);
      throw error;
    }
  });

  app.post("/api/sections/:id/approve", async (context) => {
    try {
      const input = approvalRequestSchema.parse(await context.req.json());
      const result = await workflow.service.execute(
        input.actionId,
        input,
        input.expectedRevision,
        (project) => approveSection(project, context.req.param("id"), input.version, input.hash),
      );
      return context.json(result);
    } catch (error) {
      if (error instanceof RevisionConflict || error instanceof WorkflowConflict) {
        return context.json({ code: "WORKFLOW_CONFLICT", message: error.message }, 409);
      }
      if (error instanceof z.ZodError) return context.json({ code: "INVALID_REQUEST", message: "Invalid approval request.", retryable: true }, 400);
      throw error;
    }
  });

  app.post("/api/messages", async (context) => {
    if (!workflow.experience) return unavailable(context);
    try {
      const input = messageSchema.parse(await context.req.json());
      const result = await workflow.experience.sendMessage(input.actionId, input.expectedRevision, input.intent, input.text);
      return context.json(result);
    } catch (error) {
      return journeyError(context, error, "Invalid message.");
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
      return journeyError(context, error, "Invalid approval.");
    }
  });

  app.post("/api/runs", async (context) => {
    if (!workflow.experience) return unavailable(context);
    try {
      const input = actionSchema.parse(await context.req.json());
      const result = await workflow.experience.runMaker(input.actionId, input.expectedRevision);
      return context.json(result, result.accepted ? 202 : 200);
    } catch (error) {
      return journeyError(context, error, "Invalid Maker run.");
    }
  });

  app.get("/api/runs/:id", async (context) => {
    if (!workflow.experience) return unavailable(context);
    const project = await workflow.service.get();
    const operation = project.operations.find((item) => item.id === context.req.param("id"));
    if (!operation) return context.json({ code: "RUN_NOT_FOUND", message: "That run is not in this project." }, 404);
    return context.json({
      operation,
      active: workflow.experience.isRunActive(operation.id),
    });
  });

  app.post("/api/runs/:id/cancel", async (context) => {
    if (!workflow.experience) return unavailable(context);
    try {
      const input = actionSchema.parse(await context.req.json());
      const result = await workflow.experience.cancel(input.actionId, input.expectedRevision, context.req.param("id"));
      return context.json(result);
    } catch (error) {
      return journeyError(context, error, "Invalid cancellation.");
    }
  });

  app.post("/api/runs/:id/reconcile", async (context) => {
    if (!workflow.experience) return unavailable(context);
    try {
      const input = actionSchema.parse(await context.req.json());
      const result = await workflow.experience.reconcile(input.actionId, input.expectedRevision, context.req.param("id"));
      return context.json(result);
    } catch (error) {
      return journeyError(context, error, "Invalid reconciliation.");
    }
  });

  return app;
}

function demoConnectionStatus() {
  return connectionStatusSchema.parse({
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
  });
}

function demoEngineStatus() {
  return engineStatusSchema.parse({
    available: false,
    state: "not_configured",
    serverVersion: null,
    model: null,
    modelAvailable: false,
    limitation: "The hosted demo does not connect to OpenCode. Run locally for live execution.",
  });
}

async function currentConnection(workflow: WorkflowHttpOptions) {
  const connection = workflow.connection!;
  const project = await workflow.service.get();
  const cached = connection.status();
  if (cached.checkedAt === null && cached.baseUrl) {
    return connection.check({ selected: project.engine.model });
  }
  return connectionStatusSchema.parse(cached);
}

function engineSummary(project: Project, status: ReturnType<ConnectionService["status"]>) {
  const model = project.engine.model
    ? `${project.engine.model.providerID}/${project.engine.model.id}${project.engine.model.variant ? `#${project.engine.model.variant}` : ""}`
    : null;
  const modelAvailable = Boolean(status.discovery?.models.some((candidate) =>
    candidate.providerID === project.engine.model?.providerID
    && candidate.id === project.engine.model?.id
    && candidate.availability === "available"
    && (project.engine.model?.variant ? candidate.variants.includes(project.engine.model.variant) : true)));
  const diagnostic = status.diagnostics.find((item) => item.severity === "error")
    ?? status.diagnostics.find((item) => item.severity === "warning");
  return engineStatusSchema.parse({
    available: Boolean(status.discovery) && status.state !== "incompatible_version" && status.state !== "authentication_required" && status.state !== "unavailable",
    state: status.state,
    serverVersion: status.serverVersion,
    model,
    modelAvailable,
    limitation: diagnostic?.message ?? null,
  });
}

async function guard(context: Parameters<Parameters<Hono["use"]>[1]>[0], next: () => Promise<void>, sessionToken: string) {
  if (context.req.method === "GET") return next();
  if (context.req.header("x-ub-session-token") !== sessionToken) {
    return context.json({ code: "INVALID_SESSION", message: "Missing or invalid local browser session token.", retryable: false }, 403);
  }
  return next();
}

function unavailable(context: { json: (body: unknown, status?: number) => Response }) {
  return context.json({ code: "ENGINE_UNAVAILABLE", message: "The workshop journey is not configured.", retryable: false }, 503);
}

function connectionUnavailable(context: { json: (body: unknown, status?: number) => Response }) {
  return context.json({ code: "CONNECTION_UNAVAILABLE", message: "OpenCode connection support is not configured in this process.", retryable: false }, 503);
}

function invalidRequest(context: { json: (body: unknown, status?: number) => Response }, message: string) {
  return context.json({ code: "INVALID_REQUEST", message, retryable: true }, 400);
}

function connectionError(context: { json: (body: unknown, status?: number) => Response }, error: unknown) {
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

function modelSelectionError(context: { json: (body: unknown, status?: number) => Response }, error: unknown) {
  if (error instanceof RevisionConflict || error instanceof WorkflowConflict) {
    return context.json({ code: "WORKFLOW_CONFLICT", message: error.message, retryable: false }, 409);
  }
  return context.json({
    code: "MODEL_UNAVAILABLE",
    message: error instanceof Error ? error.message : "The selected model is not available.",
    retryable: false,
  }, 409);
}

function sessionError(context: { json: (body: unknown, status?: number) => Response }, error: unknown) {
  if (error instanceof SessionActionError) {
    return context.json({ code: error.code, message: error.message, retryable: false }, error.status as 400);
  }
  return context.json({
    code: "SESSION_ACTION_FAILED",
    message: error instanceof Error ? error.message : "The OpenCode session action failed.",
    retryable: true,
  }, 503);
}

async function optionalConnectionBody(context: { req: { text: () => Promise<string> } }): Promise<{
  baseUrl?: string;
  username?: string;
  password?: string;
}> {
  const text = (await context.req.text()).trim();
  if (!text) return {};
  return connectionInputSchema.partial().strict().parse(JSON.parse(text));
}

async function optionalJson(context: { req: { json: () => Promise<unknown> } }): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    return {};
  }
}

function journeyError(context: { json: (body: unknown, status?: number) => Response }, error: unknown, validationMessage: string) {
  if (error instanceof ExperienceFailure) {
    return context.json({
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      operationId: error.operationId,
    }, error.status as 400);
  }
  if (error instanceof RevisionConflict || error instanceof WorkflowConflict) {
    return context.json({ code: "WORKFLOW_CONFLICT", message: error.message, retryable: false }, 409);
  }
  if (error instanceof z.ZodError) return context.json({ code: "INVALID_REQUEST", message: validationMessage, retryable: true }, 400);
  throw error;
}
