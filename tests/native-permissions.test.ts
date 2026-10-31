import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("native proof denies broad edits and allows only the evidence file", async () => {
  const config = JSON.parse(await readFile(
    new URL("./fixtures/opencode-native-proof/opencode.jsonc", import.meta.url),
    "utf8",
  ));
  assert.deepEqual(config.permissions, [
    { action: "edit", resource: "*", effect: "deny" },
    { action: "edit", resource: "allowed.txt", effect: "allow" },
    { action: "shell", resource: "*", effect: "deny" },
    { action: "external_directory", resource: "*", effect: "deny" },
  ]);
  await assert.rejects(readFile(new URL("./fixtures/opencode-native-proof/denied.txt", import.meta.url)));
  assert.equal(
    await readFile(new URL("./fixtures/opencode-native-proof/allowed.txt", import.meta.url), "utf8"),
    "NATIVE EDIT VERIFIED\n",
  );
});
