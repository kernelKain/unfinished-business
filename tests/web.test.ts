import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPage } from "../src/web/landing/LandingPage.tsx";
import { DemoPage } from "../src/web/demo/DemoPage.tsx";
import { SpiritCharacter, type SpiritState } from "../src/web/components/SpiritCharacter.tsx";
import { ProviderErrorCard } from "../src/web/components/ProviderErrorCard.tsx";
import { ProjectMemory } from "../src/web/components/ProjectMemory.tsx";
import { RunInspector } from "../src/web/components/RunInspector.tsx";
import { OpenCodePanel } from "../src/web/opencode-panel.tsx";
import { connectionStatusSchema } from "../src/shared/opencode.ts";
import { createProject } from "../src/server/workflow/model.ts";
import { providerErrorSchema } from "../src/shared/workflow.ts";
import { demoFixture, demoPreviewSteps } from "../src/shared/demo.ts";
import {
  faqs,
  sampleStory,
  usageModes,
} from "../src/web/content/landing.ts";
import { resolveRoute } from "../src/web/routes.ts";
import { setupTabs } from "../src/web/setup.ts";
import { spiritProfiles } from "../src/web/spirits.ts";

function text(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

test("routes keep the landing, real workshop, and guided sample separate", () => {
  assert.deepEqual(
    [resolveRoute("/").name, resolveRoute("/workshop").name, resolveRoute("/demo").name],
    ["landing", "workshop", "demo"],
  );
  assert.equal(resolveRoute("/workshop/").name, "workshop");
  assert.equal(resolveRoute("/unexpected").name, "landing");
  assert.equal(resolveRoute("/workshop").path, "/workshop");
  assert.match(resolveRoute("/").title, /Unfinished Business/);
  assert.match(resolveRoute("/demo").title, /Guided sample/);
});

test("landing hero presents one primary action and four user outcomes", () => {
  const html = renderToStaticMarkup(createElement(LandingPage));
  const copy = text(html);

  assert.match(copy, /Finish the project you already started\./);
  assert.match(copy, /A workshop for unfinished hackathon projects/i);
  assert.match(copy, /Try the example/);
  assert.match(copy, /Run locally/);
  assert.match(copy, /Set up locally/);
  assert.doesNotMatch(copy, /Watch the guided workflow/);
  assert.match(copy, /The example is recorded and labeled/);
  for (const outcome of ["Clarify the idea", "Approve the plan", "Build with OpenCode", "Verify the result"]) {
    assert.ok(copy.includes(outcome), `missing hero outcome ${outcome}`);
  }
  assert.match(html, /href="\/demo"/);
  assert.match(html, /href="\/workshop"/);
  assert.match(html, /href="#local-setup"/);
  assert.match(html, /width="1920"/);
  assert.match(html, /height="823"/);
});

test("usage modes are described truthfully and never claim local repository access", () => {
  const html = renderToStaticMarkup(createElement(LandingPage));
  const copy = text(html);

  for (const mode of usageModes) assert.ok(copy.includes(mode.title), `missing mode ${mode.id}`);
  assert.match(copy, /public sample never uses a visitor's repository and rejects every change/);
  assert.match(copy, /private instance is password-protected/);
  assert.match(copy, /Neither path claims remote access to your machine/);
  assert.match(copy, /Your machine, your OpenCode server, your session/);
  assert.doesNotMatch(copy, /Hosted demo or private hosted|Full local mode/);
  assert.doesNotMatch(copy, /trusted by|10,000|award-winning|used by \d/i);
  assert.doesNotMatch(copy, /remote access to your local repository/i);
});

test("the non-interactive tool recommendation block stays out of the product story", () => {
  const html = renderToStaticMarkup(createElement(LandingPage));
  const copy = text(html);
  assert.doesNotMatch(copy, /Idea to tool recommendation|Recommended path|Habit streak tracker/i);
  assert.doesNotMatch(html, /recommendation-table/);
});

test("the four spirits each expose distinct roles and states", () => {
  assert.deepEqual(spiritProfiles.map((spirit) => spirit.name), ["Oracle", "Architect", "Maker", "Witness"]);
  assert.equal(new Set(spiritProfiles.map((spirit) => spirit.role)).size, 4);
  for (const spirit of spiritProfiles) {
    assert.ok(spirit.states.length >= 3, `${spirit.name} needs visible states`);
    assert.ok(spirit.states.some((state) => state.id !== "idle"), `${spirit.name} needs a working state`);
  }

  const states: Array<[string, SpiritState]> = [
    ["oracle", "listening"],
    ["architect", "drawing"],
    ["maker", "blocked"],
    ["witness", "warning"],
  ];
  for (const [id, state] of states) {
    const html = renderToStaticMarkup(createElement(SpiritCharacter, {
      id: id as "oracle" | "architect" | "maker" | "witness",
      state,
      label: `${id} ${state}`,
    }));
    assert.match(html, new RegExp(`data-spirit="${id}"`));
    assert.match(html, new RegExp(`data-state="${state}"`));
    assert.match(html, /role="img"/);
    assert.match(html, /<title>/);
  }
});

test("setup tabs expose the tested local commands", () => {
  const commands = setupTabs.map((tab) => tab.command).join("\n");
  assert.match(commands, /npm ci/);
  assert.match(commands, /npm run dev\n/);
  assert.match(commands, /npm run dev:web/);
  assert.match(commands, /\.\/node_modules\/@opencode\/cli-linux-x64-baseline\/bin\/opencode serve/);
  assert.match(commands, /npm run build && npm start/);

  const html = renderToStaticMarkup(createElement(LandingPage));
  for (const tab of setupTabs) assert.ok(text(html).includes(tab.label));
  assert.match(text(html), /Commands are checked against docs\/LOCAL_SETUP\.md/);
});

test("demo and evidence previews use the canonical sample and keep the missing live proof visible", () => {
  const demo = renderToStaticMarkup(createElement(DemoPage));
  const copy = text(demo);
  assert.match(copy, new RegExp(demoFixture.scenario.name));
  assert.match(copy, /This is a recorded sample/);
  assert.match(copy, /No OpenCode session, provider call, repository read, or model quota is used/);
  assert.match(copy, /Every run, diff, check, and finding is recorded sample data/);
  assert.match(copy, /The live session remains NOT_RUN/);
  assert.match(copy, /Representative diff and recorded check/);
  assert.match(copy, /Reset changes only this sample/);
  assert.match(copy, /The same evidence view, with recorded data/);
  for (const spirit of ["oracle", "architect", "maker", "witness"] as const) {
    for (const state of new Set(demoFixture.beats.filter((beat) => beat.spirit === spirit).map((beat) => beat.state))) {
      assert.match(demo, new RegExp(`data-testid="spirit-state-${spirit}-${state}"`));
    }
  }
  assert.match(demo, /data-testid="demo-recovery"/);

  const inspector = renderToStaticMarkup(createElement(RunInspector, {
    operations: demoFixture.project.operations,
    evidence: demoFixture.project.evidence,
    capabilities: demoFixture.project.capabilities,
  }));
  assert.match(text(inspector), /Pass/);
  assert.doesNotMatch(text(inspector), /Do not claim a working build/);
  assert.match(text(inspector), /Workflow approval is not tool permission/);
});

test("landing preview and guided demo share one canonical sample outcome", () => {
  const landing = text(renderToStaticMarkup(createElement(LandingPage)));
  const demo = text(renderToStaticMarkup(createElement(DemoPage)));

  assert.equal(demoPreviewSteps.length, 4);
  assert.deepEqual(demoPreviewSteps.map((step) => step.stage), ["ORACLE", "ARCHITECT", "MAKER", "WITNESS"]);
  assert.equal(sampleStory.name, demoFixture.scenario.name);
  assert.equal(sampleStory.check, demoFixture.verification.summary);
  assert.equal(sampleStory.liveProof, "NOT_RUN");

  for (const surface of [landing, demo]) {
    assert.ok(surface.includes(demoFixture.scenario.name), "sample name must match on both pages");
    assert.ok(surface.includes(demoFixture.verification.summary), "recorded check must match on both pages");
  }
  assert.ok(demoPreviewSteps[3].lines.some((line) => line.includes(demoFixture.verification.summary)));
  assert.ok(demoPreviewSteps[3].lines.some((line) => line.includes("NOT_RUN")));
  assert.doesNotMatch(landing, /Do not claim a working build|Idea to tool recommendation|Campus Umbrella Relay/);
  assert.doesNotMatch(demo, /Campus Umbrella Relay/);
});

test("empty Run Inspector states do not imply success", () => {
  const inspector = renderToStaticMarkup(createElement(RunInspector, {
    operations: [],
    evidence: [],
    capabilities: [],
  }));
  const copy = text(inspector);
  assert.match(copy, /No native run yet/);
  assert.match(copy, /No check observed/);
  assert.match(copy, /Empty is the honest state/);
  assert.doesNotMatch(copy, /PASS/);
});

test("activity and results are organized into progress, changes, checks, and technical details", () => {
  const inspector = renderToStaticMarkup(createElement(RunInspector, {
    operations: demoFixture.project.operations,
    evidence: demoFixture.project.evidence,
    capabilities: demoFixture.project.capabilities,
  }));
  const copy = text(inspector);
  assert.match(copy, /Activity & results/);
  assert.match(copy, /Progress/);
  assert.match(copy, /Changes/);
  assert.match(copy, /Checks/);
  assert.match(copy, /Technical details/);
  assert.match(copy, /Native references/);
  assert.match(copy, /Capability mappings/);
  assert.match(copy, /Raw evidence/);
  assert.match(copy, /Provider payloads/);
});

test("project memory presents decisions, answers, assumptions, constraints, and editable memory", () => {
  const project = createProject("/workspace", "local", { now: "2026-11-01T00:00:00.000Z" });
  project.memory.decisions.push({
    id: "memory-decision",
    text: "Keep the bounded Node check.",
    source: "user",
    sourceId: null,
    createdAt: "2026-11-01T00:00:00.000Z",
    status: "ACTIVE",
  });
  project.memory.answers ??= [];
  project.memory.answers.push({
    id: "memory-answer",
    text: "Students on campus.",
    source: "user",
    sourceId: null,
    createdAt: "2026-11-01T00:00:00.000Z",
    field: "intendedUser",
    status: "ACTIVE",
  });
  project.oracleIntake.unresolvedQuestions.push({
    id: "memory-question",
    field: "budget",
    prompt: "Is there a spending limit?",
    whyItMatters: "It changes the provider and deployment choice.",
    suggestedChoices: [],
  });
  const html = renderToStaticMarkup(createElement(ProjectMemory, {
    project: project as Parameters<typeof ProjectMemory>[0]["project"],
    busy: false,
    onSave: async () => true,
  }));
  const copy = text(html);
  assert.match(copy, /Decisions/);
  assert.match(copy, /User answers/);
  assert.match(copy, /Assumptions/);
  assert.match(copy, /Constraints/);
  assert.match(copy, /Unresolved questions/);
  assert.match(copy, /Correct/);
  assert.match(copy, /Save memory/);
  assert.match(copy, /never changes an approval or section draft/);
});

test("OpenCode controls keep permissions visible and advanced diagnostics collapsed", () => {
  const project = createProject("/workspace", "local", { now: "2026-11-01T00:00:00.000Z" });
  const connection = connectionStatusSchema.parse({
    state: "connected",
    baseUrl: "http://127.0.0.1:4096",
    deploymentMode: "local",
    managed: false,
    auth: { mode: "none", username: "", hasPassword: false },
    serverVersion: "2.0.32",
    compatible: true,
    checkedAt: "2026-11-01T00:00:00.000Z",
    diagnostics: [],
    discovery: null,
  });
  const html = renderToStaticMarkup(createElement(OpenCodePanel, {
    connection,
    project: project as Parameters<typeof OpenCodePanel>[0]["project"],
    permissions: [{
      id: "permission-one",
      sessionID: "ses_one",
      action: "edit",
      resources: ["src/example.ts"],
      message: null,
    }],
    onConnection: () => undefined,
    onProject: () => undefined,
    onOpenSetup: () => undefined,
    onPermissionsChanged: async () => undefined,
  }));
  const copy = text(html);
  assert.match(copy, /Model & connection/);
  assert.match(copy, /OpenCode is waiting for permission/);
  assert.match(copy, /Allow once/);
  assert.match(copy, /Advanced diagnostics/);
  assert.match(html, /<details class="advanced" id="opencode-advanced">/);
  assert.doesNotMatch(html, /<details class="advanced" id="opencode-advanced" open/);
});

test("provider error cards expose safe repair and technical details", () => {
  const error = providerErrorSchema.parse({
    category: "PROVIDER_DATA_POLICY",
    whatHappened: "The provider route conflicts with the workspace privacy preference.",
    savedWorkChanged: "no",
    savedWorkMessage: "The saved workshop content was not changed by this failed request.",
    repair: "Choose a compliant provider route or deliberately review the workspace privacy preference.",
    action: "review-privacy",
    retryable: false,
    technical: {
      provider: "acme",
      statusCode: 403,
      providerCode: "PROVIDER_POLICY_REJECTED",
      sessionReference: "ses_safe_reference",
      diagnosticReference: "provider-fixture-reference",
      safeDetail: "Training on request data was rejected.",
    },
  });
  const html = renderToStaticMarkup(createElement(ProviderErrorCard, {
    error,
    onChangeModel: () => {},
    onDismiss: () => {},
  }));
  const copy = text(html);
  assert.match(copy, /Provider request needs attention/);
  assert.match(copy, /What happened/);
  assert.match(copy, /Saved work/);
  assert.match(copy, /Recommended repair/);
  assert.match(copy, /Review provider or model/);
  assert.match(html, /role="alert"/);
  assert.match(html, /data-category="PROVIDER_DATA_POLICY"/);
  assert.match(html, /Technical details/);
  assert.match(copy, /provider-fixture-reference/);
  assert.match(copy, /ses_safe_reference/);
  assert.match(copy, /Training on request data was rejected/);
  assert.doesNotMatch(html, /sk-[A-Za-z0-9_-]{16,}/);
});

test("FAQ answers cover the open-source engine and the sample's limits", () => {
  assert.ok(faqs.some((item) => /second coding harness/i.test(item.question)));
  assert.ok(faqs.some((item) => /hosted page read my local repository/i.test(item.question)));
  assert.ok(faqs.some((item) => /recorded fixture/i.test(item.answer)));
  assert.ok(faqs.some((item) => /What is the Driftwatch sample/i.test(item.question)));
});
