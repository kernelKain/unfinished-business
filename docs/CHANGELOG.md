# Changelog

All notable changes to Unfinished Business. Dates are local execution dates.

## Unreleased — Phase 2

### Added

- OpenCode connection state model: `not_configured`, `checking`, `connected`, `authentication_required`, `incompatible_version`, `unavailable`, `degraded`.
- First-run wizard for server URL, Basic-auth username/password, connectivity test, provider readiness, model choice, reported variants, and harmless verification.
- Provider/model discovery normalization: display names, pricing/free/paid, local status when known, context/input/output limits, modalities, tool support, reasoning support source, variants, availability.
- Expandable OpenCode panel: model/variant selection, agents and explicit role mapping, pending permissions, commands, skills, MCP servers, formatter/LSP configuration, project-scoped sessions, usage.
- Model selection persisted in project schema v2; Maker records the selected model in its operation and evidence.
- Migration from v1 fixed-model projects to v2 with a legacy hint that is used only when the model is still reported.
- Project-scoped session list/resume/interrupt/fork/compact/revert and permission replies.
- Opt-in live compatibility diagnostic: `npm run diagnose:opencode`.
- Deployment modes: `local`, `hosted-private`, `hosted-demo`.
- Actionable diagnostics for password mismatch, provider auth, unavailable/disabled/unreported models, unsupported variants, unsupported server version, origin/proxy rejection, local model limits, and process restart.

### Changed

- Replaced the hard-coded free DeepSeek model with the discovered `engine` selection.
- `POST /api/runs` now returns `202` immediately and the browser polls persisted state. The run manager records `QUEUED`/`RUNNING`/terminal states, model, agent, and timestamps.
- Background project updates use latest-revision retry; store writes are serialized and use UUID temp names.
- Cancellation interrupts the native session and cannot be overwritten by a late completion.
- Process restart converts in-flight operations to `UNKNOWN` for explicit reconciliation.
- Provider credentials are never accepted by the application; only the OpenCode server password is accepted (memory-only in the wizard).
- Active setup docs and README no longer instruct users to require a fixed model.

### Tests

- Non-blocking run lifecycle, completion, failure, duplicate action, cancellation, and inactive-run behavior.
- URL policy, version policy, auth failure/recovery, provider/model normalization, secret redaction, local-limit diagnostics, managed-mode lock.
- v1 → v2 migration and persistence.
- Model/variant validation and onboarding HTTP flow.
- Project-scoped session authorization and actions.
- Onboarding browser end-to-end flow against a mock `2.0.32` OpenCode server.
- Full suite: 55 tests pass; typecheck and production build pass.

### Deferred

- Separate tool catalog (not exposed by OpenCode `2.0.32`).
- Provider quota/balance (not exposed by the HTTP API).
- Live formatter/LSP health.
- Phase 3 final acceptance and submission materials.

## Phase 1 prerequisite — asynchronous runs

- Maker runs are queued and executed outside the HTTP request; operation state remains the source of truth.
- Restart and cancellation are loss-aware rather than replaying native work.

## Historical phases

The project previously committed the foundation, durable workflow, and guided workshop experience. The [engineering blueprint](ENGINEERING_BLUEPRINT.md) records those phases and their evidence, including the earlier fixed-model proof. That record is intentionally preserved as history; the current contract is [OPENCODE_INTEGRATION.md](OPENCODE_INTEGRATION.md).
