export const spiritIds = ["oracle", "architect", "maker", "witness"] as const;

export type SpiritId = (typeof spiritIds)[number];

export interface SpiritStateDefinition {
  id: string;
  label: string;
  description: string;
}

export interface SpiritProfile {
  id: SpiritId;
  stage: "ORACLE" | "ARCHITECT" | "MAKER" | "WITNESS";
  name: string;
  form: string;
  role: string;
  summary: string;
  work: string;
  states: readonly SpiritStateDefinition[];
}

export const spiritProfiles: readonly SpiritProfile[] = [
  {
    id: "oracle",
    stage: "ORACLE",
    name: "Oracle",
    form: "Lantern orb seer",
    role: "Clarify the idea",
    summary: "Turns a vague or unfinished idea into a plain-language product proposal and the questions that still matter.",
    work: "Listens without pretending the proposal is approval. You approve the product scope explicitly.",
    states: [
      { id: "idle", label: "Waiting", description: "A dim lantern keeps the workbench warm." },
      { id: "listening", label: "Listening", description: "Rings shimmer while your idea is being read." },
      { id: "clarification", label: "Clarifying", description: "Open questions stay visible instead of being guessed away." },
    ],
  },
  {
    id: "architect",
    stage: "ARCHITECT",
    name: "Architect",
    form: "Blueprint compass spirit",
    role: "Draw the plan",
    summary: "Drafts one planning section at a time, shows its dependencies, and waits for approval of that exact version.",
    work: "A revision supersedes the old approval. Stale sections are marked, never silently blessed.",
    states: [
      { id: "idle", label: "Waiting", description: "The compass rests over an unopened blueprint." },
      { id: "drawing", label: "Drawing", description: "Drafting lines extend while a section is written." },
      { id: "approval", label: "Approved", description: "The blueprint settles under a wax-seal glow." },
    ],
  },
  {
    id: "maker",
    stage: "MAKER",
    name: "Maker",
    form: "Mechanical workshop ghost",
    role: "Build the approved unit",
    summary: "Uses OpenCode's native tools inside a separate, explicit scope and reports what actually happened.",
    work: "App approvals cannot override an OpenCode permission denial. Failures stay visible.",
    states: [
      { id: "idle", label: "Ready", description: "The tool belt is clipped and the visor is low." },
      { id: "building", label: "Building", description: "Sparks mark an active native edit." },
      { id: "permission", label: "Permission", description: "A raised hand waits for a native permission decision." },
      { id: "blocked", label: "Blocked", description: "A shield shows that the requested action was refused." },
      { id: "success", label: "Success", description: "The visor lifts only after an observed result." },
    ],
  },
  {
    id: "witness",
    stage: "WITNESS",
    name: "Witness",
    form: "Archival moth with a lens eye",
    role: "Inspect and record",
    summary: "Reviews evidence in a fresh session, marks limitations, and prepares drafts without calling them submitted.",
    work: "A check is evidence only when its native result is present. A missing result is an empty state.",
    states: [
      { id: "idle", label: "Waiting", description: "Wings fold over an unread ledger." },
      { id: "scanning", label: "Scanning", description: "A lens line passes over the recorded evidence." },
      { id: "evidence", label: "Evidence", description: "A document impression marks an observed result." },
      { id: "warning", label: "Warning", description: "An amber pulse marks a failed or inconclusive check." },
      { id: "stamp", label: "Stamped", description: "A review is filed, not published." },
    ],
  },
] as const;

export function spiritProfile(id: SpiritId): SpiritProfile {
  return spiritProfiles.find((profile) => profile.id === id) ?? spiritProfiles[0];
}

export function stageSpirit(stage: SpiritProfile["stage"]): SpiritProfile {
  return spiritProfiles.find((profile) => profile.stage === stage) ?? spiritProfiles[0];
}

export function defaultStateFor(id: SpiritId): string {
  if (id === "oracle") return "idle";
  if (id === "architect") return "idle";
  if (id === "maker") return "idle";
  return "idle";
}

export function stateLabel(id: SpiritId, state: string): string {
  return spiritProfile(id).states.find((item) => item.id === state)?.label ?? state;
}
