# Release notes — Unfinished Business release candidate

**Date:** 2026-11-01
**Status:** Upgrade Phase 0 implemented; deployment, publication, and submission remain outside this phase.

## What changed

- Recorded the clean Phase 9 baseline at `7d45e439bddd28bd9d9dcffa3541353c625db40a`; its typecheck, 111 tests, and build passed before edits.
- Introduced schema v3 foundations for project source, Oracle intake, structured memory, candidate section revisions, model-access/budget preferences, and richer operation metadata.
- Added deterministic, idempotent v1/v2 → v3 migration. Proposals, sections, approvals, transcripts, operations, evidence, native references, and selected model data are preserved.
- Defined `QUEUED`, `RUNNING`, `WAITING_PERMISSION`, `COMPLETED_UNAPPLIED`, `SUCCEEDED`, `FAILED`, `CANCELLED`, and `ABANDONED`; legacy `UNKNOWN` maps to `ABANDONED`.
- Added reusable synthetic fixtures for provider policy/auth/rate/generic failures, slow and late responses, late Maker diffs, pending permission, and reconciliation.
- Kept the existing UI/workflow intact apart from displaying the new `ABANDONED` status name.

## Verification

- Typecheck, **118 tests**, production build, budget, and the existing **18 visual/accessibility tests** pass.
- Migration and serialization coverage proves deterministic/idempotent upgrades and record preservation.
- No provider credentials or live/private model output were used; all new failure fixtures are synthetic.

## Known limitations

- Trusted single-project tool, not a multi-tenant sandbox.
- Maker edits only the isolated demo workspace; no arbitrary repository connector.
- Free-model availability is account-dependent and time-limited.
- Model-access/budget preferences and `COMPLETED_UNAPPLIED` are foundations for later phases; Phase 0 does not add new preference enforcement or late-result application behavior.
- No live Sentry release/source-map/trace verification, public URL, video, article, or submission.
- Backboard is not integrated and no partner category is claimed.

## Next actions

1. Begin the next upgrade phase only from the committed and pushed Phase 0 state.
2. Continue to treat late results as unapplied until a later phase adds an explicit review/apply transition.
