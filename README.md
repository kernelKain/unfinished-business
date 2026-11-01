# Unfinished Business

**Turn unfinished ideas into hackathon-ready builds.**

Unfinished Business is an OpenCode-powered hackathon project builder. Four friendly spirits guide one idea through a clear proposal, an approved plan, a real bounded build, and evidence you can defend.

![Ghostlight Hacker Workshop landing page](tests/visual/snapshots/landing-wide.png)

## What it is

- A **landing page** at `/` built around the hero, the four-stage workflow, one sample project, why OpenCode does the coding, local setup and privacy, and a short FAQ.
- A **guided sample** at `/demo`: one versioned Driftwatch fixture — an abandoned open-source CLI revived through clarification, a plan, one bounded change, a recorded check, and Witness findings. It has Play/Pause, step, replay, reset, four inspectable spirit tabs, and an optional 90-second presentation mode at `/demo?presentation=1`. It does not call a model or read a repository.
- The **real workshop** at `/workshop`, which connects to a local OpenCode server and records what actually happened.
- A **first-run connection and discovery flow** that checks a supported OpenCode server, lists the models/providers/agents it actually reports, and lets the builder choose a model and reported reasoning variant. Provider API keys stay inside OpenCode.
- A **read-only hosted sample** and a **private hosted** mode. Neither reaches into a visitor's local repository.
- A versioned **schema v7** contract for explicit project sources, field-level Oracle intake answers, structured facts/decisions/assumptions with editable superseding corrections, structured proposals, reviewable candidate section revisions, model preferences, provider errors, and recoverable operations. Explicit v1–v6 migrations keep older projects usable.
- **Reviewable Architect revisions**: every section has a content contract; a change request generates a candidate with a summary and complete Markdown draft. The user inspects a unified or side-by-side diff, then accepts, requests another revision, or discards. Only an accepted candidate replaces the current draft, and approval remains a separate exact-version action.
- **Focused workshop**: one primary task at a time, a collapsible project outline, a contextual Activity & results drawer, an editable Project memory drawer, and a compact model/connection header. Empty technical panels no longer occupy permanent space.
- **Activity & results**: the former Run Inspector is organized into Progress, Changes, and Checks. Native IDs, capability mappings, raw evidence, provider payloads, and the transcript stay under Technical details or Advanced diagnostics.
- **Editable project memory**: decisions, user answers, assumptions, constraints, and unresolved questions are visible in one place. A correction supersedes the prior entry without changing an approval, section draft, Maker scope, or native run.
- **Focused, multi-turn Oracle discovery**: every fresh project chooses new work, a validated local repository, a credential-free remote repository import, or saved work before discovery. Oracle asks at most three explained questions per turn and proposes only after essential intake is known or the user explicitly accepts stated assumptions.
- **Observable, cancellable, recoverable runs**: every Oracle, Architect, Maker, and Witness run is a persisted asynchronous operation with live progress phases, elapsed time, and Continue waiting / Reconcile / Open in OpenCode / Cancel / Retry / Mark abandoned controls in Activity & results. A timed-out or restarted run never permanently blocks the project; reconciliation retrieves and validates the actual late response or diff and applies it exactly once.

OpenCode supplies the agent loop, model access, native tools, permissions, execution, interruption, and native sessions. Unfinished Business adds the four-stage workshop, exact-version approvals, dependency invalidation, evidence views, the onboarding/discovery flow, and the Ghostlight interface. It does **not** ship a second coding harness or a general command executor.

| Spirit | Role |
|---|---|
| Oracle | Choose the project source, collect structured answers over focused turns, and prepare a fact/decision/assumption-aware proposal |
| Architect | Draft one planning section and wait for approval of that exact version |
| Maker | Perform an approved, bounded native edit through OpenCode |
| Witness | Inspect evidence in a fresh session and prepare honest review drafts |

## Runtime modes

**Hosted sample** — `UB_DEPLOYMENT_MODE=hosted-demo`. A public, read-only sample. It has no OpenCode process, provider credentials, session token, visitor persistence, or repository access. Every non-GET `/api/*` request returns `403 DEMO_READ_ONLY`.

**Private hosted** — `UB_DEPLOYMENT_MODE=private-hosted`. A password-protected Render or self-hosted instance with a private disk and a loopback OpenCode child. Maker edits the server's isolated demo workspace. A hosted browser cannot edit a visitor's machine.

**Local workshop** — `UB_DEPLOYMENT_MODE=local` (default). The browser app, local API, and pinned OpenCode server run on the builder's machine over loopback. Oracle source onboarding validates local directories and can import a public HTTPS repository into an app-managed workspace after explicit confirmation. Maker's edit remains bounded to the isolated demo workspace; selecting a source does not authorize implementation in that repository.

The landing page has one primary action, **Try the example** (`/demo`), and one secondary action, **Run locally** (`/workshop`). A quiet setup link goes to the tested local commands. The sample is always labeled as recorded; the live native session remains `NOT_RUN`. The 90-second playback stays available inside `/demo` but is no longer a competing landing CTA.

Models are discovered from OpenCode rather than assumed. New projects default to **All accessible models**, so any model OpenCode reports as available can be selected. A project can deliberately switch to **Free and local only**, which blocks paid and unknown-price remote models. Paid or unknown-price remote models require an explicit first-use confirmation; the app never silently substitutes a model or makes a paid request without that confirmation. An optional USD session spending limit can be set, and the deployment can impose a stricter `UB_MAX_SESSION_COST_USD` ceiling. Cost is checked against the value OpenCode reports; an unknown-price provider may report it only after a request.

## For judges

**Start here, no login, about 90 seconds:** <https://unfinished-business-demo.onrender.com>

Press **Try the example** on the landing page, or open `/demo` directly. This is the recorded Driftwatch walkthrough: Oracle clarifies, Architect drafts and you approve each section, Maker makes one bounded change in an isolated workspace, and Witness reports what actually ran. It is labeled as recorded, makes no model call, and is read-only: every write returns `403 DEMO_READ_ONLY`.

**Live instance, password required:** <https://unfinished-business.onrender.com>

- Username: `unfinished-business`. **Ask the organizer for the password.** It is not in this repository or the submission post.
- Open `/workshop`. The workspace asks for the OpenCode server password as well; the organizer has that too.
- The instance runs its own OpenCode server on a private disk and edits only its isolated demo workspace.

**What each stage does**

| Stage | What it does | What you approve |
|---|---|---|
| Oracle | Asks up to three focused questions and drafts a product proposal | The idea and its assumptions |
| Architect | Drafts one plan section at a time against a content contract | Each section, by exact version |
| Maker | Performs one bounded native edit through OpenCode | The edit scope, before anything runs |
| Witness | Reviews the observed diff and check result in a fresh session | Nothing; it reports honestly, including failures |

**What a live run costs**

DeepSeek V4.1 Flash is a paid model. The first time you select it, the workspace asks you to confirm the charge, and nothing is sent until you do. OpenCode reports the session cost after it runs; the workspace never claims a price it was not given. Cancelling before the first message costs nothing.

**How to stop a run**

Open **Activity & results** and choose **Cancel**. A run that times out can be reconciled or marked abandoned; the workspace never silently repeats a native action.

**Troubleshooting**

| Symptom | Fix |
|---|---|
| `Port 4310 is already in use by: …` | Stop the process named in the message, or set `UB_PORT` in `.env` to a free port. |
| The wizard cannot connect, or shows `authentication_required` | Start OpenCode (`npx --no-install opencode serve --hostname 127.0.0.1 --port 4096`) and paste the password it prints. |
| `Free usage limit reached`, or the model is unavailable | The free OpenCode allowance is exhausted. Use your own OpenCode account, or pick another model in the wizard. |

## Run it locally

Prerequisites:

- **Node 22.14+**, npm, and **Linux x64** or **macOS** (Apple Silicon or Intel). Windows and Linux ARM64 are unsupported.
- **OpenCode 2.0.32**, installed by `npm ci` from the lockfile; a compatible global `opencode` on `PATH` is preferred automatically.
- **Provider access, optional, for live runs only.** Configure it inside OpenCode (for example OpenCode Go or your own provider). The workspace never holds the provider key. Without it, the landing page and the recorded sample still work; live stages report that no model is available.

```bash
npm ci
npm start
```

`npm start` builds the interface, refuses a port that is already in use (naming the process), and prints one URL. Open that URL (`http://127.0.0.1:4310/` by default) and follow the wizard.

For live stages, OpenCode must be running. In a second terminal:

```bash
npx --no-install opencode serve --hostname 127.0.0.1 --port 4096
```

Leave it running and paste the password it prints into the wizard. If OpenCode is not running, `npm start` says so and the app still serves the landing page and the sample.

**Offline.** The landing page, the recorded sample, and the connection screen work with no internet. Live Oracle, Architect, Maker, and Witness runs need a model provider, so they need network access. No fully offline model is bundled.

If OpenCode cannot be resolved:

```bash
npm run diagnose:platform   # CLI, platform, version, and permission diagnostics
npm run smoke:opencode      # starts the resolved server, reads /api/info, then stops it
```

## Verification

Run the release matrix:

```bash
npm run typecheck
npm test
npm run build
npm run budget
npm run test:visual
npm run test:platform
npm run smoke:opencode
```

Current results (2026-11-01, Linux x64, Node 22.22.1, no live provider inference):

- **207 unit/integration/component tests pass**, including a complete source → Oracle → proposal → revision → approval → Maker → timeout → reconcile → Witness journey test.
- **26 Playwright visual/accessibility/resilience tests pass** with committed snapshots at **390px, 768px, and 1440px**, plus loading, offline, 200% zoom, long-content, keyboard, reduced-motion, and contrast checks.
- Initial JS is **201.5 KiB gzip**; all JS **280.4 KiB**; CSS **17.0 KiB gzip**; all hero variants **581.2 KiB** total. The all-JS budget remains 290 KiB and CSS remains within its 18 KiB budget.
- Platform resolution passes on Linux x64; `npm run smoke:opencode` starts a disposable OpenCode 2.0.32 server, reads `/api/info`, and stops it without a prompt or model call.
- macOS Apple Silicon and macOS Intel run the same install, resolution, typecheck, tests, build, workspace-safety, and smoke steps in the `macos-15` and `macos-15-intel` CI jobs. CI runs `41252770576` and `41253037115` passed all three matrix jobs.
- Keyboard focus order, dialog Escape, setup tab arrow keys, drawer operation, 200% text zoom, 390px overflow, reduced motion, and token contrast are checked.
- Sample playback, reset isolation, fixture/schema drift, 90-second timing, tab inspection, no-network behavior, canonical landing/demo consistency, and hosted-sample mutation rejection are covered.
- State migration deterministically upgrades schema v1, both supported v2 shapes, schema v3, schema v4, schema v5, and schema v6 to v7 without dropping proposals, approvals, transcripts, operations, evidence, selected model data, provider policy, limits, or candidate history.
- Project-source paths, incomplete intake, explained question limits, explicit assumptions, proposal provenance, reload persistence, correction history, and project-memory corrections are covered.
- Section contracts, candidate creation/supersede, accept/reject, stale approvals, base-version conflicts, safe Markdown rendering, and unified/side-by-side diffs are covered.
- Model access policy, paid/unknown-price confirmation, optional spending limits, provider failure classification/redaction, and runtime confirmation gates are covered.
- Local and hosted-sample smoke journeys pass; the hosted sample makes no inference call and rejects mutation.
- OpenCode 2.0.32 live compatibility probe passed (version, catalog, and disposable session create/read/remove; no prompt or model call).
- Production dependency audit at `--audit-level=high` passes, and the full `npm audit` now reports **0 vulnerabilities**. The vulnerable transitive `glob`/`minimatch` pair under the Sentry bundler plugin is overridden to fixed versions without changing the Sentry major line.

`npm run test:visual` needs a Chromium executable. It prefers `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, then system Chrome/Chromium, then Playwright's browser.

## Status and limitations

The prior release phases remain integrated. **Phase 8** adds the final hardening gate: an end-to-end workshop journey test, responsive snapshots at 390/768/1440, loading/offline/long-content checks, accessible revision tabs and live progress announcements, broader security route tests, a zero-advisory dependency audit, and in-repository hackathon copy/assets. **Platform Phase 7** adds macOS support alongside the existing Linux x64 path: the official cross-platform `@opencode/cli` replaces the Linux-only package, runtime resolution prefers a compatible global `opencode` then the lockfile binary, and CI runs `41252770576` and `41253037115` passed Linux x64, macOS Apple Silicon, and macOS Intel. Upgrade Phase 6 rewrites the public story around one canonical Driftwatch sample. Upgrade Phase 5 remains the focused workshop. Schema v7 is unchanged.

Known limitations:

- The application is a trusted single-project tool, not a multi-tenant sandbox. Remote imports are public HTTPS clones into a managed local directory; private/authenticated repositories, shared-host isolation, arbitrary Maker access to selected repositories, and remote browser-to-local pairing remain deferred.
- The supported local hosts are **Linux x64**, **macOS Apple Silicon**, and **macOS Intel**, verified by local runs and CI runs `41252770576`/`41253037115`. Windows, Linux ARM64, and 32-bit hosts are unsupported.
- Maker edits only `UB_DATA_DIR/demo-workspace`; the Node check is not an OS sandbox.
- Generated section review supports a deliberately small, safe Markdown subset (headings, paragraphs, lists, emphasis, links, tables, and code), not full CommonMark or raw HTML. Contract validation checks structure and topic coverage, not prose quality.
- Model availability, pricing, quota, training terms, and billing are controlled by OpenCode/provider. The spending limit only checks cost OpenCode reports after a session; unknown-price providers may bill before that value is visible.
- The workspace privacy preference records intent; the app cannot attest every provider's training/retention contract. Provider rejections that mention training/data policy are explained as `PROVIDER_DATA_POLICY`.
- Advanced diagnostics load only when opened. Permission polling is best-effort; a pending request remains visible in Activity & results and the contextual permission alert, but a provider-side change can lag by one refresh interval.
- Backboard is not integrated and no partner category is claimed for installation alone. Sentry is configured but live release/source-map/trace verification requires authorized credentials and a deployment.
- No public hosted URL, recorded video, published article, or submission is asserted by this repository.
- A real recorded demonstration and final submission packaging remain separate acceptance work.

## Documentation

Canonical:

- [Product brief](docs/PRODUCT_BRIEF.md) — positioning, landing claims, three usage paths.
- [Architecture](docs/ARCHITECTURE.md) — routes, trust boundaries, persistence, modes, security.
- [Security model](docs/SECURITY_MODEL.md) — trust boundaries, controls, threat-to-test mapping, residual risks.
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md) — phase history and release gate.
- [OpenCode integration](docs/OPENCODE_INTEGRATION.md) — tested version/API surface, discovery, credentials ownership, sessions, limits.
- [Local setup](docs/LOCAL_SETUP.md) — tested commands and troubleshooting.
- [Hosted deployment](docs/HOSTED_DEPLOYMENT.md) — Render/private instance, demo policy, secrets, review procedure.
- [Tool catalog](docs/TOOL_CATALOG.md) — selected tools and honest availability.
- [UX and visual system](docs/UX_AND_VISUAL_SYSTEM.md) — theme, tokens, components, character states, motion, accessibility, performance budget.
- [Operations and recovery](docs/OPERATIONS_AND_RECOVERY.md) — data layout, backups, migrations, retention, failure matrix.
- [Demo and submission](docs/DEMO_AND_SUBMISSION.md) — scenario, fixture provenance, playback/reset, exact claims, video beats, disclosure.
- [Decisions](docs/DECISIONS.md) — product, interface, demo, and hardening decisions.
- [Changelog](docs/CHANGELOG.md) — released changes.
- [Evidence index](docs/EVIDENCE.md) — requirements-to-evidence matrix, commands, limitations.
- [Release notes](docs/RELEASE_NOTES.md) — concise release handoff.
- [Hackathon and release copy](docs/release/HACKATHON_COPY.md) — prepared pitch, description, demo script, claim checklist, asset manifest; not published.

History and provenance:

- [Engineering blueprint](docs/history/ENGINEERING_BLUEPRINT.md) — superseded planning record.
- [Product idea packet](docs/history/Unfinished-Business-Idea-Packet-v1.md) — approved discovery record.
- [Render deployment notes](docs/history/RENDER_DEPLOYMENT.md) — superseded by the hosted deployment guide.
- [Sentry and OpenCode setup](docs/history/SENTRY_AND_OPENCODE_SETUP.md) — superseded by integration/deployment guides.
- [Complete local prompt set](docs/prompts/README.md) — runtime Prompts 0–3 and project overrides.

## Development policy

- Repository: [kernelKain/unfinished-business](https://github.com/kernelKain/unfinished-business).
- Work on the existing `main` branch. Do not create phase branches.
- Complete and verify each phase, then make one commit for that phase before starting the next phase.
- Steps are work/checklist units, not individual commits. Commit subjects describe the change without phase or step numbering.
- Preserve unrelated changes. A blocked commit blocks entry to the next implementation phase; do not bypass access restrictions.
- No fabricated testimonials, usage figures, awards, or live-run claims.
- No second coding harness, authenticated repository connector, arbitrary Maker repository mount, or public arbitrary-execution sandbox.

## Delivery

The first release targets a local browser on Linux x64 and macOS (Apple Silicon and Intel). CI runs `41252770576` and `41253037115` verified all three platforms. A real recorded demonstration and a reproducible local-start guide provide judge access; hosted code execution is outside this release. Release copy and an asset manifest are prepared in `docs/release/HACKATHON_COPY.md`, but no article, video, hosted submission, or external publication has been performed. Backboard, Sentry Agent Tracing, and Entire remain selected partner targets, with qualification conditional on meaningful actual use and evidence. Publication, deployment, domain registration, credit claiming, and submission remain pending separate authorization.

## License

[MIT](LICENSE). Dependency, prompt, and asset attribution must be checked before redistribution. The generated hero asset's prompt and provenance are documented in [docs/UX_AND_VISUAL_SYSTEM.md](docs/UX_AND_VISUAL_SYSTEM.md).
