# Implementation plan and phase record

**Status:** Phase 9 release-verification gate complete; publication/submission pending explicit authorization.
**Owner:** Engineering.
**Last verified:** 2026-10-31.

## Phase history

| Phase | Outcome | State |
|---|---|---|
| Foundation | Node/Hono/React/Vite shell, atomic project store, shared contracts, pinned OpenCode client | Complete and committed |
| Staged workflow | Oracle, Architect, Maker, Witness transitions; exact-version approvals; dependency invalidation; idempotency; recovery | Complete and committed |
| Guided experience | Native edit path, fresh Witness review, recovery, Run Inspector data, evidence references | Complete and committed |
| OpenCode onboarding/discovery | First-run connection wizard, model/provider/agent discovery, model selection, sessions, permissions, usage | Complete and verified |
| Ghostlight interface | Landing page, visual system, motion, spirit characters, deterministic demo, visual/accessibility tests | Complete and verified |
| Hosted runtime modes | Hosted-demo/private-hosted distinction, read-only connection policy, deployment documentation | Complete and verified for the demo policy |
| Phase 7 — Guided demo | Versioned fixture, guided playback, 90-second presentation, mutation rejection, reset isolation | Complete and verified |
| Phase 8 — Hardening | Modes, workspace/network policy, HTTP security, atomic schema v2, migration, retention, redaction, budgets, failure matrix | Complete and verified before Phase 9 |
| Phase 9 — Release gate | Reconciled both lines, canonical docs, migration fixtures, full matrix, local/demo/OpenCode evidence, evidence index | Complete; final phase commit recorded by `git log -1` |

The guided-interface line (`origin/main` at `b2d2654`) and the hardening line (`origin/phase-8-hardening` at `8c50439`) both descended from `2205774`. Phase 9 integrates them rather than choosing one and losing the other. The release candidate therefore keeps the landing page, onboarding, deterministic demo, security middleware, state migration, retention, and recovery in one build.

## Phase 8 hardening units

| Unit | Outcome | Evidence |
|---|---|---|
| H1 modes/config | `local`, `hosted-demo`, `private-hosted`; fail-closed startup; explicit public origin in private mode | `config.ts`; `security.test.ts` |
| H2 workspace/static | Broad-root rejection, realpath containment, private modes, traversal/symlink tests | `security/workspace.ts`; security tests |
| H3 network | URL syntax, SSRF/DNS classification, remote allowlist, redirect refusal, timeout/response cap | `security/network.ts`; security tests |
| H4 HTTP | Host/Origin/CSRF, Basic Auth, session token, content-type, size/rate/concurrency, SSE | `app.ts`; `http-hardening.test.ts` |
| H5 persistence | Schema v2, migration, lock, fsync/rename, backups, quarantine, retention, restart recovery | `atomic-project-store.ts`; `store-hardening.test.ts` |
| H6 experience | Timeout/budget classification, pending permission, unknown outcome, cancellation, redaction | `experience-hardening.test.ts`; `experience.test.ts` |
| H7 documentation | Trust boundaries, operations, integration, setup, decisions | this documentation set |

## Phase 9 release gate

### Prerequisite reconciliation

- Both predecessor lines were inspected at their actual commits; no missing MUST was hidden as documentation work.
- The worktree was clean at `b2d2654` before integration. The completed hardening line was merged, conflicts were resolved by preserving both feature sets, and tests were updated only where the final behavior intentionally changed (async Maker runs, public read-only demo, canonical `UB_DEPLOYMENT_MODE`).
- Backboard remains unavailable and is not claimed. Sentry live release/source-map/trace proof remains unavailable without authorized credentials. Entire session sharing remains a development record, not a runtime feature. These are pending partner-category claims, not product-release blockers; no category is claimed.

### Work units

| Unit | Outcome |
|---|---|
| R1 source reconciliation | Unified schema v2/migration, app pipeline, connection/discovery, worker runs, guide budgets, modes, web client token handling |
| R2 verification matrix | Dependency install, typecheck, 111 tests, build, budget, visual/accessibility, migrations, local smoke, hosted-demo smoke, OpenCode compatibility probe, audit |
| R3 documentation migration | Canonical docs, history moves, superseded notices, runtime prompt boundary, evidence index, release notes |
| R4 handoff | Known limitations, post-release work, release note, no deployment/publication |

### Verification results

| Check | Result | Limitation |
|---|---|---|
| Clean install | PASS — `npm ci` | Network-backed registry; exact lockfile |
| Typecheck | PASS | — |
| Unit/integration tests | PASS — 111 | No live provider inference |
| Production build | PASS | Vite reports a >500 KiB initial chunk warning; gzip budget passes |
| Bundle/asset budget | PASS — 193.8 / 263.6 / 14.2 KiB gzip; hero 570.9 KiB; largest 86.7 KiB | Initial chunk warning remains |
| Visual/accessibility suite | PASS — 18 Playwright tests | Chromium system binary; deterministic fixtures |
| State migration | PASS — v1, guided v2 without mode/timestamps, hardening v2 without engine | Future versions are refused/preserved |
| Maker run matrix | PASS — queue, 202, active inspection, duplicate, failure, timeout, permission, cancellation, reconciliation, restart | No live model call in Phase 9 |
| OpenCode compatibility | PASS — server 2.0.32, catalog, disposable session create/read/remove | No inference; no provider account; no agents/commands in the empty test config |
| Local fresh setup | PASS — health, mode, token, project, workshop route | OpenCode was not running during the local smoke |
| Hosted demo | PASS — fixture project, no token, `DEMO_READ_ONLY`, no engine, `/demo` HTML | Preview only; no public deployment |
| Navigation/approval gate | PASS — unit tests plus 18 visual tests | — |
| Demo/reset isolation | PASS — fixture tests and Playwright request capture | — |
| Recommendation fixtures | PASS — static policy fixtures and source/freshness test | Static guidance, not a live recommender |
| Security/recovery | PASS — traversal, SSRF, origin, rate, size, redaction, corruption, disk, retention | Rate limiter is in-process |
| Production dependency audit | PASS at `--audit-level=high`; 6 moderate advisories remain | Sentry bundler plugin, developer build path |
| Sentry release/maps/traces | NOT RUN in Phase 9 | No authorized `SENTRY_AUTH_TOKEN`/deployment; config is statically reviewed |
| Render/private-host validation | PASS — static Blueprint/env review | No live deployment was authorized |
| Article/video/submission | NOT STARTED | Publication and submission are separate authorization |

### Acceptance status

- All MUST requirements have current evidence or an explicit limitation.
- Canonical docs match routes, schema v2, environment variables, tested versions, modes, and UI terminology.
- Legacy material is preserved under `docs/history/` with pointers.
- Runtime prompts remain in `docs/prompts/`; implementation-phase material is not loaded as a runtime prompt.
- Local setup is reproducible; hosted demo is safe and truthful; private hosting steps are reviewable.
- No secrets or private traces were added to tracked files or public evidence.
- Full tests/build pass and the worktree is clean after the phase commit.

## Deferred and post-release work

1. Shared multi-user isolation and remote browser-to-local pairing.
2. Arbitrary repository connectors; the current release is demo-workspace bounded.
3. Backboard R-CLI integration and any partner category claim based on it.
4. Live Sentry release/source-map/trace verification with authorized credentials.
5. Public hosted URL, recorded video, published article, and submission.
6. A deliberate chunk-splitting improvement for the initial browser bundle if it grows.
7. A resolved dependency advisory path without a breaking Sentry downgrade.

## Verification commands

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run budget
npm run test:visual
npm audit --omit=dev --audit-level=high
node scripts/preflight.mjs
```
