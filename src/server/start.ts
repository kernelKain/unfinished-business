import "./instrument.ts";
import { loadConfig } from "./config.ts";
import { openCodeReachable, portIsFree, portOwner } from "./launch-check.ts";
import { redactError } from "./security/redaction.ts";

let server: unknown;
try {
  const config = loadConfig();
  if (config.mode === "local") {
    if (!(await portIsFree(config.port, config.hostname))) {
      const owner = portOwner(config.port);
      console.error(`Port ${config.port} is already in use${owner ? ` by: ${owner}` : ""}. Set UB_PORT to a free port in .env, or stop that process.`);
      process.exit(1);
    }
    if (!(await openCodeReachable(config.opencode.baseUrl))) {
      console.warn(`OpenCode is not reachable at ${config.opencode.baseUrl}. In another terminal run: npx --no-install opencode serve --hostname 127.0.0.1 --port 4096`);
    }
  }
  ({ server } = await import("./index.ts"));
} catch (error) {
  const safe = redactError(error, { hideLocalPaths: true });
  console.error(JSON.stringify({
    time: new Date().toISOString(),
    level: "error",
    event: "startup_failed",
    name: safe.name,
    message: safe.message,
    code: safe.code,
  }));
  process.exit(1);
}

export { server };
