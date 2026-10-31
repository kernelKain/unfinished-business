# Decision ledger

**Scope:** Phase 4 interface, landing, visual system, motion, and spirit characters.
**Last updated:** 2026-10-31.

| ID | Decision | Alternatives considered | Rationale | Consequence |
|---|---|---|---|---|
| D4-01 | Use the **Ghostlight Hacker Workshop** theme | Generic SaaS landing, bright productivity app, pure terminal | Fits the existing haunted-workshop product while keeping a readable contemporary interface | Deep navy foundation, amber work light, spectral blue accents, layered paper/blueprint/glass/terminal surfaces |
| D4-02 | Keep the landing page at `/` and the real workshop at `/workshop` | Replace the workshop with a landing page; use a hash route | A first-time visitor needs a product explanation; the workshop needs a stable direct URL | Three routes (`/`, `/demo`, `/workshop`) with SPA fallback |
| D4-03 | Add a separate deterministic demo at `/demo` | Put fixture controls inside the real workshop; use a video only | Keeps fixture data out of the live workflow and gives visual tests stable states | The demo is explicitly labeled; it never calls a model |
| D4-04 | Lazy-load the workshop and demo | One large bundle | Landing is the first visit; workshop-specific Motion/API code should not block it | Initial JS 192.8 KiB gzip; workshop chunk 54.8 KiB; demo 2.6 KiB |
| D4-05 | Do not add an animation framework | GSAP, Lottie, Rive, Three.js | Motion and CSS already cover entry, state, and transitions; measured need is low | No new runtime; animation stays small and state-bound |
| D4-06 | Draw the four spirits as original inline SVG | Generated character images; copied mascots | Crisp at every size, tiny, themeable, accessible, state-driven, and provably original | Characters are code in `SpiritCharacter.tsx`; every state is a class |
| D4-07 | Generate one original hero image with the authorized image tool | Pure CSS landscape; stock photo; no hero image | The prompt calls for a cinematic workshop with atmospheric depth and copy space; generation was authorized | Master + responsive AVIF/WebP/JPEG outputs, prompt/provenance documented; no text/logos/watermarks |
| D4-08 | Keep source masters out of the shipped bundle | Ship the master and resize in the browser | Avoids multi-hundred-KiB downloads and layout shift | `assets/source/` is separate from `public/assets/hero/`; explicit dimensions in `<picture>` |
| D4-09 | Use semantic stage navigation, not disabled buttons | Keep disabled tab buttons | Disabled buttons are skipped by keyboard focus and imply interactivity | `<nav><ol><li aria-current="step">` with mini spirits and state text |
| D4-10 | Use native `<dialog>` for setup help | Custom modal | Built-in focus trapping, Escape behavior, and backdrop semantics | Opening help never implies the engine is connected |
| D4-11 | Use tabbed setup commands with roving tabindex | Static code blocks | The landing must show several tested commands without a wall of code | Arrow/Home/End keyboard support and copy action |
| D4-12 | Keep workflow authorization untouched | Refactor auth while restyling | Phase 3 semantics are working and security-sensitive | No changes to session-token checks, exact-version approvals, Maker scope, or native permission authority |
| D4-13 | Make the deterministic demo read-only | Let visitors run fake actions | Fake actions would undermine the honesty claim | Fixture controls step through states; real actions live in `/workshop` |
| D4-14 | Commit Playwright visual snapshots | Manual screenshots only | The prompt requires visual snapshots and keyboard/contrast/reduced-motion checks | `npm run test:visual`; snapshots in `tests/visual/snapshots/` |
| D4-15 | Prefer system Chrome/Chromium for visual tests, with Playwright fallback | Require a fixed browser download | Works in the verified Linux environment without a second browser install | `PLAYWRIGHT_CHROMIUM_EXECUTABLE` is honored; otherwise Playwright's browser is used |
| D4-16 | Do not use fabricated social proof | Testimonials, counts, awards | The product has no measured users or endorsements | Landing copy states the absence of fabricated claims |
| D4-17 | Remove Node `--watch` from the default dev script | Keep watch and require `.env` | Pinned Node crashes watching a missing `.env`; default setup must work from a clean checkout | `npm run dev` is stable; `npm run dev:watch` is opt-in with `.env` |
| D4-18 | Keep the hero image decorative and put all meaning in HTML | Put product copy in the image | Accessibility, localization, and performance | Hero `<picture>` is `aria-hidden`; headings and CTAs are real text |
| D4-19 | Merge the first-run connection/discovery wizard into the workshop route | Keep the merged version's workshop at `/` and rebuild onboarding as a separate app | A visitor needs the landing page first, but the real workflow still needs a guided connection step | `/workshop` shows onboarding when OpenCode is reachable without a selected model; an unavailable engine keeps the workshop visible with a repair action |
| D4-20 | Discover models, providers, agents, and permissions instead of assuming a fixed model | Keep the old fixed DeepSeek assumption | The merged OpenCode integration correctly treats the catalog as server-owned and time-limited | A model must be reported by OpenCode; a disappeared model blocks a run; provider keys stay in OpenCode |
| D4-21 | Keep the advanced OpenCode panel collapsed behind `<details>` | Put all session/permission controls in the main four-stage layout | Model/session controls are power-user surfaces; the main workflow should stay readable | Advanced controls remain reachable but do not compete with the current stage |
| D4-22 | Preserve the remote onboarding commit and integrate it rather than overwrite it | Push the Phase 4 commit over the remote or discard onboarding | The remote work is user work and adds required connection functionality | Rebase replay preserved both histories; 63 tests pass after integration |

## Open follow-ups (not Phase 5 work)

- A real recorded demo and final submission assets remain separate acceptance work.
- The free-model route remains account-dependent and time-limited.
- A public hosted URL is not asserted until a deployment is verified.
- Any future change to the asset budget or claims requires updating `docs/UX_AND_VISUAL_SYSTEM.md` and `docs/PRODUCT_BRIEF.md`.
