import { OpenCode } from "@opencode/client";
import {
  assertAllowedUrl,
  createSafeFetch,
  NetworkPolicyError,
  sanitizeNetworkError,
  validateBaseUrlSyntax,
  type NetworkPolicy,
} from "../security/network.ts";
import { redactText } from "../security/redaction.ts";
import { nativeEngineStatusSchema, type NativeEngineStatus } from "../../shared/contracts.ts";

export const FREE_DEEPSEEK_MODEL = "opencode/deepseek-v4.1-flash-free" as const;
export const REQUIRED_OPENCODE_MAJOR = 2;

export interface NativeClientOptions {
  baseUrl: string;
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
    ? `Basic ${Buffer.from(`opencode:${options.password}`).toString("base64")}`
    : undefined;

  return OpenCode.make({
    baseUrl: url.toString(),
    fetch: createSafeFetch(networkPolicy(options)),
    headers: authorization ? { authorization } : undefined,
  });
}

function looksLikeAuthFailure(message: string): boolean {
  return /\b401\b|unauthori[sz]ed|authentication|invalid credentials|forbidden/i.test(message);
}

function looksLikeVersionFailure(message: string): boolean {
  return /\bversion\b|incompatible|\b404\b|not found/i.test(message);
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
    const modelAvailable = models.data.some((model) =>
      `${model.providerID}/${model.id}` === FREE_DEEPSEEK_MODEL,
    );

    return nativeEngineStatusSchema.parse({
      available: true,
      serverVersion: server.version,
      versionCompatible,
      authenticated: true,
      mode,
      model: FREE_DEEPSEEK_MODEL,
      modelAvailable,
      limitation: versionCompatible
        ? modelAvailable
          ? null
          : "The required free DeepSeek model is not in the native catalog."
        : `OpenCode ${server.version} is not compatible with this build; version ${REQUIRED_OPENCODE_MAJOR}.x is required.`,
    });
  } catch (error) {
    const sanitized = sanitizeNetworkError(error);
    const auth = looksLikeAuthFailure(sanitized);
    const version = looksLikeVersionFailure(sanitized);
    return nativeEngineStatusSchema.parse({
      available: false,
      serverVersion: null,
      versionCompatible: !version,
      authenticated: !auth,
      mode,
      model: FREE_DEEPSEEK_MODEL,
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
 * Checks reachability, version, authentication state, and model availability
 * before a mutating native call. Failures are explicit and never silently
 * substitute another model or provider.
 */
export async function assertEngineReady(options: NativeClientOptions): Promise<NativeEngineStatus> {
  const status = await probeNativeEngine(options);
  if (!status.available) {
    if (!status.authenticated) throw engineError("ENGINE_AUTH", "OpenCode authentication is not ready. Check OPENCODE_PASSWORD and start the server again.", false);
    if (!status.versionCompatible) throw engineError("ENGINE_INCOMPATIBLE", "The OpenCode server version is not compatible with this build.", false);
    throw engineError("ENGINE_UNAVAILABLE", status.limitation ?? "OpenCode is unavailable.", true);
  }
  if (!status.versionCompatible) throw engineError("ENGINE_INCOMPATIBLE", status.limitation ?? "OpenCode version is incompatible.", false);
  if (!status.modelAvailable) throw engineError("MODEL_UNAVAILABLE", status.limitation ?? "The required free DeepSeek model is unavailable.", false);
  return status;
}
