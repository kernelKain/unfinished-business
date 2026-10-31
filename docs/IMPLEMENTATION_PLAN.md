# Implementation plan and phase record

**Last updated:** 2026-10-31.
**Current boundary:** Phase 7 complete and locally verified. Phase 8 has not started.

## Phase history

| Phase | Outcome | State |
|---|---|---|
| Foundation | Node/Hono/React/Vite shell, atomic project store, shared contracts | Complete |
| Staged workflow | Oracle, Architect, Maker, Witness transitions; exact-version approvals; dependency invalidation | Complete |
| Guided experience | Real native edit path, recovery, Run Inspector data, evidence references | Complete |
| OpenCode onboarding/discovery | First-run connection wizard, model/provider/agent discovery, model selection, sessions, permissions, usage, deployment modes | Complete and verified |
| Ghostlight interface | Landing page, visual system, motion, spirit characters, deterministic demo, visual/accessibility tests | Complete and verified |
| Hosted runtime modes | Hosted-demo/private-hosted distinction, read-only connection policy, deployment documentation | Complete and verified for the demo policy |
| Phase 7 — Guided demo | Versioned fixture, guided playback, 90-second presentation, hosted-demo mutation rejection, reset isolation, docs/tests | Complete and locally verified |

## Phase 7 objective

Make the product's value legible to a first-time visitor and a judge without requiring an OpenCode account, provider key, model quota, or repository. The example must use the real interface contracts, label every simulated result, and make reset incapable of touching live state.

## Phase 7 work units

| Unit | Outcome | Evidence |
|---|---|---|
| P7-01 | Verify Phase 3 four-stage navigation and Phase 6 hosted-demo restrictions | Stage tabs preserved; `mode` added to `createApp`; demo rejects non-GET API requests |
| P7-02 | Extract browser-safe production workflow schemas | `src/shared/workflow.ts`; server model re-exports them |
| P7-03 | Define the versioned Campus Umbrella Relay fixture | `src/shared/demo.ts`; `campus-umbrella-relay@1` |
| P7-04 | Add deterministic playback state | `src/web/demo/playback.ts`; pure reducer |
| P7-05 | Build the guided example UI | `src/web/demo/DemoPage.tsx`; shared RunInspector, SpiritStageTabs, SpiritCharacter, StatusChip |
| P7-06 | Add tab inspection, pause/resume/step/replay/reset | Four inspectable spirit tabs; reset isolation |
| P7-07 | Add the 90-second presentation mode | `?presentation=1`; 10 beats × 9 seconds |
| P7-08 | Add distinct actions | Try the example, Watch the guided workflow, Run live with OpenCode |
| P7-09 | Enforce hosted-demo read-only behavior | `DEMO_READ_ONLY`; no session token; fixture project/export; demo connection status |
| P7-10 | Add fixture/drift/playback/isolation/accessibility tests | `tests/demo.test.ts`, `tests/visual/demo.spec.ts` |
| P7-11 | Update demo, product, UX, architecture, hosted, operations, decisions, changelog, README | This documentation set |

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
| Unit/integration/component tests | PASS — 73 tests |
| Production build | PASS |
| Budget | PASS — initial JS 193.1 KiB gzip, all JS 262.9 KiB, CSS 14.2 KiB, hero 570.9 KiB total, largest hero 86.7 KiB |
| Playwright visual/accessibility suite | PASS — 18 tests |
| Demo fixture validation | PASS — production `projectSchema`, operation/evidence/capability schemas, real section hashes |
| Full playback | PASS — 10 beats, completed state, replay/reset |
| Pause/resume/step/tab inspection | PASS |
| Route refresh/presentation mode | PASS — `?presentation=1`; 90 seconds |
| No network/inference/mutation requests | PASS — request capture in Playwright; source scan in node tests |
| Hosted-demo mutation isolation | PASS — `403 DEMO_READ_ONLY`; live store unchanged |
| Accessibility | PASS — skip link, live regions, progressbar, labeled controls, focus ring |
| Narrow layout | PASS — 390px without horizontal overflow |

## Exit criteria

- A first-time visitor can complete and understand the example without OpenCode credentials.
- The demo makes zero inference/provider calls and cannot mutate a live repository.
- Simulated evidence is unmistakably labeled; the live session remains `NOT_RUN`.
- Reset cannot affect live state.
- The same UI contracts render live and demo runs.
- A 90-second presentation path covers problem, four spirits, Maker progress, verification, and next step.
- Automated checks and build pass.

## Next boundary

Stop at Phase 7. Phase 8 has not started and requires a new explicit instruction.
