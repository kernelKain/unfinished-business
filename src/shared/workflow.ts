import { z } from "zod";

/**
 * Browser-safe workflow contracts.
 *
 * These schemas are shared by the server, the browser, and the deterministic
 * demo fixture. Hashing, persistence, and project creation stay in
 * `src/server/workflow/model.ts` because they use Node's crypto module.
 */

export const LEGACY_FIXED_MODEL_KEY = "opencode/deepseek-v4.1-flash-free";

export const sectionStatusSchema = z.enum(["NOT_STARTED", "DRAFT", "APPROVED", "STALE"]);
export const operationStatusSchema = z.enum([
  "QUEUED", "RUNNING", "WAITING_PERMISSION", "SUCCEEDED", "FAILED", "CANCELLED", "UNKNOWN",
]);

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

export const operationSchema = operationCoreSchema.extend({
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
});

export const nativeSessionRefSchema = z.object({
  role: z.enum(["oracle", "architect", "maker", "witness"]),
  sessionId: z.string(),
});

const projectCoreSchema = z.object({
  id: z.string(),
  revision: z.number().int().nonnegative(),
  workspace: z.string(),
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

export const projectV1Schema = projectCoreSchema.extend({
  schemaVersion: z.literal(1),
  operations: z.array(operationCoreSchema),
  evidence: z.array(evidenceCoreSchema),
});

export const projectSchema = projectCoreSchema.extend({
  schemaVersion: z.literal(2),
  engine: engineSelectionSchema.default({ model: null, source: "none", updatedAt: null, legacyModel: null }),
});

export type Project = z.infer<typeof projectSchema>;
export type PlanSection = z.infer<typeof sectionSchema>;
export type Operation = z.infer<typeof operationSchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Capability = z.infer<typeof capabilitySchema>;
export type SpiritRole = "oracle" | "architect" | "maker" | "witness";
