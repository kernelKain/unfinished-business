import assert from "node:assert/strict";
import test from "node:test";
import { loadStagePrompt, type Stage } from "../src/server/prompts/loader.ts";

for (const stage of ["oracle", "architect", "maker", "witness"] as const satisfies readonly Stage[]) {
  test(`loads the complete ${stage} procedure`, async () => {
    const content = await loadStagePrompt(stage);
    assert.match(content, /^# /);
    assert.ok(content.length > 5_000);
  });
}
