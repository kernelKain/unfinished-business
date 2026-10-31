import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { probeNativeEngine } from "./opencode/client.ts";

const port = Number(process.env.UB_PORT ?? 4200);
const hostname = "127.0.0.1";
const baseUrl = process.env.OPENCODE_BASE_URL ?? "http://127.0.0.1:4096";

const app = createApp(() => probeNativeEngine({
  baseUrl,
  password: process.env.OPENCODE_PASSWORD,
}));

serve({ fetch: app.fetch, hostname, port }, ({ address, port: boundPort }) => {
  console.log(`Unfinished Business listening on http://${address}:${boundPort}`);
});
