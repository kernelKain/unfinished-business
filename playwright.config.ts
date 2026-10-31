import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

// Prefer a system Chromium when present; otherwise Playwright uses its
// installed browser. Paths cover Linux and both macOS architectures.
const executablePath = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
].find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));

// Use the host temporary directory instead of a Linux-only /tmp path.
const visualDataDir = join(tmpdir(), "unfinished-business-visual");

export default defineConfig({
  testDir: "./tests/visual",
  snapshotPathTemplate: "{testDir}/snapshots/{arg}{ext}",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.015,
      timeout: 20_000,
    },
  },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4317",
    viewport: { width: 1440, height: 1000 },
    colorScheme: "dark",
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
    screenshot: "only-on-failure",
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  webServer: {
    command: `npm run build && UB_PORT=4317 UB_DATA_DIR=${JSON.stringify(visualDataDir)} OPENCODE_BASE_URL=http://127.0.0.1:65534 node --import tsx src/server/start.ts`,
    url: "http://127.0.0.1:4317/api/health",
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
