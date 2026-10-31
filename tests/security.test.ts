import assert from "node:assert/strict";
import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { isLoopbackHost, loadConfig, publicRuntimeConfig } from "../src/server/config.ts";
import {
  assertAllowedUrl,
  createSafeFetch,
  NetworkPolicyError,
  validateBaseUrlSyntax,
} from "../src/server/security/network.ts";
import {
  assertNotBroadRoot,
  assertRegularFile,
  assertSafeRelativePath,
  canonicalizeDirectoryRoot,
  resolveStaticFile,
  WorkspacePolicyError,
} from "../src/server/security/workspace.ts";
import {
  redactError,
  redactText,
  redactUnknown,
  safePublicError,
  sanitizeSentryEvent,
} from "../src/server/security/redaction.ts";
import { createLogger } from "../src/server/observability/logger.ts";
import { runtimeConfigSchema } from "../src/shared/contracts.ts";

test("rejects broad filesystem, home, temporary, and repository roots", async () => {
  for (const root of ["/", homedir(), tmpdir(), process.cwd()]) {
    assert.throws(() => assertNotBroadRoot(root), WorkspacePolicyError);
  }
  await assert.rejects(canonicalizeDirectoryRoot("/"), WorkspacePolicyError);
});

test("rejects traversal and symlink escapes from a workspace root", async () => {
  assert.throws(() => assertSafeRelativePath("../secret"), WorkspacePolicyError);
  assert.throws(() => assertSafeRelativePath("nested/../../secret"), WorkspacePolicyError);
  assert.throws(() => assertSafeRelativePath("bad\0name"), WorkspacePolicyError);

  const parent = await mkdtemp(join(tmpdir(), "ub-workspace-"));
  const root = join(parent, "root");
  const outside = join(parent, "outside");
  await mkdir(root);
  await mkdir(outside);
  await writeFile(join(outside, "secret.txt"), "outside");
  await symlink(join(outside, "secret.txt"), join(root, "escape.txt"));

  await assert.rejects(resolveStaticFile(root, "escape.txt"), /escaped the web root|symlink/i);
  assert.equal(await resolveStaticFile(root, "missing.txt"), null);

  const linkedRoot = join(parent, "linked-root");
  await symlink(outside, linkedRoot);
  await assert.rejects(
    canonicalizeDirectoryRoot(linkedRoot, { allowedParent: root }),
    WorkspacePolicyError,
  );
});

test("rejects special files and non-files for persisted state", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ub-special-"));
  await assert.rejects(assertRegularFile(directory), WorkspacePolicyError);
  const file = join(directory, "state.json");
  await writeFile(file, "{}");
  await assertRegularFile(file);
  await writeFile(join(directory, "target.json"), "{}");
  await symlink(join(directory, "target.json"), join(directory, "linked.json"));
  await assert.rejects(assertRegularFile(join(directory, "linked.json")), WorkspacePolicyError);
});

test("accepts loopback HTTP but requires HTTPS and an explicit host for remote OpenCode", async () => {
  assert.equal(validateBaseUrlSyntax("http://127.0.0.1:4096").hostname, "127.0.0.1");
  assert.throws(() => validateBaseUrlSyntax("http://user:pass@127.0.0.1:4096"), NetworkPolicyError);
  assert.throws(() => validateBaseUrlSyntax("file:///tmp/opencode.sock"), NetworkPolicyError);
  assert.throws(() => validateBaseUrlSyntax("http://127.0.0.1:4096/?token=secret"), NetworkPolicyError);

  await assertAllowedUrl(new URL("http://127.0.0.1:4096"), { baseUrl: "http://127.0.0.1:4096" });
  await assert.rejects(
    assertAllowedUrl(new URL("http://opencode.example.com"), { baseUrl: "http://opencode.example.com" }),
    (error: unknown) => error instanceof NetworkPolicyError && error.code === "OPENCODE_INSECURE_REMOTE",
  );
  await assert.rejects(
    assertAllowedUrl(new URL("https://opencode.example.com"), { baseUrl: "https://opencode.example.com" }),
    (error: unknown) => error instanceof NetworkPolicyError && error.code === "OPENCODE_HOST_BLOCKED",
  );
  await assert.rejects(
    assertAllowedUrl(new URL("https://opencode.example.com:4097"), {
      baseUrl: "https://opencode.example.com:4097",
      allowedHosts: ["opencode.example.com"],
      allowedPorts: [4096],
      resolver: async () => [{ address: "8.8.8.8", family: 4 }],
    }),
    (error: unknown) => error instanceof NetworkPolicyError && error.code === "OPENCODE_PORT_BLOCKED",
  );
  assert.throws(() => validateBaseUrlSyntax("https://opencode.example.com:0"), /port 0/i);
});

test("blocks metadata, loopback rebinding, and private DNS unless explicitly allowed", async () => {
  const base = {
    baseUrl: "https://opencode.example.com",
    allowedHosts: ["opencode.example.com"],
  };
  await assert.rejects(
    assertAllowedUrl(new URL(base.baseUrl), { ...base, resolver: async () => [{ address: "169.254.169.254", family: 4 }] }),
    (error: unknown) => error instanceof NetworkPolicyError && error.code === "OPENCODE_PRIVATE_ADDRESS",
  );
  await assert.rejects(
    assertAllowedUrl(new URL(base.baseUrl), { ...base, resolver: async () => [{ address: "127.0.0.1", family: 4 }] }),
    (error: unknown) => error instanceof NetworkPolicyError && error.code === "OPENCODE_PRIVATE_ADDRESS",
  );
  await assert.rejects(
    assertAllowedUrl(new URL(base.baseUrl), { ...base, resolver: async () => [{ address: "10.1.2.3", family: 4 }] }),
    (error: unknown) => error instanceof NetworkPolicyError && error.code === "OPENCODE_PRIVATE_ADDRESS",
  );
  await assertAllowedUrl(new URL(base.baseUrl), {
    ...base,
    allowPrivateNetwork: true,
    resolver: async () => [{ address: "10.1.2.3", family: 4 }],
  });
});

test("revalidates DNS on every request and blocks redirects and oversized bodies", async () => {
  let lookups = 0;
  let requestCount = 0;
  const safeFetch = createSafeFetch({
    baseUrl: "https://opencode.example.com",
    allowedHosts: ["opencode.example.com"],
    requestTimeoutMs: 500,
    maxResponseBytes: 16,
    resolver: async () => {
      lookups += 1;
      return lookups === 1 ? [{ address: "8.8.8.8", family: 4 }] : [{ address: "127.0.0.1", family: 4 }];
    },
    fetchImpl: async () => {
      requestCount += 1;
      return new Response("ok", { status: 200 });
    },
  });

  const first = await safeFetch("https://opencode.example.com/health");
  assert.equal(await first.text(), "ok");
  await assert.rejects(
    safeFetch("https://opencode.example.com/health"),
    (error: unknown) => error instanceof NetworkPolicyError && error.code === "OPENCODE_PRIVATE_ADDRESS",
  );
  assert.equal(requestCount, 1);

  const redirecting = createSafeFetch({
    baseUrl: "https://opencode.example.com",
    allowedHosts: ["opencode.example.com"],
    resolver: async () => [{ address: "8.8.8.8", family: 4 }],
    fetchImpl: async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1:4096" } }),
  });
  await assert.rejects(redirecting("https://opencode.example.com"), /redirect/i);

  const oversized = createSafeFetch({
    baseUrl: "https://opencode.example.com",
    allowedHosts: ["opencode.example.com"],
    maxResponseBytes: 8,
    resolver: async () => [{ address: "8.8.8.8", family: 4 }],
    fetchImpl: async () => new Response("this is much longer than eight bytes", { status: 200 }),
  });
  const response = await oversized("https://opencode.example.com");
  await assert.rejects(response.text(), (error: unknown) => error instanceof NetworkPolicyError && error.code === "OPENCODE_RESPONSE_TOO_LARGE");
});

test("times out a hanging OpenCode request without following it", async () => {
  const safeFetch = createSafeFetch({
    baseUrl: "https://opencode.example.com",
    allowedHosts: ["opencode.example.com"],
    requestTimeoutMs: 20,
    resolver: async () => [{ address: "8.8.8.8", family: 4 }],
    fetchImpl: async (_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }),
  });
  await assert.rejects(
    safeFetch("https://opencode.example.com/slow"),
    (error: unknown) => error instanceof NetworkPolicyError && error.code === "OPENCODE_TIMEOUT",
  );
});

test("loadConfig enforces mode-specific secure defaults", () => {
  const local = loadConfig({ NODE_ENV: "development", OPENCODE_BASE_URL: "http://127.0.0.1:4096" });
  assert.equal(local.mode, "local");
  assert.equal(local.hostname, "127.0.0.1");
  assert.equal(local.access, null);
  assert.equal(runtimeConfigSchema.parse(publicRuntimeConfig(local)).demoWorkspace, true);

  assert.throws(() => loadConfig({ UB_MODE: "local", UB_HOST: "0.0.0.0" }), /loopback/i);

  // The public demo is deliberately unauthenticated and read-only. It needs
  // no session token or access password; private-hosted remains protected.
  const demo = loadConfig({
    UB_MODE: "hosted-demo",
    UB_PUBLIC_URL: "https://demo.example.com",
  });
  assert.equal(demo.mode, "hosted-demo");
  assert.equal(demo.hostname, "0.0.0.0");
  assert.equal(demo.access, null);

  assert.throws(() => loadConfig({ UB_MODE: "private-hosted", UB_PUBLIC_URL: "https://demo.example.com" }), /UB_SESSION_TOKEN/);
  assert.throws(() => loadConfig({
    UB_MODE: "private-hosted",
    UB_PUBLIC_URL: "https://demo.example.com",
    UB_SESSION_TOKEN: "token",
  }), /UB_ACCESS_PASSWORD/);
  assert.throws(() => loadConfig({
    UB_MODE: "private-hosted",
    UB_PUBLIC_URL: "http://demo.example.com",
    UB_SESSION_TOKEN: "token",
    UB_ACCESS_PASSWORD: "password",
  }), /HTTPS/);

  const hosted = loadConfig({
    UB_MODE: "private-hosted",
    UB_PUBLIC_URL: "https://demo.example.com",
    UB_SESSION_TOKEN: "token",
    UB_ACCESS_PASSWORD: "password",
  });
  assert.equal(hosted.mode, "private-hosted");
  assert.equal(hosted.hostname, "0.0.0.0");
  assert.equal(hosted.access?.username, "unfinished-business");
  assert.ok(isLoopbackHost("localhost"));
});

test("session spending limits support unlimited, disabled, and positive values", () => {
  const base = { NODE_ENV: "development", OPENCODE_BASE_URL: "http://127.0.0.1:4096" };
  for (const value of ["unlimited", "disabled", "0", "0.0"]) {
    const config = loadConfig({ ...base, UB_MAX_SESSION_COST_USD: value });
    assert.equal(config.limits.maxSessionCostUsd, null);
    assert.equal(publicRuntimeConfig(config).budgets.maxSessionCostUsd, null);
  }
  const positive = loadConfig({ ...base, UB_MAX_SESSION_COST_USD: "2.75" });
  assert.equal(positive.limits.maxSessionCostUsd, 2.75);
  assert.equal(publicRuntimeConfig(positive).budgets.maxSessionCostUsd, 2.75);
  assert.throws(() => loadConfig({ ...base, UB_MAX_SESSION_COST_USD: "-1" }), /positive number/i);
  assert.throws(() => loadConfig({ ...base, UB_MAX_SESSION_COST_USD: "not-a-number" }), /positive number/i);
});

test("redacts credentials, cookies, provider keys, DSNs, identity, and local paths", () => {
  const source = [
    "Authorization: Bearer abc.def.ghi",
    "Cookie: session=supersecret",
    "OPENCODE_PASSWORD=hunter2",
    "key sk-abcdefghijklmnopqrstuvwxyz",
    "dsn https://public@o123.ingest.sentry.io/456",
    "user person@example.com",
    `path ${homedir()}/private/project`,
  ].join("\n");
  const redacted = redactText(source, { hideLocalPaths: true });
  for (const secret of ["abc.def.ghi", "supersecret", "hunter2", "sk-abcdefghijklmnopqrstuvwxyz", "person@example.com", `${homedir()}/private`]) {
    assert.equal(redacted.includes(secret), false, secret);
  }
  assert.match(redacted, /\[REDACTED\]/);
  assert.match(redacted, /\[REDACTED_HOME\]/);
  assert.equal(redactText("open /srv/private/app", { hideLocalPaths: true }).includes("/srv/private"), false);
  assert.equal(safePublicError(new Error("OPENCODE_PASSWORD=secret"), "fallback"), "OPENCODE_PASSWORD=[REDACTED]");
  assert.match(redactError(new Error("Authorization: Bearer secret"))!.message, /\[REDACTED\]/);
  assert.equal((redactUnknown({ password: "secret", nested: { token: "secret" } }) as { password: string }).password, "[REDACTED]");
});

test("sanitizes Sentry events and structured logs independently", () => {
  const event = sanitizeSentryEvent({
    message: "request failed for person@example.com",
    request: { url: "https://demo.example.com/api?token=secret", headers: { authorization: "Bearer secret" }, data: { password: "secret" }, cookies: "a=b" },
    user: { email: "person@example.com" },
    exception: { values: [{ value: "OPENCODE_PASSWORD=hunter2" }] },
    breadcrumbs: [{ message: "Cookie: secret", data: { token: "secret" } }],
    extra: { apiKey: "secret" },
  });
  assert.equal(JSON.stringify(event).includes("hunter2"), false);
  assert.equal(JSON.stringify(event).includes("person@example.com"), false);
  assert.equal((event as { request: { url: string } }).request.url, "https://demo.example.com/api");
  assert.equal((event as { user?: unknown }).user, undefined);

  const lines: string[] = [];
  const logger = createLogger({ sink: (line) => lines.push(line), redact: { hideLocalPaths: true } });
  logger.error("failed", { authorization: "Bearer secret", password: "hunter2", path: `${homedir()}/x` });
  assert.equal(lines[0].includes("secret"), false);
  assert.equal(lines[0].includes("hunter2"), false);
});
