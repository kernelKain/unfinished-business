# Demo and submission guidance

**Status:** Guided sample and first-release evidence complete. A real recorded video, published article, deployment, and submission remain pending explicit authorization.
**Owner:** Demo/submission.
**Last verified:** 2026-11-01 (26 visual/accessibility/resilience tests; 207 unit/integration/component tests).

## Two different demos

| Demo | What it is | What it proves |
|---|---|---|
| Guided sample (`/demo`) | One versioned Driftwatch fixture played through the real interface components | Interface states, approval language, permission boundaries, evidence wording, recovery, and reset isolation |
| Real workshop (`/workshop`) | The four-stage workflow connected to a local OpenCode server | Actual native sessions, observed tool results, real failures and success |

Never present the guided sample as live inference. Never use a sample screenshot to claim a real build passed. The sample page and its fixture are deliberately separate from live project data.

## Scenario: Driftwatch

The sample revives a small abandoned open-source issue-triage CLI:

1. Driftwatch reads a local `issues.json` export and prints issues that have gone quiet.
2. The copied project parses the export, but it still counts closed issues and measures age from the creation date instead of the latest activity.
3. The Oracle clarifies one local export, a 90-day window, closed issues skipped, and age measured from the latest activity date.
4. The Architect approves eight sections; a revision narrows the first release and makes the old approval stale.
5. Maker receives a separate scope for two files in `demo-workspace/`.
6. One bounded change skips closed issues, measures the latest activity, keeps the report shape stable, and adds a behavioural test.
7. A recorded `node --test` check reports 4 passed, 0 failed.
8. Witness separates the recorded pass from the missing live proof and states the next honest step.

No real repository, maintainer, sponsor, user, metric, deployment, account, or competition result is depicted. The sample is an original story about a hackathon team reviving abandoned open-source work, not a claim about a real project.

## Fixture and provenance

| Item | Value |
|---|---|
| Fixture module | `src/shared/demo.ts` |
| Fixture version | `driftwatch@1` |
| Data mode | `demo` |
| Source label | `Recorded sample — not a live OpenCode session` |
| Production contract | `src/shared/workflow.ts` (`projectSchema`, operation/evidence/capability schemas) |
| Drift test | `tests/demo.test.ts` |
| Landing consistency | `tests/web.test.ts`; `tests/visual/landing.spec.ts` |
| Playback state | `src/web/demo/playback.ts` |
| UI | `src/web/demo/DemoPage.tsx`, `src/web/landing/DemoTeaser.tsx` |
| Shared components | `RunInspector`, `SpiritCharacter`, `SpiritStageTabs`, `StatusChip`, `Brand` |

The fixture contains the input idea, Oracle clarification, approved product summary, eight Architect sections, two revisions, Maker authorization, normalized operations, a representative diff, verification output, Witness findings, submission readiness, and next actions. Section hashes are real SHA-256 hashes of the fixed content and are recomputed by the test.

The fixture is browser-safe: it imports no server, filesystem, network, provider, or OpenCode module. `tests/demo.test.ts` also reads the source to assert that it has no `fetch`, `/api/`, `node:`, `Date.now`, `Math.random`, or `process.env` use.

**One canonical source.** `src/web/content/landing.ts` holds copy and configuration only. The landing preview (`demoPreviewSteps`), the evidence view, and the guided sample all read the same fixture. There is no second landing operation/evidence list and no contradictory PASS/FAIL state.

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

The sample uses `setTimeout` only for playback. It makes no network request, inference call, provider call, or mutation request. The Playwright test records requests during playback and asserts that no `/api/` or provider URL is contacted.

## Reset behavior

Reset is a pure reducer transition in `src/web/demo/playback.ts`. It changes only:

- the sample beat index;
- the playing/paused flag;
- the inspected spirit tab;
- the completed flag.

It cannot call `/api/*`, cannot change a live project snapshot, cannot start or stop an OpenCode session, and cannot clear live state. In hosted-sample mode the server independently rejects every non-GET `/api/*` request with `DEMO_READ_ONLY`, so a browser cannot reach a live mutation even if the UI were bypassed.

## Live-versus-recorded disclosure

| Claim | Sample behavior |
|---|---|
| “This is live inference” | **Prohibited.** The page says no provider call or model quota is used. |
| “The check passed” | Allowed only with the label “recorded sample”; the live session is shown as `NOT_RUN`. |
| “This is the visitor's repository” | **Prohibited.** The workspace is `demo://driftwatch`. |
| “This is a submitted hackathon entry” | **Prohibited.** The Witness readiness statement says it is not a submission. |
| “Reset is safe for live state” | Allowed with the exact scope: reset changes only the sample. |

Every simulated operation, evidence row, diff, and finding carries a visible `Sample data` chip or a recorded-sample source label. Activity & results receives the same operation/evidence/capability shapes as the live workshop. Provenance, fixture version, technical caveats, and the evidence inspector sit under `<details>` so the main story stays plain-language.

## Evidence boundary

- The fixture, reset isolation, schema drift, 90-second timing, tab inspection, no-network behavior, and canonical landing/demo consistency are covered by `tests/demo.test.ts`, `tests/web.test.ts`, and `tests/visual/`.
- The hosted sample was smoke-tested locally: fixture project, no session token, `DEMO_READ_ONLY` mutation, no engine, and a rendered `/demo`.
- The last real native inference recorded in this repository remains the Experience-phase umbrella-relay run, which produced a real Maker diff and a failing `node --test`; Witness recorded the failure. Phase 9 did not repeat live inference. Phase 6 changed the public sample scenario but did not use a live provider call.
- No video file, public hosted URL, published article, or submission receipt exists. Do not claim one.

## Exact claims

Approved:

- “The guided sample is a recorded fixture.”
- “OpenCode supplies the agent loop, model access, native tools, permissions, and sessions.”
- “Unfinished Business adds the four-stage workshop, exact-version approvals, dependency invalidation, and an evidence ledger.”
- “The sample shows the same Activity & results contract used by the live workshop.”
- “The recorded check passes; the live native session is not run.”
- “Reset affects only the sample.”
- “Run locally with OpenCode for a real native session.”
- “The hosted sample is read-only and has no repository, provider key, or user-specific storage.”

Not approved:

- “Live inference” or “real OpenCode run” around the recorded sample.
- “Reads your repository from the hosted page.”
- “Guaranteed working build.”
- “Autonomous end-to-end submission.”
- Any testimonial, user count, award, sponsor endorsement, performance metric, deployment result, or competition result that has not been observed.

## 90-second presentation path

The presentation mode is 10 beats × 9 seconds. A recording can follow this beat map:

| Time | Beat | What to show |
|---|---|---|
| 0–9s | Problem | The abandoned Driftwatch CLI and the untrustworthy stale-issue report |
| 9–18s | Oracle | Clarification, open questions, explicit product approval |
| 18–27s | Architect | One section drafted; revision makes the old approval stale |
| 27–36s | Approval | Exact-version approval and the eight-section plan |
| 36–45s | Scope | Separate Maker authorization; permission boundary |
| 45–54s | Run | Maker progress: queued → running → succeeded (recorded replay) |
| 54–63s | Diff | Representative diff with the source label visible |
| 63–72s | Check | Recorded `node --test` output and the `NOT_RUN` live session |
| 72–81s | Witness | Pass, limitations, readiness, and next actions |
| 81–90s | Next step | Clean exit to local setup or live OpenCode |

Narration should name the four spirits, explain that the run is a recorded sample, and end with “run locally with OpenCode for a native session.”

## Screenshots and video beats

Canonical Playwright captures:

| File | Shows |
|---|---|
| `tests/visual/snapshots/demo-guided-wide.png` | Wide guided sample: intro, sample details, playback controls |
| `tests/visual/snapshots/demo-guided-narrow.png` | 390px guided sample without horizontal overflow |
| `tests/visual/snapshots/demo-presentation-wide.png` | 90-second presentation mode |
| `tests/visual/snapshots/run-inspector.png` | Activity & results at the check beat, including sample PASS and live `NOT_RUN` (filename retained for history) |
| `tests/visual/snapshots/recovery-unknown.png` | Unknown native run and reconcile action |
| `tests/visual/snapshots/landing-wide.png` | Rewritten landing page with one primary CTA and the bespoke hero |
| `tests/visual/snapshots/landing-narrow.png` | Narrow landing page |
| `tests/visual/snapshots/workshop-wide.png` | Live workshop structure |
| `tests/visual/snapshots/onboarding-wide.png` | OpenCode connection/discovery |
| `tests/visual/snapshots/spirit-*.png` | Character states |

Video rules:

- Keep the recorded-sample label and `NOT_RUN` visible when showing evidence.
- Do not speed-edit the sample into a live run.
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

## Release copy and assets

The reviewed pitch, short/long descriptions, demo script, claim checklist, limitations, and canonical asset manifest are in [release/HACKATHON_COPY.md](release/HACKATHON_COPY.md). They are prepared in the repository only. No article, video, hosted submission, or external publication has been performed.

## Clean exit

The guided sample ends with two honest exits:

- **Run locally** → `/workshop`, which shows the real connection/discovery flow.
- **Local setup** → `/#local-setup`, which links to the tested commands in `docs/LOCAL_SETUP.md`.

The hosted sample also rejects mutation routes, so “Run locally” is an explicit path to a local or private deployment rather than an implied capability of the public sample.
