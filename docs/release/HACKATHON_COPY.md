# Hackathon and release copy

**Status:** Prepared in-repository. No external submission, publication, deployment, or video upload has been performed.
**Owner:** Engineering/release.
**Last verified:** 2026-11-01.

Use this copy only with the limitations below. Do not add testimonials, user counts, awards, benchmark numbers, or live-provider claims that are not in `docs/EVIDENCE.md`.

## One-line pitch

Unfinished Business is an OpenCode-powered workshop that helps a builder finish one stalled hackathon project through a clear plan, an approved build, and evidence they can defend.

## Short description (about 50 words)

Unfinished Business turns one unfinished idea into a reviewable plan, a bounded OpenCode build, and honest evidence. Four stages keep the human in charge: Oracle clarifies, Architect drafts, Maker edits an isolated workspace with explicit approval, and Witness reports what actually ran — including what did not.

## Longer description

Hackathon projects rarely fail at the idea. They fail at the gap between an appealing pitch and a build someone can verify.

Unfinished Business is a local-first workshop built around OpenCode. The Oracle asks a few focused questions and stores answers with provenance. The Architect drafts one section at a time against a content contract; revisions are previewed and accepted separately from approval. Maker runs only after every section and a separate scope statement are approved, and it edits an isolated demo workspace rather than an arbitrary repository. Witness reviews the observed diff and bounded Node check in a fresh session. The screen reports live progress, pending permissions, and recoverable failures without inventing a successful run.

The public `/demo` route is a recorded Driftwatch sample. It is labeled as recorded and makes no model or repository call. The live workshop uses the builder's own OpenCode 2.x server; provider keys never enter the browser or this application.

## Built with

- TypeScript, React 19, Vite 8, and Hono
- OpenCode 2.0.32 through `@opencode/client` and the cross-platform `@opencode/cli`
- Zod contracts, an atomic JSON project store, and a bounded Node test check
- Playwright for visual, responsive, keyboard, contrast, zoom, and offline checks
- Optional Sentry error/trace instrumentation with metadata-only redaction

## Demo script (90 seconds)

The full beat map is in [docs/DEMO_AND_SUBMISSION.md](../DEMO_AND_SUBMISSION.md).

1. Open `/` and state the problem: unfinished projects, not missing ideas.
2. Open `/demo` and label it as the recorded Driftwatch sample.
3. Step through Oracle clarification, Architect approval, Maker's bounded change, the recorded check, and Witness findings.
4. Point out that the live session remains `NOT_RUN`; the sample is not evidence of live inference.
5. Open `/workshop`, show source selection and the OpenCode connection panel, and stop before any claim that a live provider call occurred.
6. Close on the evidence view and the limitation statement.

## Claim checklist

| Claim | Evidence | Limit |
|---|---|---|
| Four-stage workflow with separate approvals | `tests/workflow.test.ts`, `tests/experience.test.ts`, `tests/journey.test.ts` | App approval is not tool permission |
| Reviewable Architect revisions | `tests/revisions.test.ts`, `tests/web.test.ts`, `tests/visual/snapshots/` | Markdown subset, not full CommonMark |
| Recoverable async runs | `tests/observable-runs.test.ts`, `tests/experience-hardening.test.ts`, `tests/journey.test.ts` | No automatic retry; reconciliation is explicit |
| OpenCode owns provider credentials | `docs/OPENCODE_INTEGRATION.md`, `tests/connection.test.ts`, `tests/web.test.ts` | Provider terms are not attested by the app |
| Linux and macOS support | CI runs `41252770576` and `41253037115`; `docs/LOCAL_SETUP.md` | Windows and Linux ARM64 unsupported |
| Recorded sample is not live proof | `src/shared/demo.ts`, `tests/demo.test.ts`, `tests/visual/demo.spec.ts` | Live native session remains `NOT_RUN` |

## Asset manifest

Canonical assets are committed; do not generate replacement screenshots for a submission without inspecting them.

| Asset | Path | Use |
|---|---|---|
| Wide landing capture | `tests/visual/snapshots/landing-wide.png` | README hero, project gallery |
| Tablet landing capture | `tests/visual/snapshots/landing-tablet.png` | Responsive proof |
| Narrow landing capture | `tests/visual/snapshots/landing-narrow.png` | Mobile proof |
| Wide workshop capture | `tests/visual/snapshots/workshop-wide.png` | Real workshop |
| Tablet onboarding capture | `tests/visual/snapshots/onboarding-tablet.png` | Setup/responsive proof |
| Guided sample wide | `tests/visual/snapshots/demo-guided-wide.png` | Recorded sample |
| Guided sample presentation | `tests/visual/snapshots/demo-presentation-wide.png` | 90-second path |
| Activity & results | `tests/visual/snapshots/run-inspector.png` | Recovery/evidence surface |
| Hero source master | `assets/source/hero-workshop-revival.webp` | Source provenance; not shipped |
| Responsive hero variants | `public/assets/hero/` | Shipped landing hero |

## Submission checklist

- [ ] Re-run `npm run typecheck`, `npm test`, `npm run build`, `npm run budget`, `npm run test:visual`, `npm run test:platform`, and `npm run smoke:opencode`.
- [ ] Re-read `docs/EVIDENCE.md` and remove any claim without current evidence.
- [ ] Record and review the demo; label the recorded sample and the missing live proof.
- [ ] Confirm the repository and any hosted URL are authorized for publication.
- [ ] Publish only with separate explicit authorization.
