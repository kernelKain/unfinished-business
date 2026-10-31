import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { z } from "zod";
import type { RuntimeConfig } from "../shared/contracts.ts";

export const appModeSchema = z.enum(["local", "hosted-demo", "private-hosted"]);
export type AppMode = z.infer<typeof appModeSchema>;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface LimitsConfig {
  maxRequestBytes: number;
  rateLimitPerMinute: number;
  maxConcurrentMutations: number;
  maxSseConnections: number;
  guideTimeoutMs: number;
  makerTimeoutMs: number;
  nodeCheckTimeoutMs: number;
  maxSessionTokens: number;
  maxSessionCostUsd: number;
}

export interface RetentionConfig {
  actions: number;
  approvals: number;
  operations: number;
  evidence: number;
  transcript: number;
  witnessDrafts: number;
  backups: number;
  corruptFiles: number;
  backupMaxAgeDays: number;
}

export interface OpenCodeConfig {
  baseUrl: string;
  password: string | undefined;
  allowInsecureRemote: boolean;
  allowedHosts: string[];
  allowedPorts: number[];
  allowPrivateNetwork: boolean;
  requestTimeoutMs: number;
  maxResponseBytes: number;
}

export interface AppConfig {
  mode: AppMode;
  production: boolean;
  hostname: string;
  port: number;
  dataDirectory: string;
  demoWorkspace: string;
  spiritWorkspace: string;
  statePath: string;
  sessionToken: string;
  access: { username: string; password: string } | null;
  publicUrl: URL | null;
  allowedHosts: string[];
  allowedOrigins: string[];
  trustProxy: boolean;
  opencode: OpenCodeConfig;
  limits: LimitsConfig;
  retention: RetentionConfig;
  redactPrompts: boolean;
  hideLocalPaths: boolean;
}

const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1"
    || normalized.startsWith("127.");
}

function integer(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ConfigError(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function decimal(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new ConfigError(`${name} must be a number between ${min} and ${max}.`);
  }
  return value;
}

function bool(env: NodeJS.ProcessEnv, name: string, fallback = false): boolean {
  const raw = env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  throw new ConfigError(`${name} must be true or false.`);
}

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function detectMode(env: NodeJS.ProcessEnv = process.env): AppMode {
  const explicit = env.UB_MODE?.trim();
  if (explicit) {
    const parsed = appModeSchema.safeParse(explicit);
    if (!parsed.success) throw new ConfigError("UB_MODE must be local, hosted-demo, or private-hosted.");
    return parsed.data;
  }
  if (env.RENDER) return "hosted-demo";
  if (env.NODE_ENV === "production") return "private-hosted";
  return "local";
}

function parsePublicUrl(raw: string | undefined, mode: AppMode): URL | null {
  const value = raw?.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigError("UB_PUBLIC_URL must be an absolute URL.");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new ConfigError("UB_PUBLIC_URL must use http or https.");
  if (mode !== "local" && url.protocol !== "https:" && !isLoopbackHost(url.hostname)) {
    throw new ConfigError("UB_PUBLIC_URL must use HTTPS outside loopback.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new ConfigError("UB_PUBLIC_URL must not contain credentials, a query, or a fragment.");
  }
  return url;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const mode = detectMode(env);
  const production = mode !== "local" || env.NODE_ENV === "production";
  const hostname = env.UB_HOST?.trim() || (mode === "local" ? "127.0.0.1" : "0.0.0.0");
  if (mode === "local" && !isLoopbackHost(hostname)) {
    throw new ConfigError("Local mode must bind to a loopback address. Use UB_MODE=hosted-demo or private-hosted for a public listener.");
  }

  const ubPort = integer(env, "UB_PORT", 4200, 1, 65_535);
  const port = env.PORT?.trim() ? integer(env, "PORT", ubPort, 1, 65_535) : ubPort;
  const dataDirectory = resolve(env.UB_DATA_DIR?.trim() || ".unfinished-business");
  const demoWorkspace = resolve(dataDirectory, "demo-workspace");
  const spiritWorkspace = resolve(dataDirectory, "spirit-workspace");
  const statePath = resolve(dataDirectory, "project.json");

  const configuredToken = env.UB_SESSION_TOKEN?.trim();
  if (mode !== "local" && !configuredToken) {
    throw new ConfigError("UB_SESSION_TOKEN is required in hosted modes.");
  }
  const sessionToken = configuredToken || randomBytes(32).toString("base64url");

  const accessPassword = env.UB_ACCESS_PASSWORD?.trim();
  if (mode !== "local" && !accessPassword) {
    throw new ConfigError("UB_ACCESS_PASSWORD is required in hosted modes.");
  }

  const renderHost = env.RENDER_EXTERNAL_HOSTNAME?.trim();
  const publicUrl = parsePublicUrl(
    env.UB_PUBLIC_URL?.trim() || (renderHost ? `https://${renderHost}` : undefined),
    mode,
  );
  if (mode !== "local" && !publicUrl) {
    throw new ConfigError("UB_PUBLIC_URL or RENDER_EXTERNAL_HOSTNAME is required in hosted modes so origin checks are explicit.");
  }

  const allowedHosts = new Set([
    ...loopbackHosts,
    ...list(env.UB_ALLOWED_HOSTS),
    ...(publicUrl ? [publicUrl.host.toLowerCase()] : []),
  ]);
  const allowedOrigins = new Set([
    ...(publicUrl ? [publicUrl.origin] : []),
    ...list(env.UB_ALLOWED_ORIGINS),
  ]);

  const opencodeBaseUrl = env.OPENCODE_BASE_URL?.trim() || "http://127.0.0.1:4096";
  try {
    const parsed = new URL(opencodeBaseUrl);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error("invalid");
    }
  } catch {
    throw new ConfigError("OPENCODE_BASE_URL must be an absolute HTTP(S) URL without credentials, query, or fragment.");
  }
  const allowInsecureRemote = bool(env, "UB_OPENCODE_ALLOW_INSECURE_REMOTE")
    && mode === "local"
    && env.NODE_ENV !== "production";

  return {
    mode,
    production,
    hostname,
    port,
    dataDirectory,
    demoWorkspace,
    spiritWorkspace,
    statePath,
    sessionToken,
    access: accessPassword
      ? {
          username: env.UB_ACCESS_USERNAME?.trim() || "unfinished-business",
          password: accessPassword,
        }
      : null,
    publicUrl,
    allowedHosts: [...allowedHosts],
    allowedOrigins: [...allowedOrigins],
    trustProxy: mode !== "local" && bool(env, "UB_TRUST_PROXY", true),
    opencode: {
      baseUrl: opencodeBaseUrl,
      password: env.OPENCODE_PASSWORD?.trim() || undefined,
      allowInsecureRemote,
      allowedHosts: list(env.UB_OPENCODE_ALLOWED_HOSTS),
      allowedPorts: list(env.UB_OPENCODE_ALLOWED_PORTS).map((entry) => {
        const value = Number(entry);
        if (!Number.isInteger(value) || value < 1 || value > 65_535) {
          throw new ConfigError("UB_OPENCODE_ALLOWED_PORTS must contain comma-separated port numbers.");
        }
        return value;
      }),
      allowPrivateNetwork: bool(env, "UB_OPENCODE_ALLOW_PRIVATE_NETWORK"),
      requestTimeoutMs: integer(env, "UB_OPENCODE_REQUEST_TIMEOUT_MS", 300_000, 1_000, 900_000),
      maxResponseBytes: integer(env, "UB_OPENCODE_MAX_RESPONSE_BYTES", 8 * 1024 * 1024, 64 * 1024, 64 * 1024 * 1024),
    },
    limits: {
      maxRequestBytes: integer(env, "UB_MAX_REQUEST_BYTES", 64 * 1024, 1_024, 1024 * 1024),
      rateLimitPerMinute: integer(env, "UB_RATE_LIMIT_PER_MINUTE", 120, 1, 10_000),
      maxConcurrentMutations: integer(env, "UB_MAX_CONCURRENT_MUTATIONS", 1, 1, 16),
      maxSseConnections: integer(env, "UB_MAX_SSE_CONNECTIONS", 4, 1, 64),
      guideTimeoutMs: integer(env, "UB_GUIDE_TIMEOUT_MS", 90_000, 5_000, 600_000),
      makerTimeoutMs: integer(env, "UB_MAKER_TIMEOUT_MS", 180_000, 5_000, 900_000),
      nodeCheckTimeoutMs: integer(env, "UB_NODE_CHECK_TIMEOUT_MS", 30_000, 1_000, 300_000),
      maxSessionTokens: integer(env, "UB_MAX_SESSION_TOKENS", 200_000, 1_000, 10_000_000),
      maxSessionCostUsd: decimal(env, "UB_MAX_SESSION_COST_USD", 0, 0, 100),
    },
    retention: {
      actions: integer(env, "UB_RETENTION_ACTIONS", 500, 50, 100_000),
      approvals: integer(env, "UB_RETENTION_APPROVALS", 200, 20, 10_000),
      operations: integer(env, "UB_RETENTION_OPERATIONS", 200, 20, 10_000),
      evidence: integer(env, "UB_RETENTION_EVIDENCE", 200, 10, 10_000),
      transcript: integer(env, "UB_RETENTION_TRANSCRIPT", 40, 10, 1_000),
      witnessDrafts: integer(env, "UB_RETENTION_WITNESS_DRAFTS", 10, 1, 100),
      backups: integer(env, "UB_BACKUP_COUNT", 3, 1, 20),
      corruptFiles: integer(env, "UB_CORRUPT_FILE_COUNT", 5, 1, 50),
      backupMaxAgeDays: integer(env, "UB_BACKUP_MAX_AGE_DAYS", 30, 1, 3_650),
    },
    redactPrompts: bool(env, "UB_REDACT_PROMPTS"),
    hideLocalPaths: mode !== "local" || bool(env, "UB_REDACT_LOCAL_PATHS"),
  };
}

export function publicRuntimeConfig(config: AppConfig): RuntimeConfig {
  return {
    mode: config.mode,
    production: config.production,
    demoWorkspace: true as const,
    authRequired: Boolean(config.access),
    originProtection: true as const,
    opencode: {
      baseUrlKind: (isLoopbackHost(new URL(config.opencode.baseUrl).hostname) ? "loopback" : "remote") as "loopback" | "remote",
      model: "opencode/deepseek-v4.1-flash-free" as const,
    },
    budgets: {
      guideTimeoutMs: config.limits.guideTimeoutMs,
      makerTimeoutMs: config.limits.makerTimeoutMs,
      nodeCheckTimeoutMs: config.limits.nodeCheckTimeoutMs,
      maxSessionTokens: config.limits.maxSessionTokens,
      maxSessionCostUsd: config.limits.maxSessionCostUsd,
      toolCallBudget: null as null,
      toolCallBudgetLimitation: "OpenCode does not expose a reliable per-session tool-call count. Elapsed-time and session token budgets are enforced instead.",
    },
    limits: {
      maxRequestBytes: config.limits.maxRequestBytes,
      rateLimitPerMinute: config.limits.rateLimitPerMinute,
      maxConcurrentMutations: config.limits.maxConcurrentMutations,
      maxSseConnections: config.limits.maxSseConnections,
    },
    retention: config.retention,
  };
}

export type PublicRuntimeConfig = ReturnType<typeof publicRuntimeConfig>;

