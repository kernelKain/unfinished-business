import * as Sentry from "@sentry/hono/node";
import type { Span } from "@sentry/hono/node";
import type { ModelRef } from "../workflow/model.ts";

type SpiritRole = "oracle" | "architect" | "maker" | "witness";

interface OpenCodeResultMetadata {
  sessionId?: string | null;
  messageId?: string | null;
  cost?: number;
  model?: ModelRef | null;
}

const pipelineName = "unfinished-business";
const providerName = "opencode";

function baseAttributes(role: SpiritRole, conversationId: string, model: ModelRef | null) {
  return {
    "gen_ai.agent.name": role,
    "gen_ai.conversation.id": conversationId,
    "gen_ai.pipeline.name": pipelineName,
    "gen_ai.provider.name": providerName,
    ...(model ? { "gen_ai.request.model": `${model.providerID}/${model.id}` } : {}),
  };
}

function safeSpanError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/timed out|timeout|abort/i.test(message)) return "deadline_exceeded";
  if (/ECONN|fetch|network|socket|unavailable/i.test(message)) return "unavailable";
  if (/authentication|unauthori[sz]ed|password/i.test(message)) return "unauthenticated";
  return "internal_error";
}

function traced<T>(
  options: Parameters<typeof Sentry.startSpan<T>>[0],
  work: (span: Span) => Promise<T>,
): Promise<T> {
  return Sentry.startSpan(options, async (span) => {
    try {
      const result = await work(span);
      span.setStatus({ code: 1 });
      return result;
    } catch (error) {
      span.setStatus({ code: 2, message: safeSpanError(error) });
      throw error;
    }
  });
}

export function traceAgentOperation<T>(
  role: SpiritRole,
  conversationId: string,
  work: (span: Span) => Promise<T>,
): Promise<T> {
  return traced({
    name: `invoke_agent ${role}`,
    op: "gen_ai.invoke_agent",
    attributes: {
      ...baseAttributes(role, conversationId, null),
      "gen_ai.operation.name": "invoke_agent",
      "gen_ai.operation.type": "agent",
    },
  }, work);
}

export function traceChatOperation<T>(
  role: SpiritRole,
  conversationId: string,
  model: ModelRef | null,
  work: (span: Span) => Promise<T>,
): Promise<T> {
  const modelName = model ? `${model.providerID}/${model.id}` : "unselected-model";
  return traced({
    name: `chat ${modelName}`,
    op: "gen_ai.chat",
    attributes: {
      ...baseAttributes(role, conversationId, model),
      "gen_ai.operation.name": "chat",
      "gen_ai.operation.type": "ai_client",
    },
  }, work);
}

export function traceCreateAgent<T>(
  role: SpiritRole,
  conversationId: string,
  work: (span: Span) => Promise<T>,
): Promise<T> {
  return traced({
    name: `create_agent ${role}`,
    op: "gen_ai.create_agent",
    attributes: {
      ...baseAttributes(role, conversationId, null),
      "gen_ai.operation.name": "create_agent",
      "gen_ai.operation.type": "agent",
    },
  }, work);
}

export function traceToolOperation<T>(
  role: SpiritRole,
  conversationId: string,
  model: ModelRef | null,
  toolName: string,
  work: (span: Span) => Promise<T>,
): Promise<T> {
  return traced({
    name: `execute_tool ${toolName}`,
    op: "gen_ai.execute_tool",
    attributes: {
      ...baseAttributes(role, conversationId, model),
      "gen_ai.operation.name": "execute_tool",
      "gen_ai.operation.type": "tool",
      "gen_ai.tool.name": toolName,
    },
  }, work);
}

export function setOpenCodeResult(span: Span, metadata: OpenCodeResultMetadata): void {
  if (metadata.model) span.setAttribute("gen_ai.response.model", `${metadata.model.providerID}/${metadata.model.id}`);
  if (metadata.sessionId) span.setAttribute("opencode.session.id", metadata.sessionId);
  if (metadata.messageId) span.setAttribute("gen_ai.response.id", metadata.messageId);
  if (typeof metadata.cost === "number" && Number.isFinite(metadata.cost)) {
    span.setAttribute("gen_ai.cost.total_tokens", metadata.cost);
  }
}
