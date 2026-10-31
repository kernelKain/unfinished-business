import { randomUUID } from "node:crypto";
import type { ProviderErrorDetails } from "../../shared/workflow.ts";
import { redactText } from "../security/redaction.ts";

interface ProviderErrorContext {
  provider: string;
  sessionReference?: string | null;
  savedWorkChanged?: "no" | "possibly";
  diagnosticReference?: string;
}

function numberField(value: unknown, key: string): number | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record[key] === "number") return record[key];
  if (typeof record[key] === "string" && /^\d{3}$/.test(record[key].trim())) return Number(record[key]);
  return numberField(record.cause, key) ?? numberField(record.response, key);
}

function stringField(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  return stringField(record.cause, keys) ?? stringField(record.response, keys);
}

function rawMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return stringField(error, ["message", "detail", "error"]) ?? "The provider request failed without a message.";
}

function categoryFor(statusCode: number | null, providerCode: string | null, message: string): ProviderErrorDetails["category"] {
  const combined = `${providerCode ?? ""} ${message}`;
  if (/data[-_ ]?(?:use[-_ ]?)?(?:policy|preference)|privacy|train(?:ing)?(?:\s+on)?\s+(?:request|prompt|input|customer)|no[-_ ]?training|retention policy|providerdata(?:policy)?error/i.test(combined)) {
    return "PROVIDER_DATA_POLICY";
  }
  if (/context(?: length| window)?|maximum context|too many tokens|prompt (?:is )?too long|input.*token.*limit|context(?:length)?error/i.test(combined)) {
    return "MODEL_CONTEXT_LIMIT";
  }
  if (/model.*(?:unavailable|not found|disabled|does not exist|not supported)|unknown model|no endpoints found|model(?:notfound|unavailable)error/i.test(combined)) {
    return "MODEL_UNAVAILABLE";
  }
  if (statusCode === 401 || /invalid.*(?:api[-_ ]?key|credential)|unauthori[sz]ed|authentication|required credential|provider[-_ ]?auth|autherror/i.test(combined)) {
    return "PROVIDER_AUTH";
  }
  if (statusCode === 402 || /quota|billing|insufficient (?:credit|balance)|credit balance|spend(?:ing)? limit|payment required|providerquota/i.test(combined)) {
    return "PROVIDER_QUOTA";
  }
  if (statusCode === 429 || /rate[-_ ]?limit|too many requests|throttl|providerratelimit/i.test(combined)) {
    return "PROVIDER_RATE_LIMIT";
  }
  if ((statusCode !== null && statusCode >= 500) || /temporar|overload|capacity|service unavailable|gateway|try again|timeout|providertemporary/i.test(combined)) {
    return "PROVIDER_TEMPORARY";
  }
  return "UNKNOWN_PROVIDER_FAILURE";
}

function copyFor(category: ProviderErrorDetails["category"]): Pick<ProviderErrorDetails, "whatHappened" | "repair" | "action" | "retryable"> {
  switch (category) {
    case "PROVIDER_DATA_POLICY":
      return {
        whatHappened: "The provider route was rejected because it may train on request data or conflicts with this workspace's privacy policy.",
        repair: "Choose a provider/model route that promises the required data handling, or deliberately change the workspace privacy preference before retrying.",
        action: "review-privacy",
        retryable: false,
      };
    case "PROVIDER_AUTH":
      return {
        whatHappened: "The model provider rejected the credentials held by OpenCode.",
        repair: "Reconnect this provider inside OpenCode with /connect, then retry the same request.",
        action: "reconnect-provider",
        retryable: false,
      };
    case "PROVIDER_RATE_LIMIT":
      return {
        whatHappened: "The provider is temporarily limiting request volume.",
        repair: "Wait for the provider's limit window to reset, then retry once. No automatic retry was attempted.",
        action: "retry",
        retryable: true,
      };
    case "PROVIDER_QUOTA":
      return {
        whatHappened: "The provider reports that the account's quota, credits, or spending allowance is exhausted.",
        repair: "Check the provider account's quota or billing page, or choose another accessible model.",
        action: "check-quota",
        retryable: false,
      };
    case "MODEL_UNAVAILABLE":
      return {
        whatHappened: "The selected model is no longer available on this provider route.",
        repair: "Refresh OpenCode discovery and explicitly choose another model. The app will not substitute one automatically.",
        action: "change-model",
        retryable: false,
      };
    case "MODEL_CONTEXT_LIMIT":
      return {
        whatHappened: "The request exceeds the selected model's context or output limits.",
        repair: "Reduce the request or conversation context, or explicitly choose a model with larger reported limits.",
        action: "reduce-context",
        retryable: false,
      };
    case "PROVIDER_TEMPORARY":
      return {
        whatHappened: "The provider is temporarily unavailable or overloaded.",
        repair: "Retry later, or explicitly choose another available model if the interruption continues.",
        action: "retry",
        retryable: true,
      };
    case "UNKNOWN_PROVIDER_FAILURE":
      return {
        whatHappened: "The provider failed without a recognized safe category.",
        repair: "Use the diagnostic reference below when checking OpenCode/provider logs, then retry or choose another model.",
        action: "retry",
        retryable: true,
      };
  }
}

export class ProviderRequestError extends Error {
  readonly code: ProviderErrorDetails["category"];
  readonly retryable: boolean;

  constructor(readonly details: ProviderErrorDetails) {
    super(details.whatHappened);
    this.name = "ProviderRequestError";
    this.code = details.category;
    this.retryable = details.retryable;
  }
}

/**
 * Avoids turning an unrelated local or internal error into a provider card.
 * A structured status/tag or provider-shaped wording is required.
 */
export function isProviderFailureCandidate(error: unknown): boolean {
  if (error instanceof ProviderRequestError) return true;
  const statusCode = numberField(error, "status") ?? numberField(error, "statusCode");
  const providerCode = stringField(error, ["code", "type", "_tag"]);
  if (statusCode !== null) return true;
  if (providerCode && /^(?:provider|model|auth|rate|quota|context|data|policy)/i.test(providerCode)) return true;
  const message = rawMessage(error);
  return /provider|model (?:call|request|route|unavailable)|rate[-_ ]?limit|quota|billing|context (?:length|window)|privacy|training|data[-_ ]?policy|authentication|unauthori[sz]ed|overload/i.test(message);
}

export function classifyProviderError(error: unknown, context: ProviderErrorContext): ProviderRequestError {
  if (error instanceof ProviderRequestError) return error;
  const statusCode = numberField(error, "status") ?? numberField(error, "statusCode");
  const providerCode = stringField(error, ["code", "type", "_tag"]);
  const safeDetail = redactText(rawMessage(error), { hideLocalPaths: true }).slice(0, 800);
  const category = categoryFor(statusCode, providerCode, safeDetail);
  const copy = copyFor(category);
  const savedWorkChanged = context.savedWorkChanged ?? (context.sessionReference ? "possibly" : "no");
  return new ProviderRequestError({
    category,
    ...copy,
    savedWorkChanged,
    savedWorkMessage: savedWorkChanged === "possibly"
      ? "The saved workshop plan was not replaced, but the native OpenCode session may have changed workspace files. Inspect that session before retrying."
      : "The saved workshop content was not changed by this failed request.",
    technical: {
      provider: redactText(context.provider, { hideLocalPaths: true }).slice(0, 128),
      statusCode,
      providerCode: providerCode ? redactText(providerCode, { hideLocalPaths: true }).slice(0, 128) : null,
      sessionReference: context.sessionReference
        ? redactText(context.sessionReference, { hideLocalPaths: true }).slice(0, 256)
        : null,
      diagnosticReference: context.diagnosticReference ?? `provider-${randomUUID()}`,
      safeDetail,
    },
  });
}
