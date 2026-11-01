import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { openCodeReachable, portIsFree } from "../src/server/launch-check.ts";

async function listen(handler: Parameters<typeof createServer>[1]): Promise<{ server: Server; port: number }> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, port: (server.address() as AddressInfo).port };
}

test("a port already held by another process is reported as busy", async () => {
  const { server, port } = await listen((_request, response) => response.end("ok"));
  try {
    assert.equal(await portIsFree(port, "127.0.0.1"), false);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  assert.equal(await portIsFree(port, "127.0.0.1"), true);
});

test("OpenCode reachability accepts its health route and auth challenges, and rejects other servers", async () => {
  const opencode = await listen((request, response) => {
    if (request.url === "/global/health") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ healthy: true }));
      return;
    }
    response.statusCode = 404;
    response.end();
  });
  const locked = await listen((_request, response) => {
    response.statusCode = 401;
    response.end();
  });
  const other = await listen((_request, response) => {
    response.statusCode = 404;
    response.end();
  });
  try {
    assert.equal(await openCodeReachable(`http://127.0.0.1:${(opencode.server.address() as AddressInfo).port}`), true);
    assert.equal(await openCodeReachable(`http://127.0.0.1:${(locked.server.address() as AddressInfo).port}/`), true);
    assert.equal(await openCodeReachable(`http://127.0.0.1:${(other.server.address() as AddressInfo).port}`), false);
    assert.equal(await openCodeReachable(`http://127.0.0.1:${opencode.port + 1000}`, 500), false);
  } finally {
    await Promise.all([opencode, locked, other].map(({ server }) => new Promise<void>((resolve) => server.close(() => resolve()))));
  }
});
