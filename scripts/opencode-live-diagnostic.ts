import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConnectionService } from "../src/server/opencode/connection.ts";
import { createNativeClient, redactSecrets } from "../src/server/opencode/client.ts";

const enabled = process.env.OPENCODE_LIVE_DIAGNOSTIC === "1";
if (!enabled) {
  console.log(JSON.stringify({
    status: "SKIP",
    message: "Set OPENCODE_LIVE_DIAGNOSTIC=1 to connect to a running OpenCode server. This script performs no model inference.",
  }, null, 2));
  process.exit(0);
}

const baseUrl = process.env.OPENCODE_BASE_URL?.trim() || "http://127.0.0.1:4096";
const password = process.env.OPENCODE_PASSWORD?.trim();
const username = process.env.OPENCODE_USERNAME?.trim() || "opencode";
const dataDir = await mkdtemp(join(tmpdir(), "ub-live-"));
const workspace = join(dataDir, "workspace");
await import("node:fs/promises").then(({ mkdir }) => mkdir(workspace, { recursive: true }));

try {
  const connection = new ConnectionService({
    dataDir,
    deploymentMode: "local",
    envBaseUrl: baseUrl,
    envUsername: username,
    envPassword: password,
  });
  await connection.load();
  const status = await connection.check();
  const discovery = status.discovery;
  let sessionApi: { available: boolean; detail: string } = { available: false, detail: "Discovery did not complete." };
  if (discovery) {
    const available = discovery.models.find((model) => model.availability === "available");
    if (!available) {
      sessionApi = { available: false, detail: "No available model exists for a harmless session create/get/remove check." };
    } else {
      try {
        const client = createNativeClient({ baseUrl, username, password });
        const created = await client.session.create({
          title: "Unfinished Business compatibility probe",
          location: { directory: workspace },
          model: { providerID: available.providerID, id: available.id },
        });
        const fetched = await client.session.get({ sessionID: created.id });
        await client.session.remove({ sessionID: created.id });
        sessionApi = {
          available: fetched.id === created.id,
          detail: "Created, read, and removed a disposable empty session. No prompt was sent and no model was called.",
        };
      } catch (error) {
        sessionApi = {
          available: false,
          detail: redactSecrets(error instanceof Error ? error.message : "Session API check failed."),
        };
      }
    }
  }
  console.log(JSON.stringify({
    status: status.state === "connected" || status.state === "degraded" ? "COMPATIBLE" : "BLOCKED",
    state: status.state,
    serverVersion: status.serverVersion,
    testedVersion: discovery?.server.testedVersion ?? null,
    compatibleMajor: discovery?.server.compatible ?? false,
    baseUrl,
    passwordSupplied: Boolean(password),
    counts: {
      providers: discovery?.providers.length ?? 0,
      models: discovery?.models.length ?? 0,
      agents: discovery?.agents.length ?? 0,
      commands: discovery?.commands.length ?? 0,
      skills: discovery?.skills.length ?? 0,
      mcpServers: discovery?.mcpServers.length ?? 0,
    },
    sessionApi,
    diagnostics: status.diagnostics,
    limitations: discovery?.limitations ?? [],
    note: "No prompt, model call, provider credential read, or project write occurred.",
  }, null, 2));
  process.exitCode = sessionApi.available || status.state === "degraded" ? 0 : status.state === "connected" ? 0 : 1;
} catch (error) {
  console.error(JSON.stringify({
    status: "BLOCKED",
    message: redactSecrets(error instanceof Error ? error.message : String(error)),
  }, null, 2));
  process.exitCode = 1;
} finally {
  await rm(dataDir, { recursive: true, force: true });
}
