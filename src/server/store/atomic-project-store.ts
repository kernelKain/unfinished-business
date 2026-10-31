import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { projectSchema, type Project } from "../workflow/model.ts";

export class RevisionConflict extends Error {}

export interface LoadResult {
  state: Project;
  source: "current" | "previous";
  corruptPath: string | null;
}

export class AtomicProjectStore {
  readonly previousPath: string;

  constructor(readonly path: string) {
    this.previousPath = `${path}.previous`;
  }

  private async parse(path: string): Promise<Project> {
    return projectSchema.parse(JSON.parse(await readFile(path, "utf8")));
  }

  async load(): Promise<LoadResult> {
    try {
      return { state: await this.parse(this.path), source: "current", corruptPath: null };
    } catch (currentError) {
      try {
        return { state: await this.parse(this.previousPath), source: "previous", corruptPath: this.path };
      } catch {
        throw currentError;
      }
    }
  }

  async initialize(project: Project): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, `${JSON.stringify(project, null, 2)}\n`, { flag: "wx" });
  }

  async save(expectedRevision: number, project: Project): Promise<Project> {
    const current = (await this.load()).state;
    if (current.revision !== expectedRevision) {
      throw new RevisionConflict(`Expected revision ${expectedRevision}, found ${current.revision}.`);
    }
    const next = projectSchema.parse({ ...project, revision: expectedRevision + 1 });
    const temporaryPath = `${this.path}.tmp-${process.pid}-${Date.now()}`;
    await copyFile(this.path, this.previousPath);
    await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, { flag: "wx" });
    await rename(temporaryPath, this.path);
    return next;
  }
}
