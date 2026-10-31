import { createHash, randomUUID } from "node:crypto";
import {
  LEGACY_FIXED_MODEL_KEY,
  actionSchema,
  approvalSchema,
  candidateSectionRevisionSchema,
  capabilitySchema,
  engineSelectionSchema,
  engineSelectionSourceSchema,
  evidenceSchema,
  legacyOperationStatusSchema,
  makerScopeSchema,
  memoryEntrySchema,
  modelAccessModeSchema,
  modelRefSchema,
  modelPreferencesSchema,
  modelPreferencesV3Schema,
  nativeSessionRefSchema,
  operationSchema,
  operationStatusSchema,
  oracleIntakeSchema,
  productSchema,
  projectMemorySchema,
  projectModeSchema,
  projectSchema,
  projectSourceSchema,
  projectV1Schema,
  projectV2Schema,
  projectV3Schema,
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
  candidateSectionRevisionSchema,
  capabilitySchema,
  engineSelectionSchema,
  engineSelectionSourceSchema,
  evidenceSchema,
  legacyOperationStatusSchema,
  makerScopeSchema,
  memoryEntrySchema,
  modelAccessModeSchema,
  modelRefSchema,
  modelPreferencesSchema,
  modelPreferencesV3Schema,
  nativeSessionRefSchema,
  operationSchema,
  operationStatusSchema,
  oracleIntakeSchema,
  productSchema,
  projectMemorySchema,
  projectModeSchema,
  projectSchema,
  projectSourceSchema,
  projectV1Schema,
  projectV2Schema,
  projectV3Schema,
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

export const CURRENT_SCHEMA_VERSION = 4;
export const MIGRATION_TIMESTAMP = "1970-01-01T00:00:00.000Z";

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
    candidateRevisions: [],
  }));
  const now = options?.now ?? new Date().toISOString();
  return refreshNextAction(projectSchema.parse({
    schemaVersion: 4,
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
    source: { kind: mode === "hosted-demo" ? "demo" : "workspace", label: null, externalId: null, importedAt: null },
    oracleIntake: {
      status: "NOT_STARTED",
      summary: null,
      questions: [],
      constraints: [],
      successCriteria: [],
      updatedAt: null,
    },
    memory: { facts: [], decisions: [], constraints: [], risks: [] },
    modelPreferences: {
      access: {
        mode: "ALL_ACCESSIBLE",
        allowedProviders: [],
        allowedModels: [],
        dataPolicy: "PROVIDER_DEFAULT",
        paidOrUnknownAcceptedAt: null,
      },
      budget: { maxCostUsd: null, maxTotalTokens: null, maxRunDurationMs: null },
    },
  }));
}

export interface MigrationResult {
  project: Project;
  fromVersion: number;
  migrated: boolean;
}

/**
 * Reads every supported prior shape as schema v4.
 *
 * The guided-interface line wrote v2 with engine selection but no mode or
 * timestamps. The hardening line wrote v2 with mode/timestamps but no engine.
 * Both v2 variants are accepted through explicit deterministic defaults. A v1
 * fixed-model project preserves that legacy identity for discovery. No
 * migration step reads the wall clock, generates an ID, or deletes history.
 */
export function migrateProject(raw: unknown): MigrationResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Project state must be a JSON object.");
  }
  const source = { ...(raw as Record<string, unknown>) };
  const version = typeof source.schemaVersion === "number" ? source.schemaVersion : 1;
  if (version > CURRENT_SCHEMA_VERSION) throw new UnsupportedSchemaVersionError(version);
  if (version < 1) throw new Error("Project state has an invalid schema version.");

  if (version === 1 || version === 2) {
    const legacy = version === 1 ? projectV1Schema.parse(source) : projectV2Schema.parse(source);
    const createdAt = "createdAt" in legacy && legacy.createdAt ? legacy.createdAt : MIGRATION_TIMESTAMP;
    const updatedAt = "updatedAt" in legacy && legacy.updatedAt ? legacy.updatedAt : createdAt;
    const mode = "mode" in legacy && legacy.mode ? legacy.mode : "local";
    const engine = version === 1
      ? {
          model: null,
          source: "migrated-legacy" as const,
          updatedAt: null,
          legacyModel: LEGACY_FIXED_MODEL_KEY,
        }
      : "engine" in legacy && legacy.engine
        ? legacy.engine
        : { model: null, source: "none" as const, updatedAt: null, legacyModel: null };
    const product = legacy.product;
    const project = projectSchema.parse({
      ...legacy,
      schemaVersion: 4,
      mode,
      demoWorkspace: "demoWorkspace" in legacy ? legacy.demoWorkspace ?? true : true,
      createdAt,
      updatedAt,
      sections: legacy.sections.map((section) => ({ ...section, candidateRevisions: [] })),
      actions: legacy.actions.map((action) => ({ ...action, createdAt: action.createdAt ?? createdAt })),
      operations: legacy.operations.map((operation) => ({
        ...operation,
        status: operation.status === "UNKNOWN" ? "ABANDONED" : operation.status,
        model: "model" in operation ? operation.model : null,
        agent: "agent" in operation ? operation.agent : null,
        startedAt: "startedAt" in operation ? operation.startedAt : null,
        finishedAt: "finishedAt" in operation ? operation.finishedAt : null,
        statusReason: operation.status === "UNKNOWN" ? "legacy-unknown-outcome" : null,
        lastObservedAt: null,
        appliedAt: null,
        providerError: null,
      })),
      evidence: legacy.evidence.map((evidence) => ({
        ...evidence,
        model: "model" in evidence ? evidence.model : null,
      })),
      witnessDrafts: legacy.witnessDrafts.map((draft) => ({ ...draft, createdAt: draft.createdAt ?? createdAt })),
      engine,
      source: {
        kind: mode === "hosted-demo" ? "demo" : "workspace",
        label: null,
        externalId: null,
        importedAt: null,
      },
      oracleIntake: {
        status: product.status === "APPROVED" ? "APPROVED" : product.status === "PROPOSED" ? "READY" : "NOT_STARTED",
        summary: product.proposal,
        questions: product.openQuestions.map((prompt) => ({ prompt, answer: null })),
        constraints: [],
        successCriteria: [],
        updatedAt: null,
      },
      memory: { facts: [], decisions: [], constraints: [], risks: [] },
      modelPreferences: {
        access: {
          mode: "FREE_OR_LOCAL_ONLY",
          allowedProviders: [],
          allowedModels: [],
          dataPolicy: "PROVIDER_DEFAULT",
          paidOrUnknownAcceptedAt: null,
        },
        budget: { maxCostUsd: null, maxTotalTokens: null, maxRunDurationMs: null },
      },
    });
    return { project, fromVersion: version, migrated: true };
  }

  if (version === 3) {
    const legacy = projectV3Schema.parse(source);
    const project = projectSchema.parse({
      ...legacy,
      schemaVersion: 4,
      operations: legacy.operations.map((operation) => ({ ...operation, providerError: null })),
      modelPreferences: {
        access: {
          mode: legacy.modelPreferences.access.requireFreeOrLocal ? "FREE_OR_LOCAL_ONLY" : "ALL_ACCESSIBLE",
          allowedProviders: legacy.modelPreferences.access.allowedProviders,
          allowedModels: legacy.modelPreferences.access.allowedModels,
          dataPolicy: legacy.modelPreferences.access.dataPolicy,
          paidOrUnknownAcceptedAt: null,
        },
        budget: {
          maxCostUsd: legacy.modelPreferences.budget.maxCostUsd && legacy.modelPreferences.budget.maxCostUsd > 0
            ? legacy.modelPreferences.budget.maxCostUsd
            : null,
          maxTotalTokens: legacy.modelPreferences.budget.maxTotalTokens,
          maxRunDurationMs: legacy.modelPreferences.budget.maxRunDurationMs,
        },
      },
    });
    return { project, fromVersion: 3, migrated: true };
  }

  const missingDefaults = !("source" in source)
    || !("oracleIntake" in source)
    || !("memory" in source)
    || !("modelPreferences" in source)
    || !Array.isArray(source.sections)
    || source.sections.some((section) => !section || typeof section !== "object" || !("candidateRevisions" in section))
    || !Array.isArray(source.operations)
    || source.operations.some((operation) => !operation || typeof operation !== "object"
      || !("statusReason" in operation) || !("lastObservedAt" in operation) || !("appliedAt" in operation)
      || !("providerError" in operation));
  const project = projectSchema.parse(source);
  return { project, fromVersion: version, migrated: missingDefaults };
}

export function refreshNextAction(project: Project): Project {
  const current = project.sections.find((section) => section.status !== "APPROVED") ?? null;
  project.currentSectionId = current?.id ?? null;

  const unresolved = project.operations.find((operation) =>
    ["QUEUED", "RUNNING", "WAITING_PERMISSION", "COMPLETED_UNAPPLIED", "ABANDONED"].includes(operation.status),
  );
  if (unresolved) {
    project.stage = unresolved.kind === "maker" ? "MAKER" : unresolved.kind === "witness" ? "WITNESS" : "ARCHITECT";
    project.nextAction = unresolved.status === "WAITING_PERMISSION"
      ? "A native permission is pending. Resolve it in OpenCode, then reconcile. Work will not be repeated automatically."
      : unresolved.status === "RUNNING"
        ? "A native run is still running. Wait or reconcile. It will not be started again automatically."
        : unresolved.status === "COMPLETED_UNAPPLIED"
          ? "A native result arrived after the active request ended. Review and apply or discard it before any new run."
          : "A native run was abandoned without a confirmed outcome. Reconcile it before any new run.";
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
