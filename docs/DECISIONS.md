# Decision ledger

**Scope:** Product, interface, demo, hardening, release, and upgrade decisions.
**Owner:** Engineering.
**Last verified:** 2026-11-01.

| ID | Decision | Alternatives considered | Rationale | Consequence |
|---|---|---|---|---|
| D4-01 | Use the **Ghostlight Hacker Workshop** theme | Generic SaaS landing, bright productivity app, pure terminal | Fits the existing haunted-workshop product while keeping a readable contemporary interface | Deep navy foundation, amber work light, spectral blue accents, layered paper/blueprint/glass/terminal surfaces |
| D4-02 | Keep the landing page at `/` and the real workshop at `/workshop` | Replace the workshop with a landing page; use a hash route | A first-time visitor needs a product explanation; the workshop needs a stable direct URL | Three routes (`/`, `/demo`, `/workshop`) with SPA fallback |
| D4-03 | Add a separate deterministic demo at `/demo` | Put fixture controls inside the real workshop; use a video only | Keeps fixture data out of the live workflow and gives visual tests stable states | The demo is explicitly labeled; it never calls a model |
| D4-04 | Lazy-load the workshop and demo | One large bundle | Landing is the first visit; workshop-specific Motion/API code should not block it | Initial JS 193.8 KiB gzip; workshop chunk 54.9 KiB; demo 11.5 KiB |
| D4-05 | Do not add an animation framework | GSAP, Lottie, Rive, Three.js | Motion and CSS already cover entry, state, and transitions; measured need is low | No new runtime; animation stays small and state-bound |
| D4-06 | Draw the four spirits as original inline SVG | Generated character images; copied mascots | Crisp at every size, tiny, themeable, accessible, state-driven, and provably original | Characters are code in `SpiritCharacter.tsx`; every state is a class |
| D4-07 | Generate one original hero image with the authorized image tool | Pure CSS landscape; stock photo; no hero image | The prompt calls for a cinematic workshop with atmospheric depth and copy space; generation was authorized | Master + responsive AVIF/WebP/JPEG outputs, prompt/provenance documented; no text/logos/watermarks |
| D4-08 | Keep source masters out of the shipped bundle | Ship the master and resize in the browser | Avoids multi-hundred-KiB downloads and layout shift | `assets/source/` is separate from `public/assets/hero/`; explicit dimensions in `<picture>` |
| D4-09 | Use semantic stage navigation, not disabled buttons | Keep disabled tab buttons | Disabled buttons are skipped by keyboard focus and imply interactivity | `<nav><ol><li aria-current="step">` with mini spirits and state text |
| D4-10 | Use native `<dialog>` for setup help | Custom modal | Built-in focus trapping, Escape behavior, and backdrop semantics | Opening help never implies the engine is connected |
| D4-11 | Use tabbed setup commands with roving tabindex | Static code blocks | The landing must show several tested commands without a wall of code | Arrow/Home/End keyboard support and copy action |
| D4-12 | Keep workflow authorization semantics stable during the interface refactor | Refactor approvals while restyling | Approval/authority semantics are security-sensitive | Phase 4 did not change exact-version approvals, Maker scope, or native denial; Phase 8 later hardened the HTTP/token layer without weakening them |
| D4-13 | Make the deterministic demo read-only | Let visitors run fake actions | Fake actions would undermine the honesty claim | Fixture controls step through states; real actions live in `/workshop` |
| D4-14 | Commit Playwright visual snapshots | Manual screenshots only | The prompt requires visual snapshots and keyboard/contrast/reduced-motion checks | `npm run test:visual`; snapshots in `tests/visual/snapshots/` |
| D4-15 | Prefer system Chrome/Chromium for visual tests, with Playwright fallback | Require a fixed browser download | Works in the verified Linux environment without a second browser install | `PLAYWRIGHT_CHROMIUM_EXECUTABLE` is honored; otherwise Playwright's browser is used |
| D4-16 | Do not use fabricated social proof | Testimonials, counts, awards | The product has no measured users or endorsements | Landing copy states the absence of fabricated claims |
| D4-17 | Remove Node `--watch` from the default dev script | Keep watch and require `.env` | Pinned Node crashes watching a missing `.env`; default setup must work from a clean checkout | `npm run dev` is stable; `npm run dev:watch` is opt-in with `.env` |
| D4-18 | Keep the hero image decorative and put all meaning in HTML | Put product copy in the image | Accessibility, localization, and performance | Hero `<picture>` is `aria-hidden`; headings and CTAs are real text |
| D4-19 | Merge the first-run connection/discovery wizard into the workshop route | Keep the merged version's workshop at `/` and rebuild onboarding as a separate app | A visitor needs the landing page first, but the real workflow still needs a guided connection step | `/workshop` shows onboarding when OpenCode is reachable without a selected model; an unavailable engine keeps the workshop visible with a repair action |
| D4-20 | Discover models, providers, agents, and permissions instead of assuming a fixed model | Keep the old fixed DeepSeek assumption | The merged OpenCode integration correctly treats the catalog as server-owned and time-limited | A model must be reported by OpenCode; a disappeared model blocks a run; provider keys stay in OpenCode |
| D4-21 | Keep the advanced OpenCode panel collapsed behind `<details>` | Put all session/permission controls in the main four-stage layout | Model/session controls are power-user surfaces; the main workflow should stay readable | Advanced controls remain reachable but do not compete with the current stage |
| D4-22 | Preserve the remote onboarding commit and integrate it rather than overwrite it | Push the Phase 4 commit over the remote or discard onboarding | The remote work is user work and adds required connection functionality | Both histories preserved through integration; 111 tests pass in the Phase 9 candidate |

## Phase 7 — guided demo

| ID | Decision | Alternatives considered | Rationale | Consequence |
|---|---|---|---|---|
| D7-01 | Use a versioned browser-bundled fixture | Server endpoint; live model call; video only | Deterministic playback must work without network, provider, or credentials | `src/shared/demo.ts`; no `/api/` call from `/demo` |
| D7-02 | Extract browser-safe workflow schemas to `src/shared/workflow.ts` | Duplicate schemas in the demo | One production contract; drift fails a test | Server model re-exports the shared schemas; fixture is parsed by `projectSchema` |
| D7-03 | Use the Campus Umbrella Relay scenario | Invent a new sponsor product | It aligns with the existing campus lost-and-found fixture and needs no real campus data | Clear lost-and-found scenario; no fabricated sponsor/user/metric |
| D7-04 | Reuse `RunInspector`, `SpiritStageTabs`, `SpiritCharacter`, `StatusChip` | Build a parallel demo UI | The acceptance criterion is that live and demo runs share contracts | Demo is a guided use of the production surfaces |
| D7-05 | Use a pure playback reducer | Timer/state scattered in the component | Reset/pause/replay/route-refresh behavior must be testable and isolated | `src/web/demo/playback.ts`; unit tests cover transitions |
| D7-06 | Pause playback when a spirit tab is inspected | Keep playing under the user | Inspection should not move the content under the reader | Selecting a tab pauses; Play resumes |
| D7-07 | Make presentation mode 10 beats × 9 seconds | A separate video file | Exactly 90 seconds, deterministic, recordable, and no media dependency | `?presentation=1`; optional normal mode remains |
| D7-08 | Label the fixture PASS and the live session `NOT_RUN` | Show only a passing check | The demo must not imply live execution | Run Inspector shows both rows; source label stays visible |
| D7-09 | Reject every non-GET `/api/*` request in hosted-demo mode | Rely on disabled buttons | Server authority must not depend on the UI | `DEMO_READ_ONLY`; no session token; live store unchanged |
| D7-10 | Keep reset client-only | Add a reset API | Reset must never affect a live project or OpenCode session | Pure reducer; no `/api/` request |
| D7-11 | Add three distinct landing actions | One ambiguous “demo” CTA | Visitors and judges need to choose interactive, presentation, or live | Try the example, Watch the guided workflow, Run live with OpenCode |
| D7-12 | Keep the fixture source free of time/randomness/environment/network | Generate fixture at runtime | Deterministic playback and reproducible screenshots | Source scan test; fixed timestamps and content hashes |

## Phase 8 — security and recovery hardening

| ID | Decision | Alternatives considered | Rationale | Consequence |
|---|---|---|---|---|
| D8-01 | Use one canonical `UB_DEPLOYMENT_MODE` (`local`, `hosted-demo`, `private-hosted`) | Keep parallel `UB_MODE` values | Two mode dialects caused contradictory docs and startup behavior | Legacy alias accepted; `hosted-private` and `private-hosted` map to the same mode |
| D8-02 | Make hosted-demo public and read-only, not password-protected | Reuse the private Basic Auth path for the demo | The demo contains no user data, secret, engine, or mutation; requiring credentials would make the judge path worse | No token, no OpenCode, every non-GET `/api/*` → `DEMO_READ_ONLY` |
| D8-03 | Require session token on protected API reads as well as writes | Token only on mutations | State, connection, discovery, usage, and exports can contain project/native metadata | Browser client obtains the token once; manual API checks need the header |
| D8-04 | Reject paid or unpriced remote models at selection | Accept any discovered model and rely on cost afterward | The release promises no paid fallback | Superseded for new projects by U1-01; migrated projects retain this as the default policy |
| D8-05 | Keep async Maker runs with explicit UNKNOWN/WAITING_PERMISSION states | Revert to a synchronous blocking request | Long native work must not hold the HTTP request; restart/reconnect must be honest | `202` accepted; polling/SSE, cancel/reconcile; no automatic retry |
| D8-06 | Refuse to mark cancellation when native interruption fails | Mark CANCELLED anyway | Native effects may continue | Explicit `CANCEL_UNAVAILABLE`; reconcile instead |
| D8-07 | Use a lock, fsync, backups, quarantine, and state v2 | Single overwrite or reset-on-corrupt | Approvals and evidence must survive crashes | Recovery is visible; both-corrupt state refuses reset |
| D8-08 | Apply SSRF/workspace/origin/rate/size controls in one server pipeline | Rely on the browser or deployment proxy alone | Server authority must not depend on UI or platform assumptions | Deterministic security tests cover the pipeline |
| D8-09 | Keep Backboard unintegrated and unclaimed | Add a placeholder key/adapter for category optics | Installation alone is not meaningful use and no access exists | No Backboard category claim |

## Phase 9 — release gate

| ID | Decision | Alternatives considered | Rationale | Consequence |
|---|---|---|---|---|
| D9-01 | Integrate the guided-interface and hardening lines before verifying | Pick one line and document the other as future work | Each line contains a required MUST; dropping either breaks acceptance | One release candidate with both feature sets |
| D9-02 | Treat the public demo's no-auth behavior as canonical over the earlier hardening test | Keep the older "demo requires token/password" test | The final mode contract and product promise make the demo public/read-only | Test updated to assert private-hosted protection instead |
| D9-03 | Update async-run tests instead of reverting the async runner | Force synchronous behavior to satisfy older tests | Async queue/restart/reconnect is the implemented, safer UX | Tests poll persisted state; no retry/duplicate inference |
| D9-04 | Move superseded planning/setup docs to `docs/history/` with pointers | Leave conflicting root docs active | One canonical story is required | Canonical docs + archived provenance |
| D9-05 | Keep the four runtime prompts in `docs/prompts/` unchanged | Rename/archive them with the implementation docs | Loaders and runtime discovery must not be confused with phase history | Prompt filenames/loaders stay stable |
| D9-06 | Report the unresolved moderate audit advisory honestly | Force a breaking Sentry downgrade without verification | A forced major downgrade could break telemetry and source maps | Production audit at high level passes; advisory documented |
| D9-07 | Stop before deployment/publication/submission | Treat local verification as release authorization | External actions need separate scoped authority | Evidence and reviewable procedures only |

## Upgrade Phase 0 — product-upgrade preparation

| ID | Decision | Alternatives considered | Rationale | Consequence |
|---|---|---|---|---|
| U0-01 | Introduce schema v3 as an additive persisted contract | Mutate v2 in place; defer schema work until features ship | Later phases need stable fields without risking existing approvals/evidence | Explicit v1/v2 readers and one canonical v3 writer |
| U0-02 | Make migration deterministic and idempotent with a fixed missing-time sentinel | Fill missing legacy timestamps with migration time | Wall-clock defaults make repeat migration produce different state | `1970-01-01T00:00:00.000Z` marks an unavailable legacy timestamp honestly |
| U0-03 | Replace persisted `UNKNOWN` with `ABANDONED` and reserve `COMPLETED_UNAPPLIED` for late results | Keep `UNKNOWN`; treat any late success as applied | Unconfirmed outcome and observed-but-unapplied output are materially different | Existing unresolved operations keep native references and still block automatic replay |
| U0-04 | Store model-access and budget preferences without claiming new enforcement | Wire preferences directly into selection/execution in Phase 0 | This phase prepares contracts and must not change product behavior materially | Phase 0 did not enforce them; U1-01..U1-04 now wire access policy and optional limits into selection/execution |
| U0-05 | Keep provider/timing fixtures synthetic, declarative, and test-only | Capture provider responses or private model output | Future tests need repeatability without secrets, network, quota, or private output | Later phases can import one catalog for policy, timeout, permission, and reconciliation tests |

## Upgrade Phase 1 — model access and provider recovery

| ID | Decision | Alternatives considered | Rationale | Consequence |
|---|---|---|---|---|
| U1-01 | Default new projects to `ALL_ACCESSIBLE`; keep `FREE_OR_LOCAL_ONLY` as an explicit project policy | Keep the global free-only restriction; allow all with no policy control | The requested product behavior is to use whatever the connected account can access, while preserving an intentional safe mode | Any reported available model can be selected; free/local mode blocks paid/unknown remote models at selection and run time |
| U1-02 | Require an explicit first paid/unknown-price confirmation and persist its timestamp | Rely on the model list label; confirm on every request | A radio click or model label is not informed consent; repeating the prompt is noisy | `paidOrUnknownAcceptedAt` gates selection and the first request; the app never silently uses a paid route |
| U1-03 | Make spending limits optional and enforce the stricter of deployment/project values | Keep a hardcoded `$0`; rely only on the provider dashboard | A global zero limit blocks legitimate paid use; unlimited with no ceiling is unsafe | `UB_MAX_SESSION_COST_USD` and project `maxCostUsd` are optional; cost is checked against OpenCode's reported session value |
| U1-04 | Treat unknown price as confirmation-required, not as free | Assume zero cost; hide unpriced models | Missing price data is not evidence of zero cost | Unknown-price remote models require confirmation and a warning that cost may be reported only after a request |
| U1-05 | Classify provider failures into fixed safe categories with a redacted technical block | Pass provider messages through; concatenate generic error text | Users need actionable repairs without exposing secrets or private output | Eight categories, saved-work status, diagnostic reference, and a dedicated card; raw authorization/API-key/password/path data is redacted |
| U1-06 | Keep workspace privacy as intent, not an unverifiable guarantee | Claim the app enforces provider training terms | OpenCode does not expose every provider contract | UI copy states the limitation; provider rejections that mention training/data policy map to `PROVIDER_DATA_POLICY` and `review-privacy` |
| U1-07 | Migrate v3 with `requireFreeOrLocal` mapped to the new mode and zero cost to unlimited | Reset all preferences to the new default | Existing projects expected free/local behavior and a disabled/zero limit | v3 projects preserve their prior effective policy; new projects get the new default |

## Upgrade Phase 2 — observable, cancellable, recoverable runs

| ID | Decision | Alternatives considered | Rationale | Consequence |
|---|---|---|---|---|
| U2-01 | Consume the OpenCode event/session APIs, then choose safe polling for live progress | Subscribe to the SSE event stream (`client.event.subscribe`) inside the run coordinator | The installed client (`@opencode/client` 2.0.32) exposes a shared SSE stream plus `message.list`, `session.get`, `session.diff`, and permission endpoints; Unfinished Business routes every native call through a capped, policy-checked `fetch` (`maxResponseBytes`, timeouts, SSRF guards) that is built for bounded responses, not unbounded streams | Progress phases are observed via the same bounded APIs already used for runs; the SSE path is documented as the future upgrade, not silently used |
| U2-02 | Persist all four spirit runs as asynchronous operations; keep `question` synchronous | Make every `sendMessage` intent async; keep Oracle/Architect/Witness synchronous with cancel polling | Stage runs change saved state and need progress/recovery; a question changes nothing and answers directly, so its frozen-request risk is low | `clarify`/`draft`/`witness` and Maker return `202` with a queued operation; `question` remains a direct response, documented |
| U2-03 | Record a fixed phase vocabulary and never stream raw model text into it | Stream partial model output (labeled) into the document | Partial output invites pasting unvalidated text into approvals, and labels do not make raw streams safe to save | Phases are safe summaries only; partial output is never displayed, and sections are stored only from validated, complete replies |
| U2-04 | Recovery metadata per operation: intent, sectionId, startingRevision, idempotency key, expected output, retry lineage, progress | Recompute intent from the transcript; reconcile by hash only | Reconciliation must know exactly what to apply, to which section, against what expected output — without guessing from strings | `intent`, `sectionId`, `startingRevision`, `idempotencyKey`, `expectedOutput`, `retryOf`, and `progress` are persisted and migrate forward |
| U2-05 | Reconcile retrieves and validates the actual late response or diff, then applies at most once | Trust `session.outcome`/idle as success; keep the outcome-only reconcile of Phase 1 | An idle session is not a validated result; guide replies must re-parse against the same schemas and Maker diffs must be re-read and re-checked | `appliedAt` plus the idempotent action record makes repeated reconciliation inert; `COMPLETED_UNAPPLIED` is reachable when the result exists but is not yet readable |
| U2-06 | Restrict retry-after-failure to confirmed `FAILED` Maker runs; retries create a new operation with `retryOf` lineage | Retry ABANDONED runs; reuse the same operation id for retries | Retrying an uncertain run can duplicate a native edit that may still land; a new id keeps history intact, and only Maker runs persist a replayable scope | `POST /api/runs/:id/retry` refuses non-Maker, unresolved, and already-active runs; guide retries remain explicit new requests from the panel |
| U2-07 | Migration backfills migrated non-terminal operations with a deterministic `AWAITING_RECONCILIATION` marker | Leave progress empty for migrated rows | Old unknown operations must remain recoverable through migration, and the interface has to explain that honestly | v1/v2/v3/v4 sources migrate to v5 with the sentinel-stamped recovery marker; terminal rows keep no progress marker |
| U2-08 | Keep the Run Inspector's recovery controls out of the deterministic demo rendering | Show identical controls on the demo | The demo is a fixture with no live session; live elapsed timers in snapshot tests would make captures nondeterministic | Demo captures stay byte-stable; the workshop exposes Continue waiting / Reconcile now / Open in OpenCode / Cancel / Retry / Mark abandoned |

## Open follow-ups (post-release)

- A real recorded demo and final submission assets remain separate acceptance work.
- The free-model route remains account-dependent and time-limited.
- A public hosted URL is not asserted until a deployment is verified.
- Any future change to the asset budget or claims requires updating `docs/UX_AND_VISUAL_SYSTEM.md` and `docs/PRODUCT_BRIEF.md`.
