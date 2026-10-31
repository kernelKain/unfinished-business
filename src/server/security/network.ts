import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { isLoopbackHost } from "../config.ts";
import { redactText } from "./redaction.ts";

export type NetworkErrorCode =
  | "OPENCODE_URL_INVALID"
  | "OPENCODE_INSECURE_REMOTE"
  | "OPENCODE_HOST_BLOCKED"
  | "OPENCODE_PORT_BLOCKED"
  | "OPENCODE_PRIVATE_ADDRESS"
  | "OPENCODE_REDIRECT_BLOCKED"
  | "OPENCODE_RESPONSE_TOO_LARGE"
  | "OPENCODE_TIMEOUT";

export class NetworkPolicyError extends Error {
  constructor(readonly code: NetworkErrorCode, message: string) {
    super(message);
    this.name = "NetworkPolicyError";
  }
}

export interface ResolvedAddress {
  address: string;
  family: number;
}

export interface NetworkPolicy {
  baseUrl: string;
  allowInsecureRemote?: boolean;
  allowedHosts?: string[];
  allowedPorts?: number[];
  allowPrivateNetwork?: boolean;
  requestTimeoutMs?: number;
  maxResponseBytes?: number;
  resolver?: (hostname: string) => Promise<ResolvedAddress[]>;
  fetchImpl?: typeof fetch;
}

const metadataAddresses = new Set([
  "169.254.169.254",
  "100.100.100.200",
  "fd00:ec2::254",
]);

function normalizeHost(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
}

function parseIPv4(address: string): number[] | null {
  if (isIP(address) !== 4) return null;
  const parts = address.split(".").map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ? parts
    : null;
}

function isPrivateIPv4(address: string): boolean {
  const parts = parseIPv4(address);
  if (!parts) return false;
  const [a, b] = parts;
  return a === 10
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127)
    || a === 0
    || a === 127;
}

function isBlockedIPv4(address: string): boolean {
  const parts = parseIPv4(address);
  if (!parts) return false;
  const [a, b] = parts;
  return metadataAddresses.has(address)
    || (a === 169 && b === 254)
    || (a >= 224)
    || (a === 255);
}

function isPrivateIPv6(address: string): boolean {
  const value = address.toLowerCase();
  return value === "::1"
    || value.startsWith("fc")
    || value.startsWith("fd")
    || value.startsWith("fe8")
    || value.startsWith("fe9")
    || value.startsWith("fea")
    || value.startsWith("feb");
}

function isBlockedIPv6(address: string): boolean {
  const value = address.toLowerCase();
  return metadataAddresses.has(value)
    || value === "::"
    || value.startsWith("ff")
    || value.startsWith("fe80");
}

export function validateBaseUrlSyntax(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new NetworkPolicyError("OPENCODE_URL_INVALID", "OPENCODE_BASE_URL must be an absolute URL.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new NetworkPolicyError("OPENCODE_URL_INVALID", "OPENCODE_BASE_URL must use HTTP or HTTPS.");
  }
  if (url.username || url.password) {
    throw new NetworkPolicyError("OPENCODE_URL_INVALID", "OPENCODE_BASE_URL must not contain credentials.");
  }
  if (url.search || url.hash) {
    throw new NetworkPolicyError("OPENCODE_URL_INVALID", "OPENCODE_BASE_URL must not contain a query or fragment.");
  }
  if (!url.hostname) {
    throw new NetworkPolicyError("OPENCODE_URL_INVALID", "OPENCODE_BASE_URL must include a host.");
  }
  if (url.port === "0") {
    throw new NetworkPolicyError("OPENCODE_PORT_BLOCKED", "OPENCODE_BASE_URL must not use port 0.");
  }
  return url;
}

export async function assertAllowedUrl(url: URL, policy: NetworkPolicy): Promise<ResolvedAddress[]> {
  const parsed = validateBaseUrlSyntax(url.toString());
  const hostname = normalizeHost(parsed.hostname);
  const loopback = isLoopbackHost(hostname);
  const allowedHosts = new Set((policy.allowedHosts ?? []).map(normalizeHost));
  const port = parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80;
  if (policy.allowedPorts?.length && !policy.allowedPorts.includes(port)) {
    throw new NetworkPolicyError("OPENCODE_PORT_BLOCKED", `OpenCode port ${port} is not in UB_OPENCODE_ALLOWED_PORTS.`);
  }

  if (!loopback) {
    if (parsed.protocol !== "https:" && !policy.allowInsecureRemote) {
      throw new NetworkPolicyError(
        "OPENCODE_INSECURE_REMOTE",
        "A non-loopback OpenCode URL must use HTTPS. Set the documented local development exception only for loopback testing.",
      );
    }
    if (!allowedHosts.has(hostname)) {
      throw new NetworkPolicyError(
        "OPENCODE_HOST_BLOCKED",
        "The OpenCode host is not in UB_OPENCODE_ALLOWED_HOSTS.",
      );
    }
  }

  const literal = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : null;
  let addresses: ResolvedAddress[];
  if (literal) {
    addresses = literal;
  } else if (loopback) {
    addresses = [{ address: hostname === "localhost" ? "127.0.0.1" : hostname, family: hostname.includes(":") ? 6 : 4 }];
  } else {
    const resolver = policy.resolver ?? (async (host) => lookup(host, { all: true, verbatim: true }));
    try {
      addresses = await resolver(hostname);
    } catch (error) {
      throw new NetworkPolicyError(
        "OPENCODE_HOST_BLOCKED",
        `OpenCode host resolution failed: ${redactText(error instanceof Error ? error.message : "unknown error")}`,
      );
    }
  }
  if (addresses.length === 0) {
    throw new NetworkPolicyError("OPENCODE_HOST_BLOCKED", "OpenCode host did not resolve to an address.");
  }

  for (const address of addresses) {
    const value = address.address;
    const family = address.family || (isIP(value) === 6 ? 6 : 4);
    if (metadataAddresses.has(value)) {
      throw new NetworkPolicyError("OPENCODE_PRIVATE_ADDRESS", "The OpenCode host resolves to a cloud metadata address.");
    }
    if (family === 4) {
      if (!loopback && (value.startsWith("127.") || value === "0.0.0.0")) {
        throw new NetworkPolicyError("OPENCODE_PRIVATE_ADDRESS", "A non-loopback OpenCode host resolved to a loopback or unspecified address.");
      }
      if (isBlockedIPv4(value)) {
        throw new NetworkPolicyError("OPENCODE_PRIVATE_ADDRESS", "The OpenCode host resolves to a blocked address.");
      }
      if (!loopback && isPrivateIPv4(value) && !policy.allowPrivateNetwork) {
        throw new NetworkPolicyError(
          "OPENCODE_PRIVATE_ADDRESS",
          "The OpenCode host resolves to a private address. Set UB_OPENCODE_ALLOW_PRIVATE_NETWORK only when that network is intended.",
        );
      }
      if (loopback && !value.startsWith("127.")) {
        throw new NetworkPolicyError("OPENCODE_HOST_BLOCKED", "The loopback OpenCode host resolved to a non-loopback address.");
      }
    } else {
      if (!loopback && (value === "::1" || value === "::")) {
        throw new NetworkPolicyError("OPENCODE_PRIVATE_ADDRESS", "A non-loopback OpenCode host resolved to a loopback or unspecified address.");
      }
      if (isBlockedIPv6(value)) {
        throw new NetworkPolicyError("OPENCODE_PRIVATE_ADDRESS", "The OpenCode host resolves to a blocked IPv6 address.");
      }
      if (!loopback && isPrivateIPv6(value) && !policy.allowPrivateNetwork) {
        throw new NetworkPolicyError(
          "OPENCODE_PRIVATE_ADDRESS",
          "The OpenCode host resolves to a private IPv6 address. Set UB_OPENCODE_ALLOW_PRIVATE_NETWORK only when that network is intended.",
        );
      }
      if (loopback && value !== "::1") {
        throw new NetworkPolicyError("OPENCODE_HOST_BLOCKED", "The loopback OpenCode host resolved to a non-loopback address.");
      }
    }
  }
  return addresses;
}

function requestSignal(signal: AbortSignal | null | undefined, timeoutMs: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("OpenCode request timed out.")), timeoutMs);
  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    clear: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

function boundedBody(body: ReadableStream<Uint8Array> | null, limit: number): ReadableStream<Uint8Array> | null {
  if (!body) return null;
  let seen = 0;
  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      seen += chunk.byteLength;
      if (seen > limit) {
        controller.error(new NetworkPolicyError("OPENCODE_RESPONSE_TOO_LARGE", "The OpenCode response exceeded the configured size limit."));
        return;
      }
      controller.enqueue(chunk);
    },
  }));
}

export function createSafeFetch(policy: NetworkPolicy): typeof fetch {
  const fetchImpl = policy.fetchImpl ?? globalThis.fetch;
  const timeoutMs = policy.requestTimeoutMs ?? 300_000;
  const maxBytes = policy.maxResponseBytes ?? 8 * 1024 * 1024;

  return async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const requestUrl = input instanceof Request ? input.url : input.toString();
    const url = validateBaseUrlSyntax(requestUrl);
    await assertAllowedUrl(url, policy);
    const timeout = requestSignal(init?.signal, timeoutMs);
    try {
      const response = await fetchImpl(input, {
        ...init,
        redirect: "manual",
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: timeout.signal,
      });
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel();
        throw new NetworkPolicyError("OPENCODE_REDIRECT_BLOCKED", "The OpenCode server attempted an HTTP redirect. Redirects are not followed.");
      }
      const contentLength = Number(response.headers.get("content-length") ?? "0");
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        await response.body?.cancel();
        throw new NetworkPolicyError("OPENCODE_RESPONSE_TOO_LARGE", "The OpenCode response exceeded the configured size limit.");
      }
      const body = boundedBody(response.body, maxBytes);
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      if (error instanceof NetworkPolicyError) throw error;
      if (timeout.signal.aborted) {
        throw new NetworkPolicyError("OPENCODE_TIMEOUT", "The OpenCode request timed out.");
      }
      throw error;
    } finally {
      timeout.clear();
    }
  } as typeof fetch;
}

export function sanitizeNetworkError(error: unknown): string {
  if (error instanceof NetworkPolicyError) return error.message;
  const message = error instanceof Error ? error.message : "OpenCode could not be reached.";
  return redactText(message);
}
