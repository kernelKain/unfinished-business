import { spawn } from "node:child_process";

export interface NodeCheckResult {
  code: number | null;
  output: string;
}

/**
 * The only application-owned command. It runs a dependency-free test file in the
 * isolated demo workspace after an explicit Maker scope grant. It never inherits
 * deployment secrets.
 */
export function runApprovedNodeCheck(workspace: string, timeoutMs = 30_000): Promise<NodeCheckResult> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--test"], {
      cwd: workspace,
      shell: false,
      timeout: timeoutMs,
      killSignal: "SIGKILL",
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
        NODE_ENV: "test",
        NO_COLOR: "1",
      },
    });
    let output = "";
    let finished = false;
    const append = (chunk: Buffer) => {
      if (output.length < 8_000) output += chunk.toString("utf8").slice(0, 8_000 - output.length);
    };
    const finish = (result: NodeCheckResult) => {
      if (finished) return;
      finished = true;
      resolve(result);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("error", (error) => finish({ code: null, output: error.message }));
    child.on("close", (code, signal) => {
      const suffix = signal ? `Terminated by ${signal}.` : "";
      finish({
        code,
        output: [output.trim(), suffix].filter(Boolean).join("\n") || "The Node check produced no output.",
      });
    });
  });
}
