import { spawnSync } from "node:child_process";
import { createServer } from "node:net";

export function portIsFree(port: number, hostname: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once("error", () => resolve(false));
    probe.listen(port, hostname, () => probe.close(() => resolve(true)));
  });
}

export function portOwner(port: number): string | null {
  const ss = spawnSync("ss", ["-ltnp"], { encoding: "utf8" });
  if (!ss.error && ss.stdout) {
    const line = ss.stdout.split("\n").find((entry) => entry.includes(`:${port} `));
    if (line) return line.replace(/\s+/g, " ").trim();
  }
  const lsof = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" });
  const row = lsof.stdout?.split("\n")[1]?.trim();
  return row || null;
}

export async function openCodeReachable(baseUrl: string, timeoutMs = 2_000): Promise<boolean> {
  try {
    const response = await fetch(new URL("global/health", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`), {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return response.ok || response.status === 401 || response.status === 403;
  } catch {
    return false;
  }
}
