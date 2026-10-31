# Release notes — Unfinished Business release candidate

**Date:** 2026-11-01
**Status:** Upgrade Phase 2 implemented; deployment, publication, and submission remain outside this phase.

## What changed

### Upgrade Phase 2 — observable, cancellable, recoverable runs

- Oracle, Architect, Maker, and Witness runs are now **persisted asynchronous operations**. The request returns `202 Accepted` immediately; the saved project updates as the run progresses. The synchronous `question` adapter is the only exception because it changes no saved state.
- Every queued run records **live progress phases**: connecting, session created, waiting for the model, receiving output, validating result, waiting for permission, applying result, and running checks. Phases are safe summaries — prompts and raw model output are never shown or saved as progress.
- The **Run Inspector** now shows elapsed time and per-run progress, and offers **Continue waiting, Reconcile now, Open in OpenCode, Cancel, Retry after failure, and Mark abandoned**.
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

- Typecheck, **150 tests**, production build, budget, and the **18 visual/accessibility tests** pass.
- New Phase 2 tests cover: live progress visibility, late Oracle response reconciliation, section 06 Architect timeout recovery, late Maker diff adoption with check evidence, duplicate-reconciliation protection, permission-waiting behavior, cancellation against late replies, restart-reconnect reconciliation, retry lineage and gates, mark-abandoned, and migration of old unknown operations into recoverable state.
- No provider credentials or live/private model output were used; all provider failure fixtures are synthetic.

## Known limitations

- Trusted single-project tool, not a multi-tenant sandbox.
- Maker edits only the isolated demo workspace; no arbitrary repository connector.
- Live progress uses bounded polling of OpenCode endpoints; the SSE event stream is not consumed yet (see `docs/ARCHITECTURE.md`).
- "Open in OpenCode" focuses this app's OpenCode panel; it does not drive a remote OpenCode UI.
- Retry is Maker-only for now; guide retries remain explicit new requests from the stage panel.
- Model availability, pricing, quota, training terms, and billing are controlled by OpenCode/provider. The spending limit only checks cost OpenCode reports after a session; an unknown-price provider may bill before that value is visible.
- The app cannot verify every provider's training/retention contract. The privacy preference is project intent, not a provider guarantee.
- No live Sentry release/source-map/trace verification, public URL, video, article, or submission.
- Backboard is not integrated and no partner category is claimed.

## Next actions

1. Begin the next upgrade phase only from the committed and pushed Phase 2 state.
