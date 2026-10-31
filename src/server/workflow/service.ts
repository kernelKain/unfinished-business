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
}
