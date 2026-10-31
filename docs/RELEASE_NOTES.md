# Release notes — Unfinished Business release candidate

**Date:** 2026-10-31
**Status:** Verified locally; deployment, publication, and submission pending separate authorization.

## What changed

- Integrated the guided interface (landing, onboarding/discovery, deterministic demo) with the Phase 8 security/persistence hardening.
- One canonical set of docs for product, architecture, implementation, OpenCode, local setup, hosted deployment, tools, UX, operations, demo, decisions, and changelog.
- Canonical `UB_DEPLOYMENT_MODE` with `local`, `private-hosted`, and `hosted-demo`; legacy `UB_MODE` remains an alias.
- The public hosted demo is token-free and read-only; private/local API reads require the browser session token.
- Maker runs are asynchronous with explicit queue, active-run inspection, cancellation, reconciliation, and `UNKNOWN`/`WAITING_PERMISSION` states.
- State schema v2 migrates v1 and both prior v2 shapes; corrupt state is preserved and recoverable.
- Paid or unpriced remote models are discoverable but not selectable; no paid fallback.

## Verification

- `npm ci`, typecheck, **111 tests**, production build, **budget**, **18 visual/accessibility tests**, and high-severity production audit pass.
- Local smoke and hosted-demo smoke pass.
- OpenCode 2.0.32 compatibility probe passes without a prompt or model call.
- Moderate dependency advisories remain in the Sentry bundler path; see [EVIDENCE.md](EVIDENCE.md).

## Known limitations

- Trusted single-project tool, not a multi-tenant sandbox.
- Maker edits only the isolated demo workspace; no arbitrary repository connector.
- Free-model availability is account-dependent and time-limited.
- No live Sentry release/source-map/trace verification, public URL, video, article, or submission.
- Backboard is not integrated and no partner category is claimed.

## Next actions

1. Review the release diff and evidence.
2. Optionally authorize a private Render deployment and live Sentry verification.
3. Produce the recorded demo and submission materials.
4. Publish/deploy/submit only with explicit authorization.
