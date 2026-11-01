import { chmod, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type OpenCodeAuth = Record<string, { type: string } & Record<string, unknown>>;

export function parseOpenCodeAuth(raw: string): OpenCodeAuth {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OPENCODE_AUTH_JSON is not valid JSON. Check the Render secret; its value is not shown.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("OPENCODE_AUTH_JSON must be a JSON object keyed by provider.");
  }
  for (const [provider, entry] of Object.entries(parsed)) {
    if (!entry || typeof entry !== "object" || typeof (entry as { type?: unknown }).type !== "string") {
      throw new Error(`OPENCODE_AUTH_JSON entry "${provider}" must be an object with a string type.`);
    }
  }
  return parsed as OpenCodeAuth;
}

/**
 * Writes OpenCode's credential file from a secret so the Render disk does not
 * need a manual login. Returns false when no secret is configured.
 */
export async function seedOpenCodeAuth(dataHome: string, raw: string | undefined): Promise<boolean> {
  const value = raw?.trim();
  if (!value) return false;
  const auth = parseOpenCodeAuth(value);
  const directory = join(dataHome, "opencode");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, "auth.json");
  await writeFile(path, `${JSON.stringify(auth, null, 2)}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
  return true;
}
