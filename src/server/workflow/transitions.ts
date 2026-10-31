import { randomUUID } from "node:crypto";
import {
  contentHash,
  projectSchema,
  refreshNextAction,
  type Project,
  type SpiritRole,
} from "./model.ts";

export class WorkflowConflict extends Error {}

function clone(project: Project): Project {
  return structuredClone(project);
}

function dependentsOf(project: Project, sectionId: string): Set<string> {
  const affected = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const section of project.sections) {
      if (!affected.has(section.id) && section.dependencies.some((id) => id === sectionId || affected.has(id))) {
        affected.add(section.id);
        changed = true;
      }
    }
  }
  return affected;
}

export function reviseSection(project: Project, sectionId: string, content: string): Project {
  const next = clone(project);
  const section = next.sections.find((item) => item.id === sectionId);
  if (!section) throw new WorkflowConflict(`Unknown section: ${sectionId}`);
  const hash = contentHash(content);
  if (section.hash === hash && section.version > 0) return next;

  section.content = content;
  section.hash = hash;
  section.version += 1;
  section.status = "DRAFT";

  const affected = dependentsOf(next, sectionId);
  for (const dependent of next.sections) {
    if (affected.has(dependent.id) && dependent.status === "APPROVED") dependent.status = "STALE";
  }
  for (const approval of next.approvals) {
    if ((approval.sectionId === sectionId || affected.has(approval.sectionId)) && approval.staleReason === null) {
      approval.staleReason = `${section.title} changed`;
    }
  }
  return projectSchema.parse(refreshNextAction(next));
}

export function approveSection(project: Project, sectionId: string, version: number, hash: string): Project {
  const next = clone(project);
  const section = next.sections.find((item) => item.id === sectionId);
  if (!section) throw new WorkflowConflict(`Unknown section: ${sectionId}`);
  if (next.currentSectionId !== sectionId) throw new WorkflowConflict("Only the current section can be approved.");
  if (section.status !== "DRAFT" || section.version !== version || section.hash !== hash) {
    throw new WorkflowConflict("Approval does not match the current draft version and hash.");
  }
  const dependenciesReady = section.dependencies.every((dependency) =>
    next.sections.find((item) => item.id === dependency)?.status === "APPROVED",
  );
  if (!dependenciesReady) throw new WorkflowConflict("Section dependencies are not currently approved.");

  section.status = "APPROVED";
  next.approvals.push({
    id: randomUUID(),
    sectionId,
    version,
    hash,
    approvedAt: new Date().toISOString(),
    staleReason: null,
  });
  return projectSchema.parse(refreshNextAction(next));
}

export function rememberSession(project: Project, role: SpiritRole, sessionId: string): void {
  const existing = project.nativeSessions.find((item) => item.role === role);
  if (existing) existing.sessionId = sessionId;
  else project.nativeSessions.push({ role, sessionId });
}

export function rememberTranscript(project: Project, spirit: Project["transcript"][number]["spirit"], text: string): void {
  project.transcript.push({
    id: randomUUID(),
    spirit,
    text,
    createdAt: new Date().toISOString(),
  });
  if (project.transcript.length > 40) project.transcript.splice(0, project.transcript.length - 40);
}

export function recordOracleProposal(
  project: Project,
  input: { proposal: string; openQuestions: string[]; clarification: string; sessionId: string },
): Project {
  const next = clone(project);
  next.product = {
    status: "PROPOSED",
    proposal: input.proposal,
    openQuestions: input.openQuestions,
  };
  next.oracleIntake = {
    ...next.oracleIntake,
    status: "READY",
    summary: input.proposal,
    questions: input.openQuestions.map((prompt) => ({ prompt, answer: null })),
    updatedAt: new Date().toISOString(),
  };
  rememberSession(next, "oracle", input.sessionId);
  rememberTranscript(next, "oracle", `${input.clarification}\n\n${input.proposal}`);
  return projectSchema.parse(refreshNextAction(next));
}

export function approveProduct(project: Project): Project {
  const next = clone(project);
  if (next.product.status !== "PROPOSED" || !next.product.proposal) {
    throw new WorkflowConflict("Approve the current Oracle proposal before planning begins.");
  }
  next.product.status = "APPROVED";
  next.oracleIntake.status = "APPROVED";
  next.oracleIntake.updatedAt = new Date().toISOString();
  rememberTranscript(next, "user", "Approved the Oracle proposal.");
  return projectSchema.parse(refreshNextAction(next));
}

export function grantMakerScope(project: Project, statement: string): Project {
  const next = clone(project);
  const unresolved = next.sections.filter((section) => section.status !== "APPROVED");
  if (unresolved.length) throw new WorkflowConflict("Maker scope waits until every current section is approved.");
  if (next.product.status !== "APPROVED") throw new WorkflowConflict("Maker scope waits for an approved product.");
  next.makerScope = { status: "GRANTED", statement };
  rememberTranscript(next, "user", `Granted Maker scope: ${statement}`);
  return projectSchema.parse(refreshNextAction(next));
}

export function recordWitnessDrafts(
  project: Project,
  drafts: Array<{ title: string; content: string }>,
  sessionId: string,
): Project {
  const next = clone(project);
  next.witnessDrafts = drafts.map((draft) => ({
    id: randomUUID(),
    title: draft.title,
    content: draft.content,
    nativeSessionId: sessionId,
    createdAt: new Date().toISOString(),
  }));
  rememberSession(next, "witness", sessionId);
  rememberTranscript(next, "witness", drafts.map((draft) => draft.title).join(", "));
  return projectSchema.parse(refreshNextAction(next));
}


export function compileApprovedPlan(project: Project): string {
  const unresolved = project.sections.filter((section) => section.status !== "APPROVED");
  if (unresolved.length) throw new WorkflowConflict(`Plan has ${unresolved.length} unresolved section(s).`);
  return project.sections
    .toSorted((left, right) => left.order - right.order)
    .map((section) => `## ${section.title}\n\n${section.content}`)
    .join("\n\n");
}
