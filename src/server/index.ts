import { randomBytes } from "node:crypto";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { probeNativeEngine } from "./opencode/client.ts";
import { AtomicProjectStore } from "./store/atomic-project-store.ts";
import { createProject } from "./workflow/model.ts";
import { WorkflowService } from "./workflow/service.ts";

const port = Number(process.env.UB_PORT ?? 4200);
const hostname = "127.0.0.1";
const baseUrl = process.env.OPENCODE_BASE_URL ?? "http://127.0.0.1:4096";
const dataDirectory = resolve(process.env.UB_DATA_DIR ?? ".unfinished-business");
const store = new AtomicProjectStore(resolve(dataDirectory, "project.json"));
try {
  await access(store.path);
} catch {
  await store.initialize(createProject(process.cwd()));
}
const sessionToken = process.env.UB_SESSION_TOKEN ?? randomBytes(32).toString("base64url");

const app = createApp(() => probeNativeEngine({
  baseUrl,
  password: process.env.OPENCODE_PASSWORD,
}), { service: new WorkflowService(store), sessionToken });

serve({ fetch: app.fetch, hostname, port }, ({ address, port: boundPort }) => {
  console.log(`Unfinished Business listening on http://${address}:${boundPort}`);
});
