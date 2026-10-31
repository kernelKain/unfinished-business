import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// Prefer a system Chromium when present (useful in this repository's verified
// Linux environment); otherwise Playwright uses its installed browser.
const executablePath = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));

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
    command: "npm run build && UB_PORT=4317 UB_DATA_DIR=/tmp/unfinished-business-visual OPENCODE_BASE_URL=http://127.0.0.1:65534 node --import tsx src/server/start.ts",
    url: "http://127.0.0.1:4317/api/health",
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
