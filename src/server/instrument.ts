import * as Sentry from "@sentry/hono/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { sanitizeSentryEvent } from "./security/redaction.ts";

const environment = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development";
const release = process.env.SENTRY_RELEASE
  ?? (process.env.RENDER_GIT_COMMIT ? `unfinished-business@${process.env.RENDER_GIT_COMMIT}` : undefined);
const isProduction = environment === "production";
const tracesSampleRate = sampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, isProduction ? 0.1 : 1);
const agentTracesSampleRate = sampleRate(process.env.SENTRY_AGENT_TRACES_SAMPLE_RATE, 1);
const profilesSampleRate = sampleRate(process.env.SENTRY_PROFILES_SAMPLE_RATE, isProduction ? 0.1 : 1);

function sampleRate(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment,
  release,
  integrations: [nodeProfilingIntegration()],
  tracesSampler: ({ name, attributes, normalizedRequest, inheritOrSampleWith }) => {
    const requestUrl = normalizedRequest?.url ?? "";
    const isAgentTrace = /\/api\/(?:messages|runs)(?:\/|$)/.test(`${name} ${requestUrl}`)
      || attributes["gen_ai.operation.name"] === "invoke_agent";
    return isAgentTrace ? agentTracesSampleRate : inheritOrSampleWith(tracesSampleRate);
  },
  profileSessionSampleRate: profilesSampleRate,
  profileLifecycle: "trace",
  strictTraceContinuation: true,
  beforeSend(event) {
    return sanitizeSentryEvent(event as unknown as Record<string, unknown>, { hideLocalPaths: true }) as unknown as typeof event;
  },
  beforeSendTransaction(event) {
    return sanitizeSentryEvent(event as unknown as Record<string, unknown>, { hideLocalPaths: true }) as unknown as typeof event;
  },
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.message) breadcrumb.message = String(sanitizeSentryEvent({ message: breadcrumb.message } as Record<string, unknown>).message ?? "");
    delete breadcrumb.data;
    return breadcrumb;
  },
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    graphQL: { document: false, variables: false },
    genAI: { inputs: false, outputs: false },
    mcp: { inputs: false, outputs: false },
    databaseQueryData: false,
    queues: false,
    stackFrameVariables: false,
  },
});
