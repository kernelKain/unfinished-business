export interface WorkshopProject {
  schemaVersion: number;
  mode: "local" | "hosted-demo" | "private-hosted";
  demoWorkspace: boolean;
  updatedAt: string;
  revision: number;
  stage: "ORACLE" | "ARCHITECT" | "MAKER" | "WITNESS";
  currentSectionId: string | null;
  nextAction: string;
  product: { status: "NONE" | "PROPOSED" | "APPROVED"; proposal: string | null; openQuestions: string[] };
  makerScope: { status: "NONE" | "GRANTED"; statement: string | null };
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
  operations: Array<{ id: string; kind: string; status: string; result: string | null; nativeSessionId: string | null }>;
  capabilities: Array<{
    id: string;
    purpose: string;
    nativeMapping: string;
    availability: string;
    permission: string;
    observedOutcome: string | null;
  }>;
  witnessDrafts: Array<{ id: string; title: string; content: string }>;
  evidence: Array<{ id: string; checkId: string; result: string; limitation: string | null }>;
}

export interface EngineStatus {
  available: boolean;
  serverVersion: string | null;
  versionCompatible: boolean;
  authenticated: boolean;
  mode: "local" | "hosted-demo" | "private-hosted";
  modelAvailable: boolean;
  limitation: string | null;
}

export interface RuntimeStatus {
  mode: "local" | "hosted-demo" | "private-hosted";
  production: boolean;
  demoWorkspace: true;
  authRequired: boolean;
  originProtection: true;
  budgets: {
    guideTimeoutMs: number;
    makerTimeoutMs: number;
    nodeCheckTimeoutMs: number;
    maxSessionTokens: number;
    maxSessionCostUsd: number;
    toolCallBudget: null;
    toolCallBudgetLimitation: string;
  };
  limits: {
    maxRequestBytes: number;
    rateLimitPerMinute: number;
    maxConcurrentMutations: number;
    maxSseConnections: number;
  };
  retention: Record<string, number>;
}

export interface ActionResult {
  project: WorkshopProject;
  duplicate: boolean;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
    readonly operationId: string | null = null,
  ) {
    super(message);
  }
}

let sessionToken: string | null = null;
let sessionPromise: Promise<string> | null = null;

async function token(force = false): Promise<string> {
  if (sessionToken && !force) return sessionToken;
  if (sessionPromise && !force) return sessionPromise;
  sessionPromise = (async () => {
    const response = await fetch("/api/session", { headers: { accept: "application/json" } });
    if (!response.ok) throw new ApiError("The workshop session could not be opened. Reload the page.", "SESSION", true);
    const body = await response.json() as { token: string };
    sessionToken = body.token;
    return sessionToken;
  })();
  try {
    return await sessionPromise;
  } finally {
    sessionPromise = null;
  }
}

async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "x-ub-session-token": await token(),
  };
  if (init?.body) headers["content-type"] = "application/json";
  const response = await fetch(path, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const body = await response.json().catch(() => ({})) as T & {
    message?: string;
    code?: string;
    retryable?: boolean;
    operationId?: string | null;
  };
  if (!response.ok) {
    if (body.code === "INVALID_SESSION") {
      sessionToken = null;
      throw new ApiError("The local workshop session expired. Reload the page.", "SESSION", true);
    }
    throw new ApiError(
      body.message ?? "The workshop could not complete that action.",
      body.code ?? "REQUEST_FAILED",
      Boolean(body.retryable),
      body.operationId ?? null,
    );
  }
  return body;
}

export function loadProject() {
  return request<WorkshopProject>("/api/project");
}

export async function loadEngine(): Promise<EngineStatus> {
  try {
    return await request<EngineStatus>("/api/engine");
  } catch {
    return {
      available: false,
      serverVersion: null,
      versionCompatible: true,
      authenticated: true,
      mode: "local",
      modelAvailable: false,
      limitation: "OpenCode could not be reached from this workshop.",
    };
  }
}

export function loadRuntime(): Promise<RuntimeStatus> {
  return request<RuntimeStatus>("/api/runtime");
}

export function sendMessage(project: WorkshopProject, intent: "clarify" | "draft" | "question" | "witness", text: string) {
  return request<ActionResult>("/api/messages", {
    method: "POST",
    body: { actionId: crypto.randomUUID(), expectedRevision: project.revision, intent, text },
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
  return request<ActionResult>("/api/runs", {
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

export interface ApprovedExport {
  schemaVersion: number;
  mode: string;
  generatedAt: string;
  plan: string | null;
  unresolved: string[];
  drafts: Array<{ title: string; content: string }>;
  redacted: true;
  limitation: string;
}

export function loadExport() {
  return request<ApprovedExport>("/api/export");
}
