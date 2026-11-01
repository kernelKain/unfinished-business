import type { Evidence, Operation, Project } from "./workflow.ts";

/**
 * Versioned deterministic fixture for the public guided example.
 *
 * This module is browser-safe and contains no network, filesystem, provider,
 * or OpenCode imports. The production project schema validates it in
 * `tests/demo.test.ts`; a contract change therefore fails the demo test rather
 * than silently drifting from the live workshop.
 *
 * One fixture is the only source for the guided demo, the landing preview, the
 * visual snapshots, and the evidence examples. Do not add a second demo state
 * in the landing content.
 */

export const DEMO_FIXTURE_VERSION = "driftwatch@1";
export const DEMO_DATA_MODE = "demo" as const;
export const DEMO_SOURCE_LABEL = "Recorded sample — not a live OpenCode session";
export const DEMO_SAMPLE_LABEL = "Sample project";

/** Normal playback holds each beat for 7 seconds; the recording path is 9. */
export const DEMO_BEAT_MS = 7_000;
export const DEMO_PRESENTATION_BEAT_MS = 9_000;
export const DEMO_PRESENTATION_TOTAL_MS = 90_000;

export type DemoSpiritId = "oracle" | "architect" | "maker" | "witness";
export type DemoSpiritState =
  | "idle"
  | "listening"
  | "clarification"
  | "drawing"
  | "approval"
  | "building"
  | "permission"
  | "blocked"
  | "success"
  | "scanning"
  | "evidence"
  | "warning"
  | "stamp";

export type DemoOperationStatus =
  | "QUEUED"
  | "RUNNING"
  | "WAITING_PERMISSION"
  | "COMPLETED_UNAPPLIED"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "ABANDONED";

export type DemoEvidenceResult = "PASS" | "FAIL" | "NOT_RUN" | "INCONCLUSIVE" | "STALE";

export interface DemoBeat {
  id: string;
  stage: "ORACLE" | "ARCHITECT" | "MAKER" | "WITNESS";
  spirit: DemoSpiritId;
  state: DemoSpiritState;
  title: string;
  summary: string;
  detail: string;
  callout: string;
  focus: "idea" | "product" | "section" | "approval" | "scope" | "run" | "diff" | "check" | "evidence" | "readiness";
  sectionId?: string;
  operationIds: string[];
  evidenceIds: string[];
  operationStatus?: Record<string, DemoOperationStatus>;
  evidenceResult?: Record<string, DemoEvidenceResult>;
}

export interface DemoDiffLine {
  type: "+" | "-" | " ";
  text: string;
}

export interface DemoDiffFile {
  path: string;
  additions: number;
  deletions: number;
  hunks: Array<{
    header: string;
    lines: DemoDiffLine[];
  }>;
}

export interface DemoDiff {
  sourceLabel: string;
  summary: string;
  files: DemoDiffFile[];
}

export interface DemoVerification {
  sourceLabel: string;
  command: string;
  result: "PASS" | "FAIL";
  summary: string;
  output: string[];
  testedFingerprint: string;
  observedAt: string;
  limitation: string;
}

export interface DemoWitnessFinding {
  kind: "PASS" | "LIMIT" | "READY";
  text: string;
}

export interface DemoScenario {
  name: string;
  idea: string;
  location: string;
  originalProblem: string;
  unfinished: string;
  revival: string;
  provenance: string;
}

export interface DemoFixture {
  version: string;
  dataMode: typeof DEMO_DATA_MODE;
  sourceLabel: string;
  scenario: DemoScenario;
  oracle: {
    clarification: string;
    approvedSummary: string;
    resolvedQuestions: string[];
  };
  revisions: Array<{
    sectionId: string;
    fromVersion: number;
    toVersion: number;
    summary: string;
  }>;
  makerAuthorization: string;
  project: Project;
  diff: DemoDiff;
  verification: DemoVerification;
  witness: {
    findings: DemoWitnessFinding[];
    readiness: string;
    nextActions: string[];
  };
  beats: DemoBeat[];
}

/** One landing-safe preview step, derived from the canonical fixture below. */
export interface DemoPreviewStep {
  id: string;
  stage: "ORACLE" | "ARCHITECT" | "MAKER" | "WITNESS";
  spirit: DemoSpiritId;
  state: DemoSpiritState;
  title: string;
  summary: string;
  detail: string;
  lines: readonly string[];
}

const sectionContent = {
  control: [
    "## Goal",
    "Revive Driftwatch, an abandoned open-source CLI that reads a local issues.json export and lists issues that have gone quiet.",
    "",
    "## Scope",
    "One input file, one 90-day rule, and a plain text report. No network, accounts, or repository access in this sample.",
    "",
    "## Acceptance",
    "- Closed issues are never reported as stale.",
    "- The stale age is measured from the latest activity date.",
    "- The report is stable and readable.",
    "- The bounded Node check passes.",
  ].join("\n"),
  architecture: [
    "## Module",
    "`driftwatch.mjs` exports `parseIssues`, `findStale`, and `formatReport` over plain objects from the local JSON file.",
    "",
    "## Contract",
    "An issue is stale when it is open and its latest activity is older than 90 days. Closed issues are skipped. Invalid exports return stable error codes.",
    "",
    "## Boundary",
    "No network, database, account, or personal data. The test suite uses the Node built-in test runner.",
  ].join("\n"),
  experience: [
    "## Maintainer flow",
    "Load a local export, set the stale window, and print the issues that need a decision. The report says why each issue is listed.",
    "",
    "## Failure states",
    "A missing file or malformed export returns a clear error. A closed issue is skipped even when its old activity date is past the window.",
    "",
    "## Sample surface",
    "The guided sample shows the same four-stage workshop without calling a model or reading a real repository.",
  ].join("\n"),
  tools: [
    "## Tools",
    "Node 22 built-in test runner and a dependency-free module. No package install, network, or shell beyond the bounded check.",
    "",
    "## Cost",
    "No provider account or model quota is used by the sample. The live workshop follows the OpenCode catalog and its own account limits.",
  ].join("\n"),
  verification: [
    "## Bounded check",
    "`node --test demo-workspace/driftwatch.test.mjs` covers parsing, open-issue filtering, latest-activity age, and a stable report.",
    "",
    "## Evidence rule",
    "A passing check is recorded only when its result is observed. Sample evidence is labeled separately from a live native result.",
    "",
    "## Risks",
    "The sample does not fetch GitHub issues, handle labels, or replace a maintainer's judgement.",
  ].join("\n"),
  phases: [
    "## One bounded unit",
    "Use the latest activity date, skip closed issues, keep the report shape stable, and add one behavioural test.",
    "",
    "## Queue",
    "No package installs, deployment, or extra scope. Witness reviews the recorded diff and check next.",
  ].join("\n"),
  delivery: [
    "## Delivery",
    "A local Node module and test file in the demo workspace. No hosted service, deployment, or submission is included.",
    "",
    "## Honest limit",
    "The sample is a recorded walkthrough. A real submission needs a live OpenCode run, repository link, article or video, and event entry.",
  ].join("\n"),
  readiness: [
    "## Execution directive",
    "Maker may edit only `demo-workspace/driftwatch.mjs` and `demo-workspace/driftwatch.test.mjs`. No network, installs, or repository changes outside that workspace.",
    "",
    "## Ready state",
    "All eight sections are approved. The Maker scope is granted separately. OpenCode remains the tool-permission authority.",
  ].join("\n"),
} as const;

/**
 * Real SHA-256 hashes for the fixed section content above. They are regenerated
 * deliberately when the fixture content changes; the demo test recomputes them.
 */
const sectionHashes: Record<keyof typeof sectionContent, string> = {
  control: "fb8c6c69981f0ecb22e7cd46754ff84db70f33cd1bb62852440bd30d1ca5e541",
  architecture: "7d62e946b990d9e15ff3a41c3679e59b00240e449bf43bf0f1efa55f5944df31",
  experience: "671a944d92ad94f8d7f8e09bbb373d77700480f3c67b840fb4caac36ede25c88",
  tools: "8f0cf2d1202bcf27cc4701c0b87103c1e891272ff5b132512f28583b8855ac76",
  verification: "df495c1ead2ebc39f5e2825fab8aa9ee695bbcba429c8ea3659692aa994265c2",
  phases: "07b991e8d731b398b08d4a516017f1975098383511c98a1388436404370b66dd",
  delivery: "48461bb4722debaffb3a76195f48cce785cbb0889d79128dcb08358946e860f9",
  readiness: "64718e3ff4ffd5902c44f97e02a2230ff07db752302a6357ad667bc144cd4025",
};

const sectionTitles = {
  control: "Control, product, scope, and acceptance",
  architecture: "Architecture and contracts",
  experience: "Experience",
  tools: "Tools, access, and cost",
  verification: "Verification and risks",
  phases: "Phases and queue",
  delivery: "Delivery",
  readiness: "Execution directive and readiness",
} as const;

const sectionDependencies: Record<keyof typeof sectionContent, string[]> = {
  control: [],
  architecture: ["control"],
  experience: ["control", "architecture"],
  tools: ["architecture"],
  verification: ["control", "architecture", "tools"],
  phases: ["verification"],
  delivery: ["experience", "verification", "phases"],
  readiness: ["control", "architecture", "experience", "tools", "verification", "phases", "delivery"],
};

const sectionIds = Object.keys(sectionContent) as Array<keyof typeof sectionContent>;

const demoOperations: Operation[] = [
  {
    id: "op-demo-oracle",
    kind: "guide",
    payloadHash: "demo-payload-oracle",
    nativeSessionId: "demo_ses_oracle_01",
    nativeMessageId: null,
    status: "SUCCEEDED",
    result: "Sample data: Oracle proposal stored. It is not approved.",
    model: null,
    agent: "oracle",
    startedAt: "2026-10-31T08:00:00.000Z",
    finishedAt: "2026-10-31T08:00:02.000Z",
    statusReason: null,
    lastObservedAt: "2026-10-31T08:00:02.000Z",
    appliedAt: "2026-10-31T08:00:02.000Z",
    providerError: null,
    intent: "clarify",
    sectionId: null,
    startingRevision: 0,
    idempotencyKey: "demo-action-oracle",
    expectedOutput: "ORACLE_REPLY",
    retryOf: null,
    progress: null,
  },
  {
    id: "op-demo-architect",
    kind: "guide",
    payloadHash: "demo-payload-architect",
    nativeSessionId: "demo_ses_architect_01",
    nativeMessageId: null,
    status: "SUCCEEDED",
    result: "Sample data: section 1 revised to v2 and the exact version was approved.",
    model: null,
    agent: "architect",
    startedAt: "2026-10-31T08:01:00.000Z",
    finishedAt: "2026-10-31T08:01:03.000Z",
    statusReason: null,
    lastObservedAt: "2026-10-31T08:01:03.000Z",
    appliedAt: "2026-10-31T08:01:03.000Z",
    providerError: null,
    intent: "draft",
    sectionId: "control",
    startingRevision: 2,
    idempotencyKey: "demo-action-architect",
    expectedOutput: "SECTION_DRAFT",
    retryOf: null,
    progress: null,
  },
  {
    id: "op-demo-scope",
    kind: "guide",
    payloadHash: "demo-payload-scope",
    nativeSessionId: "demo_ses_scope_01",
    nativeMessageId: null,
    status: "SUCCEEDED",
    result: "Sample data: separate Maker scope granted after all eight sections were approved.",
    model: null,
    agent: null,
    startedAt: "2026-10-31T08:02:00.000Z",
    finishedAt: "2026-10-31T08:02:01.000Z",
    statusReason: null,
    lastObservedAt: "2026-10-31T08:02:01.000Z",
    appliedAt: "2026-10-31T08:02:01.000Z",
    providerError: null,
    intent: null,
    sectionId: null,
    startingRevision: null,
    idempotencyKey: "demo-action-scope",
    expectedOutput: null,
    retryOf: null,
    progress: null,
  },
  {
    id: "op-demo-maker",
    kind: "maker",
    payloadHash: "demo-payload-maker",
    nativeSessionId: "demo_ses_maker_01",
    nativeMessageId: "demo_msg_maker_01",
    status: "SUCCEEDED",
    result: "Sample data: closed-issue filter and latest-activity age added in the isolated demo workspace.",
    model: null,
    agent: "maker",
    startedAt: "2026-10-31T08:03:00.000Z",
    finishedAt: "2026-10-31T08:03:09.000Z",
    statusReason: null,
    lastObservedAt: "2026-10-31T08:03:09.000Z",
    appliedAt: "2026-10-31T08:03:09.000Z",
    providerError: null,
    intent: "maker-run",
    sectionId: null,
    startingRevision: 4,
    idempotencyKey: "demo-action-maker",
    expectedOutput: "MAKER_DIFF",
    retryOf: null,
    progress: null,
  },
  {
    id: "op-demo-check",
    kind: "check",
    payloadHash: "demo-payload-check",
    nativeSessionId: "demo_ses_check_01",
    nativeMessageId: null,
    status: "SUCCEEDED",
    result: "Sample data: node --test demo-workspace/driftwatch.test.mjs recorded 4 passed, 0 failed.",
    model: null,
    agent: "maker",
    startedAt: "2026-10-31T08:04:00.000Z",
    finishedAt: "2026-10-31T08:04:04.000Z",
    statusReason: null,
    lastObservedAt: "2026-10-31T08:04:04.000Z",
    appliedAt: "2026-10-31T08:04:04.000Z",
    providerError: null,
    intent: null,
    sectionId: null,
    startingRevision: null,
    idempotencyKey: null,
    expectedOutput: null,
    retryOf: null,
    progress: null,
  },
  {
    id: "op-demo-witness",
    kind: "witness",
    payloadHash: "demo-payload-witness",
    nativeSessionId: "demo_ses_witness_01",
    nativeMessageId: null,
    status: "SUCCEEDED",
    result: "Sample data: Witness recorded one pass, two limitations, and the next action.",
    model: null,
    agent: "witness",
    startedAt: "2026-10-31T08:05:00.000Z",
    finishedAt: "2026-10-31T08:05:05.000Z",
    statusReason: null,
    lastObservedAt: "2026-10-31T08:05:05.000Z",
    appliedAt: "2026-10-31T08:05:05.000Z",
    providerError: null,
    intent: "witness",
    sectionId: null,
    startingRevision: 6,
    idempotencyKey: "demo-action-witness",
    expectedOutput: "WITNESS_REPLY",
    retryOf: null,
    progress: null,
  },
];

const demoEvidence: Evidence[] = [
  {
    id: "ev-demo-check",
    checkId: "node-test-bounded",
    nativeResultReference: "demo://driftwatch/check/node-test",
    testedFingerprint: "sha256:6f3c1d9b5a7e248c0d1f3a6b9c2e5d8f1a4b7c0d3e6f9a2b5c8d1e4f7a0b3c6d",
    result: "PASS",
    observedAt: "2026-10-31T08:04:04.000Z",
    limitation: "Recorded sample evidence. It is not a live OpenCode session and does not prove the visitor's repository.",
    model: null,
  },
  {
    id: "ev-demo-live",
    checkId: "live-native-session",
    nativeResultReference: "demo://not-run",
    testedFingerprint: "not-run",
    result: "NOT_RUN",
    observedAt: "2026-10-31T08:05:05.000Z",
    limitation: "No live OpenCode session is connected in this sample. Run locally to replace sample evidence with a native result.",
    model: null,
  },
];

const demoCapabilities: Project["capabilities"] = [
  {
    id: "inspect-changes",
    purpose: "Show the diff from the Maker's native session",
    nativeMapping: "OpenCode session.diff in the isolated demo workspace",
    availability: "unknown",
    permission: "Read-only inspection after a Maker run",
    observedOutcome: "Sample data: the representative diff is labeled as recorded evidence.",
  },
  {
    id: "node-check",
    purpose: "Run the approved dependency-free Node test",
    nativeMapping: "bounded node --test in the isolated demo workspace",
    availability: "available",
    permission: "Runs only after an explicit Maker scope grant and a native edit",
    observedOutcome: "Sample data: 4 passed, 0 failed. This is not a live result.",
  },
];

const projectSections = sectionIds.map((id, index) => ({
  id,
  title: sectionTitles[id],
  order: index + 1,
  dependencies: sectionDependencies[id],
  content: sectionContent[id],
  version: id === "control" || id === "architecture" ? 2 : 1,
  hash: sectionHashes[id],
  status: "APPROVED" as const,
  candidateRevisions: [],
}));

const demoProject: Project = {
  schemaVersion: 7,
  id: "demo-driftwatch",
  revision: 14,
  mode: "hosted-demo",
  demoWorkspace: true,
  createdAt: "2026-10-31T07:55:00.000Z",
  updatedAt: "2026-10-31T08:05:30.000Z",
  workspace: "demo://driftwatch",
  stage: "WITNESS",
  currentSectionId: null,
  sections: projectSections,
  approvals: projectSections.map((section, index) => ({
    id: `approval-demo-${String(index + 1).padStart(2, "0")}`,
    sectionId: section.id,
    version: section.version,
    hash: section.hash,
    approvedAt: `2026-10-31T08:0${index}:30.000Z`,
    staleReason: null,
  })),
  actions: [],
  operations: demoOperations,
  evidence: demoEvidence,
  nextAction: "Review the Witness drafts and decide whether to run the same project locally",
  product: {
    status: "APPROVED",
    proposal: "Revive Driftwatch: a dependency-free Node CLI that reads a local issues.json export and reports open issues with no activity for 90 days.",
    openQuestions: [],
    structuredProposal: {
      title: "Driftwatch",
      summary: "A small open-source maintainer tool that turns a static issue export into a readable stale-issue report.",
      intendedUser: "Open-source maintainers at a weekend hackathon",
      problem: "The abandoned CLI counts closed issues and measures age from the wrong date, so its report cannot be trusted.",
      desiredOutcome: "A trustworthy local report that helps a maintainer decide which open issues need attention.",
      mustHaveFeatures: ["Skip closed issues", "Measure age from the latest activity date", "Print a stable report"],
      optionalFeatures: [],
      nonGoals: ["Fetching data from GitHub", "Accounts or a hosted service"],
      successCriteria: ["Closed issues never appear as stale", "A recently active open issue is not stale", "The bounded test passes"],
      facts: ["The sample is deterministic and uses no repository or provider call."],
      userDecisions: ["Keep the first release to one local JSON export."],
      assumptions: [],
    },
  },
  makerScope: {
    status: "GRANTED",
    statement: "Edit only demo-workspace/driftwatch.mjs and demo-workspace/driftwatch.test.mjs. Skip closed issues, measure age from the latest activity date, and add one behavioural test. Do not install packages or touch the Unfinished Business repository.",
  },
  transcript: [
    {
      id: "demo-note-1",
      spirit: "system",
      text: "Sample data: no OpenCode session, provider call, or repository access is connected.",
      createdAt: "2026-10-31T08:00:00.000Z",
    },
    {
      id: "demo-note-2",
      spirit: "oracle",
      text: "The useful outcome is a trustworthy stale-issue report, not a live GitHub integration.",
      createdAt: "2026-10-31T08:00:02.000Z",
    },
    {
      id: "demo-note-3",
      spirit: "architect",
      text: "Section 1 narrowed to one local export and a closed-issue acceptance criterion.",
      createdAt: "2026-10-31T08:01:03.000Z",
    },
    {
      id: "demo-note-4",
      spirit: "maker",
      text: "Sample data: the bounded edit added the closed-issue filter, the latest-activity age, and one behavioural test.",
      createdAt: "2026-10-31T08:03:09.000Z",
    },
    {
      id: "demo-note-5",
      spirit: "witness",
      text: "The check passes in the sample. The live session is not run, so that limitation stays visible.",
      createdAt: "2026-10-31T08:05:05.000Z",
    },
  ],
  capabilities: demoCapabilities,
  witnessDrafts: [
    {
      id: "draft-demo-readiness",
      title: "Sample readiness",
      content: "The sample has an approved plan, a bounded Maker change, a representative diff, a recorded check, and a Witness review. It is ready to explain the workflow. It is not a submitted hackathon entry.",
      nativeSessionId: "demo_ses_witness_01",
      createdAt: "2026-10-31T08:05:10.000Z",
    },
    {
      id: "draft-demo-next",
      title: "Next actions",
      content: "Run the same project locally with OpenCode, replace sample evidence with a native session, record the guided path, then prepare the article, video, and event entry.",
      nativeSessionId: "demo_ses_witness_01",
      createdAt: "2026-10-31T08:05:11.000Z",
    },
  ],
  nativeSessions: [
    { role: "oracle", sessionId: "demo_ses_oracle_01" },
    { role: "architect", sessionId: "demo_ses_architect_01" },
    { role: "maker", sessionId: "demo_ses_maker_01" },
    { role: "witness", sessionId: "demo_ses_witness_01" },
  ],
  engine: { model: null, source: "none", updatedAt: null, legacyModel: null },
  source: {
    kind: "DEMO",
    status: "CONFIRMED",
    label: "Driftwatch",
    repositoryUrl: null,
    workspacePath: null,
    managedWorkspace: true,
    importedAt: null,
    confirmedAt: "2026-10-31T08:00:00.000Z",
    repositoryCondition: "Recorded sample; no repository is connected.",
  },
  oracleIntake: {
    status: "APPROVED",
    intendedUser: { value: "Open-source maintainers at a weekend hackathon", source: "USER", updatedAt: "2026-10-31T08:00:02.000Z" },
    problem: { value: "The abandoned CLI reports closed issues and measures age from the wrong date.", source: "USER", updatedAt: "2026-10-31T08:00:02.000Z" },
    desiredOutcome: { value: "A trustworthy local stale-issue report.", source: "USER", updatedAt: "2026-10-31T08:00:02.000Z" },
    deadlineEvent: null,
    mustHaveFeatures: { value: ["Skip closed issues", "Measure the latest activity date"], source: "USER", updatedAt: "2026-10-31T08:00:02.000Z" },
    optionalFeatures: null,
    budget: null,
    privacyRequirements: { value: ["No personal data"], source: "USER", updatedAt: "2026-10-31T08:00:02.000Z" },
    platforms: { value: ["Node 22 CLI"], source: "USER", updatedAt: "2026-10-31T08:00:02.000Z" },
    repositoryCondition: { value: "No repository is connected.", source: "SYSTEM", updatedAt: "2026-10-31T08:00:02.000Z" },
    nonGoals: { value: ["Live GitHub access", "Accounts"], source: "USER", updatedAt: "2026-10-31T08:00:02.000Z" },
    unresolvedQuestions: [],
    assumptions: [],
    knownConstraints: ["No network, accounts, or personal data in the recorded sample."],
    unresolvedRisks: [],
    recommendedNextAction: "Review the approved plan and recorded evidence.",
    updatedAt: "2026-10-31T08:00:02.000Z",
  },
  memory: {
    facts: [{
      id: "memory-demo-fact-1",
      text: "Driftwatch reads one local issues.json export and never calls the network.",
      source: "oracle",
      sourceId: null,
      createdAt: "2026-10-31T08:00:02.000Z",
      status: "ACTIVE",
    }],
    decisions: [{
      id: "memory-demo-decision-1",
      text: "Keep the existing report shape so the revived CLI stays backward compatible.",
      source: "user",
      sourceId: null,
      createdAt: "2026-10-31T08:00:02.000Z",
      status: "ACTIVE",
    }],
    constraints: [{
      id: "memory-demo-constraint-1",
      text: "No network, accounts, or personal data in the first release.",
      source: "user",
      sourceId: null,
      createdAt: "2026-10-31T08:00:02.000Z",
      status: "ACTIVE",
    }],
    risks: [{
      id: "memory-demo-risk-1",
      text: "The sample does not replace a maintainer's judgement about issue priority.",
      source: "witness",
      sourceId: null,
      createdAt: "2026-10-31T08:05:05.000Z",
      status: "ACTIVE",
    }],
    answers: [{
      id: "memory-demo-answer-1",
      text: "Node 22 CLI",
      source: "user",
      sourceId: null,
      createdAt: "2026-10-31T08:00:02.000Z",
      field: "platforms",
      status: "ACTIVE",
    }],
    assumptions: [],
  },
  modelPreferences: {
    access: {
      mode: "ALL_ACCESSIBLE",
      allowedProviders: [],
      allowedModels: [],
      dataPolicy: "PROVIDER_DEFAULT",
      paidOrUnknownAcceptedAt: null,
    },
    budget: { maxCostUsd: null, maxTotalTokens: null, maxRunDurationMs: null },
  },
};

export const demoFixture: DemoFixture = {
  version: DEMO_FIXTURE_VERSION,
  dataMode: DEMO_DATA_MODE,
  sourceLabel: DEMO_SOURCE_LABEL,
  scenario: {
    name: "Driftwatch",
    idea: "I forked an abandoned open-source CLI called Driftwatch. It reads a local issues.json export and lists issues that have gone quiet. The parser works, but it still counts closed issues and measures the wrong date, so the report cannot be trusted. The hackathon deadline is in two days.",
    location: "A maintainer-tooling hackathon",
    originalProblem: "Open-source maintainers cannot see which open issues have gone quiet from a static export without a spreadsheet and guesswork.",
    unfinished: "The copied CLI parsed the export and printed a list, but it counted closed issues and measured age from the creation date instead of the latest activity.",
    revival: "The team kept the local-only scope, fixed the stale rule, and added one behavioural test so the report could be defended.",
    provenance: "Original sample. No real repository, maintainer, sponsor, user, metric, deployment, or competition result is depicted.",
  },
  oracle: {
    clarification: "The Oracle restates the useful outcome, keeps the stale-issue rule visible, and proposes the smallest honest first release.",
    approvedSummary: "A dependency-free Node CLI and behavioural test suite that reads one local issues.json export and reports open issues with no activity for 90 days. No network, accounts, or personal data.",
    resolvedQuestions: [
      "An issue is stale when it is open and its latest activity is older than 90 days.",
      "Closed issues are skipped even when their activity is old.",
      "Labels and priority are left for a later release.",
    ],
  },
  revisions: [
    {
      sectionId: "control",
      fromVersion: 1,
      toVersion: 2,
      summary: "Narrowed the first release to one local export and made closed-issue filtering an acceptance criterion.",
    },
    {
      sectionId: "architecture",
      fromVersion: 1,
      toVersion: 2,
      summary: "Replaced a live GitHub lookup with a plain local JSON file and stable error codes.",
    },
  ],
  makerAuthorization: "Edit only demo-workspace/driftwatch.mjs and demo-workspace/driftwatch.test.mjs. Skip closed issues, measure age from the latest activity date, and add one behavioural test. Do not install packages or touch the Unfinished Business repository.",
  project: demoProject,
  diff: {
    sourceLabel: DEMO_SOURCE_LABEL,
    summary: "One bounded Maker change: skip closed issues, measure age from the latest activity date, and cover the rule with a behavioural test.",
    files: [
      {
        path: "demo-workspace/driftwatch.mjs",
        additions: 3,
        deletions: 3,
        hunks: [
          {
            header: "@@ -18,9 +18,9 @@ export function findStale(issues, options = {}) {",
            lines: [
              { type: " ", text: "  const days = options.days ?? 90;" },
              { type: " ", text: "  const now = Date.parse(options.now ?? new Date().toISOString());" },
              { type: " ", text: "  return issues" },
              { type: "-", text: "    .filter((issue) => now - Date.parse(issue.createdAt) > days * 86_400_000)" },
              { type: "+", text: "    .filter((issue) => issue.state === \"open\")" },
              { type: "+", text: "    .filter((issue) => now - Date.parse(issue.updatedAt) > days * 86_400_000)" },
              { type: " ", text: "    .map((issue) => ({" },
              { type: " ", text: "      number: issue.number," },
              { type: " ", text: "      title: issue.title," },
              { type: "-", text: "      staleDays: Math.floor((now - Date.parse(issue.createdAt)) / 86_400_000)," },
              { type: "+", text: "      staleDays: Math.floor((now - Date.parse(issue.updatedAt)) / 86_400_000)," },
              { type: " ", text: "    }));" },
              { type: " ", text: "}" },
            ],
          },
        ],
      },
      {
        path: "demo-workspace/driftwatch.test.mjs",
        additions: 10,
        deletions: 0,
        hunks: [
          {
            header: "@@ -24,6 +24,16 @@ test(\"reports open issues older than the window\", () => {",
            lines: [
              { type: " ", text: "  assert.deepEqual(report.map((issue) => issue.number), [3]);" },
              { type: "+", text: "});" },
              { type: "+", text: "" },
              { type: "+", text: "test(\"skips closed issues and measures the latest activity\", () => {" },
              { type: "+", text: "  const issues = [" },
              { type: "+", text: "    { number: 1, title: \"Closed but old\", state: \"closed\", updatedAt: \"2026-01-01T00:00:00.000Z\" }," },
              { type: "+", text: "    { number: 2, title: \"Open and active\", state: \"open\", updatedAt: \"2026-10-20T00:00:00.000Z\" }," },
              { type: "+", text: "    { number: 3, title: \"Open and quiet\", state: \"open\", updatedAt: \"2026-06-01T00:00:00.000Z\" }," },
              { type: "+", text: "  ];" },
              { type: "+", text: "  assert.deepEqual(findStale(issues, { now: \"2026-11-01T00:00:00.000Z\" }), [" },
              { type: "+", text: "    { number: 3, title: \"Open and quiet\", staleDays: 153 }," },
              { type: "+", text: "  ]);" },
            ],
          },
        ],
      },
    ],
  },
  verification: {
    sourceLabel: DEMO_SOURCE_LABEL,
    command: "node --test demo-workspace/driftwatch.test.mjs",
    result: "PASS",
    summary: "4 tests passed, 0 failed. Closed issues are skipped and the age uses the latest activity date.",
    output: [
      "✔ parses a local issues export",
      "✔ reports open issues older than the window",
      "✔ skips closed issues and measures the latest activity",
      "✔ keeps a stable report shape",
      "ℹ tests 4",
      "ℹ pass 4",
      "ℹ fail 0",
    ],
    testedFingerprint: "sha256:6f3c1d9b5a7e248c0d1f3a6b9c2e5d8f1a4b7c0d3e6f9a2b5c8d1e4f7a0b3c6d",
    observedAt: "2026-10-31T08:04:04.000Z",
    limitation: "The command ran against the recorded sample workspace. It does not prove a live model session, the visitor's repository, or a deployment.",
  },
  witness: {
    findings: [
      { kind: "PASS", text: "The stale rule uses the latest activity date and skips closed issues; a behavioural test covers both." },
      { kind: "LIMIT", text: "The diff and test output are recorded sample evidence, not a live OpenCode session." },
      { kind: "LIMIT", text: "No deployment, real repository, maintainer data, or competition result is included." },
      { kind: "READY", text: "The sample is ready to explain the workflow and the evidence boundary." },
    ],
    readiness: "Sample evidence is complete for this example. A real submission still needs a live native session, repository link, article or video, and event entry.",
    nextActions: [
      "Run the same project locally with OpenCode.",
      "Replace the sample diff and check with a native session result.",
      "Record the guided presentation path.",
      "Prepare the article, video, and event entry separately.",
    ],
  },
  beats: [
    {
      id: "problem",
      stage: "ORACLE",
      spirit: "oracle",
      state: "listening",
      title: "The repo that went quiet",
      summary: "Driftwatch is an abandoned open-source CLI. The parser works, but the report still counts closed issues and measures the wrong date.",
      detail: "The sample starts with the unfinished project, before any plan or code is approved.",
      callout: "Problem: an unfinished project is not a product decision. The Oracle starts by clarifying what should be finished.",
      focus: "idea",
      operationIds: [],
      evidenceIds: [],
    },
    {
      id: "oracle",
      stage: "ORACLE",
      spirit: "oracle",
      state: "clarification",
      title: "Oracle names the smallest useful fix",
      summary: "One local issues.json export, a 90-day window, closed issues skipped, and age measured from the latest activity date.",
      detail: "The proposal and open questions sit together. The maintainer approves the product explicitly.",
      callout: "Oracle proposes; you approve. A question, a recommendation, or a reconnect is not approval.",
      focus: "product",
      operationIds: ["op-demo-oracle"],
      evidenceIds: [],
      operationStatus: { "op-demo-oracle": "SUCCEEDED" },
    },
    {
      id: "architect",
      stage: "ARCHITECT",
      spirit: "architect",
      state: "drawing",
      title: "Architect drafts one section at a time",
      summary: "Section 1 is revised from v1 to v2 after the scope narrows to one export and one stale rule.",
      detail: "The old approval becomes stale. The next section waits until the current exact version is approved.",
      callout: "Approval targets one exact version and hash. A revision supersedes the old approval.",
      focus: "section",
      sectionId: "control",
      operationIds: ["op-demo-architect"],
      evidenceIds: [],
      operationStatus: { "op-demo-architect": "RUNNING" },
    },
    {
      id: "approval",
      stage: "ARCHITECT",
      spirit: "architect",
      state: "approval",
      title: "Approve the exact current version",
      summary: "All eight sections are approved before Maker can receive work.",
      detail: "The plan outline shows the approved blocks; the current section is no longer waiting.",
      callout: "The next section is withheld until this one is approved. The seal is tied to this version, not the title.",
      focus: "approval",
      sectionId: "control",
      operationIds: ["op-demo-architect"],
      evidenceIds: [],
      operationStatus: { "op-demo-architect": "SUCCEEDED" },
    },
    {
      id: "scope",
      stage: "MAKER",
      spirit: "maker",
      state: "idle",
      title: "Grant a separate Maker scope",
      summary: "Plan approval is not execution permission.",
      detail: "Maker receives a bounded statement: two files, one stale rule, one behavioural test, no installs.",
      callout: "Permission: the workflow scope constrains the work. OpenCode still owns the native tool decision.",
      focus: "scope",
      operationIds: ["op-demo-scope"],
      evidenceIds: [],
      operationStatus: { "op-demo-scope": "SUCCEEDED" },
    },
    {
      id: "run",
      stage: "MAKER",
      spirit: "maker",
      state: "building",
      title: "Maker applies one bounded change",
      summary: "The recorded run moves from queued to running to succeeded.",
      detail: "The sample replays a recorded run. It does not start an OpenCode session or spend model quota.",
      callout: "Run progress is recorded as an operation. Pause here to inspect the Maker tab, then resume.",
      focus: "run",
      operationIds: ["op-demo-maker"],
      evidenceIds: [],
      operationStatus: { "op-demo-maker": "RUNNING" },
    },
    {
      id: "diff",
      stage: "MAKER",
      spirit: "maker",
      state: "success",
      title: "Inspect the representative diff",
      summary: "Two files changed: the stale rule and the behavioural test.",
      detail: "The diff is recorded sample evidence with a visible source label. It is not a claim about the visitor's repository.",
      callout: "Evidence: a diff is inspectable, but the source label must stay visible. A sample diff is not a live run.",
      focus: "diff",
      operationIds: ["op-demo-maker"],
      evidenceIds: [],
      operationStatus: { "op-demo-maker": "SUCCEEDED" },
    },
    {
      id: "check",
      stage: "MAKER",
      spirit: "maker",
      state: "success",
      title: "Run the recorded check",
      summary: "The bounded Node test records 4 passed, 0 failed.",
      detail: "The check is recorded only after a result exists. The live session is still marked not run.",
      callout: "Verification: a passing sample check stays labeled. It does not become a live native result.",
      focus: "check",
      operationIds: ["op-demo-maker", "op-demo-check"],
      evidenceIds: ["ev-demo-check", "ev-demo-live"],
      operationStatus: { "op-demo-maker": "SUCCEEDED", "op-demo-check": "SUCCEEDED" },
      evidenceResult: { "ev-demo-check": "PASS", "ev-demo-live": "NOT_RUN" },
    },
    {
      id: "witness",
      stage: "WITNESS",
      spirit: "witness",
      state: "evidence",
      title: "Witness reviews the evidence",
      summary: "One pass, two limitations, and a clear readiness statement.",
      detail: "Witness separates what the sample proves from what a real submission still needs.",
      callout: "Evidence: a fresh review keeps pass, limitation, and missing proof separate. A draft is not a submitted article.",
      focus: "evidence",
      operationIds: ["op-demo-witness"],
      evidenceIds: ["ev-demo-check", "ev-demo-live"],
      operationStatus: { "op-demo-witness": "SUCCEEDED" },
      evidenceResult: { "ev-demo-check": "PASS", "ev-demo-live": "NOT_RUN" },
    },
    {
      id: "next",
      stage: "WITNESS",
      spirit: "witness",
      state: "stamp",
      title: "Choose the next honest step",
      summary: "Run the same project locally with OpenCode, or start with local setup.",
      detail: "The sample ends with a clean exit. Reset only resets this sample; it never touches a live project or OpenCode session.",
      callout: "Recovery: pause, step, replay, or reset at any time. Reset affects only the sample.",
      focus: "readiness",
      operationIds: ["op-demo-witness"],
      evidenceIds: ["ev-demo-check", "ev-demo-live"],
      operationStatus: { "op-demo-witness": "SUCCEEDED" },
      evidenceResult: { "ev-demo-check": "PASS", "ev-demo-live": "NOT_RUN" },
    },
  ],
};

export interface DemoExport {
  plan: string | null;
  unresolved: string[];
  drafts: Array<{ title: string; content: string }>;
  engine: Project["engine"];
  limitation: string;
}

export const demoExport: DemoExport = {
  plan: demoFixture.project.sections
    .map((section) => `## ${section.title}\n\n${section.content}`)
    .join("\n\n"),
  unresolved: [],
  drafts: demoFixture.project.witnessDrafts.map((draft) => ({ title: draft.title, content: draft.content })),
  engine: demoFixture.project.engine,
  limitation: "Recorded sample data. No repository, OpenCode run, provider call, or secret is connected.",
};

function beatById(id: string): DemoBeat {
  const beat = demoFixture.beats.find((candidate) => candidate.id === id);
  if (!beat) throw new Error(`Missing demo beat: ${id}`);
  return beat;
}

/**
 * Landing preview steps. They are derived from the same fixture as the guided
 * demo so the sample name, plan, change, check, and live-proof status cannot
 * drift between pages.
 */
export const demoPreviewSteps: readonly DemoPreviewStep[] = [
  {
    id: "preview-idea",
    stage: "ORACLE",
    spirit: "oracle",
    state: "listening",
    title: "Clarify the idea",
    summary: demoFixture.scenario.originalProblem,
    detail: beatById("problem").detail,
    lines: [
      `Project: ${demoFixture.scenario.name}, an abandoned open-source CLI.`,
      `Unfinished: ${demoFixture.scenario.unfinished}`,
      "Status: proposed — waiting for your approval.",
    ],
  },
  {
    id: "preview-plan",
    stage: "ARCHITECT",
    spirit: "architect",
    state: "approval",
    title: "Approve the plan",
    summary: "Eight sections are approved one exact version at a time, with dependencies visible.",
    detail: beatById("approval").detail,
    lines: [
      `Plan: ${demoFixture.project.sections.length} sections, each approved by exact version.`,
      `Revision: ${demoFixture.revisions[0].sectionId} v${demoFixture.revisions[0].fromVersion} → v${demoFixture.revisions[0].toVersion}.`,
      `Approved: ${demoFixture.project.approvals.length} of ${demoFixture.project.sections.length} sections.`,
    ],
  },
  {
    id: "preview-build",
    stage: "MAKER",
    spirit: "maker",
    state: "success",
    title: "Build with OpenCode",
    summary: demoFixture.diff.summary,
    detail: beatById("diff").detail,
    lines: [
      `Scope: ${demoFixture.diff.files.length} files in the isolated demo workspace.`,
      `Change: ${demoFixture.diff.files.map((file) => file.path).join(", ")}.`,
      "Permission: OpenCode decides; the workshop records what it observed.",
    ],
  },
  {
    id: "preview-evidence",
    stage: "WITNESS",
    spirit: "witness",
    state: "evidence",
    title: "Verify the result",
    summary: `Recorded check: ${demoFixture.verification.result === "PASS" ? "passed" : "failed"}. ${demoFixture.witness.readiness}`,
    detail: beatById("witness").detail,
    lines: [
      `Check: ${demoFixture.verification.command}.`,
      `Sample: ${demoFixture.verification.summary}`,
      `Live session: ${(demoFixture.project.evidence.find((item) => item.id === "ev-demo-live")?.result ?? "NOT_RUN") === "NOT_RUN" ? "not run" : demoFixture.project.evidence.find((item) => item.id === "ev-demo-live")?.result} — run locally for a native result.`,
    ],
  },
];

export function sectionForBeat(beat: DemoBeat): Project["sections"][number] | null {
  if (!beat.sectionId) return null;
  return demoFixture.project.sections.find((section) => section.id === beat.sectionId) ?? null;
}

export function operationsForBeat(beat: DemoBeat): Operation[] {
  const operations = demoFixture.project.operations.filter((operation) => beat.operationIds.includes(operation.id));
  return operations.map((operation) => ({
    ...operation,
    status: beat.operationStatus?.[operation.id] ?? operation.status,
  }));
}

export function evidenceForBeat(beat: DemoBeat): Evidence[] {
  const evidence = demoFixture.project.evidence.filter((item) => beat.evidenceIds.includes(item.id));
  return evidence.map((item) => ({
    ...item,
    result: beat.evidenceResult?.[item.id] ?? item.result,
  }));
}

export function demoStageIndex(stage: DemoBeat["stage"]): number {
  return ["ORACLE", "ARCHITECT", "MAKER", "WITNESS"].indexOf(stage);
}
