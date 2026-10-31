export interface WorkshopProject {
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
  modelAvailable: boolean;
  limitation: string | null;
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
  ) {
    super(message);
  }
}

let sessionToken: string | null = null;

async function token(): Promise<string> {
  if (sessionToken) return sessionToken;
  const response = await fetch("/api/session");
  if (!response.ok) throw new ApiError("The local workshop session could not be opened.", "SESSION", true);
  const body = await response.json() as { token: string };
  sessionToken = body.token;
  return sessionToken;
}

async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.body) {
    headers["content-type"] = "application/json";
    headers["x-ub-session-token"] = await token();
  }
  const response = await fetch(path, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const body = await response.json() as T & { message?: string; code?: string; retryable?: boolean };
  if (!response.ok) {
    throw new ApiError(body.message ?? "The workshop could not complete that action.", body.code ?? "REQUEST_FAILED", Boolean(body.retryable));
  }
  return body;
}

export function loadProject() {
  return request<WorkshopProject>("/api/project");
}

export async function loadEngine(): Promise<EngineStatus> {
  try {
    const response = await fetch("/api/engine");
    const body = await response.json() as Partial<EngineStatus>;
    if (typeof body.available === "boolean") {
      return {
        available: body.available,
        serverVersion: body.serverVersion ?? null,
        modelAvailable: Boolean(body.modelAvailable),
        limitation: body.limitation ?? null,
      };
    }
  } catch {
    // The status below is the visible recovery state.
  }
  return {
    available: false,
    serverVersion: null,
    modelAvailable: false,
    limitation: "OpenCode could not be reached from this workshop.",
  };
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

export function loadExport() {
  return request<{ plan: string | null; unresolved: string[]; drafts: Array<{ title: string; content: string }>; limitation: string }>("/api/export");
}
