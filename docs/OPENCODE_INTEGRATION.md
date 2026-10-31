# OpenCode integration contract

**Status:** Implemented and locally verified.
**Owner:** Engineering/integration.
**Last verified:** 2026-10-31.

This document describes the supported OpenCode surface, not every endpoint OpenCode exposes. OpenCode remains the owner of inference, the agent loop, tools, permissions, and native sessions.

## Supported versions and client

| Component | Tested value | Policy |
|---|---|---|
| OpenCode server | `2.0.32` | Major `2` is accepted. A different `2.x` version is shown as `degraded` with an explicit untested-version warning. Major `1.x`, unparseable versions, and other majors are `incompatible_version`; discovery stops. |
| `@opencode/client` | `2.0.32` | Exact lockfile version, matched to the pinned server. |
| Node.js | `>=22.14` | Application runtime. |
| Server host | loopback by default | A remote target must use HTTPS, be explicitly allowlisted, and pass DNS/IP policy. |

## Transport and security policy

Every application→OpenCode request goes through `src/server/security/network.ts`:

- absolute HTTP(S) URL; no embedded credentials, query, or fragment;
- loopback (`127.0.0.1`, `localhost`, `::1`) is the default;
- a non-loopback target must use HTTPS and appear in `UB_OPENCODE_ALLOWED_HOSTS`;
- optional `UB_OPENCODE_ALLOWED_PORTS` allowlist;
- DNS resolves per request; metadata, loopback-rebinding, link-local, and private addresses are blocked unless `UB_OPENCODE_ALLOW_PRIVATE_NETWORK=true` is deliberately set;
- redirects are refused;
- each request has `UB_OPENCODE_REQUEST_TIMEOUT_MS` and a `UB_OPENCODE_MAX_RESPONSE_BYTES` cap;
- the password is sent as Basic auth with username `opencode` only when configured; it is never logged, exported, or stored in project state;
- the server checks version, authentication, and catalog readiness before a mutating native call.

`UB_OPENCODE_ALLOW_INSECURE_REMOTE=true` exists only for local development and is ignored outside `local`/non-production. It does not bypass the host allowlist or DNS classification.

## Endpoints used

All calls are made by the application server, never directly by the browser.

| Purpose | Endpoint(s) |
|---|---|
| Version and identity | `GET /api/info` |
| Model catalog | `GET /api/model` |
| Provider catalog | `GET /api/provider` |
| Provider connection state | `GET /api/integration` |
| Agents | `GET /api/agent` |
| Pending permissions | `GET /api/permission/request`, `POST /api/session/:sessionID/permission/:requestID/reply` |
| Commands | `GET /api/command` |
| Skills | `GET /api/skill` |
| MCP servers | `GET /api/mcp` |
| Formatter/LSP configuration | `GET /api/config` |
| Session create | `POST /api/session` |
| Session read/resume | `GET /api/session/:sessionID` |
| Session messages | `GET /api/session/:sessionID/message` |
| Session interrupt | `POST /api/session/:sessionID/interrupt` |
| Session fork | `POST /api/session/:sessionID/fork` |
| Session compact | `POST /api/session/:sessionID/compact` |
| Session revert | `POST /api/session/:sessionID/revert/stage`, `DELETE /api/session/:sessionID/revert`, `POST /api/session/:sessionID/revert/commit` |
| Prompt/wait/generate | `POST /api/session/:sessionID/prompt`, `POST /api/experimental/session/:sessionID/wait`, `POST /api/session/:sessionID/generate` |
| Diff | `GET /api/session/:sessionID/diff` |

Session actions are restricted to native sessions referenced by the active project (`project.nativeSessions` and operation records). The API does not enumerate or control arbitrary OpenCode sessions.

## Connection states

`not_configured` → no URL has been checked. `checking` is reserved for an in-flight check. `connected` means the server answered, the major version is compatible, the catalog was read, and no warning remains. `degraded` means the server answered but there is an untested patch version, a provider that needs authentication, a pending permission, a selected-model problem, or a partial capability probe. `authentication_required` means OpenCode rejected the connection with 401. `incompatible_version` means the major version is not supported. `unavailable` means the server did not answer or returned a transport/origin/invalid-response failure.

Every non-connected state includes at least one diagnostic with an actionable repair. The UI never replaces a failed check with an optimistic connected state.

## Provider and model discovery

The catalog is normalized into a product-safe shape. These values are dropped before leaving the server:

- provider `settings`, `headers`, and `body` (they can contain `apiKey` or base URLs);
- model `settings`, `headers`, `body`, and request compatibility internals not needed by the UI;
- skill contents (only id/name/description are retained);
- raw config entries (only formatter/LSP names and disabled flags are retained);
- session context, prompt text, and message bodies outside the project's own operation flow.

Normalized facts:

| Fact | Rule |
|---|---|
| Key | `providerID/modelID`; a variant is appended as `#variant` only for display. |
| Display name | OpenCode `name`. |
| Availability | `enabled !== false` and the provider is not disabled. |
| Pricing | `free` only when every reported cost row has zero input/output/cache prices; `paid` when any price is non-zero; `unknown` when no cost rows are reported. |
| Local | Known local provider IDs (`ollama`, `lmstudio`, `vllm`, `llamacpp`, `local`) or a loopback provider `baseURL`; otherwise `null`. |
| Limits | Context, input, and output from `limit`, or `null`. |
| Modalities | `capabilities.input` and `capabilities.output`. |
| Tools | `capabilities.tools`. |
| Reasoning | `supported: true` when `compatibility.reasoningField`/`requireReasoning` is present, or when the model reports variants; otherwise `null`. |
| Variants | Exact reported variant IDs only. There is no universal low/medium/high scale. |
| Provider readiness | `needs_auth` only when an OpenCode integration connection says so; otherwise inferred and shown as inferred/unknown. |

### Model selection policy

Free DeepSeek (`opencode/deepseek-v4.1-flash-free`) is the intended route. The catalog is time-limited and account-dependent.

- A selected model must be reported as available.
- A selected variant must be one the model reports.
- A paid or unpriced remote model is discovered and inspectable but cannot be selected or used for a run. This release has no paid fallback.
- A local model is allowed because it creates no provider charge.
- If a selected model disappears, a Maker run is blocked until a currently reported model is selected.
- A migrated v1 project preserves the legacy model identity only when the catalog still reports that free model.

## Application roles

| Application role | Preferred custom agent | Tested fallback | Purpose |
|---|---|---|---|
| Oracle | `oracle` / `ub-oracle` | `plan` | Clarify and propose a product scope without editing. |
| Architect | `architect` / `ub-architect` | `plan` | Draft one section at a time with read-only tools. |
| Maker | `maker` / `ub-maker` | `build` | Perform the approved, bounded edit in the isolated demo workspace. |
| Witness | `witness` / `ub-witness` | `plan` | Review evidence from a fresh session. |

The mapping is discovered from `/api/agent`; the current mapping and fallback are shown in the OpenCode panel. If neither a custom agent nor the fallback is visible, session creation uses OpenCode's default and the limitation is visible.

Read-only roles receive session permissions denying `edit`, `shell`, and `external_directory`. Maker receives `edit` allowed while `shell` and `external_directory` remain denied. These application rules supplement, but do not replace, OpenCode's own permission engine.

## Permissions

Pending requests are read from OpenCode and filtered to project-owned sessions. The UI offers `Allow once`, `Always`, and `Reject`; it never auto-approves. `Always` asks OpenCode to save the proposed pattern, which may be broad. The application cannot override a configured `deny`. A Maker run that is waiting for permission is recorded as `WAITING_PERMISSION`, not success or failure.

## Sessions, usage, and controls

- **List/resume** is restricted to project-owned sessions.
- **Interrupt** is exposed for the selected project session and an active Maker run. Cancellation requests a native interrupt; if interruption fails, the operation is not marked cancelled.
- **Fork** is available only for a session with messages. A new fork is not silently rebound to a product role.
- **Compact** queues a compaction; OpenCode may report `compaction.unavailable` for a short session.
- **Revert** requires a message ID. Stage/clear/commit are advanced controls; OpenCode enforces busy/empty-session errors.
- **Usage** is shown only when OpenCode returns session cost/token values. Quota and balance are not exposed by the HTTP API.
- **Tool catalog** is deferred because OpenCode `2.0.32` does not expose a separate HTTP tool list.
- **Formatter/LSP status** is configuration presence only, not a live health check.
- **Arbitrary session enumeration** is deliberately not exposed.

## Timeouts, budgets, and failure mapping

| Control | Default | Behavior |
|---|---:|---|
| Guide timeout | 90s | Timeout is an abandoned/failed native operation; no silent re-prompt. |
| Maker timeout | 180s | `ABANDONED`; reconcile before another run. A late result is not silently applied. |
| Node check timeout | 30s | Failure is recorded as evidence; no passing claim. |
| Session token budget | 200k | Exceeding it is a non-retryable budget failure with the native session retained. |
| Session cost budget | $0 | Any reported non-zero cost fails; no paid fallback. |
| Provider rate/quota | — | `PROVIDER_LIMITED`; no automatic retry. |

A per-session tool-call budget is not enforced because OpenCode's stats API is not a reliable per-session counter. This limitation is exposed at `/api/runtime` and in the UI.

## Credentials ownership

| Secret | Owner | Where it may live |
|---|---|---|
| Provider API keys / OAuth tokens | OpenCode | OpenCode credential store / XDG data directory. Never in Unfinished Business. |
| OpenCode server Basic-auth password | The person running OpenCode | `OPENCODE_PASSWORD` for non-interactive deployments, or in-memory only when entered in the wizard. No browser storage, project JSON, logs, Sentry events, or exports. |
| Application access password | Deployment | `UB_ACCESS_PASSWORD` in the deployment secret store. |
| Browser session token | Application | `UB_SESSION_TOKEN`, returned only to an authenticated/loopback browser session and used in a request header. |
| Sentry auth token | CI/deployment | Secret store only; never prefixed `VITE_`. |

The wizard has no provider-key field. A request that includes `providerKey`, `apiKey`, or a similar unknown field is rejected.

## Live diagnostic

The opt-in diagnostic performs no prompt or model inference:

```bash
OPENCODE_LIVE_DIAGNOSTIC=1 \
OPENCODE_BASE_URL=http://127.0.0.1:4096 \
OPENCODE_PASSWORD='the server password' \
npm run diagnose:opencode
```

It creates, reads, and removes one disposable empty session when a model is available. Without `OPENCODE_LIVE_DIAGNOSTIC=1` it prints `SKIP` and exits 0.

### Phase 9 compatibility result

Against a disposable OpenCode `2.0.32` server with an ephemeral password and empty XDG storage:

- state `connected`, compatible major `2`, tested version `2.0.32`;
- 9 models discovered, 0 providers/agents/commands/skills because the empty config had no provider account;
- disposable empty session create/read/remove succeeded;
- the app itself, pointed at that server, reported `connected` with 9 models via `/api/connection`; `/api/engine` returned 200 with no model selected;
- no password-shaped value appeared in the response;
- no prompt, model call, provider credential read, or project write occurred.

Earlier native evidence from the Experience phase remains the only recorded inference run in this repository: a free-model Maker edit produced a diff and a failing `node --test`, and the Witness recorded the failure. Phase 9 did not repeat live inference.

## Version-dependent gaps

- Other `2.x` patch versions are accepted but marked degraded until the live diagnostic is rerun.
- `@opencode/client` 2.0.32's generated types are the compatibility baseline.
- `session.fork` rejects an empty session; the UI disables the action when message count is zero.
- OpenCode may report `variant: "default"` even when no variant was requested; the UI treats this as the model default.
- Cost/token totals depend on provider usage reporting.
- A public demo must not ask visitors for provider keys; it has no OpenCode connection at all.
- A remote OpenCode target is possible only with explicit allowlisting and a non-private resolved address. No remote browser-to-local pairing is implemented.
