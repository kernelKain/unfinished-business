#!/usr/bin/env node
// Measures the production web output against the documented Phase 4 budget.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const root = resolve(import.meta.dirname, "..");
const dist = join(root, "dist", "web");
const assets = join(dist, "assets");
const budgets = {
  initialJsGzip: 220 * 1024,
  totalJsGzip: 280 * 1024,
  cssGzip: 15 * 1024,
  heroTotal: 640 * 1024,
  heroLargest: 190 * 1024,
};

function gzipSize(path) {
  return gzipSync(readFileSync(path)).byteLength;
}

function files(directory) {
  return readdirSync(directory).map((name) => join(directory, name));
}

const js = files(assets).filter((path) => path.endsWith(".js"));
const css = files(assets).filter((path) => path.endsWith(".css"));
const initial = js.filter((path) => basename(path).startsWith("index-"));
if (initial.length !== 1) {
  throw new Error(`Expected one initial index chunk, found ${initial.length}.`);
}
const heroFiles = files(join(assets, "hero")).filter((path) => basename(path).startsWith("hero-ghostlight-"));
if (heroFiles.length === 0) {
  throw new Error("No hero assets found. Run npm run assets:hero and npm run build.");
}
const totalHero = heroFiles.reduce((sum, path) => sum + statSync(path).size, 0);
const largestHero = Math.max(...heroFiles.map((path) => statSync(path).size));

const results = [
  ["Initial JS (gzip)", initial.reduce((sum, path) => sum + gzipSize(path), 0), budgets.initialJsGzip],
  ["All JS (gzip)", js.reduce((sum, path) => sum + gzipSize(path), 0), budgets.totalJsGzip],
  ["CSS (gzip)", css.reduce((sum, path) => sum + gzipSize(path), 0), budgets.cssGzip],
  ["Hero assets (total)", totalHero, budgets.heroTotal],
  ["Largest hero asset", largestHero, budgets.heroLargest],
];

let failed = false;
console.log("Production budget");
for (const [label, actual, budget] of results) {
  const status = actual <= budget ? "PASS" : "FAIL";
  if (status === "FAIL") failed = true;
  console.log(`${status.padEnd(4)} ${label.padEnd(24)} ${(actual / 1024).toFixed(1).padStart(7)} KiB / ${(budget / 1024).toFixed(0)} KiB`);
}

const chunkLines = js.map((path) => `  ${basename(path)} ${(gzipSize(path) / 1024).toFixed(1)} KiB gzip`).join("\n");
console.log(`\nChunks:\n${chunkLines}`);
if (failed) {
  console.error("\nBudget exceeded. Reduce the asset or update docs/UX_AND_VISUAL_SYSTEM.md deliberately.");
  process.exitCode = 1;
}
