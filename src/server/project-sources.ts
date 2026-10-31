import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat, mkdtemp, mkdir, rename, rm, stat } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import type { ResolvedAddress } from "./security/network.ts";
import { assertAllowedUrl } from "./security/network.ts";
import { canonicalizeDirectoryRoot } from "./security/workspace.ts";
import { payloadHash, refreshNextAction, type Project } from "./workflow/model.ts";
import { WorkflowService } from "./workflow/service.ts";
import { rememberTranscript } from "./workflow/transitions.ts";

export type ProjectSourceSelection =
  | { kind: "NEW_PROJECT"; label?: string | null }
  | { kind: "LOCAL_REPOSITORY"; path: string }
  | { kind: "REMOTE_REPOSITORY"; url: string }
  | { kind: "SAVED_PROJECT" };

export class ProjectSourceError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400) {
    super(message);
    this.name = "ProjectSourceError";
  }
}

export interface ProjectSourceOptions {
  managedImportRoot: string;
  resolver?: (hostname: string) => Promise<ResolvedAddress[]>;
  importer?: (url: URL, target: string) => Promise<void>;
  now?: () => Date;
}

/**
 * Activates the project-source choice without exposing private paths to the
 * model or browser. Remote imports are staged in a dedicated managed root and
 * do not touch the network or filesystem until the user confirms them.
 */
export class ProjectSourceService {
  private readonly now: () => Date;

  constructor(private readonly workflow: WorkflowService, private readonly options: ProjectSourceOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async select(actionId: string, expectedRevision: number, selection: ProjectSourceSelection) {
    return this.workflow.withLock(async () => {
      const current = await this.workflow.get();
      const actionPayload = { selection };
      const existing = current.actions.find((action) => action.id === actionId);
      if (existing) {
        if (existing.payloadHash !== payloadHash(actionPayload)) {
          throw new ProjectSourceError("ACTION_REUSED", "This action ID was already used for different input.", 409);
        }
        return { project: current, duplicate: true };
      }
      if (current.revision !== expectedRevision) {
        throw new ProjectSourceError("REVISION_CONFLICT", `Expected revision ${expectedRevision}, found ${current.revision}.`, 409);
      }
      if (current.source.status === "CONFIRMED"
        && (current.oracleIntake.status !== "NOT_STARTED" || current.source.importedAt !== null)) {
        throw new ProjectSourceError("PROJECT_SOURCE_LOCKED", "The project source cannot change after discovery or a managed import has started.", 409);
      }
      const prepared = await this.prepare(selection, current.id);
      return this.workflow.executeLocked(actionId, actionPayload, expectedRevision, (project) => {
        const next = structuredClone(project);
        next.source = prepared;
        next.oracleIntake.repositoryCondition = prepared.repositoryCondition
          ? {
            value: prepared.repositoryCondition,
            source: "SYSTEM",
            updatedAt: this.now().toISOString(),
          }
          : null;
        rememberTranscript(next, "system", sourceTranscript(prepared.kind, prepared.label));
        return refreshNextAction(next);
      });
    });
  }

  async confirmRemote(actionId: string, expectedRevision: number) {
    return this.workflow.withLock(async () => {
      const current = await this.workflow.get();
      const confirmation = current.source.kind === "REMOTE_REPOSITORY" && current.source.repositoryUrl
        ? { kind: "REMOTE_REPOSITORY", repositoryUrl: current.source.repositoryUrl, confirm: true }
        : null;
      const existing = current.actions.find((action) => action.id === actionId);
      if (existing) {
        if (!confirmation || existing.payloadHash !== payloadHash(confirmation)) {
          throw new ProjectSourceError("ACTION_REUSED", "This action ID was already used for different input.", 409);
        }
        return { project: current, duplicate: true };
      }
      if (current.revision !== expectedRevision) {
        throw new ProjectSourceError("REVISION_CONFLICT", `Expected revision ${expectedRevision}, found ${current.revision}.`, 409);
      }
      if (current.source.kind !== "REMOTE_REPOSITORY" || current.source.status !== "PENDING_CONFIRMATION"
        || !current.source.repositoryUrl || !current.source.workspacePath) {
        throw new ProjectSourceError("REMOTE_SOURCE_NOT_PENDING", "Choose a remote repository before confirming its managed workspace.", 409);
      }
      const url = await validateRemoteRepositoryUrl(current.source.repositoryUrl, this.options.resolver);
      const importer = this.options.importer ?? importRemoteRepository;
      try {
        await importer(url, current.source.workspacePath);
      } catch (error) {
        if (error instanceof ProjectSourceError) throw error;
        throw new ProjectSourceError(
          "REMOTE_IMPORT_FAILED",
          "The remote repository could not be imported into the managed workspace. No credentials or provider output were saved.",
          502,
        );
      }
      const confirmedAt = this.now().toISOString();
      return this.workflow.executeLocked(
        actionId,
        confirmation!,
        expectedRevision,
        (project) => {
          const next = structuredClone(project);
          next.source.status = "CONFIRMED";
          next.source.importedAt = confirmedAt;
          next.source.confirmedAt = confirmedAt;
          next.source.repositoryCondition = "Imported into a managed workspace after explicit confirmation. Source onboarding does not grant Maker write access.";
          next.oracleIntake.repositoryCondition = {
            value: next.source.repositoryCondition,
            source: "SYSTEM",
            updatedAt: confirmedAt,
          };
          rememberTranscript(next, "system", "Confirmed and imported the remote repository into the managed workspace.");
          return refreshNextAction(next);
        },
      );
    });
  }

  private async prepare(selection: ProjectSourceSelection, projectId: string): Promise<Project["source"]> {
    const now = this.now().toISOString();
    if (selection.kind === "NEW_PROJECT") {
      return {
        kind: "NEW_PROJECT",
        status: "CONFIRMED",
        label: cleanLabel(selection.label) ?? "New project",
        repositoryUrl: null,
        workspacePath: null,
        managedWorkspace: false,
        importedAt: null,
        confirmedAt: now,
        repositoryCondition: "No repository exists yet.",
      };
    }
    if (selection.kind === "SAVED_PROJECT") {
      return {
        kind: "SAVED_PROJECT",
        status: "CONFIRMED",
        label: "Saved project",
        repositoryUrl: null,
        workspacePath: null,
        managedWorkspace: false,
        importedAt: null,
        confirmedAt: now,
        repositoryCondition: "Continuing the saved project state.",
      };
    }
    if (selection.kind === "LOCAL_REPOSITORY") {
      let local;
      try {
        local = await canonicalizeDirectoryRoot(selection.path, { create: false });
      } catch (error) {
        throw new ProjectSourceError(
          "LOCAL_REPOSITORY_INVALID",
          error instanceof Error ? error.message : "The local repository path is not safe or accessible.",
        );
      }
      const gitMetadata = await hasGitMetadata(local.real);
      return {
        kind: "LOCAL_REPOSITORY",
        status: "CONFIRMED",
        label: basename(local.real),
        repositoryUrl: null,
        workspacePath: local.real,
        managedWorkspace: false,
        importedAt: null,
        confirmedAt: now,
        repositoryCondition: gitMetadata
          ? "Local directory validated through workspace security; Git metadata is present. Contents were not modified."
          : "Local directory validated through workspace security; Git metadata was not detected. Contents were not modified.",
      };
    }
    const url = await validateRemoteRepositoryUrl(selection.url, this.options.resolver);
    const root = await canonicalizeDirectoryRoot(this.options.managedImportRoot);
    const target = resolve(root.real, projectId);
    if (target !== root.real && !target.startsWith(`${root.real}${sep}`)) {
      throw new ProjectSourceError("MANAGED_WORKSPACE_ESCAPE", "The managed import workspace could not be established.");
    }
    return {
      kind: "REMOTE_REPOSITORY",
      status: "PENDING_CONFIRMATION",
      label: remoteLabel(url),
      repositoryUrl: url.toString(),
      workspacePath: target,
      managedWorkspace: true,
      importedAt: null,
      confirmedAt: null,
      repositoryCondition: "Remote URL validated. Import is pending explicit workspace confirmation; source onboarding does not grant Maker write access.",
    };
  }
}

export async function validateRemoteRepositoryUrl(
  raw: string,
  resolver?: (hostname: string) => Promise<ResolvedAddress[]>,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ProjectSourceError("REMOTE_URL_INVALID", "Enter an absolute HTTPS repository URL.");
  }
  if (url.protocol !== "https:") {
    throw new ProjectSourceError("REMOTE_URL_INSECURE", "Remote repository URLs must use HTTPS.");
  }
  if (url.username || url.password) {
    throw new ProjectSourceError("REMOTE_URL_CREDENTIALS", "Repository URLs must not embed usernames, passwords, or access tokens.");
  }
  if (url.search || url.hash) {
    throw new ProjectSourceError("REMOTE_URL_CREDENTIALS", "Repository URLs must not contain a query string or fragment.");
  }
  if (url.port && url.port !== "443") {
    throw new ProjectSourceError("REMOTE_URL_PORT", "Remote repository URLs may use only the standard HTTPS port.");
  }
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length < 2 || segments.some((segment) => segment === "." || segment === "..")) {
    throw new ProjectSourceError("REMOTE_URL_INVALID", "The repository URL must include an owner and repository path.");
  }
  try {
    await assertAllowedUrl(url, {
      baseUrl: url.toString(),
      allowedHosts: [url.hostname],
      allowedPorts: [443],
      allowPrivateNetwork: false,
      resolver,
    });
  } catch {
    throw new ProjectSourceError("REMOTE_HOST_BLOCKED", "The repository host must resolve to a public HTTPS address.");
  }
  return url;
}

async function importRemoteRepository(url: URL, target: string): Promise<void> {
  const root = resolve(target, "..");
  await mkdir(root, { recursive: true, mode: 0o700 });
  try {
    await lstat(target);
    throw new ProjectSourceError("REMOTE_WORKSPACE_EXISTS", "The managed import workspace already exists; it was not overwritten.", 409);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const staging = await mkdtemp(join(root, `.import-${randomUUID()}-`));
  const checkout = join(staging, "repository");
  try {
    await runGit([
      "-c", "credential.helper=",
      "-c", "http.followRedirects=false",
      "clone", "--depth", "1", "--no-tags", "--filter=blob:none", "--", url.toString(), checkout,
    ]);
    await rename(checkout, target);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

function runGit(args: string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("git", args, {
      stdio: "ignore",
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GIT_ASKPASS: "/bin/false",
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
      },
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), 60_000);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolvePromise();
      else reject(new Error("git clone failed"));
    });
  });
}

async function hasGitMetadata(path: string): Promise<boolean> {
  try {
    const metadata = await stat(join(path, ".git"));
    return metadata.isDirectory() || metadata.isFile();
  } catch {
    return false;
  }
}

function cleanLabel(value: string | null | undefined): string | null {
  const label = value?.trim();
  return label ? label.slice(0, 500) : null;
}

function remoteLabel(url: URL): string {
  return url.pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "").slice(0, 500);
}

function sourceTranscript(kind: Project["source"]["kind"], label: string | null): string {
  if (kind === "LOCAL_REPOSITORY") return `Selected a validated local repository${label ? ` (${label})` : ""}.`;
  if (kind === "REMOTE_REPOSITORY") return `Selected a remote repository${label ? ` (${label})` : ""}; managed import confirmation is still required.`;
  if (kind === "SAVED_PROJECT") return "Continued the saved project.";
  return "Started a new project.";
}
