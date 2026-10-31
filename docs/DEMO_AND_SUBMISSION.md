# Demo and submission guidance

**Status:** Deterministic guided demo and release evidence complete. A real recorded video, published article, and submission remain pending explicit authorization.
**Owner:** Demo/submission.
**Last verified:** 2026-11-01 (18 visual/accessibility tests; 139 unit/integration tests).

## Two different demos

| Demo | What it is | What it proves |
|---|---|---|
| Guided example (`/demo`) | A versioned fixture played through the real interface components | Interface states, approval language, permission boundaries, evidence wording, recovery, and reset isolation |
| Real workshop (`/workshop`) | The four-stage workflow connected to a local OpenCode server | Actual native sessions, observed tool results, real failures and success |

Never present the guided example as live inference. Never use a fixture screenshot to claim a real build passed. The demo page and its fixture are deliberately separate from live project data.

## Scenario: Campus Umbrella Relay

The example recovers a half-built campus umbrella/lost-and-found workflow:

1. a group-chat lost-and-found lets umbrellas be claimed twice;
2. the Oracle clarifies one umbrella pool, one pickup point, a short claim code, and duplicate-claim prevention;
3. the Architect approves eight sections, including a revision that makes the old approval stale;
4. Maker receives a separate scope for two files in `demo-workspace/`;
5. one bounded change adds duplicate-claim and returned-item guards plus a behavioural test;
6. a prerecorded `node --test` check records 3 passed, 0 failed;
7. Witness separates the fixture pass from the missing live proof and states the next honest step.

No real campus, sponsor, user, metric, deployment, account, or competition result is depicted. The scenario is aligned with the repository's existing campus lost-and-found demo fixture rather than inventing a new sponsor or product claim.

## Fixture and provenance

| Item | Value |
|---|---|
| Fixture module | `src/shared/demo.ts` |
| Fixture version | `campus-umbrella-relay@1` |
| Data mode | `demo` |
| Source label | `Prerecorded demo fixture — not a live OpenCode session` |
| Production contract | `src/shared/workflow.ts` (`projectSchema`, operation/evidence/capability schemas) |
| Drift test | `tests/demo.test.ts` |
| Playback state | `src/web/demo/playback.ts` |
| UI | `src/web/demo/DemoPage.tsx` |
| Shared components | `RunInspector`, `SpiritCharacter`, `SpiritStageTabs`, `StatusChip`, `Brand` |

The fixture contains the input idea, Oracle clarification, approved product summary, eight Architect sections, two revisions, Maker authorization, normalized operations, a representative diff, verification output, Witness findings, submission readiness, and next actions. Section hashes are real SHA-256 hashes of the fixed content and are recomputed by the test.

The fixture is browser-safe: it imports no server, filesystem, network, provider, or OpenCode module. `tests/demo.test.ts` also reads the source to assert that it has no `fetch`, `/api/`, `node:`, `Date.now`, `Math.random`, or `process.env` use.

## Playback

| Control | Behavior |
|---|---|
| Play / Pause | Starts or stops deterministic auto-advance |
| Previous / Next step | Moves one beat and pauses |
| Replay | Returns to beat 1 and plays |
| Reset | Returns to beat 1, paused, and clears tab inspection |
| Spirit tabs | Inspect Oracle, Architect, Maker, or Witness at any time; inspection pauses playback |
| 90s mode | Enters the screen-recording presentation path |

Normal playback holds each of the 10 beats for 7 seconds. Presentation mode holds each beat for 9 seconds, for exactly 90 seconds. Presentation mode is optional; normal interactive use remains available. `?presentation=1` is the route-refresh state for presentation mode.

The demo uses `setTimeout` only for playback. It makes no network request, inference call, provider call, or mutation request. The Playwright test records requests during playback and asserts that no `/api/` or provider URL is contacted.

## Reset behavior

Reset is a pure reducer transition in `src/web/demo/playback.ts`. It changes only:

- the demo beat index;
- the playing/paused flag;
- the inspected spirit tab;
- the completed flag.

It cannot call `/api/*`, cannot change a live project snapshot, cannot start or stop an OpenCode session, and cannot clear live state. In hosted-demo mode the server independently rejects every non-GET `/api/*` request with `DEMO_READ_ONLY`, so a browser cannot reach a live mutation even if the UI were bypassed.

## Live-versus-simulated disclosure

| Claim | Demo behavior |
|---|---|
| “This is live inference” | **Prohibited.** The page says no provider call or model quota is used. |
| “The check passed” | Allowed only with the label “prerecorded demo fixture”; the live session is shown as `NOT_RUN`. |
| “This is the visitor's repository” | **Prohibited.** The workspace is `demo://campus-umbrella-relay`. |
| “This is a submitted hackathon entry” | **Prohibited.** The Witness readiness statement says it is not a submission. |
| “Reset is safe for live state” | Allowed with the exact scope: reset changes only the demo fixture. |

Every simulated operation, evidence row, diff, and finding carries a visible `Demo data` chip or a fixture source label. The Run Inspector receives the same operation/evidence/capability shapes as the live workshop.

## Phase 9 evidence boundary

- The fixture, reset isolation, schema drift, 90-second timing, tab inspection, and no-network behavior are covered by `tests/demo.test.ts` and `tests/visual/demo.spec.ts`.
- The hosted demo was smoke-tested locally: fixture project, no session token, `DEMO_READ_ONLY` mutation, no engine, and a rendered `/demo`.
- The last real native inference recorded in this repository remains the Experience-phase umbrella-relay run, which produced a real Maker diff and a failing `node --test`; Witness recorded the failure. Phase 9 did not repeat live inference.
- No video file, public hosted URL, published article, or submission receipt exists. Do not claim one.

## Exact claims

Approved:

- “The guided example is a deterministic fixture.”
- “OpenCode supplies the agent loop, model access, native tools, permissions, and sessions.”
- “The example shows the same Run Inspector contract used by the live workshop.”
- “The fixture check passes; the live native session is not run.”
- “Reset affects only the demo fixture.”
- “Run live with OpenCode for a real native session.”
- “The hosted demo is read-only and has no repository, provider key, or user-specific storage.”

Not approved:

- “Live inference” or “real OpenCode run” around the fixture.
- “Reads your repository from the hosted page.”
- “Guaranteed working build.”
- “Autonomous end-to-end submission.”
- Any testimonial, user count, award, sponsor endorsement, performance metric, deployment result, or competition result that has not been observed.

## 90-second presentation path

The presentation mode is 10 beats × 9 seconds. A recording can follow this beat map:

| Time | Beat | What to show |
|---|---|---|
| 0–9s | Problem | The group-chat umbrella problem and the unfinished idea |
| 9–18s | Oracle | Clarification, open questions, explicit product approval |
| 18–27s | Architect | One section drafted; revision makes the old approval stale |
| 27–36s | Approval | Exact-version approval and the eight-section plan |
| 36–45s | Scope | Separate Maker authorization; permission boundary |
| 45–54s | Run | Maker progress: queued → running → succeeded (fixture replay) |
| 54–63s | Diff | Representative diff with the source label visible |
| 63–72s | Check | Deterministic `node --test` output and the `NOT_RUN` live session |
| 72–81s | Witness | Pass, limitations, readiness, and next actions |
| 81–90s | Next step | Clean exit to local setup or live OpenCode |

Narration should name the four spirits, explain that the run is a prerecorded fixture, and end with “run live with OpenCode for a native session.”

## Screenshots and video beats

Canonical Playwright captures:

| File | Shows |
|---|---|
| `tests/visual/snapshots/demo-guided-wide.png` | Wide guided example: intro, honesty panel, playback controls |
| `tests/visual/snapshots/demo-guided-narrow.png` | 390px guided example without horizontal overflow |
| `tests/visual/snapshots/demo-presentation-wide.png` | 90-second presentation mode |
| `tests/visual/snapshots/run-inspector.png` | Run Inspector at the check beat, including fixture PASS and live `NOT_RUN` |
| `tests/visual/snapshots/recovery-unknown.png` | Unknown native run and reconcile action |
| `tests/visual/snapshots/landing-wide.png` | Landing page with the three distinct demo/live actions |
| `tests/visual/snapshots/landing-narrow.png` | Narrow landing page |
| `tests/visual/snapshots/workshop-wide.png` | Live workshop structure |
| `tests/visual/snapshots/onboarding-wide.png` | OpenCode connection/discovery |
| `tests/visual/snapshots/spirit-*.png` | Character states |

Video rules:

- Keep the fixture label and `NOT_RUN` visible when showing evidence.
- Do not speed-edit the fixture into a live run.
- Do not add fake terminal output, dashboards, success badges, or deployment results.
- If a live recording fails, show the failure and say so.
- Use the actual viewport; do not stretch narrow screenshots.

## Regenerating snapshots

```bash
npm run build
npm run test:visual
```

After a deliberate visual change:

```bash
npx playwright test --update-snapshots
```

Review every changed image before committing. A snapshot change is a UI decision, not an automatic approval.

## Clean exit

The guided example ends with two honest exits:

- **Run live with OpenCode** → `/workshop`, which shows the real connection/discovery flow.
- **Local setup** → `/#local-setup`, which links to the tested commands in `docs/LOCAL_SETUP.md`.

The hosted demo also rejects mutation routes, so “Run live” is an explicit path to a local or private deployment rather than an implied capability of the public sample.
