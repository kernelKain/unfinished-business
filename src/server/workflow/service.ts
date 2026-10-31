import type { RetentionConfig } from "../config.ts";
import { AtomicProjectStore, RevisionConflict } from "../store/atomic-project-store.ts";
import { AsyncLock } from "../security/limits.ts";
import { payloadHash, refreshNextAction, type Project } from "./model.ts";
import { applyRetention } from "./retention.ts";
import { rememberTranscript } from "./transitions.ts";

export interface ActionResult {
  project: Project;
  duplicate: boolean;
}

export interface WorkflowServiceOptions {
  retention?: RetentionConfig;
  now?: () => Date;
}

const defaultRetention: RetentionConfig = {
  actions: 500,
  approvals: 200,
  operations: 200,
  evidence: 200,
  transcript: 40,
  witnessDrafts: 10,
  backups: 3,
  corruptFiles: 5,
  backupMaxAgeDays: 30,
};

export class WorkflowService {
  private readonly lock = new AsyncLock();
  private readonly retention: RetentionConfig;
  private readonly now: () => Date;

  constructor(
    private readonly store: AtomicProjectStore,
    options: WorkflowServiceOptions = {},
  ) {
    this.retention = options.retention ?? defaultRetention;
    this.now = options.now ?? (() => new Date());
  }

  async get(): Promise<Project> {
    return (await this.store.load()).state;
  }

  /** Serializes an entire operation, including an external native call, without nesting locks. */
  withLock<T>(work: () => Promise<T>): Promise<T> {
    return this.lock.run(work);
  }

  async execute(
    actionId: string,
    payload: unknown,
    expectedRevision: number,
    mutation: (project: Project) => Project,
  ): Promise<ActionResult> {
    return this.withLock(() => this.executeLocked(actionId, payload, expectedRevision, mutation));
  }

  /** Only call while holding withLock(). */
  async executeLocked(
    actionId: string,
    payload: unknown,
    expectedRevision: number,
    mutation: (project: Project) => Project,
  ): Promise<ActionResult> {
    const loaded = await this.store.load();
    const hash = payloadHash(payload);
    const existing = loaded.state.actions.find((action) => action.id === actionId);
    if (existing) {
      if (existing.payloadHash !== hash) throw new RevisionConflict("Action ID was already used with a different payload.");
      return { project: loaded.state, duplicate: true };
    }
    if (loaded.state.revision !== expectedRevision) {
      throw new RevisionConflict(`Expected revision ${expectedRevision}, found ${loaded.state.revision}.`);
    }
    const mutated = mutation(loaded.state);
    mutated.actions.push({
      id: actionId,
      payloadHash: hash,
      resultRevision: expectedRevision + 1,
      createdAt: this.now().toISOString(),
    });
    const retained = applyRetention(mutated, this.retention).project;
    return { project: await this.store.save(expectedRevision, retained), duplicate: false };
  }

  /**
   * Keeps creation metadata aligned with the current deployment without
   * changing approvals or any other content.
   */
  async ensureRuntimeMetadata(mode: Project["mode"], workspace: string): Promise<{ updated: boolean }> {
    return this.withLock(async () => {
      const loaded = await this.store.load();
      if (loaded.state.mode === mode && loaded.state.demoWorkspace && loaded.state.workspace === workspace) {
        return { updated: false };
      }
      const next = structuredClone(loaded.state);
      next.mode = mode;
      next.demoWorkspace = true;
      next.workspace = workspace;
      await this.store.save(loaded.state.revision, next);
      return { updated: true };
    });
  }

  /**
   * Called once at process startup. Any operation that was queued or running when
   * the process stopped is uncertain and must not be retried automatically.
   */
  async recoverAfterRestart(): Promise<{ recovered: number } | null> {
    return this.withLock(async () => {
      const loaded = await this.store.load();
      const next = structuredClone(loaded.state);
      let recovered = 0;
      for (const operation of next.operations) {
        if (["QUEUED", "RUNNING", "WAITING_PERMISSION"].includes(operation.status)) {
          operation.status = "UNKNOWN";
          operation.result = "The application restarted while this native operation was in flight. It was not repeated; reconcile the native session.";
          operation.finishedAt = this.now().toISOString();
          recovered += 1;
        }
      }
      if (recovered === 0) return null;
      rememberTranscript(next, "system", `${recovered} interrupted native operation(s) were marked unknown after restart and will not be repeated automatically.`);
      refreshNextAction(next);
      await this.store.save(loaded.state.revision, next);
      return { recovered };
    });
  }

  /**
   * Applies a background completion to the latest persisted state.
   *
   * A long native run must not be tied to the revision that queued it: the
   * user may approve, revise, or inspect unrelated state while the run is in
   * flight. This retries optimistic concurrency conflicts a bounded number of
   * times and never repeats the native operation itself.
   */
  async executeLatest(
    actionId: string,
    payload: unknown,
    mutation: (project: Project) => Project,
  ): Promise<ActionResult> {
    const hash = payloadHash(payload);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const loaded = await this.store.load();
      const existing = loaded.state.actions.find((action) => action.id === actionId);
      if (existing) {
        if (existing.payloadHash !== hash) throw new RevisionConflict("Background action ID was reused with a different payload.");
        return { project: loaded.state, duplicate: true };
      }
      const next = mutation(loaded.state);
      next.actions.push({
        id: actionId,
        payloadHash: hash,
        resultRevision: loaded.state.revision + 1,
        createdAt: this.now().toISOString(),
      });
      try {
        return { project: await this.store.save(loaded.state.revision, next), duplicate: false };
      } catch (error) {
        if (!(error instanceof RevisionConflict) || attempt === 4) throw error;
      }
    }
    throw new RevisionConflict("Background update could not be applied to the latest project revision.");
  }
}
