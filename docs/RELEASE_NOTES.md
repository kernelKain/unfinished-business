# Release notes — Unfinished Business release candidate

**Date:** 2026-11-01
**Status:** Upgrade Phase 1 implemented; deployment, publication, and submission remain outside this phase.

## What changed

- New projects default to **All accessible models** and can use any model OpenCode reports as available. A project can deliberately switch to **Free and local only**, which continues to block paid and unknown-price remote models.
- Paid and unknown-price remote models require an explicit first-use confirmation. The timestamp is stored in project state and is checked again before a request; the app never makes a paid request silently or substitutes another model.
- Replaced the hardcoded `$0` session-cost failure with an optional project spending limit and an optional deployment-wide `UB_MAX_SESSION_COST_USD` ceiling. `unlimited`, `disabled`, `0`, or an unset deployment value means no app limit. The stricter limit wins.
- The model chooser now shows provider, local/remote locality, free/paid/unknown pricing, context/input/output limits, reported variants, and a route-specific privacy warning.
- Provider failures are normalized into eight categories with a dedicated error card: what happened, saved-work status, recommended repair, retry/change-model action, and technical disclosure. Credentials, authorization headers, cookies, and local paths are redacted; a `provider-…` diagnostic reference is retained.
- Schema v4 adds the active model-access/pricing/budget policy and structured provider error records. Explicit v1/v2/v3 → v4 migration preserves proposals, approvals, transcripts, operations, evidence, native references, selected models, provider allowlists, and privacy preference.
- The workspace privacy preference distinguishes provider-default data handling from a no-training requirement. The app cannot attest provider contracts; a provider rejection that mentions training/data policy is explained as `PROVIDER_DATA_POLICY` with a review-privacy repair.

## Verification

- Typecheck, **139 tests**, production build, budget, and the existing **18 visual/accessibility tests** pass.
- New tests cover model access policy, paid/unknown-price confirmation, optional/unlimited spending limits, budget precedence, provider failure classification, redaction, runtime confirmation gates, and v3 → v4 migration.
- No provider credentials or live/private model output were used; all provider failure fixtures are synthetic.

## Known limitations

- Trusted single-project tool, not a multi-tenant sandbox.
- Maker edits only the isolated demo workspace; no arbitrary repository connector.
- Model availability, pricing, quota, training terms, and billing are controlled by OpenCode/provider. The spending limit only checks cost OpenCode reports after a session; an unknown-price provider may bill before that value is visible.
- The app cannot verify every provider's training/retention contract. The privacy preference is project intent, not a provider guarantee.
- No live Sentry release/source-map/trace verification, public URL, video, article, or submission.
- Backboard is not integrated and no partner category is claimed.

## Next actions

1. Begin the next upgrade phase only from the committed and pushed Phase 1 state.
2. Continue to treat late results as unapplied until a later phase adds an explicit review/apply transition.
