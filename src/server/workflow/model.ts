import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

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
});

export const operationSchema = z.object({
  id: z.string(),
  kind: z.enum(["guide", "maker", "witness", "check"]).default("guide"),
  payloadHash: z.string(),
  nativeSessionId: z.string().nullable(),
  nativeMessageId: z.string().nullable(),
  status: operationStatusSchema,
  result: z.string().nullable(),
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
});

export const nativeSessionRefSchema = z.object({
  role: z.enum(["oracle", "architect", "maker", "witness"]),
  sessionId: z.string(),
});

export const projectSchema = z.object({
  schemaVersion: z.literal(1),
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

export type Project = z.infer<typeof projectSchema>;
export type PlanSection = z.infer<typeof sectionSchema>;
export type Operation = z.infer<typeof operationSchema>;
export type Capability = z.infer<typeof capabilitySchema>;
export type SpiritRole = "oracle" | "architect" | "maker" | "witness";

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

export function payloadHash(payload: unknown): string {
  return contentHash(JSON.stringify(payload, Object.keys(payload as object).sort()));
}

export function createProject(workspace: string): Project {
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
  return refreshNextAction(projectSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    revision: 0,
    workspace,
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

export function refreshNextAction(project: Project): Project {
  const current = project.sections.find((section) => section.status !== "APPROVED") ?? null;
  project.currentSectionId = current?.id ?? null;
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
