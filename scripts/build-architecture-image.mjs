/**
 * Rasterize docs/assets/architecture.svg to docs/assets/architecture.png.
 *
 * Markdown hosts (DEV.to included) send raster images through an image proxy
 * that does not transcode SVG: the proxy labels the SVG bytes as image/webp and
 * the browser renders a broken image. The PNG export is what posts should link.
 *
 *   npm run assets:architecture
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, "docs/assets/architecture.svg");
const target = path.join(root, "docs/assets/architecture.png");
const scale = Number(process.env.ARCHITECTURE_SCALE ?? 2);

await mkdir(path.dirname(target), { recursive: true });

// Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to reuse a Chromium build that is not in
// the Playwright browser cache.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const browser = await chromium.launch(executablePath ? { executablePath } : {});

try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: scale,
  });

  await page.goto(pathToFileURL(source).href, { waitUntil: "load" });
  await page.screenshot({
    path: target,
    clip: { x: 0, y: 0, width: 1280, height: 720 },
  });
} finally {
  await browser.close();
}

console.log(`Wrote ${path.relative(root, target)} at ${1280 * scale}x${720 * scale}`);
