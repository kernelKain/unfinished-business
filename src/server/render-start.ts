import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { createLogger } from "./observability/logger.ts";

const log = createLogger({ redact: { hideLocalPaths: true } });
const password = process.env.OPENCODE_PASSWORD?.trim();
if (!password) throw new Error("OPENCODE_PASSWORD is required on Render.");

const port = process.env.OPENCODE_PORT?.trim() || "4096";
const dataHome = process.env.OPENCODE_DATA_HOME?.trim() || "/var/data/xdg-data";
const configHome = process.env.OPENCODE_CONFIG_HOME?.trim() || "/var/data/xdg-config";
const executable = resolve("node_modules/@opencode/cli-linux-x64-baseline/bin/opencode");
const openCode = spawn(executable, ["serve", "--hostname", "127.0.0.1", "--port", port], {
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
  log.error("opencode_start_failed", { message: error.message });
  stop(1);
});
openCode.once("exit", (code, signal) => {
  if (shuttingDown) return;
  log.error("opencode_exited", { code: code ?? null, signal: signal ?? null });
  stop(code && code > 0 ? code : 1);
});
