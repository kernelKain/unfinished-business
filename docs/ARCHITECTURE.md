# Architecture and trust boundaries

Status: Phase 8 hardening applied. The earlier [engineering blueprint](ENGINEERING_BLUEPRINT.md) remains the product/phase record; this document is the implemented security architecture.

## Runtime modes

| Mode | How it is selected | Listener | Access control | OpenCode target | Intended use |
|---|---|---|---|---|---|
| `local` | default; `UB_MODE=local` | loopback only (`127.0.0.1`/`::1`) | optional HTTP Basic Auth; always a local browser session token | loopback by default; remote targets need an explicit host allowlist and HTTPS | one developer on their own machine |
| `hosted-demo` | `UB_MODE=hosted-demo` or Render (`RENDER`) | `0.0.0.0` behind the platform proxy | HTTP Basic Auth **required**; session token required | loopback child process or an explicitly allowlisted HTTPS origin | public Render demo of the isolated workshop |
| `private-hosted` | `UB_MODE=private-hosted` or `NODE_ENV=production` without Render | private network listener | HTTP Basic Auth **required**; session token required | loopback or an explicitly allowlisted HTTPS/private origin | a private self-hosted instance |

The application never executes arbitrary user repositories. Maker and the Node check always run in `UB_DATA_DIR/demo-workspace`. The Oracle, Architect, and Witness sessions use `UB_DATA_DIR/spirit-workspace`, which is intentionally empty. `project.workspace` is not a user-selectable execution root.

## Trust-boundary diagram

```text
┌──────────────────────────── browser (untrusted input) ────────────────────────────┐
│ React workshop · user text · section revisions · action IDs · Origin/Sec-Fetch    │
└───────────────────────────────────┬───────────────────────────────────────────────┘
                                    │ HTTPS/HTTP + Basic Auth + x-ub-session-token
┌───────────────────────────────────▼───────────────────────────────────────────────┐
│ Render proxy / reverse proxy (hosted modes)                                       │
│  terminates TLS, forwards Host/X-Forwarded-*, provides RENDER_EXTERNAL_HOSTNAME    │
└───────────────────────────────────┬───────────────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼───────────────────────────────────────────────┐
│ Unfinished Business app server                                                    │
│  Host/Origin/CSRF · rate/concurrency/size limits · validation · redaction         │
│  workflow lock · atomic store · SSE gate · structured logs · health               │
└───────┬───────────────────────┬─────────────────────────┬─────────────────────────┘
        │                       │                         │
        │ read/write state      │ bounded fetch            │ optional telemetry
┌───────▼────────────┐  ┌───────▼──────────────────┐  ┌───▼─────────────────────────┐
│ private disk       │  │ OpenCode server          │  │ Sentry (opt-in)             │
│ project.json       │  │ 127.0.0.1 or allowlisted │  │ no bodies/headers/prompts   │
│ .previous/backups  │  │ HTTPS origin             │  │ no user identity             │
│ corrupt quarantine │  │ sessions/permissions     │  └─────────────────────────────┘
│ demo workspace     │  └───────────┬──────────────┘
└────────────────────┘              │ provider credentials stay inside OpenCode
                                    ▼
                         model provider (free DeepSeek)
```

### Boundary ownership

| Boundary | Owned by | Enforced controls |
|---|---|---|
| Browser → app | app server | Host allowlist, Origin/Sec-Fetch-Site check, JSON content type, session token, Basic Auth in hosted modes, request-size cap, rate limiter, non-blocking concurrency gate |
| App → disk | `AtomicProjectStore` and `security/workspace.ts` | canonical roots, traversal/symlink rejection, regular-file checks, `0700` directories, `0600` files, lock file, temp-write + fsync + rename, previous snapshot, rolling backups, quarantine |
| App → OpenCode | `opencode/client.ts` and `security/network.ts` | URL syntax, loopback default, HTTPS for remote, explicit host allowlist, optional port allowlist, DNS/IP classification (metadata/loopback/private/link-local), redirect refusal, per-request timeout, response-size cap, version/auth/model readiness |
| OpenCode → provider | OpenCode | native auth storage, native permissions, free-model selection; the app never reads provider keys |
| App → Sentry | `instrument.ts`, `telemetry.ts` | SDK data-collection off, `beforeSend`/breadcrumb scrubbing, metadata-only spans, no prompts/tool args/results/local paths |
| App → demo fixtures | demo workspace and tests | fixtures are synthetic and never establish live execution or sponsor proof |
| App → browser export | `/api/export` | approved-only plan, redacted drafts, mode/limitation metadata, no workspace path |

## Inventory of sensitive inputs and outputs

| Category | Examples | Handling |
|---|---|---|
| Filesystem paths | `UB_DATA_DIR`, `UB_DATA_DIR/demo-workspace`, `dist/web` | resolved then canonicalized; broad roots (filesystem root, home, temp root, repo root, `/var/data`) rejected; static files resolved through `realpath` and must stay under the web root |
| URLs | `OPENCODE_BASE_URL`, `UB_PUBLIC_URL`, browser `Origin` | parsed with `URL`; credentials/query/fragment rejected; remote OpenCode requires HTTPS + allowlist; origin must match an explicit public origin or the request host |
| Headers | `authorization`, `cookie`, `x-ub-session-token`, `host`, `origin`, `sec-fetch-site`, `x-forwarded-*` | Basic Auth is the hosted gate; the session token is compared in constant time; Host/Origin are allowlisted; spoofed cross-site metadata is rejected |
| Secrets | OpenCode password, Basic Auth password, session token, Sentry auth token, provider credentials | never logged/exported/rendered; only presence is checked; provider credentials remain inside OpenCode |
| Structured data | action IDs, revisions, section IDs, operation IDs, hashes | Zod validation; action ID regex; section ID regex; operation ID UUID; exact revision/hash checks |
| Logs | request/correlation ID, mode, status, failure code, elapsed timings | JSON lines; centralized redaction; no bodies, prompts, cookies, headers, tool results, or local paths in hosted logs |
| Events | `/api/events` snapshot fields | revision, stage, next action, update time only; same auth as state routes; bounded stream count |
| Exports | approved plan, Witness drafts | redacted; explicit limitation text; no native transcripts, secrets, or workspace path |

## Request pipeline

1. Sentry middleware (optional transport).
2. Correlation ID (`x-request-id`) and structured logger fields.
3. Security headers, including a restrictive CSP; HSTS is disabled in local mode.
4. Host allowlist check, then `OPTIONS`/Origin/Sec-Fetch-Site policy.
5. Optional HTTP Basic Auth (all routes except `/api/health`).
6. `GET /api/health` is public and minimal. Every other state/mutation/SSE route requires the session token; the token-issuing `/api/session` route is loopback-only without Basic Auth.
7. Rate limiter per trusted client address; request-size limit; JSON content-type for mutations.
8. Non-blocking concurrency gate for mutations; separate bounded gate for SSE.
9. Route validation and workflow lock.
10. Error mapping with stable code, retryability, operation ID, request ID, redacted message; unknown errors are generic 500s.

## Workflow and persistence

- One active project, one writer. `WorkflowService` serializes the full load → external call → save sequence, so an expected revision cannot change while a native call is in flight.
- `AtomicProjectStore` acquires `<state>.lock`, writes a temp file, fsyncs, renames, and maintains `.previous` plus rolling `backups/`. A corrupt current file is copied to `project.json.corrupt-*` before recovery and is never silently replaced by an empty project.
- Schema v2 adds mode, demo boundary, timestamps, and bounded records. v1 snapshots migrate on read; future or unknown versions are preserved and refused.
- In-flight operations are marked `UNKNOWN` at startup. Reconcile reads native state; nothing is automatically replayed.
- Append-only collections are bounded by retention (`actions`, `operations`, `evidence`, `transcript`, `witnessDrafts`); backup and corrupt files are pruned by count/age.

## Residual security risks

1. **Shared-host isolation is not an OS sandbox.** Maker writes only the demo workspace through native permissions, but a malicious dependency executed inside that workspace is not isolated by containers, seccomp, or a separate Unix user. Do not run this application for mutually untrusted public users.
2. **Remote connector is deliberately deferred.** There is no arbitrary repository connector, plugin marketplace, MCP installer, or remote execution target. `private-hosted` can point at an allowlisted OpenCode server but does not add multi-tenant isolation.
3. **Local process trust.** On a developer machine, any process running as the same user can read the data directory, the session token, or the OpenCode credentials. Local mode is a trusted-developer tool, not a defense against a compromised account.
4. **Provider facts are limited.** Free-model availability, quota, and billing are controlled by OpenCode/provider. The app enforces elapsed-time and session-token limits where OpenCode exposes reliable data and does not claim a tool-call or quota guarantee.
5. **Telemetry is best-effort.** Sentry delivery failure never blocks the workshop; redaction is tested at the SDK boundary, but Sentry remains a third-party processor when enabled.
6. **Dependency audit gap.** The moderate `glob`/`minimatch` advisory is reachable through the Sentry Vite bundler plugin during developer builds, not through the runtime server path; the suggested fix is a major Sentry downgrade and was not applied. See [CHANGELOG.md](CHANGELOG.md).
