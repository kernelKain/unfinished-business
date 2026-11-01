import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { OpenCodeDiscovery, DiscoveredModel } from "../src/shared/opencode.ts";
import { createApp } from "../src/server/app.ts";
import type { SpiritGuide } from "../src/server/experience/guide.ts";
import { ExperienceService } from "../src/server/experience/service.ts";
import { ProjectSourceService } from "../src/server/project-sources.ts";
import { AtomicProjectStore } from "../src/server/store/atomic-project-store.ts";
import { createProject, type Project } from "../src/server/workflow/model.ts";
import { WorkflowService } from "../src/server/workflow/service.ts";
import { oracleProposalReply, oracleQuestionsReply } from "./fixtures/oracle-replies.ts";
import { compliantSectionDraft } from "./fixtures/section-drafts.ts";

const model: DiscoveredModel = {
  key: "opencode/flint-40b-free",
  providerID: "opencode",
  id: "flint-40b-free",
  name: "Flint 40B Free",
  family: "flint",
  availability: "available",
  status: "active",
  enabled: true,
  pricing: "free",
  local: false,
  limits: { context: 262_144, input: null, output: 65_536 },
  modalities: { input: ["text"], output: ["text"] },
  tools: true,
  reasoning: { supported: true, source: "variants" },
  variants: ["low", "high"],
  cost: [{ tierSize: null, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }],
};

const discovery: OpenCodeDiscovery = {
  server: { version: "2.0.32", compatible: true, testedVersion: "2.0.32", warning: null },
  providers: [{ id: "opencode", name: "OpenCode", activation: "enabled", ready: "ready", modelCount: 1, detail: "1 model." }],
  models: [model],
  agents: [{ id: "build", name: "Build", mode: "primary", hidden: false, description: null, permissionCount: 1 }],
  roles: (["oracle", "architect", "maker", "witness"] as const).map((role) => ({
    role,
    agent: role === "maker" ? "build" : "plan",
    available: true,
    detail: "mapped",
  })),
  permissions: [],
  commands: [],
  skills: [],
  mcpServers: [],
  formatters: [],
  lspServers: [],
  capabilities: [],
  usage: { supported: true, quotaSupported: false, links: [], detail: "usage" },
  limitations: [],
};

const engine = {
  async discovery() { return discovery; },
  async resolveModel() { return { model, source: "selected" as const }; },
  async chooseDefaultModel() { return null; },
  validateSelection() { return model; },
};

const headers = { "content-type": "application/json", "x-ub-session-token": "journey-token" };

async function waitFor<T>(work: () => Promise<T | null>, timeout = 8_000): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = await work();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for the journey state.");
}

function operationOf(project: Project, id: string) {
  const operation = project.operations.find((item) => item.id === id);
  assert.ok(operation, `operation ${id} exists`);
  return operation;
}

test("the complete workshop journey reaches evidence through recovery", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ub-journey-"));
  await writeFile(join(directory, "ledger.test.mjs"), [
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    "test('ledger', () => assert.equal(1, 1));",
    "",
  ].join("\n"));

  let nextSection = "control";
  let makerPerformed = false;
  let oracleTurns = 0;
  const guide: SpiritGuide = {
    async speak(input) {
      if (input.role === "oracle") {
        oracleTurns += 1;
        const text = oracleTurns === 1
          ? JSON.stringify(oracleQuestionsReply({ intendedUser: "Campus students", problem: "Found umbrellas are hard to return safely." }))
          : JSON.stringify(oracleProposalReply());
        return { sessionId: "ses_oracle", messageId: null, text, cost: 0 };
      }
      if (input.role === "architect") {
        return {
          sessionId: "ses_architect",
          messageId: null,
          text: JSON.stringify({
            content: compliantSectionDraft(nextSection, "Tighten the acceptance condition."),
            summary: `Drafted ${nextSection} for review.`,
            recommendation: "Accept after review.",
            tradeoff: "Keeps the section deliberately bounded.",
          }),
          cost: 0,
        };
      }
      return {
        sessionId: "ses_witness",
        messageId: null,
        text: JSON.stringify({
          findings: "The recorded Node check passed and the diff is bounded.",
          limitations: "No live sponsor service was called.",
          draftNotes: "Describe the observed diff and the missing live proof.",
        }),
        cost: 0,
      };
    },
    async perform(input) {
      makerPerformed = true;
      input.onSession?.("ses_maker_journey");
      input.onProgress?.("WAITING_FOR_MODEL");
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      return {
        sessionId: "ses_maker_journey",
        messageId: "msg_maker_journey",
        text: "The Maker run is still active and may finish late.",
        diff: "Native Maker run timed out before it became idle, without a file diff.",
        cost: 0,
        outcome: "running",
        timedOut: true,
      };
    },
    async inspect() { return "succeeded"; },
    async sessionDiff() { return [{ status: "modified", file: "ledger.test.mjs", additions: 1, deletions: 0 }]; },
    async lastAssistantText() { return null; },
  };

  const store = new AtomicProjectStore(join(directory, "project.json"));
  const initial = createProject(directory);
  initial.engine = { model: { providerID: model.providerID, id: model.id, variant: null }, source: "user", updatedAt: null, legacyModel: null };
  await store.initialize(initial);
  const workflow = new WorkflowService(store);
  const sources = new ProjectSourceService(workflow, {
    managedImportRoot: join(directory, "managed-imports"),
  });
  const experience = new ExperienceService(workflow, store, guide, {
    safeDirectory: directory,
    demoWorkspace: directory,
    promptRoot: process.cwd(),
    engine,
  });
  const app = createApp({ service: workflow, sources, experience, sessionToken: "journey-token" });

  const post = (path: string, body: unknown) => app.request(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const settle = (operationId: string) => waitFor(async () => experience.isRunActive(operationId) ? null : true);

  // 1. Source selection.
  const source = await post("/api/project/source", {
    actionId: "journey-source",
    expectedRevision: 0,
    kind: "NEW_PROJECT",
    label: "Journey project",
  });
  assert.equal(source.status, 200);
  let project = (await source.json()).project as Project;
  assert.equal(project.source.kind, "NEW_PROJECT");
  assert.equal(project.source.status, "CONFIRMED");

  // 2. Oracle questions, then a proposal.
  const asked = await post("/api/messages", {
    actionId: "journey-oracle-questions",
    expectedRevision: project.revision,
    intent: "clarify",
    text: "Students lose umbrellas and the current return process is unsafe.",
  });
  assert.equal(asked.status, 202);
  const askedBody = await asked.json() as { operation?: { id: string } };
  const askedId = askedBody.operation?.id;
  assert.ok(askedId);
  project = await waitFor(async () => {
    const current = (await store.load()).state;
    const operation = current.operations.find((item) => item.id === askedId);
    return operation?.status === "SUCCEEDED" ? current : null;
  });
  assert.ok(project.oracleIntake.intendedUser?.value);
  assert.ok(project.oracleIntake.unresolvedQuestions.length >= 1);
  await settle(askedId);

  project = (await store.load()).state;
  const proposed = await post("/api/messages", {
    actionId: "journey-oracle-proposal",
    expectedRevision: project.revision,
    intent: "clarify",
    text: "Campus students; found items should be returnable safely.",
  });
  const proposedBody = await proposed.json();
  assert.equal(proposed.status, 202, JSON.stringify(proposedBody));
  const proposedId = (proposedBody as { operation?: { id: string } }).operation?.id;
  assert.ok(proposedId);
  project = await waitFor(async () => {
    const current = (await store.load()).state;
    return current.product.structuredProposal ? current : null;
  });
  await settle(proposedId);
  project = (await store.load()).state;
  assert.notEqual(project.product.status, "APPROVED", "a proposal is not an approval");

  // 3. Product approval.
  const approval = await post("/api/approvals", {
    actionId: "journey-product-approval",
    expectedRevision: project.revision,
    kind: "product",
  });
  assert.equal(approval.status, 200);
  project = (await approval.json()).project as Project;
  assert.equal(project.product.status, "APPROVED");

  // 4. Draft, preview/supersede a revision, accept, and approve every section.
  for (const section of [...project.sections]) {
    nextSection = section.id;
    const firstDraft = await post("/api/messages", {
      actionId: `journey-draft-${section.id}`,
      expectedRevision: project.revision,
      intent: "draft",
      text: `Draft ${section.title} for the campus lost-and-found.`,
      sectionId: section.id,
    });
    const firstDraftBody = await firstDraft.json();
    assert.equal(firstDraft.status, 202, JSON.stringify(firstDraftBody));
    const firstDraftId = (firstDraftBody as { operation?: { id: string } }).operation?.id;
    assert.ok(firstDraftId);
    project = await waitFor(async () => {
      const current = (await store.load()).state;
      const target = current.sections.find((item) => item.id === section.id);
      return target?.candidateRevisions.some((candidate) => candidate.status === "PENDING") ? current : null;
    });
    await settle(firstDraftId);
    project = (await store.load()).state;

    if (section.id === "control") {
      const review = project.sections.find((item) => item.id === section.id)!.candidateRevisions.find((candidate) => candidate.status === "PENDING")!;
      assert.match(review.content, /Control/);
      assert.match(review.summary, /Drafted control/);
      assert.notEqual(review.content, "");

      const secondDraft = await post("/api/messages", {
        actionId: "journey-draft-control-again",
        expectedRevision: project.revision,
        intent: "draft",
        text: "Tighten the control section acceptance condition.",
        sectionId: section.id,
      });
      const secondDraftBody = await secondDraft.json();
      assert.equal(secondDraft.status, 202, JSON.stringify(secondDraftBody));
      const secondDraftId = (secondDraftBody as { operation?: { id: string } }).operation?.id;
      assert.ok(secondDraftId);
      project = await waitFor(async () => {
        const current = (await store.load()).state;
        const target = current.sections.find((item) => item.id === section.id);
        return target?.candidateRevisions.filter((candidate) => candidate.status === "PENDING").length === 1
          && target.candidateRevisions.some((candidate) => candidate.status === "SUPERSEDED")
          ? current
          : null;
      });
      await settle(secondDraftId);
      project = (await store.load()).state;
    }

    const pending = project.sections.find((item) => item.id === section.id)!.candidateRevisions.find((candidate) => candidate.status === "PENDING")!;
    const accepted = await post(`/api/sections/${section.id}/revisions/${pending.id}/accept`, {
      actionId: `journey-accept-${section.id}`,
      expectedRevision: project.revision,
    });
    assert.equal(accepted.status, 200);
    project = (await accepted.json()).project as Project;
    const draft = project.sections.find((item) => item.id === section.id)!;
    assert.equal(draft.status, "DRAFT");
    assert.equal(draft.version, pending.version);

    const sectionApproval = await post(`/api/sections/${section.id}/approve`, {
      actionId: `journey-approve-${section.id}`,
      expectedRevision: project.revision,
      version: draft.version,
      hash: draft.hash,
    });
    assert.equal(sectionApproval.status, 200, JSON.stringify(await sectionApproval.clone().json()));
    project = (await sectionApproval.json()).project as Project;
    assert.equal(project.sections.find((item) => item.id === section.id)!.status, "APPROVED");
  }

  // 5. Maker scope and a run that is observed live, times out, and recovers.
  const scope = await post("/api/approvals", {
    actionId: "journey-maker-scope",
    expectedRevision: project.revision,
    kind: "maker-scope",
    statement: "Edit the isolated ledger test in the demo workspace.",
  });
  assert.equal(scope.status, 200);
  project = (await scope.json()).project as Project;

  const run = await post("/api/runs", {
    actionId: "journey-maker-run",
    expectedRevision: project.revision,
  });
  assert.equal(run.status, 202);
  const runBody = await run.json() as { operation?: { id: string } };
  const operationId = runBody.operation?.id;
  assert.ok(operationId);
  const live = await waitFor(async () => {
    const current = (await store.load()).state;
    const operation = current.operations.find((item) => item.id === operationId);
    return operation?.status === "RUNNING" && operation.progress?.phase === "WAITING_FOR_MODEL" ? operation : null;
  });
  assert.equal(live.progress?.phase, "WAITING_FOR_MODEL");

  await waitFor(async () => {
    const current = (await store.load()).state;
    return operationOf(current, operationId).status === "ABANDONED" ? current : null;
  });
  await settle(operationId);
  project = (await store.load()).state;
  const abandonedOperation = operationOf(project, operationId);
  assert.equal(abandonedOperation.status, "ABANDONED");
  assert.match(project.nextAction, /reconcile/i);

  const reconciled = await post(`/api/runs/${operationId}/reconcile`, {
    actionId: "journey-maker-reconcile",
    expectedRevision: project.revision,
  });
  assert.equal(reconciled.status, 200);
  project = (await reconciled.json()).project as Project;
  const recovered = operationOf(project, operationId);
  assert.equal(recovered.status, "SUCCEEDED");
  assert.match(recovered.result ?? "", /Reconciled/);
  assert.ok(project.evidence.some((item) => item.result === "PASS"));
  assert.equal(project.stage, "WITNESS");
  assert.equal(makerPerformed, true);

  // 6. Witness evidence and export.
  project = (await store.load()).state;
  const witness = await post("/api/messages", {
    actionId: "journey-witness",
    expectedRevision: project.revision,
    intent: "witness",
    text: "Review the recovered Maker diff and evidence.",
  });
  const witnessBody = await witness.json();
  assert.equal(witness.status, 202, JSON.stringify(witnessBody));
  const witnessId = (witnessBody as { operation?: { id: string } }).operation?.id;
  assert.ok(witnessId);
  project = await waitFor(async () => {
    const current = (await store.load()).state;
    return current.witnessDrafts.length === 3 ? current : null;
  });
  await settle(witnessId);
  assert.equal(project.witnessDrafts[0].title, "Findings");
  assert.match(project.witnessDrafts[1].content, /No live sponsor service/);

  const exported = await (await app.request("/api/export", { headers })).json();
  assert.match(exported.plan, /Control/);
  assert.equal(exported.drafts.length, 3);
  assert.match(exported.limitation, /not a submitted article/);
  assert.equal(exported.engine.model.id, "flint-40b-free");
});
