import { spawn } from "node:child_process";
import { resolve } from "node:path";

const password = process.env.OPENCODE_PASSWORD?.trim();
if (!password) throw new Error("OPENCODE_PASSWORD is required on Render.");

const port = process.env.OPENCODE_PORT?.trim() || "4096";
const executable = resolve("node_modules/@opencode/cli-linux-x64-baseline/bin/opencode");
const openCode = spawn(executable, ["serve", "--hostname", "127.0.0.1", "--port", port], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: {
    ...process.env,
    OPENCODE_PASSWORD: password,
    OPENCODE_SERVER_PASSWORD: password,
  },
});

await import("./instrument.ts");
const { server } = await import("./index.ts");
let shuttingDown = false;

function stop(exitCode: number, signal: NodeJS.Signals = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  openCode.kill(signal);
  server.close(() => process.exit(exitCode));
  setTimeout(() => process.exit(exitCode), 10_000).unref();
}

process.once("SIGTERM", () => stop(0, "SIGTERM"));
process.once("SIGINT", () => stop(0, "SIGINT"));

openCode.once("error", (error) => {
  console.error("OpenCode failed to start.", error);
  stop(1);
});
openCode.once("exit", (code, signal) => {
  if (shuttingDown) return;
  console.error(`OpenCode exited unexpectedly (${signal ?? code ?? "unknown"}).`);
  stop(code && code > 0 ? code : 1);
});
