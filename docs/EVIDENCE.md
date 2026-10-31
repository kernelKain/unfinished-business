# Evidence index and requirements matrix

**Status:** Platform Phase 7 complete and verified.
**Owner:** Engineering.
**Last verified:** 2026-11-01.
**Baseline revision:** `ddf632a` (`feat(demo): unify the project revival story`). Upgrade Phase 6's 186 tests passed before Platform Phase 7 edits.
**Environment:** Linux x64, Node `22.22.1`, npm `9.2.0`, pinned OpenCode `2.0.32`, system Chromium. macOS arm64 and x64 are exercised by the CI matrix. No provider credentials were used for inference in any phase.

Labels: **VERIFIED** = inspected/tested in this environment; **CI-GATED** = automated job defined, result required before the platform is claimed; **FAILED** = observed failure; **UNAVAILABLE** = prerequisite absent; **DEFERRED** = explicitly out of this release; **BLOCKED** = required prerequisite missing.

## Requirements-to-evidence matrix

| Area | Requirement | Status | Evidence | Limitation |
|---|---|---|---|---|
| Platform | Official cross-platform OpenCode CLI replaces the Linux-only package | VERIFIED | `package.json`, `package-lock.json`, `tests/platform.test.ts` | npm installs multiple Linux x64 variants selected by the official postinstall |
| Platform | Compatibility prefers a valid global `opencode` then the pinned local binary | VERIFIED | `src/server/opencode/executable.ts`; resolver tests cover global, incompatible-global fallback, local-only, and missing cases | A global binary is accepted when it reports major 2 even if the patch is untested; a warning is shown |
| Platform | Linux x64 remains operational | VERIFIED | Full local matrix; `npm run diagnose:platform`; `npm run smoke:opencode` | No live model call |
| Platform | macOS Apple Silicon and macOS Intel resolve and run OpenCode | VERIFIED | CI run `41252770576`: `macos-15` (`darwin-arm64`) and `macos-15-intel` (`darwin-x64`) both passed install, resolution, typecheck, tests, build, workspace safety, and server smoke | Automated only; no separate manual macOS session is recorded |
| Platform | Unsupported architectures fail before probing | VERIFIED | `describePlatform` tests for linux-arm64, win32-x64, darwin-ia32, freebsd-x64 | Windows and Linux ARM64 are not claimed |
| Platform | Missing executable, incompatible version, permission, and server-start failures have distinct diagnostics | VERIFIED | CLI diagnostic cases in `tests/platform.test.ts`; `scripts/opencode-platform-diagnostic.ts`; `scripts/opencode-smoke.ts` | Diagnostics intentionally omit executable paths |
| Platform | Render-specific behavior is isolated from local development | VERIFIED | `src/server/render-start.ts` uses the shared resolver and environment-derived XDG paths; local start never imports it | Render deployment itself remains a separate authorized action |
| Platform | Workspace security handles macOS roots and resolved temporary paths | VERIFIED | `tests/security.test.ts` macOS broad-root and realpath cases | Symlink policy remains realpath-based |
| Platform | Setup UI and docs contain no Linux-only package path and name npm/Homebrew installs | VERIFIED | `tests/platform.test.ts`, `tests/web.test.ts`, `src/web/setup.ts`, README, `docs/LOCAL_SETUP.md` | Homebrew installs the current tap version, not necessarily the 2.0.32 patch |
| Project source | Every fresh project chooses new, local, remote, or saved work before Oracle | VERIFIED | `tests/oracle-discovery.test.ts`; source-first workshop rendering; `PROJECT_SOURCE_REQUIRED` server gate | Demo fixture carries an explicit `DEMO` source |
| Project source | Local repositories pass existing workspace-security rules and private paths stay server-only | VERIFIED | `tests/oracle-discovery.test.ts`, `tests/security.test.ts`; public project serialization assertion | Selection validates but does not assess repository contents |
| Project source | Remote URL is credential-free/public HTTPS, staged without import, then imported into a managed workspace only after confirmation | VERIFIED | `tests/oracle-discovery.test.ts`; injected importer asserts no call before confirm and managed target after confirm | Public unauthenticated Git only; no SSH/private/submodule credentials |
| Oracle discovery | Incomplete intake produces at most three high-value questions with rationale and optional choices | VERIFIED | `tests/oracle-discovery.test.ts`; `oracleReplySchema` max-three assertion | Relevance of live model wording remains provider-dependent |
| Oracle discovery | Full discovery instructions remain active and proposal mode is server-gated on sufficient information or explicit assumptions | VERIFIED | prompt-capture and assumption-gate cases in `tests/oracle-discovery.test.ts` | No live provider inference in this phase |
| Oracle memory | Answers survive reload, corrections supersede history, and proposals distinguish facts, user decisions, and assumptions | VERIFIED | persistence/correction/proposal cases in `tests/oracle-discovery.test.ts`; schema v7 round-trip/migration tests | Transcript retention remains bounded separately |
| Architect revisions | Every section has a content contract with required topics, detail guidance, dependencies, risks, decisions, and acceptance criteria; padded word count alone fails | VERIFIED | `src/shared/section-contracts.ts`; `tests/revisions.test.ts` (all eight compliant drafts, padded-word rejection) | Contracts judge structure and coverage, not prose quality |
| Architect revisions | A change request generates a candidate and never overwrites the current draft; accept/reject/supersede are explicit | VERIFIED | `tests/revisions.test.ts`, `tests/experience.test.ts` route case, `tests/http-workflow.test.ts` accept case | No live provider inference |
| Architect revisions | Acceptance is separate from approval and marks only transitive downstream approvals stale | VERIFIED | `tests/revisions.test.ts` stale-approval matrix; `tests/http-workflow.test.ts` approval-after-accept case | Unrelated approvals stay valid by design |
| Architect revisions | Complete revision and unified/side-by-side diff are reviewable before acceptance | VERIFIED | `src/web/components/RevisionReview.tsx`, `RevisionDiff.tsx`; `tests/revisions.test.ts` diff assertions | Visual snapshot suite does not yet capture a live candidate state |
| Markdown safety | Headings, paragraphs, lists, emphasis, links, tables, and code render; raw HTML/script and unsafe protocols cannot execute | VERIFIED | `src/shared/markdown.ts`, `src/web/components/Markdown.tsx`; `tests/markdown.test.ts` server-render assertions | Parser intentionally supports a small Markdown subset, not full CommonMark |
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
| Run controls | Elapsed time and Continue waiting / Reconcile now / Open in OpenCode / Cancel / Retry / Mark abandoned controls visible in Activity & results | VERIFIED | `src/web/components/RunInspector.tsx` recovery panel; `tests/web.test.ts` renders; workshop visual suite | Activity & results is absent until an operation or check exists |
| Focused workshop | One primary task, compact model/connection header, collapsible project outline, contextual activity drawer, no permanent technical rail | VERIFIED | `src/web/workshop/WorkshopPage.tsx`, `src/web/styles.css`; `tests/visual/landing.spec.ts` wide/narrow captures | Automated visual checks do not replace a full screen-reader audit |
| Activity & results | Progress, Changes, and Checks are separate; native IDs, capability mappings, raw evidence, and provider payloads are under Technical details | VERIFIED | `RunInspector.tsx`; `tests/web.test.ts` server-render sections; `run-inspector.png` | The technical section is read-only |
| Project memory | Decisions, user answers, assumptions, constraints, and unresolved questions are visible; add/correct is explicit and corrections supersede prior entries without changing approvals or drafts | VERIFIED | `src/web/components/ProjectMemory.tsx`, `POST /api/memory`, `tests/memory.test.ts` | Raw transcript is not the memory surface; it stays in Advanced diagnostics |
| OpenCode controls | Model & connection, contextual permission request, and Advanced diagnostics are split; sessions/usage load only when advanced diagnostics are opened | VERIFIED | `src/web/opencode-panel.tsx`; `tests/web.test.ts` checks permission alert and closed advanced details | Permission polling is best-effort and may lag one refresh interval |
| Accessibility | Drawers are keyboard operable; stage changes move focus to the main task; busy/permission state is announced; mobile layout has no overflow | VERIFIED | `tests/visual/landing.spec.ts` outline keyboard test, narrow workshop, focus/live-region code; reduced-motion styling | Automated checks do not replace a screen-reader audit |
| Migration | v1, both supported v2 shapes, v3, v4, v5, and v6 migrate deterministically and idempotently to v7 without losing workflow records, selected model, provider errors, recovery markers, legacy Oracle state, or candidate history | VERIFIED | `tests/migration.test.ts`, `tests/store-hardening.test.ts` | Future schema versions are refused/preserved |
| Upgrade fixtures | Privacy/training-policy rejection, authentication, rate limit, generic failure, slow response, late success, late Maker diff, pending permission, and reconciliation are reusable | VERIFIED | `tests/fixtures/provider-scenarios.ts`, `tests/phase-zero-fixtures.test.ts` | Synthetic fixtures; no live provider output |
| Maker reliability | Reconcile native state without a second run | VERIFIED | `tests/experience-hardening.test.ts` | Reconciliation reads native state; it cannot reconstruct unrecorded effects |
| OpenCode onboarding | Authenticate to OpenCode or fail with a precise repair | VERIFIED | `tests/connection.test.ts`, `tests/onboarding.test.ts`; live probe with ephemeral password; local app connection check reached `connected` | No provider account in the live probe |
| OpenCode onboarding | Discover providers/models/agents/variants/permissions without leaking secrets | VERIFIED | `tests/connection.test.ts`, `tests/onboarding.test.ts`; live app `/api/connection` discovered 9 models and no password-shaped leak | Empty live config reported 0 providers/agents/commands |
| OpenCode onboarding | Unavailable model/provider is visible and blocks a run | VERIFIED | `tests/onboarding.test.ts`, `tests/runs.test.ts` | — |
| OpenCode controls | Project-owned session listing/resume/fork/compact/revert/permissions/usage | VERIFIED | `tests/sessions.test.ts` | Arbitrary session enumeration is deliberately unavailable |
| Model access | New projects allow every model OpenCode reports as available; free/local-only remains intentional | VERIFIED | `tests/model-access.test.ts`, `tests/connection.test.ts`; `/api/model-preferences`; access-mode diagnostics | No live paid call attempted |
| Model access | Paid/unknown-price remote models require explicit first-use confirmation before selection and request | VERIFIED | `tests/model-access.test.ts`, `tests/observable-runs.test.ts`; persisted `paidOrUnknownAcceptedAt`; runtime `MODEL_COST_CONFIRMATION_REQUIRED` | Cost guard is only as good as OpenCode's reported pricing/cost |
| Budgets | Optional project/deployment spending limit with unlimited state and stricter-limit precedence | VERIFIED | `tests/budgets.test.ts`, `tests/model-access.test.ts`, `tests/security.test.ts`; guide budget enforcement | Unknown-price providers may report cost only after a request |
| Provider errors | Eight safe categories, saved-work status, repair/retry action, redacted technical reference | VERIFIED | `tests/provider-errors.test.ts`, `tests/experience.test.ts`; provider error card and Activity & results line | Category inference is heuristic; no live provider error reproduced |
| Provider privacy | Training/data-policy rejection gets a specific explanation and review-privacy repair | VERIFIED | `tests/provider-errors.test.ts` synthetic privacy fixture; provider error integration test | App cannot attest every provider's contract |
| Navigation | Four stages, current section, and exact-version approval gate | VERIFIED | `tests/workflow.test.ts`, `tests/experience.test.ts`, `tests/http-workflow.test.ts`; visual suite | — |
| Navigation | Approval does not grant native tool permission; denial remains denial | VERIFIED | `tests/native-permissions.test.ts`; guide permission arrays | App is a workflow authority, not an OS sandbox |
| Landing/theme | Landing, workshop, and guided sample routes are distinct and truthful | VERIFIED | `tests/web.test.ts`, `tests/visual/landing.spec.ts`; refreshed landing wide/narrow snapshots | — |
| Landing/theme | No fabricated counts, awards, testimonials, or live-demo claims | VERIFIED | `tests/web.test.ts` copy assertions; `docs/PRODUCT_BRIEF.md` prohibited claims | — |
| Canonical sample | Landing preview, guided sample, evidence view, and screenshots use one Driftwatch fixture; the sample check is PASS and the live session is NOT_RUN on both pages | VERIFIED | `demoPreviewSteps` and `demoFixture` in `src/shared/demo.ts`; `tests/web.test.ts` canonical-outcome case; Playwright consistency case | Recorded fixture, not live inference |
| Modes | `local`, `private-hosted`, `hosted-demo` startup and auth policy | VERIFIED | `tests/security.test.ts`, `tests/http-hardening.test.ts`, local/demo smoke | Private deployment not live |
| Modes | Public sample is read-only, token-free, engine-free, persistence-free | VERIFIED | `tests/demo.test.ts`; local smoke; server enforcement | No public URL |
| Sample | Guided playback, reset isolation, 90-second path, and one coherent Driftwatch story | VERIFIED | `tests/demo.test.ts`, `tests/visual/demo.spec.ts` | Recorded sample, not live inference |
| Sample | No network/inference/repository mutation from `/demo` | VERIFIED | Playwright request capture; source scan test; hosted-sample smoke | — |
| Security | Host/Origin/CSRF/content-type/size/rate/concurrency policy | VERIFIED | `tests/http-hardening.test.ts`, `tests/security.test.ts` | Rate limiter is in-process |
| Security | Workspace traversal/symlink/broad-root and static containment | VERIFIED | `tests/security.test.ts` | No OS sandbox |
| Security | SSRF/DNS/redirect/timeout/response-size policy | VERIFIED | `tests/security.test.ts`, `tests/oracle-discovery.test.ts` | Remote Git clone is intentionally narrow and is not an OS/network sandbox |
| Security | Redaction in state/exports/errors/logs/Sentry hooks | VERIFIED | `tests/http-hardening.test.ts`, `tests/security.test.ts` | Sentry live delivery not verified |
| Security | Atomic state, lock, backups, quarantine, disk failure | VERIFIED | `tests/store-hardening.test.ts`, `tests/recovery.test.ts` | Single-writer, single-project |
| Recovery | Previous snapshot offered; corrupt bytes preserved; no silent reset | VERIFIED | `tests/recovery.test.ts`, `tests/store-hardening.test.ts` | Both-corrupt state requires operator restore |
| Serialization | Schema v7 JSON round-trip preserves source, field-level intake, answer/assumption provenance, structured proposal, candidate base/summary/decision metadata, access/budget policy, provider errors, operations, approvals, evidence, and recovery metadata | VERIFIED | `tests/migration.test.ts`, `tests/provider-errors.test.ts`, `tests/demo.test.ts` (projectSchema round-trip of the updated fixture) | Model cost/privacy facts remain provider-owned |
| Accessibility | Keyboard/focus/dialog/tabs/drawers/zoom/overflow/reduced motion/contrast | VERIFIED | `tests/visual/landing.spec.ts`, `tests/visual/demo.spec.ts` (20 tests) | Automated checks do not replace a screen-reader audit |
| Performance | Bundle/asset budgets | VERIFIED | `npm run budget`: initial JS 201.5 KiB gzip, all JS 280.1 KiB, CSS 17.0 KiB, hero 581.2 KiB, largest 87.8 KiB | All-JS budget remains 290 KiB; Vite reports a >500 KiB minified initial chunk warning |
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
| `npm test` | PASS — 200 tests, 0 failures |
| `npm run build` | PASS — `dist/web` produced; one large-chunk warning |
| `npm run budget` | PASS — all five budgets; initial JS 201.5 KiB, all JS 280.1 KiB, CSS 17.0 KiB, hero 581.2 KiB |
| `npm run test:visual` | PASS — 20 tests; rewritten landing, guided sample, consistency, Activity & results, and character snapshots updated; no horizontal overflow |
| `npm run test:platform` | PASS — platform gate, resolver, setup/CI contracts, and Linux workspace/macOS-root safety |
| `npm run diagnose:platform` | PASS — `linux-x64`, version `2.0.32`, no diagnostics |
| `npm run smoke:opencode` | PASS — disposable server on loopback; `/api/info` reports `2.0.32`; no prompt/model call |
| CI matrix (`41252770576`) | PASS — `linux-x64`, `darwin-arm64`, `darwin-x64`; install, CLI resolution, typecheck, tests, build, workspace safety, OpenCode smoke |
| `npm audit --omit=dev --audit-level=high` | PASS (exit 0); 6 moderate advisories reported |
| `npm audit` | FAIL (exit 1) — same 6 moderate advisories; no high/critical |
| `node scripts/preflight.mjs` | PASS for required checks: supported platform, OpenCode CLI `2.0.32`, client metadata, DNS, Git read, loopback, and Node; partner/runtime proofs remain NOT_RUN | No inference or Git writes |
| Local smoke | Prior Phase 2 PASS — health, mode descriptor, token issue, project read, `/api/runtime`, `/workshop` and `/demo` HTML | Phase 3 behavior is covered by HTTP integration tests; no separate live smoke was required |
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

- `tests/` — 200 unit/integration/component tests.
- `tests/visual/` — 20 Playwright visual/accessibility tests with committed snapshots.
- `tests/platform.test.ts` — platform gate, global/local CLI resolution, version/permission/start diagnostics, setup/CI static contracts, and the installed-binary resolution check.
- `tests/memory.test.ts` — project-memory add/correct/supersede transitions and the authenticated `/api/memory` route.
- `tests/web.test.ts` — workshop surfaces, Activity & results structure, Project memory content, and collapsed Advanced diagnostics.
- `tests/observable-runs.test.ts` — Phase 2 matrix: late Oracle reply, section 06 Architect timeout recovery, late Maker diff with exact-once application, duplicate reconciliation, permission waiting, cancellation, restart reconnect, retry lineage, mark-abandoned, prompt-progress visibility.
- `tests/oracle-discovery.test.ts` — source onboarding/security, multi-turn intake, prompt retention, memory, assumption gate, proposal provenance, and corrections.
- `tests/revisions.test.ts` — section contracts, candidate creation/supersede, accept/reject, stale approvals, base-version conflict, and unified/side-by-side diffs.
- `tests/markdown.test.ts` — safe Markdown rendering, raw-HTML/script rejection, unsafe-link filtering, and block parsing.
- `tests/migration.test.ts` — deterministic/idempotent v1/v2/v3/v4/v5/v6 → v7 migration and serialization coverage.
- `tests/model-access.test.ts`, `tests/budgets.test.ts`, `tests/provider-errors.test.ts` — model policy, spending-limit, and provider failure coverage.
- `tests/phase-zero-fixtures.test.ts` — reusable provider, timing, late-result, permission, and reconciliation fixture coverage.
- `tests/experience-hardening.test.ts` — Maker timeout/permission/budget/cancel/reconcile matrix.
- `tests/http-hardening.test.ts`, `tests/security.test.ts`, `tests/store-hardening.test.ts` — security/recovery matrix.
- `tests/demo.test.ts` — canonical fixture, drift, playback, reset, no-network, hosted-sample isolation.
- `tests/web.test.ts` — landing hierarchy, one primary CTA, canonical landing/demo outcome, evidence details, and FAQ copy.

### Screenshots and demo assets

- `tests/visual/snapshots/landing-wide.png`, `landing-narrow.png` — rewritten landing hierarchy and bespoke hero.
- `tests/visual/snapshots/workshop-wide.png`, `workshop-narrow.png`, `onboarding-wide.png` — focused workshop layout and first-run connection.
- `tests/visual/snapshots/demo-guided-wide.png`, `demo-guided-narrow.png`, `demo-presentation-wide.png` — Driftwatch guided sample and consistency capture.
- `tests/visual/snapshots/run-inspector.png`, `recovery-unknown.png` — Activity & results and abandoned-run recovery (snapshot filename retained for history).
- `tests/visual/snapshots/spirit-*.png` — four-spirit states.
- `assets/source/hero-workshop-revival.webp` — four-spirit hero master (not shipped); public variants under `public/assets/hero/`.

### Demo script and submission guidance

- [Demo and submission](DEMO_AND_SUBMISSION.md) — scenario, exact claims, 90-second beat map, disclosure, snapshot list.
- No video file exists. Do not claim a recorded demonstration until one is produced and reviewed.

### Partner proof

- Entire: prior development checkpoints exist in the repository history; no runtime integration or public transcript is claimed.
- Sentry: metadata-only instrumentation and redaction tests exist; live release/source-map/trace evidence is **NOT RUN** without credentials.
- Backboard: **BLOCKED**; no installation, session, contribution, or category claim.
- OpenCode: central runtime dependency with deterministic integration tests and a no-inference live compatibility probe.

## Upgrade Phase 6 evidence

| Check | Result | Detail |
|---|---|---|
| One canonical sample | PASS | `demoFixture`, `demoPreviewSteps`, `sampleStory`, the landing evidence view, `/demo`, and snapshots all derive from `src/shared/demo.ts` |
| No contradictory result | PASS | The old landing-only `FAIL` operation/evidence exports were removed; the sample check is `PASS` and the live proof is `NOT_RUN` on both pages |
| Coherent story | PASS | All eight sections, the two revisions, Maker diff, recorded check, Witness findings, and landing preview describe the Driftwatch stale-issue change |
| Landing hierarchy | PASS | Hero → workflow → sample → why OpenCode → setup/privacy → FAQ/final CTA; one primary `Try the example` CTA and secondary `Run locally` |
| Recommendation removal | PASS | No static recommendation table, fixtures, or styles remain |
| Hero asset | PASS | New four-spirit source master plus responsive AVIF/WebP/JPEG variants; total 581.2 KiB, largest 87.8 KiB |
| Fixture consistency test | PASS | `tests/web.test.ts` compares the landing and demo outcome; Playwright repeats the comparison in a real browser |
| Visual regression | PASS | 20 Playwright tests, including landing wide/narrow, 200% zoom, guided sample wide/narrow/presentation, and canonical consistency |
| Migration | NOT REQUIRED | Demo-only change; schema v7 and saved projects are unchanged |

## Platform Phase 7 evidence

| Check | Result | Detail |
|---|---|---|
| Dependency install | PASS — Linux | `npm ci` installs the official `@opencode/cli@2.0.32`; `@opencode/client@2.0.32` stays matched |
| CLI resolution | PASS — Linux | `npm run diagnose:platform` reports `linux-x64`, source `path` under npm scripts, version `2.0.32`, no diagnostics |
| Local binary resolution | PASS — Linux | Resolver test with an empty `PATH` resolves `node_modules/@opencode/cli/bin/opencode.exe` and version `2.0.32` |
| Server smoke | PASS — Linux | `npm run smoke:opencode` resolves the CLI, starts a disposable server on a loopback ephemeral port, reads `/api/info` as `2.0.32`, and stops it; no prompt or model call |
| Platform gate | PASS | `tests/platform.test.ts` covers linux-x64, darwin-arm64, darwin-x64, and rejects linux-arm64, win32-x64, darwin-ia32, freebsd-x64 |
| Diagnostics | PASS | Distinct missing, permission, incompatible, untested-patch, unsupported-platform, and server-start diagnostics; messages assert no local path |
| Workspace safety | PASS | `tests/security.test.ts` covers `/Users`, `/Volumes`, `/System`, `/private`, `/private/tmp`, `/private/var/tmp`, `/private/var/folders`, and the resolved temporary root |
| Setup UI | PASS | `setupTabs` contains no `cli-linux`; command is `npx --no-install opencode serve`; notes include npm and Homebrew installs |
| Static CI contract | PASS | Workflow test asserts `ubuntu-latest`, `macos-15`, `macos-15-intel`, and the platform/test/smoke steps |
| Typecheck | PASS | `npm run typecheck` |
| Unit/integration tests | PASS — 200 | `npm test` |
| Production build | PASS | `npm run build` |
| macOS arm64 execution | PASS — CI | `macos-15` job in run `41252770576`: install, CLI resolution, typecheck, 200 tests, build, workspace safety, OpenCode smoke |
| macOS x64 execution | PASS — CI | `macos-15-intel` job in run `41252770576`: same steps |
| Migration | NOT REQUIRED | Dependency and resolver change; schema v7 and saved projects are unchanged |

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
| Private/authenticated repository connector | DEFERRED | Phase 3 supports only public credential-free HTTPS import; Maker remains demo-workspace bounded |
| Moderate dependency advisories | KNOWN LIMITATION | Fix requires a breaking Sentry downgrade; production high-severity audit passes |
| macOS manual session | NOT RUN | macOS execution is verified by CI; no separate manual macOS session is recorded |

## Evidence handling rules

- Do not publish secrets, provider keys, server passwords, session tokens, private transcripts, or unrestricted local paths.
- Use repository-relative paths in reports; the local absolute checkout path is intentionally omitted.
- A model statement is not an exit code or observed effect.
- A fixture PASS is not a live PASS.
- A deployment, publication, or submission needs separate confirmation; no local file proves an external action.
