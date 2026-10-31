import { constants, realpathSync } from "node:fs";
import { lstat, mkdir, open, realpath, stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, parse, resolve, sep } from "node:path";

export type WorkspaceErrorCode =
  | "WORKSPACE_TRAVERSAL"
  | "WORKSPACE_ESCAPE"
  | "WORKSPACE_UNSAFE_ROOT"
  | "WORKSPACE_NOT_DIRECTORY"
  | "WORKSPACE_SPECIAL_FILE"
  | "STATIC_FILE_UNSAFE";

export class WorkspacePolicyError extends Error {
  constructor(readonly code: WorkspaceErrorCode, message: string) {
    super(message);
    this.name = "WorkspacePolicyError";
  }
}

const broadRoots = new Set([
  "/",
  "/bin",
  "/boot",
  "/dev",
  "/etc",
  "/home",
  "/lib",
  "/lib64",
  "/media",
  "/mnt",
  "/opt",
  "/proc",
  "/root",
  "/run",
  "/sbin",
  "/srv",
  "/sys",
  "/tmp",
  "/usr",
  "/var",
  "/var/data",
  "/var/log",
  "/var/tmp",
  "/Users",
  "/Volumes",
  "/private",
  "/private/tmp",
  "/private/var/tmp",
  "/private/var/folders",
  "/System",
]);

function normalized(path: string): string {
  return resolve(path).replace(/[\\/]+$/, "") || sep;
}

/** Resolves aliases such as macOS `/tmp` → `/private/tmp` when possible. */
function canonical(path: string): string {
  try {
    return normalized(realpathSync(path));
  } catch {
    return normalized(path);
  }
}

function isInside(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

export function assertNotBroadRoot(path: string): void {
  const resolved = normalized(path);
  const home = canonical(homedir());
  const temporary = canonical(tmpdir());
  const repository = canonical(process.cwd());
  const filesystemRoot = parse(resolved).root;

  if (
    resolved === filesystemRoot
    || broadRoots.has(resolved)
    || resolved === home
    || resolved === temporary
    || resolved === repository
    || resolved === normalized(dirname(home))
  ) {
    throw new WorkspacePolicyError(
      "WORKSPACE_UNSAFE_ROOT",
      "The configured workspace is a filesystem, home, temporary, or repository root. Choose a dedicated child directory.",
    );
  }
}

export interface CanonicalRoot {
  requested: string;
  real: string;
  device: number;
  inode: number;
}

export async function canonicalizeDirectoryRoot(path: string, options?: { allowedParent?: string; create?: boolean }): Promise<CanonicalRoot> {
  const requested = resolve(path);
  assertNotBroadRoot(requested);
  if (options?.create !== false) await mkdir(requested, { recursive: true, mode: 0o700 });
  await assertNotSymlinkEscape(requested, options?.allowedParent);
  const real = await realpath(requested);
  assertNotBroadRoot(real);
  const info = await lstat(real);
  if (!info.isDirectory()) {
    throw new WorkspacePolicyError("WORKSPACE_NOT_DIRECTORY", `Workspace ${basename(real)} is not a directory.`);
  }
  if (!Number.isSafeInteger(info.dev) || !Number.isSafeInteger(info.ino)) {
    throw new WorkspacePolicyError("WORKSPACE_SPECIAL_FILE", "Workspace identity could not be established.");
  }
  return { requested, real, device: info.dev, inode: info.ino };
}

async function assertNotSymlinkEscape(path: string, allowedParent: string | undefined): Promise<void> {
  if (!allowedParent) return;
  const realParent = await realpath(resolve(allowedParent));
  const realChild = await realpath(path);
  if (realChild !== realParent && !isInside(realParent, realChild)) {
    throw new WorkspacePolicyError("WORKSPACE_ESCAPE", "The workspace symlink resolves outside its allowed data directory.");
  }
}

export async function assertWorkspaceContains(root: string, candidate: string): Promise<string> {
  const realRoot = await realpath(resolve(root));
  const realCandidate = await realpath(resolve(candidate));
  if (realCandidate !== realRoot && !isInside(realRoot, realCandidate)) {
    throw new WorkspacePolicyError("WORKSPACE_ESCAPE", "The workspace path resolves outside its canonical root.");
  }
  return realCandidate;
}


export async function assertRegularFile(path: string, options?: { allowMissing?: boolean }): Promise<void> {
  let info;
  try {
    info = await lstat(path);
  } catch (error) {
    if (options?.allowMissing && (error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  if (info.isSymbolicLink()) {
    throw new WorkspacePolicyError("STATIC_FILE_UNSAFE", "A symbolic link cannot be used for persisted state.");
  }
  if (!info.isFile()) {
    throw new WorkspacePolicyError("STATIC_FILE_UNSAFE", "Only regular files are permitted.");
  }
}

export function assertSafeRelativePath(path: string): string {
  if (path.includes("\0")) {
    throw new WorkspacePolicyError("WORKSPACE_TRAVERSAL", "A request path contained a null byte.");
  }
  const withoutLeading = path.replace(/^\/+/, "");
  if (withoutLeading.length === 0) return "index.html";
  if (withoutLeading.split(/[\\/]+/).some((part) => part === "..")) {
    throw new WorkspacePolicyError("WORKSPACE_TRAVERSAL", "A request path attempted directory traversal.");
  }
  return withoutLeading;
}

export async function resolveStaticFile(root: string, requestPath: string): Promise<string | null> {
  const relative = assertSafeRelativePath(requestPath);
  const realRoot = await realpath(resolve(root));
  const requested = resolve(realRoot, relative);
  if (!isInside(realRoot, requested)) {
    throw new WorkspacePolicyError("WORKSPACE_TRAVERSAL", "The static file request escaped the web root.");
  }
  let realRequested: string;
  try {
    realRequested = await realpath(requested);
  } catch {
    return null;
  }
  if (!isInside(realRoot, realRequested)) {
    throw new WorkspacePolicyError("WORKSPACE_ESCAPE", "A static file symlink escaped the web root.");
  }
  const info = await stat(realRequested);
  if (!info.isFile()) return null;
  return realRequested;
}

export async function ensurePrivateDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: 0o700 });
  const info = await lstat(path);
  if (!info.isDirectory()) {
    throw new WorkspacePolicyError("WORKSPACE_NOT_DIRECTORY", "The state directory could not be created.");
  }
}

export async function writePrivateBytes(path: string, data: Uint8Array | string): Promise<void> {
  const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
  try {
    await handle.writeFile(data, typeof data === "string" ? "utf8" : undefined);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export async function writePrivateFile(path: string, data: string): Promise<void> {
  await writePrivateBytes(path, data);
}
