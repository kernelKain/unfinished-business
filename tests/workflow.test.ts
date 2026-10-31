import assert from "node:assert/strict";
import test from "node:test";
import { approveSection, compileApprovedPlan, reviseSection, WorkflowConflict } from "../src/server/workflow/transitions.ts";
import { createProject } from "../src/server/workflow/model.ts";

function approve(project: ReturnType<typeof createProject>, id: string, content = `${id} content`) {
  const drafted = reviseSection(project, id, content);
  const section = drafted.sections.find((item) => item.id === id)!;
  return approveSection(drafted, id, section.version, section.hash);
}

test("advances only after exact current-version approval", () => {
  const drafted = reviseSection(createProject("/workspace"), "control", "scope v1");
  const section = drafted.sections[0];
  assert.throws(() => approveSection(drafted, "control", section.version, "stale"), WorkflowConflict);
  const approved = approveSection(drafted, "control", section.version, section.hash);
  assert.equal(approved.currentSectionId, "architecture");
});

test("upstream revision invalidates only transitive dependents", () => {
  let project = createProject("/workspace");
  for (const section of project.sections) project = approve(project, section.id);
  project = reviseSection(project, "tools", "changed tools");
  assert.equal(project.sections.find((item) => item.id === "experience")?.status, "APPROVED");
  assert.equal(project.sections.find((item) => item.id === "verification")?.status, "STALE");
  assert.equal(project.sections.find((item) => item.id === "readiness")?.status, "STALE");
});

test("compiles exact approved blocks only", () => {
  let project = createProject("/workspace");
  assert.throws(() => compileApprovedPlan(project), WorkflowConflict);
  for (const section of project.sections) project = approve(project, section.id, `approved ${section.id}`);
  const plan = compileApprovedPlan(project);
  assert.match(plan, /approved control/);
  assert.match(plan, /approved readiness/);
});
