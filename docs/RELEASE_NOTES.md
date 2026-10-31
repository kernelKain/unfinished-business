# Release notes — Unfinished Business release candidate

**Date:** 2026-11-01
**Status:** Upgrade Phase 6 implemented; deployment, publication, and submission remain outside this phase.

## What changed

### Upgrade Phase 6 — canonical sample and rewritten landing page

- The public story now uses **one canonical sample**: Driftwatch, a small abandoned open-source issue-triage CLI. The same versioned fixture powers the guided sample, landing preview, evidence view, screenshots, and evidence examples.
- Removed the separate landing operation/evidence exports that reported a contradictory `FAIL`. The recorded check is `PASS`; the live native session remains `NOT_RUN` on both pages.
- The sample now tells one coherent story: a maintainer finds an abandoned CLI, the Oracle scopes the smallest useful fix, the Architect approves eight sections, Maker makes one bounded change, a recorded Node check passes, and Witness separates the result from the missing live proof.
- Rewrote technical sample copy in plain language. A concise “recorded sample” label stays visible; provenance, fixture version, technical caveats, and the evidence inspector moved under `<details>`.
- Rebuilt the landing page around **hero → four-stage workflow → sample project → why OpenCode → local setup and privacy → FAQ/final CTA**.
- **Try the example** is the single primary CTA. **Run locally** is the secondary action. The duplicate “Watch the guided workflow” landing action is gone; the 90-second path remains inside `/demo`.
- Replaced technical hero facts with user outcomes: **Clarify the idea**, **Approve the plan**, **Build with OpenCode**, **Verify the result**.
- Rewrote “OpenCode is the engine” as **“OpenCode does the coding. This workshop does the deciding.”** with concrete approval, plan, evidence, and permission boundaries.
- Renamed hosted demo/full local labels to **hosted sample** and **local workshop**, and renamed the deterministic walkthrough to the **guided sample**.
- Removed the static idea-to-tool recommendation block; it was not interactive or capability-driven.
- Replaced the generic hero with a bespoke four-spirit abandoned-workshop illustration and responsive AVIF/WebP/JPEG variants.
- Reduced oversized typography, glass cards, pills, outlines, glows, and monospace labels on the landing page.
- Added fixture-consistency assertions and a browser-level landing/demo consistency test; refreshed the visual snapshots.
- No schema change or migration is required. Schema v7 and saved projects are unchanged.
- Verification passes: typecheck, **186 tests**, production build, all five bundle/asset budgets (initial JS 201.3 KiB, all JS 279.9 KiB, CSS 17.0 KiB, hero 581.2 KiB), and **20 visual/accessibility tests**.

Known limits: the sample is recorded and does not prove live inference, the visitor's repository, or a deployment; the hero remains a decorative image with all meaning in HTML; automated visual checks do not replace a full screen-reader audit.

### Upgrade Phase 5 — focused workshop and reorganized OpenCode controls

- The workshop now presents **one primary task at a time** in a centered working document. The project outline is a collapsible drawer; the permanent three-column rail and Session notes panel are gone.
- The header is a compact model/connection summary. Permission requests appear as a contextual alert outside collapsed controls, so they cannot be missed.
- **Run Inspector is now Activity & results**, organized into **Progress**, **Changes**, and **Checks**. It is omitted when no operation or check exists and opens automatically for an active or abandoned run.
- Native session/message IDs, capability mappings, raw evidence, and provider payloads moved under **Technical details**. Raw transcripts moved to **Advanced diagnostics**.
- **Project memory** replaces Session notes: decisions, user answers, assumptions, constraints, and unresolved questions are visible and editable. A correction appends a new entry and keeps the prior one as `SUPERSEDED`; it never changes an approval, draft, Maker scope, or native run. `POST /api/memory` provides the authenticated edit path.
- OpenCode controls are split into **Model & connection**, a **contextual permission request**, and **Advanced diagnostics**. Sessions, agents, commands, skills, MCP, LSP, formatters, low-level revert, export, and transcripts stay in Advanced diagnostics and load only when opened.
- The stage action is unambiguous: approval is primary only for a current draft; otherwise drafting or the stage's own action is primary.
- Drawers are native disclosures with keyboard and focus behavior; stage changes move focus to the main task; busy and permission state are announced through a polite live region; mobile and tablet layouts avoid horizontal overflow.
- Schema v7 is unchanged. The memory edit route uses the existing status/supersedesId fields, so no migration is required.
- Verification passes: typecheck, **184 tests**, production build, all five bundle/asset budgets (all-JS budget deliberately raised from 280 to 290 KiB), and **19 visual/accessibility tests**.

Known limits: permission polling is best-effort and can lag one refresh interval; Advanced diagnostics are unavailable while the engine is unreachable; automated accessibility checks do not replace a screen-reader audit.

### Upgrade Phase 4 — reviewable generated revisions

- Architect output is now a **proposed revision**, never an immediate overwrite. “Request changes” queues an Architect run; the current draft stays visible until the user accepts the candidate.
- Every Architect section has a **content contract**: required topics, detail guidance, dependencies, risk and decision requirements, acceptance criteria, and required headings. Validation is structural and topic-based, so padded word count alone cannot pass.
- The review surface shows the candidate summary, the requested change, the **complete revised Markdown**, and a **unified or side-by-side diff**. Wide screens default to side-by-side; narrow screens stack the two sides with labels.
- **Accept**, **Request another revision**, and **Discard** are explicit. A new request supersedes an earlier pending candidate; a candidate whose base version changed cannot be accepted.
- **Accepting is not approval.** Acceptance replaces the draft and marks the section `DRAFT`; the exact-version approval remains a separate action. Accepting an upstream revision marks only transitive dependent approvals stale.
- Generated Markdown is rendered safely: headings, paragraphs, lists, emphasis, links, tables, and code work; raw HTML/script is never executed and unsafe link protocols are reduced to their labels.
- Schema **v7** records candidate base version/hash, summary, requested change, decision time, and status. Explicit v1–v6 migration preserves older projects and candidate history.
- Reading width, typography, spacing, empty/loading states, section selection, contract details, and revision/approval history were improved.
- Phase 4 tests cover all eight contracts, candidate creation/rejection/acceptance, stale approvals, base-version conflicts, Markdown sanitization/rendering, and both diff layouts.
- Verification passes: typecheck, **179 tests**, production build, all five bundle/asset budgets (CSS deliberately raised to 18 KiB), and the existing visual/accessibility suite.

Known limits: the Markdown subset is intentionally small (not full CommonMark); contract validation checks structure and topic coverage, not prose quality; visual snapshots do not yet capture a live candidate state.

### Upgrade Phase 3 — project intake and guided discovery

- Every fresh workshop now starts with an explicit source choice: **new project**, **existing local repository**, **remote repository URL**, or **continue saved project**. Oracle cannot run until the source is confirmed.
- Local repository paths pass the existing canonical workspace-security rules. Their absolute paths remain private server state and are omitted from public project responses and Oracle prompts.
- Remote repositories are limited to credential-free public HTTPS URLs. Selection does not clone or grant write access; an explicit second confirmation imports into an app-managed workspace with Git prompts, credential helpers, redirects, and command output disabled.
- Oracle is now a focused multi-turn interview. A turn contains at most three questions, each with a short reason and optional choices. The full Product Discovery procedure remains active instead of being replaced by a tiny one-shot JSON instruction.
- Schema v6 records the complete intake with per-answer provenance, known constraints, risks, facts, user decisions, assumptions, and recommended action. Corrections supersede older memory entries without erasing history.
- Proposals use a structured facts/decisions/assumptions shape. The server rejects premature proposals unless source and essential intake are present; assumed essential answers require the user to explicitly proceed with the stated assumptions.
- Explicit v1–v5 migrations preserve older projects, operations, approvals, transcripts, and recovery metadata while treating legacy projects as confirmed saved work.
- Phase 3 tests cover all four source paths, URL/path safety, pending remote confirmation, private-path omission, incomplete intake, question limits, prompt retention, reload persistence, proposal provenance, explicit assumptions, and corrections.
- Verification passes: typecheck, 161 unit/integration tests, production build, all five bundle/asset budgets, 18 visual/accessibility tests, and the production high-severity dependency audit.

Known limits: remote import supports public unauthenticated HTTPS repositories only; it does not support SSH, private repositories, credentialed URLs, submodule credentials, arbitrary redirects, or remote browser-to-local pairing. Selecting a repository does not grant Maker access to it; Maker remains bounded to its existing isolated workflow until a later phase deliberately changes that authority.

### Upgrade Phase 2 — observable, cancellable, recoverable runs

- Oracle, Architect, Maker, and Witness runs are now **persisted asynchronous operations**. The request returns `202 Accepted` immediately; the saved project updates as the run progresses. The synchronous `question` adapter is the only exception because it changes no saved state.
- Every queued run records **live progress phases**: connecting, session created, waiting for the model, receiving output, validating result, waiting for permission, applying result, and running checks. Phases are safe summaries — prompts and raw model output are never shown or saved as progress.
- The **Activity & results** view (formerly Run Inspector) now shows elapsed time and per-run progress, and offers **Continue waiting, Reconcile now, Open in OpenCode, Cancel, Retry after failure, and Mark abandoned**.
- **Reconciliation is real**: it observes the native session, retrieves the actual late reply or file diff, validates it with the same rules as normal completion, and applies it **exactly once**. An idle session is never treated as success. An unretrievable result stays `COMPLETED_UNAPPLIED` and remains reconcileable.
- A timed-out or disconnected run leaves an `ABANDONED` operation with a recovery marker instead of a dead end; the project can always be reconciled, cancelled, retried, or marked abandoned.
- **Retry after a confirmed failure** starts a new Maker operation with explicit `retryOf` lineage; uncertain runs must be reconciled first, so retrying can never silently duplicate a native edit.
- Schema **v5** adds recovery metadata (intended action, target section, starting revision, idempotency key, expected output, retry lineage, progress phase). Explicit v1/v2/v3/v4 migration preserves full history, and migrated unresolved operations keep their native references and a deterministic reconciliation marker, so old unknown runs remain recoverable.
- Restart recovery now records the recovery marker and keeps the native session reference after an interrupted run.

### Upgrade Phase 1 — model access and provider recovery (recap)

- New projects default to **All accessible models** and can use any model OpenCode reports as available. A project can deliberately switch to **Free and local only**, which continues to block paid and unknown-price remote models.
- Paid and unknown-price remote models require an explicit first-use confirmation. The timestamp is stored in project state and is checked again before a request; the app never makes a paid request silently or substitutes another model.
- Optional project spending limit and deployment-wide `UB_MAX_SESSION_COST_USD` ceiling; the stricter limit wins.
- Provider failures are normalized into eight categories with a dedicated error card and redacted technical disclosure.

## Verification

- Typecheck, **184 tests**, production build, budget, and the **19 visual/accessibility tests** pass.
- Phase 5 tests cover: focused workshop rendering, Activity & results structure, Project memory content and add/correct/supersede behavior, authenticated memory route, contextual permission alert, collapsed Advanced diagnostics, keyboard-operable outline, and wide/narrow layout snapshots.
- Phase 4 tests cover: all eight section contracts, padded-word rejection, candidate creation/supersede, accept/reject, acceptance-versus-approval separation, transitive stale approvals, base-version conflicts, safe Markdown rendering/sanitization, and unified/side-by-side diff consistency.
- No provider credentials or live/private model output were used; all provider and section fixtures are synthetic.

## Known limitations

- Trusted single-project tool, not a multi-tenant sandbox.
- Section review supports a small safe Markdown subset, not full CommonMark or raw HTML. Contract validation checks structure and topic coverage, not prose quality.
- Visual snapshots do not yet capture a live pending-candidate state; the review surface is covered by component/server-render and transition tests.
- Maker edits only the isolated demo workspace; no arbitrary repository connector.
- Live progress uses bounded polling of OpenCode endpoints; the SSE event stream is not consumed yet (see `docs/ARCHITECTURE.md`).
- "Open in OpenCode" focuses this app's OpenCode panel; it does not drive a remote OpenCode UI.
- Retry is Maker-only for now; guide retries remain explicit new requests from the stage panel.
- Model availability, pricing, quota, training terms, and billing are controlled by OpenCode/provider. The spending limit only checks cost OpenCode reports after a session; an unknown-price provider may bill before that value is visible.
- The app cannot verify every provider's training/retention contract. The privacy preference is project intent, not a provider guarantee.
- No live Sentry release/source-map/trace verification, public URL, video, article, or submission.
- Backboard is not integrated and no partner category is claimed.

## Next actions

1. Begin the next upgrade phase only from the committed and pushed Phase 4 state.
