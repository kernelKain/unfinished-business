import { resolveOpenCodeExecutable } from "../src/server/opencode/executable.ts";

/**
 * Resolves the OpenCode CLI for the current platform and prints safe,
 * actionable diagnostics. It never prints the executable path, credentials, or
 * prompts, and it performs no model inference.
 */
const resolution = resolveOpenCodeExecutable();
const pass = Boolean(resolution.executable);
console.log(JSON.stringify({
  status: pass ? "PASS" : "BLOCKED",
  platform: resolution.platform.id,
  source: resolution.source,
  version: resolution.version,
  diagnostics: resolution.diagnostics,
  limits: "CLI resolution and version probe only. No server start, model call, provider credential read, or project write.",
}, null, 2));
process.exitCode = pass ? 0 : 1;
