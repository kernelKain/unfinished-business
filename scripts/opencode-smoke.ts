import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  classifyServerStartError,
  resolveOpenCodeExecutable,
  serverStartDiagnostic,
  type OpenCodeRuntimeDiagnostic,
} from "../src/server/opencode/executable.ts";

/**
 * Starts the resolved OpenCode server on a loopback ephemeral port, verifies
 * its version endpoint, and stops it. It sends no prompt and makes no model
 * call. Child output is suppressed so local paths or provider configuration
 * cannot leak into CI logs.
 */
function freeLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Could not allocate a loopback port.")));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    once(child, "exit").then(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}

function blocked(diagnostics: OpenCodeRuntimeDiagnostic[], detail?: string): void {
  console.log(JSON.stringify({
    status: "BLOCKED",
    platform: `${process.platform}-${process.arch}`,
    detail: detail ?? null,
    diagnostics,
    limits: "Server start/version smoke only. No prompt, model call, provider credential read, or project write.",
  }, null, 2));
  process.exitCode = 1;
}

const resolution = resolveOpenCodeExecutable();
if (!resolution.executable) {
  blocked(resolution.diagnostics);
  process.exit(1);
}

const port = await freeLoopbackPort();
const directory = await mkdtemp(join(tmpdir(), "ub-opencode-smoke-"));
const password = randomBytes(24).toString("base64url");
const { OPENCODE_PASSWORD: _password, OPENCODE_SERVER_PASSWORD: _serverPassword, ...inherited } = process.env;
let stopping = false;
const child = spawn(
  resolution.executable,
  ["serve", "--hostname", "127.0.0.1", "--port", String(port)],
  {
    cwd: process.cwd(),
    stdio: ["ignore", "ignore", "ignore"],
    env: {
      ...inherited,
      OPENCODE_PASSWORD: password,
      OPENCODE_SERVER_PASSWORD: password,
      XDG_DATA_HOME: join(directory, "data"),
      XDG_CONFIG_HOME: join(directory, "config"),
      XDG_CACHE_HOME: join(directory, "cache"),
      XDG_STATE_HOME: join(directory, "state"),
    },
  },
);

let startFailure: OpenCodeRuntimeDiagnostic | null = null;
child.once("error", (error) => {
  startFailure = classifyServerStartError(error);
});
child.once("exit", (code, signal) => {
  if (stopping || startFailure) return;
  startFailure = serverStartDiagnostic(code, signal);
});

let serverVersion: string | null = null;
try {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && !startFailure) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/info`, {
        headers: { authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}` },
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) {
        const body = await response.json() as { version?: unknown };
        serverVersion = typeof body.version === "string" ? body.version : "unknown";
        break;
      }
    } catch {
      // The server may still be binding; retry until the deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
} finally {
  stopping = true;
  await stop(child);
  await rm(directory, { recursive: true, force: true });
}

if (!serverVersion) {
  blocked(
    [startFailure ?? serverStartDiagnostic()],
    "The resolved OpenCode CLI did not answer its version endpoint within 30 seconds.",
  );
} else {
  console.log(JSON.stringify({
    status: "PASS",
    platform: resolution.platform.id,
    cliVersion: resolution.version,
    serverVersion,
    limits: "Server start/version smoke only. No prompt, model call, provider credential read, or project write.",
  }, null, 2));
  process.exitCode = 0;
}
