import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createApp } from "../src/server/app.ts";
import { AtomicProjectStore } from "../src/server/store/atomic-project-store.ts";
import { contentHash, createProject } from "../src/server/workflow/model.ts";
import { WorkflowService } from "../src/server/workflow/service.ts";
import {
  DEMO_FIXTURE_VERSION,
  DEMO_PRESENTATION_BEAT_MS,
  DEMO_PRESENTATION_TOTAL_MS,
  demoExport,
  demoFixture,
  evidenceForBeat,
  operationsForBeat,
} from "../src/shared/demo.ts";
import { modeDescriptor } from "../src/shared/modes.ts";
import {
  capabilitySchema,
  evidenceSchema,
  operationSchema,
  projectSchema,
} from "../src/shared/workflow.ts";
import { DemoPage } from "../src/web/demo/DemoPage.tsx";
import {
  DEMO_LAST_INDEX,
  currentBeat,
  demoPlaybackReducer,
  focusedSpirit,
  initialDemoPlayback,
  presentationFromSearch,
  presentationSearch,
} from "../src/web/demo/playback.ts";
import { resolveRoute } from "../src/web/routes.ts";

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

test("the demo fixture is versioned and validates against the production project contract", () => {
  assert.equal(demoFixture.version, DEMO_FIXTURE_VERSION);
  assert.equal(demoFixture.dataMode, "demo");
  assert.match(demoFixture.sourceLabel, /not a live OpenCode session/i);
  assert.equal(demoFixture.project.id, "demo-driftwatch");
  assert.equal(demoFixture.project.sections.length, 8);
  assert.equal(demoFixture.project.stage, "WITNESS");
  assert.equal(demoFixture.project.makerScope.status, "GRANTED");
  assert.equal(demoFixture.project.product.status, "APPROVED");

  const project = projectSchema.parse(demoFixture.project);
  for (const section of project.sections) {
    assert.equal(section.status, "APPROVED");
    assert.equal(section.hash, contentHash(section.content), `hash drift in ${section.id}`);
  }
  for (const approval of project.approvals) {
    const section = project.sections.find((candidate) => candidate.id === approval.sectionId);
    assert.ok(section, `approval references missing section ${approval.sectionId}`);
    assert.equal(approval.hash, section.hash);
    assert.equal(approval.version, section.version);
  }
  for (const operation of project.operations) operationSchema.parse(operation);
  for (const evidence of project.evidence) evidenceSchema.parse(evidence);
  for (const capability of project.capabilities) capabilitySchema.parse(capability);
  assert.equal(demoExport.limitation.includes("Recorded sample data"), true);
  assert.equal(demoExport.drafts.length, project.witnessDrafts.length);
});

test("every guided beat references valid production-shaped events and all four spirits", () => {
  assert.equal(demoFixture.beats.length, 10);
  assert.equal(new Set(demoFixture.beats.map((beat) => beat.stage)).size, 4);
  assert.deepEqual(new Set(demoFixture.beats.map((beat) => beat.spirit)), new Set(["oracle", "architect", "maker", "witness"]));

  for (const beat of demoFixture.beats) {
    if (beat.sectionId) {
      assert.ok(demoFixture.project.sections.some((section) => section.id === beat.sectionId), `missing section ${beat.sectionId}`);
    }
    for (const operation of operationsForBeat(beat)) operationSchema.parse(operation);
    for (const evidence of evidenceForBeat(beat)) evidenceSchema.parse(evidence);
    assert.ok(beat.title.length > 0);
    assert.ok(beat.callout.length > 0);
  }

  const checkBeat = demoFixture.beats.find((beat) => beat.id === "check");
  assert.ok(checkBeat);
  assert.equal(evidenceForBeat(checkBeat!)[0].result, "PASS");
  assert.equal(evidenceForBeat(checkBeat!)[1].result, "NOT_RUN");
});

test("every fixture artifact describes the same Driftwatch revival", () => {
  const serialized = JSON.stringify(demoFixture);
  assert.doesNotMatch(serialized, /umbrella|campus/i);
  assert.equal(demoFixture.project.product.structuredProposal?.title, demoFixture.scenario.name);

  for (const section of demoFixture.project.sections) {
    assert.ok(section.content.length > 0, `${section.id} needs content`);
    assert.match(section.content, /Driftwatch|issues\.json|stale|report|sample/i, `${section.id} must stay on the sample`);
  }
  for (const revision of demoFixture.revisions) {
    assert.ok(demoFixture.project.sections.some((section) => section.id === revision.sectionId));
  }

  assert.ok(demoFixture.makerAuthorization.includes(demoFixture.diff.files[0].path));
  assert.ok(demoFixture.makerAuthorization.includes(demoFixture.diff.files[1].path));
  assert.equal(demoFixture.verification.command, `node --test ${demoFixture.diff.files[1].path}`);
  assert.match(demoFixture.verification.summary, /4 tests passed, 0 failed/);
  assert.equal(demoFixture.project.evidence.filter((item) => item.result === "FAIL").length, 0);
  assert.equal(demoFixture.witness.findings.filter((finding) => finding.kind === "PASS").length, 1);
});

test("the fixture is deterministic and does not read time, randomness, environment, or network", async () => {
  assert.equal(JSON.stringify(demoFixture), JSON.stringify(demoFixture));
  assert.equal(demoFixture.project.operations[0].startedAt, "2026-10-31T08:00:00.000Z");
  assert.equal(demoFixture.verification.observedAt, "2026-10-31T08:04:04.000Z");

  const source = await readFile("src/shared/demo.ts", "utf8");
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /node:/);
  assert.doesNotMatch(source, /process\.env/);
  assert.doesNotMatch(source, /Date\.now|Math\.random/);
});

test("full playback reaches the end and a reset only resets demo playback", () => {
  let state = initialDemoPlayback();
  assert.equal(state.index, 0);
  assert.equal(state.playing, false);
  state = demoPlaybackReducer(state, { type: "play" });
  assert.equal(state.playing, true);

  for (let step = 0; step < demoFixture.beats.length; step += 1) {
    state = demoPlaybackReducer(state, { type: "tick" });
  }
  assert.equal(state.index, DEMO_LAST_INDEX);
  assert.equal(state.completed, true);
  assert.equal(state.playing, false);
  assert.equal(currentBeat(state).id, "next");

  state = demoPlaybackReducer(state, { type: "reset" });
  assert.deepEqual(state, initialDemoPlayback());
  assert.equal(currentBeat(state).id, "problem");

  state = demoPlaybackReducer(state, { type: "play" });
  state = demoPlaybackReducer(state, { type: "replay" });
  assert.equal(state.index, 0);
  assert.equal(state.playing, true);
  assert.equal(state.completed, false);
});

test("pause, resume, step, and tab inspection are deterministic", () => {
  let state = initialDemoPlayback();
  state = demoPlaybackReducer(state, { type: "play" });
  state = demoPlaybackReducer(state, { type: "tick" });
  assert.equal(state.index, 1);

  state = demoPlaybackReducer(state, { type: "pause" });
  assert.equal(state.playing, false);
  const paused = state;
  state = demoPlaybackReducer(state, { type: "tick" });
  assert.equal(state.index, paused.index);

  state = demoPlaybackReducer(state, { type: "next" });
  assert.equal(state.index, 2);
  assert.equal(state.playing, false);

  state = demoPlaybackReducer(state, { type: "inspect", spirit: "maker" });
  assert.equal(state.inspected, "maker");
  assert.equal(state.playing, false);
  assert.equal(focusedSpirit(state), "maker");

  state = demoPlaybackReducer(state, { type: "play" });
  assert.equal(state.playing, true);
  state = demoPlaybackReducer(state, { type: "tick" });
  assert.equal(state.inspected, null);
});

test("presentation mode is a 90-second path and route refresh restores its mode", () => {
  assert.equal(DEMO_PRESENTATION_BEAT_MS * demoFixture.beats.length, DEMO_PRESENTATION_TOTAL_MS);
  assert.equal(DEMO_PRESENTATION_TOTAL_MS, 90_000);
  assert.equal(presentationFromSearch("?presentation=1"), true);
  assert.equal(presentationFromSearch("?presentation=0"), false);
  assert.equal(presentationFromSearch(""), false);
  assert.equal(presentationSearch("", true), "?presentation=1");
  assert.equal(presentationSearch("?presentation=1", false), "");
  assert.equal(presentationSearch("?keep=1", true), "?keep=1&presentation=1");

  const state = initialDemoPlayback(true);
  assert.equal(state.presentation, true);
  assert.equal(state.playing, true);
  assert.equal(resolveRoute("/demo").name, "demo");

  const beatIds = demoFixture.beats.map((beat) => beat.id);
  assert.ok(beatIds.includes("problem"));
  assert.ok(beatIds.includes("run"));
  assert.ok(beatIds.includes("check"));
  assert.ok(beatIds.includes("next"));
});

test("hosted demo mode rejects every mutation before touching the live project", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ub-demo-mode-"));
  const store = new AtomicProjectStore(join(directory, "project.json"));
  await store.initialize(createProject("/workspace"));
  const before = await store.load();
  const app = createApp({
    service: new WorkflowService(store),
    sessionToken: "test-token",
    mode: "demo",
  });

  const headers = { "content-type": "application/json", "x-ub-session-token": "test-token" };
  const mutation = await app.request("/api/sections/control/revisions", {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "demo-mutation", expectedRevision: 0, content: "should not persist" }),
  });
  assert.equal(mutation.status, 403);
  assert.equal((await mutation.json()).code, "DEMO_READ_ONLY");

  const approval = await app.request("/api/approvals", {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "demo-approval", expectedRevision: 0, kind: "product" }),
  });
  assert.equal(approval.status, 403);

  const session = await app.request("/api/session");
  assert.equal(session.status, 403);

  const projectResponse = await app.request("/api/project");
  assert.equal(projectResponse.status, 200);
  assert.equal((await projectResponse.json()).id, demoFixture.project.id);

  const exportResponse = await app.request("/api/export");
  assert.equal(exportResponse.status, 200);
  assert.equal((await exportResponse.json()).limitation.includes("Recorded sample data"), true);

  const modeResponse = await app.request("/api/mode");
  assert.equal(modeResponse.status, 200);
  assert.equal((await modeResponse.json()).id, "demo");
  assert.equal(modeDescriptor("demo").capabilities.find((item) => item.id === "mutations")?.available, false);

  const after = await store.load();
  assert.deepEqual(after, before, "the live project must not change in hosted-demo mode");
});

test("the demo page and playback source make no network, inference, or mutation calls", async () => {
  const pageSource = await readFile("src/web/demo/DemoPage.tsx", "utf8");
  const playbackSource = await readFile("src/web/demo/playback.ts", "utf8");
  for (const source of [pageSource, playbackSource]) {
    assert.doesNotMatch(source, /\bfetch\s*\(/);
    assert.doesNotMatch(source, /\/api\//);
    assert.doesNotMatch(source, /from ["'][^"']*\/api\.ts["']/);
    assert.doesNotMatch(source, /node:/);
  }
});

test("the demo page exposes accessible controls, live regions, and all four inspectable tabs", () => {
  const html = renderToStaticMarkup(createElement(DemoPage));
  const copy = text(html);

  assert.match(copy, /Driftwatch/);
  assert.match(copy, /This is a recorded sample/);
  assert.match(copy, /No OpenCode session, provider call, repository read, or model quota is used/);
  assert.match(copy, /Every run, diff, check, and finding is recorded sample data/);
  assert.match(copy, /Reset changes only this sample/);
  assert.match(copy, /Representative diff and recorded check/);
  assert.match(copy, /live session was not run/i);

  assert.match(html, /Skip to the guided example/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-label="Play"/);
  assert.match(html, /aria-label="Next step"/);
  assert.match(html, /aria-label="Replay from the beginning"/);
  assert.match(html, /aria-label="Reset demo"/);
  assert.match(html, /aria-label="Inspect Oracle,/);
  assert.match(html, /aria-label="Inspect Architect,/);
  assert.match(html, /aria-label="Inspect Maker,/);
  assert.match(html, /aria-label="Inspect Witness,/);
  assert.match(html, /data-demo="true"/);
  assert.match(html, /data-testid="run-inspector"/);
});

test("a production contract change fails the fixture instead of silently drifting", () => {
  const drifted = structuredClone(demoFixture.project);
  drifted.operations[0].status = "NOT_A_STATUS" as never;
  assert.throws(() => projectSchema.parse(drifted));

  const missingEvidence = structuredClone(demoFixture.project);
  missingEvidence.evidence[0].result = "SUCCESS" as never;
  assert.throws(() => projectSchema.parse(missingEvidence));
});
