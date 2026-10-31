import assert from "node:assert/strict";
import test from "node:test";
import { SECTION_CONTRACTS, validateSectionContent } from "../src/shared/section-contracts.ts";
import { buildSideBySideRows, buildUnifiedHunks, computeLineDiff, summarizeDiff } from "../src/shared/diff.ts";
import { contentHash, createProject } from "../src/server/workflow/model.ts";
import {
  acceptSectionCandidate,
  approveSection,
  recordSectionCandidate,
  rejectSectionCandidate,
  reviseSection,
  SectionContractError,
  WorkflowConflict,
} from "../src/server/workflow/transitions.ts";
import { compliantSectionDraft } from "./fixtures/section-drafts.ts";

function candidate(project: ReturnType<typeof createProject>, sectionId: string, change = "Draft the section.") {
  return recordSectionCandidate(project, sectionId, {
    content: compliantSectionDraft(sectionId, change),
    summary: `Prepared ${sectionId} with the required contract coverage.`,
    requestedChange: change,
    sourceOperationId: "op-architect-1",
  });
}

function approveAll(project: ReturnType<typeof createProject>) {
  let next = project;
  for (const section of [...next.sections]) {
    next = reviseSection(next, section.id, compliantSectionDraft(section.id));
    const current = next.sections.find((item) => item.id === section.id)!;
    next = approveSection(next, section.id, current.version, current.hash);
  }
  return next;
}

test("every Architect section has a contract and a compliant draft passes", () => {
  for (const sectionId of Object.keys(SECTION_CONTRACTS)) {
    const validation = validateSectionContent(sectionId, compliantSectionDraft(sectionId));
    assert.equal(validation.ok, true, `${sectionId}: ${validation.errors.join(" ")}`);
    assert.equal(validation.missingTopics.length, 0);
    assert.ok(validation.satisfiedTopics.length >= 5);
  }
});

test("quality is not accepted on word count alone", () => {
  const padded = "word ".repeat(2_000);
  const validation = validateSectionContent("architecture", padded);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => /Missing required topic/.test(error)));
  assert.ok(validation.errors.some((error) => /headings/.test(error)));
});

test("candidate creation leaves an approved section and its content untouched", () => {
  let project = createProject("/workspace");
  project = reviseSection(project, "control", compliantSectionDraft("control"));
  const control = project.sections[0];
  project = approveSection(project, "control", control.version, control.hash);
  const before = project.sections[0];

  project = candidate(project, "control", "Add a clearer non-goal.");
  const after = project.sections[0];
  assert.equal(after.status, "APPROVED");
  assert.equal(after.content, before.content);
  assert.equal(after.version, before.version);
  assert.equal(after.hash, before.hash);
  assert.equal(after.candidateRevisions.length, 1);
  assert.equal(after.candidateRevisions[0].status, "PENDING");
  assert.equal(after.candidateRevisions[0].baseVersion, before.version);
  assert.equal(after.candidateRevisions[0].baseHash, before.hash);
  assert.equal(after.candidateRevisions[0].requestedChange, "Add a clearer non-goal.");
  assert.match(after.candidateRevisions[0].summary, /contract coverage/);
});

test("a new candidate supersedes the previous pending candidate without touching the draft", () => {
  let project = candidate(createProject("/workspace"), "control", "First request.");
  const first = project.sections[0].candidateRevisions[0];
  project = candidate(project, "control", "Second request.");
  const candidates = project.sections[0].candidateRevisions;
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].status, "SUPERSEDED");
  assert.equal(candidates[1].status, "PENDING");
  assert.ok(candidates[0].decidedAt);
  assert.equal(project.sections[0].content, "");
  assert.equal(first.id, candidates[0].id);
});

test("acceptance replaces the draft but never approves it", () => {
  let project = candidate(createProject("/workspace"), "control");
  const pending = project.sections[0].candidateRevisions[0];
  project = acceptSectionCandidate(project, "control", pending.id);
  const section = project.sections[0];
  assert.equal(section.status, "DRAFT");
  assert.equal(section.version, 1);
  assert.equal(section.content, pending.content);
  assert.equal(section.hash, contentHash(pending.content));
  assert.equal(section.candidateRevisions[0].status, "ACCEPTED");
  assert.ok(section.candidateRevisions[0].decidedAt);
  assert.equal(project.approvals.length, 0, "acceptance is not approval");

  project = approveSection(project, "control", section.version, section.hash);
  assert.equal(project.sections[0].status, "APPROVED");
  assert.equal(project.approvals.length, 1);
});

test("rejection discards the candidate and leaves the current draft unchanged", () => {
  let project = reviseSection(createProject("/workspace"), "control", compliantSectionDraft("control"));
  const before = project.sections[0];
  project = candidate(project, "control", "Try a different structure.");
  const pending = project.sections[0].candidateRevisions[0];
  project = rejectSectionCandidate(project, "control", pending.id);
  const after = project.sections[0];
  assert.equal(after.content, before.content);
  assert.equal(after.version, before.version);
  assert.equal(after.candidateRevisions[0].status, "REJECTED");
  assert.ok(after.candidateRevisions[0].decidedAt);
});

test("accepting an upstream candidate marks only transitive approvals stale", () => {
  let project = approveAll(createProject("/workspace"));
  const architectureBefore = project.sections.find((section) => section.id === "architecture")!;
  project = candidate(project, "architecture", "Tighten the recovery contract.");
  const pending = project.sections.find((section) => section.id === "architecture")!.candidateRevisions[0];
  project = acceptSectionCandidate(project, "architecture", pending.id);

  const architecture = project.sections.find((section) => section.id === "architecture")!;
  assert.equal(architecture.status, "DRAFT");
  assert.equal(architecture.version, architectureBefore.version + 1);
  const expectedStale = new Set(["experience", "tools", "verification", "phases", "delivery", "readiness"]);
  for (const section of project.sections) {
    if (section.id === "architecture") {
      assert.equal(section.status, "DRAFT", "the accepted section becomes a draft");
    } else if (expectedStale.has(section.id)) {
      assert.equal(section.status, "STALE", `${section.id} should be stale`);
    } else {
      assert.equal(section.status, "APPROVED", `${section.id} should stay approved`);
    }
  }
  const staleApprovals = project.approvals.filter((approval) => approval.sectionId === "architecture" || expectedStale.has(approval.sectionId));
  assert.ok(staleApprovals.length >= expectedStale.size + 1);
  for (const approval of staleApprovals) assert.match(approval.staleReason ?? "", /Architecture and contracts changed/);
  const controlApproval = project.approvals.find((approval) => approval.sectionId === "control");
  assert.equal(controlApproval?.staleReason, null);
});

test("a candidate based on an older draft cannot be accepted", () => {
  let project = candidate(createProject("/workspace"), "control");
  const pending = project.sections[0].candidateRevisions[0];
  project = reviseSection(project, "control", compliantSectionDraft("control", "A different accepted draft."));
  assert.throws(
    () => acceptSectionCandidate(project, "control", pending.id),
    (error: unknown) => error instanceof WorkflowConflict && /changed after this candidate/.test(error.message),
  );
});

test("candidate content is sanitized before it is stored", () => {
  const content = `${compliantSectionDraft("control")}\n\n<script>alert('owned')</script>\n\n[unsafe](javascript:alert(1))`;
  const project = recordSectionCandidate(createProject("/workspace"), "control", {
    content,
    summary: "Includes a script attempt.",
    requestedChange: "Try unsafe content.",
    sourceOperationId: null,
  });
  const stored = project.sections[0].candidateRevisions[0].content;
  assert.doesNotMatch(stored, /<script/i);
  assert.doesNotMatch(stored, /javascript:/i);
  assert.match(stored, /\[removed script\]/);
  assert.match(stored, /unsafe/);
});

test("a candidate that fails its contract is never stored", () => {
  assert.throws(
    () => recordSectionCandidate(createProject("/workspace"), "control", {
      content: "Just a short sentence.",
      summary: "Too short.",
      requestedChange: "Try.",
      sourceOperationId: null,
    }),
    (error: unknown) => error instanceof SectionContractError && /content contract/.test(error.message),
  );
});

test("unified and side-by-side diffs describe the same change", () => {
  const before = "# One\n\nalpha\nbeta\ngamma";
  const after = "# One\n\nalpha\nBETA\ngamma\ndelta";
  const lines = computeLineDiff(before, after);
  const stats = summarizeDiff(lines);
  assert.equal(stats.added, 2);
  assert.equal(stats.removed, 1);
  const hunks = buildUnifiedHunks(lines);
  assert.ok(hunks.length >= 1);
  assert.match(hunks[0].lines.map((line) => line.text).join("\n"), /BETA/);
  const rows = buildSideBySideRows(hunks);
  const changed = rows.filter((row) => row.type === "change");
  assert.equal(changed.length, 2);
  assert.equal(changed[0].oldText, "beta");
  assert.equal(changed[0].newText, "BETA");
  assert.equal(changed[1].oldText, null);
  assert.equal(changed[1].newText, "delta");
});
