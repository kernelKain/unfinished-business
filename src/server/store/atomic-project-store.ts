import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  open,
  readdir,
  rename,
  stat,
  unlink,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
  migrateProject,
  projectSchema,
  UnsupportedSchemaVersionError,
  type Project,
} from "../workflow/model.ts";
import { ensurePrivateDirectory, writePrivateBytes, writePrivateFile } from "../security/workspace.ts";

export class RevisionConflict extends Error {}

export type StateErrorCode =
  | "STATE_NOT_INITIALIZED"
  | "STATE_CORRUPT"
  | "STATE_UNSAFE"
  | "STATE_BUSY"
  | "STATE_DISK_FULL"
  | "STATE_READ_ONLY"
  | "STATE_WRITE_FAILED";

export class StateError extends Error {
  constructor(
    readonly code: StateErrorCode,
    message: string,
    readonly status: 503 | 507 = 503,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "StateError";
  }
}

export interface LoadResult {
  state: Project;
  source: "current" | "previous";
  /** The original corrupt path, retained for operator inspection. */
  corruptPath: string | null;
  /** A copy made before any write, so the corrupt bytes are never lost. */
  quarantinePath: string | null;
  migrated: boolean;
  fromVersion: number;
}

export interface StoreOptions {
  backups?: number;
  corruptFiles?: number;
  backupMaxAgeDays?: number;
  lockTimeoutMs?: number;
  now?: () => Date;
}

export class AtomicProjectStore {
  readonly previousPath: string;
  readonly lockPath: string;
  readonly backupDirectory: string;
  private readonly options: Required<StoreOptions>;

  constructor(readonly path: string, options: StoreOptions = {}) {
    this.previousPath = `${path}.previous`;
    this.lockPath = `${path}.lock`;
    this.backupDirectory = join(dirname(path), "backups");
    this.options = {
      backups: options.backups ?? 3,
      corruptFiles: options.corruptFiles ?? 5,
      backupMaxAgeDays: options.backupMaxAgeDays ?? 30,
      lockTimeoutMs: options.lockTimeoutMs ?? 5_000,
      now: options.now ?? (() => new Date()),
    };
  }

  async load(): Promise<LoadResult> {
    let currentError: unknown;
    try {
      const current = await this.readProject(this.path);
      return {
        state: current.state,
        source: "current",
        corruptPath: null,
        quarantinePath: null,
        migrated: current.migrated,
        fromVersion: current.fromVersion,
      };
    } catch (error) {
      currentError = error;
      if (error instanceof UnsupportedSchemaVersionError) throw error;
      if (error instanceof StateError && error.code === "STATE_UNSAFE") throw error;
    }

    try {
      const previous = await this.readProject(this.previousPath);
      const quarantinePath = await this.quarantineCorrupt().catch(() => null);
      return {
        state: previous.state,
        source: "previous",
        corruptPath: this.path,
        quarantinePath,
        migrated: previous.migrated,
        fromVersion: previous.fromVersion,
      };
    } catch (previousError) {
      if ((currentError as NodeJS.ErrnoException)?.code === "ENOENT"
        && (previousError as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new StateError("STATE_NOT_INITIALIZED", "No project state exists yet.");
      }
      throw new StateError(
        "STATE_CORRUPT",
        `Project state is corrupt and no valid previous snapshot exists. The files were preserved at ${this.path} and ${this.previousPath}.`,
      );
    }
  }

  async initialize(project: Project): Promise<void> {
    try {
      await ensurePrivateDirectory(dirname(this.path));
      const parsed = projectSchema.parse(project);
      await writePrivateFile(this.path, `${JSON.stringify(parsed, null, 2)}\n`);
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async save(expectedRevision: number, project: Project): Promise<Project> {
    let release: (() => Promise<void>) | null = null;
    try {
      release = await this.acquireLock();
      const loaded = await this.load();
      if (loaded.state.revision !== expectedRevision) {
        throw new RevisionConflict(`Expected revision ${expectedRevision}, found ${loaded.state.revision}.`);
      }
      const next = projectSchema.parse({
        ...project,
        revision: expectedRevision + 1,
        updatedAt: this.options.now().toISOString(),
      });
      await ensurePrivateDirectory(dirname(this.path));
      if (loaded.source === "current") {
        await this.backupCurrent(loaded.state.revision);
      }
      const temporaryPath = `${this.path}.tmp-${process.pid}-${randomUUID()}`;
      try {
        await writePrivateFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`);
        await rename(temporaryPath, this.path);
        await this.syncDirectory(dirname(this.path));
      } catch (error) {
        await unlink(temporaryPath).catch(() => undefined);
        throw error;
      }
      await this.pruneRetainedFiles();
      return next;
    } catch (error) {
      throw this.mapWriteError(error);
    } finally {
      if (release) await release();
    }
  }

  private async readNoFollow(path: string): Promise<Buffer> {
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const info = await handle.stat();
      if (!info.isFile()) {
        throw new StateError("STATE_UNSAFE", "The project state path is not a regular file.");
      }
      return await handle.readFile();
    } finally {
      await handle.close();
    }
  }

  private async readProject(path: string): Promise<{ state: Project; migrated: boolean; fromVersion: number }> {
    let raw: string;
    try {
      raw = (await this.readNoFollow(path)).toString("utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ELOOP") {
        throw new StateError("STATE_UNSAFE", "The project state file is a symbolic link. It was not followed.");
      }
      throw error;
    }
    const parsed = JSON.parse(raw) as unknown;
    const migration = migrateProject(parsed);
    return { state: migration.project, migrated: migration.migrated, fromVersion: migration.fromVersion };
  }

  private async backupCurrent(revision: number): Promise<void> {
    await ensurePrivateDirectory(this.backupDirectory);
    const stamp = this.options.now().toISOString().replace(/[:.]/g, "-");
    const backupPath = join(this.backupDirectory, `project-r${revision}-${stamp}.json`);
    const snapshot = await this.readNoFollow(this.path);
    const temporary = `${this.previousPath}.tmp-${randomUUID()}`;
    await writePrivateBytes(temporary, snapshot);
    await rename(temporary, this.previousPath);
    await writePrivateBytes(backupPath, snapshot);
  }

  private async quarantineCorrupt(): Promise<string> {
    const stamp = this.options.now().toISOString().replace(/[:.]/g, "-");
    const target = join(dirname(this.path), `${basename(this.path)}.corrupt-${stamp}-${randomUUID().slice(0, 8)}`);
    const corrupt = await this.readNoFollow(this.path);
    await writePrivateBytes(target, corrupt);
    await this.pruneRetainedFiles().catch(() => undefined);
    return target;
  }

  private async acquireLock(): Promise<() => Promise<void>> {
    const started = Date.now();
    while (true) {
      try {
        const handle = await open(this.lockPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
        await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
        await handle.close();
        return async () => {
          await unlink(this.lockPath).catch(() => undefined);
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        if (await this.staleLock()) {
          await unlink(this.lockPath).catch(() => undefined);
          continue;
        }
        if (Date.now() - started >= this.options.lockTimeoutMs) {
          throw new StateError("STATE_BUSY", "Another process is writing project state. Try again shortly.", 503, true);
        }
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
      }
    }
  }

  private async staleLock(): Promise<boolean> {
    try {
      const info = await stat(this.lockPath);
      return Date.now() - info.mtimeMs > 30_000;
    } catch {
      return true;
    }
  }

  private async syncDirectory(path: string): Promise<void> {
    try {
      const handle = await open(path, constants.O_RDONLY);
      try {
        await handle.sync();
      } finally {
        await handle.close();
      }
    } catch {
      // Directory fsync is best effort on filesystems that do not support it.
    }
  }

  private async pruneRetainedFiles(): Promise<void> {
    await this.pruneDirectory(this.backupDirectory, /^project-.*\.json$/, this.options.backups);
    const directory = dirname(this.path);
    const prefix = `${basename(this.path)}.corrupt-`;
    await this.pruneDirectory(directory, new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), this.options.corruptFiles);
  }

  private async pruneDirectory(directory: string, pattern: RegExp, keep: number): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(directory);
    } catch {
      return;
    }
    const candidates: Array<{ name: string; time: number }> = [];
    for (const name of entries) {
      if (!pattern.test(name)) continue;
      try {
        const info = await stat(join(directory, name));
        candidates.push({ name, time: info.mtimeMs });
      } catch {
        // The file disappeared between readdir and stat.
      }
    }
    candidates.sort((left, right) => right.time - left.time);
    const maxAge = this.options.backupMaxAgeDays * 24 * 60 * 60 * 1000;
    for (const [index, candidate] of candidates.entries()) {
      const expired = Date.now() - candidate.time > maxAge;
      if (index < keep && !expired) continue;
      await unlink(join(directory, candidate.name)).catch(() => undefined);
    }
  }

  private mapWriteError(error: unknown): Error {
    if (error instanceof StateError || error instanceof RevisionConflict) return error;
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOSPC" || code === "EDQUOT") {
      return new StateError("STATE_DISK_FULL", "The data disk is full. Project state was not replaced.", 507, true);
    }
    if (code === "EACCES" || code === "EPERM" || code === "EROFS") {
      return new StateError("STATE_READ_ONLY", "The data directory is read-only. Project state was not replaced.", 503, false);
    }
    if (code === "ENOTDIR" || code === "EEXIST" || code === "EISDIR") {
      return new StateError("STATE_WRITE_FAILED", "The data path is not a writable directory. Project state was not replaced.", 503, false);
    }
    if (error instanceof Error && /project state|regular file|symbolic link/i.test(error.message)) {
      return new StateError("STATE_WRITE_FAILED", error.message, 503, false);
    }
    return new StateError("STATE_WRITE_FAILED", "Project state could not be written atomically. The previous snapshot remains intact.", 503, true);
  }
}
