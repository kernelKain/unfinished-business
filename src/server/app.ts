import { sentry } from "@sentry/hono/node";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { z } from "zod";
import { healthSchema, nativeEngineStatusSchema, type NativeEngineStatus } from "../shared/contracts.ts";
import { ExperienceFailure, ExperienceService } from "./experience/service.ts";
import { RevisionConflict } from "./store/atomic-project-store.ts";
import { WorkflowService } from "./workflow/service.ts";
import { approveSection, reviseSection, WorkflowConflict } from "./workflow/transitions.ts";

export type EngineProbe = () => Promise<NativeEngineStatus>;

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

export interface WorkflowHttpOptions {
  service: WorkflowService;
  sessionToken: string;
  experience?: ExperienceService;
  access?: {
    username: string;
    password: string;
  };
}

export function createApp(probe: EngineProbe, workflow?: WorkflowHttpOptions) {
  const app = new Hono();

  app.use(sentry(app));

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

  app.get("/api/health", (context) => context.json(healthSchema.parse({
    status: "ok",
    service: "unfinished-business",
  })));

  app.get("/api/engine", async (context) => {
    const status = nativeEngineStatusSchema.parse(await probe());
    return context.json(status, status.available ? 200 : 503);
  });

  if (workflow) {
    app.get("/api/project", async (context) => context.json(await workflow.service.get()));
    app.get("/api/session", (context) => {
      if (workflow.access) return context.json({ token: workflow.sessionToken });
      const host = context.req.header("host") ?? "";
      if (!host.startsWith("127.0.0.1") && !host.startsWith("localhost")) {
        return context.json({ code: "INVALID_ORIGIN", message: "The local session token is only available on loopback.", retryable: false }, 403);
      }
      return context.json({ token: workflow.sessionToken });
    });
    if (workflow.experience) {
      app.get("/api/export", async (context) => context.json(await workflow.experience!.exportApproved()));
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
        return context.json(result);
      } catch (error) {
        return journeyError(context, error, "Invalid Maker run.");
      }
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
  }

  return app;
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
