import { payloadHash, type Project } from "./model.ts";
import { AtomicProjectStore, RevisionConflict } from "../store/atomic-project-store.ts";

export interface ActionResult {
  project: Project;
  duplicate: boolean;
}

export class WorkflowService {
  constructor(private readonly store: AtomicProjectStore) {}

  async get(): Promise<Project> {
    return (await this.store.load()).state;
  }

  async execute(
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
    const next = mutation(loaded.state);
    next.actions.push({ id: actionId, payloadHash: hash, resultRevision: expectedRevision + 1 });
    return { project: await this.store.save(expectedRevision, next), duplicate: false };
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
      next.actions.push({ id: actionId, payloadHash: hash, resultRevision: loaded.state.revision + 1 });
      try {
        return { project: await this.store.save(loaded.state.revision, next), duplicate: false };
      } catch (error) {
        if (!(error instanceof RevisionConflict) || attempt === 4) throw error;
      }
    }
    throw new RevisionConflict("Background update could not be applied to the latest project revision.");
  }
}
