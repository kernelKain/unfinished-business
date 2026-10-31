# Architecture — Unfinished Business

**Status:** Implemented release candidate; Phase 9 reconciled the guided interface with Phase 8 hardening.
**Owner:** Engineering.
**Last verified:** 2026-10-31 against `111` unit/integration tests, `18` visual/accessibility tests, the production build, budget, and local/hosted-demo smoke runs.

## 1. System shape

```text
Browser
  ├─ /            landing page (eager)
  ├─ /demo        deterministic walkthrough (lazy chunk)
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
  ├─ /api/engine/selection       persist a discovered free/local model
  ├─ /api/project, /api/export   snapshot/approved plan; workspace path omitted
  ├─ /api/events                 authenticated bounded SSE snapshots
  ├─ /api/messages, /api/approvals, /api/sections/*
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

Measured production chunks (2026-10-31):

- initial `index-*.js`: 193.8 KiB gzip;
- `WorkshopPage-*.js`: 54.9 KiB gzip (includes onboarding/discovery UI);
- `DemoPage-*.js`: 11.5 KiB gzip;
- `SpiritStageTabs-*.js`: 3.5 KiB gzip;
- CSS: 14.2 KiB gzip.

The workshop keeps four-stage navigation, plan outline, working document, and activity/evidence rail. The visual layer changed; stage and approval semantics did not.

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
| `src/server/observability/logger.ts` | Structured JSON logs with correlation IDs |
| `src/server/store/atomic-project-store.ts` | Lock, atomic write, fsync, backups, quarantine, migration |
| `src/server/workflow/` | Schema v2, transitions, idempotency, retention, restart recovery |
| `src/server/opencode/client.ts` | Safe client, version/auth/model readiness |
| `src/server/opencode/connection.ts` | Connection settings, discovery, model resolution |
| `src/server/opencode/sessions.ts` | Project-owned session/permission/usage controls |
| `src/server/experience/guide.ts` | Four role sessions, timeouts, budgets, interruption |
| `src/server/experience/service.ts` | Oracle/Architect/Maker/Witness orchestration |
| `src/server/experience/runs.ts` | In-process Maker run coordinator |
| `src/server/experience/telemetry.ts` | Metadata-only Sentry spans |
| `src/server/prompts/loader.ts` | Loads complete runtime procedures from `docs/prompts/` |
| `src/shared/` | Browser-safe workflow, OpenCode, mode, and demo contracts |

## 5. Deployment modes

`UB_DEPLOYMENT_MODE` is canonical: `local`, `hosted-demo`, `private-hosted`. `UB_MODE` is accepted as a compatibility alias; the legacy `hosted-private` spelling maps to `private-hosted`. If unset, Render/production defaults to `private-hosted`; local development defaults to `local`.

| Mode | Listener | Access control | OpenCode | Persistence |
|---|---|---|---|---|
| `local` | loopback only | optional Basic Auth; session token always | separate loopback server, browser-editable URL | `UB_DATA_DIR` |
| `private-hosted` | `0.0.0.0` behind proxy | Basic Auth required; session token required | loopback child | private persistent disk |
| `hosted-demo` | `0.0.0.0` | public; mutation read-only; no token issued | none | visitor state not stored |

Local mode refuses a non-loopback bind. Private-hosted requires an explicit public URL/host for origin checks, plus `UB_ACCESS_PASSWORD` and `UB_SESSION_TOKEN`. The hosted demo deliberately requires neither and stays read-only.

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
11. Error mapping with stable code, retryability, operation ID, request ID, and redacted message.

The browser session token is issued only over loopback in local mode or after Basic Auth in private mode. It is compared in constant time. It is not persisted in browser storage.

## 7. State, evidence, and recovery

Schema v2 is the single current shape. It includes approvals, action idempotency, operations, evidence, transcript, drafts, native session references, engine selection, mode, demo-workspace metadata, and timestamps. Migration accepts:

- v1 fixed-model snapshots;
- guided-interface v2 snapshots with engine selection but no mode/timestamps;
- hardening-line v2 snapshots with mode/timestamps but no engine selection.

Operational rules:

- every mutation sends `actionId` and `expectedRevision`;
- duplicate action IDs return the existing result; a different payload is a conflict;
- approvals target an exact section version and hash;
- revisions invalidate only transitive dependent sections/approvals;
- Maker requires every current section approved plus a separate scope grant;
- a run moves `QUEUED → RUNNING → WAITING_PERMISSION → SUCCEEDED/FAILED/CANCELLED/UNKNOWN`;
- startup marks in-flight work `UNKNOWN`; reconciliation reads native state and never replays automatically;
- evidence records an observed native result/fingerprint; a missing result is an empty state.

`AtomicProjectStore` acquires a cross-process lock, writes a private temp file, fsyncs, renames, keeps `.previous` and rolling `backups/`, quarantines corrupt current files, and prunes bounded retention. A corrupt current with no valid previous returns `STATE_CORRUPT`; it never silently resets.

## 8. Demo fixture boundaries

The deterministic demo is a browser-bundled fixture, not a server response and not a parallel UI:

```text
src/shared/workflow.ts   production Zod schemas + types
        │
        ├─ src/server/workflow/model.ts  hashing, migration, persistence helpers
        ├─ src/shared/demo.ts            versioned fixture + playback beats
        └─ src/web/demo/DemoPage.tsx     playback + shared components
                    │
                    ├─ RunInspector
                    ├─ SpiritStageTabs (inspect variant)
                    ├─ SpiritCharacter / StatusChip / Brand
                    └─ pure playback reducer (no API calls)
```

`src/shared/demo.ts` has no `node:`, `fetch`, `process.env`, `Date.now`, or `Math.random`. Tests parse the fixture with the production schemas and recompute section hashes. Every fixture result is labeled; the live session remains `NOT_RUN`.

In `hosted-demo` mode the server independently returns the fixture from `/api/project` and `/api/export`, returns a read-only connection status, rejects `/api/session` and every non-GET `/api/*` request, and never constructs an OpenCode connection.

## 9. Trust boundaries and residual risks

| Boundary | Enforced controls |
|---|---|
| Browser → app | Host/Origin/CSRF policy, Basic Auth in hosted modes, constant-time session token, JSON content type, request-size cap, rate/concurrency limits |
| App → disk | Canonical roots, traversal/symlink rejection, regular-file checks, `0700` directories, `0600` files, lock, fsync, previous snapshot, backups, quarantine |
| App → OpenCode | URL syntax, loopback default, HTTPS and explicit host allowlist for remote, optional port allowlist, DNS/IP classification, redirect refusal, timeout, response cap, version/auth/model readiness |
| OpenCode → provider | Native credentials, permissions, sessions; the app never reads provider keys |
| App → Sentry | Collection disabled, event/breadcrumb scrubbing, metadata-only spans, no prompts/tool args/results/local paths |
| App → export | Approved-only plan, redacted drafts, limitation metadata, no workspace path |

Residual risks:

1. **No shared-host isolation.** This is a trusted single-project tool, not a multi-tenant sandbox. The Node check is not seccomp/container isolation.
2. **No remote repository connector.** `private-hosted` can point at an allowlisted OpenCode server but does not add multi-tenant isolation or a remote browser-to-local pairing flow.
3. **Local process trust.** Any process running as the same OS user can read the data directory and local credentials.
4. **Provider facts are incomplete.** Free-model availability, quota, and billing are controlled by OpenCode/provider. Elapsed-time and session-token limits are enforced where reported; a tool-call budget is not claimed.
5. **Telemetry is best-effort.** Sentry delivery failure does not block the workshop. Live release/source-map/trace verification needs authorized credentials.
6. **Dependency audit gap.** Six moderate `glob`/`minimatch` advisories are reachable through the Sentry bundler plugin during developer builds. The production audit at `--audit-level=high` passes; the suggested fix is a breaking Sentry downgrade.

## 10. Not in this architecture

- A second coding harness or command executor.
- A public arbitrary-execution sandbox.
- Remote access to a visitor's local repository.
- A database service.
- Automatic publication or submission.
- A heavy animation or 3D framework.
