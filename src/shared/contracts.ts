import { z } from "zod";

export {
  connectionStatusSchema,
  engineStatusSchema,
  healthSchema,
  openCodeConnectionStateSchema,
  openCodeDiscoverySchema,
  TESTED_OPENCODE_VERSION,
  SUPPORTED_OPENCODE_MAJOR,
  type ConnectionStatus,
  type DiscoveredModel,
  type EngineStatus,
  type OpenCodeConnectionState,
  type OpenCodeDiscovery,
} from "./opencode.ts";

export const nativeEngineStatusSchema = z.object({
  available: z.boolean(),
  serverVersion: z.string().nullable(),
  versionCompatible: z.boolean().default(true),
  authenticated: z.boolean().default(true),
  mode: z.enum(["local", "hosted-demo", "private-hosted"]).default("local"),
  model: z.string().nullable(),
  modelAvailable: z.boolean(),
  limitation: z.string().nullable(),
});

export type NativeEngineStatus = z.infer<typeof nativeEngineStatusSchema>;

export const runtimeConfigSchema = z.object({
  mode: z.enum(["local", "hosted-demo", "private-hosted"]),
  production: z.boolean(),
  demoWorkspace: z.literal(true),
  authRequired: z.boolean(),
  originProtection: z.literal(true),
  opencode: z.object({
    baseUrlKind: z.enum(["loopback", "remote"]),
    model: z.string().nullable(),
  }),
  budgets: z.object({
    guideTimeoutMs: z.number().int().positive(),
    makerTimeoutMs: z.number().int().positive(),
    nodeCheckTimeoutMs: z.number().int().positive(),
    maxSessionTokens: z.number().int().positive(),
    maxSessionCostUsd: z.number().nonnegative(),
    toolCallBudget: z.null(),
    toolCallBudgetLimitation: z.string(),
  }),
  limits: z.object({
    maxRequestBytes: z.number().int().positive(),
    rateLimitPerMinute: z.number().int().positive(),
    maxConcurrentMutations: z.number().int().positive(),
    maxSseConnections: z.number().int().positive(),
  }),
  retention: z.object({
    actions: z.number().int().positive(),
    approvals: z.number().int().positive(),
    operations: z.number().int().positive(),
    evidence: z.number().int().positive(),
    transcript: z.number().int().positive(),
    witnessDrafts: z.number().int().positive(),
    backups: z.number().int().positive(),
    corruptFiles: z.number().int().positive(),
    backupMaxAgeDays: z.number().int().positive(),
  }),
});

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;
