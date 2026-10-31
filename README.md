# Unfinished Business

**Turn unfinished ideas into hackathon-ready builds.**

Unfinished Business is an OpenCode-powered hackathon project builder. Four friendly spirits guide one idea through a clear proposal, an approved plan, a real bounded build, and evidence you can defend.

![Ghostlight Hacker Workshop landing page](tests/visual/snapshots/landing-wide.png)

## What it is

- A **landing page** at `/` that explains the product, the four roles, OpenCode's role, and the two honest usage paths.
- A **guided deterministic example** at `/demo`: a versioned Campus Umbrella Relay fixture with Play/Pause, step, replay, reset, four inspectable spirit tabs, a representative diff and check, Witness findings, and an optional 90-second presentation mode at `/demo?presentation=1`. It does not call a model or read a repository.
- The **real workshop** at `/workshop`, which connects to a local OpenCode server and records what actually happened.
- A **first-run connection and discovery flow** that checks a supported OpenCode server, lists the models/providers/agents it actually reports, and lets the builder choose a model and reported reasoning variant. Provider API keys stay inside OpenCode.

OpenCode supplies the agent loop, model access, native tools, permissions, execution, interruption, and native sessions. Unfinished Business adds the four-stage workshop, exact-version approvals, dependency invalidation, evidence views, the onboarding/discovery flow, and the Ghostlight interface. It does **not** ship a second coding harness or a general command executor.

| Spirit | Role |
|---|---|
| Oracle | Clarify an idea into a product proposal and open questions |
| Architect | Draft one planning section and wait for approval of that exact version |
| Maker | Perform an approved, bounded native edit through OpenCode |
| Witness | Inspect evidence in a fresh session and prepare honest review drafts |

## Two ways to use it

**Hosted demo or private deployment** — a labeled deterministic sample, or a private, password-protected workshop using the server's own isolated demo workspace. It does not reach into a visitor's local repository, and it is not a public execution sandbox.

**Full local mode** — the browser app, local API, and pinned OpenCode server on your machine over loopback. Maker's edit in this release is bounded to an isolated demo workspace. App approval never overrides an OpenCode permission denial.

`UB_DEPLOYMENT_MODE` selects `local`, `hosted-private`, or `hosted-demo`. Local mode can edit the connection and enter the server password in memory. Hosted-private manages the URL/credentials in the environment and keeps browser configuration read-only. Hosted-demo serves the guided fixture, issues no session token, connects to no OpenCode server, and rejects every non-GET `/api/*` request with `DEMO_READ_ONLY`.

The landing page exposes three distinct actions: **Try the example** (`/demo`), **Watch the guided workflow** (`/demo?presentation=1`), and **Run live with OpenCode** (`/workshop`). The example is always labeled as a prerecorded fixture; the live native session remains `NOT_RUN`.

Models are discovered from OpenCode rather than assumed. The free DeepSeek route, `opencode/deepseek-v4.1-flash-free`, was the intended development route and is still listed by the tested server, but its availability is time-limited and must be verified on your own account. No paid fallback is configured.

## Quick start

Prerequisites: Linux, Node **22.14+**, npm, and a supported OpenCode 2.x server. Copying `.env.example` to `.env` is optional for local work; the first-run wizard can hold the server password in memory.

```bash
npm ci
cp .env.example .env   # optional
```

Terminal 1 — OpenCode:

```bash
./node_modules/@opencode/cli-linux-x64-baseline/bin/opencode serve --hostname 127.0.0.1 --port 4096
```

Terminal 2 — API:

```bash
npm run dev
```

Terminal 3 — interface:

```bash
npm run dev:web
```

Open `http://127.0.0.1:5173/`. The first-run wizard asks for the server URL and the password printed by `opencode serve`; provider accounts are connected inside OpenCode with `/connect`, and the model list comes from OpenCode's catalog.

For a single production process:

```bash
npm run build
npm start
```

Then open `http://127.0.0.1:4200/`. The detailed, tested guide is [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md).

## Verification

```bash
npm run typecheck
npm test
npm run build
npm run budget
npm run test:visual
```

Current results (2026-10-31):

- 73 unit/integration/component tests pass.
- 18 Playwright visual/accessibility tests pass with committed snapshots, including the guided demo wide/narrow/presentation captures.
- Initial JS is **193.1 KiB gzip**; all JS **262.9 KiB**; CSS **14.2 KiB gzip**; all hero variants **570.9 KiB** total.
- Keyboard focus order, dialog Escape, setup tab arrow keys, 200% text zoom, 390px overflow, reduced motion, and token contrast are checked.
- Demo playback, reset isolation, fixture/schema drift, 90-second timing, tab inspection, no-network behavior, and hosted-demo mutation rejection are covered.
- Connection/discovery, model/variant validation, secret redaction, migration, asynchronous runs, sessions, and permissions are covered by the server test suite.

`npm run test:visual` needs a Chromium executable. It prefers `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, then system Chrome/Chromium, then Playwright's browser.

## Status

The guided workflow, native execution path, recovery, and evidence ledger are implemented. Phase 4 adds the Ghostlight landing page, visual system, characters, motion, deterministic demo, and visual/accessibility tests. The merged OpenCode onboarding/discovery work adds first-run connection setup, model selection, session controls, and deployment-mode policy. Phase 7 adds the versioned guided example, deterministic playback, 90-second presentation path, hosted-demo mutation rejection, reset isolation, and the shared fixture contract. A live free-model run was not repeated during this interface work; the previous native execution evidence remains the workflow record.

A real recorded demo, final article/video, and submission packaging remain separate acceptance work. A public hosted URL is not asserted here. Hosted and private deployment configuration is in [docs/HOSTED_DEPLOYMENT.md](docs/HOSTED_DEPLOYMENT.md).

## Documentation

- [Product brief](docs/PRODUCT_BRIEF.md) — positioning, landing claims, two usage paths.
- [OpenCode integration contract](docs/OPENCODE_INTEGRATION.md) — tested version/API surface, discovery, credentials ownership, roles, sessions, limitations.
- [UX and visual system](docs/UX_AND_VISUAL_SYSTEM.md) — theme, tokens, components, character states, onboarding states, motion, accessibility, asset prompt/provenance, performance budget.
- [Local setup](docs/LOCAL_SETUP.md) — tested commands and troubleshooting.
- [Hosted deployment](docs/HOSTED_DEPLOYMENT.md) — Render/private instance, secrets, security boundary.
- [Demo and submission](docs/DEMO_AND_SUBMISSION.md) — scenario, fixture provenance, playback/reset, exact claims, screenshots, video beats, live-versus-simulated disclosure.
- [Operations and recovery](docs/OPERATIONS_AND_RECOVERY.md) — demo reset isolation, live project recovery, unknown runs, presentation operations.
- [Architecture](docs/ARCHITECTURE.md) — routes, fixture boundaries, schema reuse, hosted-demo enforcement, evidence flow.
- [Decisions](docs/DECISIONS.md) — Phase 4 and Phase 7 design decisions and alternatives.
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md) — phase history, Phase 7 work units, verification gate.
- [Changelog](docs/CHANGELOG.md) — Phase 7 and Phase 4 changes.
- [Engineering blueprint](docs/ENGINEERING_BLUEPRINT.md) — canonical implementation plan and amendments.
- [Product idea packet](docs/Unfinished-Business-Idea-Packet-v1.md) — approved product scope and decisions.
- [Sentry and OpenCode setup](docs/SENTRY_AND_OPENCODE_SETUP.md) — release/source-map and password matching.
- [Render deployment](docs/RENDER_DEPLOYMENT.md) — original deployment notes.
- [Complete local prompt set](docs/prompts/README.md) — Prompts 0–3 and project overrides.

## Development policy

- Repository: [kernelKain/unfinished-business](https://github.com/kernelKain/unfinished-business).
- Work on the existing `main` branch. Do not create phase branches.
- Complete and verify each phase, then make one commit for that phase before starting the next phase.
- Steps are work/checklist units, not individual commits. Commit subjects describe the change without phase or step numbering.
- Preserve unrelated changes. A blocked commit blocks entry to the next implementation phase; do not bypass access restrictions.
- No fabricated testimonials, usage figures, awards, or live-run claims.
- No second coding harness, remote repository mount, or public arbitrary-execution sandbox.

## Delivery

The first release targets a local browser on Linux. A real recorded demonstration and a reproducible local-start guide provide judge access; hosted code execution is outside this release. Backboard, Sentry Agent Tracing, and Entire remain selected partner targets, with qualification conditional on meaningful actual use and evidence.

## License

[MIT](LICENSE). Dependency, prompt, and asset attribution must be checked before redistribution. The generated hero asset's prompt and provenance are documented in [docs/UX_AND_VISUAL_SYSTEM.md](docs/UX_AND_VISUAL_SYSTEM.md).
