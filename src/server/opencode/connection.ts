import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import {
  connectionStatusSchema,
  type ConnectionStatus,
  type DeploymentMode,
  type DiscoveredModel,
  type OpenCodeDiscovery,
  SUPPORTED_OPENCODE_MAJOR,
  TESTED_OPENCODE_VERSION,
} from "../../shared/opencode.ts";
import type { ModelRef } from "../workflow/model.ts";
import {
  checkVersionCompatibility,
  classifyConnectionError,
  ConnectionConfigError,
  createNativeClient,
  redactSecrets,
  validateServerUrl,
  type NativeClientOptions,
} from "./client.ts";
import {
  normalizeDiscovery,
  type RawAgent,
  type RawCommand,
  type RawConfigEntry,
  type RawDiscoveryInput,
  type RawIntegration,
  type RawMcpServer,
  type RawModel,
  type RawPermissionRequest,
  type RawProvider,
  type RawSkill,
} from "./discovery.ts";

export interface NativeClientLike {
  server: { info: () => Promise<{ version: string }> };
  model: { list: () => Promise<{ data: RawModel[] }> };
  provider: { list: () => Promise<{ data: RawProvider[] }> };
  integration: { list: () => Promise<{ data: RawIntegration[] }> };
  agent: { list: () => Promise<{ data: RawAgent[] }> };
  permission: { request: { list: () => Promise<{ data: RawPermissionRequest[] }> } };
  command: { list: () => Promise<{ data: RawCommand[] }> };
  skill: { list: () => Promise<{ data: RawSkill[] }> };
  mcp: { list: () => Promise<{ data: RawMcpServer[] }> };
  config: { get: () => Promise<RawConfigEntry[]> };
}

export interface ConnectionServiceOptions {
  dataDir: string;
  deploymentMode?: DeploymentMode;
  envBaseUrl?: string;
  envUsername?: string;
  envPassword?: string;
  clientFactory?: (options: NativeClientOptions) => NativeClientLike;
  now?: () => Date;
}

const settingsSchema = z.object({
  baseUrl: z.string().nullable().default(null),
  authMode: z.enum(["none", "basic"]).default("none"),
  username: z.string().default("opencode"),
  hasPassword: z.boolean().default(false),
  updatedAt: z.string().nullable().default(null),
});

type ConnectionSettings = z.infer<typeof settingsSchema>;

export interface CheckOptions {
  baseUrl?: string;
  username?: string;
  password?: string;
  selected?: ModelRef | null;
}

export interface ModelResolution {
  model: DiscoveredModel;
  source: "selected" | "legacy" | "auto-discovery";
}

export class ConnectionService {
  private settings: ConnectionSettings = settingsSchema.parse({});
  private password: string | undefined;
  private cached: ConnectionStatus;
  private discoveryCache: { discovery: OpenCodeDiscovery; expiresAt: number } | null = null;
  private readonly clientFactory: (options: NativeClientOptions) => NativeClientLike;
  private readonly now: () => Date;

  constructor(private readonly options: ConnectionServiceOptions) {
    this.clientFactory = options.clientFactory ?? ((clientOptions) => createNativeClient(clientOptions) as unknown as NativeClientLike);
    this.now = options.now ?? (() => new Date());
    this.password = options.envPassword?.trim() || undefined;
    this.cached = this.initialStatus();
  }

  get deploymentMode(): DeploymentMode {
    return this.options.deploymentMode ?? "local";
  }

  get managed(): boolean {
    return this.deploymentMode !== "local";
  }

  async load(): Promise<void> {
    let stored: Partial<ConnectionSettings> = {};
    try {
      stored = settingsSchema.parse(JSON.parse(await readFile(this.path, "utf8")));
    } catch {
      stored = {};
    }
    const envBase = this.options.envBaseUrl?.trim() || null;
    const baseUrl = this.managed ? envBase : (stored.baseUrl ?? envBase);
    this.settings = settingsSchema.parse({
      baseUrl,
      authMode: stored.authMode ?? (this.password ? "basic" : "none"),
      username: this.options.envUsername?.trim() ?? stored.username ?? "opencode",
      // A server password is memory-only. A persisted "hasPassword" flag from a
      // previous process must not claim the password is still available.
      hasPassword: Boolean(this.password),
      updatedAt: stored.updatedAt ?? null,
    });
    this.cached = this.initialStatus();
  }

  get path(): string {
    return resolve(this.options.dataDir, "connection.json");
  }

  initialStatus(): ConnectionStatus {
    const baseUrl = this.settings.baseUrl ?? this.options.envBaseUrl?.trim() ?? null;
    return connectionStatusSchema.parse({
      state: "not_configured",
      baseUrl,
      deploymentMode: this.deploymentMode,
      managed: this.managed,
      auth: {
        mode: this.settings.authMode,
        username: this.settings.username,
        hasPassword: Boolean(this.password) || this.settings.hasPassword,
      },
      serverVersion: null,
      compatible: null,
      checkedAt: null,
      diagnostics: [],
      discovery: null,
    });
  }

  status(): ConnectionStatus {
    return this.cached;
  }

  /** Creates a client for an authorized session action. Credentials stay in this process. */
  client(): NativeClientLike {
    return this.clientFactory(this.clientOptions());
  }

  /** Current native client options. The password is memory-only and never serialized. */
  clientOptions(): NativeClientOptions {
    const baseUrl = this.settings.baseUrl ?? this.options.envBaseUrl?.trim();
    if (!baseUrl) throw new Error("OpenCode is not configured.");
    return {
      baseUrl,
      username: this.settings.username,
      password: this.password,
    };
  }

  async refresh(options: { selected?: ModelRef | null } = {}): Promise<ConnectionStatus> {
    return this.check(options);
  }

  async configure(input: { baseUrl: string; username?: string; password?: string }): Promise<ConnectionStatus> {
    if (this.managed) {
      throw new ConnectionConfigError("This deployment manages the OpenCode connection through its environment and secret store.", "INVALID_URL");
    }
    const validated = validateServerUrl(input.baseUrl);
    const password = input.password === undefined ? this.password : input.password;
    this.password = password?.trim() || undefined;
    this.settings = settingsSchema.parse({
      baseUrl: validated.url,
      authMode: this.password ? "basic" : "none",
      username: input.username?.trim() || this.settings.username || "opencode",
      hasPassword: Boolean(this.password),
      updatedAt: this.now().toISOString(),
    });
    await this.persist();
    this.discoveryCache = null;
    this.cached = this.initialStatus();
    return this.check({ baseUrl: validated.url, username: this.settings.username, selected: null });
  }

  async reset(): Promise<ConnectionStatus> {
    if (this.managed) throw new ConnectionConfigError("This deployment manages the OpenCode connection through its environment and secret store.", "INVALID_URL");
    this.password = undefined;
    this.discoveryCache = null;
    this.settings = settingsSchema.parse({
      baseUrl: this.options.envBaseUrl?.trim() || null,
      authMode: "none",
      username: this.options.envUsername?.trim() || "opencode",
      hasPassword: false,
      updatedAt: this.now().toISOString(),
    });
    await this.persist();
    this.cached = this.initialStatus();
    return this.cached;
  }

  async check(options: CheckOptions = {}): Promise<ConnectionStatus> {
    const baseUrlInput = options.baseUrl ?? this.settings.baseUrl ?? this.options.envBaseUrl ?? null;
    if (!baseUrlInput) {
      this.cached = this.initialStatus();
      return this.cached;
    }
    let validated;
    try {
      validated = validateServerUrl(baseUrlInput);
    } catch (error) {
      this.cached = this.failureStatus(baseUrlInput, error instanceof Error ? error.message : "Invalid server URL.", [
        {
          code: "INVALID_SERVER_URL",
          severity: "error",
          title: "Invalid OpenCode URL",
          message: error instanceof Error ? error.message : "The URL is invalid.",
          repair: "Use http://127.0.0.1:4096 for local OpenCode, or an https:// URL for a remote server.",
        },
      ]);
      return this.cached;
    }

    const username = options.username?.trim() || this.settings.username || "opencode";
    const password = options.password === undefined ? this.password : options.password.trim();
    if (options.password !== undefined) this.password = password || undefined;
    const client = this.clientFactory({ baseUrl: validated.url, username, password });

    let info: { version: string };
    try {
      info = await client.server.info();
    } catch (error) {
      const failure = classifyConnectionError(error);
      const authCode = failure.code === "AUTH_REQUIRED" && password ? "PASSWORD_MISMATCH" : failure.code;
      this.cached = this.failureStatus(validated.url, failure.message, [{
        code: authCode,
        severity: "error",
        title: failure.state === "authentication_required"
          ? password ? "OpenCode rejected the password" : "OpenCode authentication required"
          : "OpenCode is not reachable",
        message: failure.message,
        repair: this.repairFor(authCode),
      }], failure.state);
      this.settings = { ...this.settings, baseUrl: validated.url, username, authMode: password ? "basic" : "none" };
      return this.cached;
    }

    const compatibility = checkVersionCompatibility(info.version);
    if (!compatibility.compatible) {
      this.cached = connectionStatusSchema.parse({
        ...this.initialStatus(),
        state: "incompatible_version",
        baseUrl: validated.url,
        serverVersion: info.version,
        compatible: false,
        checkedAt: this.now().toISOString(),
        diagnostics: [{
          code: "UNSUPPORTED_SERVER_VERSION",
          severity: "error",
          title: "Unsupported OpenCode server version",
          message: compatibility.warning,
          repair: `Install OpenCode ${SUPPORTED_OPENCODE_MAJOR}.x compatible with @opencode/client ${TESTED_OPENCODE_VERSION}, or update Unfinished Business.`,
        }],
      });
      return this.cached;
    }

    const [modelsResult, providersResult, integrationsResult, agentsResult, permissionsResult, commandsResult, skillsResult, mcpResult, configResult] = await Promise.allSettled([
      client.model.list(),
      client.provider.list(),
      client.integration.list(),
      client.agent.list(),
      client.permission.request.list(),
      client.command.list(),
      client.skill.list(),
      client.mcp.list(),
      client.config.get(),
    ]);

    if (modelsResult.status === "rejected" || providersResult.status === "rejected") {
      const failure = classifyConnectionError(modelsResult.status === "rejected" ? modelsResult.reason : providersResult.status === "rejected" ? providersResult.reason : undefined);
      this.cached = this.failureStatus(validated.url, failure.message, [{
        code: failure.code,
        severity: "error",
        title: "OpenCode discovery failed",
        message: failure.message,
        repair: "Confirm the server is healthy and that the account/project can list models. Then retry.",
      }], failure.state);
      return this.cached;
    }

    const raw: RawDiscoveryInput = {
      version: info.version,
      models: modelsResult.value.data,
      providers: providersResult.value.data,
      integrations: integrationsResult.status === "fulfilled" ? integrationsResult.value.data : [],
      agents: agentsResult.status === "fulfilled" ? agentsResult.value.data : [],
      permissions: permissionsResult.status === "fulfilled" ? permissionsResult.value.data : [],
      commands: commandsResult.status === "fulfilled" ? commandsResult.value.data : [],
      skills: skillsResult.status === "fulfilled" ? skillsResult.value.data : [],
      mcpServers: mcpResult.status === "fulfilled" ? mcpResult.value.data : [],
      config: configResult.status === "fulfilled" ? configResult.value : [],
    };
    const discovery = normalizeDiscovery(raw);
    discovery.limitations.push(...this.partialLimitations({
      integrations: integrationsResult.status,
      agents: agentsResult.status,
      permissions: permissionsResult.status,
      commands: commandsResult.status,
      skills: skillsResult.status,
      mcp: mcpResult.status,
      config: configResult.status,
    }));

    const diagnostics = this.diagnosticsFor(discovery, options.selected ?? null);
    const state = diagnostics.some((diagnostic) => diagnostic.severity === "error")
      ? "degraded"
      : diagnosticWarnings(diagnostics) || discovery.server.warning
        ? "degraded"
        : "connected";

    this.discoveryCache = { discovery, expiresAt: Date.now() + 30_000 };
    this.settings = {
      ...this.settings,
      baseUrl: validated.url,
      username,
      authMode: password ? "basic" : "none",
      hasPassword: Boolean(password) || this.settings.hasPassword,
      updatedAt: this.now().toISOString(),
    };
    this.password = password || undefined;
    if (!this.managed) await this.persist();
    this.cached = connectionStatusSchema.parse({
      state,
      baseUrl: validated.url,
      deploymentMode: this.deploymentMode,
      managed: this.managed,
      auth: {
        mode: this.settings.authMode,
        username: this.settings.username,
        hasPassword: Boolean(this.password),
      },
      serverVersion: info.version,
      compatible: true,
      checkedAt: this.now().toISOString(),
      diagnostics,
      discovery,
    });
    return this.cached;
  }

  async discovery(options: { selected?: ModelRef | null } = {}): Promise<OpenCodeDiscovery> {
    if (this.discoveryCache && this.discoveryCache.expiresAt > Date.now()) return this.discoveryCache.discovery;
    const status = await this.check({ selected: options.selected });
    if (!status.discovery) throw new Error("OpenCode discovery is unavailable until the connection succeeds.");
    return status.discovery;
  }

  async resolveModel(selection: ModelRef | null, discovery?: OpenCodeDiscovery): Promise<ModelResolution | null> {
    const current = discovery ?? await this.discovery({ selected: selection });
    if (selection) {
      const match = current.models.find((model) =>
        model.providerID === selection.providerID
        && model.id === selection.id
        && model.availability === "available",
      );
      if (match) {
        if (selection.variant && !match.variants.includes(selection.variant)) {
          throw new Error(`Variant "${selection.variant}" is not reported for ${match.key}.`);
        }
        return { model: match, source: "selected" };
      }
    }
    return null;
  }

  /**
   * Resolve a migrated legacy identity. The legacy model is used only when the
   * current catalog still reports it; this method never substitutes an
   * unrelated or paid model. New projects choose explicitly in onboarding.
   */
  async chooseDefaultModel(legacyModel?: string | null): Promise<ModelResolution | null> {
    if (!legacyModel) return null;
    const discovery = await this.discovery({ selected: null });
    const legacy = discovery.models.find((model) =>
      model.key === legacyModel && model.availability === "available");
    return legacy ? { model: legacy, source: "legacy" } : null;
  }

  validateSelection(discovery: OpenCodeDiscovery, model: ModelRef): DiscoveredModel {
    const match = discovery.models.find((candidate) =>
      candidate.providerID === model.providerID
      && candidate.id === model.id
      && candidate.availability === "available",
    );
    if (!match) throw new Error(`${model.providerID}/${model.id} is not an available model reported by OpenCode.`);
    if (model.variant && !match.variants.includes(model.variant)) {
      throw new Error(`Variant "${model.variant}" is not reported for ${match.key}. Reported variants: ${match.variants.join(", ") || "none"}.`);
    }
    return match;
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(temporary, `${JSON.stringify(this.settings, null, 2)}\n`, { mode: 0o600 });
    await chmod(temporary, 0o600);
    await rename(temporary, this.path);
  }

  private failureStatus(
    baseUrl: string,
    message: string,
    diagnostics: ConnectionStatus["diagnostics"],
    state: ConnectionStatus["state"] = "unavailable",
  ): ConnectionStatus {
    return connectionStatusSchema.parse({
      ...this.initialStatus(),
      state,
      baseUrl,
      checkedAt: this.now().toISOString(),
      diagnostics,
      discovery: null,
      serverVersion: null,
      compatible: null,
    });
  }

  private repairFor(code: string): string {
    if (code === "AUTH_REQUIRED" || code === "PASSWORD_MISMATCH") return "Enter the OpenCode server password (the value printed by `opencode serve`, or OPENCODE_PASSWORD). Provider API keys belong in OpenCode, not here.";
    if (code === "ORIGIN_BLOCKED") return "Check the OpenCode server's hostname, CORS/origin settings, and reverse proxy. This application connects from the server, not the browser.";
    if (code === "TIMEOUT") return "Confirm the OpenCode process is healthy and the URL points at its API port. Retry when it is idle.";
    if (code === "MALFORMED") return "Confirm the URL points at an OpenCode 2.x server (not a different service or a stale proxy).";
    return "Start OpenCode with `opencode serve --hostname 127.0.0.1 --port 4096`, confirm the URL and port, then retry.";
  }

  private diagnosticsFor(discovery: OpenCodeDiscovery, selected: ModelRef | null) {
    const diagnostics: ConnectionStatus["diagnostics"] = [];
    if (discovery.server.warning) {
      diagnostics.push({
        code: "VERSION_UNTESTED",
        severity: "warning",
        title: "Untested OpenCode patch version",
        message: discovery.server.warning,
        repair: `Use OpenCode ${discovery.server.testedVersion} for the tested surface, or verify the new version with the live diagnostic.`,
      });
    }
    if (discovery.models.length === 0) {
      diagnostics.push({
        code: "NO_MODELS",
        severity: "error",
        title: "No models reported",
        message: "OpenCode returned no selectable models.",
        repair: "Connect a provider inside OpenCode (`/connect`), then run `/models` or restart the server. This app never asks for provider API keys.",
      });
    }
    const availableModels = discovery.models.filter((model) => model.availability === "available");
    if (discovery.models.length > 0 && availableModels.length === 0) {
      diagnostics.push({
        code: "NO_AVAILABLE_MODELS",
        severity: "error",
        title: "No available models",
        message: "Every model in the catalog is disabled or tied to a disabled provider.",
        repair: "Enable a provider/model inside OpenCode, then retry discovery.",
      });
    }
    for (const provider of discovery.providers.filter((item) => item.ready === "needs_auth")) {
      diagnostics.push({
        code: "PROVIDER_NOT_CONNECTED",
        severity: "warning",
        title: `${provider.name} needs authentication`,
        message: provider.detail,
        repair: `Connect ${provider.name} inside OpenCode with /connect, or choose a model from a provider that is already available.`,
      });
    }
    if (selected) {
      const match = discovery.models.find((model) => model.providerID === selected.providerID && model.id === selected.id);
      if (!match) {
        diagnostics.push({
          code: "MODEL_UNAVAILABLE",
          severity: "error",
          title: "Selected model is unavailable",
          message: `${selected.providerID}/${selected.id} is not in the current OpenCode catalog.`,
          repair: "Choose another model in the OpenCode panel. The previous selection was not replaced automatically.",
        });
      } else if (match.availability !== "available") {
        diagnostics.push({
          code: "MODEL_DISABLED",
          severity: "error",
          title: "Selected model is disabled",
          message: `${match.name} is present but unavailable (${match.status}).`,
          repair: "Enable the model or provider inside OpenCode, or choose another model.",
        });
      } else if (selected.variant && !match.variants.includes(selected.variant)) {
        diagnostics.push({
          code: "VARIANT_UNAVAILABLE",
          severity: "error",
          title: "Selected variant is not reported",
          message: `Variant "${selected.variant}" is not attached to ${match.key}. Reported variants: ${match.variants.join(", ") || "none"}.`,
          repair: "Choose a variant reported for this model, or use the model default.",
        });
      }
      if (match?.local && ((match.limits.context ?? 0) < 8_192 || (match.limits.output ?? 0) < 1_024)) {
        diagnostics.push({
          code: "LOCAL_MODEL_LIMITS",
          severity: "warning",
          title: "Local model has small limits",
          message: `${match.name} reports a ${match.limits.context ?? "unknown"} token context and ${match.limits.output ?? "unknown"} token output limit.`,
          repair: "Lower the planned scope, increase the local model context/output in its runtime, or choose a model with larger limits. OpenCode does not report free RAM or VRAM.",
        });
      }
    }
    if (discovery.permissions.length > 0) {
      diagnostics.push({
        code: "PERMISSION_PENDING",
        severity: "warning",
        title: "Permission decisions are waiting",
        message: `${discovery.permissions.length} OpenCode permission request(s) need a human decision.`,
        repair: "Review each request in the OpenCode panel. This application never auto-approves a request.",
      });
    }
    return diagnostics;
  }

  private partialLimitations(results: Record<string, PromiseSettledResult<unknown> | "fulfilled" | "rejected">): string[] {
    const limitations: string[] = [];
    for (const [name, result] of Object.entries(results)) {
      const status = typeof result === "string" ? result : result.status;
      if (status === "rejected") limitations.push(`OpenCode ${name} discovery failed for this version. That section is visibly deferred.`);
    }
    return limitations;
  }
}

function diagnosticWarnings(diagnostics: ConnectionStatus["diagnostics"]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "warning");
}

export function safeErrorMessage(error: unknown): string {
  return redactSecrets(error instanceof Error ? error.message : String(error));
}
