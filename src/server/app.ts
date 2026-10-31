import { Hono } from "hono";
import { z } from "zod";
import { healthSchema, nativeEngineStatusSchema, type NativeEngineStatus } from "../shared/contracts.ts";
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

export interface WorkflowHttpOptions {
  service: WorkflowService;
  sessionToken: string;
}

export function createApp(probe: EngineProbe, workflow?: WorkflowHttpOptions) {
  const app = new Hono();

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

    app.use("/api/sections/*", async (context, next) => {
      if (context.req.header("x-ub-session-token") !== workflow.sessionToken) {
        return context.json({ code: "INVALID_SESSION", message: "Missing or invalid local browser session token." }, 403);
      }
      return next();
    });

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
        if (error instanceof z.ZodError) return context.json({ code: "INVALID_REQUEST", message: "Invalid approval request." }, 400);
        throw error;
      }
    });
  }

  return app;
}
