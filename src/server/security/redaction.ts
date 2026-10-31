import { homedir } from "node:os";

export interface RedactOptions {
  /** Redact the current user's home directory and common private mount paths. */
  hideLocalPaths?: boolean;
}

const secretPatterns: Array<[RegExp, string]> = [
  [/(authorization\s*[:=]\s*)(?:basic|bearer|digest)\s+[A-Za-z0-9._~+/=-]+/gi, "$1[REDACTED]"],
  [/((?:proxy-)?authorization\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]"],
  [/\b(?:bearer|basic|digest)\s+[A-Za-z0-9._~+/=-]+/gi, "[REDACTED_CREDENTIAL]"],
  [/((?:set-)?cookie\s*[:=]\s*)[^\r\n]+/gi, "$1[REDACTED]"],
  [/((?:OPENCODE_PASSWORD|OPENCODE_SERVER_PASSWORD|UB_ACCESS_PASSWORD|UB_SESSION_TOKEN|SENTRY_AUTH_TOKEN)\s*[=:]\s*)[^\s,;]+/gi, "$1[REDACTED]"],
  [/\b(?:sk|rk|pk)-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED_API_KEY]"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, "[REDACTED_GITHUB_TOKEN]"],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, "[REDACTED_SLACK_TOKEN]"],
  [/\bAIza[0-9A-Za-z_-]{30,}\b/g, "[REDACTED_GOOGLE_KEY]"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[REDACTED_JWT]"],
  [/https:\/\/[^@\s/]+@[^/\s]+\/\d+/g, "[REDACTED_SENTRY_DSN]"],
  [/(https?:\/\/)([^/\s:@]+):([^/\s@]+)@/gi, "$1[REDACTED]@"],
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]"],
];

function redactPaths(text: string): string {
  const home = homedir().replace(/[\\/]+$/, "");
  let result = text;
  if (home && home !== "/") {
    result = result.replaceAll(home, "[REDACTED_HOME]");
  }
  return result
    .replace(/\/var\/data\/[A-Za-z0-9._/-]+/g, "[REDACTED_DATA_PATH]")
    .replace(/\/(?:home|Users)\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._/-]+)?/g, "[REDACTED_USER_PATH]")
    .replace(/(?<![\w:./])\/(?:[A-Za-z0-9._-]+\/)+[A-Za-z0-9._-]+/g, "[REDACTED_PATH]");
}

export function redactText(value: string, options: RedactOptions = {}): string {
  let result = value;
  for (const [pattern, replacement] of secretPatterns) {
    result = result.replace(pattern, replacement);
  }
  if (options.hideLocalPaths) result = redactPaths(result);
  return result;
}

export function redactUnknown(value: unknown, options: RedactOptions = {}, depth = 0): unknown {
  if (depth > 8) return "[REDACTED_DEPTH]";
  if (typeof value === "string") return redactText(value, options);
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 500).map((item) => redactUnknown(item, options, depth + 1));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>).slice(0, 500)) {
      if (/^(authorization|cookie|set-cookie|password|secret|token|api[_-]?key|dsn)$/i.test(key)) {
        output[key] = "[REDACTED]";
      } else {
        output[key] = redactUnknown(entry, options, depth + 1);
      }
    }
    return output;
  }
  return String(value);
}

export function redactError(error: unknown, options: RedactOptions = {}): { name: string; message: string; code: string | null } {
  const source = error instanceof Error ? error : new Error(String(error));
  const code = (source as NodeJS.ErrnoException).code;
  return {
    name: source.name,
    message: redactText(source.message, options),
    code: typeof code === "string" ? code : null,
  };
}

function redactRecord(value: unknown, options: RedactOptions): unknown {
  return redactUnknown(value, options);
}

/**
 * Removes request content, user identity, query strings and credentials from a
 * Sentry event. The SDK already disables most collection; this is a final
 * defense-in-depth pass before transport.
 */
export function sanitizeSentryEvent<T extends Record<string, unknown>>(event: T, options: RedactOptions = {}): T {
  const copy = structuredClone(event) as Record<string, unknown>;
  if (copy.request && typeof copy.request === "object") {
    const request = copy.request as Record<string, unknown>;
    delete request.data;
    delete request.headers;
    delete request.cookies;
    delete request.query_string;
    if (typeof request.url === "string") request.url = request.url.split("?")[0];
  }
  delete copy.user;
  if (typeof copy.message === "string") copy.message = redactText(copy.message, options);
  if (typeof copy.logentry === "object" && copy.logentry) {
    const logentry = copy.logentry as Record<string, unknown>;
    if (typeof logentry.message === "string") logentry.message = redactText(logentry.message, options);
    delete logentry.params;
  }
  if (typeof copy.exception === "object" && copy.exception) {
    const exception = copy.exception as Record<string, unknown>;
    if (Array.isArray(exception.values)) {
      exception.values = exception.values.map((value) => {
        if (!value || typeof value !== "object") return value;
        const entry = { ...(value as Record<string, unknown>) };
        if (typeof entry.value === "string") entry.value = redactText(entry.value, options);
        return entry;
      });
    }
  }
  if (Array.isArray(copy.breadcrumbs)) {
    copy.breadcrumbs = copy.breadcrumbs.map((crumb) => {
      if (!crumb || typeof crumb !== "object") return crumb;
      const entry = { ...(crumb as Record<string, unknown>) };
      if (typeof entry.message === "string") entry.message = redactText(entry.message, options);
      delete entry.data;
      return entry;
    });
  }
  if (copy.extra) copy.extra = redactRecord(copy.extra, options);
  if (copy.contexts) copy.contexts = redactRecord(copy.contexts, options);
  return copy as T;
}

export function safePublicError(error: unknown, fallback: string, options: RedactOptions = {}): string {
  const message = error instanceof Error ? error.message : "";
  if (!message) return fallback;
  const redacted = redactText(message, options);
  return redacted.length > 400 ? `${redacted.slice(0, 397)}...` : redacted;
}
