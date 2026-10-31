# Changelog

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
