import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPage } from "../src/web/landing/LandingPage.tsx";
import { DemoPage } from "../src/web/demo/DemoPage.tsx";
import { SpiritCharacter, type SpiritState } from "../src/web/components/SpiritCharacter.tsx";
import { ProviderErrorCard } from "../src/web/components/ProviderErrorCard.tsx";
import { RunInspector } from "../src/web/components/RunInspector.tsx";
import { providerErrorSchema } from "../src/shared/workflow.ts";
import { demoFixture } from "../src/shared/demo.ts";
import {
  demoCapabilities,
  demoEvidence,
  demoOperations,
  faqs,
  recommendations,
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

test("routes keep the landing, real workshop, and deterministic demo separate", () => {
  assert.deepEqual(
    [resolveRoute("/").name, resolveRoute("/workshop").name, resolveRoute("/demo").name],
    ["landing", "workshop", "demo"],
  );
  assert.equal(resolveRoute("/workshop/").name, "workshop");
  assert.equal(resolveRoute("/unexpected").name, "landing");
  assert.equal(resolveRoute("/workshop").path, "/workshop");
  assert.match(resolveRoute("/").title, /Unfinished Business/);
  assert.match(resolveRoute("/demo").title, /Deterministic demo/);
});

test("landing hero names the product, the engine, and all three primary actions", () => {
  const html = renderToStaticMarkup(createElement(LandingPage));
  const copy = text(html);

  assert.match(copy, /Turn unfinished ideas into hackathon-ready builds\./);
  assert.match(copy, /OpenCode-powered hackathon project builder/i);
  assert.match(copy, /Try the example/);
  assert.match(copy, /Watch the guided workflow/);
  assert.match(copy, /Run live with OpenCode/);
  assert.match(copy, /Set up locally/);
  assert.match(html, /href="\/demo"/);
  assert.match(html, /href="\/demo\?presentation=1"/);
  assert.match(html, /href="\/workshop"/);
  assert.match(html, /href="#local-setup"/);
  assert.match(html, /width="1920"/);
  assert.match(html, /height="823"/);
  assert.match(html, /The example is a deterministic fixture, not live inference/);
});

test("usage modes are described truthfully and never claim local repository access", () => {
  const html = renderToStaticMarkup(createElement(LandingPage));
  const copy = text(html);

  for (const mode of usageModes) assert.ok(copy.includes(mode.title), `missing mode ${mode.id}`);
  assert.match(copy, /public demo never uses a visitor's repository and rejects every mutation/);
  assert.match(copy, /private instance is password-protected/);
  assert.match(copy, /Neither path is a public execution sandbox/);
  assert.match(copy, /Your machine, your OpenCode server, your session/);
  assert.doesNotMatch(copy, /Password protection and a loopback OpenCode server are required for a hosted instance/);
  assert.doesNotMatch(copy, /trusted by|10,000|award-winning|used by \d/i);
  assert.doesNotMatch(copy, /remote access to your local repository/i);
});

test("recommendation fixtures carry source freshness and stay inside current capabilities", () => {
  assert.ok(recommendations.length >= 3);
  for (const recommendation of recommendations) {
    assert.ok(recommendation.source.length > 8, recommendation.idea);
    assert.match(recommendation.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.doesNotMatch(recommendation.path, /paid model|arbitrary shell|remote repository/i);
    assert.doesNotMatch(recommendation.permission, /auto-?approve|install silently/i);
  }
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

test("demo and evidence previews label fixtures and keep the missing live proof visible", () => {
  const demo = renderToStaticMarkup(createElement(DemoPage));
  const copy = text(demo);
  assert.match(copy, /Campus Umbrella Relay/);
  assert.match(copy, /No OpenCode session, provider call, repository read, or model quota is used/);
  assert.match(copy, /Every run, diff, check, and finding is fixture data/);
  assert.match(copy, /The live session remains NOT_RUN/);
  assert.match(copy, /Representative diff and deterministic check/);
  assert.match(copy, /Reset changes only this demo fixture/);
  assert.match(copy, /The same Run Inspector, with demo data/);
  for (const spirit of ["oracle", "architect", "maker", "witness"] as const) {
    for (const state of new Set(demoFixture.beats.filter((beat) => beat.spirit === spirit).map((beat) => beat.state))) {
      assert.match(demo, new RegExp(`data-testid="spirit-state-${spirit}-${state}"`));
    }
  }
  assert.match(demo, /data-testid="demo-recovery"/);

  const inspector = renderToStaticMarkup(createElement(RunInspector, {
    operations: demoOperations,
    evidence: demoEvidence,
    capabilities: demoCapabilities,
  }));
  assert.match(text(inspector), /Fail/);
  assert.match(text(inspector), /Do not claim a working build/);
  assert.match(text(inspector), /Workflow approval is not tool permission/);
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

test("FAQ answers cover the open-source engine and the demo's limits", () => {
  assert.ok(faqs.some((item) => /second coding harness/i.test(item.question)));
  assert.ok(faqs.some((item) => /hosted page read my local repository/i.test(item.question)));
  assert.ok(faqs.some((item) => /deterministic walkthrough is a scripted fixture/i.test(item.answer)));
});
