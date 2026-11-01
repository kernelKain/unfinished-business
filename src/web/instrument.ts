import * as Sentry from "@sentry/react";

const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE;
const isProduction = environment === "production";
const tracesSampleRate = sampleRate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE, isProduction ? 0.1 : 1);
const replaySessionSampleRate = sampleRate(import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE, 0.1);
const replayErrorSampleRate = sampleRate(import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE, 1);

function sampleRate(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

function redact(value: string): string {
  return value
    .replace(/(authorization\s*[:=]\s*)(?:basic|bearer)\s+\S+/gi, "$1[REDACTED]")
    .replace(/((?:set-)?cookie\s*[:=]\s*)[^\n]+/gi, "$1[REDACTED]")
    .replace(/\b(?:bearer|basic|digest)\s+[A-Za-z0-9._~+/=-]+/gi, "[REDACTED_CREDENTIAL]")
    .replace(/\b(?:sk|rk|pk)-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED_API_KEY]")
    .replace(/https:\/\/[^@\s/]+@[^/\s]+\/\d+/g, "[REDACTED_SENTRY_DSN]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]");
}

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[REDACTED_DEPTH]";
  if (typeof value === "string") return redact(value);
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => scrub(item, depth + 1));
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
      if (/^(authorization|cookie|set-cookie|password|secret|token|api[_-]?key|dsn)$/i.test(key)) output[key] = "[REDACTED]";
      else output[key] = scrub(entry, depth + 1);
    }
    return output;
  }
  return value;
}

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true, useCompression: false }),
    Sentry.feedbackIntegration({ colorScheme: "system" }),
  ],
  tracesSampleRate,
  tracePropagationTargets: [/^\//],
  replaysSessionSampleRate: replaySessionSampleRate,
  replaysOnErrorSampleRate: replayErrorSampleRate,
  beforeSend(event) {
    if (event.message) event.message = redact(event.message);
    if (event.request) {
      delete event.request.data;
      delete event.request.headers;
      delete event.request.cookies;
      delete event.request.query_string;
    }
    delete event.user;
    for (const exception of event.exception?.values ?? []) {
      if (exception.value) exception.value = redact(exception.value);
    }
    for (const breadcrumb of event.breadcrumbs ?? []) {
      if (breadcrumb.message) breadcrumb.message = redact(breadcrumb.message);
      delete breadcrumb.data;
    }
    if (event.extra) event.extra = scrub(event.extra) as typeof event.extra;
    if (event.contexts) event.contexts = scrub(event.contexts) as typeof event.contexts;
    return event;
  },
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.message) breadcrumb.message = redact(breadcrumb.message);
    delete breadcrumb.data;
    return breadcrumb;
  },
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    genAI: { inputs: false, outputs: false },
    stackFrameVariables: false,
  },
});

export { Sentry };
