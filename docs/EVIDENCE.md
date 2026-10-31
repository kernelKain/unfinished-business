# Evidence index and requirements matrix

**Status:** Upgrade Phase 2 complete and verified.
**Owner:** Engineering.
**Last verified:** 2026-11-01.
**Baseline revision:** `d14b7bc` (`feat(models): support all accessible OpenCode models`). Phase 1's 139 tests and build passed before Phase 2 edits; Phase 2 ends at 150 tests.
**Environment:** Linux, Node `22.22.1`, npm `9.2.0`, pinned OpenCode `2.0.32`, system Chromium. No provider credentials were used for inference in any phase.

Labels: **VERIFIED** = inspected/tested in this environment; **FAILED** = observed failure; **UNAVAILABLE** = prerequisite absent; **DEFERRED** = explicitly out of this release; **BLOCKED** = required prerequisite missing.

## Requirements-to-evidence matrix

| Area | Requirement | Status | Evidence | Limitation |
|---|---|---|---|---|
| Maker reliability | Queue a bounded Maker run and return without holding the request | VERIFIED | `tests/runs.test.ts`, `tests/experience-hardening.test.ts`; `POST /api/runs` returns `202` | Deterministic guides; no live model call in this phase |
| Maker reliability | Inspect active run, cancel, and prevent duplicate native work | VERIFIED | `tests/runs.test.ts`, `tests/experience-hardening.test.ts` | In-process runner is single-process |
| Maker reliability | Timeout/disconnect/pending permission become `ABANDONED`/`WAITING_PERMISSION`; never auto-retry | VERIFIED | `tests/experience-hardening.test.ts` | Provider behavior beyond the deadline is unknown by definition |
| Maker reliability | Restart marks in-flight work `ABANDONED` | VERIFIED | `tests/store-hardening.test.ts` | — |
| Run observability | All four spirit runs are persisted async operations with a `202` queue response and persisted progress phases | VERIFIED | `tests/observable-runs.test.ts`, `tests/experience.test.ts`, `tests/http-hardening.test.ts` | `question` remains synchronous by design (changes no saved state) |
| Run observability | Live phases (`CONNECTING` → `SESSION_CREATED` → `WAITING_FOR_MODEL` → `RECEIVING_OUTPUT` → `VALIDATING_RESULT` → `WAITING_PERMISSION` → `APPLYING_RESULT` → `RUNNING_CHECKS`) observed before completion | VERIFIED | `tests/observable-runs.test.ts` fast-progress test; coordinator phase writes | Progress uses safe polling of bounded OpenCode endpoints; SSE events not consumed |
| Run observability | No private chain-of-thought or unvalidated raw JSON displayed or saved; partial output never displayed | VERIFIED | Phase writes are fixed safe summaries; replies/doc content pass schema/prose validation before storage (`tests/observable-runs.test.ts`, `tests/experience.test.ts`) | — |
| Run recovery | Late Oracle/Architect/Witness response reconciled from the native session and applied exactly once | VERIFIED | `tests/observable-runs.test.ts` (late Oracle, section 06 timeout recovery) | Retrieval reads the actual latest assistant message; unparseable late replies become FAILED |
| Run recovery | Late Maker diff reconciled with a validated check result and duplicate-protection | VERIFIED | `tests/experience-hardening.test.ts`, `tests/observable-runs.test.ts` (reconcile twice, evidence unchanged, one native run) | Diff retrieval requires `sessionDiff`; an unreadable diff stays `COMPLETED_UNAPPLIED` |
| Run recovery | Idle session without a confirmed outcome is never success | VERIFIED | `tests/observable-runs.test.ts` unknown-outcome test; `inspect` maps idle-without-outcome to `unknown` | — |
| Run recovery | Confirm-failure retry creates a lineage-tracked operation and cannot duplicate the native run | VERIFIED | `tests/observable-runs.test.ts` retry test (`retryOf`, unresolved/active/final-state gates) | Manual resume of a lost native session is limited to reconciliation |
| Run recovery | Mark abandoned is operator-only and refuses already-finished or active runs | VERIFIED | `tests/observable-runs.test.ts` mark-abandoned tests; `POST /api/runs/:id/abandon` | ABANDONED rows can still be reconciled later when they carry a session |
| Run controls | Elapsed time and Continue waiting / Reconcile now / Open in OpenCode / Cancel / Retry / Mark abandoned controls visible in the Run Inspector | VERIFIED | `src/web/components/RunInspector.tsx` recovery panel; `tests/web.test.ts` renders; demo rendering kept snapshot-identical | Visual suite passes unchanged (18 tests) |
| Migration | v1, both supported v2 shapes, v3, and v4 migrate deterministically and idempotently to v5 without losing workflow records, selected model, provider errors, or recovery markers | VERIFIED | `tests/migration.test.ts`, `tests/store-hardening.test.ts` | Future schema versions are refused/preserved |
| Upgrade fixtures | Privacy/training-policy rejection, authentication, rate limit, generic failure, slow response, late success, late Maker diff, pending permission, and reconciliation are reusable | VERIFIED | `tests/fixtures/provider-scenarios.ts`, `tests/phase-zero-fixtures.test.ts` | Synthetic fixtures; no live provider output |
| Maker reliability | Reconcile native state without a second run | VERIFIED | `tests/experience-hardening.test.ts` | Reconciliation reads native state; it cannot reconstruct unrecorded effects |
| OpenCode onboarding | Authenticate to OpenCode or fail with a precise repair | VERIFIED | `tests/connection.test.ts`, `tests/onboarding.test.ts`; live probe with ephemeral password; local app connection check reached `connected` | No provider account in the live probe |
| OpenCode onboarding | Discover providers/models/agents/variants/permissions without leaking secrets | VERIFIED | `tests/connection.test.ts`, `tests/onboarding.test.ts`; live app `/api/connection` discovered 9 models and no password-shaped leak | Empty live config reported 0 providers/agents/commands |
| OpenCode onboarding | Unavailable model/provider is visible and blocks a run | VERIFIED | `tests/onboarding.test.ts`, `tests/runs.test.ts` | — |
| OpenCode controls | Project-owned session listing/resume/fork/compact/revert/permissions/usage | VERIFIED | `tests/sessions.test.ts` | Arbitrary session enumeration is deliberately unavailable |
| Model access | New projects allow every model OpenCode reports as available; free/local-only remains intentional | VERIFIED | `tests/model-access.test.ts`, `tests/connection.test.ts`; `/api/model-preferences`; access-mode diagnostics | No live paid call attempted |
| Model access | Paid/unknown-price remote models require explicit first-use confirmation before selection and request | VERIFIED | `tests/model-access.test.ts`, `tests/observable-runs.test.ts`; persisted `paidOrUnknownAcceptedAt`; runtime `MODEL_COST_CONFIRMATION_REQUIRED` | Cost guard is only as good as OpenCode's reported pricing/cost |
| Budgets | Optional project/deployment spending limit with unlimited state and stricter-limit precedence | VERIFIED | `tests/budgets.test.ts`, `tests/model-access.test.ts`, `tests/security.test.ts`; guide budget enforcement | Unknown-price providers may report cost only after a request |
| Provider errors | Eight safe categories, saved-work status, repair/retry action, redacted technical reference | VERIFIED | `tests/provider-errors.test.ts`, `tests/experience.test.ts`; provider error card and Run Inspector line | Category inference is heuristic; no live provider error reproduced |
| Provider privacy | Training/data-policy rejection gets a specific explanation and review-privacy repair | VERIFIED | `tests/provider-errors.test.ts` synthetic privacy fixture; provider error integration test | App cannot attest every provider's contract |
| Navigation | Four stages, current section, and exact-version approval gate | VERIFIED | `tests/workflow.test.ts`, `tests/experience.test.ts`, `tests/http-workflow.test.ts`; visual suite | — |
| Navigation | Approval does not grant native tool permission; denial remains denial | VERIFIED | `tests/native-permissions.test.ts`; guide permission arrays | App is a workflow authority, not an OS sandbox |
| Landing/theme | Landing, workshop, and demo routes are distinct and truthful | VERIFIED | `tests/web.test.ts`, `tests/visual/landing.spec.ts`; snapshots | — |
| Landing/theme | No fabricated counts, awards, testimonials, or live-demo claims | VERIFIED | `tests/web.test.ts` copy assertions; `docs/PRODUCT_BRIEF.md` prohibited claims | — |
| Recommendations | Recommendation fixtures match current capabilities and carry source/freshness | VERIFIED | `src/web/content/landing.ts`; `tests/web.test.ts` | Static guidance, not a live recommender |
| Modes | `local`, `private-hosted`, `hosted-demo` startup and auth policy | VERIFIED | `tests/security.test.ts`, `tests/http-hardening.test.ts`, local/demo smoke | Private deployment not live |
| Modes | Public demo is read-only, token-free, engine-free, persistence-free | VERIFIED | `tests/demo.test.ts`; local smoke; server enforcement | No public URL |
| Demo | Deterministic playback, reset isolation, 90-second path | VERIFIED | `tests/demo.test.ts`, `tests/visual/demo.spec.ts` | Fixture is not live inference |
| Demo | No network/inference/repository mutation from `/demo` | VERIFIED | Playwright request capture; source scan test; hosted-demo smoke | — |
| Security | Host/Origin/CSRF/content-type/size/rate/concurrency policy | VERIFIED | `tests/http-hardening.test.ts`, `tests/security.test.ts` | Rate limiter is in-process |
| Security | Workspace traversal/symlink/broad-root and static containment | VERIFIED | `tests/security.test.ts` | No OS sandbox |
| Security | SSRF/DNS/redirect/timeout/response-size policy | VERIFIED | `tests/security.test.ts` | Remote connector remains deferred |
| Security | Redaction in state/exports/errors/logs/Sentry hooks | VERIFIED | `tests/http-hardening.test.ts`, `tests/security.test.ts` | Sentry live delivery not verified |
| Security | Atomic state, lock, backups, quarantine, disk failure | VERIFIED | `tests/store-hardening.test.ts`, `tests/recovery.test.ts` | Single-writer, single-project |
| Recovery | Previous snapshot offered; corrupt bytes preserved; no silent reset | VERIFIED | `tests/recovery.test.ts`, `tests/store-hardening.test.ts` | Both-corrupt state requires operator restore |
| Serialization | Schema v5 JSON round-trip preserves source, intake, memory, candidates, access/budget policy, provider errors, operations, approvals, evidence, and recovery metadata | VERIFIED | `tests/migration.test.ts`, `tests/provider-errors.test.ts`, `tests/demo.test.ts` (projectSchema round-trip of the updated fixture) | Model cost/privacy facts remain provider-owned |
| Accessibility | Keyboard/focus/dialog/tabs/zoom/overflow/reduced motion/contrast | VERIFIED | `tests/visual/landing.spec.ts`, `tests/visual/demo.spec.ts` (18 tests) | Automated checks do not replace a screen-reader audit |
| Performance | Bundle/asset budgets | VERIFIED | `npm run budget`: initial JS 194.0 KiB gzip, all JS 266.4 KiB, CSS 14.5 KiB, hero 570.9 KiB, largest 86.7 KiB | Vite reports a >500 KiB minified initial chunk warning; gzip budget passes |
| Documentation | Canonical routes/schema/env/modes/UI terms and history pointers | VERIFIED | This documentation set; link scan | Ongoing maintenance |
| Documentation | Runtime prompts separated from implementation prompts | VERIFIED | `src/server/prompts/loader.ts`, `tests/prompts.test.ts`, `docs/prompts/README.md` | Loader reads a fixed map |
| Dependency audit | No high/critical production advisory | VERIFIED at high threshold | `npm audit --omit=dev --audit-level=high` exit 0 | 6 moderate `glob`/`minimatch` advisories remain in the Sentry bundler path; `npm audit` exits 1 |
| Sentry | Release/source-map/trace association | NOT RUN (optional telemetry) | Config reviewed statically | No authorized `SENTRY_AUTH_TOKEN` or deployment; no release claim |
| Render/private host | Blueprint/env/security review | REVIEWED | `render.yaml`, `render.demo.yaml`, `docs/HOSTED_DEPLOYMENT.md`; static YAML check asserted private-hosted disk/secrets and demo no-disk/no-OpenCode | No live deployment authorized |
| Entire | Development capture/checkpoint provenance | VERIFIED as prior development record | Repository hooks/checkpoints from earlier phases | Not a runtime feature; no public transcript |
| Backboard | R-CLI meaningful contribution | BLOCKED (not a product-release blocker) | No key/tooling in this environment | No category claim; partner qualification remains pending |
| Submission | Video/article/submission | NOT STARTED | — | Requires separate authorization |

## Commands and observed results

| Command | Result |
|---|---|
| `npm ci` | PASS — exact lockfile install |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 150 tests, 0 failures |
| `npm run build` | PASS — `dist/web` produced; one large-chunk warning |
| `npm run budget` | PASS — all five budgets; all JS 267.8 KiB gzip |
| `npm run test:visual` | PASS — 18 tests (Run Inspector additions render demo snapshots byte-identically) |
| `npm audit --omit=dev --audit-level=high` | PASS (exit 0); 6 moderate advisories reported |
| `npm audit` | FAIL (exit 1) — same 6 moderate advisories; no high/critical |
| `node scripts/preflight.mjs` | PASS as `PREFLIGHT_ONLY`; not an integration proof |
| Local smoke | PASS — health, mode descriptor, token issue, project read with schema v5/`ALL_ACCESSIBLE`/unlimited, `/api/runtime` unlimited, `/workshop` and `/demo` HTML |
| Hosted-demo smoke | PASS — fixture project, `/api/session` 403, mutation `DEMO_READ_ONLY`, `/api/engine` 503/no engine, `/demo` HTML |
| OpenCode compatibility probe | PASS — server 2.0.32, compatible major, 9 models, disposable session create/read/remove; no prompt/model call |
| Local app + live OpenCode | PASS — `/api/connection` `connected`, 9 models; `/api/engine` 200 with no model selected; no password in response |
| `node scripts/opencode-live-diagnostic.ts` without opt-in | PASS — prints `SKIP` |
| Render YAML static validation | PASS — private-hosted has disk/access/session/OpenCode secrets; hosted-demo has no disk, access password, or OpenCode password |

## Evidence links

### Architecture and contracts

- [Architecture](ARCHITECTURE.md) — system shape, trust boundaries, request pipeline, modes, persistence.
- [OpenCode integration](OPENCODE_INTEGRATION.md) — tested version/API surface, discovery, credentials, limits.
- [Operations and recovery](OPERATIONS_AND_RECOVERY.md) — data layout, backups, retention, failure matrix.
- [Decisions](DECISIONS.md) — product, interface, demo, hardening, and release decisions.

### Tests and reports

- `tests/` — 150 unit/integration/component tests.
- `tests/visual/` — 18 Playwright visual/accessibility tests with committed snapshots.
- `tests/observable-runs.test.ts` — Phase 2 matrix: late Oracle reply, section 06 Architect timeout recovery, late Maker diff with exact-once application, duplicate reconciliation, permission waiting, cancellation, restart reconnect, retry lineage, mark-abandoned, prompt-progress visibility.
- `tests/migration.test.ts` — deterministic/idempotent v1/v2/v3/v4 → v5 migration and serialization coverage.
- `tests/model-access.test.ts`, `tests/budgets.test.ts`, `tests/provider-errors.test.ts` — model policy, spending-limit, and provider failure coverage.
- `tests/phase-zero-fixtures.test.ts` — reusable provider, timing, late-result, permission, and reconciliation fixture coverage.
- `tests/experience-hardening.test.ts` — Maker timeout/permission/budget/cancel/reconcile matrix.
- `tests/http-hardening.test.ts`, `tests/security.test.ts`, `tests/store-hardening.test.ts` — security/recovery matrix.
- `tests/demo.test.ts` — fixture, drift, playback, reset, no-network, hosted-demo isolation.

### Screenshots and demo assets

- `tests/visual/snapshots/landing-wide.png`, `landing-narrow.png` — landing/theme.
- `tests/visual/snapshots/workshop-wide.png`, `workshop-narrow.png`, `onboarding-wide.png` — workshop and first-run connection.
- `tests/visual/snapshots/demo-guided-wide.png`, `demo-guided-narrow.png`, `demo-presentation-wide.png` — guided demo.
- `tests/visual/snapshots/run-inspector.png`, `recovery-unknown.png` — evidence and abandoned-run recovery (snapshot filename retained for history).
- `tests/visual/snapshots/spirit-*.png` — four-spirit states.
- `assets/source/hero-ghostlight-workshop.webp` — hero master (not shipped); public variants under `public/assets/hero/`.

### Demo script and submission guidance

- [Demo and submission](DEMO_AND_SUBMISSION.md) — scenario, exact claims, 90-second beat map, disclosure, snapshot list.
- No video file exists. Do not claim a recorded demonstration until one is produced and reviewed.

### Partner proof

- Entire: prior development checkpoints exist in the repository history; no runtime integration or public transcript is claimed.
- Sentry: metadata-only instrumentation and redaction tests exist; live release/source-map/trace evidence is **NOT RUN** without credentials.
- Backboard: **BLOCKED**; no installation, session, contribution, or category claim.
- OpenCode: central runtime dependency with deterministic integration tests and a no-inference live compatibility probe.

## Release classification

The product-release criteria pass with the limitations below. Partner-category qualification (Backboard, Sentry Agent Tracing, Entire evidence) remains unverified or development-only; **no partner category is claimed**. Those pending partner claims do not block the product release, but they do block any partner-category submission claim until separately evidenced and authorized.

## Failed, unavailable, or deferred items

| Item | Classification | Reason |
|---|---|---|
| Live provider inference in Phase 9 | NOT RUN | No authorized provider/model call in this gate |
| Sentry live release/source-map/trace | UNAVAILABLE | Optional telemetry; no authorized credentials/deployment |
| Backboard R-CLI proof | BLOCKED | No API/tooling access; this blocks a partner-category claim, not the product release |
| Public hosted URL / deployment | NOT AUTHORIZED | External action requires separate authority |
| Domain/credit/account changes | NOT AUTHORIZED | External action requires separate authority |
| Recorded video/article/submission | NOT STARTED | Final-stage work, separate authorization |
| Shared multi-user isolation | DEFERRED | Out of release scope |
| Remote browser-to-local pairing | DEFERRED | Out of release scope |
| Arbitrary repository connector | DEFERRED | Maker is demo-workspace bounded |
| Moderate dependency advisories | KNOWN LIMITATION | Fix requires a breaking Sentry downgrade; production high-severity audit passes |

## Evidence handling rules

- Do not publish secrets, provider keys, server passwords, session tokens, private transcripts, or unrestricted local paths.
- Use repository-relative paths in reports; the local absolute checkout path is intentionally omitted.
- A model statement is not an exit code or observed effect.
- A fixture PASS is not a live PASS.
- A deployment, publication, or submission needs separate confirmation; no local file proves an external action.
