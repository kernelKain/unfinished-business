import {
  TESTED_OPENCODE_VERSION,
  type DiscoveredModel,
  type DiscoveredProvider,
  type OpenCodeDiscovery,
  type RoleMapping,
} from "../../shared/opencode.ts";
import { checkVersionCompatibility } from "./client.ts";

export interface RawModel {
  id: string;
  modelID?: string;
  providerID: string;
  canonical?: string;
  family?: string;
  name: string;
  compatibility?: {
    reasoningField?: string;
    requireReasoning?: boolean;
  };
  variants?: Array<{ id: string }>;
  cost?: Array<{
    tier?: { type: "context"; size: number };
    input: number;
    output: number;
    cache: { read: number; write: number };
  }>;
  status?: "alpha" | "beta" | "deprecated" | "active";
  enabled?: boolean;
  limit?: { context?: number; input?: number; output?: number };
  capabilities?: {
    tools?: boolean;
    input?: string[];
    output?: string[];
  };
}

export interface RawProvider {
  id: string;
  name?: string;
  activation?: "auto" | "enabled" | "disabled";
  package?: string;
  settings?: { baseURL?: string };
  integrationID?: string;
}

export interface RawIntegration {
  id: string;
  name?: string;
  connections?: Array<{
    type: "credential" | "env";
    status?: { status: "needs_auth"; message?: string };
  }>;
}

export interface RawAgent {
  id: string;
  name?: string;
  mode?: "subagent" | "primary" | "all";
  hidden?: boolean;
  description?: string;
  permissions?: unknown[];
}

export interface RawPermissionRequest {
  id: string;
  sessionID: string;
  action: string;
  resources?: string[];
  message?: string;
}

export interface RawCommand {
  name: string;
  description?: string;
}

export interface RawSkill {
  id: string;
  name?: string;
  description?: string;
}

export interface RawMcpServer {
  name: string;
  status?: { status?: string; error?: string } | string;
}

export interface RawConfigEntry {
  type: "document" | "directory";
  path?: string;
  info?: {
    formatter?: boolean | Record<string, { disabled?: boolean }>;
    lsp?: boolean | Record<string, { disabled?: boolean }>;
  };
}

export interface RawDiscoveryInput {
  version: string;
  models: RawModel[];
  providers: RawProvider[];
  integrations?: RawIntegration[];
  agents?: RawAgent[];
  permissions?: RawPermissionRequest[];
  commands?: RawCommand[];
  skills?: RawSkill[];
  mcpServers?: RawMcpServer[];
  config?: RawConfigEntry[];
}

const knownLocalProviders = new Set(["ollama", "lmstudio", "vllm", "llamacpp", "llama.cpp", "local"]);

function isLoopbackUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname.replace(/^\[|\]$/g, "").toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function providerIsLocal(provider: RawProvider | undefined): boolean {
  if (!provider) return false;
  if (knownLocalProviders.has(provider.id.toLowerCase())) return true;
  if (provider.package?.includes("ollama") || provider.package?.includes("lmstudio") || provider.package?.includes("vllm")) return true;
  return isLoopbackUrl(provider.settings?.baseURL);
}

function pricing(cost: RawModel["cost"]): DiscoveredModel["pricing"] {
  if (!cost || cost.length === 0) return "unknown";
  const free = cost.every((entry) =>
    entry.input === 0
    && entry.output === 0
    && (entry.cache?.read ?? 0) === 0
    && (entry.cache?.write ?? 0) === 0);
  return free ? "free" : "paid";
}

function reasoning(model: RawModel): DiscoveredModel["reasoning"] {
  if (model.compatibility?.reasoningField || model.compatibility?.requireReasoning) {
    return { supported: true, source: "compatibility" };
  }
  if ((model.variants?.length ?? 0) > 0) {
    return { supported: true, source: "variants" };
  }
  return { supported: null, source: "unknown" };
}

export function normalizeModel(model: RawModel, provider?: RawProvider): DiscoveredModel {
  const variants = [...new Set((model.variants ?? []).map((variant) => variant.id).filter(Boolean))];
  const providerUsable = provider ? provider.activation !== "disabled" : true;
  return {
    key: `${model.providerID}/${model.id}`,
    providerID: model.providerID,
    id: model.id,
    name: model.name,
    family: model.family ?? null,
    availability: model.enabled !== false && providerUsable ? "available" : "unavailable",
    status: model.status ?? "active",
    enabled: model.enabled !== false,
    pricing: pricing(model.cost),
    local: provider ? providerIsLocal(provider) : null,
    limits: {
      context: model.limit?.context ?? null,
      input: model.limit?.input ?? null,
      output: model.limit?.output ?? null,
    },
    modalities: {
      input: model.capabilities?.input ?? ["text"],
      output: model.capabilities?.output ?? ["text"],
    },
    tools: model.capabilities?.tools ?? false,
    reasoning: reasoning(model),
    variants,
    cost: (model.cost ?? []).map((entry) => ({
      tierSize: entry.tier?.size ?? null,
      input: entry.input,
      output: entry.output,
      cacheRead: entry.cache?.read ?? 0,
      cacheWrite: entry.cache?.write ?? 0,
    })),
  };
}

export function normalizeProviders(models: RawModel[], providers: RawProvider[], integrations: RawIntegration[] = []): DiscoveredProvider[] {
  const integrationsById = new Map(integrations.map((integration) => [integration.id, integration]));
  return providers.map((provider) => {
    const providerModels = models.filter((model) => model.providerID === provider.id);
    const integration = integrationsById.get(provider.integrationID ?? provider.id);
    const needsAuth = integration?.connections?.some((connection) => connection.status?.status === "needs_auth") ?? false;
    const hasConnection = (integration?.connections?.length ?? 0) > 0;
    const activation = provider.activation ?? "auto";
    const ready = activation === "disabled"
      ? "unknown"
      : needsAuth
        ? "needs_auth"
        : integration && !hasConnection
          ? "unknown"
          : providerModels.some((model) => model.enabled !== false)
            ? "ready"
            : "unknown";
    const detail = ready === "ready"
      ? `${providerModels.length} model${providerModels.length === 1 ? "" : "s"} reported by OpenCode.`
      : ready === "needs_auth"
        ? "OpenCode reports that this provider still needs an account connection."
        : activation === "disabled"
          ? "OpenCode has disabled this provider."
          : integration
            ? "No account connection is reported; free catalog models may still be usable. OpenCode owns credentials."
            : "Provider availability is inferred from the model catalog; OpenCode owns credentials.";
    return {
      id: provider.id,
      name: provider.name ?? provider.id,
      activation,
      ready,
      modelCount: providerModels.length,
      detail,
    };
  });
}

export const APPLICATION_ROLE_AGENTS = {
  oracle: { preferred: ["oracle", "ub-oracle"], fallback: "plan" },
  architect: { preferred: ["architect", "ub-architect"], fallback: "plan" },
  maker: { preferred: ["maker", "ub-maker"], fallback: "build" },
  witness: { preferred: ["witness", "ub-witness"], fallback: "plan" },
} as const;

export function mapRoles(agents: RawAgent[]): RoleMapping[] {
  const ids = new Set(agents.filter((agent) => !agent.hidden).map((agent) => agent.id));
  return (Object.entries(APPLICATION_ROLE_AGENTS) as Array<[RoleMapping["role"], { preferred: readonly string[]; fallback: string }]>)
    .map(([role, mapping]) => {
      const preferred = mapping.preferred.find((id) => ids.has(id));
      const selected = preferred ?? (ids.has(mapping.fallback) ? mapping.fallback : null);
      return {
        role,
        agent: selected ?? mapping.fallback,
        available: selected !== null,
        detail: preferred
          ? `Uses the installed custom agent "${preferred}".`
          : selected
            ? `Uses OpenCode's ${selected} agent as the explicit fallback. Configure ${mapping.preferred[0]} to specialize this role.`
            : `Neither a custom agent nor the ${mapping.fallback} fallback is visible. Session creation will use OpenCode's default agent.`,
      };
    });
}

function formatterEntries(value: RawConfigEntry["info"]): { formatters: OpenCodeDiscovery["formatters"]; lspServers: OpenCodeDiscovery["lspServers"] } {
  const formatters: OpenCodeDiscovery["formatters"] = [];
  const lspServers: OpenCodeDiscovery["lspServers"] = [];
  if (!value) return { formatters, lspServers };
  if (value.formatter === true) {
    formatters.push({ name: "auto-discovered", configured: true, disabled: false });
  } else if (value.formatter && typeof value.formatter === "object") {
    for (const [name, entry] of Object.entries(value.formatter)) {
      formatters.push({ name, configured: true, disabled: Boolean(entry?.disabled) });
    }
  }
  if (value.lsp === true) {
    lspServers.push({ name: "auto-discovered", configured: true, disabled: false });
  } else if (value.lsp && typeof value.lsp === "object") {
    for (const [name, entry] of Object.entries(value.lsp)) {
      lspServers.push({ name, configured: true, disabled: Boolean(entry?.disabled) });
    }
  }
  return { formatters, lspServers };
}

function usageLinks(providers: DiscoveredProvider[]): OpenCodeDiscovery["usage"]["links"] {
  const known: Record<string, { label: string; url: string }> = {
    opencode: { label: "OpenCode Console usage", url: "https://opencode.ai/console" },
    openai: { label: "OpenAI usage", url: "https://platform.openai.com/usage" },
    anthropic: { label: "Anthropic usage", url: "https://console.anthropic.com/settings/usage" },
    openrouter: { label: "OpenRouter activity", url: "https://openrouter.ai/activity" },
    "google-vertex": { label: "Google Cloud billing", url: "https://console.cloud.google.com/billing" },
    google: { label: "Google AI Studio usage", url: "https://aistudio.google.com" },
  };
  return providers.flatMap((provider) => known[provider.id] ? [known[provider.id]] : []);
}

function mcpStatus(server: RawMcpServer): OpenCodeDiscovery["mcpServers"][number]["status"] {
  const status = typeof server.status === "string" ? server.status : server.status?.status;
  if (status === "connected" || status === "pending" || status === "disabled" || status === "failed" || status === "needs_auth") return status;
  return "pending";
}

export function normalizeDiscovery(input: RawDiscoveryInput): OpenCodeDiscovery {
  const compatibility = checkVersionCompatibility(input.version);
  const providerById = new Map(input.providers.map((provider) => [provider.id, provider]));
  const models = input.models.map((model) => normalizeModel(model, providerById.get(model.providerID)));
  const providers = normalizeProviders(input.models, input.providers, input.integrations);
  const config = input.config ?? [];
  const formatters = config.flatMap((entry) => formatterEntries(entry.info).formatters);
  const lspServers = config.flatMap((entry) => formatterEntries(entry.info).lspServers);
  const limitations: string[] = [
    "Provider credentials and quota remain owned by OpenCode; this application never reads or stores provider API keys.",
    "Session cost and token totals appear only when OpenCode and the provider return usage.",
    "Model variants are limited to the selected model's reported variant IDs; there is no universal reasoning scale.",
    "A separate HTTP tool catalog is not exposed by OpenCode 2.0.32; tool availability is governed by the selected agent and permissions.",
    "Formatter and LSP entries reflect configuration from OpenCode, not live process health.",
  ];
  if (!compatibility.compatible) limitations.push(compatibility.warning ?? "The installed OpenCode server is not compatible.");
  else if (compatibility.warning) limitations.push(compatibility.warning);
  if (models.some((model) => model.local)) {
    limitations.push("Local model resource limits depend on the machine and runtime; OpenCode reports catalog limits but not free RAM or VRAM.");
  }

  return {
    server: {
      version: input.version,
      compatible: compatibility.compatible,
      testedVersion: TESTED_OPENCODE_VERSION,
      warning: compatibility.warning,
    },
    providers,
    models,
    agents: (input.agents ?? []).filter((agent) => !agent.hidden).map((agent) => ({
      id: agent.id,
      name: agent.name ?? agent.id,
      mode: agent.mode ?? "primary",
      hidden: Boolean(agent.hidden),
      description: agent.description ?? null,
      permissionCount: Array.isArray(agent.permissions) ? agent.permissions.length : 0,
    })),
    roles: mapRoles(input.agents ?? []),
    permissions: (input.permissions ?? []).map((request) => ({
      id: request.id,
      sessionID: request.sessionID,
      action: request.action,
      resources: request.resources ?? [],
      message: request.message ?? null,
    })),
    commands: (input.commands ?? []).map((command) => ({
      name: command.name,
      description: command.description ?? null,
    })),
    skills: (input.skills ?? []).map((skill) => ({
      id: skill.id,
      name: skill.name ?? skill.id,
      description: skill.description ?? null,
    })),
    mcpServers: (input.mcpServers ?? []).map((server) => ({
      name: server.name,
      status: mcpStatus(server),
      error: typeof server.status === "object" ? server.status?.error ?? null : null,
    })),
    formatters,
    lspServers,
    capabilities: [
      { id: "models", label: "Models and limits", supported: models.length > 0, detail: `${models.length} model(s) reported by the server.` },
      { id: "variants", label: "Model variants", supported: models.some((model) => model.variants.length > 0), detail: "Only variants attached to each model are selectable." },
      { id: "agents", label: "Agents", supported: (input.agents ?? []).length > 0, detail: `${(input.agents ?? []).length} agent(s) visible.` },
      { id: "permissions", label: "Permission requests", supported: true, detail: "Pending requests are read from OpenCode and never auto-approved." },
      { id: "commands", label: "Commands", supported: (input.commands ?? []).length > 0, detail: `${(input.commands ?? []).length} command(s) discovered.` },
      { id: "skills", label: "Skills", supported: (input.skills ?? []).length > 0, detail: `${(input.skills ?? []).length} skill(s) discovered.` },
      { id: "mcp", label: "MCP servers", supported: true, detail: `${(input.mcpServers ?? []).length} server(s) reported.` },
      { id: "formatters", label: "Formatters", supported: formatters.length > 0, detail: "Configuration presence only; no live formatter health probe." },
      { id: "lsp", label: "LSP servers", supported: lspServers.length > 0, detail: "Configuration presence only; no live LSP health probe." },
      { id: "sessions", label: "Session list and resume", supported: true, detail: "Limited to sessions referenced by this project." },
      { id: "interrupt", label: "Interrupt", supported: true, detail: "Requires a session owned by this project." },
      { id: "fork", label: "Fork", supported: true, detail: "Requires a non-empty session; the server rejects empty forks." },
      { id: "compact", label: "Compact", supported: true, detail: "Queues an OpenCode compaction request; it may report nothing to compact." },
      { id: "revert", label: "Revert", supported: true, detail: "Stage, clear, or commit requires a message boundary and an idle session." },
      { id: "tools", label: "Tool catalog", supported: false, detail: "Not exposed as a separate HTTP catalog by the installed server." },
      { id: "usage", label: "Usage totals", supported: true, detail: "Shown only when OpenCode returns session cost or token totals." },
      { id: "quota", label: "Provider quota", supported: false, detail: "Quota and balance are not available through the OpenCode HTTP API." },
    ],
    usage: {
      supported: true,
      quotaSupported: false,
      links: usageLinks(providers),
      detail: "Session cost and token totals come from OpenCode. Quota and balance require the provider console.",
    },
    limitations,
  };
}
