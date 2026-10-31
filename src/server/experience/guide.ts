import type { ModelRef } from "../workflow/model.ts";
import type { OperationPhase, OperationProgress } from "../../shared/workflow.ts";
import {
  assertEngineReady,
  createNativeClient,
  type NativeClientOptions,
} from "../opencode/client.ts";
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
  tokens?: { input: number; output: number; reasoning: number; cache?: { read: number; write: number } };
}

export interface PerformedResult extends SpokenResult {
  diff: string;
  outcome?: "succeeded" | "failed" | "interrupted" | "running" | "unknown";
  pendingPermission?: boolean;
  timedOut?: boolean;
}

/** Diff summary lines about one file, validated before they are stored or shown. */
export interface NativeFileDiff {
  status: string;
  file: string;
  additions: number;
  deletions: number;
}

export interface NativeMessageSnapshot {
  messageId: string;
  text: string;
}

export type ProgressReporter = (phase: OperationPhase, detail?: string | null) => void;

export interface SessionContext {
  conversationId: string;
  sessionId: string | null;
  prompt: string;
  workspace: string;
  model: ModelRef;
  agent: string | null;
  budget?: {
    maxCostUsd: number | null;
    maxTotalTokens: number | null;
    maxRunDurationMs: number | null;
  };
  onSession?: (sessionId: string) => void;
  onProgress?: ProgressReporter;
}

/**
 * Extra observation methods used for live progress and for reconciling a
 * late native result. Implementations may omit a method when the connected
 * server does not support it; reconcile then stays honest instead of guessing.
 */
export interface NativeObserver {
  /** Latest validated assistant text for a session, or null when unreadable. */
  lastAssistantText?(sessionId: string): Promise<NativeMessageSnapshot | null>;
  /** Validated file-level diff after a native edit, or null when unreadable. */
  sessionDiff?(sessionId: string, workspace: string): Promise<NativeFileDiff[] | null>;
  /** Whether a native permission request is waiting, or null when unknown. */
  hasPendingPermission?(sessionId: string, workspace: string): Promise<boolean | null>;
}

export interface SpiritGuide extends NativeObserver {
  speak(input: SessionContext & { role: "oracle" | "architect" | "witness" }): Promise<SpokenResult>;
  perform(input: SessionContext & { role: "maker" }): Promise<PerformedResult>;
  inspect(sessionId: string, context: { conversationId: string; role: "oracle" | "architect" | "maker" | "witness" }): Promise<"running" | "succeeded" | "failed" | "unknown">;
  interrupt?(sessionId: string): Promise<boolean>;
}

export const PHASE_DETAIL: Record<OperationPhase, string> = {
  CONNECTING: "Connecting to OpenCode and checking readiness.",
  SESSION_CREATED: "OpenCode session is ready.",
  WAITING_FOR_MODEL: "The prompt was sent. Waiting for the model route.",
  RECEIVING_OUTPUT: "Receiving the native output.",
  VALIDATING_RESULT: "Validating the native result before it is applied.",
  WAITING_PERMISSION: "A native permission request is pending. Resolve it in OpenCode.",
  APPLYING_RESULT: "Applying the validated result to the saved project.",
  RUNNING_CHECKS: "Running the bounded Node check.",
  AWAITING_RECONCILIATION: "Reconcile the native session to recover or discard this run.",
};

export interface GuideBudgets {
  guideTimeoutMs: number;
  makerTimeoutMs: number;
  maxSessionTokens: number;
  maxSessionCostUsd: number | null;
}

export type GuideOptions = NativeClientOptions & { budgets?: Partial<GuideBudgets> };

export class NativeBudgetError extends Error {
  readonly code = "BUDGET_EXCEEDED";
  constructor(message: string) {
    super(message);
    this.name = "NativeBudgetError";
  }
}

export class NativeTimeoutError extends Error {
  readonly code = "NATIVE_TIMEOUT";
  constructor(message: string) {
    super(message);
    this.name = "NativeTimeoutError";
  }
}

export class NativeSessionError extends Error {
  constructor(readonly code: "EMPTY_RESPONSE" | "MODEL_CHANGED" | "NATIVE_FAILED", message: string) {
    super(message);
    this.name = "NativeSessionError";
  }
}

const defaultBudgets: GuideBudgets = {
  guideTimeoutMs: 90_000,
  makerTimeoutMs: 180_000,
  maxSessionTokens: 200_000,
  maxSessionCostUsd: null,
};

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

function timed<T>(label: string, timeoutMs: number, work: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new NativeTimeoutError(`${label} did not finish within ${Math.round(timeoutMs / 1000)} seconds.`)), timeoutMs);
    timer.unref?.();
    work.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

function tokenTotal(tokens: SpokenResult["tokens"]): number {
  if (!tokens) return 0;
  return Math.max(0, tokens.input)
    + Math.max(0, tokens.output)
    + Math.max(0, tokens.reasoning)
    + Math.max(0, tokens.cache?.read ?? 0)
    + Math.max(0, tokens.cache?.write ?? 0);
}

/**
 * Combines the deployment-wide budget with the project's optional overrides.
 * A null/absent value means unlimited/disabled. The stricter limit wins.
 */
export function sessionBudgetViolation(
  info: { cost: number; tokens?: SpokenResult["tokens"] },
  budgets: Pick<GuideBudgets, "maxSessionCostUsd" | "maxSessionTokens">,
  requested?: SessionContext["budget"],
): string | null {
  const costLimits = [budgets.maxSessionCostUsd, requested?.maxCostUsd]
    .filter((value): value is number => typeof value === "number");
  const costLimit = costLimits.length ? Math.min(...costLimits) : null;
  if (costLimit !== null && info.cost > costLimit) {
    return `Native session reported $${info.cost.toFixed(4)} cost, above the configured $${costLimit.toFixed(4)} session spending limit.`;
  }
  const total = tokenTotal(info.tokens);
  const tokenLimit = requested?.maxTotalTokens
    ? Math.min(budgets.maxSessionTokens, requested.maxTotalTokens)
    : budgets.maxSessionTokens;
  if (total > tokenLimit) {
    return `Native session used ${total} tokens, above the configured ${tokenLimit} token budget.`;
  }
  return null;
}

export function effectiveTimeout(
  kind: "guide" | "maker",
  budgets: Pick<GuideBudgets, "guideTimeoutMs" | "makerTimeoutMs">,
  requested?: SessionContext["budget"],
): number {
  const configured = kind === "guide" ? budgets.guideTimeoutMs : budgets.makerTimeoutMs;
  return requested?.maxRunDurationMs ? Math.min(configured, requested.maxRunDurationMs) : configured;
}

function withSessionId(error: unknown, sessionId: string): unknown {
  if (error && typeof error === "object") {
    try {
      Object.assign(error, { nativeSessionId: sessionId });
    } catch {
      // Some platform errors are frozen; the caller still records an unknown outcome.
    }
  }
  return error;
}

function assertSelectedModel(
  selected: ModelRef,
  actual: { providerID: string; id: string; variant?: string } | undefined,
): void {
  if (!actual) return;
  if (actual.providerID !== selected.providerID || actual.id !== selected.id) {
    throw new NativeSessionError(
      "MODEL_CHANGED",
      `Native session left the selected model ${selected.providerID}/${selected.id}. No substitute model is allowed.`,
    );
  }
  if (selected.variant && actual.variant && actual.variant !== "default" && actual.variant !== selected.variant) {
    throw new NativeSessionError("MODEL_CHANGED", `Native session left the selected variant "${selected.variant}".`);
  }
}

export class OpenCodeSpiritGuide implements SpiritGuide {
  private readonly budgets: GuideBudgets;
  private readiness: { at: number; version: string } | null = null;

  constructor(
    private readonly options: NativeClientOptions | (() => NativeClientOptions),
    budgets: Partial<GuideBudgets> = {},
  ) {
    this.budgets = { ...defaultBudgets, ...budgets };
  }

  private client() {
    const options = typeof this.options === "function" ? this.options() : this.options;
    return createNativeClient(options);
  }

  private optionsNow(): NativeClientOptions {
    return typeof this.options === "function" ? this.options() : this.options;
  }

  private async ready(): Promise<void> {
    if (this.readiness && Date.now() - this.readiness.at < 5_000) return;
    const status = await assertEngineReady(this.optionsNow());
    this.readiness = { at: Date.now(), version: status.serverVersion ?? "unknown" };
  }

  private assertBudget(
    model: ModelRef,
    info: {
      model?: { providerID: string; id: string; variant?: string };
      cost: number;
      tokens?: SpokenResult["tokens"];
    },
    requested?: SessionContext["budget"],
  ): void {
    assertSelectedModel(model, info.model);
    const violation = sessionBudgetViolation(info, this.budgets, requested);
    if (violation) throw new NativeBudgetError(violation);
  }

  private timeoutFor(kind: "guide" | "maker", requested?: SessionContext["budget"]): number {
    return effectiveTimeout(kind, this.budgets, requested);
  }

  private async openSession(
    role: "oracle" | "architect" | "maker" | "witness",
    input: SessionContext,
    permissions: Array<{ action: string; resource: string; effect: "allow" | "deny" | "ask" }>,
  ): Promise<string> {
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
    input.onProgress?.("CONNECTING");
    await this.ready();
    return traceChatOperation(input.role, input.conversationId, input.model, async (span) => {
      const sessionId = await this.openSession(input.role, input, readOnlyPermissions);
      try {
        // One request, one possible side effect. A short reply is parsed or
        // rejected; it is never silently re-prompted.
        input.onProgress?.("WAITING_FOR_MODEL");
        const generated = await timed("Native spirit", this.timeoutFor("guide", input.budget),
          this.client().session.generate({ sessionID: sessionId, prompt: input.prompt }));
        input.onProgress?.("VALIDATING_RESULT");
        const text = generated.text?.trim() ?? "";
        if (!text) throw new NativeSessionError("EMPTY_RESPONSE", "Native session returned no assistant text.");
        const info = await this.client().session.get({ sessionID: sessionId });
        this.assertBudget(input.model, info, input.budget);
        setOpenCodeResult(span, { sessionId, cost: info.cost, model: input.model });
        return { sessionId, messageId: null, text, cost: info.cost, tokens: info.tokens };
      } catch (error) {
        throw withSessionId(error, sessionId);
      }
    });
  }

  async perform(input: SessionContext & { role: "maker" }): Promise<PerformedResult> {
    input.onProgress?.("CONNECTING");
    await this.ready();
    return traceChatOperation("maker", input.conversationId, input.model, async (span) => {
      const sessionId = await this.openSession("maker", input, makerPermissions);
      try {
        input.onProgress?.("WAITING_FOR_MODEL");
        const prompted = await this.client().session.prompt({ sessionID: sessionId, text: input.prompt });
        let timedOut = false;
        let timer: NodeJS.Timeout | undefined;
        input.onProgress?.("RECEIVING_OUTPUT", "The native session is working. Waiting for it to become idle.");
        try {
          await Promise.race([
            this.client().session.wait({ sessionID: sessionId }),
            new Promise<void>((resolve) => {
              timer = setTimeout(() => {
                timedOut = true;
                resolve();
              }, this.timeoutFor("maker", input.budget));
              timer.unref?.();
            }),
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }
        input.onProgress?.("VALIDATING_RESULT");
        const info = await this.client().session.get({ sessionID: sessionId });
        if (info.outcome === "succeeded" || info.outcome === "failed" || info.outcome === "interrupted") timedOut = false;
        this.assertBudget(input.model, info, input.budget);
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
        let pendingPermission = false;
        if (timedOut) {
          try {
            const requests = await this.client().permission.request.list({ location: { directory: input.workspace } });
            pendingPermission = requests.data.some((request) => request.sessionID === sessionId);
          } catch {
            pendingPermission = false;
          }
        }
        setOpenCodeResult(span, { sessionId, messageId, cost: info.cost, model: input.model });
        return {
          sessionId,
          messageId,
          text: summary,
          diff: summary,
          cost: info.cost,
          tokens: info.tokens,
          outcome: info.outcome ?? (timedOut ? "running" : "succeeded"),
          pendingPermission,
          timedOut,
        };
      } catch (error) {
        throw withSessionId(error, sessionId);
      }
    });
  }

  async interrupt(sessionId: string): Promise<boolean> {
    const result = await this.client().session.interrupt({ sessionID: sessionId });
    return Boolean(result.interrupted);
  }

  async inspect(sessionId: string, context: { conversationId: string; role: "oracle" | "architect" | "maker" | "witness" }): Promise<"running" | "succeeded" | "failed" | "unknown"> {
    return traceToolOperation(context.role, context.conversationId, null, "opencode.session.inspect", async (span) => {
      try {
        const info = await this.client().session.get({ sessionID: sessionId });
        setOpenCodeResult(span, { sessionId, cost: info.cost, model: null });
        if (info.outcome === "succeeded") return "succeeded";
        if (info.outcome === "failed" || info.outcome === "interrupted") return "failed";
        return info.time.idle ? "unknown" : "running";
      } catch {
        return "unknown";
      }
    });
  }

  /**
   * Reads the latest assistant message through safe polling. The model's
   * message content is never surfaced unchanged; it is only used for
   * validation, so no partial or unvalidated text is stored as a section.
   */
  async lastAssistantText(sessionId: string): Promise<NativeMessageSnapshot | null> {
    try {
      const messages = await this.client().message.list({ sessionID: sessionId, limit: 5, order: "desc", type: "assistant" });
      for (const message of messages.data) {
        if (message.type !== "assistant") continue;
        const textPart = message.content.find((part) => part.type === "text");
        if (textPart && textPart.type === "text" && textPart.text.trim()) {
          return { messageId: message.id, text: textPart.text };
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /** Validates diff entries before they leave the native boundary. */
  async sessionDiff(sessionId: string, workspace = ""): Promise<NativeFileDiff[] | null> {
    void workspace;
    return traceToolOperation("maker", sessionId, null, "opencode.session.diff", async (toolSpan) => {
      try {
        const result = await this.client().session.diff({ sessionID: sessionId });
        setOpenCodeResult(toolSpan, { sessionId, model: null });
        toolSpan.setAttribute("opencode.diff.file_count", result.length);
        return result
          .map((file) => ({
            status: String(file.status),
            file: String(file.file),
            additions: Number(file.additions) || 0,
            deletions: Number(file.deletions) || 0,
          }))
          .filter((file) => file.file.length > 0);
      } catch {
        return null;
      }
    });
  }

  async hasPendingPermission(sessionId: string, workspace: string): Promise<boolean | null> {
    try {
      const requests = await this.client().permission.request.list({ location: { directory: workspace } });
      return requests.data.some((request) => request.sessionID === sessionId);
    } catch {
      return null;
    }
  }
}
