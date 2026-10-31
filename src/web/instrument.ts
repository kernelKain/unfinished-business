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

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    Sentry.feedbackIntegration({ colorScheme: "system" }),
  ],
  tracesSampleRate,
  tracePropagationTargets: [/^\//],
  replaysSessionSampleRate: replaySessionSampleRate,
  replaysOnErrorSampleRate: replayErrorSampleRate,
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
