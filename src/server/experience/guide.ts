import type { ModelRef } from "../workflow/model.ts";
import { createNativeClient, type NativeClientOptions } from "../opencode/client.ts";
import {
  setOpenCodeResult,
  traceChatOperation,
  traceCreateAgent,
  traceToolOperation,
} from "./telemetry.ts";

export interface SpokenResult {
  sessionId: string;
  messageId: string | null;
  text: string;
  cost: number;
}

export interface PerformedResult extends SpokenResult {
  diff: string;
}

export interface SessionContext {
  conversationId: string;
  sessionId: string | null;
  prompt: string;
  workspace: string;
  model: ModelRef;
  agent: string | null;
  onSession?: (sessionId: string) => void;
}

export interface SpiritGuide {
  speak(input: SessionContext & { role: "oracle" | "architect" | "witness" }): Promise<SpokenResult>;
  perform(input: SessionContext & { role: "maker" }): Promise<PerformedResult>;
  inspect(sessionId: string, context: { conversationId: string; role: "oracle" | "architect" | "maker" | "witness" }): Promise<"running" | "succeeded" | "failed" | "unknown">;
  interrupt(sessionId: string): Promise<boolean>;
}

const readOnlyPermissions = [
  { action: "edit", resource: "*", effect: "deny" as const },
  { action: "shell", resource: "*", effect: "deny" as const },
  { action: "external_directory", resource: "*", effect: "deny" as const },
];

const makerPermissions = [
  { action: "shell", resource: "*", effect: "deny" as const },
  { action: "external_directory", resource: "*", effect: "deny" as const },
  { action: "edit", resource: "*", effect: "allow" as const },
];

function assertSelectedModel(
  selected: ModelRef,
  actual: { providerID: string; id: string; variant?: string } | undefined,
): void {
  if (!actual) return;
  if (actual.providerID !== selected.providerID || actual.id !== selected.id) {
    throw new Error(`Native session left the selected model ${selected.providerID}/${selected.id}.`);
  }
  // OpenCode reports "default" when no explicit variant was selected. A user
  // variant must still be the one this application requested.
  if (selected.variant && actual.variant && actual.variant !== "default" && actual.variant !== selected.variant) {
    throw new Error(`Native session left the selected variant "${selected.variant}".`);
  }
}

export class OpenCodeSpiritGuide implements SpiritGuide {
  constructor(private readonly options: NativeClientOptions | (() => NativeClientOptions)) {}

  private client() {
    const options = typeof this.options === "function" ? this.options() : this.options;
    return createNativeClient(options);
  }

  private async openSession(
    role: "oracle" | "architect" | "maker" | "witness",
    input: SessionContext,
    permissions: Array<{ action: string; resource: string; effect: "allow" | "deny" | "ask" }>,
  ) {
    if (input.sessionId) {
      input.onSession?.(input.sessionId);
      return input.sessionId;
    }
    return traceCreateAgent(role, input.conversationId, async (span) => {
      const created = await this.client().session.create({
        title: `Unfinished Business ${role}`,
        agent: input.agent ?? undefined,
        model: {
          providerID: input.model.providerID,
          id: input.model.id,
          ...(input.model.variant ? { variant: input.model.variant } : {}),
        },
        location: { directory: input.workspace },
        permissions,
      });
      setOpenCodeResult(span, { sessionId: created.id, model: input.model });
      input.onSession?.(created.id);
      return created.id;
    });
  }

  async speak(input: SessionContext & { role: "oracle" | "architect" | "witness" }): Promise<SpokenResult> {
    return traceChatOperation(input.role, input.conversationId, input.model, async (span) => {
      const sessionId = await this.openSession(input.role, input, readOnlyPermissions);
      const generated = await this.client().session.generate({ sessionID: sessionId, prompt: input.prompt });
      let text = generated.text?.trim() ?? "";
      if (text.length < 80) {
        await this.client().session.prompt({ sessionID: sessionId, text: input.prompt });
        await Promise.race([
          this.client().session.wait({ sessionID: sessionId }),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error("Native spirit timed out before it became idle.")), 90_000);
          }),
        ]);
        const listed = await this.client().message.list({ sessionID: sessionId, type: "assistant" });
        const messages = Array.isArray(listed) ? listed : listed.data;
        text = messages.flatMap((message) => message.type === "assistant" ? message.content : [])
          .flatMap((part) => part.type === "text" ? [part.text] : [])
          .join("\n")
          .trim();
      }
      const info = await this.client().session.get({ sessionID: sessionId });
      assertSelectedModel(input.model, info.model);
      if (!text) throw new Error("Native session returned no assistant text.");
      setOpenCodeResult(span, { sessionId, cost: info.cost, model: input.model });
      return { sessionId, messageId: null, text, cost: info.cost };
    });
  }

  async perform(input: SessionContext & { role: "maker" }): Promise<PerformedResult> {
    return traceChatOperation("maker", input.conversationId, input.model, async (span) => {
      const sessionId = await this.openSession("maker", input, makerPermissions);
      const prompted = await this.client().session.prompt({ sessionID: sessionId, text: input.prompt });
      let timedOut = false;
      await Promise.race([
        this.client().session.wait({ sessionID: sessionId }),
        new Promise<void>((resolve) => {
          setTimeout(() => {
            timedOut = true;
            resolve();
          }, 180_000);
        }),
      ]);
      const info = await this.client().session.get({ sessionID: sessionId });
      assertSelectedModel(input.model, info.model);
      const diff = await traceToolOperation("maker", input.conversationId, input.model, "opencode.session.diff", async (toolSpan) => {
        const result = await this.client().session.diff({ sessionID: sessionId });
        setOpenCodeResult(toolSpan, { sessionId, model: input.model });
        toolSpan.setAttribute("opencode.diff.file_count", result.length);
        return result;
      });
      const summary = diff.length
        ? diff.map((file) => `${file.status} ${file.file} (+${file.additions}/-${file.deletions})`).join("\n")
        : timedOut
          ? "Native Maker run timed out before it became idle, without a file diff."
          : "Native session finished without a file diff.";
      const messageId = typeof prompted.id === "string" ? prompted.id : null;
      setOpenCodeResult(span, { sessionId, messageId, cost: info.cost, model: input.model });
      return { sessionId, messageId, text: summary, diff: summary, cost: info.cost };
    });
  }

  async inspect(sessionId: string, context: { conversationId: string; role: "oracle" | "architect" | "maker" | "witness" }): Promise<"running" | "succeeded" | "failed" | "unknown"> {
    return traceToolOperation(context.role, context.conversationId, null, "opencode.session.inspect", async (span) => {
      const info = await this.client().session.get({ sessionID: sessionId });
      setOpenCodeResult(span, { sessionId, cost: info.cost, model: null });
      if (info.outcome === "succeeded") return "succeeded";
      if (info.outcome === "failed" || info.outcome === "interrupted") return "failed";
      if (!info.time.idle) return "running";
      return "unknown";
    });
  }

  async interrupt(sessionId: string): Promise<boolean> {
    const result = await this.client().session.interrupt({ sessionID: sessionId });
    return Boolean(result.interrupted);
  }
}
