import { randomUUID } from "node:crypto";
import { redactText, redactUnknown, type RedactOptions } from "../security/redaction.ts";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  [key: string]: unknown;
}

export interface Logger {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

export interface LoggerOptions {
  level?: LogLevel;
  redact?: RedactOptions;
  sink?: (line: string, level: LogLevel) => void;
}

const levels: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function defaultSink(line: string, level: LogLevel): void {
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level ?? (process.env.UB_LOG_LEVEL as LogLevel | undefined) ?? "info";
  const redact = options.redact ?? { hideLocalPaths: process.env.UB_REDACT_LOCAL_PATHS === "true" };
  const sink = options.sink ?? defaultSink;
  const threshold = levels[level] ?? levels.info;

  function emit(target: LogLevel, event: string, fields: LogFields, base: LogFields): void {
    if (levels[target] < threshold) return;
    const payload = {
      time: new Date().toISOString(),
      level: target,
      event,
      ...base,
      ...(redactUnknown(fields, redact) as LogFields),
    };
    let line: string;
    try {
      line = JSON.stringify(payload);
    } catch {
      line = JSON.stringify({ time: payload.time, level: target, event, message: "[unserializable log fields]" });
    }
    sink(redactText(line, { hideLocalPaths: false }), target);
  }

  function make(base: LogFields): Logger {
    return {
      debug: (event, fields = {}) => emit("debug", event, fields, base),
      info: (event, fields = {}) => emit("info", event, fields, base),
      warn: (event, fields = {}) => emit("warn", event, fields, base),
      error: (event, fields = {}) => emit("error", event, fields, base),
      child: (fields) => make({ ...base, ...fields }),
    };
  }

  return make({});
}

export function requestId(): string {
  return randomUUID();
}

