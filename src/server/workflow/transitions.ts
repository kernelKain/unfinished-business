import { randomUUID } from "node:crypto";
import { contentHash, projectSchema, refreshNextAction, type Project } from "./model.ts";

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

export function compileApprovedPlan(project: Project): string {
  const unresolved = project.sections.filter((section) => section.status !== "APPROVED");
  if (unresolved.length) throw new WorkflowConflict(`Plan has ${unresolved.length} unresolved section(s).`);
  return project.sections
    .toSorted((left, right) => left.order - right.order)
    .map((section) => `## ${section.title}\n\n${section.content}`)
    .join("\n\n");
}
