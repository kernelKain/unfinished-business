import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPage } from "../src/web/landing/LandingPage.tsx";
import { DemoPage } from "../src/web/demo/DemoPage.tsx";
import { SpiritCharacter, type SpiritState } from "../src/web/components/SpiritCharacter.tsx";
import { RunInspector } from "../src/web/components/RunInspector.tsx";
import {
  demoCapabilities,
  demoEvidence,
  demoOperations,
  demoSteps,
  faqs,
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
  assert.match(copy, /Connect OpenCode/);
  assert.match(copy, /Set up locally/);
  assert.match(html, /href="\/demo"/);
  assert.match(html, /href="#local-setup"/);
  assert.match(html, /width="1920"/);
  assert.match(html, /height="823"/);
  assert.match(html, /The example is a deterministic fixture, not live inference/);
});

test("usage modes are described truthfully and never claim local repository access", () => {
  const html = renderToStaticMarkup(createElement(LandingPage));
  const copy = text(html);

  for (const mode of usageModes) assert.ok(copy.includes(mode.title), `missing mode ${mode.id}`);
  assert.match(copy, /Hosted execution is not a public sandbox/);
  assert.match(copy, /never a visitor's local repository/);
  assert.match(copy, /Your machine, your OpenCode server, your session/);
  assert.match(copy, /Password protection and a loopback OpenCode server are required/);
  assert.doesNotMatch(copy, /trusted by|10,000|award-winning|used by \d/i);
  assert.doesNotMatch(copy, /remote access to your local repository/i);
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

test("demo and evidence previews label fixtures and keep failures visible", () => {
  const demo = renderToStaticMarkup(createElement(DemoPage));
  const copy = text(demo);
  assert.match(copy, /This page never calls OpenCode or a model\./);
  assert.match(copy, /Not live inference, not a successful build, not remote repository access\./);
  assert.match(copy, /The same component appears in the workshop with real native session references/);
  for (const step of demoSteps) assert.match(demo, new RegExp(`data-testid="spirit-state-${step.spirit}-${step.state}"`));
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

test("FAQ answers cover the open-source engine and the demo's limits", () => {
  assert.ok(faqs.some((item) => /second coding harness/i.test(item.question)));
  assert.ok(faqs.some((item) => /hosted page read my local repository/i.test(item.question)));
  assert.ok(faqs.some((item) => /deterministic walkthrough is a scripted fixture/i.test(item.answer)));
});
