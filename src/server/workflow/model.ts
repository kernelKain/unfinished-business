import { createHash, randomUUID } from "node:crypto";
import {
  LEGACY_FIXED_MODEL_KEY,
  actionSchema,
  approvalSchema,
  capabilitySchema,
  engineSelectionSchema,
  engineSelectionSourceSchema,
  evidenceSchema,
  makerScopeSchema,
  modelRefSchema,
  nativeSessionRefSchema,
  operationSchema,
  operationStatusSchema,
  productSchema,
  projectModeSchema,
  projectSchema,
  projectV1Schema,
  sectionSchema,
  sectionStatusSchema,
  transcriptEntrySchema,
  witnessDraftSchema,
  type Capability,
  type EngineSelection,
  type Evidence,
  type ModelRef,
  type Operation,
  type PlanSection,
  type Project,
  type ProjectMode,
  type SpiritRole,
} from "../../shared/workflow.ts";

export {
  LEGACY_FIXED_MODEL_KEY,
  actionSchema,
  approvalSchema,
  capabilitySchema,
  engineSelectionSchema,
  engineSelectionSourceSchema,
  evidenceSchema,
  makerScopeSchema,
  modelRefSchema,
  nativeSessionRefSchema,
  operationSchema,
  operationStatusSchema,
  productSchema,
  projectModeSchema,
  projectSchema,
  projectV1Schema,
  sectionSchema,
  sectionStatusSchema,
  transcriptEntrySchema,
  witnessDraftSchema,
  type Capability,
  type EngineSelection,
  type Evidence,
  type ModelRef,
  type Operation,
  type PlanSection,
  type Project,
  type ProjectMode,
  type SpiritRole,
};

export const CURRENT_SCHEMA_VERSION = 2;

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
    schemaVersion: 2,
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
    engine: { model: null, source: "none", updatedAt: null, legacyModel: null },
  }));
}

export interface MigrationResult {
  project: Project;
  fromVersion: number;
  migrated: boolean;
}

/**
 * Reads both supported prior shapes as schema v2.
 *
 * The guided-interface line wrote v2 with engine selection but no mode or
 * timestamps. The hardening line wrote v2 with mode/timestamps but no engine.
 * Both are accepted through explicit defaults; missing fields are filled, and
 * a v1 fixed-model project preserves that legacy identity for discovery.
 */
export function migrateProject(raw: unknown): MigrationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Project state must be a JSON object.");
  }
  const source = { ...(raw as Record<string, unknown>) };
  const version = typeof source.schemaVersion === "number" ? source.schemaVersion : 1;
  if (version > CURRENT_SCHEMA_VERSION) throw new UnsupportedSchemaVersionError(version);
  if (version < 1) throw new Error("Project state has an invalid schema version.");

  if (version === 1) {
    const legacy = projectV1Schema.parse(source);
    const now = new Date().toISOString();
    return {
      project: projectSchema.parse({
        ...legacy,
        schemaVersion: 2,
        mode: "local",
        demoWorkspace: true,
        createdAt: now,
        updatedAt: now,
        actions: legacy.actions.map((action) => ({ ...action, createdAt: now })),
        operations: legacy.operations.map((operation) => ({
          ...operation,
          model: null,
          agent: null,
          startedAt: null,
          finishedAt: null,
        })),
        evidence: legacy.evidence.map((evidence) => ({ ...evidence, model: null })),
        witnessDrafts: legacy.witnessDrafts.map((draft) => ({ ...draft, createdAt: now })),
        engine: {
          model: null,
          source: "migrated-legacy",
          updatedAt: null,
          legacyModel: LEGACY_FIXED_MODEL_KEY,
        },
      }),
      fromVersion: 1,
      migrated: true,
    };
  }

  const missingDefaults = !("mode" in source)
    || !("createdAt" in source)
    || !("updatedAt" in source)
    || !("engine" in source);
  const project = projectSchema.parse(source);
  return { project, fromVersion: version, migrated: missingDefaults };
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
