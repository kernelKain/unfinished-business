import { OpenCode } from "@opencode/client";
import { nativeEngineStatusSchema, type NativeEngineStatus } from "../../shared/contracts.ts";

export const FREE_DEEPSEEK_MODEL = "opencode/deepseek-v4.1-flash-free" as const;

export interface NativeClientOptions {
  baseUrl: string;
  password?: string;
}

export function createNativeClient(options: NativeClientOptions) {
  const authorization = options.password
    ? `Basic ${Buffer.from(`opencode:${options.password}`).toString("base64")}`
    : undefined;

  return OpenCode.make({
    baseUrl: options.baseUrl,
    headers: authorization ? { authorization } : undefined,
  });
}

export async function probeNativeEngine(options: NativeClientOptions): Promise<NativeEngineStatus> {
  try {
    const client = createNativeClient(options);
    const [server, models] = await Promise.all([
      client.server.info(),
      client.model.list(),
    ]);
    const modelAvailable = models.data.some((model) =>
      `${model.providerID}/${model.id}` === FREE_DEEPSEEK_MODEL,
    );

    return nativeEngineStatusSchema.parse({
      available: true,
      serverVersion: server.version,
      model: FREE_DEEPSEEK_MODEL,
      modelAvailable,
      limitation: modelAvailable ? null : "The required free DeepSeek model is not in the native catalog.",
    });
  } catch (error) {
    return nativeEngineStatusSchema.parse({
      available: false,
      serverVersion: null,
      model: FREE_DEEPSEEK_MODEL,
      modelAvailable: false,
      limitation: error instanceof Error ? error.message : "Native OpenCode is unavailable.",
    });
  }
}
