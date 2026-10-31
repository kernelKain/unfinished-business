import { spawnSync } from "node:child_process";
import { delimiter, join, resolve } from "node:path";
import {
  SUPPORTED_OPENCODE_MAJOR,
  TESTED_OPENCODE_VERSION,
} from "../../shared/opencode.ts";

/**
 * Platforms with recorded automated evidence. Do not add a platform here
 * without a matching CI job or recorded manual verification.
 */
export const SUPPORTED_OPENCODE_PLATFORMS = [
  "linux-x64",
  "darwin-arm64",
  "darwin-x64",
] as const;

export type SupportedOpenCodePlatform = (typeof SUPPORTED_OPENCODE_PLATFORMS)[number];

export type OpenCodeRuntimeDiagnosticCode =
  | "OPENCODE_PLATFORM_UNSUPPORTED"
  | "OPENCODE_CLI_MISSING"
  | "OPENCODE_CLI_PERMISSION_DENIED"
  | "OPENCODE_CLI_VERSION_INCOMPATIBLE"
  | "OPENCODE_CLI_VERSION_UNTESTED"
  | "OPENCODE_SERVER_START_FAILED";

export interface OpenCodeRuntimeDiagnostic {
  code: OpenCodeRuntimeDiagnosticCode;
  severity: "info" | "warning" | "error";
  title: string;
  message: string;
  repair: string;
}

export interface PlatformDescription {
  id: string;
  platform: string;
  arch: string;
  supported: boolean;
}

export function describePlatform(
  platform: string = process.platform,
  arch: string = process.arch,
): PlatformDescription {
  const normalizedArch = arch === "x64" ? "x64" : arch === "arm64" ? "arm64" : arch;
  const id = `${platform}-${normalizedArch}`;
  return {
    id,
    platform,
    arch: normalizedArch,
    supported: (SUPPORTED_OPENCODE_PLATFORMS as readonly string[]).includes(id),
  };
}

const SUPPORTED_LABEL = "Linux x64, macOS Apple Silicon, or macOS Intel";

export function unsupportedPlatformDiagnostic(platform: PlatformDescription): OpenCodeRuntimeDiagnostic {
  return {
    code: "OPENCODE_PLATFORM_UNSUPPORTED",
    severity: "error",
    title: "Unsupported OpenCode platform",
    message: `OpenCode resolution supports ${SUPPORTED_LABEL}. This process reports ${platform.id}.`,
    repair: `Run Unfinished Business on ${SUPPORTED_LABEL}. Other platforms are not tested and are not claimed as supported.`,
  };
}

export function missingExecutableDiagnostic(): OpenCodeRuntimeDiagnostic {
  return {
    code: "OPENCODE_CLI_MISSING",
    severity: "error",
    title: "OpenCode executable was not found",
    message: "No usable opencode executable was found on PATH or in the pinned local package.",
    repair: "Run npm ci, or install OpenCode with npm install -g @opencode/cli@2.0.32. On macOS with Homebrew use brew install anomalyco/tap/opencode-v2. Verify with opencode --version.",
  };
}

export function permissionDiagnostic(): OpenCodeRuntimeDiagnostic {
  return {
    code: "OPENCODE_CLI_PERMISSION_DENIED",
    severity: "error",
    title: "OpenCode executable is not runnable",
    message: "A candidate OpenCode executable exists, but this process cannot execute it.",
    repair: "Fix ownership and execute permission on the OpenCode install, or reinstall with npm ci. Do not run the workshop with sudo.",
  };
}

export function incompatibleVersionDiagnostic(version: string | null): OpenCodeRuntimeDiagnostic {
  const found = version ? `OpenCode CLI ${version}` : "The OpenCode CLI";
  return {
    code: "OPENCODE_CLI_VERSION_INCOMPATIBLE",
    severity: "error",
    title: "OpenCode CLI version is incompatible",
    message: `${found} does not report the supported OpenCode ${SUPPORTED_OPENCODE_MAJOR}.x CLI major. This build is tested against ${TESTED_OPENCODE_VERSION}.`,
    repair: `Install the pinned CLI with npm install -g @opencode/cli@${TESTED_OPENCODE_VERSION}, or install the matching Homebrew tap, then retry.`,
  };
}

export function untestedVersionDiagnostic(version: string): OpenCodeRuntimeDiagnostic {
  return {
    code: "OPENCODE_CLI_VERSION_UNTESTED",
    severity: "warning",
    title: "Untested OpenCode CLI patch version",
    message: `OpenCode CLI ${version} is a ${SUPPORTED_OPENCODE_MAJOR}.x release, but this build is tested against ${TESTED_OPENCODE_VERSION}.`,
    repair: `Use OpenCode CLI ${TESTED_OPENCODE_VERSION} for the tested surface, or run npm run diagnose:opencode to verify the newer release.`,
  };
}

export function serverStartDiagnostic(exitCode: number | null = null, signal: string | null = null): OpenCodeRuntimeDiagnostic {
  const detail = exitCode !== null
    ? `The OpenCode server process exited with code ${exitCode} before it was ready.`
    : signal
      ? `The OpenCode server process stopped with signal ${signal} before it was ready.`
      : "The OpenCode server process did not start.";
  return {
    code: "OPENCODE_SERVER_START_FAILED",
    severity: "error",
    title: "OpenCode server failed to start",
    message: detail,
    repair: "Confirm the OpenCode 2.x CLI is installed, the loopback port is free, and OpenCode can write to its data and config directories. Run npm run diagnose:platform for executable diagnostics.",
  };
}

/** Classifies a child-process spawn failure without echoing the executable path. */
export function classifyServerStartError(error: unknown): OpenCodeRuntimeDiagnostic {
  const code = error && typeof error === "object"
    ? (error as NodeJS.ErrnoException).code
    : undefined;
  if (code === "ENOENT") return missingExecutableDiagnostic();
  if (code === "EACCES" || code === "EPERM") return permissionDiagnostic();
  return serverStartDiagnostic();
}

export function parseOpenCodeVersion(output: string): string | null {
  const match = /(?:^|\s)v?(\d+\.\d+\.\d+)(?:[-+][0-9A-Za-z.-]+)?(?:\s|$)/.exec(output.trim());
  return match ? match[1] : null;
}

export type CliProbeStatus = "ok" | "missing" | "permission" | "unusable";

export interface CliProbeResult {
  status: CliProbeStatus;
  version: string | null;
}

export interface ExecutableCandidate {
  path: string;
  source: "configured" | "path" | "local";
}

export interface ResolveOpenCodeOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  platform?: string;
  arch?: string;
  /** Test seam: probes a candidate without spawning it. */
  probe?: (executable: string, env: NodeJS.ProcessEnv) => CliProbeResult;
}

export interface OpenCodeExecutableResolution {
  platform: PlatformDescription;
  executable: string | null;
  source: ExecutableCandidate["source"] | null;
  version: string | null;
  diagnostics: OpenCodeRuntimeDiagnostic[];
}

export function openCodeExecutableCandidates(options: ResolveOpenCodeOptions = {}): ExecutableCandidate[] {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const platform = options.platform ?? process.platform;
  const candidates: ExecutableCandidate[] = [];
  const seen = new Set<string>();

  const add = (path: string, source: ExecutableCandidate["source"]) => {
    const absolute = resolve(path);
    if (seen.has(absolute)) return;
    seen.add(absolute);
    candidates.push({ path: absolute, source });
  };

  const configured = env.UB_OPENCODE_EXECUTABLE?.trim();
  if (configured) add(configured, "configured");

  for (const directory of (env.PATH ?? "").split(delimiter)) {
    if (directory) add(join(directory, platform === "win32" ? "opencode.exe" : "opencode"), "path");
  }

  // @opencode/cli's postinstall materializes the native binary here on every
  // supported platform, including a file named opencode.exe on macOS/Linux.
  add(join(cwd, "node_modules", "@opencode", "cli", "bin", "opencode.exe"), "local");

  return candidates;
}

function defaultProbe(executable: string, env: NodeJS.ProcessEnv): CliProbeResult {
  const result = spawnSync(executable, ["--version"], {
    encoding: "utf8",
    env,
    timeout: 10_000,
    windowsHide: true,
  });
  if (result.error) {
    const code = (result.error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { status: "missing", version: null };
    if (code === "EACCES" || code === "EPERM") return { status: "permission", version: null };
    return { status: "unusable", version: null };
  }
  if (result.status !== 0) return { status: "unusable", version: null };
  const version = parseOpenCodeVersion(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  return version ? { status: "ok", version } : { status: "unusable", version: null };
}

export interface CliVersionCompatibility {
  compatible: boolean;
  tested: boolean;
  major: number | null;
}

export function classifyCliVersion(version: string | null): CliVersionCompatibility {
  if (!version) return { compatible: false, tested: false, major: null };
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) return { compatible: false, tested: false, major: null };
  const major = Number(match[1]);
  return {
    compatible: major === SUPPORTED_OPENCODE_MAJOR,
    tested: version.trim() === TESTED_OPENCODE_VERSION,
    major,
  };
}

/**
 * Resolves a compatible OpenCode executable without logging its path.
 *
 * Order: explicit `UB_OPENCODE_EXECUTABLE`, then `opencode` on PATH (the
 * global/Homebrew/npm install), then the lockfile-installed `@opencode/cli`
 * binary. An incompatible global install is skipped so a compatible local
 * package can still be used.
 */
export function resolveOpenCodeExecutable(options: ResolveOpenCodeOptions = {}): OpenCodeExecutableResolution {
  const env = options.env ?? process.env;
  const platform = describePlatform(options.platform, options.arch);
  if (!platform.supported) {
    return {
      platform,
      executable: null,
      source: null,
      version: null,
      diagnostics: [unsupportedPlatformDiagnostic(platform)],
    };
  }

  const probe = options.probe ?? defaultProbe;
  let permissionSeen = false;
  let incompatibleVersion: string | null = null;
  let unusableSeen = false;

  for (const candidate of openCodeExecutableCandidates({ ...options, env })) {
    const result = probe(candidate.path, env);
    if (result.status === "missing") continue;
    if (result.status === "permission") {
      permissionSeen = true;
      continue;
    }
    if (result.status === "unusable") {
      unusableSeen = true;
      continue;
    }
    const compatibility = classifyCliVersion(result.version);
    if (!compatibility.compatible) {
      incompatibleVersion = result.version;
      continue;
    }
    return {
      platform,
      executable: candidate.path,
      source: candidate.source,
      version: result.version,
      diagnostics: compatibility.tested ? [] : [untestedVersionDiagnostic(result.version ?? "unknown")],
    };
  }

  const diagnostics: OpenCodeRuntimeDiagnostic[] = [];
  if (incompatibleVersion !== null) {
    diagnostics.push(incompatibleVersionDiagnostic(incompatibleVersion));
  } else if (permissionSeen) {
    diagnostics.push(permissionDiagnostic());
  } else if (unusableSeen) {
    diagnostics.push({
      ...missingExecutableDiagnostic(),
      message: "A candidate OpenCode launcher exists but did not report a version. Installation scripts may have been skipped.",
      repair: "Reinstall dependencies with npm ci so @opencode/cli can materialize its native binary, then retry.",
    });
  } else {
    diagnostics.push(missingExecutableDiagnostic());
  }
  return { platform, executable: null, source: null, version: null, diagnostics };
}
