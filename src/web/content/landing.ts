import type { WorkshopProject } from "../api.ts";

export interface UsageMode {
  id: string;
  kicker: string;
  title: string;
  summary: string;
  bullets: readonly string[];
  cta: { label: string; href: string };
  tone: "spectral" | "amber";
}

export const usageModes: readonly UsageMode[] = [
  {
    id: "hosted",
    kicker: "Hosted demo or private hosted",
    title: "A labeled public sample, or a protected private workshop",
    summary: "The public demo runs the deterministic walkthrough with no OpenCode, token, or visitor state. A private instance adds Basic Auth, a private disk, and a loopback OpenCode server.",
    bullets: [
      "The public demo never uses a visitor's repository and rejects every mutation.",
      "A private instance is password-protected and uses its own isolated demo workspace.",
      "Neither path is a public execution sandbox; the sample is labeled.",
    ],
    cta: { label: "Walk through the fixture", href: "/demo" },
    tone: "spectral",
  },
  {
    id: "local",
    kicker: "Full local mode",
    title: "Your machine, your OpenCode server, your session",
    summary: "Run the API, interface, and the pinned OpenCode server locally. The workshop connects over loopback and keeps project data in an ignored local directory.",
    bullets: [
      "Requires Node 22.14+ and a supported OpenCode 2.x server.",
      "Maker's edit in this release is bounded to an isolated demo workspace.",
      "API reads and mutations are checked server-side; the token is issued over loopback or after private-hosted sign-in.",
    ],
    cta: { label: "Read the local setup", href: "#local-setup" },
    tone: "amber",
  },
] as const;

export interface DemoStep {
  id: string;
  stage: "ORACLE" | "ARCHITECT" | "MAKER" | "WITNESS";
  spirit: "oracle" | "architect" | "maker" | "witness";
  state: "listening" | "clarification" | "drawing" | "success" | "evidence" | "warning";
  title: string;
  summary: string;
  detail: string;
  lines: readonly string[];
}

export const demoSteps: readonly DemoStep[] = [
  {
    id: "idea",
    stage: "ORACLE",
    spirit: "oracle",
    state: "listening",
    title: "Name the unfinished idea",
    summary: "A stalled campus umbrella relay becomes a proposal, not an approval.",
    detail: "The Oracle restates the useful outcome and keeps the unresolved claim rules beside it.",
    lines: ["Proposal: post, claim, and return one campus umbrella pool.", "Open question: how is a duplicate claim rejected?", "Status: proposed — waiting for your approval."],
  },
  {
    id: "scope",
    stage: "ARCHITECT",
    spirit: "architect",
    state: "drawing",
    title: "Approve one section at a time",
    summary: "The Architect drafts a single planning section against its dependencies.",
    detail: "A revision invalidates the old approval. The next section waits until the current one is approved.",
    lines: ["Section 1 of 8: Control and scope.", "Revision v1 → v2 — duplicate claims become acceptance criteria.", "Approval target: this version and hash only."],
  },
  {
    id: "build",
    stage: "MAKER",
    spirit: "maker",
    state: "success",
    title: "Grant a separate build scope",
    summary: "Maker receives an explicit, bounded scope after the plan is approved.",
    detail: "OpenCode performs the native edit. The workshop records the session and the result it actually observed.",
    lines: ["Scope: two files in the isolated demo workspace.", "Bounded change: duplicate-claim guard plus one test.", "Permission: OpenCode decides, not the workflow UI."],
  },
  {
    id: "evidence",
    stage: "WITNESS",
    spirit: "witness",
    state: "evidence",
    title: "Keep the live proof visible",
    summary: "The fixture check passes; the live native session remains NOT_RUN.",
    detail: "Witness separates the prerecorded result from the missing live proof. Review notes are drafts, not a submitted article.",
    lines: ["Check: node --test demo-workspace/relay.test.mjs.", "Fixture: 3 passed, 0 failed.", "Live session: NOT_RUN — run locally for a native result."],
  },
] as const;

export interface FaqItem {
  question: string;
  answer: string;
}

export const faqs: readonly FaqItem[] = [
  {
    question: "Is this a second coding harness?",
    answer: "No. OpenCode supplies the agent loop, model access, native tools, permissions, and sessions. Unfinished Business adds the four-stage workshop, exact-version approvals, dependency invalidation, and an evidence ledger.",
  },
  {
    question: "Does the hosted page read my local repository?",
    answer: "No. A hosted or demo instance can only use its own isolated workspace. The browser has no remote repository mount, and this release does not claim remote access to a visitor's machine.",
  },
  {
    question: "Can workflow approval override a tool denial?",
    answer: "No. Approving a plan or granting Maker scope constrains the workflow; it never overrides OpenCode's native permission decision. A refusal is shown as blocked and is not retried automatically.",
  },
  {
    question: "Which model does it use?",
    answer: "The model comes from OpenCode's discovered catalog, not a fixed model in this app. New projects may use any model OpenCode reports as available; a free/local-only policy and an optional spending limit are available. A paid or unknown-price route requires an explicit confirmation, and the app never silently substitutes a model.",
  },
  {
    question: "What does the demo actually prove?",
    answer: "The deterministic walkthrough is a scripted fixture. It proves the interface states and wording, not live inference or a successful build. Real runs appear in the workshop's Run Inspector with native session references.",
  },
  {
    question: "What is stored locally?",
    answer: "Project metadata lives in UB_DATA_DIR (default .unfinished-business/) and is gitignored. The app stores approval state and references to native evidence; native transcripts stay in OpenCode.",
  },
] as const;

export const demoOperations: WorkshopProject["operations"] = [
  {
    id: "op-demo-maker",
    kind: "maker",
    status: "SUCCEEDED",
    result: "Native edit recorded: demo-workspace/relay.mjs (+12/−2).",
    nativeSessionId: "ses_demo_maker_7c1a9d",
    model: null,
    agent: null,
    startedAt: null,
    finishedAt: null,
    providerError: null,
  },
  {
    id: "op-demo-check",
    kind: "check",
    status: "FAILED",
    result: "node --test reported a duplicate-claim regression in the generated workspace.",
    nativeSessionId: "ses_demo_check_2b44e1",
    model: null,
    agent: null,
    startedAt: null,
    finishedAt: null,
    providerError: null,
  },
  {
    id: "op-demo-witness",
    kind: "witness",
    status: "SUCCEEDED",
    result: "Fresh review session recorded the failure and its limitation.",
    nativeSessionId: "ses_demo_witness_5f08c2",
    model: null,
    agent: null,
    startedAt: null,
    finishedAt: null,
    providerError: null,
  },
] as const;

export const demoEvidence: WorkshopProject["evidence"] = [
  {
    id: "ev-demo-check",
    checkId: "node-test-bounded",
    result: "FAIL",
    limitation: "The generated relay does not pass node --test in this fixture. Do not claim a working build.",
    model: null,
  },
] as const;

export const demoCapabilities: WorkshopProject["capabilities"] = [
  {
    id: "inspect-changes",
    purpose: "Show the diff from the Maker's native session",
    nativeMapping: "OpenCode session.diff in the isolated demo workspace",
    availability: "unknown",
    permission: "Read-only inspection after a Maker run",
    observedOutcome: null,
  },
  {
    id: "node-check",
    purpose: "Run the approved dependency-free Node test",
    nativeMapping: "bounded node --test in the isolated demo workspace",
    availability: "available",
    permission: "Runs only after an explicit Maker scope grant and a native edit",
    observedOutcome: "One recorded failure; not a passing proof.",
  },
] as const;

export interface Recommendation {
  idea: string;
  fit: string;
  path: string;
  permission: string;
  /** Human-readable provenance for the recommendation. */
  source: string;
  /** ISO date the source/claim was last checked. */
  verifiedAt: string;
}

export const recommendations: readonly Recommendation[] = [
  {
    idea: "Campus lost-and-found",
    fit: "A small state model plus one verified test",
    path: "Node check + diff inspection",
    permission: "node --test runs only inside the isolated demo workspace; diff inspection stays read-only.",
    source: "Current product capability catalog (TOOL_CATALOG.md)",
    verifiedAt: "2026-10-31",
  },
  {
    idea: "Habit streak tracker",
    fit: "Same capability, no new install",
    path: "Keep the bounded Node check",
    permission: "No arbitrary shell, package install, or network tool is requested by this preview.",
    source: "Current product capability catalog (TOOL_CATALOG.md)",
    verifiedAt: "2026-10-31",
  },
  {
    idea: "Photo scavenger hunt",
    fit: "Needs asset handling outside the current scope",
    path: "Recommend a focused scope change first",
    permission: "Do not silently expand permissions; the plan and native capability set must change explicitly.",
    source: "Current product capability catalog (TOOL_CATALOG.md)",
    verifiedAt: "2026-10-31",
  },
] as const;

export const privacyPoints: readonly { title: string; body: string }[] = [
  {
    title: "No remote repository mount",
    body: "The landing page and hosted sample have no access to a visitor's local checkout. Local mode runs on the visitor's machine.",
  },
  {
    title: "Loopback by default",
    body: "Development binds the app and OpenCode to 127.0.0.1. A private production deployment must set an access password and bind deliberately; the public demo has no OpenCode or user state.",
  },
  {
    title: "Server-checked mutations",
    body: "Writes require a browser-session token issued over loopback and an expected project revision. Stale or repeated actions return a conflict instead of overwriting.",
  },
  {
    title: "Untrusted model content",
    body: "Model replies are parsed as proposals, not authority. They cannot approve a section or grant Maker scope, and native denials stay denials.",
  },
] as const;

export const heroAlt = "A spectral night workshop with an unfinished robot on a workbench, a CRT terminal, blueprints, and four small friendly spirits drifting in the blue haze.";
