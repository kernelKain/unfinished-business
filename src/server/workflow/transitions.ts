import { randomUUID } from "node:crypto";
import { sanitizeGeneratedMarkdown } from "../../shared/markdown.ts";
import { validateSectionContent } from "../../shared/section-contracts.ts";
import {
  contentHash,
  projectSchema,
  refreshNextAction,
  type Project,
  type SpiritRole,
} from "./model.ts";

export class WorkflowConflict extends Error {}
export class SectionContractError extends WorkflowConflict {}

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

/**
 * Applies accepted content to a section and invalidates its own approval plus
 * every transitive dependent approval. This is the only place a section's
 * current draft changes.
 */
function applySectionContent(project: Project, sectionId: string, content: string, version: number): Project {
  const next = clone(project);
  const section = next.sections.find((item) => item.id === sectionId);
  if (!section) throw new WorkflowConflict(`Unknown section: ${sectionId}`);

  section.content = content;
  section.hash = contentHash(content);
  section.version = version;
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
  return next;
}

/**
 * Internal/test convenience for seeding a current draft. User-facing routes
 * never call this: they generate a candidate and accept it explicitly.
 */
export function reviseSection(project: Project, sectionId: string, content: string): Project {
  const section = project.sections.find((item) => item.id === sectionId);
  if (!section) throw new WorkflowConflict(`Unknown section: ${sectionId}`);
  if (section.hash === contentHash(content) && section.version > 0) return clone(project);
  return projectSchema.parse(refreshNextAction(applySectionContent(project, sectionId, content, section.version + 1)));
}

/**
 * Records an Architect candidate without touching the current draft. A new
 * candidate supersedes any earlier pending candidate for the same section.
 */
export function recordSectionCandidate(
  project: Project,
  sectionId: string,
  input: {
    content: string;
    summary: string;
    requestedChange: string;
    sourceOperationId: string | null;
  },
): Project {
  const next = clone(project);
  const section = next.sections.find((item) => item.id === sectionId);
  if (!section) throw new WorkflowConflict(`Unknown section: ${sectionId}`);
  const content = sanitizeGeneratedMarkdown(input.content);
  const validation = validateSectionContent(sectionId, content);
  if (!validation.ok) {
    throw new SectionContractError(
      `The proposed ${section.title} section does not satisfy its content contract: ${validation.errors.join(" ")}`,
    );
  }
  const hash = contentHash(content);
  if (hash === section.hash && section.version > 0) {
    throw new WorkflowConflict("The proposed revision is identical to the current draft.");
  }
  const now = new Date().toISOString();
  for (const candidate of section.candidateRevisions) {
    if (candidate.status === "PENDING") {
      candidate.status = "SUPERSEDED";
      candidate.decidedAt = now;
    }
  }
  const version = section.version + 1;
  section.candidateRevisions.push({
    id: randomUUID(),
    version,
    content,
    hash,
    status: "PENDING",
    sourceOperationId: input.sourceOperationId,
    createdAt: now,
    baseVersion: section.version,
    baseHash: section.hash,
    summary: input.summary.slice(0, 4_000),
    requestedChange: input.requestedChange.slice(0, 8_000),
    decidedAt: null,
  });
  rememberTranscript(next, "architect", `Prepared proposed revision v${version} for ${section.title}. The current draft is unchanged.`);
  return projectSchema.parse(refreshNextAction(next));
}

/**
 * Accepts a pending candidate. This is deliberately separate from approval:
 * the section becomes a DRAFT at the candidate version and still needs an
 * exact-version approval.
 */
export function acceptSectionCandidate(project: Project, sectionId: string, candidateId: string): Project {
  const next = clone(project);
  const section = next.sections.find((item) => item.id === sectionId);
  if (!section) throw new WorkflowConflict(`Unknown section: ${sectionId}`);
  const candidate = section.candidateRevisions.find((item) => item.id === candidateId);
  if (!candidate) throw new WorkflowConflict("That proposed revision is not in this section.");
  if (candidate.status !== "PENDING") throw new WorkflowConflict("Only a pending proposed revision can be accepted.");
  if (section.version !== candidate.baseVersion || section.hash !== candidate.baseHash) {
    throw new WorkflowConflict("The section changed after this candidate was generated. Request a new revision.");
  }
  const validation = validateSectionContent(sectionId, candidate.content);
  if (!validation.ok) {
    throw new SectionContractError(
      `The proposed ${section.title} section no longer satisfies its content contract: ${validation.errors.join(" ")}`,
    );
  }
  const now = new Date().toISOString();
  const applied = applySectionContent(next, sectionId, candidate.content, candidate.version);
  const accepted = applied.sections.find((item) => item.id === sectionId);
  const acceptedCandidate = accepted?.candidateRevisions.find((item) => item.id === candidateId);
  if (!accepted || !acceptedCandidate) throw new WorkflowConflict("The proposed revision could not be applied.");
  acceptedCandidate.status = "ACCEPTED";
  acceptedCandidate.decidedAt = now;
  for (const other of accepted.candidateRevisions) {
    if (other.id !== candidateId && other.status === "PENDING") {
      other.status = "SUPERSEDED";
      other.decidedAt = now;
    }
  }
  rememberTranscript(
    applied,
    "system",
    `Accepted proposed revision v${candidate.version} for ${section.title}. The section is a draft and still needs separate approval.`,
  );
  return projectSchema.parse(refreshNextAction(applied));
}

/** Discards a pending candidate. The current draft and approvals are untouched. */
export function rejectSectionCandidate(project: Project, sectionId: string, candidateId: string): Project {
  const next = clone(project);
  const section = next.sections.find((item) => item.id === sectionId);
  if (!section) throw new WorkflowConflict(`Unknown section: ${sectionId}`);
  const candidate = section.candidateRevisions.find((item) => item.id === candidateId);
  if (!candidate) throw new WorkflowConflict("That proposed revision is not in this section.");
  if (candidate.status !== "PENDING") throw new WorkflowConflict("Only a pending proposed revision can be discarded.");
  candidate.status = "REJECTED";
  candidate.decidedAt = new Date().toISOString();
  rememberTranscript(next, "system", `Discarded proposed revision v${candidate.version} for ${section.title}. The current draft is unchanged.`);
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
  input: {
    mode: "questions" | "proposal";
    questions: Project["oracleIntake"]["unresolvedQuestions"];
    assumptions: Project["oracleIntake"]["assumptions"];
    knownConstraints: string[];
    intake: {
      intendedUser: { value: string; source: "USER" | "ASSUMPTION" | "SYSTEM" } | null;
      problem: { value: string; source: "USER" | "ASSUMPTION" | "SYSTEM" } | null;
      desiredOutcome: { value: string; source: "USER" | "ASSUMPTION" | "SYSTEM" } | null;
      deadlineEvent: { value: string; source: "USER" | "ASSUMPTION" | "SYSTEM" } | null;
      mustHaveFeatures: { value: string[]; source: "USER" | "ASSUMPTION" | "SYSTEM" } | null;
      optionalFeatures: { value: string[]; source: "USER" | "ASSUMPTION" | "SYSTEM" } | null;
      budget: { value: string; source: "USER" | "ASSUMPTION" | "SYSTEM" } | null;
      privacyRequirements: { value: string[]; source: "USER" | "ASSUMPTION" | "SYSTEM" } | null;
      platforms: { value: string[]; source: "USER" | "ASSUMPTION" | "SYSTEM" } | null;
      repositoryCondition: { value: string; source: "USER" | "ASSUMPTION" | "SYSTEM" } | null;
      nonGoals: { value: string[]; source: "USER" | "ASSUMPTION" | "SYSTEM" } | null;
    };
    proposal: NonNullable<Project["product"]["structuredProposal"]> | null;
    unresolvedRisks: string[];
    recommendedNextAction: string;
    sessionId: string;
  },
): Project {
  const next = clone(project);
  const now = new Date().toISOString();
  const scalarFields = ["intendedUser", "problem", "desiredOutcome", "deadlineEvent", "budget", "repositoryCondition"] as const;
  const listFields = ["mustHaveFeatures", "optionalFeatures", "privacyRequirements", "platforms", "nonGoals"] as const;
  for (const field of scalarFields) {
    const answer = input.intake[field];
    if (!answer) continue;
    next.oracleIntake[field] = { ...answer, updatedAt: now };
    if (answer.source !== "ASSUMPTION") rememberAnswer(next, field, answer.value, answer.source, input.sessionId, now);
  }
  for (const field of listFields) {
    const answer = input.intake[field];
    if (!answer) continue;
    next.oracleIntake[field] = { ...answer, updatedAt: now };
    if (answer.source !== "ASSUMPTION") rememberAnswer(next, field, answer.value.join("; "), answer.source, input.sessionId, now);
  }
  next.oracleIntake.status = input.mode === "proposal" ? "READY" : "COLLECTING";
  next.oracleIntake.unresolvedQuestions = input.questions;
  next.oracleIntake.assumptions = input.assumptions;
  next.oracleIntake.knownConstraints = input.knownConstraints;
  next.oracleIntake.unresolvedRisks = input.unresolvedRisks;
  next.oracleIntake.recommendedNextAction = input.recommendedNextAction;
  next.oracleIntake.updatedAt = now;

  syncAssumptionMemory(next, input.assumptions, input.sessionId, now);
  syncTextMemory(next, "constraints", input.knownConstraints, "oracle", input.sessionId, now);
  syncTextMemory(next, "risks", input.unresolvedRisks, "oracle", input.sessionId, now);

  if (input.mode === "proposal" && input.proposal) {
    next.product = {
      status: "PROPOSED",
      proposal: formatOracleProposal(input.proposal),
      structuredProposal: input.proposal,
      openQuestions: input.questions.map((question) => question.prompt),
    };
    syncTextMemory(next, "facts", input.proposal.facts, "oracle", input.sessionId, now);
    syncTextMemory(next, "decisions", input.proposal.userDecisions, "user", input.sessionId, now);
  } else {
    next.product = { status: "NONE", proposal: null, structuredProposal: null, openQuestions: input.questions.map((question) => question.prompt) };
  }
  rememberSession(next, "oracle", input.sessionId);
  rememberTranscript(next, "oracle", input.mode === "proposal"
    ? `Prepared a structured proposal: ${input.proposal?.title ?? "Untitled proposal"}. ${input.recommendedNextAction}`
    : `Asked ${input.questions.length} focused discovery question(s). ${input.recommendedNextAction}`);
  return projectSchema.parse(refreshNextAction(next));
}

function rememberAnswer(
  project: Project,
  field: NonNullable<Project["memory"]["answers"]>[number]["field"],
  text: string,
  answerSource: "USER" | "ASSUMPTION" | "SYSTEM",
  sourceId: string,
  createdAt: string,
): void {
  const bucket = answerSource === "ASSUMPTION" ? (project.memory.assumptions ??= []) : (project.memory.answers ??= []);
  const other = answerSource === "ASSUMPTION" ? (project.memory.answers ??= []) : (project.memory.assumptions ??= []);
  const entries = [...bucket, ...other];
  const source = answerSource === "USER" ? "user" : answerSource === "SYSTEM" ? "system" : "oracle";
  const active = entries.findLast((entry) => entry.field === field && entry.status !== "SUPERSEDED") ?? null;
  if (active?.text === text && active.source === source) return;
  for (const entry of entries) {
    if (entry.field === field && entry.status !== "SUPERSEDED") entry.status = "SUPERSEDED";
  }
  const prior = active ?? entries.findLast((entry) => entry.field === field) ?? null;
  bucket.push({
    id: randomUUID(),
    text,
    source,
    sourceId,
    createdAt,
    field,
    status: "ACTIVE",
    supersedesId: prior?.id ?? null,
  });
}

function syncAssumptionMemory(
  project: Project,
  assumptions: Project["oracleIntake"]["assumptions"],
  sourceId: string,
  createdAt: string,
): void {
  const activeIds = new Set(assumptions.map((assumption) => assumption.id));
  const bucket = project.memory.assumptions ??= [];
  for (const entry of bucket) {
    if (entry.sourceId?.startsWith("assumption:") && !activeIds.has(entry.sourceId.slice("assumption:".length))) {
      entry.status = "SUPERSEDED";
    }
  }
  for (const assumption of assumptions) {
    const existing = bucket.find((entry) => entry.sourceId === `assumption:${assumption.id}` && entry.status !== "SUPERSEDED");
    if (existing?.text === assumption.statement) continue;
    if (existing) existing.status = "SUPERSEDED";
    bucket.push({
      id: randomUUID(),
      text: assumption.statement,
      source: "oracle",
      sourceId: `assumption:${assumption.id}`,
      createdAt,
      field: assumption.field,
      status: "ACTIVE",
      supersedesId: existing?.id ?? null,
    });
  }
  void sourceId;
}

function syncTextMemory(
  project: Project,
  bucketName: "facts" | "decisions" | "constraints" | "risks",
  texts: string[],
  source: "user" | "oracle",
  sourceId: string,
  createdAt: string,
): void {
  const bucket = project.memory[bucketName];
  const managedSourceId = `oracle:${sourceId}`;
  const current = new Set(texts);
  for (const entry of bucket) {
    if (entry.sourceId?.startsWith("oracle:") && entry.status !== "SUPERSEDED" && !current.has(entry.text)) {
      entry.status = "SUPERSEDED";
    }
  }
  for (const text of texts) {
    if (bucket.some((entry) => entry.text === text && entry.status !== "SUPERSEDED")) continue;
    const prior = bucket.findLast((entry) => entry.text === text) ?? null;
    bucket.push({ id: randomUUID(), text, source, sourceId: managedSourceId, createdAt, field: null, status: "ACTIVE", supersedesId: prior?.id ?? null });
  }
}

function formatOracleProposal(proposal: NonNullable<Project["product"]["structuredProposal"]>): string {
  return [
    proposal.summary,
    `Intended user: ${proposal.intendedUser}`,
    `Problem: ${proposal.problem}`,
    `Desired outcome: ${proposal.desiredOutcome}`,
    `Must have: ${proposal.mustHaveFeatures.join("; ")}`,
    proposal.optionalFeatures.length ? `Optional: ${proposal.optionalFeatures.join("; ")}` : null,
    proposal.nonGoals.length ? `Non-goals: ${proposal.nonGoals.join("; ")}` : null,
  ].filter(Boolean).join("\n\n");
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
