export const runtimeModes = ["local", "demo", "private-hosted"] as const;

export type RuntimeMode = (typeof runtimeModes)[number];

export type CapabilityId =
  | "repository"
  | "opencode"
  | "persistence"
  | "providers"
  | "workspace"
  | "mutations"
  | "secrets";

export interface ModeCapability {
  id: CapabilityId;
  label: string;
  available: boolean;
  detail: string;
}

export interface ModeDescriptor {
  id: RuntimeMode;
  label: string;
  badge: string;
  summary: string;
  capabilities: ModeCapability[];
  requirements: string[];
  privacy: string[];
  cost: string[];
  recovery: string[];
  unavailableActions: {
    mutations: string;
    repository: string;
    workspace: string;
    secrets: string;
    engine: string;
    persistence: string;
  };
}

const local: ModeDescriptor = {
  id: "local",
  label: "Full local",
  badge: "Local · full execution",
  summary: "Unfinished Business and OpenCode run on this machine. Maker edits an isolated demo workspace; arbitrary repositories are not mounted in this release.",
  capabilities: [
    { id: "repository", label: "Bounded demo-workspace edits", available: true, detail: "Maker can edit the isolated demo workspace under UB_DATA_DIR after an explicit scope grant. Arbitrary repository mounts are not implemented." },
    { id: "opencode", label: "Live OpenCode", available: true, detail: "The app connects to an OpenCode server on loopback." },
    { id: "persistence", label: "Persistence", available: true, detail: "Project state, previous snapshots, and OpenCode data stay on local disk." },
    { id: "providers", label: "Provider configuration", available: true, detail: "Models and provider credentials are configured in OpenCode, not in this application." },
    { id: "workspace", label: "Workspace selection", available: false, detail: "The workspace is fixed under UB_DATA_DIR. Browser-supplied paths and arbitrary server directories are rejected." },
    { id: "mutations", label: "Approvals and runs", available: true, detail: "Approvals, revisions, Maker runs, cancellation, and reconciliation are enabled." },
    { id: "secrets", label: "Browser secret entry", available: false, detail: "This application never accepts provider keys or passwords in the browser." },
  ],
  requirements: [
    "Node.js 22.14 or newer and the dependencies installed with npm ci.",
    "A supported OpenCode 2 server started separately on loopback.",
    "At least one model reported as available in OpenCode's catalog.",
    "A writable UB_DATA_DIR whose demo-workspace child stays inside that root.",
  ],
  privacy: [
    "Project records and OpenCode sessions stay on this machine unless you configure external telemetry.",
    "Native model requests leave the machine through the provider configured in OpenCode.",
    "The browser never receives provider credentials; OpenCode owns model authentication.",
    "The application is a trusted local developer tool, not an operating-system sandbox for untrusted code.",
  ],
  cost: [
    "No application hosting cost. You pay only for any model or infrastructure you configure in OpenCode.",
    "All accessible models is the default. A free/local-only policy and an optional session spending limit are available; paid or unknown-price routes require an explicit confirmation.",
    "Sentry is optional and must stay within the free entitlement used for this project.",
  ],
  recovery: [
    "Stop and restart OpenCode, then restart the app. Saved project state is preserved.",
    "Reconcile an ABANDONED native run before starting another Maker run.",
    "If a project snapshot is corrupt, the previous snapshot is offered and the corrupt file is preserved.",
    "Back up UB_DATA_DIR before deleting or resetting local state.",
  ],
  unavailableActions: {
    mutations: "This action is unavailable while the workshop is not connected to a writable runtime.",
    repository: "Repository execution is unavailable in the current runtime mode.",
    workspace: "Workspace selection is unavailable in the current runtime mode.",
    secrets: "Provider secrets are never entered in this application. Configure them in OpenCode.",
    engine: "OpenCode is not reachable. Start it on the configured loopback address and try again.",
    persistence: "Runtime persistence is unavailable in the current mode.",
  },
};

const demo: ModeDescriptor = {
  id: "demo",
  label: "Hosted demo",
  badge: "Demo · read-only sample",
  summary: "A public, deterministic sample. It has no repository, OpenCode session, provider key, or user-specific storage.",
  capabilities: [
    { id: "repository", label: "Repository execution", available: false, detail: "The hosted demo cannot access a visitor's local repository or an arbitrary server path." },
    { id: "opencode", label: "Live OpenCode", available: false, detail: "The hosted demo does not start or connect to OpenCode." },
    { id: "persistence", label: "Persistence", available: false, detail: "The sample is generated in memory and resets on reload. No user-specific state is stored." },
    { id: "providers", label: "Provider configuration", available: false, detail: "No provider key is configured or accepted by the public demo." },
    { id: "workspace", label: "Workspace selection", available: false, detail: "Workspace selection is disabled; browser-supplied paths are never read." },
    { id: "mutations", label: "Approvals and runs", available: false, detail: "All mutation, run, approval, and session-token routes are rejected." },
    { id: "secrets", label: "Browser secret entry", available: false, detail: "The demo has no route that accepts provider keys, passwords, or other secrets." },
  ],
  requirements: [
    "None. The demo is public and needs no account, repository, or provider key.",
    "Run the full local mode for real approvals, Maker edits, and OpenCode execution.",
    "Deploy a private hosted copy for a protected, persistent server-side workshop.",
  ],
  privacy: [
    "The page serves deterministic fixture data and never reads local files or environment secrets.",
    "No workflow state is written for a visitor; reloading returns the same sample.",
    "Public health and mode responses contain no credentials, paths, or engine addresses.",
  ],
  cost: [
    "The demo is intended to fit a low-cost or free static/app host because it needs no disk or paid model calls.",
    "No provider inference is performed by the demo.",
  ],
  recovery: [
    "Use Reset demo or reload the page to return to the deterministic sample.",
    "If an action is unavailable, follow the explanation and switch to local or private hosted mode.",
    "Nothing needs to be backed up because the demo stores no user data.",
  ],
  unavailableActions: {
    mutations: "The public hosted demo is read-only. Run Unfinished Business locally for approvals, Maker runs, and repository edits, or deploy your own private copy.",
    repository: "The public hosted demo cannot access a visitor's repository or any arbitrary server-side path.",
    workspace: "Workspace selection is disabled in the hosted demo because no filesystem is connected.",
    secrets: "The hosted demo does not accept provider keys, passwords, or other secrets.",
    engine: "The hosted demo does not connect to OpenCode. Run locally for live execution.",
    persistence: "The hosted demo stores no user-specific state; reloading resets the sample.",
  },
};

const privateHosted: ModeDescriptor = {
  id: "private-hosted",
  label: "Private hosted deployment",
  badge: "Private hosted · protected",
  summary: "Your own protected Render instance with a private disk and live OpenCode. It works in a managed server workspace, never in a visitor's local repository.",
  capabilities: [
    { id: "repository", label: "Bounded managed-workspace edits", available: true, detail: "Maker edits the managed demo workspace on the private disk. A hosted browser cannot edit a visitor's machine or mount an arbitrary repository." },
    { id: "opencode", label: "Live OpenCode", available: true, detail: "A private OpenCode server runs beside the app on loopback and requires its own password." },
    { id: "persistence", label: "Persistence", available: true, detail: "Project state and OpenCode data live on the attached private persistent disk." },
    { id: "providers", label: "Provider configuration", available: true, detail: "Application and OpenCode secrets come from Render's secret store, never from the browser." },
    { id: "workspace", label: "Workspace selection", available: false, detail: "The managed workspace is fixed by server policy; arbitrary server paths are rejected." },
    { id: "mutations", label: "Approvals and runs", available: true, detail: "Authenticated users can approve, revise, and run Maker inside the managed workspace." },
    { id: "secrets", label: "Browser secret entry", available: false, detail: "Secrets are supplied through Render environment variables, not through the browser." },
  ],
  requirements: [
    "A paid Render instance because persistent disks are not available on free services.",
    "UB_ACCESS_PASSWORD, UB_SESSION_TOKEN, and OPENCODE_PASSWORD generated or supplied by Render.",
    "UB_DATA_DIR and OPENCODE_*_HOME mapped to the private persistent disk.",
    "Sentry DSNs and the source-map auth token supplied as Render secrets when monitoring is enabled.",
  ],
  privacy: [
    "HTTP Basic Auth protects the application and every non-public route.",
    "OpenCode requires its own password and listens on loopback only.",
    "Project state and native data stay on the private disk; Render still operates the infrastructure.",
    "A hosted browser can never reach a visitor's local repository. Use local mode for that.",
  ],
  cost: [
    "Render charges for the instance and the persistent disk for as long as they exist.",
    "The disk is paid persistent storage and cannot be attached to a free service.",
    "Model usage and billing follow the provider configured in OpenCode. The app enforces the optional spending limit only against cost OpenCode reports.",
  ],
  recovery: [
    "Rotate UB_ACCESS_PASSWORD in Render to revoke access; the service redeploys.",
    "Stop the service before copying the disk or replacing project state.",
    "Keep the previous snapshot; do not delete the disk to troubleshoot a single request.",
    "Reconcile an ABANDONED native run before retrying.",
  ],
  unavailableActions: {
    mutations: "This action is unavailable in the current runtime mode.",
    repository: "A hosted browser cannot edit a visitor's local repository. Run locally for local repository work.",
    workspace: "Private hosted mode uses a fixed managed workspace on the private disk. Arbitrary server paths are rejected.",
    secrets: "Provider and application secrets come from Render's secret store, not from the browser.",
    engine: "The private OpenCode server is not reachable. Check the service logs and the OPENCODE_PASSWORD configuration.",
    persistence: "The private disk is not available. Check the Render disk mount before retrying.",
  },
};

export const MODE_DESCRIPTORS: Record<RuntimeMode, ModeDescriptor> = {
  local,
  demo,
  "private-hosted": privateHosted,
};

export function modeDescriptor(mode: RuntimeMode): ModeDescriptor {
  return MODE_DESCRIPTORS[mode];
}

export function capabilityOf(mode: RuntimeMode, id: CapabilityId): ModeCapability {
  const capability = MODE_DESCRIPTORS[mode].capabilities.find((item) => item.id === id);
  if (!capability) throw new Error(`Unknown capability ${id} for mode ${mode}.`);
  return capability;
}

export function isCapabilityAvailable(mode: RuntimeMode, id: CapabilityId): boolean {
  return capabilityOf(mode, id).available;
}
