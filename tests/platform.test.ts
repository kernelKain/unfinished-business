import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { delimiter, join, resolve } from "node:path";
import test from "node:test";
import {
  classifyCliVersion,
  classifyServerStartError,
  describePlatform,
  openCodeExecutableCandidates,
  parseOpenCodeVersion,
  resolveOpenCodeExecutable,
  serverStartDiagnostic,
  type CliProbeResult,
} from "../src/server/opencode/executable.ts";
import { TESTED_OPENCODE_VERSION } from "../src/shared/opencode.ts";
import { setupTabs } from "../src/web/setup.ts";

const localBinary = resolve("node_modules/@opencode/cli/bin/opencode.exe");

function probeMap(entries: Record<string, CliProbeResult>) {
  return (executable: string): CliProbeResult =>
    entries[resolve(executable)] ?? { status: "missing", version: null };
}

test("platform support is limited to configurations with recorded evidence", () => {
  for (const [platform, arch] of [["linux", "x64"], ["darwin", "arm64"], ["darwin", "x64"]] as const) {
    const result = describePlatform(platform, arch);
    assert.equal(result.id, `${platform}-${arch}`);
    assert.equal(result.supported, true);
  }
  for (const [platform, arch] of [
    ["linux", "arm64"],
    ["win32", "x64"],
    ["darwin", "ia32"],
    ["freebsd", "x64"],
  ] as const) {
    const result = describePlatform(platform, arch);
    assert.equal(result.supported, false, `${platform}-${arch} must not be claimed`);
  }
});

test("candidate order prefers an explicit executable, then PATH, then the local pin", () => {
  const cwd = "/repo";
  const candidates = openCodeExecutableCandidates({
    cwd,
    env: {
      UB_OPENCODE_EXECUTABLE: "/custom/opencode",
      PATH: ["/global/bin", "/home/person/.local/bin"].join(delimiter),
    },
  });
  assert.deepEqual(candidates.map((candidate) => candidate.source), ["configured", "path", "path", "local"]);
  assert.equal(candidates[1].path, resolve("/global/bin/opencode"));
  assert.equal(candidates[3].path, resolve(join(cwd, "node_modules", "@opencode", "cli", "bin", "opencode.exe")));
});

test("a compatible globally installed CLI is preferred over the local package", () => {
  const global = resolve("/global/bin/opencode");
  const result = resolveOpenCodeExecutable({
    cwd: "/repo",
    env: { PATH: "/global/bin" },
    probe: probeMap({
      [global]: { status: "ok", version: TESTED_OPENCODE_VERSION },
      [localBinary]: { status: "ok", version: TESTED_OPENCODE_VERSION },
    }),
  });
  assert.equal(result.executable, global);
  assert.equal(result.source, "path");
  assert.deepEqual(result.diagnostics, []);
});

test("an incompatible global CLI is skipped in favor of a compatible local pin", () => {
  const global = resolve("/global/bin/opencode");
  const result = resolveOpenCodeExecutable({
    cwd: process.cwd(),
    env: { PATH: "/global/bin" },
    probe: probeMap({
      [global]: { status: "ok", version: "3.1.0" },
      [localBinary]: { status: "ok", version: TESTED_OPENCODE_VERSION },
    }),
  });
  assert.equal(result.executable, localBinary);
  assert.equal(result.source, "local");
  assert.equal(result.version, TESTED_OPENCODE_VERSION);
});

test("a different 2.x patch resolves with an untested-version warning", () => {
  const global = resolve("/global/bin/opencode");
  const result = resolveOpenCodeExecutable({
    cwd: "/repo",
    env: { PATH: "/global/bin" },
    probe: probeMap({ [global]: { status: "ok", version: "2.1.0" } }),
  });
  assert.equal(result.executable, global);
  assert.equal(result.diagnostics[0]?.code, "OPENCODE_CLI_VERSION_UNTESTED");
  assert.equal(result.diagnostics[0]?.severity, "warning");
});

test("missing, permission, unusable, and incompatible binaries have distinct diagnostics", () => {
  const missing = resolveOpenCodeExecutable({
    cwd: "/repo",
    env: { PATH: "/global/bin" },
    probe: probeMap({}),
  });
  assert.equal(missing.executable, null);
  assert.equal(missing.diagnostics[0]?.code, "OPENCODE_CLI_MISSING");

  const permission = resolveOpenCodeExecutable({
    cwd: "/repo",
    env: { PATH: "/global/bin" },
    probe: probeMap({ [resolve("/global/bin/opencode")]: { status: "permission", version: null } }),
  });
  assert.equal(permission.diagnostics[0]?.code, "OPENCODE_CLI_PERMISSION_DENIED");

  const unusable = resolveOpenCodeExecutable({
    cwd: "/repo",
    env: { PATH: "/global/bin" },
    probe: probeMap({ [resolve("/global/bin/opencode")]: { status: "unusable", version: null } }),
  });
  assert.equal(unusable.diagnostics[0]?.code, "OPENCODE_CLI_MISSING");
  assert.match(unusable.diagnostics[0]?.message ?? "", /did not report a version/i);

  const incompatible = resolveOpenCodeExecutable({
    cwd: "/repo",
    env: { PATH: "/global/bin" },
    probe: probeMap({ [resolve("/global/bin/opencode")]: { status: "ok", version: "1.19.5" } }),
  });
  assert.equal(incompatible.diagnostics[0]?.code, "OPENCODE_CLI_VERSION_INCOMPATIBLE");
  assert.match(incompatible.diagnostics[0]?.message ?? "", /1\.19\.5/);
});

test("unsupported architectures fail before probing any executable", () => {
  let probes = 0;
  const result = resolveOpenCodeExecutable({
    platform: "linux",
    arch: "arm64",
    env: { PATH: "/global/bin" },
    probe: () => {
      probes += 1;
      return { status: "ok", version: TESTED_OPENCODE_VERSION };
    },
  });
  assert.equal(probes, 0);
  assert.equal(result.executable, null);
  assert.equal(result.diagnostics[0]?.code, "OPENCODE_PLATFORM_UNSUPPORTED");
  assert.match(result.diagnostics[0]?.message ?? "", /linux-arm64/);
});

test("version parsing and compatibility cover the CLI output shapes", () => {
  assert.equal(parseOpenCodeVersion("opencode v2.0.32"), "2.0.32");
  assert.equal(parseOpenCodeVersion("2.0.32\n"), "2.0.32");
  assert.equal(parseOpenCodeVersion("opencode 2.0.32-beta.1"), "2.0.32");
  assert.equal(parseOpenCodeVersion("not a version"), null);
  assert.deepEqual(classifyCliVersion("2.0.32"), { compatible: true, tested: true, major: 2 });
  assert.deepEqual(classifyCliVersion("2.2.5"), { compatible: true, tested: false, major: 2 });
  assert.deepEqual(classifyCliVersion("3.0.0"), { compatible: false, tested: false, major: 3 });
  assert.deepEqual(classifyCliVersion(null), { compatible: false, tested: false, major: null });
});

test("server start failures are classified without exposing a path", () => {
  const missing = classifyServerStartError(Object.assign(new Error("spawn failed"), { code: "ENOENT" }));
  assert.equal(missing.code, "OPENCODE_CLI_MISSING");

  const permission = classifyServerStartError(Object.assign(new Error("spawn failed"), { code: "EACCES" }));
  assert.equal(permission.code, "OPENCODE_CLI_PERMISSION_DENIED");

  const failed = serverStartDiagnostic(1, null);
  assert.equal(failed.code, "OPENCODE_SERVER_START_FAILED");
  assert.match(failed.message, /exited with code 1/);
  assert.doesNotMatch(`${missing.message} ${permission.message} ${failed.message}`, /\/home\/|\/Users\/|\/tmp\//);
});

test("the repository installs the official cross-platform CLI, not a Linux-only package", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
    dependencies: Record<string, string>;
  };
  assert.equal(packageJson.dependencies["@opencode/cli"], TESTED_OPENCODE_VERSION);
  assert.equal(packageJson.dependencies["@opencode/client"], TESTED_OPENCODE_VERSION);
  assert.equal(packageJson.dependencies["@opencode/cli-linux-x64-baseline"], undefined);

  const lock = await readFile("package-lock.json", "utf8");
  assert.match(lock, /"@opencode\/cli-darwin-arm64"/);
  assert.match(lock, /"@opencode\/cli-darwin-x64"/);
  assert.match(lock, /"@opencode\/cli-linux-x64"/);
});

test("user-facing setup commands are platform-neutral and name npm and Homebrew installs", () => {
  const commands = setupTabs.map((tab) => tab.command).join("\n");
  const notes = setupTabs.map((tab) => tab.note).join("\n");
  assert.doesNotMatch(commands, /cli-linux|node_modules\/@opencode\/cli-linux/);
  assert.match(commands, /npx --no-install opencode serve/);
  assert.match(notes, /npm install -g @opencode\/cli@2\.0\.32/);
  assert.match(notes, /brew install anomalyco\/tap\/opencode-v2/);
  assert.match(notes, /macOS Apple Silicon/);
  assert.match(notes, /macOS Intel/);
});

test("CI exercises Linux, macOS Apple Silicon, macOS Intel, and the OpenCode smoke path", async () => {
  const workflow = await readFile(".github/workflows/sentry-release.yml", "utf8");
  assert.match(workflow, /ubuntu-latest/);
  assert.match(workflow, /macos-15$/m);
  assert.match(workflow, /macos-15-intel/);
  assert.match(workflow, /npm run test:platform/);
  assert.match(workflow, /npm run diagnose:platform/);
  assert.match(workflow, /npm run smoke:opencode/);
});

test("the installed CLI resolves on this supported host", { skip: describePlatform().supported ? false : "unsupported host" }, () => {
  const result = resolveOpenCodeExecutable({
    cwd: process.cwd(),
    env: { PATH: "" },
  });
  assert.equal(result.executable, localBinary);
  assert.equal(result.source, "local");
  assert.equal(result.version, TESTED_OPENCODE_VERSION);
  assert.deepEqual(result.diagnostics, []);
});
