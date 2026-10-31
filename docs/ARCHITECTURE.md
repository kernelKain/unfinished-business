# Architecture — Unfinished Business

**Status:** Platform Phase 7 (macOS support) implemented on the verified Upgrade Phase 6 baseline.
**Owner:** Engineering.
**Last verified:** 2026-11-01 against the Platform Phase 7 verification matrix recorded in `docs/EVIDENCE.md`.

## 1. System shape

```text
Browser
  ├─ /            landing page (eager)
  ├─ /demo        guided sample (lazy chunk)
  └─ /workshop    real workshop (lazy chunk)
        │
        │ same-origin fetch /api/*
        │ Basic Auth in hosted modes; x-ub-session-token on protected API routes
        ▼
Hono server (src/server/app.ts)
  ├─ /api/health                 public, minimal
  ├─ /api/mode                   public mode descriptor
  ├─ /api/session                token issue (loopback/local, Basic Auth/private)
  ├─ /api/runtime                effective limits/retention
  ├─ /api/engine                 connection/engine summary
  ├─ /api/connection*            check, configure (local only), reset
  ├─ /api/opencode/*             discovery, project-owned sessions, permissions, usage
  ├─ /api/engine/selection       persist a discovered model allowed by project policy
  ├─ /api/model-preferences      access mode, privacy preference, optional spending limit
  ├─ /api/project, /api/export   snapshot/approved plan; workspace paths omitted
  ├─ /api/project/source*        select source; explicitly confirm managed remote import
  ├─ /api/events                 authenticated bounded SSE snapshots
  ├─ /api/messages, /api/approvals, /api/sections/*
  ├─ /api/memory                 add or correct project memory; corrections supersede
  ├─ /api/runs*                  queue, inspect, cancel, reconcile
  └─ static dist/web             contained SPA fallback for HTML navigation
        │
        ▼
OpenCode 2.x server over loopback (or an explicit allowlisted remote)
  ├─ model/provider/agent discovery
  ├─ native tools, permissions, sessions, interruption
  └─ isolated demo workspace
```

Unfinished Business never implements a second agent loop, inference client, general command executor, or transcript store. OpenCode owns those. The app owns workflow state, approvals, dependency invalidation, evidence references, security policy, and the interface.

## 2. Frontend routing and bundles

`src/web/routes.ts` is the pure route resolver:

| Path | Route | Rendering |
|---|---|---|
| `/` | `landing` | Eager `LandingPage` |
| `/demo` | `demo` | Lazy `DemoPage` |
| `/workshop` | `workshop` | Lazy `WorkshopPage` |
| anything else | `landing` | Landing fallback |

`src/web/App.tsx` reads `window.location.pathname`, listens for `popstate`, updates `document.title` and `document.documentElement.dataset.route`, and scrolls to the top on route change. Navigations are ordinary anchors, so they work without a client router.

Measured production chunks after Phase 5 (2026-11-01):

- initial `index-*.js`: 195.5 KiB gzip;
- `WorkshopPage-*.js`: 69.1 KiB gzip (includes source onboarding, discovery, revision review, safe Markdown, project memory, and diffs);
- `DemoPage-*.js`: 12.5 KiB gzip;
- `SpiritStageTabs-*.js`: 3.6 KiB gzip;
- CSS: 17.0 KiB gzip (18 KiB budget; all JS budget remains 290 KiB).

The workshop presents one primary task at a time. A compact header carries the connection and selected model. The project outline is a collapsible drawer. Activity & results appears only when an operation or check exists, opens automatically for an active or abandoned run, and is organized into Progress, Changes, and Checks. Native IDs, capability mappings, raw evidence, and provider payloads live under Technical details. Project memory is a separate editable drawer; raw transcripts stay inside Advanced diagnostics. The previous permanent right rail and Session notes panel are gone.

Provider failures render as a dedicated card with what happened, saved-work state, repair action, retry/change-model controls, and technical disclosure. Activity & results retains a compact provider-error line even after the card is dismissed. The visual layer changes did not alter stage and approval semantics.

## 3. Static serving and assets

`src/server/index.ts` serves `dist/web` when it exists:

- `/` and HTML navigations → `index.html`;
- real files → their content type, with long-lived caching;
- unknown non-HTML paths → 404, not a 200 HTML fallback;
- `/api/*` is never served from disk;
- paths are resolved through `realpath` and must stay under `dist/web`;
- private state under `UB_DATA_DIR` is never in the static root.

Public hero assets are produced by `scripts/build-hero-assets.py` into `public/assets/hero/`; Vite copies them into `dist/web/assets/hero/`. The `<picture>` element selects portrait/wide crops and carries explicit dimensions.

## 4. Server modules

| Path | Responsibility |
|---|---|
| `src/server/app.ts` | HTTP pipeline, route validation, mode enforcement, SSE, error mapping |
| `src/server/index.ts` | Startup, config, canonical workspaces, static serving, graceful shutdown |
| `src/server/config.ts` | Mode/env parsing, secure defaults, limits, retention, public runtime descriptor |
| `src/server/security/network.ts` | OpenCode URL policy, SSRF/DNS checks, redirect refusal, timeout, response cap |
| `src/server/security/workspace.ts` | Broad-root rejection, realpath containment, private file modes, static containment |
| `src/server/security/limits.ts` | Rate limiter, concurrency gates, async lock, constant-time token compare |
| `src/server/security/redaction.ts` | Text/error/unknown/Sentry/log redaction |
| `src/server/project-sources.ts` | Source selection, local-path validation, remote URL policy, confirmation-gated managed import |
| `src/server/observability/logger.ts` | Structured JSON logs with correlation IDs |
| `src/server/store/atomic-project-store.ts` | Lock, atomic write, fsync, backups, quarantine, migration |
| `src/server/workflow/` | Schema v7, explicit v1–v6 migration, candidate transitions, idempotency, retention, restart recovery |
| `src/server/opencode/client.ts` | Safe client, version/auth/model readiness |
| `src/server/opencode/connection.ts` | Connection settings, discovery, model access policy and resolution |
| `src/server/opencode/executable.ts` | Cross-platform CLI resolution, platform support, version/permission/server-start diagnostics |
| `src/server/opencode/provider-errors.ts` | Classifies provider failures into safe, actionable categories |
| `src/server/opencode/sessions.ts` | Project-owned session/permission/usage controls |
| `src/server/experience/guide.ts` | Four role sessions, timeouts, stricter-of-two budgets, interruption |
| `src/server/experience/service.ts` | Oracle/Architect/Maker/Witness orchestration, full discovery prompt assembly, proposal sufficiency gate |
| `src/server/experience/runs.ts` | In-process Maker run coordinator |
| `src/server/experience/telemetry.ts` | Metadata-only Sentry spans |
| `src/server/prompts/loader.ts` | Loads complete runtime procedures from `docs/prompts/` |
| `src/shared/` | Browser-safe workflow, OpenCode, mode, and demo contracts; section content contracts; safe Markdown parser; line diff |
| `src/web/components/Markdown.tsx` | Safe React renderer for the Markdown subset (no raw HTML) |
| `src/web/components/ProjectMemory.tsx` | Editable decisions, answers, assumptions, constraints, and unresolved questions; corrections supersede prior entries |
| `src/web/components/RevisionReview.tsx`, `RevisionDiff.tsx` | Candidate summary, full revision preview, unified/side-by-side diff, accept/reject/request-another controls |
| `src/web/components/RunInspector.tsx` | Activity & results: Progress, Changes, Checks, and collapsed technical details |

## 5. Deployment modes

`UB_DEPLOYMENT_MODE` is canonical: `local`, `hosted-demo`, `private-hosted`. `UB_MODE` is accepted as a compatibility alias; the legacy `hosted-private` spelling maps to `private-hosted`. If unset, Render/production defaults to `private-hosted`; local development defaults to `local`.

| Mode | Listener | Access control | OpenCode | Persistence |
|---|---|---|---|---|
| `local` | loopback only | optional Basic Auth; session token always | separate loopback server, browser-editable URL | `UB_DATA_DIR` |
| `private-hosted` | `0.0.0.0` behind proxy | Basic Auth required; session token required | loopback child | private persistent disk |
| `hosted-demo` | `0.0.0.0` | public; mutation read-only; no token issued | none | visitor state not stored |

Local mode refuses a non-loopback bind. Private-hosted requires an explicit public URL/host for origin checks, plus `UB_ACCESS_PASSWORD` and `UB_SESSION_TOKEN`. The hosted demo deliberately requires neither and stays read-only.

### Local platform support

| Platform id | Status | Evidence |
|---|---|---|
| `linux-x64` | Supported and locally verified | Full matrix plus `npm run test:platform`, `npm run smoke:opencode`, and the CI `linux-x64` job |
| `darwin-arm64` | Supported and CI-verified | `macos-15` job in CI run `41252770576`: install, CLI resolution, typecheck, tests, build, workspace safety, OpenCode smoke |
| `darwin-x64` | Supported and CI-verified | `macos-15-intel` job in CI run `41252770576` with the same steps |
| `linux-arm64`, `win32-*`, 32-bit | Not supported or claimed | `OPENCODE_PLATFORM_UNSUPPORTED` diagnostic |

`src/server/opencode/executable.ts` owns platform gating, global-versus-local resolution, CLI version checks, and start-failure diagnostics. The Render supervisor shares the resolver; Render-specific paths stay in environment variables. A successful CLI resolution on a supported host materializes `node_modules/@opencode/cli/bin/opencode.exe` through the official package's postinstall.

## 6. Request pipeline and authorization

1. Optional Sentry middleware.
2. Correlation ID (`x-request-id`) and structured logger fields.
3. Security headers with a restrictive CSP; HSTS is disabled in local mode.
4. Host allowlist and `OPTIONS`/Origin/`Sec-Fetch-Site` policy.
5. Optional HTTP Basic Auth for every route except `/api/health`.
6. Hosted-demo mutation rejection before body parsing (`403 DEMO_READ_ONLY`).
7. Rate limit per trusted client; request-size cap; JSON content type for mutations.
8. Non-blocking mutation concurrency gate; separate bounded SSE gate.
9. Session-token check for every protected API route in local/private modes. `/api/session` and `/api/mode` are the only unauthenticated API reads besides health.
10. Route validation, workflow lock, state write.
11. Error mapping with stable code, retryability, operation ID, request ID, redacted message, and a structured `providerError` when a provider request failed.

The browser session token is issued only over loopback in local mode or after Basic Auth in private mode. It is compared in constant time. It is not persisted in browser storage.

## 7. State, evidence, and recovery

Schema v7 is the single current shape. It preserves the v6 project-source and Oracle discovery record and makes Architect revisions reviewable:

- project source metadata for new work, validated local repositories, confirmation-gated managed remote imports, saved work, and the recorded sample;
- field-level Oracle intake for intended user, problem, desired outcome, deadline/event, must-have and optional features, budget, privacy, platforms, repository condition, non-goals, and unresolved questions, with answer provenance and update timestamps;
- structured project memory buckets for answers, facts, user decisions, assumptions, constraints, and risks; corrections supersede prior entries instead of erasing history. The same fields support the editable Project memory drawer, which appends a user entry through `POST /api/memory` and marks the corrected entry `SUPERSEDED`;
- Oracle replies with `questions` or `proposal` mode, no more than three explained questions, known constraints, structured proposals, unresolved risks, and a recommended next action;
- candidate section revisions that remain separate from the approved/current section, with their base version/hash, requested change, human summary, decision time, and `PENDING`/`ACCEPTED`/`REJECTED`/`SUPERSEDED` status;
- a server-side content contract for each of the eight Architect sections: required topics, detail guidance, dependencies, risk and decision requirements, acceptance criteria, and required headings. Validation is structural (headings, paragraphs, list/table items, topic coverage, dependency acknowledgement) and never relies on word count alone;
- safe Markdown rendering and line diffs shared by the server validator, the review surface, and tests;
- model access mode (`ALL_ACCESSIBLE` or `FREE_OR_LOCAL_ONLY`), privacy preference, first paid/unknown-price acceptance timestamp, and optional budget limits;
- operation observation/application metadata and late-result-safe states;
- a nullable structured provider error on operations: category, human explanation, saved-work status, repair action, retryability, and redacted technical references;
- recovery metadata on operations: intended action (`intent`), target `sectionId`, `startingRevision`, `idempotencyKey`, `expectedOutput` type, retry lineage (`retryOf`), and a persisted `progress` phase;
- operation progress phases `CONNECTING`, `SESSION_CREATED`, `WAITING_FOR_MODEL`, `RECEIVING_OUTPUT`, `VALIDATING_RESULT`, `WAITING_PERMISSION`, `APPLYING_RESULT`, `RUNNING_CHECKS`, `AWAITING_RECONCILIATION`; the current phase is cleared when the run reaches a terminal status.

New projects default to `ALL_ACCESSIBLE` with no spending limit. A paid or unknown-price remote model additionally requires an explicit confirmation timestamp before it can be selected or used. `FREE_OR_LOCAL_ONLY` blocks paid/unknown remote models and is the migrated default for v1/v2/v3 projects, preserving their previous behavior.

Migration accepts:

- v1 fixed-model snapshots;
- guided-interface v2 snapshots with engine selection but no mode/timestamps;
- hardening-line v2 snapshots with mode/timestamps but no engine selection;
- v3 snapshots with `requireFreeOrLocal`, a nonnegative cost budget, and no provider error;
- v4 snapshots without the new operation metadata;
- v5 snapshots without the Phase 3 source/intake/memory shape;
- v6 snapshots whose candidates predate the base-version, summary, requested-change, and decision-time fields.

Migration is deterministic and idempotent. Missing legacy timestamps use the documented epoch sentinel `1970-01-01T00:00:00.000Z`; migration never reads the wall clock or generates IDs. Legacy saved projects become confirmed saved-work sources, legacy Oracle summary/questions become structured intake, and old memory entries remain intact. Legacy `UNKNOWN` operations become `ABANDONED` with their result and native references intact, and every migrated non-terminal operation receives a deterministic `AWAITING_RECONCILIATION` progress marker with the sentinel timestamp so old unknown runs remain reconcilable. A v7 document round-trips through JSON and schema validation without changing.

Operational rules:

- a new project cannot call Oracle until one of the four source paths is selected; a remote source remains unusable until its managed workspace is explicitly confirmed and imported;
- local repository paths pass the existing canonical workspace checks; canonical paths are private state and are omitted from public project responses and model prompts;
- broad-root rejection covers Linux and macOS roots (`/`, `/home`, `/tmp`, `/var`, `/Users`, `/Volumes`, `/System`, `/private`, `/private/tmp`, `/private/var/tmp`, `/private/var/folders`); the resolved real path of the host temporary directory is also rejected, so macOS's `/var` → `/private/var` alias cannot bypass the temporary-root check;
- remote repository URLs must be public HTTPS URLs without userinfo, query strings, fragments, or nonstandard ports; import uses a credential-disabled, noninteractive Git process in an app-managed directory and does not expose clone output;
- Oracle keeps the full discovery procedure active, asks at most three high-value explained questions per turn, and the server refuses a proposal until essential facts exist or every essential assumption has explicit user authorization;
- every mutation sends `actionId` and `expectedRevision`;
- duplicate action IDs return the existing result; a different payload is a conflict;
- approvals target an exact section version and hash;
- a change request queues an Architect run that records a `PENDING` candidate; it never writes the current draft. A new request supersedes an earlier pending candidate;
- a candidate is validated against its section contract before it is stored. The review surface shows the summary, the requested change, the complete revised Markdown, and a unified or side-by-side line diff;
- `POST /api/sections/:id/revisions/:candidateId/accept` applies the candidate only when the section still matches the candidate's base version/hash; the section becomes `DRAFT` at the candidate version and every transitive dependent approval becomes `STALE`;
- `POST /api/sections/:id/revisions/:candidateId/reject` marks the candidate `REJECTED` and changes no draft or approval;
- accepting a revision is not approval: the section still requires a separate exact-version approval;
- section versions, candidate decisions, and approval records are retained for audit;
- `POST /api/memory` adds a decision, answer, assumption, or constraint without changing any section, approval, Maker scope, or native run; a correction names the prior entry, appends a new active entry, and keeps the prior entry as `SUPERSEDED`;
- the workshop presents one primary task; the Project outline and Project memory drawers are collapsed unless opened or populated, and Activity & results is omitted when no operation or check exists;
- the compact header shows the connection and selected model; permission requests render as a contextual alert outside collapsed diagnostics;
- Advanced diagnostics are loaded only when the user opens them. They contain agents, commands, skills, MCP, LSP, formatters, usage, sessions, low-level revert, export, and the raw transcript;
- Maker requires every current section approved plus a separate scope grant;
- operation states are `QUEUED`, `RUNNING`, `WAITING_PERMISSION`, `COMPLETED_UNAPPLIED`, `SUCCEEDED`, `FAILED`, `CANCELLED`, and `ABANDONED`;
- `COMPLETED_UNAPPLIED` means a native result was observed or stored but has not (yet) been validated and applied exactly once;
- Oracle, Architect, Witness, and Maker runs are persisted asynchronous operations: the HTTP request returns `202 Accepted` with the queued operation and the run continues in the background (the synchronous `question` adapter is the documented exception because it changes no saved state);
- the run coordinator records progress phases through safe polling (`session.get`, `message.list`, `permission.request.list`) plus directed callbacks from the native guide; prompts, raw model text, and unvalidated JSON are never persisted as progress;
- a timeout, disconnect, or restart leaves the operation `ABANDONED` with an `AWAITING_RECONCILIATION` marker and its native session reference; it blocks new runs until reconciled but never permanently blocks the project;
- reconciliation observes the native outcome, retrieves the actual late reply or diff through fresh reads, validates it with the same schemas as live completions, and applies it at most once (`appliedAt` plus the idempotent action record); an idle session alone is never success;
- `POST /api/runs/:id/retry` starts a new Maker operation with `retryOf` lineage after a confirmed `FAILED` outcome; uncertain runs must be reconciled first;
- `POST /api/runs/:id/abandon` records a user decision on an outstanding operation when no in-process runner is active;
- startup marks in-flight work `ABANDONED` with a recovery marker; reconciliation reads native state and never replays automatically;
- evidence records an observed native result/fingerprint; a missing result is an empty state.

`AtomicProjectStore` acquires a cross-process lock, writes a private temp file, fsyncs, renames, keeps `.previous` and rolling `backups/`, quarantines corrupt current files, and prunes bounded retention. A corrupt current with no valid previous returns `STATE_CORRUPT`; it never silently resets.

## 8. Sample fixture boundaries

The guided sample is a browser-bundled fixture, not a server response and not a parallel UI. The same fixture also feeds the landing preview, visual snapshots, and the sample evidence view; `src/web/content/landing.ts` holds copy and configuration only, with no second operation/evidence state.

```text
src/shared/workflow.ts   production Zod schemas + types
        │
        ├─ src/server/workflow/model.ts  hashing, migration, persistence helpers
        ├─ src/shared/demo.ts            versioned fixture + beats + landing preview
        ├─ src/web/demo/DemoPage.tsx     playback + shared components
        └─ src/web/landing/DemoTeaser.tsx landing preview from the same fixture
                    │
                    ├─ RunInspector
                    ├─ SpiritStageTabs (inspect variant)
                    ├─ SpiritCharacter / StatusChip / Brand
                    └─ pure playback reducer (no API calls)
```

`src/shared/demo.ts` has no `node:`, `fetch`, `process.env`, `Date.now`, or `Math.random`. Tests parse the fixture with the production schemas, recompute section hashes, and assert that the landing preview and guided sample report the same check and live-proof status. Every recorded result is labeled; the live session remains `NOT_RUN`.

In `hosted-demo` mode the server independently returns the fixture from `/api/project` and `/api/export`, returns a read-only connection status, rejects `/api/session` and every non-GET `/api/*` request, and never constructs an OpenCode connection.

## 9. Trust boundaries and residual risks

| Boundary | Enforced controls |
|---|---|
| Browser → app | Host/Origin/CSRF policy, Basic Auth in hosted modes, constant-time session token, JSON content type, request-size cap, rate/concurrency limits |
| App → disk | Canonical roots, traversal/symlink rejection, regular-file checks, `0700` directories, `0600` files, lock, fsync, previous snapshot, backups, quarantine |
| App → OpenCode | URL syntax, loopback default, HTTPS and explicit host allowlist for remote, optional port allowlist, DNS/IP classification, redirect refusal, timeout, response cap, version/auth/model readiness |
| App → repository source | Canonical local-directory policy; public HTTPS-only remote URL; embedded-credential rejection; managed workspace; explicit confirmation before import; no Maker write authority in Phase 3; paths omitted from browser/model |
| OpenCode → provider | Native credentials, permissions, sessions; the app never reads provider keys |
| App → Sentry | Collection disabled, event/breadcrumb scrubbing, metadata-only spans, no prompts/tool args/results/local paths |
| App → export | Approved-only plan, redacted drafts, limitation metadata, no workspace path |

Residual risks:

1. **No shared-host isolation.** This is a trusted single-project tool, not a multi-tenant sandbox. The Node check is not seccomp/container isolation.
2. **Remote import is intentionally narrow.** Only public, credential-free HTTPS repositories are imported into a managed local workspace. Private repositories, authenticated Git, arbitrary redirects, submodule credentials, and remote browser-to-local pairing are not supported. DNS is checked before clone but this is not a network sandbox.
3. **Local process trust.** Any process running as the same OS user can read the data directory and local credentials.
4. **Provider facts are incomplete.** Model availability, pricing, quota, training terms, and billing are controlled by OpenCode/provider. The optional spending limit is enforced only against cost OpenCode reports after a session; an unknown-price route can bill before that value is visible. A tool-call budget is not claimed.
5. **Telemetry is best-effort.** Sentry delivery failure does not block the workshop. Provider error cards expose only redacted technical detail and a diagnostic reference; live release/source-map/trace verification needs authorized credentials.
6. **Dependency audit gap.** Six moderate `glob`/`minimatch` advisories are reachable through the Sentry bundler plugin during developer builds. The production audit at `--audit-level=high` passes; the suggested fix is a breaking Sentry downgrade.

## 10. Not in this architecture

- A second coding harness or command executor.
- A public arbitrary-execution sandbox.
- Remote access to a visitor's local repository.
- A database service.
- Automatic publication or submission.
- A heavy animation or 3D framework.
