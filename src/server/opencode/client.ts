import { OpenCode } from "@opencode/client";
import {
  SUPPORTED_OPENCODE_MAJOR,
  TESTED_OPENCODE_VERSION,
  type OpenCodeConnectionState,
} from "../../shared/opencode.ts";
import { nativeEngineStatusSchema, type NativeEngineStatus } from "../../shared/contracts.ts";
import {
  assertAllowedUrl,
  createSafeFetch,
  NetworkPolicyError,
  sanitizeNetworkError,
  validateBaseUrlSyntax,
  type NetworkPolicy,
} from "../security/network.ts";
import { redactText } from "../security/redaction.ts";

export const FREE_DEEPSEEK_MODEL = "opencode/deepseek-v4.1-flash-free" as const;
export const REQUIRED_OPENCODE_MAJOR = SUPPORTED_OPENCODE_MAJOR;

export interface NativeClientOptions {
  baseUrl: string;
  username?: string;
  password?: string;
  mode?: "local" | "hosted-demo" | "private-hosted";
  allowInsecureRemote?: boolean;
  allowedHosts?: string[];
  allowedPorts?: number[];
  allowPrivateNetwork?: boolean;
  requestTimeoutMs?: number;
  maxResponseBytes?: number;
  resolver?: NetworkPolicy["resolver"];
  fetchImpl?: typeof fetch;
}

export interface NativeEngineError extends Error {
  code: "ENGINE_UNAVAILABLE" | "ENGINE_INCOMPATIBLE" | "ENGINE_AUTH" | "MODEL_UNAVAILABLE";
  retryable: boolean;
}

export function engineError(code: NativeEngineError["code"], message: string, retryable: boolean): NativeEngineError {
  const error = new Error(redactText(message)) as NativeEngineError;
  error.name = "NativeEngineError";
  error.code = code;
  error.retryable = retryable;
  return error;
}

export function networkPolicy(options: NativeClientOptions): NetworkPolicy {
  return {
    baseUrl: options.baseUrl,
    allowInsecureRemote: options.allowInsecureRemote,
    allowedHosts: options.allowedHosts,
    allowedPorts: options.allowedPorts,
    allowPrivateNetwork: options.allowPrivateNetwork,
    requestTimeoutMs: options.requestTimeoutMs,
    maxResponseBytes: options.maxResponseBytes,
    resolver: options.resolver,
    fetchImpl: options.fetchImpl,
  };
}

export function createNativeClient(options: NativeClientOptions) {
  const url = validateBaseUrlSyntax(options.baseUrl);
  const authorization = options.password
    ? `Basic ${Buffer.from(`${options.username || "opencode"}:${options.password}`).toString("base64")}`
    : undefined;

  return OpenCode.make({
    baseUrl: url.toString(),
    fetch: createSafeFetch(networkPolicy(options)),
    headers: authorization ? { authorization } : undefined,
  });
}

export class ConnectionConfigError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID_URL" | "REMOTE_HTTP_FORBIDDEN" | "URL_CREDENTIALS_FORBIDDEN" | "UNSUPPORTED_SCHEME",
  ) {
    super(message);
  }
}

export interface ValidatedServerUrl {
  url: string;
  loopback: boolean;
  https: boolean;
}

/**
 * Validates the OpenCode server address accepted by this application.
 *
 * Local deployments may use loopback HTTP because the connection never leaves
 * the machine. Any non-loopback address must use HTTPS; the network policy
 * additionally requires an explicit host allowlist and blocks private and
 * metadata addresses unless separately configured.
 */
export function validateServerUrl(raw: string): ValidatedServerUrl {
  const input = raw.trim();
  if (!input) throw new ConnectionConfigError("Enter an OpenCode server URL.", "INVALID_URL");
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new ConnectionConfigError("The OpenCode server URL is not a valid absolute URL.", "INVALID_URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ConnectionConfigError("Only http:// (loopback) and https:// OpenCode URLs are supported.", "UNSUPPORTED_SCHEME");
  }
  if (parsed.username || parsed.password) {
    throw new ConnectionConfigError("Do not put credentials in the server URL. Enter the OpenCode password separately.", "URL_CREDENTIALS_FORBIDDEN");
  }
  if (parsed.search || parsed.hash) {
    throw new ConnectionConfigError("The OpenCode server URL must not include a query string or fragment.", "INVALID_URL");
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const loopback = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.startsWith("127.");
  if (parsed.protocol === "http:" && !loopback) {
    throw new ConnectionConfigError("A non-loopback OpenCode URL requires HTTPS.", "REMOTE_HTTP_FORBIDDEN");
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return { url: parsed.toString().replace(/\/$/, ""), loopback, https: parsed.protocol === "https:" };
}

export interface VersionCompatibility {
  compatible: boolean;
  major: number | null;
  warning: string | null;
}

export function checkVersionCompatibility(version: string): VersionCompatibility {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) {
    return { compatible: false, major: null, warning: "The server did not report a parseable semantic version." };
  }
  const major = Number(match[1]);
  if (major !== SUPPORTED_OPENCODE_MAJOR) {
    return {
      compatible: false,
      major,
      warning: `OpenCode server ${version} is outside the tested major version ${SUPPORTED_OPENCODE_MAJOR}.`,
    };
  }
  if (version.trim() !== TESTED_OPENCODE_VERSION) {
    return {
      compatible: true,
      major,
      warning: `OpenCode server ${version} is a ${SUPPORTED_OPENCODE_MAJOR}.x release, but this build is tested against ${TESTED_OPENCODE_VERSION}. Some capability probes may be unavailable.`,
    };
  }
  return { compatible: true, major, warning: null };
}

export interface ClassifiedFailure {
  code:
    | "AUTH_REQUIRED"
    | "ORIGIN_BLOCKED"
    | "UNAVAILABLE"
    | "TIMEOUT"
    | "MALFORMED"
    | "VERSION_INCOMPATIBLE"
    | "UNKNOWN";
  status: number | null;
  message: string;
  state: OpenCodeConnectionState;
}

function errorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { cause?: unknown; status?: unknown; detail?: unknown };
  if (typeof candidate.status === "number") return candidate.status;
  if (candidate.cause && typeof candidate.cause === "object") {
    const nested = candidate.cause as { status?: unknown };
    if (typeof nested.status === "number") return nested.status;
  }
  if (typeof candidate.detail === "string" && /^\d{3}$/.test(candidate.detail)) return Number(candidate.detail);
  return null;
}

function errorTag(error: unknown): string | null {
  return error && typeof error === "object" && typeof (error as { _tag?: unknown })._tag === "string"
    ? (error as { _tag: string })._tag
    : null;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return String(error);
}

export function classifyConnectionError(error: unknown): ClassifiedFailure {
  const status = errorStatus(error);
  const tag = errorTag(error);
  const raw = errorMessage(error);
  const message = redactSecrets(raw);

  if (status === 401 || tag === "UnauthorizedError" || /authentication required|unauthori[sz]ed|password/i.test(message)) {
    return { code: "AUTH_REQUIRED", status: status ?? 401, message, state: "authentication_required" };
  }
  if (status === 403 || /origin|cors|forbidden|not allowed/i.test(message)) {
    return { code: "ORIGIN_BLOCKED", status: status ?? 403, message, state: "unavailable" };
  }
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|fetch failed|network|socket|connect/i.test(message)) {
    return { code: "UNAVAILABLE", status, message, state: "unavailable" };
  }
  if (/timed out|timeout|aborted|AbortError/i.test(message)) {
    return { code: "TIMEOUT", status, message, state: "unavailable" };
  }
  if (/malformed|unexpected content|parse|decode/i.test(message)) {
    return { code: "MALFORMED", status, message, state: "unavailable" };
  }
  return { code: "UNKNOWN", status, message, state: "unavailable" };
}

const secretPatterns: Array<[RegExp, string]> = [
  [/(authorization\s*[:=]\s*)(basic|bearer)?\s*[^\s,;]+/gi, "$1[redacted]"],
  [/((?:password|api[_-]?key|access[_-]?token|secret|OPENCODE_PASSWORD|OPENCODE_API_KEY)\s*[:=]\s*)[^\s,;]+/gi, "$1[redacted]"],
  [/(https?:\/\/)([^/@\s]+)@/gi, "$1[redacted]@"],
  [/(Basic|Bearer)\s+[A-Za-z0-9+/=._-]{8,}/g, "$1 [redacted]"],
];

/** Removes credential-shaped values from anything that may be logged or returned. */
export function redactSecrets(value: string): string {
  let redacted = value;
  for (const [pattern, replacement] of secretPatterns) redacted = redacted.replace(pattern, replacement);
  return redacted;
}

export async function probeNativeEngine(options: NativeClientOptions): Promise<NativeEngineStatus> {
  const mode = options.mode ?? "local";
  try {
    const url = validateBaseUrlSyntax(options.baseUrl);
    await assertAllowedUrl(url, networkPolicy(options));
    const client = createNativeClient(options);
    const [server, models] = await Promise.all([
      client.server.info(),
      client.model.list(),
    ]);
    const versionCompatible = new RegExp(`^${REQUIRED_OPENCODE_MAJOR}\\.`).test(server.version);
    const reportedModel = models.data.find((model) => model.enabled !== false) ?? null;
    const modelAvailable = reportedModel !== null;

    return nativeEngineStatusSchema.parse({
      available: true,
      serverVersion: server.version,
      versionCompatible,
      authenticated: true,
      mode,
      model: reportedModel ? `${reportedModel.providerID}/${reportedModel.id}` : null,
      modelAvailable,
      limitation: versionCompatible
        ? modelAvailable
          ? null
          : "OpenCode reported no available model in the native catalog."
        : `OpenCode ${server.version} is not compatible with this build; version ${REQUIRED_OPENCODE_MAJOR}.x is required.`,
    });
  } catch (error) {
    const sanitized = sanitizeNetworkError(error);
    const auth = /401|unauthori[sz]ed|authentication|invalid credentials|forbidden/i.test(sanitized);
    const version = /version|incompatible|404|not found/i.test(sanitized);
    return nativeEngineStatusSchema.parse({
      available: false,
      serverVersion: null,
      versionCompatible: !version,
      authenticated: !auth,
      mode,
      model: null,
      modelAvailable: false,
      limitation: error instanceof NetworkPolicyError
        ? sanitized
        : auth
          ? "OpenCode rejected the configured credentials."
          : version
            ? "OpenCode did not expose a compatible server contract."
            : sanitized || "Native OpenCode is unavailable.",
    });
  }
}

/**
 * Checks reachability, version, and authentication before a native call.
 * Model availability is checked by the selected-model path in the connection
 * service; this function refuses a paid fallback only through that path.
 */
export async function assertEngineReady(options: NativeClientOptions): Promise<NativeEngineStatus> {
  const status = await probeNativeEngine(options);
  if (!status.available) {
    if (!status.authenticated) throw engineError("ENGINE_AUTH", "OpenCode authentication is not ready. Check OPENCODE_PASSWORD and start the server again.", false);
    if (!status.versionCompatible) throw engineError("ENGINE_INCOMPATIBLE", "The OpenCode server version is not compatible with this build.", false);
    throw engineError("ENGINE_UNAVAILABLE", status.limitation ?? "OpenCode is unavailable.", true);
  }
  if (!status.versionCompatible) throw engineError("ENGINE_INCOMPATIBLE", status.limitation ?? "OpenCode version is incompatible.", false);
  return status;
}
