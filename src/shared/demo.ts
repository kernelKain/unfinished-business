import type { Evidence, Operation, Project } from "./workflow.ts";

/**
 * Versioned deterministic fixture for the public guided example.
 *
 * This module is browser-safe and contains no network, filesystem, provider,
 * or OpenCode imports. The production project schema validates it in
 * `tests/demo.test.ts`; a contract change therefore fails the demo test rather
 * than silently drifting from the live workshop.
 */

export const DEMO_FIXTURE_VERSION = "campus-umbrella-relay@1";
export const DEMO_DATA_MODE = "demo" as const;
export const DEMO_SOURCE_LABEL = "Prerecorded demo fixture — not a live OpenCode session";

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

export interface DemoFixture {
  version: string;
  dataMode: typeof DEMO_DATA_MODE;
  sourceLabel: string;
  scenario: {
    name: string;
    idea: string;
    location: string;
    provenance: string;
  };
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

const sectionContent = {
  control: [
    "## Goal",
    "Build a small campus umbrella relay that lets a student post a found umbrella, claim it with a short proof phrase, and mark it returned.",
    "",
    "## Scope",
    "One umbrella pool, one campus pickup point, and no accounts in this example.",
    "",
    "## Acceptance",
    "- A found umbrella can be posted.",
    "- A second claim is rejected.",
    "- A returned umbrella cannot be claimed again.",
    "- The bounded check passes.",
  ].join("\n"),
  architecture: [
    "## Module",
    "`relay.mjs` exports `postUmbrella`, `claimUmbrella`, and `returnUmbrella` over a plain in-memory state object.",
    "",
    "## Contract",
    "A claim needs an umbrella id and a short claim code. Unknown, returned, and already-claimed umbrellas return stable error codes.",
    "",
    "## Boundary",
    "No network, database, account, or personal data. The test suite uses the Node built-in test runner.",
  ].join("\n"),
  experience: [
    "## Student flow",
    "Post a found umbrella with a pickup point. Claim it with the proof phrase. Mark it returned at the desk.",
    "",
    "## Failure states",
    "A duplicate claim is rejected with `ALREADY_CLAIMED`; a returned umbrella returns `ALREADY_RETURNED`.",
    "",
    "## Demo surface",
    "The guided example shows the same four-stage workshop states without calling a model.",
  ].join("\n"),
  tools: [
    "## Tools",
    "Node 22 built-in test runner and a dependency-free module. No package install, network, or shell beyond the bounded check.",
    "",
    "## Cost",
    "No provider account or model quota is used by the example. The live workshop follows the OpenCode catalog and its own account limits.",
  ].join("\n"),
  verification: [
    "## Bounded check",
    "`node --test demo-workspace/relay.test.mjs` covers posting, duplicate claims, and returns.",
    "",
    "## Evidence rule",
    "A passing check is recorded only when its result is observed. Fixture evidence is labeled separately from a live native result.",
    "",
    "## Risks",
    "The example is not a production lost-and-found service and does not handle disputes, accounts, or notifications.",
  ].join("\n"),
  phases: [
    "## One bounded unit",
    "Add the duplicate-claim and returned-item guards, then add one behavioural test.",
    "",
    "## Queue",
    "No package installs, deployment, or extra scope. Witness reviews the recorded diff and check next.",
  ].join("\n"),
  delivery: [
    "## Delivery",
    "A local Node module and test file in the demo workspace. No hosted service, deployment, or submission is included.",
    "",
    "## Honest limit",
    "The example is a deterministic walkthrough. A real submission needs a live OpenCode run, repository link, article or video, and event entry.",
  ].join("\n"),
  readiness: [
    "## Execution directive",
    "Maker may edit only `demo-workspace/relay.mjs` and `demo-workspace/relay.test.mjs`. No network, installs, or repository changes outside that workspace.",
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
  control: "12e97d04da4f91e7768fcf819529fae61b961bcd69784c6c415eebbd59afd24b",
  architecture: "189de8ac5d254136b4d9ced10a0d885a7c9c26bd19494dd654df1bcd37598fec",
  experience: "5cb4cbac015078eed1825befc0f6f5ef5b0ab99ee2d37c5ce112afdb96272dcc",
  tools: "e2c6de5ada370cbdcb862925a25678d34350bafafffe86a10daa90359ebad874",
  verification: "5e802a33ee96394e3b2764dae55e8af8a90891dc560a9fb54c8ef267f3de3c27",
  phases: "7dc9995c7e163ee084e7037adf74163c13be14432b15e242d51aaa8bee7a18b8",
  delivery: "8194b38f898b845e2ed55c8dee2d798e5a19d89bd6ae54f99c473b83dd99f3ee",
  readiness: "6be8fc3b0d668ab6060d22ceebd839a79e43a44083d4f40deeb459d3851a4224",
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
    result: "Demo fixture: Oracle proposal stored. It is not approved.",
    model: null,
    agent: "oracle",
    startedAt: "2026-10-31T08:00:00.000Z",
    finishedAt: "2026-10-31T08:00:02.000Z",
    statusReason: null,
    lastObservedAt: "2026-10-31T08:00:02.000Z",
    appliedAt: "2026-10-31T08:00:02.000Z",
    providerError: null,
  },
  {
    id: "op-demo-architect",
    kind: "guide",
    payloadHash: "demo-payload-architect",
    nativeSessionId: "demo_ses_architect_01",
    nativeMessageId: null,
    status: "SUCCEEDED",
    result: "Demo fixture: section 1 revised to v2 and the exact version was approved.",
    model: null,
    agent: "architect",
    startedAt: "2026-10-31T08:01:00.000Z",
    finishedAt: "2026-10-31T08:01:03.000Z",
    statusReason: null,
    lastObservedAt: "2026-10-31T08:01:03.000Z",
    appliedAt: "2026-10-31T08:01:03.000Z",
    providerError: null,
  },
  {
    id: "op-demo-scope",
    kind: "guide",
    payloadHash: "demo-payload-scope",
    nativeSessionId: "demo_ses_scope_01",
    nativeMessageId: null,
    status: "SUCCEEDED",
    result: "Demo fixture: separate Maker scope granted after all eight sections were approved.",
    model: null,
    agent: null,
    startedAt: "2026-10-31T08:02:00.000Z",
    finishedAt: "2026-10-31T08:02:01.000Z",
    statusReason: null,
    lastObservedAt: "2026-10-31T08:02:01.000Z",
    appliedAt: "2026-10-31T08:02:01.000Z",
    providerError: null,
  },
  {
    id: "op-demo-maker",
    kind: "maker",
    payloadHash: "demo-payload-maker",
    nativeSessionId: "demo_ses_maker_01",
    nativeMessageId: "demo_msg_maker_01",
    status: "SUCCEEDED",
    result: "Demo fixture: duplicate-claim and returned-item guards added in the isolated demo workspace.",
    model: null,
    agent: "maker",
    startedAt: "2026-10-31T08:03:00.000Z",
    finishedAt: "2026-10-31T08:03:09.000Z",
    statusReason: null,
    lastObservedAt: "2026-10-31T08:03:09.000Z",
    appliedAt: "2026-10-31T08:03:09.000Z",
    providerError: null,
  },
  {
    id: "op-demo-check",
    kind: "check",
    payloadHash: "demo-payload-check",
    nativeSessionId: "demo_ses_check_01",
    nativeMessageId: null,
    status: "SUCCEEDED",
    result: "Demo fixture: node --test demo-workspace/relay.test.mjs recorded 3 passed, 0 failed.",
    model: null,
    agent: "maker",
    startedAt: "2026-10-31T08:04:00.000Z",
    finishedAt: "2026-10-31T08:04:04.000Z",
    statusReason: null,
    lastObservedAt: "2026-10-31T08:04:04.000Z",
    appliedAt: "2026-10-31T08:04:04.000Z",
    providerError: null,
  },
  {
    id: "op-demo-witness",
    kind: "witness",
    payloadHash: "demo-payload-witness",
    nativeSessionId: "demo_ses_witness_01",
    nativeMessageId: null,
    status: "SUCCEEDED",
    result: "Demo fixture: Witness recorded one pass, two limitations, and the next action.",
    model: null,
    agent: "witness",
    startedAt: "2026-10-31T08:05:00.000Z",
    finishedAt: "2026-10-31T08:05:05.000Z",
    statusReason: null,
    lastObservedAt: "2026-10-31T08:05:05.000Z",
    appliedAt: "2026-10-31T08:05:05.000Z",
    providerError: null,
  },
];

const demoEvidence: Evidence[] = [
  {
    id: "ev-demo-check",
    checkId: "node-test-bounded",
    nativeResultReference: "demo://relay/check/node-test",
    testedFingerprint: "sha256:9a0f7f3f4b6a1e9a1c2b3d4e5f60718293a4b5c6d7e8f90123456789abcdef01",
    result: "PASS",
    observedAt: "2026-10-31T08:04:04.000Z",
    limitation: "Prerecorded fixture evidence. It is not a live OpenCode session and does not prove the visitor's repository.",
    model: null,
  },
  {
    id: "ev-demo-live",
    checkId: "live-native-session",
    nativeResultReference: "demo://not-run",
    testedFingerprint: "not-run",
    result: "NOT_RUN",
    observedAt: "2026-10-31T08:05:05.000Z",
    limitation: "No live OpenCode session is connected in this demo. Run locally to replace fixture evidence with a native result.",
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
    observedOutcome: "Demo fixture: the representative diff is labeled as prerecorded evidence.",
  },
  {
    id: "node-check",
    purpose: "Run the approved dependency-free Node test",
    nativeMapping: "bounded node --test in the isolated demo workspace",
    availability: "available",
    permission: "Runs only after an explicit Maker scope grant and a native edit",
    observedOutcome: "Demo fixture: 3 passed, 0 failed. This is not a live result.",
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
  schemaVersion: 4,
  id: "demo-campus-umbrella-relay",
  revision: 14,
  mode: "hosted-demo",
  demoWorkspace: true,
  createdAt: "2026-10-31T07:55:00.000Z",
  updatedAt: "2026-10-31T08:05:30.000Z",
  workspace: "demo://campus-umbrella-relay",
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
  nextAction: "Review the Witness drafts and decide whether to run the example locally",
  product: {
    status: "APPROVED",
    proposal: "Build a small campus umbrella relay: post a found umbrella, claim it with a short proof phrase, reject duplicate claims, and mark it returned.",
    openQuestions: [],
  },
  makerScope: {
    status: "GRANTED",
    statement: "Edit only demo-workspace/relay.mjs and demo-workspace/relay.test.mjs. Add a duplicate-claim guard and one behavioural test. Do not install packages or touch the Unfinished Business repository.",
  },
  transcript: [
    {
      id: "demo-note-1",
      spirit: "system",
      text: "Demo fixture: no OpenCode session, provider call, or repository access is connected.",
      createdAt: "2026-10-31T08:00:00.000Z",
    },
    {
      id: "demo-note-2",
      spirit: "oracle",
      text: "The useful outcome is a trustworthy claim flow, not a full campus service.",
      createdAt: "2026-10-31T08:00:02.000Z",
    },
    {
      id: "demo-note-3",
      spirit: "architect",
      text: "Section 1 narrowed to one umbrella pool and a duplicate-claim acceptance criterion.",
      createdAt: "2026-10-31T08:01:03.000Z",
    },
    {
      id: "demo-note-4",
      spirit: "maker",
      text: "Demo fixture: the bounded edit added guards and one behavioural test.",
      createdAt: "2026-10-31T08:03:09.000Z",
    },
    {
      id: "demo-note-5",
      spirit: "witness",
      text: "The check passes in the fixture. The live session is not run, so that limitation stays visible.",
      createdAt: "2026-10-31T08:05:05.000Z",
    },
  ],
  capabilities: demoCapabilities,
  witnessDrafts: [
    {
      id: "draft-demo-readiness",
      title: "Submission readiness",
      content: "The example has an approved plan, a bounded Maker change, a representative diff, a recorded check, and a Witness review. It is ready to explain the workflow. It is not a submitted hackathon entry.",
      nativeSessionId: "demo_ses_witness_01",
      createdAt: "2026-10-31T08:05:10.000Z",
    },
    {
      id: "draft-demo-next",
      title: "Next actions",
      content: "Run the example locally with OpenCode, replace fixture evidence with a native session, record the 90-second path, then prepare the article, video, and event entry.",
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
  source: { kind: "demo", label: "Campus Umbrella Relay", externalId: DEMO_FIXTURE_VERSION, importedAt: null },
  oracleIntake: {
    status: "APPROVED",
    summary: "Build a small campus umbrella relay with guarded claim and return flows.",
    questions: [],
    constraints: ["No accounts, network, or personal data in the deterministic example."],
    successCriteria: ["Reject duplicate claims.", "Do not allow returned umbrellas to be claimed."],
    updatedAt: "2026-10-31T08:00:02.000Z",
  },
  memory: { facts: [], decisions: [], constraints: [], risks: [] },
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
    name: "Campus Umbrella Relay",
    idea: "Our campus lost-and-found is a group chat. Umbrellas get claimed twice, and returned umbrellas disappear. I started a Node module but stopped before the claim check.",
    location: "A small campus lost-and-found desk",
    provenance: "Original scenario aligned with the repository's existing campus lost-and-found demo fixture. No real campus, sponsor, user, metric, deployment, or competition result is depicted.",
  },
  oracle: {
    clarification: "The Oracle restates the useful outcome, keeps the unresolved claim rules visible, and proposes the smallest honest first release.",
    approvedSummary: "A dependency-free Node module and behavioural test suite for posting, claiming, and returning umbrellas. One umbrella pool, one pickup point, no accounts, no network, no personal data.",
    resolvedQuestions: [
      "The first valid claim wins; a second claim is rejected.",
      "A returned umbrella cannot be claimed again.",
      "Staff can release a stale claim outside this first release.",
    ],
  },
  revisions: [
    {
      sectionId: "control",
      fromVersion: 1,
      toVersion: 2,
      summary: "Narrowed the first release to one umbrella pool and made duplicate-claim prevention an acceptance criterion.",
    },
    {
      sectionId: "architecture",
      fromVersion: 1,
      toVersion: 2,
      summary: "Replaced student accounts with a short claim code and stable error codes.",
    },
  ],
  makerAuthorization: "Edit only demo-workspace/relay.mjs and demo-workspace/relay.test.mjs. Add a duplicate-claim guard and one behavioural test. Do not install packages or touch the Unfinished Business repository.",
  project: demoProject,
  diff: {
    sourceLabel: DEMO_SOURCE_LABEL,
    summary: "One bounded Maker change: guard duplicate and returned claims, then cover the guard with a behavioural test.",
    files: [
      {
        path: "demo-workspace/relay.mjs",
        additions: 12,
        deletions: 2,
        hunks: [
          {
            header: "@@ -12,7 +12,17 @@ export function claimUmbrella(state, umbrellaId, claimCode) {",
            lines: [
              { type: " ", text: "  const umbrella = state.umbrellas.find((item) => item.id === umbrellaId);" },
              { type: "-", text: "  umbrella.claimedBy = claimCode;" },
              { type: "-", text: "  return umbrella;" },
              { type: "+", text: "  if (!umbrella) throw new Error(\"UMBRELLA_NOT_FOUND\");" },
              { type: "+", text: "  if (umbrella.status === \"returned\") throw new Error(\"ALREADY_RETURNED\");" },
              { type: "+", text: "  if (umbrella.claimedBy) throw new Error(\"ALREADY_CLAIMED\");" },
              { type: "+", text: "  umbrella.claimedBy = claimCode;" },
              { type: "+", text: "  umbrella.status = \"claimed\";" },
              { type: "+", text: "  return umbrella;" },
            ],
          },
        ],
      },
      {
        path: "demo-workspace/relay.test.mjs",
        additions: 9,
        deletions: 0,
        hunks: [
          {
            header: "@@ -18,6 +18,15 @@ test(\"posts and claims an umbrella\", () => {",
            lines: [
              { type: " ", text: "  assert.equal(claimed.claimedBy, \"blue-umbrella\");" },
              { type: "+", text: "});" },
              { type: "+", text: "" },
              { type: "+", text: "test(\"rejects a duplicate claim\", () => {" },
              { type: "+", text: "  assert.throws(" },
              { type: "+", text: "    () => claimUmbrella(state, \"umb-1\", \"second-claim\")," },
              { type: "+", text: "    /ALREADY_CLAIMED/," },
              { type: "+", text: "  );" },
            ],
          },
        ],
      },
    ],
  },
  verification: {
    sourceLabel: DEMO_SOURCE_LABEL,
    command: "node --test demo-workspace/relay.test.mjs",
    result: "PASS",
    summary: "3 tests passed, 0 failed. The duplicate-claim guard is covered by a behavioural test.",
    output: [
      "✔ posts a found umbrella",
      "✔ rejects a duplicate claim",
      "✔ returns a claimed umbrella",
      "ℹ tests 3",
      "ℹ pass 3",
      "ℹ fail 0",
    ],
    testedFingerprint: "sha256:9a0f7f3f4b6a1e9a1c2b3d4e5f60718293a4b5c6d7e8f90123456789abcdef01",
    observedAt: "2026-10-31T08:04:04.000Z",
    limitation: "The command ran against the prerecorded demo fixture workspace. It does not prove a live model session, the visitor's repository, or a deployment.",
  },
  witness: {
    findings: [
      { kind: "PASS", text: "The duplicate-claim guard is covered by a behavioural test in the fixture." },
      { kind: "LIMIT", text: "The diff and test output are prerecorded fixture evidence, not a live OpenCode session." },
      { kind: "LIMIT", text: "No deployment, user account, real campus data, or competition result is included." },
      { kind: "READY", text: "The example is ready to explain the workflow and the evidence boundary." },
    ],
    readiness: "Fixture evidence is complete for the example. A real submission still needs a live native session, repository link, article or video, and event entry.",
    nextActions: [
      "Run the same journey locally with OpenCode.",
      "Replace the fixture diff and check with a native session result.",
      "Record the 90-second presentation path.",
      "Prepare the article, video, and event entry separately.",
    ],
  },
  beats: [
    {
      id: "problem",
      stage: "ORACLE",
      spirit: "oracle",
      state: "listening",
      title: "The umbrella that never came back",
      summary: "A campus lost-and-found lives in a group chat. The idea is real, but the claim rules are unfinished.",
      detail: "The visitor sees the problem before any plan or code. Nothing is approved yet.",
      callout: "Problem: an unfinished idea is not a product decision. The Oracle starts by clarifying, not approving.",
      focus: "idea",
      operationIds: [],
      evidenceIds: [],
    },
    {
      id: "oracle",
      stage: "ORACLE",
      spirit: "oracle",
      state: "clarification",
      title: "Oracle clarifies the smallest useful product",
      summary: "One umbrella pool, one pickup point, a short claim code, and a duplicate-claim guard.",
      detail: "The proposal and open questions sit together. The visitor approves the product explicitly.",
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
      summary: "Section 1 is revised from v1 to v2 after the scope narrows.",
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
      detail: "Maker receives a bounded statement: two files, one guard, one behavioural test, no installs.",
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
      summary: "The representative run moves from queued to running to succeeded.",
      detail: "The demo replays a prerecorded run. It does not start an OpenCode session or spend model quota.",
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
      summary: "Two files changed: the guard and the behavioural test.",
      detail: "The diff is fixture evidence with a visible source label. It is not a claim about the visitor's repository.",
      callout: "Evidence: a diff is inspectable, but the source label must stay visible. A fixture diff is not a live run.",
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
      title: "Run the deterministic check",
      summary: "The bounded Node test records 3 passed, 0 failed.",
      detail: "The check is recorded only after a result exists. The live session is still marked not run.",
      callout: "Verification: a passing fixture check stays labeled. It does not become a live native result.",
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
      detail: "Witness separates what the fixture proves from what a real submission still needs.",
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
      summary: "Run live with OpenCode, or start with local setup.",
      detail: "The example ends with a clean exit. Reset only resets this fixture; it never touches a live project or OpenCode session.",
      callout: "Recovery: pause, step, replay, or reset at any time. Reset affects only the demo fixture.",
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
  limitation: "Deterministic demo data. No repository, OpenCode run, provider call, or secret is connected.",
};

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
