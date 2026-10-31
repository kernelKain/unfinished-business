# Tool and capability catalog

**Status:** Current release inventory.
**Owner:** Engineering.
**Last verified:** 2026-10-31.

This catalog distinguishes what the product **uses**, what it **recommends**, and what is only a **documented future possibility**. A listed tool is not an install, account, endorsement, or partner-category proof.

## Core tools

| Tool | Role | Status | Evidence/limitation |
|---|---|---|---|
| OpenCode 2.0.32 | Agent loop, model access, native tools, permissions, sessions, interruption | **Integrated foundation** | Exact client/server pin; production code uses the official client through the safe network layer. Live compatibility probe passed without inference. |
| OpenCode model catalog | Any model the connected account reports as available | **Integrated; model-dependent** | New projects default to all accessible models. Free/local-only policy and optional spending limits are available. Paid/unknown-price routes require explicit confirmation; no silent substitution. |
| Node.js 22.14+ | Runtime, build, and bounded Node check | **Required** | Tested on 22.22.1; `engines` minimum 22.14. |
| React 19 + TypeScript + Vite 8 | Browser interface and build | **Integrated** | Production build and bundle budget pass. |
| Hono 4 + `@hono/node-server` | HTTP API and static serving | **Integrated** | Security middleware, validation, SSE, and static containment are tested. |
| Zod 4 | Shared request/state/output validation | **Integrated** | Workflow schema v6, explicit v1–v5 migration, project-source/Oracle intake, model policy, provider-error, and engine/discovery contracts. |
| Motion 14 + Lucide | Purposeful motion and icons | **Integrated** | Free libraries only; reduced-motion fallback tested. No second animation framework. |

## Verification and operations tools

| Tool | Role | Status | Evidence/limitation |
|---|---|---|---|
| Node test runner | Unit/integration/component tests | **Integrated** | 139 passing tests. |
| Playwright 1.62 | Visual, keyboard, contrast, zoom, reduced-motion, overflow tests | **Integrated** | 18 passing tests with committed snapshots; uses system Chromium. |
| `scripts/check-budget.mjs` | Production bundle/asset budget | **Integrated** | Passes: initial JS 194.9 KiB gzip, all JS 269.7 KiB, CSS 14.8 KiB, hero 570.9 KiB. |
| `scripts/preflight.mjs` | Read-only environment diagnostic | **Integrated** | Checks toolchain, DNS, loopback, OpenCode CLI/help, Git reads, Entire status. Not an integration proof. |
| `scripts/opencode-live-diagnostic.ts` | Opt-in compatibility probe | **Integrated; run in Phase 9** | Server 2.0.32, catalog, disposable session create/read/remove. No prompt/model call. |
| Render | Optional demo or private hosting | **Documented; not deployed** | `render.demo.yaml` and `render.yaml` reviewed statically. No live URL asserted. |
| GitHub Actions | Typecheck/test/build quality gate | **Configured** | `.github/workflows/sentry-release.yml` runs the quality gate; Render owns production source-map upload. |

## Observability and development evidence

| Tool | Role | Status | Evidence/limitation |
|---|---|---|---|
| Sentry Node/browser SDKs | Optional errors, traces, replay, profiling, metadata-only agent spans | **Configured; live release proof not run** | SDK collection is disabled for prompts/bodies/headers/identity; redaction is tested. A live event/release/source-map/trace check needs authorized credentials and a deployment. |
| Entire | Development-session capture and checkpoints | **Development record only** | Repository has Entire hooks/checkpoints from earlier phases. It is not a runtime product feature and no public transcript is shared. |
| Backboard R-CLI | Candidate build-process contribution | **Not integrated** | No API key/tooling in this environment; no session, diff, check, or category claim. |

## Recommendation policy

The landing page's "idea-to-tool" fixtures are static, reviewable guidance, not a live recommender:

| Idea | Recommended path | Fit | Permission boundary |
|---|---|---|---|
| Campus lost-and-found | Node check + diff inspection | Small state model plus one verified test | Check runs only in the isolated demo workspace; diff inspection is read-only. |
| Habit streak tracker | Keep the bounded Node check | Same capability, no new install | No arbitrary shell, package install, or network tool. |
| Photo scavenger hunt | Recommend a focused scope change first | Asset handling is outside current scope | Do not silently widen permissions; the plan and native capability set must change explicitly. |

Rules:

1. Recommend only capabilities that exist in the current native mapping.
2. Show availability, permission, and observed outcome; do not imply an install.
3. Never recommend an arbitrary shell or remote repository mount for this release. Model costs and privacy are surfaced at selection; a paid or unknown-price route is never silently used.
4. A recommendation is not an approval and does not grant Maker scope.
5. Keep source/freshness metadata with each fixture; a stale source must be reviewed before adding a claim.

Source freshness for this catalog:

| Claim | Source | Last checked |
|---|---|---|
| OpenCode 2.0.32 client/server compatibility | Local pinned binary + Phase 9 live compatibility probe | 2026-10-31 |
| Model access, pricing, and spending policy | OpenCode model catalog; `.env.example`; model-access and connection tests | 2026-11-01 |
| Sentry privacy configuration | SDK code, redaction tests, deployment docs | 2026-10-31 |
| Entire capture presence | Repository hooks/checkpoints and prior phase records | 2026-10-31 |
| Render templates | `render.yaml`, `render.demo.yaml` static review | 2026-10-31 |
| Playwright/browser availability | Visual suite against system Chromium | 2026-10-31 |

## Partner qualification truth

- **OpenCode** is central to the product and has meaningful runtime use. It is not a sponsor category by itself.
- **Sentry** is configured for metadata-only telemetry, but live release/source-map/trace evidence is **not** claimed in Phase 9.
- **Entire** recorded development work in earlier phases; no runtime integration or public shared transcript is claimed.
- **Backboard** is not installed or used. Installation or a placeholder key would not qualify as meaningful use.
- No category, prize, ranking, endorsement, or submission result is claimed for any tool.
