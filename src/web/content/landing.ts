import { demoFixture } from "../../shared/demo.ts";

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
    kicker: "Hosted sample",
    title: "Try the read-only sample",
    summary: "The public sample replays the recorded Driftwatch story with no OpenCode, token, or visitor state. A private hosted instance adds Basic Auth, a private disk, and a loopback OpenCode server.",
    bullets: [
      "The public sample never uses a visitor's repository and rejects every change.",
      "A private instance is password-protected and uses its own isolated workspace.",
      "Neither path claims remote access to your machine.",
    ],
    cta: { label: "Open the guided sample", href: "/demo" },
    tone: "spectral",
  },
  {
    id: "local",
    kicker: "On your machine",
    title: "Your machine, your OpenCode server, your session",
    summary: "Run the interface and the pinned OpenCode server locally. The workshop connects over loopback and keeps project data in an ignored local directory.",
    bullets: [
      "Requires Node 22.14+ and a supported OpenCode 2.x server.",
      "Maker's edit in this release is bounded to an isolated demo workspace.",
      "Changes are checked server-side; the token is issued over loopback or after private-hosted sign-in.",
    ],
    cta: { label: "Read the local setup", href: "#local-setup" },
    tone: "amber",
  },
] as const;

export const sampleStory = {
  name: demoFixture.scenario.name,
  location: demoFixture.scenario.location,
  originalProblem: demoFixture.scenario.originalProblem,
  unfinished: demoFixture.scenario.unfinished,
  revival: demoFixture.scenario.revival,
  check: demoFixture.verification.summary,
  command: demoFixture.verification.command,
  liveProof: demoFixture.project.evidence.find((item) => item.id === "ev-demo-live")?.result ?? "NOT_RUN",
} as const;

export interface FaqItem {
  question: string;
  answer: string;
}

export const faqs: readonly FaqItem[] = [
  {
    question: "Is this a second coding harness?",
    answer: "No. OpenCode is the open-source engine that runs the model, tools, permissions, and sessions. Unfinished Business is the workshop around it: four stages, exact-version approvals, and an evidence ledger.",
  },
  {
    question: "What is the Driftwatch sample?",
    answer: "Driftwatch is a small abandoned open-source CLI in the recorded sample. It reads a local issues.json export and reports issues that have gone quiet. The sample shows the same project from a vague idea through a plan, a bounded change, a test, and an honest review.",
  },
  {
    question: "Does the hosted page read my local repository?",
    answer: "No. A hosted or sample instance can only use its own isolated workspace. The browser has no remote repository mount, and this release does not claim remote access to a visitor's machine.",
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
    question: "What does the sample actually prove?",
    answer: "The sample is a recorded fixture. It proves the interface states and wording, not live inference or a successful build. Real runs appear in the workshop's Activity & results view with native session references.",
  },
  {
    question: "What is stored locally?",
    answer: "Project metadata lives in UB_DATA_DIR (default .unfinished-business/) and is gitignored. The app stores approval state and references to native evidence; native transcripts stay in OpenCode.",
  },
] as const;

export const privacyPoints: readonly { title: string; body: string }[] = [
  {
    title: "No remote repository mount",
    body: "The landing page and hosted sample have no access to a visitor's local checkout. Local mode runs on the visitor's machine.",
  },
  {
    title: "Loopback by default",
    body: "Development binds the app and OpenCode to 127.0.0.1. A private production deployment must set an access password and bind deliberately; the public sample has no OpenCode or user state.",
  },
  {
    title: "Changes are checked server-side",
    body: "Writes require a browser-session token issued over loopback and an expected project revision. Stale or repeated actions return a conflict instead of overwriting.",
  },
  {
    title: "Model replies are proposals",
    body: "Model output is parsed as a proposal, not authority. It cannot approve a section or grant Maker scope, and native denials stay denials.",
  },
] as const;

export const heroAlt = "Four small workshop spirits gather around an abandoned open-source project on a workbench: a lantern orb, a blueprint compass, a mechanical builder, and an archival moth.";
