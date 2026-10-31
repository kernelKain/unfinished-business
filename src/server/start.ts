import "./instrument.ts";
import { redactError } from "./security/redaction.ts";

let server: unknown;
try {
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
