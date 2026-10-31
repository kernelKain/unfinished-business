# Evidence index and requirements matrix

**Status:** Upgrade Phase 0 complete and verified.
**Owner:** Engineering.
**Last verified:** 2026-11-01.
**Baseline revision:** `7d45e439bddd28bd9d9dcffa3541353c625db40a` (`chore: verify release candidate and migrate documentation`). Baseline typecheck, 111 tests, and production build passed before Phase 0 edits.
**Environment:** Linux, Node `22.22.1`, npm `9.2.0`, pinned OpenCode `2.0.32`, system Chromium. No provider credentials were used for Phase 9 inference.

Labels: **VERIFIED** = inspected/tested in this environment; **FAILED** = observed failure; **UNAVAILABLE** = prerequisite absent; **DEFERRED** = explicitly out of this release; **BLOCKED** = required prerequisite missing.

## Requirements-to-evidence matrix

| Area | Requirement | Status | Evidence | Limitation |
|---|---|---|---|---|
| Maker reliability | Queue a bounded Maker run and return without holding the request | VERIFIED | `tests/runs.test.ts`, `tests/experience-hardening.test.ts`; `POST /api/runs` returns `202` | Deterministic guides; no live model call in Phase 9 |
| Maker reliability | Inspect active run, cancel, and prevent duplicate native work | VERIFIED | `tests/runs.test.ts`, `tests/experience-hardening.test.ts` | In-process runner is single-process |
| Maker reliability | Timeout/disconnect/pending permission become `ABANDONED`/`WAITING_PERMISSION`; never auto-retry | VERIFIED | `tests/experience-hardening.test.ts` | Provider behavior beyond the deadline is unknown by definition |
| Maker reliability | Restart marks in-flight work `ABANDONED` | VERIFIED | `tests/store-hardening.test.ts` | — |
| Upgrade fixtures | Privacy/training-policy rejection, authentication, rate limit, generic failure, slow response, late success, late Maker diff, pending permission, and reconciliation are reusable | VERIFIED | `tests/fixtures/provider-scenarios.ts`, `tests/phase-zero-fixtures.test.ts` | Synthetic fixtures; no live provider output |
| Maker reliability | Reconcile native state without a second run | VERIFIED | `tests/experience-hardening.test.ts` | Reconciliation reads native state; it cannot reconstruct unrecorded effects |
| OpenCode onboarding | Authenticate to OpenCode or fail with a precise repair | VERIFIED | `tests/connection.test.ts`, `tests/onboarding.test.ts`; live probe with ephemeral password; local app connection check reached `connected` | No provider account in the live probe |
| OpenCode onboarding | Discover providers/models/agents/variants/permissions without leaking secrets | VERIFIED | `tests/connection.test.ts`, `tests/onboarding.test.ts`; live app `/api/connection` discovered 9 models and no password-shaped leak | Empty live config reported 0 providers/agents/commands |
| OpenCode onboarding | Unavailable model/provider is visible and blocks a run | VERIFIED | `tests/onboarding.test.ts`, `tests/runs.test.ts` | — |
| OpenCode controls | Project-owned session listing/resume/fork/compact/revert/permissions/usage | VERIFIED | `tests/sessions.test.ts` | Arbitrary session enumeration is deliberately unavailable |
| OpenCode controls | Paid/unpriced model cannot be selected or used | VERIFIED | `tests/connection.test.ts` policy + `validateSelection`; service model context | No live paid call attempted |
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
| Migration | v1 and both supported v2 shapes migrate deterministically and idempotently to v3 without losing workflow records or selected model | VERIFIED | `tests/migration.test.ts`, `tests/store-hardening.test.ts` | Future schema versions are refused/preserved |
| Serialization | Schema v3 JSON round-trip preserves source, intake, memory, candidates, preferences, operations, approvals, and evidence | VERIFIED | `tests/migration.test.ts` | Preferences are stored foundations, not newly enforced behavior |
| Accessibility | Keyboard/focus/dialog/tabs/zoom/overflow/reduced motion/contrast | VERIFIED | `tests/visual/landing.spec.ts`, `tests/visual/demo.spec.ts` (18 tests) | Automated checks do not replace a screen-reader audit |
| Performance | Bundle/asset budgets | VERIFIED | `npm run budget`: initial JS 193.8 KiB gzip, all JS 264.1 KiB, CSS 14.2 KiB, hero 570.9 KiB, largest 86.7 KiB | Vite reports a >500 KiB minified initial chunk warning; gzip budget passes |
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
| `npm test` | PASS — 118 tests, 0 failures |
| `npm run build` | PASS — `dist/web` produced; one large-chunk warning |
| `npm run budget` | PASS — all five budgets; all JS 264.1 KiB gzip |
| `npm run test:visual` | PASS — 18 tests |
| `npm audit --omit=dev --audit-level=high` | PASS (exit 0); 6 moderate advisories reported |
| `npm audit` | FAIL (exit 1) — same 6 moderate advisories; no high/critical |
| `node scripts/preflight.mjs` | PASS as `PREFLIGHT_ONLY`; not an integration proof |
| Local smoke | PASS — health, mode descriptor, token issue, project read (workspace omitted), `/workshop` HTML |
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

- `tests/` — 118 unit/integration/component tests.
- `tests/visual/` — 18 Playwright visual/accessibility tests with committed snapshots.
- `tests/migration.test.ts` — deterministic/idempotent v1/v2 → v3 migration and serialization coverage.
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
