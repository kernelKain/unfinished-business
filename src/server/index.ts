import { access, readFile, realpath } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { serve } from "@hono/node-server";
import { createApp, httpSecurityFromConfig } from "./app.ts";
import { loadConfig, publicRuntimeConfig } from "./config.ts";
import { OpenCodeSpiritGuide } from "./experience/guide.ts";
import { ExperienceService } from "./experience/service.ts";
import { createLogger } from "./observability/logger.ts";
import { ConnectionService } from "./opencode/connection.ts";
import { SessionActionsService } from "./opencode/sessions.ts";
import { ProjectSourceService } from "./project-sources.ts";
import { AtomicProjectStore, StateError } from "./store/atomic-project-store.ts";
import { WorkspacePolicyError, assertWorkspaceContains, canonicalizeDirectoryRoot, resolveStaticFile } from "./security/workspace.ts";
import { createProject } from "./workflow/model.ts";
import { WorkflowService } from "./workflow/service.ts";

const config = loadConfig();
const log = createLogger({
  redact: { hideLocalPaths: config.hideLocalPaths },
});

const dataRoot = await canonicalizeDirectoryRoot(config.dataDirectory);
const demoWorkspace = await canonicalizeDirectoryRoot(config.demoWorkspace, { allowedParent: dataRoot.real });
const spiritWorkspace = await canonicalizeDirectoryRoot(config.spiritWorkspace, { allowedParent: dataRoot.real });
const managedImportRoot = await canonicalizeDirectoryRoot(join(dataRoot.real, "managed-imports"), { allowedParent: dataRoot.real });
await assertWorkspaceContains(dataRoot.real, demoWorkspace.real);
await assertWorkspaceContains(dataRoot.real, spiritWorkspace.real);
await assertWorkspaceContains(dataRoot.real, managedImportRoot.real);

const store = new AtomicProjectStore(config.statePath, {
  backups: config.retention.backups,
  corruptFiles: config.retention.corruptFiles,
  backupMaxAgeDays: config.retention.backupMaxAgeDays,
});
const workflow = new WorkflowService(store, { retention: config.retention });
let storeReady = true;
let startupRecovery: { recovered: number } | null = null;

try {
  const loaded = await store.load();
  if (loaded.corruptPath) {
    log.warn("state_recovered_from_backup", {
      source: loaded.source,
      quarantinePath: loaded.quarantinePath,
      migrated: loaded.migrated,
    });
  }
  if (loaded.migrated) {
    log.info("state_migrated", { fromVersion: loaded.fromVersion });
  }
  const runtimeMetadata = await workflow.ensureRuntimeMetadata(config.mode, demoWorkspace.real);
  if (runtimeMetadata.updated) log.info("runtime_metadata_updated", { mode: config.mode });
  startupRecovery = await workflow.recoverAfterRestart();
} catch (error) {
  if (error instanceof StateError && error.code === "STATE_NOT_INITIALIZED") {
    await store.initialize(createProject(demoWorkspace.real, config.mode, { demoWorkspace: true }));
    log.info("state_initialized", { mode: config.mode });
  } else {
    storeReady = false;
    log.error("state_unavailable", {
      code: error instanceof StateError ? error.code : "STATE_CORRUPT",
      message: error instanceof Error ? error.message : "Project state could not be loaded.",
    });
  }
}
if (startupRecovery?.recovered) {
  log.warn("interrupted_operations_marked_unknown", { count: startupRecovery.recovered });
}

// The hosted demo is deterministic and read-only. It never constructs an
// OpenCode connection, guide, session service, or provider credential path.
const connection = config.mode === "hosted-demo"
  ? null
  : new ConnectionService({
      dataDir: config.dataDirectory,
      deploymentMode: config.mode === "private-hosted" ? "hosted-private" : "local",
      envBaseUrl: config.opencode.baseUrl,
      envUsername: config.opencode.username,
      envPassword: config.opencode.password,
      security: {
        mode: config.mode,
        allowInsecureRemote: config.opencode.allowInsecureRemote,
        allowedHosts: config.opencode.allowedHosts,
        allowedPorts: config.opencode.allowedPorts,
        allowPrivateNetwork: config.opencode.allowPrivateNetwork,
        requestTimeoutMs: config.opencode.requestTimeoutMs,
        maxResponseBytes: config.opencode.maxResponseBytes,
      },
    });
if (connection) await connection.load();

const experience = connection
  ? new ExperienceService(
      workflow,
      store,
      new OpenCodeSpiritGuide(() => connection.clientOptions(), {
        guideTimeoutMs: config.limits.guideTimeoutMs,
        makerTimeoutMs: config.limits.makerTimeoutMs,
        maxSessionTokens: config.limits.maxSessionTokens,
        maxSessionCostUsd: config.limits.maxSessionCostUsd,
      }),
      {
        safeDirectory: spiritWorkspace.real,
        demoWorkspace: demoWorkspace.real,
        budgets: {
          guideTimeoutMs: config.limits.guideTimeoutMs,
          makerTimeoutMs: config.limits.makerTimeoutMs,
          nodeCheckTimeoutMs: config.limits.nodeCheckTimeoutMs,
          maxSessionTokens: config.limits.maxSessionTokens,
          maxSessionCostUsd: config.limits.maxSessionCostUsd,
        },
        redact: { hideLocalPaths: config.hideLocalPaths },
        redactPrompts: config.redactPrompts,
        mode: config.mode,
        engine: connection,
      },
    )
  : undefined;

const sessions = connection
  ? new SessionActionsService(connection, () => workflow.get())
  : undefined;
const sources = new ProjectSourceService(workflow, { managedImportRoot: managedImportRoot.real });

const app = createApp({
  service: workflow,
  sessionToken: config.sessionToken,
  experience,
  sources,
  connection: connection ?? undefined,
  sessions,
  access: config.access ?? undefined,
  security: httpSecurityFromConfig(config),
  runtime: publicRuntimeConfig(config),
  logger: log,
  mode: config.mode === "hosted-demo" ? "demo" : config.mode === "private-hosted" ? "private-hosted" : "local",
});

const webRoot = resolve("dist/web");
const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".avif": "image/avif",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

try {
  await access(join(webRoot, "index.html"));
  const realWebRoot = await realpath(webRoot);
  app.get("*", async (context) => {
    if (context.req.path.startsWith("/api")) return context.notFound();
    let requested: string;
    try {
      requested = decodeURIComponent(context.req.path);
    } catch {
      return context.json({ code: "INVALID_PATH", message: "The requested path is not valid.", retryable: false }, 400);
    }
    if (requested.split("/").some((part) => part.startsWith("."))) return context.notFound();
    let file: string | null = null;
    try {
      file = await resolveStaticFile(realWebRoot, requested);
    } catch (error) {
      if (error instanceof WorkspacePolicyError) return context.notFound();
      throw error;
    }
    if (!file) {
      // The workshop has client-side routes (/demo, /workshop). Only an HTML
      // navigation may fall back to the shell; arbitrary paths stay 404.
      if (!(context.req.header("accept") ?? "").includes("text/html")) {
        return context.notFound();
      }
      file = join(realWebRoot, "index.html");
    }
    const body = await readFile(file);
    const isHtml = extname(file) === ".html";
    context.header("content-type", contentTypes[extname(file)] ?? "application/octet-stream");
    context.header("cache-control", isHtml ? "no-cache" : "public, max-age=31536000, immutable");
    return context.body(body);
  });
} catch {
  log.warn("web_bundle_missing", { message: "API-only until dist/web is built." });
}

export const server = serve({ fetch: app.fetch, hostname: config.hostname, port: config.port }, ({ address, port: boundPort }) => {
  log.info("server_listening", {
    mode: config.mode,
    address,
    port: boundPort,
    stateReady: storeReady,
    authRequired: Boolean(config.access),
  });
  if (config.mode === "local") {
    process.stdout.write(`Unfinished Business is ready: http://${config.hostname}:${boundPort}/\n`);
  }
});
server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    log.error("port_in_use", { port: config.port });
    process.exitCode = 1;
    return;
  }
  log.error("server_error", { code: error.code ?? "UNKNOWN" });
  process.exitCode = 1;
});

let shuttingDown = false;
function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info("server_stopping", { signal });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10_000).unref();
}
process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
