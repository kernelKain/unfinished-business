import { z } from "zod";

export const TESTED_OPENCODE_VERSION = "2.0.32" as const;
export const SUPPORTED_OPENCODE_MAJOR = 2 as const;

export const openCodeConnectionStateSchema = z.enum([
  "not_configured",
  "checking",
  "connected",
  "authentication_required",
  "incompatible_version",
  "unavailable",
  "degraded",
]);

export type OpenCodeConnectionState = z.infer<typeof openCodeConnectionStateSchema>;

export const deploymentModeSchema = z.enum(["local", "hosted-private", "hosted-demo"]);
export type DeploymentMode = z.infer<typeof deploymentModeSchema>;

export const connectionAuthSchema = z.object({
  mode: z.enum(["none", "basic"]),
  username: z.string(),
  hasPassword: z.boolean(),
});

export const connectionDiagnosticSchema = z.object({
  code: z.string(),
  severity: z.enum(["info", "warning", "error"]),
  title: z.string(),
  message: z.string(),
  repair: z.string(),
});

export const modelCostSchema = z.object({
  tierSize: z.number().nullable(),
  input: z.number(),
  output: z.number(),
  cacheRead: z.number(),
  cacheWrite: z.number(),
});

export const discoveredModelSchema = z.object({
  key: z.string(),
  providerID: z.string(),
  id: z.string(),
  name: z.string(),
  family: z.string().nullable(),
  availability: z.enum(["available", "unavailable"]),
  status: z.enum(["alpha", "beta", "deprecated", "active"]),
  enabled: z.boolean(),
  pricing: z.enum(["free", "paid", "unknown"]),
  local: z.boolean().nullable(),
  limits: z.object({
    context: z.number().nullable(),
    input: z.number().nullable(),
    output: z.number().nullable(),
  }),
  modalities: z.object({
    input: z.array(z.string()),
    output: z.array(z.string()),
  }),
  tools: z.boolean(),
  reasoning: z.object({
    supported: z.boolean().nullable(),
    source: z.enum(["compatibility", "variants", "unknown"]),
  }),
  variants: z.array(z.string()),
  cost: z.array(modelCostSchema),
});

export type DiscoveredModel = z.infer<typeof discoveredModelSchema>;

export const discoveredProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  activation: z.enum(["auto", "enabled", "disabled"]),
  ready: z.enum(["ready", "needs_auth", "unknown"]),
  modelCount: z.number().int().nonnegative(),
  detail: z.string(),
});

export type DiscoveredProvider = z.infer<typeof discoveredProviderSchema>;

export const discoveredAgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  mode: z.enum(["subagent", "primary", "all"]),
  hidden: z.boolean(),
  description: z.string().nullable(),
  permissionCount: z.number().int().nonnegative(),
});

export const roleMappingSchema = z.object({
  role: z.enum(["oracle", "architect", "maker", "witness"]),
  agent: z.string(),
  available: z.boolean(),
  detail: z.string(),
});

export type RoleMapping = z.infer<typeof roleMappingSchema>;

export const pendingPermissionSchema = z.object({
  id: z.string(),
  sessionID: z.string(),
  action: z.string(),
  resources: z.array(z.string()),
  message: z.string().nullable(),
});

export const discoveredCommandSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
});

export const discoveredSkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
});

export const discoveredMcpServerSchema = z.object({
  name: z.string(),
  status: z.enum(["connected", "pending", "disabled", "failed", "needs_auth"]),
  error: z.string().nullable(),
});

export const discoveredFormatterSchema = z.object({
  name: z.string(),
  configured: z.boolean(),
  disabled: z.boolean(),
});

export const discoveredLspSchema = z.object({
  name: z.string(),
  configured: z.boolean(),
  disabled: z.boolean(),
});

export const harnessCapabilitySchema = z.object({
  id: z.string(),
  label: z.string(),
  supported: z.boolean(),
  detail: z.string(),
});

export const providerUsageSchema = z.object({
  supported: z.boolean(),
  quotaSupported: z.boolean(),
  links: z.array(z.object({ label: z.string(), url: z.string() })),
  detail: z.string(),
});

export const sessionTokenUsageSchema = z.object({
  input: z.number(),
  output: z.number(),
  reasoning: z.number(),
  cacheRead: z.number(),
  cacheWrite: z.number(),
});

export const sessionSummarySchema = z.object({
  id: z.string(),
  role: z.enum(["oracle", "architect", "maker", "witness", "unknown"]),
  title: z.string().nullable(),
  model: z.string().nullable(),
  cost: z.number(),
  tokens: sessionTokenUsageSchema,
  outcome: z.enum(["succeeded", "failed", "interrupted"]).nullable(),
  idle: z.boolean(),
  messageCount: z.number().int().nonnegative(),
  created: z.number(),
  updated: z.number(),
});

export type SessionSummary = z.infer<typeof sessionSummarySchema>;

export const sessionUsageSchema = z.object({
  supported: z.boolean(),
  quotaSupported: z.boolean(),
  sessions: z.array(sessionSummarySchema),
  totals: z.object({
    cost: z.number(),
    tokens: sessionTokenUsageSchema,
  }),
  links: z.array(z.object({ label: z.string(), url: z.string() })),
  detail: z.string(),
});

export type SessionUsage = z.infer<typeof sessionUsageSchema>;


export const openCodeDiscoverySchema = z.object({
  server: z.object({
    version: z.string(),
    compatible: z.boolean(),
    testedVersion: z.string(),
    warning: z.string().nullable(),
  }),
  providers: z.array(discoveredProviderSchema),
  models: z.array(discoveredModelSchema),
  agents: z.array(discoveredAgentSchema),
  roles: z.array(roleMappingSchema),
  permissions: z.array(pendingPermissionSchema),
  commands: z.array(discoveredCommandSchema),
  skills: z.array(discoveredSkillSchema),
  mcpServers: z.array(discoveredMcpServerSchema),
  formatters: z.array(discoveredFormatterSchema),
  lspServers: z.array(discoveredLspSchema),
  capabilities: z.array(harnessCapabilitySchema),
  usage: providerUsageSchema,
  limitations: z.array(z.string()),
});

export type OpenCodeDiscovery = z.infer<typeof openCodeDiscoverySchema>;

export const connectionStatusSchema = z.object({
  state: openCodeConnectionStateSchema,
  baseUrl: z.string().nullable(),
  deploymentMode: deploymentModeSchema,
  managed: z.boolean(),
  auth: connectionAuthSchema,
  serverVersion: z.string().nullable(),
  compatible: z.boolean().nullable(),
  checkedAt: z.string().nullable(),
  diagnostics: z.array(connectionDiagnosticSchema),
  discovery: openCodeDiscoverySchema.nullable(),
});

export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

/** Backwards-compatible engine summary used by older local clients. */
export const engineStatusSchema = z.object({
  available: z.boolean(),
  state: openCodeConnectionStateSchema,
  serverVersion: z.string().nullable(),
  model: z.string().nullable(),
  modelAvailable: z.boolean(),
  limitation: z.string().nullable(),
});

export type EngineStatus = z.infer<typeof engineStatusSchema>;

export const healthSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("unfinished-business"),
});
