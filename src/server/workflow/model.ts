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
});

export type Project = z.infer<typeof projectSchema>;
export type PlanSection = z.infer<typeof sectionSchema>;
export type Operation = z.infer<typeof operationSchema>;

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
  return projectSchema.parse({
    schemaVersion: 1,
    id: randomUUID(),
    revision: 0,
    workspace,
    stage: "ARCHITECT",
    currentSectionId: sections[0].id,
    sections,
    approvals: [],
    actions: [],
    operations: [],
    evidence: [],
    nextAction: `Draft ${sections[0].title}`,
  });
}

export function refreshNextAction(project: Project): Project {
  const current = project.sections.find((section) => section.status !== "APPROVED") ?? null;
  project.currentSectionId = current?.id ?? null;
  project.nextAction = current
    ? `${current.status === "DRAFT" ? "Review" : "Draft"} ${current.title}`
    : "Grant a separate Maker execution scope";
  return project;
}
