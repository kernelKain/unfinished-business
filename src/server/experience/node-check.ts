import { spawn } from "node:child_process";

export interface NodeCheckResult {
  code: number | null;
  output: string;
}

export function runApprovedNodeCheck(workspace: string): Promise<NodeCheckResult> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--test"], {
      cwd: workspace,
      shell: false,
      timeout: 30_000,
      env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" },
    });
    let output = "";
    const append = (chunk: Buffer) => {
      if (output.length < 8_000) output += chunk.toString("utf8").slice(0, 8_000 - output.length);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("error", (error) => resolve({ code: null, output: error.message }));
    child.on("close", (code) => resolve({ code, output: output.trim() || "The Node check produced no output." }));
  });
}
