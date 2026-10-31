import { createNativeClient, FREE_DEEPSEEK_MODEL, type NativeClientOptions } from "../opencode/client.ts";
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

export interface SpiritGuide {
  speak(input: { role: "oracle" | "architect" | "witness"; conversationId: string; sessionId: string | null; prompt: string; workspace: string }): Promise<SpokenResult>;
  perform(input: { conversationId: string; sessionId: string | null; prompt: string; workspace: string }): Promise<PerformedResult>;
  inspect(sessionId: string, context: { conversationId: string; role: "oracle" | "architect" | "maker" | "witness" }): Promise<"running" | "succeeded" | "failed" | "unknown">;
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

function assertFreeModel(model: { providerID: string; id: string } | undefined, cost: number): void {
  const selected = model ? `${model.providerID}/${model.id}` : "";
  if (selected !== FREE_DEEPSEEK_MODEL) {
    throw new Error("Native session left the required free DeepSeek model.");
  }
  if (cost > 0) throw new Error("Native session reported a non-zero cost.");
}

export class OpenCodeSpiritGuide implements SpiritGuide {
  constructor(private readonly options: NativeClientOptions) {}

  private client() {
    return createNativeClient(this.options);
  }

  private async openSession(role: "oracle" | "architect" | "maker" | "witness", conversationId: string, workspace: string, sessionId: string | null, permissions: Array<{ action: string; resource: string; effect: "allow" | "deny" | "ask" }>) {
    if (sessionId) return sessionId;
    return traceCreateAgent(role, conversationId, async (span) => {
      const created = await this.client().session.create({
        title: `Unfinished Business ${role}`,
        model: { providerID: "opencode", id: "deepseek-v4.1-flash-free" },
        location: { directory: workspace },
        permissions,
      });
      setOpenCodeResult(span, { sessionId: created.id });
      return created.id;
    });
  }

  async speak(input: { role: "oracle" | "architect" | "witness"; conversationId: string; sessionId: string | null; prompt: string; workspace: string }): Promise<SpokenResult> {
    return traceChatOperation(input.role, input.conversationId, async (span) => {
      const sessionId = await this.openSession(input.role, input.conversationId, input.workspace, input.sessionId, readOnlyPermissions);
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
      assertFreeModel(info.model, info.cost);
      if (!text) throw new Error("Native session returned no assistant text.");
      setOpenCodeResult(span, { sessionId, cost: info.cost });
      return { sessionId, messageId: null, text, cost: info.cost };
    });
  }

  async perform(input: { conversationId: string; sessionId: string | null; prompt: string; workspace: string }): Promise<PerformedResult> {
    return traceChatOperation("maker", input.conversationId, async (span) => {
      const sessionId = await this.openSession("maker", input.conversationId, input.workspace, input.sessionId, makerPermissions);
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
      assertFreeModel(info.model, info.cost);
      const diff = await traceToolOperation("maker", input.conversationId, "opencode.session.diff", async (toolSpan) => {
        const result = await this.client().session.diff({ sessionID: sessionId });
        setOpenCodeResult(toolSpan, { sessionId });
        toolSpan.setAttribute("opencode.diff.file_count", result.length);
        return result;
      });
      const summary = diff.length
        ? diff.map((file) => `${file.status} ${file.file} (+${file.additions}/-${file.deletions})`).join("\n")
        : timedOut
          ? "Native Maker run timed out before it became idle, without a file diff."
          : "Native session finished without a file diff.";
      const messageId = typeof prompted.id === "string" ? prompted.id : null;
      setOpenCodeResult(span, { sessionId, messageId, cost: info.cost });
      return { sessionId, messageId, text: summary, diff: summary, cost: info.cost };
    });
  }

  async inspect(sessionId: string, context: { conversationId: string; role: "oracle" | "architect" | "maker" | "witness" }): Promise<"running" | "succeeded" | "failed" | "unknown"> {
    return traceToolOperation(context.role, context.conversationId, "opencode.session.inspect", async (span) => {
      const info = await this.client().session.get({ sessionID: sessionId });
      setOpenCodeResult(span, { sessionId, cost: info.cost });
      if (info.outcome === "succeeded") return "succeeded";
      if (info.outcome === "failed" || info.outcome === "interrupted") return "failed";
      if (!info.time.idle) return "running";
      return "unknown";
    });
  }
}
