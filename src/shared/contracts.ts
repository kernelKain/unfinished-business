import { z } from "zod";

export const nativeEngineStatusSchema = z.object({
  available: z.boolean(),
  serverVersion: z.string().regex(/^2\./).nullable(),
  model: z.literal("opencode/deepseek-v4.1-flash-free"),
  modelAvailable: z.boolean(),
  limitation: z.string().nullable(),
});

export type NativeEngineStatus = z.infer<typeof nativeEngineStatusSchema>;

export const healthSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("unfinished-business"),
});
