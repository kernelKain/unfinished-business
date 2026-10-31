# Changelog

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
