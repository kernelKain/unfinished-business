# OpenCode integration contract

Status: Phase 2 integration contract. This document describes the tested surface, not every endpoint OpenCode exposes.

## Supported versions and client

| Component | Tested value | Policy |
|---|---|---|
| OpenCode server | `2.0.32` | Major `2` is accepted. A different `2.x` version is shown as `degraded` with an explicit untested-version warning. Major `1.x`, unparseable versions, and other majors are `incompatible_version` and discovery stops. |
| `@opencode/client` | `2.0.32` | Exact lockfile version. The client is generated from the same HTTP contract as the server. |
| Node.js | `>=22.14` | The app runtime. |

The opt-in live diagnostic records the actual server version and API surface:

```bash
OPENCODE_LIVE_DIAGNOSTIC=1 \
OPENCODE_BASE_URL=http://127.0.0.1:4096 \
OPENCODE_PASSWORD='the server password' \
npm run diagnose:opencode
```

It performs no prompt or model inference. It creates, reads, and removes one disposable empty session when a model is available. Without `OPENCODE_LIVE_DIAGNOSTIC=1` it prints `SKIP` and exits 0.

### Live diagnostic result recorded for this phase

Against a disposable OpenCode `2.0.32` server with `@opencode/client 2.0.32`:

- `/api/info` returned server `2.0.32`.
- The catalog returned 2 providers, 9 models, 4 visible agents, 2 commands, and 31 skills.
- `session.create`, `session.get`, and `session.remove` succeeded for a disposable empty session. No prompt was sent.
- `session.fork` on an empty session is rejected by the server (`empty_session`). Fork is therefore offered only for sessions with at least one message.
- `session.compact` queues a compaction and can later report `compaction.unavailable` when there is nothing to compact.
- `session.interrupt` returns `{ interrupted: false }` for an idle session.
- `session.revert.stage` requires a real message boundary; an unknown message returns `MessageNotFoundError`.
- No provider API key was read, logged, or returned.

This is a compatibility proof for those calls. It is not proof that every provider/model can complete inference.

## Endpoints used

All calls are made by the application server, never directly by the browser. The application sends HTTP Basic authentication only when a server password is configured. OpenCode's fixed Basic-auth username is `opencode`.

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

The server catalog is normalized into a product-safe shape. These values are dropped before leaving the server:

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
| Local | Known local provider IDs (`ollama`, `lmstudio`, `vllm`, `llamacpp`, `local`) or a loopback provider `baseURL`. Otherwise `null`, not a fabricated `false`. |
| Limits | Context, input, and output from `limit`, or `null`. |
| Modalities | `capabilities.input` and `capabilities.output`. |
| Tools | `capabilities.tools`. |
| Reasoning | `supported: true` when `compatibility.reasoningField`/`requireReasoning` is present, or when the model reports variants. Otherwise `null` (unknown). The source is shown. |
| Variants | Exact reported variant IDs only. There is no universal low/medium/high scale. |
| Provider readiness | `needs_auth` only when an OpenCode integration connection says so; otherwise inferred from the catalog and shown as inferred/unknown. |

Provider API keys and quota remain OpenCode's responsibility. The application does not call credential endpoints and does not accept provider keys in any request body.

## Credentials ownership

| Secret | Owner | Where it may live |
|---|---|---|
| Provider API keys / OAuth tokens | OpenCode | OpenCode credential store / XDG data directory. Never in Unfinished Business. |
| OpenCode server Basic-auth password | The person running OpenCode | `OPENCODE_PASSWORD` for non-interactive deployments, or in-memory only when entered in the wizard. No browser storage, project JSON, logs, Sentry events, or exports. |
| Application access password | Deployment | `UB_ACCESS_PASSWORD` in the deployment secret store. |
| Browser mutation token | Application | `UB_SESSION_TOKEN`, returned only to an authenticated/loopback browser session and used in a request header. Not persisted by the browser UI. |

The wizard has no provider-key field. A request that includes `providerKey`, `apiKey`, or a similar unknown field is rejected with a message explaining that provider keys belong in OpenCode.

## Application roles

OpenCode remains the execution engine. Unfinished Business maps its four product roles to explicit OpenCode agents:

| Application role | Preferred custom agent | Tested fallback | Purpose |
|---|---|---|---|
| Oracle | `oracle` / `ub-oracle` | `plan` | Clarify and propose a product scope without editing. |
| Architect | `architect` / `ub-architect` | `plan` | Draft one section at a time with read-only tools. |
| Maker | `maker` / `ub-maker` | `build` | Perform the approved, bounded edit in the isolated demo workspace. |
| Witness | `witness` / `ub-witness` | `plan` | Review evidence from a fresh session. |

The mapping is discovered from `/api/agent`; the current mapping and fallback are shown in the OpenCode panel. If neither a custom agent nor the fallback is visible, session creation uses OpenCode's default and the limitation is visible.

Read-only roles receive session permissions denying `edit`, `shell`, and `external_directory`. Maker receives `edit` allowed while `shell` and `external_directory` remain denied. These application rules supplement, but do not replace, OpenCode's own permission engine.

## Permissions

Pending requests are read from OpenCode and filtered to project-owned sessions. The UI offers `Allow once`, `Always`, and `Reject`; it never auto-approves. `Always` asks OpenCode to save the proposed pattern, which may be broad. The application cannot override a configured `deny`.

## Sessions, usage, and deferred controls

- **List/resume** is restricted to project-owned sessions.
- **Interrupt** is exposed for the selected project session and for an active Maker run. The run manager marks cancellation and keeps the operation `CANCELLED` even if completion arrives afterward.
- **Fork** is available only for a session with messages. A new fork is returned to the advanced panel but is not silently rebound to a product role.
- **Compact** queues a compaction. OpenCode may report `compaction.unavailable` for a short session.
- **Revert** requires a message ID. Stage/clear/commit are advanced controls with explicit confirmation-shaped actions; OpenCode enforces busy/empty-session errors.
- **Usage** is shown only when OpenCode returns session cost/token values. Quota and balance are not exposed by the HTTP API; the panel links to the provider console.
- **Tool catalog** is deferred because OpenCode `2.0.32` does not expose a separate HTTP tool list. Tool exposure is governed by the selected agent and permissions.
- **Formatter/LSP status** is configuration presence only; it is not a live health check.
- **Session list of arbitrary sessions** is deliberately not exposed.

## Version-dependent gaps

These gaps are recorded rather than papered over:

- Other `2.x` patch versions are accepted but marked degraded until the live diagnostic is rerun.
- `@opencode/client` 2.0.32's generated types are the compatibility baseline. A newer server may shape optional fields differently.
- `session.fork` rejects an empty session; the UI disables the action when the message count is zero.
- OpenCode may report `variant: "default"` on a session even when no variant was requested. The UI treats this as the model default, not a fabricated variant.
- Cost/token totals depend on provider usage reporting. A zero value is shown only when OpenCode actually reports it.
- The shared public demo must not ask visitors for provider keys; a public deployment without a connected provider will legitimately show no models.
