# Changelog

## Phase 8 — security, persistence, and operations hardening

### Added

- Explicit `local`, `hosted-demo`, and `private-hosted` modes with fail-closed startup validation.
- Canonical workspace roots, broad-root rejection, traversal/symlink/special-file checks, private file/directory permissions, and static-file containment.
- Safe OpenCode transport: URL syntax policy, loopback default, HTTPS/allowlist for remote targets, per-request DNS/IP validation, metadata/private-address blocking, redirect refusal, request timeout, and response-size cap.
- OpenCode readiness gate for version 2.x, authentication, and the required free DeepSeek model before mutation.
- Host allowlist, Origin/`Sec-Fetch-Site` checks, constant-time session token, Basic Auth in hosted modes, JSON/content-type enforcement, request-size cap, per-client rate limit, mutation concurrency gate, and bounded authenticated SSE.
- Atomic state schema v2 with `createdAt`/`updatedAt`, mode/demo metadata, v1 migration, backup rotation, corrupt quarantine, cross-process lock, disk-full/read-only mapping, and startup recovery for in-flight operations.
- Centralized redaction for state, exports, errors, structured logs, and Sentry payloads; independent redaction tests.
- Configurable guide/Maker/Node-check timeouts, session token/cost budgets, visible provider-data limitation, retention policies, and structured correlation-ID logs.
- `GET /api/runtime` for mode/demo/limits/retention visibility; `GET /api/events` authenticated SSE snapshots.
- Security/recovery tests for traversal, symlink escape, unsafe roots, SSRF/DNS/redirect/size/timeout, Origin/CORS/CSRF, SSE auth, cross-operation access, request/rate/concurrency limits, duplicate actions, redaction, corrupt state, disk failure, restart, unknown outcomes, budgets, and retention.
- Documentation: architecture/trust boundaries, operations/recovery, OpenCode integration, local setup, hosted deployment, UX/visual system, decisions, implementation plan.

### Changed

- `project.json` schema is now v2 (`schemaVersion: 2`); v1 snapshots migrate on read.
- `/api/project`, `/api/export`, `/api/engine`, and `/api/runtime` now require the session token; hosted modes additionally require Basic Auth.
- `/api/project` omits the persisted workspace path from browser responses.
- The guide no longer silently re-prompts after a short native reply; one request has one possible side effect.
- Maker timeouts/permission waits become `UNKNOWN`/`WAITING_PERMISSION` and cannot be retried automatically.
- Cancellation attempts a native interrupt and refuses to mark cancelled when interruption fails.
- Retained approvals/actions/operations/transcripts/evidence/drafts are bounded.
- Local mode no longer emits HSTS; hosted modes still do.
- Structured JSON logs replace ad-hoc startup error output in the server/render entry points.

### Removed

- Unused `src/server/opencode/operations.ts` helper and its test (no production references).
- Unused `noteCapability`, `retentionPolicy`, `QueueFullError`, `assertConfigForTests`, `isLoopbackOpenCode`, `assertSafeWorkspace`, and `assertAbsolutePath` helpers.
- Unused `UB_MAX_QUEUED_MUTATIONS` knob (the concurrency gate rejects immediately instead of queueing).
- Unused `BACKBOARD_API_KEY` placeholder from `.env.example`; Backboard remains a deferred partner integration.

### Security notes / residual risks

- Shared-host isolation is not provided. The demo workspace and native permissions reduce scope, but the Node check is not an OS sandbox.
- Remote connectors, arbitrary repository execution, and multi-tenant isolation remain deferred.
- `npm audit` reports moderate `glob`/`minimatch` advisories reachable through `@sentry/bundler-plugins` during developer builds. The runtime server path does not load that plugin. The suggested fix is a major Sentry downgrade, not applied without verification.
- Provider quota/tool-call facts are unavailable; elapsed and token limits are the honest fallbacks.
