import type {
  ConnectionStatus,
  DiscoveredModel,
  OpenCodeDiscovery,
  SessionSummary,
  SessionUsage,
} from "../shared/opencode.ts";
import type { ProviderErrorDetails } from "../shared/workflow.ts";

export interface EngineModel {
  providerID: string;
  id: string;
  variant: string | null;
}

export interface WorkshopProject {
  revision: number;
  stage: "ORACLE" | "ARCHITECT" | "MAKER" | "WITNESS";
  currentSectionId: string | null;
  nextAction: string;
  product: {
    status: "NONE" | "PROPOSED" | "APPROVED";
    proposal: string | null;
    openQuestions: string[];
    structuredProposal?: {
      title: string;
      summary: string;
      intendedUser: string;
      problem: string;
      desiredOutcome: string;
      mustHaveFeatures: string[];
      optionalFeatures: string[];
      nonGoals: string[];
      successCriteria: string[];
      facts: string[];
      userDecisions: string[];
      assumptions: string[];
    } | null;
  };
  source: {
    kind: "UNSELECTED" | "NEW_PROJECT" | "LOCAL_REPOSITORY" | "REMOTE_REPOSITORY" | "SAVED_PROJECT" | "DEMO";
    status: "UNSELECTED" | "PENDING_CONFIRMATION" | "CONFIRMED";
    label: string | null;
    repositoryUrl: string | null;
    managedWorkspace: boolean;
    importedAt: string | null;
    confirmedAt: string | null;
    repositoryCondition: string | null;
  };
  oracleIntake: {
    status: "NOT_STARTED" | "COLLECTING" | "READY" | "APPROVED";
    unresolvedQuestions: Array<{
      id: string;
      field: string;
      prompt: string;
      whyItMatters: string;
      suggestedChoices: string[];
    }>;
    assumptions: Array<{ id: string; field: string; statement: string; reason: string }>;
    knownConstraints: string[];
    unresolvedRisks: string[];
    recommendedNextAction: string | null;
  };
  memory: {
    facts: MemoryEntry[];
    decisions: MemoryEntry[];
    constraints: MemoryEntry[];
    risks: MemoryEntry[];
    answers?: MemoryEntry[];
    assumptions?: MemoryEntry[];
  };
  makerScope: { status: "NONE" | "GRANTED"; statement: string | null };
  engine: {
    model: EngineModel | null;
    source: "none" | "user" | "migrated-legacy" | "auto-discovery";
    updatedAt: string | null;
    legacyModel: string | null;
  };
  modelPreferences: {
    access: {
      mode: "ALL_ACCESSIBLE" | "FREE_OR_LOCAL_ONLY";
      allowedProviders: string[];
      allowedModels: EngineModel[];
      dataPolicy: "PROVIDER_DEFAULT" | "NO_TRAINING_REQUIRED";
      paidOrUnknownAcceptedAt: string | null;
    };
    budget: {
      maxCostUsd: number | null;
      maxTotalTokens: number | null;
      maxRunDurationMs: number | null;
    };
  };
  sections: Array<{
    id: string;
    title: string;
    order: number;
    content: string;
    version: number;
    hash: string;
    status: "NOT_STARTED" | "DRAFT" | "APPROVED" | "STALE";
  }>;
  transcript: Array<{ id: string; spirit: string; text: string }>;
  operations: Array<{
    id: string;
    kind: string;
    status: string;
    result: string | null;
    nativeSessionId: string | null;
    nativeMessageId?: string | null;
    model: EngineModel | null;
    agent: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    providerError: ProviderErrorDetails | null;
    /** Recovery metadata from schema v5. Older mirrors keep them optional. */
    intent?: string | null;
    sectionId?: string | null;
    startingRevision?: number | null;
    idempotencyKey?: string | null;
    expectedOutput?: string | null;
    retryOf?: string | null;
    progress?: { phase: string; detail: string | null; updatedAt: string } | null;
  }>;
  capabilities: Array<{
    id: string;
    purpose: string;
    nativeMapping: string;
    availability: string;
    permission: string;
    observedOutcome: string | null;
  }>;
  witnessDrafts: Array<{ id: string; title: string; content: string }>;
  evidence: Array<{ id: string; checkId: string; result: string; limitation: string | null; model: EngineModel | null }>;
  nativeSessions: Array<{ role: string; sessionId: string }>;
}

interface MemoryEntry {
  id: string;
  text: string;
  field?: string | null;
  source: string;
  status?: "ACTIVE" | "SUPERSEDED";
}

export interface ActionResult {
  project: WorkshopProject;
  duplicate: boolean;
}

export interface MakerStartResult extends Partial<ActionResult> {
  project: WorkshopProject;
  duplicate?: boolean;
  accepted?: boolean;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
    readonly providerError: ProviderErrorDetails | null = null,
    readonly requestId: string | null = null,
  ) {
    super(message);
  }
}

let sessionToken: string | null = null;
let sessionUnavailable = false;

/**
 * The hosted demo deliberately issues no session token. A failed token request
 * is not fatal for read-only requests; the server returns DEMO_READ_ONLY for
 * mutations before looking at the token.
 */
async function token(): Promise<string | null> {
  if (sessionToken) return sessionToken;
  if (sessionUnavailable) return null;
  try {
    const response = await fetch("/api/session");
    if (!response.ok) {
      sessionUnavailable = true;
      return null;
    }
    const body = await response.json() as { token: string };
    sessionToken = body.token;
    return sessionToken;
  } catch {
    sessionUnavailable = true;
    return null;
  }
}

async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const headers: Record<string, string> = {};
  const currentToken = await token();
  if (currentToken) headers["x-ub-session-token"] = currentToken;
  if (init?.body !== undefined) {
    headers["content-type"] = "application/json";
  }
  const response = await fetch(path, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const body = await response.json() as T & {
    message?: string;
    code?: string;
    retryable?: boolean;
    providerError?: ProviderErrorDetails | null;
    requestId?: string;
  };
  if (!response.ok) {
    throw new ApiError(
      body.message ?? "The workshop could not complete that action.",
      body.code ?? "REQUEST_FAILED",
      Boolean(body.retryable),
      body.providerError ?? null,
      body.requestId ?? null,
    );
  }
  return body;
}

export function loadProject() {
  return request<WorkshopProject>("/api/project");
}

export function loadConnection() {
  return request<ConnectionStatus>("/api/connection");
}

export function configureConnection(input: { baseUrl: string; username?: string; password?: string }) {
  return request<ConnectionStatus>("/api/connection/configure", { method: "POST", body: input });
}

export function checkConnection(input: { baseUrl?: string; username?: string; password?: string } = {}) {
  return request<ConnectionStatus>("/api/connection/check", { method: "POST", body: input });
}

export function resetConnection() {
  return request<ConnectionStatus>("/api/connection/reset", { method: "POST", body: {} });
}

export function loadDiscovery() {
  return request<OpenCodeDiscovery>("/api/opencode/discovery");
}

export function selectModel(project: WorkshopProject, model: EngineModel, acceptPaidOrUnknown = false) {
  return request<ActionResult>("/api/engine/selection", {
    method: "POST",
    body: {
      actionId: crypto.randomUUID(),
      expectedRevision: project.revision,
      providerID: model.providerID,
      id: model.id,
      variant: model.variant,
      acceptPaidOrUnknown,
    },
  });
}

export function updateModelPreferences(
  project: WorkshopProject,
  input: {
    accessMode: WorkshopProject["modelPreferences"]["access"]["mode"];
    dataPolicy: WorkshopProject["modelPreferences"]["access"]["dataPolicy"];
    maxCostUsd: number | null;
  },
) {
  return request<ActionResult>("/api/model-preferences", {
    method: "POST",
    body: {
      actionId: crypto.randomUUID(),
      expectedRevision: project.revision,
      ...input,
    },
  });
}

export function modelKey(model: EngineModel | null): string | null {
  return model ? `${model.providerID}/${model.id}${model.variant ? `#${model.variant}` : ""}` : null;
}

export function findSelectedModel(discovery: OpenCodeDiscovery | null, model: EngineModel | null): DiscoveredModel | null {
  if (!discovery || !model) return null;
  return discovery.models.find((candidate) => candidate.providerID === model.providerID && candidate.id === model.id) ?? null;
}

export function sendMessage(
  project: WorkshopProject,
  intent: "clarify" | "draft" | "question" | "witness",
  text: string,
  proceedWithAssumptions = false,
) {
  return request<ActionResult>("/api/messages", {
    method: "POST",
    body: { actionId: crypto.randomUUID(), expectedRevision: project.revision, intent, text, proceedWithAssumptions },
  });
}

export type ProjectSourceSelection =
  | { kind: "NEW_PROJECT"; label?: string | null }
  | { kind: "LOCAL_REPOSITORY"; path: string }
  | { kind: "REMOTE_REPOSITORY"; url: string }
  | { kind: "SAVED_PROJECT" };

export function selectProjectSource(project: WorkshopProject, selection: ProjectSourceSelection) {
  return request<ActionResult>("/api/project/source", {
    method: "POST",
    body: { actionId: crypto.randomUUID(), expectedRevision: project.revision, ...selection },
  });
}

export function confirmRemoteSource(project: WorkshopProject) {
  return request<ActionResult>("/api/project/source/confirm", {
    method: "POST",
    body: { actionId: crypto.randomUUID(), expectedRevision: project.revision },
  });
}

export function approveProduct(project: WorkshopProject) {
  return request<ActionResult>("/api/approvals", {
    method: "POST",
    body: { actionId: crypto.randomUUID(), expectedRevision: project.revision, kind: "product" },
  });
}

export function grantScope(project: WorkshopProject, statement: string) {
  return request<ActionResult>("/api/approvals", {
    method: "POST",
    body: { actionId: crypto.randomUUID(), expectedRevision: project.revision, kind: "maker-scope", statement },
  });
}

export function approveSection(project: WorkshopProject, version: number, hash: string, sectionId: string) {
  return request<ActionResult>(`/api/sections/${sectionId}/approve`, {
    method: "POST",
    body: { actionId: crypto.randomUUID(), expectedRevision: project.revision, version, hash },
  });
}

export function reviseSection(project: WorkshopProject, sectionId: string, content: string) {
  return request<ActionResult>(`/api/sections/${sectionId}/revisions`, {
    method: "POST",
    body: { actionId: crypto.randomUUID(), expectedRevision: project.revision, content },
  });
}

export function runMaker(project: WorkshopProject) {
  return request<MakerStartResult>("/api/runs", {
    method: "POST",
    body: { actionId: crypto.randomUUID(), expectedRevision: project.revision },
  });
}

export function cancelRun(project: WorkshopProject, operationId: string) {
  return request<ActionResult>(`/api/runs/${operationId}/cancel`, {
    method: "POST",
    body: { actionId: crypto.randomUUID(), expectedRevision: project.revision },
  });
}

export function reconcileRun(project: WorkshopProject, operationId: string) {
  return request<ActionResult>(`/api/runs/${operationId}/reconcile`, {
    method: "POST",
    body: { actionId: crypto.randomUUID(), expectedRevision: project.revision },
  });
}

/**
 * Retries a Maker run that previously failed with a confirmed outcome. A new
 * operation carries `retryOf`, so the recovered lineage stays complete and no
 * previous native run is duplicated.
 */
export function retryRun(project: WorkshopProject, operationId: string) {
  return request<MakerStartResult>(`/api/runs/${operationId}/retry`, {
    method: "POST",
    body: { actionId: crypto.randomUUID(), expectedRevision: project.revision },
  });
}

/** Marks an outstanding operation abandoned after the user confirms. */
export function abandonRun(project: WorkshopProject, operationId: string) {
  return request<ActionResult>(`/api/runs/${operationId}/abandon`, {
    method: "POST",
    body: { actionId: crypto.randomUUID(), expectedRevision: project.revision },
  });
}

export function loadExport() {
  return request<{ plan: string | null; unresolved: string[]; drafts: Array<{ title: string; content: string }>; engine: WorkshopProject["engine"]; limitation: string }>("/api/export");
}

export function listSessions() {
  return request<{ sessions: SessionSummary[] }>("/api/opencode/sessions");
}

export function resumeSession(sessionId: string) {
  return request<SessionSummary>(`/api/opencode/sessions/${encodeURIComponent(sessionId)}`);
}

export function interruptSession(sessionId: string) {
  return request<{ interrupted: boolean }>(`/api/opencode/sessions/${encodeURIComponent(sessionId)}/interrupt`, {
    method: "POST",
    body: {},
  });
}

export function forkSession(sessionId: string, before?: string) {
  return request<SessionSummary>(`/api/opencode/sessions/${encodeURIComponent(sessionId)}/fork`, {
    method: "POST",
    body: before ? { before } : {},
  });
}

export function compactSession(sessionId: string) {
  return request<{ queued: boolean; inboxId: string | null }>(`/api/opencode/sessions/${encodeURIComponent(sessionId)}/compact`, {
    method: "POST",
    body: {},
  });
}

export function stageRevert(sessionId: string, messageID: string) {
  return request<unknown>(`/api/opencode/sessions/${encodeURIComponent(sessionId)}/revert/stage`, {
    method: "POST",
    body: { messageID },
  });
}

export function clearRevert(sessionId: string) {
  return request<{ cleared: boolean }>(`/api/opencode/sessions/${encodeURIComponent(sessionId)}/revert/clear`, {
    method: "POST",
    body: {},
  });
}

export function commitRevert(sessionId: string) {
  return request<{ committed: boolean }>(`/api/opencode/sessions/${encodeURIComponent(sessionId)}/revert/commit`, {
    method: "POST",
    body: {},
  });
}

export function loadPermissions() {
  return request<{ permissions: Array<{ id: string; sessionID: string; action: string; resources: string[]; message: string | null }> }>("/api/opencode/permissions");
}

export function replyPermission(input: { sessionID: string; requestID: string; decision: "once" | "always" | "reject"; message?: string }) {
  return request<{ replied: boolean }>(`/api/opencode/permissions/${encodeURIComponent(input.requestID)}/reply`, {
    method: "POST",
    body: {
      sessionID: input.sessionID,
      decision: input.decision,
      ...(input.message ? { message: input.message } : {}),
    },
  });
}

export function loadUsage() {
  return request<SessionUsage>("/api/opencode/usage");
}
