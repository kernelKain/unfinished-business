# Demo and submission guidance

**Status:** Phase 4 visual capture guidance. Independent acceptance, final video, article, and submission packaging remain separate work.
**Last updated:** 2026-10-31.

## Two different demos

| Demo | What it is | What it proves |
|---|---|---|
| Deterministic walkthrough (`/demo`) | Scripted fixture data with explicit labels | Interface states, approval language, evidence wording, recovery states |
| Real workshop run (`/workshop`) | The four-stage workflow connected to a local OpenCode server | Actual native sessions, observed tool results, real failures and success |

Never present the deterministic walkthrough as live inference. Never use a fixture screenshot to claim a real build passed.

## Approved visual captures

The Playwright visual suite is the canonical source of approved screenshots. All captures use:

- dark color scheme;
- `prefers-reduced-motion: reduce`;
- device scale factor 1;
- 1440 × 1000 wide viewport or 390 × 844 narrow viewport;
- stable fixture/empty state, so no model call is required.

The UI intentionally uses system font stacks, so baselines are tied to the verified Linux/Chromium font environment. Regenerate snapshots on the same image after a deliberate typography or layout change. Files live in `tests/visual/snapshots/`:

| File | Shows | Use |
|---|---|---|
| `landing-wide.png` | Hero, primary CTAs, engine positioning | README / submission overview |
| `landing-narrow.png` | Mobile hero and stacked CTAs | Mobile proof |
| `workshop-wide.png` | Four-stage navigation, outline, Oracle empty state, Run Inspector empty | Product structure |
| `workshop-narrow.png` | Mobile workshop and scrollable stage strip | Responsive proof |
| `onboarding-wide.png` | First-run connection panel, server URL/password, diagnostics | OpenCode connection honesty and provider-key boundary |
| `spirit-oracle-*.png` | Oracle idle/listening/clarification | Character system |
| `spirit-architect-*.png` | Architect idle/drawing/approval | Character system |
| `spirit-maker-*.png` | Maker idle/building/permission/blocked/success | State-driven motion and failure handling |
| `spirit-witness-*.png` | Witness idle/scanning/evidence/warning/stamp | Character system |
| `run-inspector.png` | Fixture runs, failed evidence, permission boundary | Evidence honesty |
| `recovery-unknown.png` | Unknown native run and reconcile action | Recovery honesty |

The hero image is an original generated atmosphere asset. It is **not** evidence of a run, a model response, or a working build.

## Regenerating snapshots

```bash
npm run build
npm run test:visual
```

On the first run, or after a deliberate visual change:

```bash
npx playwright test --update-snapshots
```

Review every changed image before committing. A snapshot change is a UI decision, not an automatic approval.

The suite also checks:

- primary CTA destinations;
- truthful mode copy and absence of fabricated claims;
- first-run connection setup is reachable and keeps provider keys in OpenCode;
- keyboard focus order and a visible focus ring;
- dialog open/close and Escape;
- setup tabs with arrow-key navigation;
- 200% text zoom without horizontal overflow;
- 390px layouts without horizontal page overflow;
- reduced motion (`animation: none`);
- contrast ratios ≥4.5:1 for tested tokens.

## Capturing a real run for the final demo

Use a disposable data directory so the recording starts from a clean state:

```bash
UB_DATA_DIR=/tmp/unfinished-business-demo npm run dev
```

Keep OpenCode running in another terminal. Record only after the engine badge reports connected.

A credible sequence:

1. Show the landing page's two paths and the deterministic demo label.
2. Open the real workshop.
3. State an unfinished idea and show the Oracle proposal.
4. Approve the product explicitly.
5. Draft one Architect section, revise it, and approve the exact version.
6. Show a stale section after a change.
7. Grant a separate Maker scope and run a bounded edit.
8. Show the native session reference and the actual result.
9. Show a failing check or a failed run without hiding it.
10. Reconcile an unknown run if the recording has one.
11. Show the Witness review and the evidence ledger.
12. End on the limitation: drafts are not a submitted article, and the demo does not claim remote repository access.

Do not speed-edit a failure into a success. If the recorded run fails, say so and show the failure.

## Screenshot rules

- Keep the fixture/scripted label in frame when capturing `/demo`.
- Keep native session IDs or the evidence ledger visible when claiming a real run.
- Do not add fake dashboards, fake terminal output, or a fabricated “success” badge.
- Do not place text in generated images; all essential text must be real HTML.
- Do not crop the hero to imply a UI that is not present.
- Use the actual viewport; do not stretch narrow screenshots.

## Submission claims

Approved:

- “Four-stage workflow built around OpenCode.”
- “OpenCode supplies the agent loop, tools, permissions, and native sessions.”
- “The deterministic demo is a scripted fixture.”
- “Hosted/private instances use their own isolated workspace.”
- “Local mode runs on the builder's machine.”
- “Maker's edit in this release is bounded to an isolated demo workspace.”
- “A failed check remains failed.”

Not approved:

- “Reads your repository from the hosted page.”
- “Guaranteed working build.”
- “Autonomous end-to-end submission.”
- “Live inference” around the fixture.
- Testimonials, usage counts, awards, or organizer endorsements without actual evidence.

## Visual asset checklist before submission

- [ ] Hero contains no text, logos, or watermarks.
- [ ] Hero is served through AVIF/WebP with explicit dimensions.
- [ ] Character states match the workflow state table.
- [ ] Reduced-motion capture still shows every state.
- [ ] No screenshot crops out a fixture label or a failure.
- [ ] `npm run budget` passes.
- [ ] `npm test` and `npm run test:visual` pass.
- [ ] `docs/PRODUCT_BRIEF.md` claims match the recorded demo.
