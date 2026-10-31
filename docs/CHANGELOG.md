# Changelog

**Status:** Current release history.
**Owner:** Engineering.
**Last verified:** 2026-11-01.

## 2026-11-01 — Upgrade Phase 6 canonical sample and landing page

### Added

- One canonical `driftwatch@1` fixture for the guided sample, landing preview, evidence view, visual snapshots, and evidence examples.
- Shared `demoPreviewSteps` derived from the fixture so the landing cannot drift from the guided sample.
- A concise sample-story block covering the original problem, what was left unfinished, and what the team changed.
- Fixture-consistency unit coverage and a Playwright landing/demo consistency check.
- A bespoke four-spirit abandoned-workshop hero and responsive AVIF/WebP/JPEG variants.

### Changed

- Rebuilt the landing page around hero, four-stage workflow, sample project, why OpenCode, local setup and privacy, and FAQ/final CTA.
- Made **Try the example** the single primary CTA and **Run locally** the secondary action; removed the duplicate watch action.
- Replaced technical hero facts with Clarify the idea, Approve the plan, Build with OpenCode, and Verify the result.
- Rewrote “OpenCode is the engine” as “OpenCode does the coding. This workshop does the deciding.”
- Renamed deterministic walkthrough to **guided sample**, hosted demo to **hosted sample**, and full local mode to **local workshop**.
- Moved sample provenance, fixture version, technical caveats, and the evidence inspector under details.
- Reduced oversized display type, glass cards, pills, outlines, glows, and monospace labels; refreshed visual snapshots.

### Removed

- The separate landing operations/evidence/capabilities exports and their contradictory `FAIL` result.
- The static idea-to-tool recommendation table, fixtures, styles, and tests.
- The duplicate “Watch the guided workflow” landing CTA.

### Not in this entry

- No schema change or migration; schema v7 remains current.
- No new provider call, deployment, publication, or submission.
- No change to approvals, Maker scope, native permissions, or run recovery.

## 2026-11-01 — Upgrade Phase 5 focused workshop and OpenCode controls

### Added

- Focused workshop layout with one primary task, a compact model/connection header, and collapsible Project outline and Project memory drawers.
- **Activity & results** (formerly Run Inspector) organized into Progress, Changes, and Checks, with native IDs, capability mappings, raw evidence, and provider payloads under Technical details.
- Editable Project memory for decisions, user answers, assumptions, constraints, and unresolved questions; corrections supersede the previous entry and preserve history.
- Authenticated `POST /api/memory` route for adding or correcting a project-memory entry without changing an approval, section draft, Maker scope, or native run.
- Contextual permission alert outside collapsed controls and an `aria-live` status announcement for busy/permission/run state.

### Changed

- Removed the permanent right rail and Session notes panel; Activity & results is hidden until an operation or check exists.
- Split OpenCode controls into **Model & connection**, **Contextual permission request**, and **Advanced diagnostics**; sessions, agents, commands, skills, MCP, LSP, formatters, low-level revert, export, and raw transcripts moved into advanced diagnostics and load on open.
- Stage changes move focus to the main task; drawers are keyboard-operable native disclosures; mobile/tablet layouts avoid horizontal overflow.
- Approval is primary only for a current draft; otherwise the stage's own action remains primary.
- All-JS gzip budget deliberately raised from 280 to 290 KiB for the focused-workshop and Project memory surfaces; CSS remains within 18 KiB.
- Visual snapshots refreshed for the workshop, Activity & results, demo, and character states.

### Not in this entry

- No schema change or migration; schema v7 remains current.
- No new provider call, deployment, publication, or submission.
- No second coding harness or new native execution authority.

## 2026-11-01 — Upgrade Phase 4 reviewable generated revisions

### Added

- Section-specific content contracts for all eight Architect sections: required topics, detail guidance, dependencies, risk/decision requirements, acceptance criteria, and required headings.
- Candidate revisions with base version/hash, summary, requested change, decision time, and `PENDING`/`ACCEPTED`/`REJECTED`/`SUPERSEDED` status.
- Review surface with complete Markdown preview, unified/side-by-side line diff, accept, request-another, and discard controls.
- Safe Markdown parser/renderer for headings, paragraphs, lists, emphasis, links, tables, and fenced code.
- Section selection, pending badges, contract details, revision/approval history, and improved reading typography/spacing/empty states.
- Schema v7 with explicit v1–v6 migration.

### Changed

- `POST /api/sections/:id/revisions` now accepts a change request and queues an Architect candidate instead of replacing section text.
- Acceptance applies a candidate only when its base version/hash still matches; the section becomes `DRAFT` and affected downstream approvals become `STALE`.
- Approval remains a separate exact-version action after acceptance.
- CSS budget deliberately raised from 15 to 18 KiB for the new review, Markdown, and diff surfaces.

### Not in this entry

- No raw HTML execution, full CommonMark support, or automatic candidate acceptance.
- No live provider inference, deployment, publication, or submission.

## 2026-11-01 — Upgrade Phase 3 project intake and guided discovery

### Added

- Four-way project-source onboarding: new project, validated local repository, public remote repository URL, or saved work.
- Confirmation-gated remote import into a private managed workspace, with credential-bearing/private URLs rejected and Git prompts, credential helpers, redirects, and output disabled.
- Schema v6 Oracle intake fields covering intended user, problem, desired outcome, deadline/event, must-have and optional features, budget, privacy, platforms, repository condition, non-goals, and unresolved questions.
- Rich Oracle reply contract with question/proposal modes, explained suggested questions, assumptions, constraints, structured proposal provenance, unresolved risks, and recommended next action.
- Structured answer/decision/assumption memory with active/superseded history and correction support.
- Explicit v1–v5 migration preserving saved work and treating legacy projects as confirmed saved projects.

### Changed

- Oracle retains the complete Product Discovery procedure and now works in focused turns of no more than three high-value questions.
- Proposal application is server-gated on confirmed source and essential intake; essential assumptions require an explicit proceed-with-assumptions action.
- Public project responses and Oracle prompts omit canonical local and managed workspace paths.
- The workshop shows source onboarding before OpenCode setup and renders question rationale, choices, proposal facts/decisions/assumptions, memory, correction, and assumption controls.

### Not in this entry

- No private/authenticated repository import, SSH clone, arbitrary redirects, submodule credentials, or remote browser-to-local pairing.
- No expansion of Maker authority to selected/imported repositories.
- No live provider inference, deployment, publication, or submission.

## 2026-11-01 — Upgrade Phase 2 observable, cancellable, recoverable runs

### Added

- Oracle, Architect, Witness, and Maker runs as persisted asynchronous operations: `POST /api/messages` (stage intents) and `POST /api/runs` return `202` with a queued operation; the saved project updates as the run progresses.
- Persisted live progress phases on operations: `CONNECTING`, `SESSION_CREATED`, `WAITING_FOR_MODEL`, `RECEIVING_OUTPUT`, `VALIDATING_RESULT`, `WAITING_PERMISSION`, `APPLYING_RESULT`, `RUNNING_CHECKS`, `AWAITING_RECONCILIATION` — observed through bounded OpenCode polling and direction checks from the guide.
- Operation recovery metadata: `intent`, `sectionId`, `startingRevision`, `idempotencyKey`, `expectedOutput`, `retryOf`, `progress` (schema v5 with explicit v1/v2/v3/v4 migration and deterministic reconciliation markers for old unresolved runs).
- Run Inspector recovery controls: elapsed time plus **Continue waiting**, **Reconcile now**, **Open in OpenCode**, **Cancel**, **Retry after failure**, **Mark abandoned**.
- `POST /api/runs/:id/retry` — confirmed-failure Maker retry with explicit `retryOf` lineage; refuses non-Maker rows, unresolved runs, active runners, and already-finished targets.
- `POST /api/runs/:id/abandon` — operator-only abandon with a recorded status reason.
- Deeper reconciliation: outcome observation, actual late-reply retrieval (`message.list`), actual diff retrieval (`session.diff`), same-schema validation, node re-check, and exact-once application guarded by `appliedAt` plus the idempotent action record; `COMPLETED_UNAPPLIED` is reachable when the result is not yet readable.
- `SpiritGuide` observation surface: `lastAssistantText`, `sessionDiff`, `hasPendingPermission`, and progress callbacks.

### Changed

- Maker timeout/disconnect/restart outcomes leave a recoverable `ABANDONED` record with its native session reference and recovery marker instead of an unrecoverable dead end.
- Restart recovery stamps `AWAITING_RECONCILIATION` and keeps native references; reconciliation stays available after a reconnect.
- Cancellation works for guide runs too and a late reply cannot overwrite an already-`CANCELLED` record.
- `refreshNextAction` pins an unresolved guide run to the stage of the spirit that owns it.
- Demo fixture version bumped to `campus-umbrella-relay@2` for schema v5 fields.

### Not in this entry

- No raw model streaming, no partial output in the document, and no private chain-of-thought display.
- No SSE event-stream consumption yet (documented future upgrade path in `ARCHITECTURE.md`).
- No automatic reconciliation of abandoned runs; reconciliation is explicit.
- No live provider inference, deployment, publication, or submission.

## 2026-11-01 — Upgrade Phase 1 model access and provider recovery

### Added

- Model access preferences: **All accessible models** (new-project default) and **Free and local only**.
- Optional per-project USD spending limit, with `unlimited`/`disabled` and a deployment-wide `UB_MAX_SESSION_COST_USD` ceiling.
- Explicit first-paid/unknown-price confirmation stored in project state and rechecked before a request.
- Provider metadata display for provider, locality, pricing, limits, variants, and route privacy warnings.
- Structured provider errors with eight categories, saved-work status, repair action, retryability, redacted technical details, and a `provider-…` diagnostic reference.
- Provider error card in the workshop and a compact provider-error line in the Run Inspector.
- Schema v4 and explicit v3 → v4 migration; v1/v2 also migrate to v4.

### Changed

- Removed the global free/local-only selection restriction; the policy is now per project.
- Replaced the hardcoded `$0` session cost failure with an optional limit. The stricter deployment/project limit wins.
- Provider data-policy/training rejections are classified and explained instead of producing generic concatenated text.
- Migration preserves v3 selected models, provider allowlists, privacy preference, and positive limits; zero v3 limits become unlimited.
- Generic credential-shaped redaction now covers `password=`, `api_key=`, `access_token=`, and similar key/value forms.

### Not in this entry

- No automatic retry, model substitution, provider-key entry, or payment authorization.
- No claim that the app can verify a provider's training/retention contract.
- No live provider inference, deployment, publication, or submission.

## 2026-11-01 — Upgrade Phase 0 product foundation

### Added

- Schema v3 foundations for project source metadata, Oracle intake, structured memory, candidate section revisions, model-access/budget preferences, and richer operation metadata.
- Reusable synthetic fixtures for provider privacy/training-policy rejection, authentication failure, rate limiting, generic failure, slow/late responses, late Maker diffs, pending permission, and reconciliation.
- Migration, serialization, and fixture tests.

### Changed

- Explicit v1/v2 → v3 migration is deterministic and idempotent and preserves existing workflow records and model selection.
- Operation states now include `COMPLETED_UNAPPLIED` and `ABANDONED`; legacy `UNKNOWN` records migrate to `ABANDONED`.
- Runtime recovery and the existing UI use `ABANDONED` for an unconfirmed native outcome without adding a major new workflow feature.

### Not in this entry

- No new provider integration, automatic retry, late-result application, memory-driven prompting, candidate-revision UI, or preference enforcement.
- No live provider call, credential, private model output, deployment, publication, or submission.

## 2026-10-31 — Phase 9 release verification and documentation migration

### Added

- Phase 8 security/persistence hardening integrated with the guided interface, onboarding, and deterministic demo.
- Canonical documentation set: product brief, architecture, implementation plan, OpenCode integration, local setup, hosted deployment, tool catalog, UX/visual system, operations/recovery, demo/submission, decisions, changelog.
- `docs/EVIDENCE.md` requirements-to-evidence index and `docs/RELEASE_NOTES.md`.
- Migration coverage for schema v1 and both supported v2 shapes.
- Recommendation source/freshness metadata and test.
- Local/hosted-demo smoke evidence and an OpenCode 2.0.32 compatibility probe with no inference.

### Changed

- Unified `UB_DEPLOYMENT_MODE` as canonical; legacy `UB_MODE` remains an alias.
- Protected API reads now require the browser session token in local/private modes; the public hosted demo remains token-free and read-only.
- Maker runs are asynchronous and use `UNKNOWN`/`WAITING_PERMISSION` rather than silently retrying.
- Paid or unpriced remote models are discoverable but not selectable.
- Canonical docs now match the merged routes, schema v2, environment variables, modes, and verified test counts.

### Fixed

- Reconciled contradictory mode/auth behavior between the two completed lines.
- Corrected local-mode copy that implied arbitrary repository or workspace selection.
- Removed dead/duplicated demo beat row and updated stale verification figures.
- Preserved both corrupt-state and guided-demo recovery paths.

### Verification

- `npm ci`, `npm run typecheck`, `npm test` (111), `npm run build`, `npm run budget`, `npm run test:visual` (18), and `npm audit --omit=dev --audit-level=high` pass.
- Local smoke: health, mode, token, project, and workshop route pass.
- Hosted-demo smoke: fixture project, no token, `DEMO_READ_ONLY` mutation, no engine, and `/demo` HTML pass.
- OpenCode compatibility: server 2.0.32, catalog, disposable session create/read/remove; no prompt/model call.

### Not in this entry

- No deployment, public URL, domain registration, credit claim, publication, video, article, or submission.
- No live Sentry release/source-map/trace verification.
- No Backboard integration or partner-category claim.
- No shared multi-user isolation or remote browser-to-local pairing.

## 2026-10-31 — Security, persistence, and operations hardening (Phase 8)

### Added

- Explicit `local`, `hosted-demo`, and `private-hosted` modes with fail-closed startup validation.
- Canonical workspace roots, broad-root rejection, traversal/symlink checks, private modes, and static containment.
- OpenCode URL/SSRF/DNS/redirect/timeout/response-size policy and readiness gate.
- Host/Origin/`Sec-Fetch-Site`, Basic Auth, constant-time session token, JSON content type, request-size cap, rate limit, concurrency gate, and bounded SSE.
- State schema v2 with timestamps, mode/demo metadata, migration, backups, corrupt quarantine, cross-process lock, disk-failure mapping, and startup recovery.
- Centralized redaction, structured logs, retention, budgets, and `/api/runtime`/`/api/events`.
- Security/recovery tests for the above.

### Changed

- Protected API reads require the session token.
- Unknown/timeout/permission outcomes are explicit and never replayed automatically.
- Provider/model readiness and error classification are visible before mutation.

### Residual risks

- No shared-host isolation; the Node check is not an OS sandbox.
- Remote connectors and multi-tenant isolation remain deferred.
- Six moderate `glob`/`minimatch` advisories remain reachable through the Sentry bundler plugin during developer builds; the production audit at high severity passes.


## 2026-10-31 — Guided deterministic demo (Phase 7)

### Added

- Versioned `campus-umbrella-relay@1` fixture in `src/shared/demo.ts` with the idea, Oracle clarification, approved product summary, eight Architect sections, revisions, Maker authorization, normalized operations, representative diff, deterministic check, Witness findings, readiness, and next actions.
- Guided playback at `/demo` with Play/Pause, Previous/Next, Replay, Reset, four inspectable spirit tabs, and a 90-second presentation mode (`/demo?presentation=1`).
- Pure playback reducer in `src/web/demo/playback.ts`; reset changes only demo playback state.
- Browser-safe production workflow schemas in `src/shared/workflow.ts`, re-exported by the server model.
- Runtime-mode descriptors in `src/shared/modes.ts`.
- Hosted-demo read-only policy: every non-GET `/api/*` request returns `403 DEMO_READ_ONLY`; no session token is issued; `/api/project` and `/api/export` return the fixture; `/api/connection` reports a read-only demo status.
- Read-only hosted-demo notice on `/workshop` with clean exits to the guided example or local setup.
- Distinct landing actions: Try the example, Watch the guided workflow, and Run live with OpenCode.
- Fixture/drift/playback/isolation/accessibility tests in `tests/demo.test.ts` and `tests/visual/demo.spec.ts`.
- New snapshots: `demo-guided-wide.png`, `demo-guided-narrow.png`, `demo-presentation-wide.png`.

### Changed

- The deterministic demo now uses the production `RunInspector`, `SpiritStageTabs`, `SpiritCharacter`, `StatusChip`, and `Brand` components instead of a parallel demo interface.
- `SpiritStageTabs` supports an optional inspectable variant used only by the demo; the workshop remains non-interactive stage navigation.
- `RunInspector` accepts an optional demo source label and marks fixture rows.
- The demo page visibly labels the fixture PASS and the live session `NOT_RUN`.
- README, product brief, UX/visual system, architecture, hosted deployment, operations/recovery, implementation plan, decisions, and demo/submission docs now describe the guided demo and its boundaries.

### Fixed

- Long fixture fingerprints and diff/check content no longer cause horizontal page overflow at 390px.
- The demo's reset control cannot reach a mutation endpoint or a live project.

### Verification

- `npm run typecheck` — pass.
- `npm test` — 73 pass.
- `npm run build` — pass.
- `npm run budget` — pass (initial JS 193.1 KiB gzip; all JS 262.9 KiB; CSS 14.2 KiB; hero 570.9 KiB total).
- `npm run test:visual` — 18 pass.
- Hosted-demo smoke test: `/api/project` returns the fixture, `/api/mode` returns the demo descriptor, `/api/session` is `403`, and a mutation is `403 DEMO_READ_ONLY`.

### Not in this entry

- No live free-model run was repeated.
- The fixture is not live inference and is not a submitted hackathon entry.
- No public hosted URL, testimonial, usage figure, award, sponsor endorsement, deployment result, or competition result is claimed.
- Phase 8 was not started.

## 2026-10-31 — Ghostlight interface (Phase 4)

### Added

- Landing page at `/` with hero, OpenCode-only positioning, two honest usage paths, four-spirit workflow, deterministic demo teaser, Run Inspector preview, idea-to-tool recommendations, tested local setup tabs, privacy boundary, FAQ, and final CTA.
- Deterministic walkthrough at `/demo` with scripted fixture labels, all-state spirit gallery, fixture evidence, and recovery/error states.
- Original inline SVG Oracle, Architect, Maker, and Witness characters with distinct idle, working, permission, blocked, warning, and success states.
- Ghostlight design tokens for color, type, spacing, radius, elevation, borders, focus, motion, and status.
- Native setup dialog, accessible setup command tabs with copy support, semantic four-stage navigation, section cards, Run Inspector, empty states, and error/warning panels.
- Responsive hero asset pipeline (`scripts/build-hero-assets.py`) with a 21:9 master, AVIF/WebP/JPEG outputs, a 3:4 mobile crop, and explicit dimensions.
- Component/route tests (`tests/web.test.ts`) and Playwright visual/accessibility tests (`tests/visual/landing.spec.ts`) with committed snapshots.
- Production budget check (`scripts/check-budget.mjs`).
- Documentation: product brief, UX/visual system, local setup, hosted deployment, demo/submission guidance, architecture, decisions, implementation plan, changelog.

### Integrated

- Merged the remote OpenCode onboarding/discovery work rather than overwriting it. `/workshop` now uses the first-run connection wizard, discovered provider/model/variant selection, active-run polling and cancellation, project-owned session controls, pending permissions, usage, and deployment-mode policy.
- Added `src/web/onboarding.tsx` and `src/web/opencode-panel.tsx` to the Ghostlight interface, with the advanced panel collapsed by default.
- Added a visual snapshot for the first-run connection panel and kept the landing/demo snapshots intact.
- Preserved `src/server/opencode/connection.ts`, discovery, sessions, role mapping, and the new API contract from the remote commit.

### Changed

- `App.tsx` is now a small route switch; the workshop moved to `src/web/workshop/WorkshopPage.tsx`.
- Workshop header, stage navigation, outline, document, Activity/evidence rail, and setup affordances use the shared visual system.
- The old single-page workshop stylesheet was replaced by the tokenized Ghostlight system.
- `npm run dev` no longer uses Node watch mode by default; `npm run dev:watch` is opt-in for environments with `.env`.
- README now documents the landing, demo, workshop, and current verification commands.

### Fixed

- Corrected the pinned OpenCode invocation in setup guidance to execute the ELF binary directly.
- Fixed horizontal overflow at 200% text zoom caused by flex-item wrapping in check lists and non-wrapping status chips.
- Fixed mobile header overflow by allowing controlled wrapping.
- Fixed a missing capsule/portrait hero crop for narrow screens.
- Added reduced-motion `animation: none` fallback so character states remain complete without motion.

### Verification

- `npm run typecheck` — pass.
- `npm test` — 63 pass.
- `npm run build` — pass.
- `npm run budget` — pass (initial JS 192.8 KiB gzip; CSS 12.6 KiB; hero 570.9 KiB total).
- `npm run test:visual` — 13 pass, 23 snapshots.
- Keyboard focus order, dialog Escape, setup tab arrow keys, contrast, reduced motion, 200% zoom, and 390px overflow checked by the visual suite.

### Not in this entry

- A live free-model run was not repeated.
- No public hosted URL, testimonial, usage figure, award, or endorsement is claimed.
- Phase 5 was not started.
