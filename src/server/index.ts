import { randomBytes, randomUUID } from "node:crypto";
import { access, mkdir, readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { serve } from "@hono/node-server";
import type { DeploymentMode } from "../shared/opencode.ts";
import { createApp } from "./app.ts";
import { OpenCodeSpiritGuide } from "./experience/guide.ts";
import { ExperienceService } from "./experience/service.ts";
import { ConnectionService } from "./opencode/connection.ts";
import { SessionActionsService } from "./opencode/sessions.ts";
import { AtomicProjectStore } from "./store/atomic-project-store.ts";
import { createProject, refreshNextAction } from "./workflow/model.ts";
import { WorkflowService } from "./workflow/service.ts";

const port = Number(process.env.PORT ?? process.env.UB_PORT ?? 4200);
const hostname = process.env.UB_HOST
  ?? (process.env.RENDER || process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const baseUrl = process.env.OPENCODE_BASE_URL ?? "http://127.0.0.1:4096";
const dataDirectory = resolve(process.env.UB_DATA_DIR ?? ".unfinished-business");
const demoWorkspace = resolve(dataDirectory, "demo-workspace");
const safeDirectory = resolve(dataDirectory, "spirit-workspace");
const deploymentMode: DeploymentMode = process.env.UB_DEPLOYMENT_MODE === "hosted-demo"
  ? "hosted-demo"
  : process.env.UB_DEPLOYMENT_MODE === "hosted-private"
    ? "hosted-private"
    : process.env.RENDER
      ? "hosted-private"
      : "local";
await mkdir(demoWorkspace, { recursive: true });
await mkdir(safeDirectory, { recursive: true });

const store = new AtomicProjectStore(resolve(dataDirectory, "project.json"));
try {
  await access(store.path);
} catch {
  await store.initialize(createProject(process.cwd()));
}
const sessionToken = process.env.UB_SESSION_TOKEN ?? randomBytes(32).toString("base64url");
const accessPassword = process.env.UB_ACCESS_PASSWORD?.trim();
if (process.env.NODE_ENV === "production" && !accessPassword) {
  throw new Error("UB_ACCESS_PASSWORD is required in production.");
}
const workflow = new WorkflowService(store);
const connection = new ConnectionService({
  dataDir: dataDirectory,
  deploymentMode,
  envBaseUrl: baseUrl,
  envUsername: process.env.OPENCODE_USERNAME,
  envPassword: process.env.OPENCODE_PASSWORD,
});
await connection.load();
await markInterruptedRuns(workflow);
const experience = new ExperienceService(workflow, store, new OpenCodeSpiritGuide(() => connection.clientOptions()), { safeDirectory, demoWorkspace, engine: connection });
const sessions = new SessionActionsService(connection, () => workflow.get());

const app = createApp({
  service: workflow,
  sessionToken,
  experience,
  connection,
  sessions,
  access: accessPassword ? {
    username: process.env.UB_ACCESS_USERNAME?.trim() || "unfinished-business",
    password: accessPassword,
  } : undefined,
});

const webRoot = resolve("dist/web");
const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

try {
  await access(resolve(webRoot, "index.html"));
  app.get("*", async (context) => {
    if (context.req.path.startsWith("/api")) return context.notFound();
    const requested = context.req.path === "/" ? "index.html" : decodeURIComponent(context.req.path).replace(/^\/+/, "");
    const file = resolve(webRoot, requested);
    if (!file.startsWith(`${webRoot}${sep}`) && file !== resolve(webRoot, "index.html")) return context.notFound();
    try {
      const body = await readFile(file);
      return context.body(body, 200, { "content-type": contentTypes[extname(file)] ?? "application/octet-stream" });
    } catch {
      const index = await readFile(resolve(webRoot, "index.html"));
      return context.body(index, 200, { "content-type": "text/html; charset=utf-8" });
    }
  });
} catch {
  // API-only until the browser bundle has been built.
}

export const server = serve({ fetch: app.fetch, hostname, port }, ({ address, port: boundPort }) => {
  console.log(`Unfinished Business listening on http://${address}:${boundPort}`);
});
server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Set PORT or UB_PORT to a free port.`);
    process.exitCode = 1;
    return;
  }
  throw error;
});

/**
 * A process restart cannot know whether an in-flight native session finished.
 * Preserve the operation as UNKNOWN for explicit reconciliation rather than
 * silently marking it failed, succeeded, or replaying the prompt.
 */
async function markInterruptedRuns(workflowService: WorkflowService): Promise<void> {
  const project = await workflowService.get();
  const interrupted = project.operations.filter((operation) => operation.status === "QUEUED" || operation.status === "RUNNING");
  if (interrupted.length === 0) return;
  await workflowService.executeLatest("startup:interrupted-runs", { count: interrupted.length }, (current) => {
    const next = structuredClone(current);
    for (const operation of next.operations) {
      if (operation.status !== "QUEUED" && operation.status !== "RUNNING") continue;
      operation.status = "UNKNOWN";
      operation.result = "The application restarted while this native run was in flight. Reconcile the OpenCode session before another attempt.";
      operation.finishedAt = new Date().toISOString();
    }
    next.transcript.push({
      id: randomUUID(),
      spirit: "system",
      text: "A process restart left a native run unknown. It was not repeated.",
      createdAt: new Date().toISOString(),
    });
    return refreshNextAction(next);
  });
}
