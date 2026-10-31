import { z } from "zod";

/**
 * Browser-safe workflow contracts.
 *
 * These schemas are shared by the server, the browser, and the deterministic
 * demo fixture. Hashing, persistence, and project creation stay in
 * `src/server/workflow/model.ts` because they use Node's crypto module.
 *
 * Schema v6 keeps every v5 workflow record and activates guided Oracle
 * discovery: explicit project-source onboarding, field-level intake answers,
 * structured proposals, assumptions, and durable decision memory.
 */

export const LEGACY_FIXED_MODEL_KEY = "opencode/deepseek-v4.1-flash-free";

export const projectModeSchema = z.enum(["local", "hosted-demo", "private-hosted"]);
export type ProjectMode = z.infer<typeof projectModeSchema>;

export const sectionStatusSchema = z.enum(["NOT_STARTED", "DRAFT", "APPROVED", "STALE"]);
export const legacyOperationStatusSchema = z.enum([
  "QUEUED", "RUNNING", "WAITING_PERMISSION", "SUCCEEDED", "FAILED", "CANCELLED", "UNKNOWN",
]);
export const operationStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "WAITING_PERMISSION",
  "COMPLETED_UNAPPLIED",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "ABANDONED",
]);

export const operationIntentSchema = z.enum([
  "clarify",
  "draft",
  "question",
  "witness",
  "maker-run",
]);

export const expectedOutputSchema = z.enum([
  "ORACLE_REPLY",
  "SECTION_DRAFT",
  "WITNESS_REPLY",
  "QUESTION_REPLY",
  "MAKER_DIFF",
]);

/**
 * Observable run phases. They are recorded while a run is in flight and are
 * cleared once the operation reaches a terminal status. Phase labels are safe
 * summaries; they never contain prompts, raw model text, or streamUTF JSON.
 */
export const operationPhaseSchema = z.enum([
  "CONNECTING",
  "SESSION_CREATED",
  "WAITING_FOR_MODEL",
  "RECEIVING_OUTPUT",
  "VALIDATING_RESULT",
  "WAITING_PERMISSION",
  "APPLYING_RESULT",
  "RUNNING_CHECKS",
  "AWAITING_RECONCILIATION",
]);

export const operationProgressSchema = z.object({
  phase: operationPhaseSchema,
  detail: z.string().max(500).nullable().default(null),
  updatedAt: z.string(),
});

export const providerErrorCategorySchema = z.enum([
  "PROVIDER_DATA_POLICY",
  "PROVIDER_AUTH",
  "PROVIDER_RATE_LIMIT",
  "PROVIDER_QUOTA",
  "MODEL_UNAVAILABLE",
  "MODEL_CONTEXT_LIMIT",
  "PROVIDER_TEMPORARY",
  "UNKNOWN_PROVIDER_FAILURE",
]);

export const providerErrorActionSchema = z.enum([
  "retry",
  "change-model",
  "reconnect-provider",
  "check-quota",
  "reduce-context",
  "review-privacy",
]);

export const providerErrorSchema = z.object({
  category: providerErrorCategorySchema,
  whatHappened: z.string(),
  savedWorkChanged: z.enum(["no", "possibly"]),
  savedWorkMessage: z.string(),
  repair: z.string(),
  action: providerErrorActionSchema,
  retryable: z.boolean(),
  technical: z.object({
    provider: z.string(),
    statusCode: z.number().int().nullable(),
    providerCode: z.string().nullable(),
    sessionReference: z.string().nullable(),
    diagnosticReference: z.string(),
    safeDetail: z.string(),
  }),
});

export type ProviderErrorDetails = z.infer<typeof providerErrorSchema>;
export type OperationIntent = z.infer<typeof operationIntentSchema>;
export type ExpectedOutput = z.infer<typeof expectedOutputSchema>;
export type OperationPhase = z.infer<typeof operationPhaseSchema>;
export type OperationProgress = z.infer<typeof operationProgressSchema>;

export const modelRefSchema = z.object({
  providerID: z.string().min(1),
  id: z.string().min(1),
  variant: z.string().min(1).nullable().default(null),
});

export type ModelRef = z.infer<typeof modelRefSchema>;

export const engineSelectionSourceSchema = z.enum(["none", "user", "migrated-legacy", "auto-discovery"]);

export const engineSelectionSchema = z.object({
  model: modelRefSchema.nullable().default(null),
  source: engineSelectionSourceSchema.default("none"),
  updatedAt: z.string().nullable().default(null),
  legacyModel: z.string().nullable().default(null),
});

export type EngineSelection = z.infer<typeof engineSelectionSchema>;

export const candidateSectionRevisionSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  content: z.string(),
  hash: z.string(),
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "SUPERSEDED"]),
  sourceOperationId: z.string().nullable(),
  createdAt: z.string(),
});

const legacySectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  order: z.number().int().positive(),
  dependencies: z.array(z.string()),
  content: z.string(),
  version: z.number().int().nonnegative(),
  hash: z.string(),
  status: sectionStatusSchema,
});

export const sectionSchema = legacySectionSchema.extend({
  candidateRevisions: z.array(candidateSectionRevisionSchema).default([]),
});

export const approvalSchema = z.object({
  id: z.string(),
  sectionId: z.string(),
  version: z.number().int().positive(),
  hash: z.string(),
  approvedAt: z.string(),
  staleReason: z.string().nullable(),
});

const legacyActionSchema = z.object({
  id: z.string(),
  payloadHash: z.string(),
  resultRevision: z.number().int().nonnegative(),
  createdAt: z.string().optional(),
});

export const actionSchema = legacyActionSchema.extend({
  createdAt: z.string().default(() => new Date().toISOString()),
});

const operationCoreSchema = z.object({
  id: z.string(),
  kind: z.enum(["guide", "maker", "witness", "check"]).default("guide"),
  payloadHash: z.string(),
  nativeSessionId: z.string().nullable(),
  nativeMessageId: z.string().nullable(),
  status: operationStatusSchema,
  result: z.string().nullable(),
});

const legacyOperationCoreSchema = operationCoreSchema.omit({ status: true }).extend({
  status: legacyOperationStatusSchema,
});

export const operationSchema = operationCoreSchema.extend({
  model: modelRefSchema.nullable().default(null),
  agent: z.string().nullable().default(null),
  startedAt: z.string().nullable().default(null),
  finishedAt: z.string().nullable().default(null),
  statusReason: z.string().nullable().default(null),
  lastObservedAt: z.string().nullable().default(null),
  appliedAt: z.string().nullable().default(null),
  providerError: providerErrorSchema.nullable().default(null),
  intent: operationIntentSchema.nullable().default(null),
  sectionId: z.string().nullable().default(null),
  startingRevision: z.number().int().nonnegative().nullable().default(null),
  idempotencyKey: z.string().max(128).nullable().default(null),
  expectedOutput: expectedOutputSchema.nullable().default(null),
  retryOf: z.string().nullable().default(null),
  progress: operationProgressSchema.nullable().default(null),
  oracleProceedWithAssumptions: z.boolean().optional(),
});

/** Schema v5 operation rows predate the Oracle assumptions flag. */
export const operationV5Schema = operationCoreSchema.extend({
  model: modelRefSchema.nullable().default(null),
  agent: z.string().nullable().default(null),
  startedAt: z.string().nullable().default(null),
  finishedAt: z.string().nullable().default(null),
  statusReason: z.string().nullable().default(null),
  lastObservedAt: z.string().nullable().default(null),
  appliedAt: z.string().nullable().default(null),
  providerError: providerErrorSchema.nullable().default(null),
  intent: operationIntentSchema.nullable().default(null),
  sectionId: z.string().nullable().default(null),
  startingRevision: z.number().int().nonnegative().nullable().default(null),
  idempotencyKey: z.string().max(128).nullable().default(null),
  expectedOutput: expectedOutputSchema.nullable().default(null),
  retryOf: z.string().nullable().default(null),
  progress: operationProgressSchema.nullable().default(null),
});

/**
 * The schema v4 operation record. New operations carry recovery metadata, so
 * v4 reads remain accepted and are explicitly backfilled during migration.
 */
export const operationV4Schema = operationCoreSchema.extend({
  model: modelRefSchema.nullable().default(null),
  agent: z.string().nullable().default(null),
  startedAt: z.string().nullable().default(null),
  finishedAt: z.string().nullable().default(null),
  statusReason: z.string().nullable().default(null),
  lastObservedAt: z.string().nullable().default(null),
  appliedAt: z.string().nullable().default(null),
  providerError: providerErrorSchema.nullable().default(null),
});

const legacyOperationSchema = legacyOperationCoreSchema.extend({
  model: modelRefSchema.nullable().default(null),
  agent: z.string().nullable().default(null),
  startedAt: z.string().nullable().default(null),
  finishedAt: z.string().nullable().default(null),
});

const evidenceCoreSchema = z.object({
  id: z.string(),
  checkId: z.string(),
  nativeResultReference: z.string(),
  testedFingerprint: z.string(),
  result: z.enum(["PASS", "FAIL", "NOT_RUN", "INCONCLUSIVE", "STALE"]),
  observedAt: z.string(),
  limitation: z.string().nullable(),
});

export const evidenceSchema = evidenceCoreSchema.extend({
  model: modelRefSchema.nullable().default(null),
});

export const oracleProposalSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(4_000),
  intendedUser: z.string().min(1).max(2_000),
  problem: z.string().min(1).max(4_000),
  desiredOutcome: z.string().min(1).max(4_000),
  mustHaveFeatures: z.array(z.string().min(1).max(500)).max(20),
  optionalFeatures: z.array(z.string().min(1).max(500)).max(20),
  nonGoals: z.array(z.string().min(1).max(500)).max(20),
  successCriteria: z.array(z.string().min(1).max(500)).max(20),
  facts: z.array(z.string().min(1).max(1_000)).max(30),
  userDecisions: z.array(z.string().min(1).max(1_000)).max(30),
  assumptions: z.array(z.string().min(1).max(1_000)).max(30),
});

const productV5Schema = z.object({
  status: z.enum(["NONE", "PROPOSED", "APPROVED"]).default("NONE"),
  proposal: z.string().nullable().default(null),
  openQuestions: z.array(z.string()).default([]),
});

export const productSchema = productV5Schema.extend({
  structuredProposal: oracleProposalSchema.nullable().optional(),
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

const legacyWitnessDraftSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  nativeSessionId: z.string().nullable(),
  createdAt: z.string().optional(),
});

export const witnessDraftSchema = legacyWitnessDraftSchema.extend({
  createdAt: z.string().default(() => new Date().toISOString()),
});

export const nativeSessionRefSchema = z.object({
  role: z.enum(["oracle", "architect", "maker", "witness"]),
  sessionId: z.string(),
});

export const projectSourceV5Schema = z.object({
  kind: z.enum(["workspace", "import", "template", "demo"]).default("workspace"),
  label: z.string().nullable().default(null),
  externalId: z.string().nullable().default(null),
  importedAt: z.string().nullable().default(null),
});

export const projectSourceSchema = z.object({
  kind: z.enum(["UNSELECTED", "NEW_PROJECT", "LOCAL_REPOSITORY", "REMOTE_REPOSITORY", "SAVED_PROJECT", "DEMO"]),
  status: z.enum(["UNSELECTED", "PENDING_CONFIRMATION", "CONFIRMED"]),
  label: z.string().max(500).nullable(),
  repositoryUrl: z.string().max(2_048).nullable(),
  workspacePath: z.string().max(4_096).nullable(),
  managedWorkspace: z.boolean(),
  importedAt: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  repositoryCondition: z.string().max(2_000).nullable(),
});

export const oracleQuestionSchema = z.object({
  id: z.string().min(1).max(128),
  field: z.enum([
    "intendedUser", "problem", "desiredOutcome", "deadlineEvent", "mustHaveFeatures",
    "optionalFeatures", "budget", "privacyRequirements", "platforms",
    "repositoryCondition", "nonGoals", "unresolvedQuestions",
  ]),
  prompt: z.string().min(1).max(1_000),
  whyItMatters: z.string().min(1).max(1_000),
  suggestedChoices: z.array(z.string().min(1).max(300)).max(6),
});

export const intakeAnswerSourceSchema = z.enum(["USER", "ASSUMPTION", "SYSTEM"]);
const scalarIntakeAnswerSchema = z.object({
  value: z.string().min(1).max(4_000),
  source: intakeAnswerSourceSchema,
  updatedAt: z.string(),
});
const listIntakeAnswerSchema = z.object({
  value: z.array(z.string().min(1).max(1_000)).max(30),
  source: intakeAnswerSourceSchema,
  updatedAt: z.string(),
});

export const oracleIntakeV5Schema = z.object({
  status: z.enum(["NOT_STARTED", "COLLECTING", "READY", "APPROVED"]).default("NOT_STARTED"),
  summary: z.string().nullable().default(null),
  questions: z.array(z.object({
    prompt: z.string(),
    answer: z.string().nullable(),
  })).default([]),
  constraints: z.array(z.string()).default([]),
  successCriteria: z.array(z.string()).default([]),
  updatedAt: z.string().nullable().default(null),
});

export const oracleIntakeSchema = z.object({
  status: z.enum(["NOT_STARTED", "COLLECTING", "READY", "APPROVED"]).default("NOT_STARTED"),
  intendedUser: scalarIntakeAnswerSchema.nullable().default(null),
  problem: scalarIntakeAnswerSchema.nullable().default(null),
  desiredOutcome: scalarIntakeAnswerSchema.nullable().default(null),
  deadlineEvent: scalarIntakeAnswerSchema.nullable().default(null),
  mustHaveFeatures: listIntakeAnswerSchema.nullable().default(null),
  optionalFeatures: listIntakeAnswerSchema.nullable().default(null),
  budget: scalarIntakeAnswerSchema.nullable().default(null),
  privacyRequirements: listIntakeAnswerSchema.nullable().default(null),
  platforms: listIntakeAnswerSchema.nullable().default(null),
  repositoryCondition: scalarIntakeAnswerSchema.nullable().default(null),
  nonGoals: listIntakeAnswerSchema.nullable().default(null),
  unresolvedQuestions: z.array(oracleQuestionSchema).max(3).default([]),
  assumptions: z.array(z.object({
    id: z.string().min(1).max(128),
    field: oracleQuestionSchema.shape.field,
    statement: z.string().min(1).max(1_000),
    reason: z.string().min(1).max(1_000),
  })).max(30).default([]),
  knownConstraints: z.array(z.string().min(1).max(1_000)).max(30).default([]),
  unresolvedRisks: z.array(z.string().min(1).max(1_000)).max(30).default([]),
  recommendedNextAction: z.string().max(2_000).nullable().default(null),
  updatedAt: z.string().nullable().default(null),
});

export const memoryEntrySchema = z.object({
  id: z.string(),
  text: z.string(),
  source: z.enum(["user", "oracle", "architect", "maker", "witness", "system"]),
  sourceId: z.string().nullable(),
  createdAt: z.string().nullable(),
  field: oracleQuestionSchema.shape.field.nullable().optional(),
  status: z.enum(["ACTIVE", "SUPERSEDED"]).optional(),
  supersedesId: z.string().nullable().optional(),
});

export const projectMemoryV5Schema = z.object({
  facts: z.array(memoryEntrySchema.omit({ field: true, status: true, supersedesId: true })).default([]),
  decisions: z.array(memoryEntrySchema.omit({ field: true, status: true, supersedesId: true })).default([]),
  constraints: z.array(memoryEntrySchema.omit({ field: true, status: true, supersedesId: true })).default([]),
  risks: z.array(memoryEntrySchema.omit({ field: true, status: true, supersedesId: true })).default([]),
});

export const projectMemorySchema = z.object({
  facts: z.array(memoryEntrySchema).default([]),
  decisions: z.array(memoryEntrySchema).default([]),
  constraints: z.array(memoryEntrySchema).default([]),
  risks: z.array(memoryEntrySchema).default([]),
  answers: z.array(memoryEntrySchema).optional(),
  assumptions: z.array(memoryEntrySchema).optional(),
});

export const modelPreferencesV3Schema = z.object({
  access: z.object({
    requireFreeOrLocal: z.boolean().default(true),
    allowedProviders: z.array(z.string()).default([]),
    allowedModels: z.array(modelRefSchema).default([]),
    dataPolicy: z.enum(["PROVIDER_DEFAULT", "NO_TRAINING_REQUIRED"]).default("PROVIDER_DEFAULT"),
  }).default({
    requireFreeOrLocal: true,
    allowedProviders: [],
    allowedModels: [],
    dataPolicy: "PROVIDER_DEFAULT",
  }),
  budget: z.object({
    maxCostUsd: z.number().nonnegative().nullable().default(null),
    maxTotalTokens: z.number().int().positive().nullable().default(null),
    maxRunDurationMs: z.number().int().positive().nullable().default(null),
  }).default({ maxCostUsd: null, maxTotalTokens: null, maxRunDurationMs: null }),
});

export const modelAccessModeSchema = z.enum(["ALL_ACCESSIBLE", "FREE_OR_LOCAL_ONLY"]);
export type ModelAccessMode = z.infer<typeof modelAccessModeSchema>;

export const modelPreferencesSchema = z.object({
  access: z.object({
    mode: modelAccessModeSchema.default("ALL_ACCESSIBLE"),
    allowedProviders: z.array(z.string()).default([]),
    allowedModels: z.array(modelRefSchema).default([]),
    dataPolicy: z.enum(["PROVIDER_DEFAULT", "NO_TRAINING_REQUIRED"]).default("PROVIDER_DEFAULT"),
    paidOrUnknownAcceptedAt: z.string().nullable().default(null),
  }).default({
    mode: "ALL_ACCESSIBLE",
    allowedProviders: [],
    allowedModels: [],
    dataPolicy: "PROVIDER_DEFAULT",
    paidOrUnknownAcceptedAt: null,
  }),
  budget: z.object({
    maxCostUsd: z.number().positive().nullable().default(null),
    maxTotalTokens: z.number().int().positive().nullable().default(null),
    maxRunDurationMs: z.number().int().positive().nullable().default(null),
  }).default({ maxCostUsd: null, maxTotalTokens: null, maxRunDurationMs: null }),
});

const legacyProjectCoreSchema = z.object({
  id: z.string(),
  revision: z.number().int().nonnegative(),
  workspace: z.string(),
  stage: z.enum(["ORACLE", "ARCHITECT", "MAKER", "WITNESS"]),
  currentSectionId: z.string().nullable(),
  sections: z.array(legacySectionSchema),
  approvals: z.array(approvalSchema),
  actions: z.array(legacyActionSchema),
  operations: z.array(legacyOperationSchema),
  evidence: z.array(evidenceSchema),
  nextAction: z.string(),
  product: productV5Schema.default({ status: "NONE", proposal: null, openQuestions: [] }),
  makerScope: makerScopeSchema.default({ status: "NONE", statement: null }),
  transcript: z.array(transcriptEntrySchema).default([]),
  capabilities: z.array(capabilitySchema).default([]),
  witnessDrafts: z.array(legacyWitnessDraftSchema).default([]),
  nativeSessions: z.array(nativeSessionRefSchema).default([]),
});

const projectCoreV5Schema = z.object({
  id: z.string(),
  revision: z.number().int().nonnegative(),
  workspace: z.string(),
  stage: z.enum(["ORACLE", "ARCHITECT", "MAKER", "WITNESS"]),
  currentSectionId: z.string().nullable(),
  sections: z.array(sectionSchema),
  approvals: z.array(approvalSchema),
  actions: z.array(actionSchema),
  operations: z.array(operationV5Schema),
  evidence: z.array(evidenceSchema),
  nextAction: z.string(),
  product: productV5Schema.default({ status: "NONE", proposal: null, openQuestions: [] }),
  makerScope: makerScopeSchema.default({ status: "NONE", statement: null }),
  transcript: z.array(transcriptEntrySchema).default([]),
  capabilities: z.array(capabilitySchema).default([]),
  witnessDrafts: z.array(witnessDraftSchema).default([]),
  nativeSessions: z.array(nativeSessionRefSchema).default([]),
});

const projectCoreSchema = projectCoreV5Schema.extend({
  operations: z.array(operationSchema),
  product: productSchema.default({ status: "NONE", proposal: null, openQuestions: [], structuredProposal: null }),
});

/** Legacy v1 rows have no engine selection, timestamps, or mode metadata. */
export const projectV1Schema = legacyProjectCoreSchema.extend({
  schemaVersion: z.literal(1),
  operations: z.array(legacyOperationCoreSchema),
  evidence: z.array(evidenceCoreSchema),
});

/** Schema v2 existed in guided and hardened variants with complementary fields. */
export const projectV2Schema = legacyProjectCoreSchema.extend({
  schemaVersion: z.literal(2),
  mode: projectModeSchema.optional(),
  demoWorkspace: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  engine: engineSelectionSchema.optional(),
});

export const projectV3Schema = projectCoreV5Schema.extend({
  schemaVersion: z.literal(3),
  mode: projectModeSchema,
  demoWorkspace: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  engine: engineSelectionSchema,
  source: projectSourceV5Schema.default({ kind: "workspace", label: null, externalId: null, importedAt: null }),
  oracleIntake: oracleIntakeV5Schema.default({
    status: "NOT_STARTED",
    summary: null,
    questions: [],
    constraints: [],
    successCriteria: [],
    updatedAt: null,
  }),
  memory: projectMemoryV5Schema.default({ facts: [], decisions: [], constraints: [], risks: [] }),
  modelPreferences: modelPreferencesV3Schema.default({
    access: { requireFreeOrLocal: true, allowedProviders: [], allowedModels: [], dataPolicy: "PROVIDER_DEFAULT" },
    budget: { maxCostUsd: null, maxTotalTokens: null, maxRunDurationMs: null },
  }),
});

/** The v4 project record. v4 rows are migrated explicitly on read. */
export const projectV4Schema = projectCoreV5Schema.extend({
  schemaVersion: z.literal(4),
  mode: projectModeSchema,
  demoWorkspace: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  engine: engineSelectionSchema,
  source: projectSourceV5Schema.default({ kind: "workspace", label: null, externalId: null, importedAt: null }),
  oracleIntake: oracleIntakeV5Schema.default({
    status: "NOT_STARTED",
    summary: null,
    questions: [],
    constraints: [],
    successCriteria: [],
    updatedAt: null,
  }),
  memory: projectMemoryV5Schema.default({ facts: [], decisions: [], constraints: [], risks: [] }),
  modelPreferences: modelPreferencesSchema.default({
    access: {
      mode: "ALL_ACCESSIBLE",
      allowedProviders: [],
      allowedModels: [],
      dataPolicy: "PROVIDER_DEFAULT",
      paidOrUnknownAcceptedAt: null,
    },
    budget: { maxCostUsd: null, maxTotalTokens: null, maxRunDurationMs: null },
  }),
});

const v5CommonDefaults = {
  source: projectSourceV5Schema.default({ kind: "workspace", label: null, externalId: null, importedAt: null }),
  oracleIntake: oracleIntakeV5Schema.default({
    status: "NOT_STARTED",
    summary: null,
    questions: [],
    constraints: [],
    successCriteria: [],
    updatedAt: null,
  }),
  memory: projectMemoryV5Schema.default({ facts: [], decisions: [], constraints: [], risks: [] }),
  modelPreferences: modelPreferencesSchema.default({
    access: {
      mode: "ALL_ACCESSIBLE",
      allowedProviders: [],
      allowedModels: [],
      dataPolicy: "PROVIDER_DEFAULT",
      paidOrUnknownAcceptedAt: null,
    },
    budget: { maxCostUsd: null, maxTotalTokens: null, maxRunDurationMs: null },
  }),
};

export const projectV5Schema = projectCoreV5Schema.extend({
  schemaVersion: z.literal(5),
  mode: projectModeSchema,
  demoWorkspace: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  engine: engineSelectionSchema,
  ...v5CommonDefaults,
});

const emptyOracleIntake = {
  status: "NOT_STARTED" as const,
  intendedUser: null,
  problem: null,
  desiredOutcome: null,
  deadlineEvent: null,
  mustHaveFeatures: null,
  optionalFeatures: null,
  budget: null,
  privacyRequirements: null,
  platforms: null,
  repositoryCondition: null,
  nonGoals: null,
  unresolvedQuestions: [],
  assumptions: [],
  knownConstraints: [],
  unresolvedRisks: [],
  recommendedNextAction: null,
  updatedAt: null,
};

export const projectSchema = projectCoreSchema.extend({
  schemaVersion: z.literal(6),
  mode: projectModeSchema,
  demoWorkspace: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  engine: engineSelectionSchema,
  source: projectSourceSchema,
  oracleIntake: oracleIntakeSchema.default(emptyOracleIntake),
  memory: projectMemorySchema.default({ facts: [], decisions: [], constraints: [], risks: [], answers: [], assumptions: [] }),
  modelPreferences: modelPreferencesSchema.default({
    access: {
      mode: "ALL_ACCESSIBLE",
      allowedProviders: [],
      allowedModels: [],
      dataPolicy: "PROVIDER_DEFAULT",
      paidOrUnknownAcceptedAt: null,
    },
    budget: { maxCostUsd: null, maxTotalTokens: null, maxRunDurationMs: null },
  }),
});

export type Project = z.infer<typeof projectSchema>;
export type PlanSection = z.infer<typeof sectionSchema>;
export type CandidateSectionRevision = z.infer<typeof candidateSectionRevisionSchema>;
export type Operation = z.infer<typeof operationSchema>;
export type OperationV4 = z.infer<typeof operationV4Schema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Capability = z.infer<typeof capabilitySchema>;
export type SpiritRole = "oracle" | "architect" | "maker" | "witness";
