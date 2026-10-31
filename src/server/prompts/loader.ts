import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type Stage = "oracle" | "architect" | "maker" | "witness";

const promptFiles: Record<Stage, string> = {
  oracle: "Prompt-0-Product-Discovery-v5.1.md",
  architect: "PROMPT_1_ARCHITECT.md",
  maker: "Prompt-2-Build-and-Verify-v5.1.md",
  witness: "Prompt-3-Demo-and-Submission-v1.0.md",
};

export async function loadStagePrompt(stage: Stage, root = process.cwd()): Promise<string> {
  const path = resolve(root, "docs", "prompts", promptFiles[stage]);
  const content = await readFile(path, "utf8");
  if (content.length < 1_000) {
    throw new Error(`Prompt ${stage} is unexpectedly short; refusing to load a summary in place of the full procedure.`);
  }
  return content;
}
