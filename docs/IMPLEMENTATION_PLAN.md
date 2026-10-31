# Implementation plan and phase record

**Status:** Upgrade Phase 4 complete and verified.
**Owner:** Engineering.
**Last verified:** 2026-11-01.

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
| Upgrade Phase 0 — Product-upgrade preparation | Baseline record, schema v3, explicit v1/v2 migration, richer operation states, reusable provider/timing/reconciliation fixtures | Complete and verified; commit recorded by `git log -1` after phase handoff |
| Upgrade Phase 1 — Model access and provider recovery | All accessible models, per-project access policy, optional spending limits, paid/unknown-price confirmation, structured provider errors, schema v4 migration | Complete and verified; commit recorded by `git log -1` after phase handoff |
| Upgrade Phase 2 — Run observability and recovery | Persisted async Oracle/Architect/Witness/Maker runs, live progress phases, elapsed/cancel/retry/abandon/reconcile controls, exact-once late-result reconciliation, schema v5 migration | Complete and verified; commit recorded by `git log -1` after phase handoff |
| Upgrade Phase 3 — Project intake and guided discovery | Four-way source onboarding, safe confirmation-gated imports, multi-turn Oracle intake, structured proposal/memory, schema v6 migration | Complete and verified; commit recorded by `git log -1` after phase handoff |
| Upgrade Phase 4 — Reviewable generated revisions | Section content contracts, candidate revisions, explicit accept/reject, stale approvals, safe Markdown, unified/side-by-side diffs, schema v7 migration | Complete and verified; commit recorded by `git log -1` after phase handoff |

The guided-interface line (`origin/main` at `b2d2654`) and the hardening line (`origin/phase-8-hardening` at `8c50439`) both descended from `2205774`. Phase 9 integrates them rather than choosing one and losing the other. The release candidate therefore keeps the landing page, onboarding, deterministic demo, security middleware, state migration, retention, and recovery in one build.

## Upgrade Phase 0 — product-upgrade preparation

### Baseline

- Starting revision: `7d45e439bddd28bd9d9dcffa3541353c625db40a` on `main`.
- Existing `.backboard/` content remained untracked and untouched.
- Before editing, `npm run typecheck`, all 111 inherited tests, and `npm run build` passed.

### Work units

| Unit | Outcome | Evidence |
|---|---|---|
| U0-1 schema foundation | Schema v3 adds source metadata, Oracle intake, structured memory, candidate revisions, model/budget preferences, and operation observation/application fields | `src/shared/workflow.ts`; migration tests |
| U0-2 migration | Explicit v1 and v2 readers upgrade to v3 with fixed defaults; legacy `UNKNOWN` maps to `ABANDONED` | `src/server/workflow/model.ts`; `tests/migration.test.ts` |
| U0-3 operation model | Eight required states include late-result `COMPLETED_UNAPPLIED` and unconfirmed `ABANDONED` | contracts, run/recovery tests |
| U0-4 reusable fixtures | Synthetic provider policy/auth/rate/generic failures, slow/late responses, late diff, permission, and reconciliation | `tests/fixtures/provider-scenarios.ts`; fixture tests |
| U0-5 documentation | Architecture, migration policy, recovery, decisions, evidence, release notes, README | canonical documentation set |

### Acceptance status

- [x] Old v1 and both historical v2 saved-project shapes migrate to schema v3.
- [x] Proposals, sections, approvals, transcripts, operations, evidence, native references, and selected model data are asserted after migration.
- [x] Migration is deterministic and idempotent; absent legacy timestamps use a fixed sentinel.
- [x] New fixtures are importable, serializable, deterministic, and contain no credentials/private output.
- [x] Final typecheck, 118 tests, build, budget, 18-test visual suite, high-severity audit, and diff/security review pass.

Phase 0 acceptance passed on 2026-11-01. The visual harness uses an unused loopback OpenCode port so an unrelated local OpenCode process cannot change first-run screenshots.

## Upgrade Phase 1 — model access and provider recovery

### Outcome

The product can use any model OpenCode reports as available to the connected account, while preserving an intentional free/local-only policy, explicit paid/unknown-price consent, optional spending limits, and actionable provider failure recovery.

**Phase commit:** `feat(models): support all accessible OpenCode models`.

### Work units

| Unit | Outcome | Evidence |
|---|---|---|
| U1-1 schema and migration | Schema v4 activates access mode, privacy preference, paid/unknown acceptance, optional limits, and operation provider errors; v3 migrates with prior effective policy preserved | `src/shared/workflow.ts`, `src/server/workflow/model.ts`, `tests/migration.test.ts` |
| U1-2 access policy | All-accessible default; free/local-only remains available; selection and run paths share the same policy | `src/server/opencode/connection.ts`, `src/server/experience/service.ts`, `tests/model-access.test.ts`, `tests/connection.test.ts` |
| U1-3 confirmation gate | Paid/unknown-price selection and first request require an explicit persisted confirmation; no silent substitution | `/api/engine/selection`, model context, `tests/model-access.test.ts`, `tests/experience.test.ts` |
| U1-4 budgets | Unlimited/disabled and positive project/deployment limits; stricter limit wins; unknown-price limitation disclosed | `src/server/experience/guide.ts`, `src/server/config.ts`, `tests/budgets.test.ts`, `tests/security.test.ts` |
| U1-5 provider errors | Eight safe categories, saved-work status, repair/retry action, redacted technical details, diagnostic reference | `src/server/opencode/provider-errors.ts`, `src/shared/workflow.ts`, `tests/provider-errors.test.ts` |
| U1-6 interface | Model metadata, privacy warning, cost confirmation, provider error card, Run Inspector provider line | `src/web/onboarding.tsx`, `src/web/opencode-panel.tsx`, `src/web/components/ProviderErrorCard.tsx`, `src/web/workshop/WorkshopPage.tsx` |
| U1-7 documentation | README, architecture, decisions, integration, setup, operations, evidence, release notes, changelog | canonical documentation set |

### Acceptance status

- [x] Paid, free, local, and unknown-price models reported as available can be selected under the appropriate policy.
- [x] Free/local-only mode still blocks other models intentionally, including when an acceptance flag is supplied.
- [x] Paid/unknown-price requests require an explicit first-use confirmation and are blocked at runtime if absent.
- [x] No paid request is made silently; no model is invented or substituted.
- [x] Optional unlimited/positive spending limits are stored and enforced; zero/negative input is rejected.
- [x] Provider privacy/training rejections produce `PROVIDER_DATA_POLICY` and a review-privacy repair.
- [x] Generic provider failures retain a safe `provider-…` diagnostic reference with secrets and paths redacted.
- [x] v3 projects migrate to v4 with their selected model and prior effective access policy; v1/v2 also migrate safely.
- [x] Final typecheck, 139 tests, build, budget, visual suite, and diff/security review pass.

Phase 1 acceptance passed on 2026-11-01. No live provider inference was used for the new tests.

## Upgrade Phase 2 — run observability and recovery

### Outcome

OpenCode operations are persisted asynchronous work with honest live progress. A slow run shows where it actually is; a timed-out or restarted run stays reconcileable; reconciliation retrieves and validates the real late response or diff and applies it exactly once; confirmed failures can be retried into a fresh, lineage-tracked operation without duplicating native work.

**Phase commit:** `fix(runtime): make OpenCode runs observable and recoverable`.

### Work units

| Unit | Outcome | Evidence |
|---|---|---|
| U2-1 contracts and migration | Schema v5 adds operation `intent`, `sectionId`, `startingRevision`, `idempotencyKey`, `expectedOutput`, `retryOf`, and persisted `progress` phases; explicit v1/v2/v3/v4 migrations backfill deterministic `AWAITING_RECONCILIATION` markers for non-terminal rows | `src/shared/workflow.ts`, `src/server/workflow/model.ts`, `tests/migration.test.ts` |
| U2-2 observation layer | `@opencode/client` event/session APIs inspected; safe polling implemented through `message.list`, `session.get`, and permission reads; `SpiritGuide` gains `lastAssistantText`, `sessionDiff`, `hasPendingPermission` and progress callbacks | `src/server/experience/guide.ts`, `docs/DECISIONS.md` U2-01 |
| U2-3 async guide runs | Oracle/Architect/Witness runs queue (`202`) via `GuideRunCoordinator`; persisted queued operation, live phases, cancel support, malformed/timeout classification, schema-valid application of replies | `src/server/experience/guide-runs.ts`, `src/server/experience/service.ts`, `tests/experience.test.ts` |
| U2-4 maker progress | Maker coordinator records `CONNECTING → SESSION_CREATED → WAITING_FOR_MODEL → RECEIVING_OUTPUT → VALIDATING_RESULT → RUNNING_CHECKS` plus terminal states; terminal writes clear progress coherently | `src/server/experience/runs.ts`, `tests/observable-runs.test.ts` |
| U2-5 exact-once reconciliation | Reconcile observes outcome, retrieves the actual diff/reply, validates with live-schema logic, applies once per operation; `COMPLETED_UNAPPLIED` reachable; aggregated helper for Maker recovery | `src/server/experience/service.ts`, `runs.ts`, `tests/experience-hardening.test.ts`, `tests/observable-runs.test.ts` |
| U2-6 controls | New routes `POST /api/runs/:id/retry` (confirmed-failure Maker only, `retryOf` lineage) and `POST /api/runs/:id/abandon`; cancel extended to guide runs; Run Inspector: elapsed time, progress phases, Continue waiting, Reconcile now, Open in OpenCode, Cancel, Retry, Mark abandoned | `src/server/app.ts`, `src/web/components/RunInspector.tsx`, `src/web/workshop/WorkshopPage.tsx`, `src/web/api.ts` |
| U2-7 restart recovery | Startup recovery keeps native references and stamps the recovery marker; reconnect tests reconcile a persisted late Maker diff through a fresh service | `src/server/workflow/service.ts`, `tests/observable-runs.test.ts`, `tests/store-hardening.test.ts` |
| U2-8 documentation | README, architecture, decisions, operations/recovery, integration, implementation plan, evidence, release notes, changelog | canonical documentation set |

### Acceptance status

- [x] A slow run shows useful progress promptly (persisted phases: connecting, session created, waiting for model, receiving output, validating result, waiting for permission, applying result, running checks).
- [x] A timed-out run does not permanently block the project: `AWAITING_RECONCILIATION` marker plus working reconcile path; `RUN_UNRESOLVED` clears after reconciliation.
- [x] Reconciliation applies a valid late result once (Oracle reply, Architect section 06 draft, Maker diff with check evidence).
- [x] Retrying cannot duplicate a previous native run (new operation per retry, `retryOf` lineage, confirm-failure gate, unresolved-run gate).
- [x] Cancelled or abandoned operations remain understandable in history (visible statuses, reasons, and recovery notes).
- [x] No private chain-of-thought or unvalidated raw JSON is displayed or saved as a section; partial output is never shown.
- [x] Old unknown operations are recoverable through migration (v1/v2/v3/v4 → deterministic recovery marker, native references kept).
- [x] Final typecheck, 150 unit/integration tests, build, budget, 18-test visual suite, and diff/security review pass.

Phase 2 acceptance passed on 2026-11-01. No live provider inference was used for the new tests.

## Upgrade Phase 3 — project intake and guided discovery

### Outcome

Every fresh project identifies whether it is new work, a validated local repository, a public remote repository to import into a managed workspace, or saved work before Oracle begins. Oracle then performs focused multi-turn discovery, persists field-level answers and decisions, and produces a structured proposal only when essential information is known or the user explicitly accepts stated assumptions.

**Phase commit:** `feat(oracle): add project intake and guided discovery`.

### Work units

| Unit | Outcome | Evidence |
|---|---|---|
| U3-1 source contract and migration | Schema v6 adds explicit source status, complete Oracle intake, answer/assumption provenance, structured proposal, and supersedable memory; v1–v5 migrate explicitly | `src/shared/workflow.ts`, `src/server/workflow/model.ts`, `tests/migration.test.ts` |
| U3-2 source onboarding | Four source choices exposed before OpenCode onboarding; Oracle is server-blocked until the source is confirmed | `src/web/workshop/WorkshopPage.tsx`, `src/server/app.ts`, `tests/oracle-discovery.test.ts` |
| U3-3 repository safety | Local paths use canonical workspace validation; remote URLs reject credentials/private hosts and import only into a managed directory after explicit confirmation | `src/server/project-sources.ts`, `src/server/security/workspace.ts`, `tests/oracle-discovery.test.ts` |
| U3-4 guided Oracle | Full Prompt 0 stays active; richer reply contract supports question/proposal modes, up to three explained questions, consolidated intake, assumptions, constraints, risks, and next action | `src/server/experience/service.ts`, `src/server/experience/parse.ts`, `tests/oracle-discovery.test.ts` |
| U3-5 proposal gate and memory | Server validates essential intake and explicit assumption consent; answers, corrections, facts, decisions, assumptions, constraints, and risks survive reloads | `src/server/experience/guide-runs.ts`, `src/server/workflow/transitions.ts`, `tests/oracle-discovery.test.ts` |
| U3-6 interface | Source cards, remote confirmation, question rationale/choices, proposal provenance, active memory, correction, and proceed-with-assumptions controls | `src/web/workshop/WorkshopPage.tsx`, `src/web/styles.css`, `src/web/api.ts` |
| U3-7 documentation | README, architecture, decisions, setup/integration/recovery, implementation plan, evidence, release notes, changelog | canonical documentation set |

### Acceptance status

- [x] Every new project is asked for its source and Oracle cannot run before confirmation.
- [x] Oracle asks relevant questions rather than immediately producing a shallow proposal.
- [x] Answers survive reloads and appear in structured project memory.
- [x] Users can correct an answer or assumption, preserving superseded history.
- [x] Proposals distinguish facts, user decisions, and assumptions.
- [x] Local/remote source security, v1–v5 migration, typecheck, 161 tests, build, budget, 18-test visual suite, high-severity audit, and final diff/security review pass.

Phase 3 acceptance passed on 2026-11-01. No live provider inference or private repository credential was used.

## Upgrade Phase 4 — reviewable generated revisions

### Outcome

Architect output is a reviewable candidate rather than an immediate overwrite. Every section has a content contract, every candidate is validated structurally, the user can inspect the complete revision and a responsive diff, and only an explicit accept changes the current draft. Approval remains a separate exact-version action, and accepted upstream changes mark only transitive approvals stale.

**Phase commit:** `feat(architect): add reviewable generated revisions`.

### Work units

| Unit | Outcome | Evidence |
|---|---|---|
| U4-1 content contracts | Eight section contracts with required topics, detail guidance, dependencies, risk/decision requirements, acceptance criteria, and required headings; validation is structural and topic-based, never word-count-only | `src/shared/section-contracts.ts`, `tests/revisions.test.ts` |
| U4-2 candidate model and migration | Schema v7 adds candidate base version/hash, summary, requested change, decision time, and explicit statuses; v1–v6 migrate deterministically | `src/shared/workflow.ts`, `src/server/workflow/model.ts`, `tests/migration.test.ts` |
| U4-3 revision workflow | Change requests queue Architect candidates; accept, reject, supersede, base-version conflict, and contract revalidation are server transitions; no user-facing route calls raw replacement | `src/server/workflow/transitions.ts`, `src/server/experience/guide-runs.ts`, `src/server/app.ts`, `tests/experience.test.ts`, `tests/http-workflow.test.ts` |
| U4-4 stale approvals | Accepting a candidate applies the draft, marks its own approval and every transitive dependent approval stale, and leaves unrelated approvals valid | `src/server/workflow/transitions.ts`, `tests/revisions.test.ts` |
| U4-5 safe Markdown | Shared parser and React renderer for headings, paragraphs, lists, emphasis, links, tables, and code; raw HTML stays text and unsafe links become labels | `src/shared/markdown.ts`, `src/web/components/Markdown.tsx`, `tests/markdown.test.ts` |
| U4-6 diff review | Shared LCS line diff feeds unified and side-by-side views; wide screens default to side-by-side and narrow screens stack with labels | `src/shared/diff.ts`, `src/web/components/RevisionDiff.tsx`, `src/web/components/RevisionReview.tsx`, `tests/revisions.test.ts` |
| U4-7 interface and reading | Section selection, pending badges, full revision preview, diff toggle, accept/reject/request-another controls, contract details, revision/approval history, improved reading width and typography | `src/web/workshop/WorkshopPage.tsx`, `src/web/components/SectionCard.tsx`, `src/web/styles.css` |
| U4-8 documentation | README, architecture, decisions, UX/budget, operations, evidence, release notes, changelog, implementation plan | canonical documentation set |

### Acceptance status

- [x] “Request changes” never immediately overwrites an approved or draft section; it queues a candidate.
- [x] The user can inspect the complete revised Markdown and a unified or side-by-side diff before accepting.
- [x] Every generated candidate satisfies its section contract; padded word count alone is rejected.
- [x] Markdown is readable and safe; raw HTML/script and unsafe link protocols do not execute.
- [x] Accepting a revision is separate from approval and marks affected downstream approvals stale.
- [x] Section versions, candidate decisions, and approvals remain auditable.
- [x] v1–v6 projects migrate explicitly to schema v7.
- [x] Final typecheck, 179 tests, build, budget, and diff/security review pass.

Phase 4 acceptance passed on 2026-11-01. No live provider inference was used.

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
