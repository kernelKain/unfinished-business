import { Hono } from "hono";
import { healthSchema, nativeEngineStatusSchema, type NativeEngineStatus } from "../shared/contracts.ts";

export type EngineProbe = () => Promise<NativeEngineStatus>;

export function createApp(probe: EngineProbe) {
  const app = new Hono();

  app.get("/api/health", (context) => context.json(healthSchema.parse({
    status: "ok",
    service: "unfinished-business",
  })));

  app.get("/api/engine", async (context) => {
    const status = nativeEngineStatusSchema.parse(await probe());
    return context.json(status, status.available ? 200 : 503);
  });

  return app;
}
