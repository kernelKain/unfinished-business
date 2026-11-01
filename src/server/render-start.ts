import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLogger } from "./observability/logger.ts";
import { seedOpenCodeAuth } from "./opencode/auth-seed.ts";
import {
  classifyServerStartError,
  serverStartDiagnostic,
  resolveOpenCodeExecutable,
} from "./opencode/executable.ts";

const log = createLogger({ redact: { hideLocalPaths: true } });
const password = process.env.OPENCODE_PASSWORD?.trim();
if (!password) throw new Error("OPENCODE_PASSWORD is required on Render.");

const port = process.env.OPENCODE_PORT?.trim() || "4096";
const xdgRoot = process.env.UB_DATA_DIR?.trim() || tmpdir();
const dataHome = process.env.OPENCODE_DATA_HOME?.trim() || join(xdgRoot, "opencode-xdg-data");
const configHome = process.env.OPENCODE_CONFIG_HOME?.trim() || join(xdgRoot, "opencode-xdg-config");

// This entrypoint is the Render/private-hosted process supervisor. It uses the
// same platform-aware resolver as local diagnostics, so no Linux-only package
// path is embedded here.
const resolution = resolveOpenCodeExecutable();
if (!resolution.executable) {
  for (const diagnostic of resolution.diagnostics) {
    log.error("opencode_diagnostic", {
      code: diagnostic.code,
      severity: diagnostic.severity,
      title: diagnostic.title,
      message: diagnostic.message,
      repair: diagnostic.repair,
    });
  }
  process.exit(1);
}
for (const diagnostic of resolution.diagnostics) {
  log.warn("opencode_diagnostic", {
    code: diagnostic.code,
    severity: diagnostic.severity,
    title: diagnostic.title,
    message: diagnostic.message,
    repair: diagnostic.repair,
  });
}
log.info("opencode_resolved", {
  platform: resolution.platform.id,
  source: resolution.source,
  version: resolution.version,
});

try {
  if (await seedOpenCodeAuth(dataHome, process.env.OPENCODE_AUTH_JSON)) {
    log.info("opencode_auth_seeded", { source: "OPENCODE_AUTH_JSON" });
  }
} catch (error) {
  // Keep the site up so the sample and the connection screen still load; the
  // workshop reports the missing credentials when a model is selected.
  log.error("opencode_auth_invalid", { message: error instanceof Error ? error.message : "invalid OPENCODE_AUTH_JSON" });
}

const openCode = spawn(resolution.executable, ["serve", "--hostname", "127.0.0.1", "--port", port], {
  cwd: process.cwd(),
  stdio: ["ignore", "inherit", "inherit"],
  env: {
    ...process.env,
    OPENCODE_PASSWORD: password,
    OPENCODE_SERVER_PASSWORD: password,
    XDG_DATA_HOME: dataHome,
    XDG_CONFIG_HOME: configHome,
  },
});

await import("./instrument.ts");
let server: { close: (callback?: () => void) => void };
try {
  ({ server } = await import("./index.ts"));
} catch (error) {
  log.error("startup_failed", { message: error instanceof Error ? error.message : "unknown startup failure" });
  openCode.kill("SIGTERM");
  process.exit(1);
}
let shuttingDown = false;

function stop(exitCode: number, signal: NodeJS.Signals = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info("render_child_stopping", { signal, exitCode });
  openCode.kill(signal);
  server.close(() => process.exit(exitCode));
  setTimeout(() => process.exit(exitCode), 10_000).unref();
}

process.once("SIGTERM", () => stop(0, "SIGTERM"));
process.once("SIGINT", () => stop(0, "SIGINT"));

openCode.once("error", (error) => {
  const diagnostic = classifyServerStartError(error);
  log.error("opencode_start_failed", {
    code: diagnostic.code,
    title: diagnostic.title,
    message: diagnostic.message,
    repair: diagnostic.repair,
  });
  stop(1);
});
openCode.once("exit", (code, signal) => {
  if (shuttingDown) return;
  const diagnostic = serverStartDiagnostic(code ?? null, signal ?? null);
  log.error("opencode_exited", {
    code: diagnostic.code,
    title: diagnostic.title,
    message: diagnostic.message,
    repair: diagnostic.repair,
    exitCode: code ?? null,
    signal: signal ?? null,
  });
  stop(code && code > 0 ? code : 1);
});
