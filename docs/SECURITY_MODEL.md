# Security model

**Status:** Current for Platform Phase 7 and the Phase 8 hardening gate.
**Owner:** Engineering/security.
**Last verified:** 2026-11-01.

This document is the readable security boundary for the release candidate. It supplements the implementation-level controls in `docs/ARCHITECTURE.md`; it does not claim an OS sandbox or multi-tenant isolation.

## Trust boundaries

| Boundary | Trusted side | Untrusted or constrained side | Primary controls |
|---|---|---|---|
| Browser ↔ application | Same-origin application server | Browser input, URLs, JSON bodies, imported Markdown, file names | Host/Origin/CSRF checks, session token, Basic Auth in hosted modes, Zod validation, size/rate/concurrency limits |
| Application ↔ OpenCode | Configured OpenCode 2.x server | Remote URL, DNS answer, redirect, oversized response, malformed reply | Loopback default, HTTPS + explicit host allowlist for remote, per-request DNS check, private/metadata address denial, redirect refusal, request timeout and response cap |
| Application ↔ filesystem | Explicit `UB_DATA_DIR` | Local repository paths, symlinks, broad roots, repository imports | Broad-root rejection, realpath containment, owner-only modes, atomic writes, private temporary files |
| Application ↔ provider | OpenCode owns provider credentials and model calls | Provider prompts, responses, billing, retention terms | Provider keys never enter this app; prompts are bounded and redacted; provider errors use safe categories |
| User authority ↔ agent authority | Explicit exact-version approvals and Maker scope | Native tool permissions and OpenCode decisions | App approvals never override an OpenCode denial; the app never auto-approves a permission request |
| Process ↔ persisted state | Atomic store and lock | Crash, partial write, corrupt JSON, stale revision, replayed action | Lock, fsync, rename, backups, quarantine, schema migration, action hashes, optimistic revision checks |
| Application ↔ telemetry | Metadata-only Sentry events | Error text, headers, paths, prompts, model output | Redaction before logging/Sentry; prompts and bodies are not collected |

## Controls and evidence

| Claim | Control | Evidence |
|---|---|---|
| Protected API routes require authorization | Loopback session token; Basic Auth in hosted modes | `tests/http-hardening.test.ts`, `tests/http-workflow.test.ts` |
| Cross-origin and CSRF attempts are rejected | Host allowlist, Origin and `Sec-Fetch-Site` checks | `tests/http-hardening.test.ts` |
| Remote OpenCode access cannot silently target private/metadata addresses | URL syntax, DNS classification, allowlists, redirect refusal | `tests/security.test.ts` |
| Local repository selection cannot use broad roots or system links | Canonical workspace policy, realpath check, macOS aliases | `tests/security.test.ts`, `tests/oracle-discovery.test.ts` |
| Remote repository selection refuses credentials, insecure schemes, nonstandard ports, queries, fragments, and traversal | URL validation before persistence/import | `tests/oracle-discovery.test.ts` |
| Imported content cannot execute HTML or unsafe links | Safe Markdown subset; no raw HTML injection; protocol filtering | `tests/markdown.test.ts`, `tests/revisions.test.ts`, `tests/web.test.ts` |
| Secrets and local paths do not leave through errors/logs | Pattern redaction plus structured-log/Sentry sanitizers | `tests/security.test.ts`, `tests/http-hardening.test.ts`, `tests/provider-errors.test.ts` |
| Duplicate or replayed mutations are inert | Action ID + canonical payload hash; duplicate returns current state; different payload conflicts | `tests/store-hardening.test.ts`, `tests/recovery.test.ts`, `tests/http-workflow.test.ts`, `tests/runs.test.ts` |
| Stale revisions cannot overwrite newer work | `expectedRevision`/section hash checks; stale candidates cannot be accepted | `tests/workflow.test.ts`, `tests/revisions.test.ts`, `tests/http-workflow.test.ts` |
| A timed-out native run is not silently retried | `ABANDONED`/`COMPLETED_UNAPPLIED` recovery states, explicit reconcile, retry only after confirmed failure | `tests/experience-hardening.test.ts`, `tests/observable-runs.test.ts`, `tests/journey.test.ts` |
| A pending native permission is never auto-approved | Permission list is read-only; the user must reply in the app/OpenCode | `tests/native-permissions.test.ts`, `tests/web.test.ts` |
| State survives interruption without silent reset | Atomic lock/write/rename, `.previous`, backups, quarantine | `tests/store-hardening.test.ts`, `tests/recovery.test.ts` |
| Provider failures do not leak private output | Eight safe categories, redacted technical block, diagnostic reference | `tests/provider-errors.test.ts`, `tests/experience.test.ts` |

## Dependency hardening

- Sentry remains on the latest `11.10.0` line; no unrelated major migration was introduced.
- The vulnerable transitive `glob`/`minimatch` pair under `@sentry/bundler-plugins` is overridden to `glob@14.0.3` and `minimatch@11.0.3`.
- `npm audit` and `npm audit --omit=dev --audit-level=high` both report **0 vulnerabilities** after the override.
- Build and CJS/ESM import checks were run after the override; no Sentry API migration was combined with it.

## Residual risks and explicit limitations

- The Node check is a bounded child process, not an OS sandbox.
- OpenCode and the application run as the same OS user. A same-user process can read local state.
- The app is single-project and not multi-tenant; shared-host isolation is deferred.
- Provider retention, pricing, quota, and training terms are controlled by the provider and OpenCode.
- Remote repository import supports public unauthenticated HTTPS clones only.
- Rate limiting is in-process and resets on restart.
- A local same-user attacker can alter the app binary or data directory; this release does not defend against that.
- No high-severity accessibility or security advisory remains open in the automated checks; this is not a claim of formal penetration testing.

## Reporting and evidence rules

Do not include credentials, server passwords, session tokens, private prompts, private model output, or unrestricted local paths in an issue, screenshot, log, or public claim. Use repository-relative paths in evidence. A fixture PASS is not a live provider PASS; a deployment, publication, or submission requires separate authorization.
