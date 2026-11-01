# Tool and capability catalog

**Status:** Current release inventory.
**Owner:** Engineering.
**Last verified:** 2026-11-01.

This catalog distinguishes what the product **uses** and what is only a **documented future possibility**. A listed tool is not an install, account, endorsement, or partner-category proof.

## Core tools

| Tool | Role | Status | Evidence/limitation |
|---|---|---|---|
| OpenCode 2.0.32 | Agent loop, model access, native tools, permissions, sessions, interruption | **Integrated foundation** | Exact client/server pin through the official cross-platform `@opencode/cli`; production code uses the official client through the safe network layer. Linux x64 locally verified; macOS arm64/x64 verified by CI run `41252770576`. Live compatibility probe passed without inference. |
| OpenCode model catalog | Any model the connected account reports as available | **Integrated; model-dependent** | New projects default to all accessible models. Free/local-only policy and optional spending limits are available. Paid/unknown-price routes require explicit confirmation; no silent substitution. |
| Node.js 22.14+ | Runtime, build, and bounded Node check | **Required** | Tested on 22.22.1; `engines` minimum 22.14. |
| React 19 + TypeScript + Vite 8 | Browser interface and build | **Integrated** | Production build and bundle budget pass. |
| Hono 4 + `@hono/node-server` | HTTP API and static serving | **Integrated** | Security middleware, validation, SSE, and static containment are tested. |
| Zod 4 | Shared request/state/output validation | **Integrated** | Workflow schema v7, explicit v1–v6 migration, project-source/Oracle intake, reviewable candidate revisions, section contracts, model policy, provider-error, and engine/discovery contracts. |
| Motion 14 + Lucide | Purposeful motion and icons | **Integrated** | Free libraries only; reduced-motion fallback tested. No second animation framework. |

## Verification and operations tools

| Tool | Role | Status | Evidence/limitation |
|---|---|---|---|
| Node test runner | Unit/integration/component tests | **Integrated** | 207 passing tests. |
| Playwright 1.62 | Visual, keyboard, contrast, zoom, reduced-motion, overflow, responsive, loading/offline, and canonical-sample tests | **Integrated** | 26 passing tests with committed snapshots; 390/768/1440 widths; uses system Chromium on Linux or macOS. |
| `scripts/check-budget.mjs` | Production bundle/asset budget | **Integrated** | Passes: initial JS 201.5 KiB gzip, all JS 280.4 KiB (290 KiB budget), CSS 17.0 KiB (18 KiB budget), hero 581.2 KiB. |
| `scripts/preflight.mjs` | Read-only environment diagnostic | **Integrated** | Checks toolchain, supported platform, DNS, loopback, OpenCode CLI/help/client metadata, Git reads, Entire status. Not an integration proof. |
| `scripts/opencode-platform-diagnostic.ts` | Platform and CLI resolution diagnostic | **Integrated** | Supported-host gate, global/local resolution, version, permission, and start diagnostics. No path or credential output. |
| `scripts/opencode-smoke.ts` | No-inference server smoke | **Integrated** | Starts the resolved OpenCode server on an ephemeral loopback port, reads `/api/info`, and stops it. |
| `scripts/opencode-live-diagnostic.ts` | Opt-in compatibility probe | **Integrated; run in Phase 9** | Server 2.0.32, catalog, disposable session create/read/remove. No prompt/model call. |
| Render | Optional demo or private hosting | **Documented; not deployed** | `render.demo.yaml` and `render.yaml` reviewed statically. No live URL asserted. |
| GitHub Actions | Linux/macOS install, resolution, test, build, and smoke gate | **Configured and green** | CI run `41252770576` passed `ubuntu-latest`, `macos-15`, and `macos-15-intel`; Render owns production source-map upload. |

## Observability and development evidence

| Tool | Role | Status | Evidence/limitation |
|---|---|---|---|
| Sentry Node/browser SDKs | Optional errors, traces, replay, profiling, metadata-only agent spans | **Configured; live release proof not run** | SDK collection is disabled for prompts/bodies/headers/identity; redaction is tested. A live event/release/source-map/trace check needs authorized credentials and a deployment. |
| Entire | Development-session capture and checkpoints | **Development record only** | Repository has Entire hooks/checkpoints from earlier phases. It is not a runtime product feature and no public transcript is shared. |
| Backboard R-CLI | Candidate build-process contribution | **Not integrated** | No API key/tooling in this environment; no session, diff, check, or category claim. |

## Recommendation policy

There is no landing-page idea-to-tool recommender in this release. The previous static table was removed in Upgrade Phase 6 because it was not interactive or capability-driven. A future recommender must be tied to the discovered OpenCode capability set, cite source freshness, show permissions and observed outcomes, and never turn a recommendation into an approval or a Maker scope grant.

Source freshness for this catalog:

| Claim | Source | Last checked |
|---|---|---|
| OpenCode 2.0.32 client/server compatibility | Official cross-platform CLI resolution, local Linux smoke, macOS CI matrix, and Phase 9 live compatibility probe | 2026-11-01 |
| Model access, pricing, and spending policy | OpenCode model catalog; `.env.example`; model-access and connection tests | 2026-11-01 |
| Sentry privacy configuration | SDK code, redaction tests, deployment docs | 2026-10-31 |
| Entire capture presence | Repository hooks/checkpoints and prior phase records | 2026-10-31 |
| Render templates | `render.yaml`, `render.demo.yaml` static review | 2026-10-31 |
| Playwright/browser availability | Visual suite against system Chromium on Linux; macOS candidate paths in `playwright.config.ts` | 2026-11-01 |
| Dependency audit | `npm audit` and production high-severity audit | 2026-11-01 — zero vulnerabilities after the narrow `glob`/`minimatch` override |

## Partner qualification truth

- **OpenCode** is central to the product and has meaningful runtime use. It is not a sponsor category by itself.
- **Sentry** is configured for metadata-only telemetry, but live release/source-map/trace evidence is **not** claimed in Phase 9.
- **Entire** recorded development work in earlier phases; no runtime integration or public shared transcript is claimed.
- **Backboard** is not installed or used. Installation or a placeholder key would not qualify as meaningful use.
- No category, prize, ranking, endorsement, or submission result is claimed for any tool.
