# Implementation plan and phase record

**Last updated:** 2026-10-31.
**Current boundary:** Phase 4 complete and verified. Phase 5 has not started.

## Phase history

| Phase | Outcome | State |
|---|---|---|
| Foundation | Node/Hono/React/Vite shell, atomic project store, shared contracts | Complete |
| Staged workflow | Oracle, Architect, Maker, Witness transitions; exact-version approvals; dependency invalidation | Complete |
| Guided experience | Real native edit path, recovery, Run Inspector data, evidence references | Complete |
| OpenCode onboarding/discovery | First-run connection wizard, model/provider/agent discovery, model selection, sessions, permissions, usage, deployment modes | Complete and verified |
| Phase 4 — Ghostlight interface | Landing page, visual system, motion, spirit characters, deterministic demo, visual/accessibility tests | Complete and verified |

## Phase 4 objective

Make the product sell itself as an OpenCode-powered hackathon project builder, explain local and hosted choices honestly, and give the workshop a dimensional, readable, state-driven interface without changing workflow authorization or adding a second coding harness.

## Phase 4 work units

| Unit | Outcome | Evidence |
|---|---|---|
| P4-01 | Verify Phase 3 navigation and preserve stage/approval semantics | Existing workflow tests remain green; stage strip rebuilt as a semantic list |
| P4-02 | Define Ghostlight tokens and component system | `src/web/styles.css`, this docs set |
| P4-03 | Build the landing page and all required sections | `src/web/landing/`, `tests/web.test.ts` |
| P4-04 | Build the deterministic demo and state gallery | `src/web/demo/`, `/demo` route |
| P4-05 | Create hero and character assets | `assets/source/`, `public/assets/hero/`, `SpiritCharacter.tsx`, `scripts/build-hero-assets.py` |
| P4-06 | Apply the system to workshop header, stages, cards, inspector, dialogs, errors, empty states, setup panels | `src/web/workshop/`, shared components |
| P4-07 | Add motion with reduced-motion fallbacks | CSS state classes + Motion seal entry; Playwright reduced-motion test |
| P4-08 | Add component/route and visual/accessibility tests | `tests/web.test.ts`, `tests/visual/landing.spec.ts`, `tests/visual/snapshots/` |
| P4-09 | Measure and document production budget | `scripts/check-budget.mjs`, `docs/UX_AND_VISUAL_SYSTEM.md` |
| P4-10 | Update setup, deployment, product, architecture, decision, demo, README docs | This documentation set |
| P4-11 | Integrate the remote OpenCode onboarding/discovery work without losing either history | Rebased Phase 4 onto `origin/main`; first-run wizard, model discovery, sessions, permissions, and usage wired into `/workshop`; 63 tests pass |

## Verification gate

Run in this order:

```bash
npm run typecheck
npm test
npm run build
npm run budget
npm run test:visual
```

Observed results on 2026-10-31:

| Check | Result |
|---|---|
| Typecheck | PASS |
| Unit/integration/component tests | PASS — 63 tests |
| Production build | PASS |
| Budget | PASS — initial JS 192.8 KiB gzip, all JS 250.2 KiB, CSS 12.6 KiB, hero 570.9 KiB total, largest hero 86.7 KiB |
| Playwright visual/accessibility suite | PASS — 13 tests, 23 snapshots |
| 200% text zoom | PASS |
| 390px overflow | PASS |
| Reduced motion | PASS (`animation: none`) |
| Token contrast (tested pairs) | PASS (≥4.5:1) |
| Setup commands | `npm ci`, `npm run dev`, `npm run dev:web`, build/start verified; OpenCode `--version` and `serve --help` verified |

A live free-model call is not part of the Phase 4 gate. The previous native execution evidence remains the Phase 3 record; Phase 4 did not re-run inference.

The remote `9bc5782` OpenCode onboarding/discovery commit was integrated rather than overwritten. It was replayed under the Phase 4 commit, and the workshop route now uses the new connection/model/session APIs. The integration preserves the remote work and the landing/demo/visual-system work in one history.

## Exit criteria

- A first-time visitor can explain the product, the four roles, OpenCode's role, and the two usage paths.
- The landing page contains tested local setup guidance.
- The interface has visible depth and coherent state-driven motion without harming readability.
- Characters are distinct, original, accessible, and tied to workflow state.
- Reduced-motion and low-bandwidth fallbacks remain complete.
- Production assets meet the documented budget; tests and build pass.
- Workflow authorization is unchanged.

## Next boundary

Stop at Phase 4. Phase 5 is not started and requires a new explicit instruction.
