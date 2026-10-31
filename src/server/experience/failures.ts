import type { ProviderErrorDetails } from "../../shared/workflow.ts";
import { NetworkPolicyError } from "../security/network.ts";
import { classifyProviderError, isProviderFailureCandidate, ProviderRequestError } from "../opencode/provider-errors.ts";
import { NativeBudgetError, NativeSessionError, NativeTimeoutError } from "./guide.ts";

export interface NativeFailureClassification {
  code: string;
  status: number;
  retryable: boolean;
  unknown: boolean;
  message: string;
}

/**
 * Maps native-engine failures onto safe response classes. `unknown: true`
 * means the persisted operation must stay reconcilable because the native run
 * may still have changed the workspace.
 */
export function classifyNativeError(error: unknown): NativeFailureClassification {
  const declared = typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string }).code : null;
  if (declared === "ENGINE_AUTH") {
    return { code: "ENGINE_AUTH", status: 503, retryable: false, unknown: false, message: "OpenCode rejected the configured credentials." };
  }
  if (error instanceof ProviderRequestError) {
    return {
      code: error.details.category,
      status: error.details.technical.statusCode && error.details.technical.statusCode >= 400
        ? error.details.technical.statusCode
        : 502,
      retryable: error.details.retryable,
      unknown: false,
      message: error.details.whatHappened,
    };
  }
  if (declared === "ENGINE_INCOMPATIBLE" || declared === "MODEL_UNAVAILABLE" || declared === "MODEL_CHANGED") {
    return { code: declared, status: 503, retryable: false, unknown: false, message: error instanceof Error ? error.message : "OpenCode is not ready for this build." };
  }
  if (declared === "ENGINE_UNAVAILABLE") {
    return { code: "ENGINE_UNAVAILABLE", status: 503, retryable: true, unknown: false, message: "OpenCode is unavailable. No native work was started." };
  }
  if (error instanceof NativeBudgetError) {
    return { code: "BUDGET_EXCEEDED", status: 409, retryable: false, unknown: false, message: error.message };
  }
  if (error instanceof NativeSessionError) {
    return { code: error.code, status: 502, retryable: false, unknown: false, message: error.message };
  }
  if (error instanceof NativeTimeoutError) {
    return {
      code: "NATIVE_TIMEOUT",
      status: 503,
      retryable: false,
      unknown: true,
      message: "The native run timed out. Reconcile the native session before any new run.",
    };
  }
  if (error instanceof NetworkPolicyError) {
    return { code: "NATIVE_UNKNOWN", status: 503, retryable: false, unknown: true, message: error.message };
  }
  const message = error instanceof Error ? error.message : "The native spirit could not be reached.";
  if (/\b429\b|rate limit|quota|provider limit|too many requests/i.test(message)) {
    return { code: "PROVIDER_LIMITED", status: 429, retryable: true, unknown: false, message: "The provider is limiting requests. No automatic retry was attempted." };
  }
  if (/\b401\b|\b403\b|unauthori[sz]ed|forbidden|authentication/i.test(message)) {
    return { code: "ENGINE_AUTH", status: 503, retryable: false, unknown: false, message: "OpenCode rejected the configured credentials." };
  }
  if (/\b404\b|version|incompatible/i.test(message)) {
    return { code: "ENGINE_INCOMPATIBLE", status: 503, retryable: false, unknown: false, message: "OpenCode is not compatible with this build." };
  }
  if (/permission|approval required/i.test(message)) {
    return { code: "PERMISSION_PENDING", status: 409, retryable: false, unknown: false, message: "A native permission is pending. Resolve it in OpenCode, then reconcile." };
  }
  if (/timed out|timeout|ECONN|fetch|network|socket|unavailable/i.test(message)) {
    return { code: "NATIVE_UNKNOWN", status: 503, retryable: false, unknown: true, message: "Disconnected or timed out. Reconcile the native session before any new run." };
  }
  return { code: "NATIVE_FAILED", status: 502, retryable: true, unknown: false, message };
}

/**
 * True when the failure leaves the native outcome unreadable: a timed-out run,
 * a disconnected session, or anything carrying a native session reference.
 * Such operations are recorded as ABANDONED and reconcile, never as clean
 * failures, so a late result is never silently discarded.
 */
export function failureIsUncertain(message: string, error?: unknown): boolean {
  const code = typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string }).code : "";
  if (["BUDGET_EXCEEDED", "NATIVE_TIMEOUT", "NATIVE_UNKNOWN"].includes(code)) return true;
  if (classifyNativeError(error).unknown) return true;
  if (typeof (error as { nativeSessionId?: unknown })?.nativeSessionId === "string") return true;
  return /timed out|timeout|ECONN|fetch|network|socket|unavailable|interrupted/i.test(message);
}

const nonProviderCodes = [
  "ENGINE_AUTH",
  "ENGINE_INCOMPATIBLE",
  "ENGINE_UNAVAILABLE",
  "MODEL_CHANGED",
  "BUDGET_EXCEEDED",
  "NATIVE_TIMEOUT",
  "NATIVE_UNKNOWN",
  "EMPTY_RESPONSE",
];

/** Builds a safe provider error payload, or null for engine-internal failures. */
export function providerErrorFor(
  error: unknown,
  provider: string,
  sessionReference: string | null,
  savedWorkChanged: "no" | "possibly" = sessionReference ? "possibly" : "no",
): ProviderErrorDetails | null {
  const code = typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string }).code : "";
  if (nonProviderCodes.includes(code) || error instanceof NetworkPolicyError) return null;
  if (!isProviderFailureCandidate(error)) return null;
  return classifyProviderError(error, { provider, sessionReference, savedWorkChanged }).details;
}
