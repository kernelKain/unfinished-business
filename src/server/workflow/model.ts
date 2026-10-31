import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

export const CURRENT_SCHEMA_VERSION = 2;

export const projectModeSchema = z.enum(["local", "hosted-demo", "private-hosted"]);
export type ProjectMode = z.infer<typeof projectModeSchema>;

export const sectionStatusSchema = z.enum(["NOT_STARTED", "DRAFT", "APPROVED", "STALE"]);
export const operationStatusSchema = z.enum([
  "QUEUED", "RUNNING", "WAITING_PERMISSION", "SUCCEEDED", "FAILED", "CANCELLED", "UNKNOWN",
]);

export const sectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  order: z.number().int().positive(),
  dependencies: z.array(z.string()),
  content: z.string(),
  version: z.number().int().nonnegative(),
  hash: z.string(),
  status: sectionStatusSchema,
});

export const approvalSchema = z.object({
  id: z.string(),
  sectionId: z.string(),
  version: z.number().int().positive(),
  hash: z.string(),
  approvedAt: z.string(),
  staleReason: z.string().nullable(),
});

export const actionSchema = z.object({
  id: z.string(),
  payloadHash: z.string(),
  resultRevision: z.number().int().nonnegative(),
  createdAt: z.string().default(() => new Date().toISOString()),
});

export const operationSchema = z.object({
  id: z.string(),
  kind: z.enum(["guide", "maker", "witness", "check"]).default("guide"),
  payloadHash: z.string(),
  nativeSessionId: z.string().nullable(),
  nativeMessageId: z.string().nullable(),
  status: operationStatusSchema,
  result: z.string().nullable(),
  startedAt: z.string().nullable().default(null),
  finishedAt: z.string().nullable().default(null),
});

export const evidenceSchema = z.object({
  id: z.string(),
  checkId: z.string(),
  nativeResultReference: z.string(),
  testedFingerprint: z.string(),
  result: z.enum(["PASS", "FAIL", "NOT_RUN", "INCONCLUSIVE", "STALE"]),
  observedAt: z.string(),
  limitation: z.string().nullable(),
});

export const productSchema = z.object({
  status: z.enum(["NONE", "PROPOSED", "APPROVED"]).default("NONE"),
  proposal: z.string().nullable().default(null),
  openQuestions: z.array(z.string()).default([]),
});

export const makerScopeSchema = z.object({
  status: z.enum(["NONE", "GRANTED"]).default("NONE"),
  statement: z.string().nullable().default(null),
});

export const transcriptEntrySchema = z.object({
  id: z.string(),
  spirit: z.enum(["user", "oracle", "architect", "maker", "witness", "system"]),
  text: z.string(),
  createdAt: z.string(),
});

export const capabilitySchema = z.object({
  id: z.string(),
  purpose: z.string(),
  nativeMapping: z.string(),
  availability: z.enum(["available", "unavailable", "unknown"]),
  permission: z.string(),
  observedOutcome: z.string().nullable(),
});

export const witnessDraftSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  nativeSessionId: z.string().nullable(),
  createdAt: z.string().default(() => new Date().toISOString()),
});

export const nativeSessionRefSchema = z.object({
  role: z.enum(["oracle", "architect", "maker", "witness"]),
  sessionId: z.string(),
});

export const projectSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  id: z.string(),
  revision: z.number().int().nonnegative(),
  mode: projectModeSchema.default("local"),
  workspace: z.string(),
  demoWorkspace: z.boolean().default(true),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
  stage: z.enum(["ORACLE", "ARCHITECT", "MAKER", "WITNESS"]),
  currentSectionId: z.string().nullable(),
  sections: z.array(sectionSchema),
  approvals: z.array(approvalSchema),
  actions: z.array(actionSchema),
  operations: z.array(operationSchema),
  evidence: z.array(evidenceSchema),
  nextAction: z.string(),
  product: productSchema.default({ status: "NONE", proposal: null, openQuestions: [] }),
  makerScope: makerScopeSchema.default({ status: "NONE", statement: null }),
  transcript: z.array(transcriptEntrySchema).default([]),
  capabilities: z.array(capabilitySchema).default([]),
  witnessDrafts: z.array(witnessDraftSchema).default([]),
  nativeSessions: z.array(nativeSessionRefSchema).default([]),
});

export type Project = z.infer<typeof projectSchema>;
export type PlanSection = z.infer<typeof sectionSchema>;
export type Operation = z.infer<typeof operationSchema>;
export type Capability = z.infer<typeof capabilitySchema>;
export type SpiritRole = "oracle" | "architect" | "maker" | "witness";

export class UnsupportedSchemaVersionError extends Error {
  constructor(readonly version: unknown) {
    super(`Project schema version ${String(version)} is newer than this build. The original file was preserved.`);
    this.name = "UnsupportedSchemaVersionError";
  }
}

const sectionDefinitions = [
  ["control", "Control, product, scope, and acceptance", []],
  ["architecture", "Architecture and contracts", ["control"]],
  ["experience", "Experience", ["control", "architecture"]],
  ["tools", "Tools, access, and cost", ["architecture"]],
  ["verification", "Verification and risks", ["control", "architecture", "tools"]],
  ["phases", "Phases and queue", ["verification"]],
  ["delivery", "Delivery", ["experience", "verification", "phases"]],
  ["readiness", "Execution directive and readiness", ["control", "architecture", "experience", "tools", "verification", "phases", "delivery"]],
] as const;

export function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const entry = (value as Record<string, unknown>)[key];
      if (entry !== undefined) sorted[key] = canonicalize(entry);
    }
    return sorted;
  }
  return value;
}

export function payloadHash(payload: unknown): string {
  return contentHash(JSON.stringify(canonicalize(payload)));
}

export function createProject(
  workspace: string,
  mode: ProjectMode = "local",
  options?: { demoWorkspace?: boolean; now?: string },
): Project {
  const sections = sectionDefinitions.map(([id, title, dependencies], index) => ({
    id,
    title,
    order: index + 1,
    dependencies: [...dependencies],
    content: "",
    version: 0,
    hash: contentHash(""),
    status: "NOT_STARTED" as const,
  }));
  const now = options?.now ?? new Date().toISOString();
  return refreshNextAction(projectSchema.parse({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: randomUUID(),
    revision: 0,
    mode,
    workspace,
    demoWorkspace: options?.demoWorkspace ?? true,
    createdAt: now,
    updatedAt: now,
    stage: "ORACLE",
    currentSectionId: sections[0].id,
    sections,
    approvals: [],
    actions: [],
    operations: [],
    evidence: [],
    nextAction: "Describe an idea and wake the Oracle",
    product: { status: "NONE", proposal: null, openQuestions: [] },
    makerScope: { status: "NONE", statement: null },
    transcript: [],
    capabilities: [
      {
        id: "inspect-changes",
        purpose: "Show the diff from the Maker's native session",
        nativeMapping: "OpenCode session.diff in the isolated demo workspace",
        availability: "unknown",
        permission: "Read-only inspection after a Maker run",
        observedOutcome: null,
      },
      {
        id: "node-check",
        purpose: "Run the approved dependency-free Node test",
        nativeMapping: "bounded node --test in the isolated demo workspace",
        availability: "available",
        permission: "Runs only after an explicit Maker scope grant and a native edit",
        observedOutcome: null,
      },
    ],
    witnessDrafts: [],
    nativeSessions: [],
  }));
}

export interface MigrationResult {
  project: Project;
  fromVersion: number;
  migrated: boolean;
}

export function migrateProject(raw: unknown): MigrationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Project state must be a JSON object.");
  }
  const source = { ...(raw as Record<string, unknown>) };
  const version = typeof source.schemaVersion === "number" ? source.schemaVersion : 1;
  if (version > CURRENT_SCHEMA_VERSION) throw new UnsupportedSchemaVersionError(version);
  if (version < 1) throw new Error("Project state has an invalid schema version.");

  const migrated = version < CURRENT_SCHEMA_VERSION;
  if (migrated) {
    const now = new Date().toISOString();
    source.schemaVersion = CURRENT_SCHEMA_VERSION;
    source.mode = source.mode ?? "local";
    source.demoWorkspace = source.demoWorkspace ?? true;
    source.createdAt = source.createdAt ?? source.updatedAt ?? now;
    source.updatedAt = source.updatedAt ?? source.createdAt;
  }
  const project = projectSchema.parse(source);
  return { project, fromVersion: version, migrated };
}

export function refreshNextAction(project: Project): Project {
  const current = project.sections.find((section) => section.status !== "APPROVED") ?? null;
  project.currentSectionId = current?.id ?? null;

  const unresolved = project.operations.find((operation) =>
    ["QUEUED", "RUNNING", "WAITING_PERMISSION", "UNKNOWN"].includes(operation.status),
  );
  if (unresolved) {
    project.stage = unresolved.kind === "maker" ? "MAKER" : unresolved.kind === "witness" ? "WITNESS" : "ARCHITECT";
    project.nextAction = unresolved.status === "WAITING_PERMISSION"
      ? "A native permission is pending. Resolve it in OpenCode, then reconcile. Work will not be repeated automatically."
      : unresolved.status === "RUNNING"
        ? "A native run is still running. Wait or reconcile. It will not be started again automatically."
        : "A native run has an unknown outcome. Reconcile it before any new run.";
    return project;
  }

  if (project.product.status !== "APPROVED") {
    project.stage = "ORACLE";
    project.nextAction = project.product.status === "PROPOSED"
      ? "Approve the Oracle proposal, or ask a question"
      : "Describe an idea and wake the Oracle";
    return project;
  }
  if (current) {
    project.stage = "ARCHITECT";
    project.nextAction = `${current.status === "DRAFT" || current.status === "STALE" ? "Review" : "Draft"} ${current.title}`;
    return project;
  }
  if (project.makerScope.status !== "GRANTED") {
    project.stage = "ARCHITECT";
    project.nextAction = "Grant a separate Maker execution scope";
    return project;
  }
  const makerSucceeded = project.operations.some((operation) => operation.kind === "maker" && operation.status === "SUCCEEDED");
  if (!makerSucceeded) {
    project.stage = "MAKER";
    project.nextAction = "Run the approved Maker unit and inspect the result";
    return project;
  }
  project.stage = "WITNESS";
  project.nextAction = project.witnessDrafts.length
    ? "Review the Witness drafts"
    : "Ask the Witness to review the evidence";
  return project;
}
