# UX and visual system — Ghostlight Hacker Workshop

**Status:** Implemented release candidate; Upgrade Phase 6 rewrote the public landing page around one canonical sample, with a bespoke hero and a single primary CTA. Upgrade Phase 5 remains the focused-workshop layout.
**Owner:** Interface/UX.
**Last verified:** 2026-11-01.
**Source of truth:** `src/web/styles.css`, `src/web/spirits.ts`, `src/web/components/`, `src/web/content/landing.ts`, `src/web/demo/`.

## 1. Theme

The Ghostlight Hacker Workshop is a deep-navy night workshop lit by one amber work lamp and a spectral blue engine glow. Four friendly spirits occupy the bench:

- **Oracle** — lantern orb seer.
- **Architect** — spectral blueprint/compass spirit.
- **Maker** — friendly mechanical ghost with a tool belt.
- **Witness** — archival moth with a camera lens eye.

The theme is atmospheric, not decorative at the expense of clarity. Every surface is layered from a dark foundation: matte paper, blueprint lines, smoked glass, and terminal black. Depth comes from gradients, inset highlights, borders, and restrained shadows. There is no scroll hijacking, no continuous high-cost animation, and no essential information inside an image.

### Visual principles

1. **Readable first.** Body copy stays at AA contrast; amber is an accent, not a paragraph color.
2. **One obvious next action.** Each stage has a primary action and a visible stop condition.
3. **Show the boundary.** Permission, scope, failure, and empty states are designed surfaces, not error afterthoughts.
4. **Depth with restraint.** Small SVG characters and layered surfaces carry the theme; no WebGL or heavy 3D runtime.
5. **Honest artifacts.** A fixture is labeled a fixture. A failure is labeled a failure.

## 2. Design tokens

Tokens live in `:root` in `src/web/styles.css`.

### Color

| Token | Value | Use |
|---|---|---|
| `--ink-0` | `#05070d` | Page foundation |
| `--ink-1` | `#090d17` | Hero/panel base |
| `--ink-2` | `#0e1422` | Raised surface |
| `--ink-3` | `#141c2f` | Card surface |
| `--ink-4` | `#1b2540` | Highest neutral surface |
| `--paper` | `#f0ebe1` | Display headings, paper light |
| `--paper-soft` | `#ded7c9` | Secondary light text |
| `--amber` | `#f3b66d` | Primary action, lantern light |
| `--amber-bright` | `#ffd08a` | Action gradient top, focus |
| `--amber-ink` | `#24170a` | Text on amber actions |
| `--violet` | `#b9a4ff` | Eyebrows, Witness, spectral accent |
| `--spectral` | `#8ba4ff` | Blue engine light |
| `--cyan` | `#9fe7ff` | Architect, terminal accents |
| `--mint` | `#8fe3b8` | Success |
| `--rose` | `#ffb4a8` | Errors and blocked states |
| `--text` | `#f4f1e9` | Primary text |
| `--text-muted` | `#b8b3c7` | Body copy |
| `--text-dim` | `#8d88a0` | Metadata and captions |

### Surfaces and borders

| Token | Value/role |
|---|---|
| `--surface-1` | `rgb(14 20 34 / 82%)` glass panel |
| `--surface-2` | `rgb(20 28 47 / 78%)` raised glass |
| `--surface-3` | `rgb(27 37 64 / 72%)` selected surface |
| `--surface-paper` | `rgb(240 235 225 / 7%)` paper wash |
| `--surface-terminal` | `#070b12` command terminal |
| `--border` | `rgb(226 222 255 / 13%)` |
| `--border-strong` | `rgb(226 222 255 / 26%)` |
| `--border-amber` | `rgb(243 182 109 / 42%)` |
| `--border-violet` | `rgb(185 164 255 / 38%)` |

Layering order: page gradient → section glass → paper/blueprint inset → terminal block. Do not stack more than three translucent surfaces in one card.

### Typography

| Token | Stack/role |
|---|---|
| `--font-display` | `"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif` |
| `--font-ui` | `"Avenir Next", Avenir, "Segoe UI", Inter, system-ui, -apple-system, sans-serif` |
| `--font-mono` | `"SFMono-Regular", "Cascadia Code", "Roboto Mono", ui-monospace, monospace` |
| `--leading-tight` | `1.02` |
| `--leading-snug` | `1.2` |
| `--leading-body` | `1.65` |

- Display headings use the serif at weight 500 with balanced wrapping.
- UI labels use the sans stack at 600–700.
- Status, state, command, and metadata text use mono, uppercase, with letter spacing.
- No web font is downloaded. System fallbacks keep first paint fast and privacy-preserving.

### Spacing, radius, elevation

| Group | Values |
|---|---|
| Spacing | `0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6rem` (`--space-1` … `--space-9`) |
| Radius | `6, 10, 16, 24, 32px`, pill `999px` |
| Shadow 1 | inset top highlight + `0 8px 24px rgb(0 0 0 / 18%)` |
| Shadow 2 | inset top highlight + `0 18px 48px rgb(0 0 0 / 32%)` |
| Shadow 3 | inset top highlight + `0 32px 90px rgb(0 0 0 / 45%)` |
| Glow | amber `0 0 40px rgb(243 182 109 / 18%)`; violet `0 0 44px rgb(139 164 255 / 18%)` |

### Motion

| Token | Value |
|---|---|
| `--dur-instant` | `80ms` |
| `--dur-fast` | `140ms` |
| `--dur-base` | `240ms` |
| `--dur-slow` | `520ms` |
| `--ease-standard` | `cubic-bezier(0.2, 0.7, 0.2, 1)` |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` |

### Status

| Tone | Token | Usage |
|---|---|---|
| Positive | `--status-positive` `#8fe3b8` | PASS, SUCCEEDED, APPROVED, GRANTED |
| Active | `--status-active` `#9fe7ff` | RUNNING, QUEUED, DRAFT, DRAWING |
| Warning | `--status-warning` `#ffd08a` | WAITING_PERMISSION, COMPLETED_UNAPPLIED, ABANDONED, NOT_RUN, INCONCLUSIVE, STALE |
| Danger | `--status-danger` `#ffb4a8` | FAIL, FAILED, BLOCKED, CANCELLED |
| Neutral | `--status-neutral` `#b8b3c7` | NOT_STARTED, NONE, CANCELLED |

Status chips include a dot and text; color is never the only signal. `.status-chip[data-tone]` maps the tone.

## 3. Component rules

### Site header

- Sticky, blurred near-black bar with the brand, section anchors, a connect action, and a quiet Run locally link.
- Under 720px: navigation and the connect action collapse; the brand name and Run locally link wrap instead of overflowing.
- The page-level primary CTA lives in the hero, not in the header. Never hide the only path to the workshop behind hover.

### Hero

- 21:9 cinematic four-spirit image with a dark left-to-right and bottom-up veil; copy in the left third.
- `<picture>` serves AVIF, WebP, and a JPEG fallback; mobile gets a 3:4 portrait crop around the Architect, Maker, project, and Witness.
- Explicit `width="1920" height="823"` on the fallback image prevents layout shift.
- The hero image is decorative (`aria-hidden` on the `<picture>`); its description is preserved in `heroAlt` for catalog and fallback use. All essential meaning is in text.
- Display type is capped below the previous oversized scale; the four hero facts are user outcomes, not technical facts.

### Ways to run

- Two compact paths on wide screens; one per row on mobile.
- Each path states what it **is** and what it **is not**.
- Do not place a “live” badge on the recorded sample.

### Spirit cards

- Four columns wide, two at tablet, one on mobile.
- Art panel, form label, name, role, summary, boundary note, and state pills.
- Each spirit has its own accent token (amber, cyan, mint, violet).
- Cards remain readable without animation.

### Stage tabs

- A semantic `<nav aria-label="Four-stage workflow">` containing an ordered list.
- The workshop uses non-interactive stage items: they do not pretend to be clickable tabs. `aria-current="step"` marks the current stage.
- The guided sample passes `onSelect`, so each stage is a real button labeled “Inspect Oracle/Architect/Maker/Witness”. Selecting a tab pauses playback and shows that spirit's sample workspace. `aria-current="step"` still marks the inspected stage.
- Each item includes a mini spirit, stage number, name, state text, and a visually hidden “Stage X of 4”.
- Horizontal scroll on narrow screens; never truncate the current stage text.

### Guided sample

- The sample is a guided story, not a separate interface. It reuses `RunInspector` (rendered as Activity & results), `SpiritCharacter`, `SpiritStageTabs`, `StatusChip`, and the production workflow shapes.
- The layout is: intro/honesty panel → playback controls → four-spirit tabs → guided beat + spirit workspace → Activity & results → representative diff/check → Witness findings → character gallery/recovery → clean exit.
- Every recorded sample operation, evidence row, diff, and finding carries a `Sample data` chip or a `Recorded sample` source label.
- Playback controls are Play/Pause, Previous, Next, Replay, Reset, and 90s mode. Reset returns to beat 1, paused, and clears inspection; it never calls an API.
- Tabs are available during playback. Inspecting a tab pauses auto-advance and shows “Playback paused so you can inspect …”. Resume with Play.
- Presentation mode (`?presentation=1`) uses 10 beats × 9 seconds = 90 seconds, hides the intro/gallery/recovery, and keeps the diff, check, and Witness sections visible. It is optional; normal interactive use remains available.
- Narrow layout stacks the beat card, workspace, evidence, and Witness panels. The diff and check output scroll inside their own containers; long fingerprints wrap.
- Reduced motion disables character animation but keeps every state visible. The playback timer is independent of animation.

### Section cards

- Outline items show order, title, status chip, version, and a “Current” flag.
- Stale sections use a dashed violet border plus text.
- Current section uses an amber border; do not rely on the border alone.

### Focused workshop layout

- One centered main task at a time. The stage panel owns the primary action; approval is primary only when a current draft can be approved, otherwise drafting is primary.
- A compact header shows the connection state and selected model. “Model & connection” opens the model panel without loading session diagnostics.
- The project outline is a native `<details>` drawer with the approval progress and selectable section cards. It opens without hiding the main task.
- Project memory is a native `<details>` drawer. It is open when memory exists and collapsed when empty.
- Activity & results is a native `<details>` drawer that is absent until an operation or check exists. It opens automatically for an active or abandoned run.
- Mobile and tablet keep the same reading order; drawers become full-width disclosures. No horizontal overflow at 390px, 768px, or 200% text zoom. At 768px the header hides low-priority links and the model label, keeps the brand on one line, and preserves the engine/model controls.
- Loading, API-loss, empty, permission, and provider-error states are explicit. An API loss shows a stable connection-loss alert and a reload action, not a raw fetch string.
- Stage changes move focus to the main task. A polite live region announces busy, permission, and run state without duplicating every timer tick.
- Drawer summaries are keyboard-operable and have visible focus. No hover-only or color-only state.

### Project memory

- Groups: decisions, user answers, assumptions, constraints, and unresolved questions.
- Each group shows the active entries and a `Correct` action. Corrections prefill the editor and name the superseded entry.
- The editor can add a decision, answer, assumption, or constraint. Saving calls `POST /api/memory`; it never changes an approval, section draft, Maker scope, or native run.
- A corrected entry is kept with `status: SUPERSEDED`; the new entry links back through `supersedesId`.
- Raw transcript excerpts are not part of Project memory; they live in Advanced diagnostics.

### Activity & results

- Replaces the former Run Inspector. It is read-only.
- **Progress** shows the latest run, status, phase, elapsed time, and the recovery controls (Continue waiting, Reconcile now, Open in OpenCode, Cancel, Retry after failure, Mark abandoned).
- **Changes** shows only observed Maker results. A missing diff is not a successful build.
- **Checks** shows observed evidence and limitations. Empty states say “No native run yet” and “No check observed”; they never show green.
- **Technical details** is collapsed and contains native session/message IDs, capability mappings, raw evidence references/fingerprints, and provider error payloads.
- Unknown runs show a reconcile action, not an automatic retry.
- Permission footnote: “Workflow approval is not tool permission.”

### OpenCode controls

- **Model & connection**: connection summary, model policy, model/variant selection, cost confirmation, and privacy warning.
- **Contextual permission request**: rendered outside collapsed details as a role-alert panel whenever a request is pending. It offers Allow once, Always, and Reject, and never auto-approves.
- **Advanced diagnostics**: collapsed and loaded only when opened. It contains agents, discovered capabilities, commands, skills, MCP, formatters/LSP, usage, project sessions, low-level revert, export, and the raw transcript.
- The normal workshop flow never shows session IDs, revert controls, export controls, or raw transcripts.

### Dialogs

- Native `<dialog>` with `showModal()`; Escape closes; click on the backdrop closes.
- Focus is trapped by the browser dialog, and the close control is first in reading order.
- Content is instructions only; opening the dialog never claims the engine is connected.

### Errors and warnings

- `.error-panel` for engine unreachable or failed actions; `.warning-panel` for stale or uncertain state.
- `.provider-error-card` for structured provider failures. It shows an eyebrow category, what happened, saved-work status, recommended repair, a retry/change-model or review-settings action, and a `<details>` technical disclosure.
- Technical disclosure is limited to provider, status code, provider code, project-owned session reference, diagnostic reference, and a redacted safe detail. Secrets, authorization headers, cookies, and local paths never render.
- Role `status`, `alert`, or equivalent live semantics depending on urgency.
- Include the recovery action and state that nothing was overwritten or repeated when true. Dismissing the card leaves the operation in Activity & results.

### Empty states

- Dashed border, small glyph, plain title, and an explanation of why empty is correct.
- No illustration that implies content exists.

### Setup panels

- Tabbed commands with roving tabindex, Arrow/Home/End keyboard support, `aria-selected`, and `aria-controls`.
- Commands are sourced from `docs/LOCAL_SETUP.md` and the repository scripts.
- Copy button uses the clipboard and provides a visible confirmation.
- Active tab is indicated by border, background, and color, not color alone.

### First-run connection and model panel

- A two-phase wizard: server check, then model/variant selection.
- Status copy is derived from `ConnectionStatus`, not optimistic labels. Every failure includes a diagnostic and a repair action.
- The server URL and password fields are clearly separated from provider credentials. The panel never asks for a provider API key.
- Model options show the provider/model key, provider, local/remote locality, free/paid/unknown pricing, context/input/output limits, modalities, tool support, a route-specific privacy warning, and only the variants OpenCode reports.
- Model access is an explicit choice between **All accessible models** (default for new projects) and **Free and local only**. The workspace privacy preference and optional positive USD spending limit sit beside it; unlimited/disabled is explained.
- A paid or unknown-price remote model requires a checked confirmation before the first request. The confirmation is not inferred from a radio selection.
- The panel never auto-selects a fixed model. If the catalog changes, the run is blocked until a reported model is selected; the app never substitutes one.
- In `private-hosted` or `hosted-demo`, configuration is read-only and the panel explains that the deployment manages the connection.
- Visual treatment: onboarding card on the Ghostlight surface, amber current step, mint completed step, status chips with text.

### Advanced OpenCode panel

- A native `<details>` control, collapsed by default, so it does not compete with the four-stage workflow.
- Shows connection state, base URL, version, diagnostics, model access/privacy/spending policy, model selection, role mapping, agents, pending permissions, project-owned sessions, usage, and revert controls.
- Buttons are explicit (`Allow once`, `Always`, `Reject`, `Interrupt`, `Fork`, `Compact`, `Stage revert`, `Clear`, `Commit`); nothing auto-approves.
- The panel does not enumerate arbitrary sessions. It only exposes sessions referenced by the project.
- Empty or unsupported values say “not reported” rather than inventing a number.

## 4. Character states

Characters are original inline SVG (`src/web/components/SpiritCharacter.tsx`). They are code, not generated images, so they stay crisp, tiny, accessible, and state-driven.

| Spirit | State | Visual | Workflow trigger |
|---|---|---|---|
| Oracle | `idle` | Dim lantern, folded rings | No proposal yet |
| Oracle | `listening` | Rings shimmer, halo breathes | Idea is being read |
| Oracle | `clarification` | Three open question motes | Proposal exists with open questions |
| Architect | `idle` | Compass at rest | Waiting for the next section |
| Architect | `drawing` | Drafting arm moves, blueprint sheet lifts | Section draft or stale review |
| Architect | `approval` | Seal star glows | Exact version approved |
| Maker | `idle` | Tool belt clipped, visor low | No run yet |
| Maker | `building` | Sparks and tapping arm | QUEUED/RUNNING |
| Maker | `permission` | Raised hand + amber keyhole | WAITING_PERMISSION, COMPLETED_UNAPPLIED, or ABANDONED |
| Maker | `blocked` | Rose shield with slash | FAILED/CANCELLED/refused |
| Maker | `success` | Mint ring and check | SUCCEEDED |
| Witness | `idle` | Folded wings | No review yet |
| Witness | `scanning` | Lens scan line | Review in progress |
| Witness | `evidence` | Document impression | Drafts/evidence recorded |
| Witness | `warning` | Amber triangle pulse | FAIL/INCONCLUSIVE evidence |
| Witness | `stamp` | Stamp thump | Review filed (not published) |

The state classes also drive the workshop header character: Oracle listening/clarifying, Architect drawing/approval, Maker permission/blocked/success, Witness scanning/evidence/warning.

## 5. Motion rules

- Idle character float: 7s, 3px translate, small SVG only.
- Working states: ripple, draw, spark, scan, warning pulse, stamp thump. Each is state-bound and small.
- Entry: one-time opacity/scale on approval seals via Motion.
- UI transitions: 140–240ms for color, border, and transform.
- No autoplay carousel, scroll hijack, parallax on large images, or infinite full-page animation.
- `prefers-reduced-motion: reduce` disables all CSS animations (`animation: none !important`) and reduces transitions to effectively instant. State groups still render because visibility is class-based, not animation-dependent.
- Hover is never required for information or action.

## 6. Accessibility

- Semantic landmarks (`header`, `nav`, `main`, `footer`), one `h1` per route.
- Skip link is the first focusable element on each route.
- Visible 3px amber focus ring with a soft halo.
- Minimum 44px targets for actions, tabs, stage rows, and sample controls.
- Tabs use roving tabindex and full arrow-key support.
- Stage strip is a list; the sample's inspectable stages are real buttons with visible focus rings.
- Playback status is announced through `role="status"` / `aria-live="polite"`; progress uses `role="progressbar"` with a beat value.
- Status chips pair color with text.
- Character SVGs are decorative by default; labelled instances expose `role="img"` and `<title>`.
- No essential information in the hero image.
- Text zoom to 200% keeps the landing, workshop, and sample usable; flex/grid children have `min-width: 0`, and long labels wrap.
- Long provider/model identities truncate with an ellipsis, and long unbroken generated Markdown wraps without widening the document.
- Contrast checks cover body, muted body, amber action text, warning/danger/positive/active status text, dim text, and the focus accent; the Playwright suite enforces ≥4.5:1 for the tested token pairs.
- Revision review is a keyboard-operable ARIA tab panel (Arrow/Home/End, roving tabindex, `aria-controls`, labelled `tabpanel`). Live run progress is a polite status region.
- `prefers-contrast: more` increases border contrast and widths.
- `forced-colors: active` adds system borders and disables the grain overlay.
- Reduced-motion and low-bandwidth fallbacks are complete: AVIF → WebP → JPEG, no animation dependency, no font dependency.

## 7. Hero asset: prompt, provenance, crops

### Master

- File: `assets/source/hero-workshop-revival.webp`
- Dimensions: **1512 × 648** (exactly 21:9)
- Size: 264 KiB
- Generated: 2026-11-01 with the environment's authorized image-generation tool, model `openrouter/sourceful/riverflow-v2.6-pro`.
- Output is an original project asset used under the repository's MIT license. It does not intentionally depict a third-party protected character, logo, or trademark. The source prompt explicitly excluded text, logos, watermarks, and UI panels. The laptop contains abstract geometric shapes only.
- Master files live outside `public/` and are not shipped.

### Prompt

> Wide cinematic 21:9 illustration for a dark, warm hacker workshop at night. A half-finished open-source software project sits on a wooden workbench: an old laptop showing abstract code, a taped paper plan, a small cardboard box of parts, and a half-built mechanical creature. Four small, distinct, friendly ghost-spirits gather around the bench: a lantern-orb seer with soft rings (Oracle), a blueprint-compass spirit holding parchment (Architect), a tiny mechanical ghost with a tool belt and goggles (Maker), and a pale archival moth with a single lens eye (Witness). Left third of the frame is deliberately dark and uncluttered for text overlay. Painterly editorial illustration, deep indigo and near-black background, warm amber work-lamp light, restrained spectral cyan and violet accents, subtle grain, no glossy sci-fi, no neon excess. No text, no letters, no logos, no user interface, no watermark, no mockup. Coherent composition, readable silhouettes, gentle hopeful mood about reviving abandoned work.

### Derived outputs

Built by `scripts/build-hero-assets.py` (`npm run assets:hero`) into `public/assets/hero/`:

| Name | Dimensions | Formats | Typical use |
|---|---|---|---|
| `hero-ghostlight-wide-1920` | 1920 × 823 | AVIF, WebP | Wide hero ≥1280px |
| `hero-ghostlight-wide-1280` | 1280 × 549 | AVIF, WebP, JPEG | Default wide |
| `hero-ghostlight-wide-768` | 768 × 329 | AVIF, WebP, JPEG | Small landscape/fallback |
| `hero-ghostlight-portrait-900` | 900 × 1200 | AVIF, WebP | Mobile 3:4 crop |
| `hero-ghostlight-portrait-600` | 600 × 800 | AVIF, WebP | Narrow mobile |

The portrait crop focuses on the blueprint spirit, the mechanical Maker, the project on the bench, and the archival moth; it is generated from the master, not a separate scene. The `<picture>` element selects the mobile portrait below 720px. The fallback `<img>` carries explicit `1920 × 823` dimensions; CSS aspect ratios prevent layout shift for the portrait source.

### Character provenance

All four characters are hand-authored SVG in this repository. They are not generated, traced, or derived from protected characters. Their state vocabulary is defined in `src/web/spirits.ts` and shared with the sample gallery.

## 8. Performance budget

### Budget

| Metric | Budget | Measured (2026-11-01) | Status |
|---|---|---|---|
| Initial JS (gzip) | ≤ 220 KiB | 201.5 KiB | PASS |
| All JS chunks (gzip) | ≤ 290 KiB | 280.4 KiB | PASS |
| CSS (gzip) | ≤ 18 KiB | 17.0 KiB | PASS |
| All hero variants (total) | ≤ 640 KiB | 581.2 KiB | PASS |
| Largest single hero file | ≤ 190 KiB | 87.8 KiB | PASS |

The all-JS budget remains 290 KiB after Upgrade Phase 6 replaced the static recommendation block and hero with the canonical sample and a new image. CSS remains within the 18 KiB budget raised in Phase 4 for the safe Markdown typography, diff review, and audit-history surfaces. Any increase is recorded here rather than silently accepted.

The initial route is the landing page. Workshop and sample are lazy-loaded (69.4 KiB and 5.6 KiB gzip, plus 3.5 KiB shared stage tabs). The canonical fixture is shared by the eager landing chunk and the lazy sample chunk; the sample chunk adds the playback reducer and guided UI. This raises initial JS to 201.5 KiB while keeping all-JS at 280.4 KiB. The workshop chunk includes the connection/discovery wizard, project memory, Activity & results, and lazy Advanced diagnostics. The hero transfers **15.6–56.3 KiB** as AVIF on a typical wide viewport and **32.8–52.4 KiB** as AVIF on mobile depending on pixel density; the total covers all breakpoints and formats, not one visit.

### Rules

- Run `npm run build && npm run budget` after changing assets or routes.
- Update this table deliberately if a budget changes; do not silently raise it.
- Source masters and test snapshots are excluded from the production bundle.
- No animation may run continuously on the whole page; motion is limited to small SVGs and short UI transitions.
- Do not add a second animation framework. Motion and CSS are sufficient.

### Verification commands

```bash
npm run typecheck
npm test
npm run build
npm run budget
npm run test:visual
```

`npm run test:visual` requires a Chromium browser. It prefers `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, then a system Chrome/Chromium, then Playwright's installed browser. Snapshots live in `tests/visual/snapshots/`.

## 9. Phase 9 release copy and boundary states

- Local mode copy says Maker edits the isolated demo workspace, not an arbitrary repository. The mode descriptor no longer claims workspace selection.
- Hosted-sample copy says there is no OpenCode, provider, session token, visitor persistence, or repository. `/workshop` is a read-only notice with exits to `/demo` and local setup.
- Private-hosted copy says the URL, password, and secrets are environment-managed; the browser cannot edit them.
- API copy distinguishes invalid session token, invalid origin, rate limit, concurrent mutation, request too large, stale revision, unknown native outcome, pending permission, and corrupt/busy state.
- There is no landing-page recommender in this release. The static recommendation table was removed in Upgrade Phase 6; a future recommender must be capability-driven, cite source freshness, and never imply an install, paid model, arbitrary shell, or approval.
- Evidence and Activity & results labels keep fixture results separate from live `NOT_RUN`/native results. No color or animation is the only status signal.
- The final accessibility matrix covers keyboard focus, dialog Escape/focus return, setup-tab and revision-tab arrow keys, live progress, 200% text zoom, 390/768/1440 layouts, overflow, reduced motion, contrast, long content, loading/offline states, and relevant screen-reader/live-region semantics.
