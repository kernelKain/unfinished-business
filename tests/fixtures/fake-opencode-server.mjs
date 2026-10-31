#!/usr/bin/env node
import { createServer } from "node:http";

const port = Number(process.env.FAKE_OPENCODE_PORT ?? 4291);
const password = process.env.FAKE_OPENCODE_PASSWORD ?? "test-password";
const directory = process.env.FAKE_OPENCODE_DIRECTORY ?? process.cwd();

const model = {
  id: "flint-40b-free",
  modelID: "flint-40b-free",
  providerID: "opencode",
  family: "flint",
  name: "Flint 40B Free",
  compatibility: { reasoningField: "reasoning_content" },
  settings: { apiKey: "never-return-this", baseURL: "https://opencode.invalid/v1" },
  variants: [{ id: "low" }, { id: "medium" }, { id: "high" }],
  cost: [{ input: 0, output: 0, cache: { read: 0, write: 0 } }],
  status: "active",
  enabled: true,
  limit: { context: 262_144, output: 65_536 },
  capabilities: { tools: true, input: ["text"], output: ["text"], temperature: true },
};

const routes = {
  "/api/model": { location: { directory }, data: [model] },
  "/api/provider": {
    location: { directory },
    data: [
      { id: "opencode", name: "OpenCode", activation: "enabled", package: "fake", settings: { apiKey: "never-return-this" } },
      { id: "ollama", name: "Ollama", activation: "enabled", package: "fake", settings: { baseURL: "http://127.0.0.1:11434/v1" } },
    ],
  },
  "/api/integration": { location: { directory }, data: [] },
  "/api/agent": {
    location: { directory },
    data: [
      { id: "build", name: "Build", mode: "primary", hidden: false, description: "Build", permissions: [{ action: "*", resource: "*", effect: "allow" }] },
      { id: "plan", name: "Plan", mode: "primary", hidden: false, description: "Plan", permissions: [] },
      { id: "maker", name: "Maker", mode: "primary", hidden: false, description: "Maker", permissions: [] },
    ],
  },
  "/api/permission/request": { location: { directory }, data: [] },
  "/api/command": { location: { directory }, data: [{ name: "review", description: "Review changes" }] },
  "/api/skill": { location: { directory }, data: [{ id: "browser", name: "Browser", description: "Use the browser" }] },
  "/api/mcp": { location: { directory }, data: [] },
  "/api/config": [{ type: "document", info: { formatter: { prettier: { disabled: false } }, lsp: { typescript: { disabled: false } } } }],
};

function authorized(request) {
  const header = request.headers.authorization;
  if (!header?.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  return decoded === `opencode:${password}`;
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  if (url.pathname === "/api/info") {
    if (!authorized(request)) {
      response.writeHead(401, { "content-type": "application/json" });
      response.end(JSON.stringify({ _tag: "UnauthorizedError", message: "Authentication required" }));
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ version: "2.0.32", pid: process.pid, urls: [`http://127.0.0.1:${port}`], paths: { tmp: "/tmp" }, capabilities: { persistentPty: false } }));
    return;
  }
  if (!authorized(request)) {
    response.writeHead(401, { "content-type": "application/json" });
    response.end(JSON.stringify({ _tag: "UnauthorizedError", message: "Authentication required" }));
    return;
  }
  const body = routes[url.pathname];
  if (body !== undefined) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
    return;
  }
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ _tag: "NotFound", message: `Unknown fake route ${url.pathname}` }));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`fake-opencode listening on http://127.0.0.1:${port}`);
});
