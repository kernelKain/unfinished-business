# OpenCode integration contract

**Status:** Implemented and verified on Linux x64 locally and on macOS Apple Silicon and macOS Intel through CI.
**Owner:** Engineering/integration.
**Last verified:** 2026-11-01 against Platform Phase 7 and the Phase 5 focused-workshop/OpenCode-controls surface.

This document describes the supported OpenCode surface, not every endpoint OpenCode exposes. OpenCode remains the owner of inference, the agent loop, tools, permissions, and native sessions.

## Supported versions, client, and hosts

| Component | Tested value | Policy |
|---|---|---|
| OpenCode server | `2.0.32` | Major `2` is accepted. A different `2.x` version is shown as `degraded` with an explicit untested-version warning. Major `1.x`, unparseable versions, and other majors are `incompatible_version`; discovery stops. |
| OpenCode CLI package | `@opencode/cli` `2.0.32` | Official cross-platform package pinned in the lockfile. Its postinstall selects the native binary for the host. |
| `@opencode/client` | `2.0.32` | Exact lockfile version, matched to the pinned server. |
| Node.js | `>=22.14` | Application runtime. |
| Server host | loopback by default | A remote target must use HTTPS, be explicitly allowlisted, and pass DNS/IP policy. |
| Local host platform | Linux x64, macOS arm64, macOS x64 | Supported and verified by local runs (Linux) and CI run `41252770576` (all three). Windows, Linux ARM64, and 32-bit hosts are not claimed. |

### CLI resolution and Render isolation

`src/server/opencode/executable.ts` is the only runtime resolver. It:

1. honors an explicit `UB_OPENCODE_EXECUTABLE`;
2. prefers a compatible global `opencode` found on `PATH` (npm, Homebrew, or a package manager install);
3. falls back to the lockfile-installed `node_modules/@opencode/cli/bin/opencode.exe`;
4. probes `--version` and requires major `2`, warning when the patch is not `2.0.32`;
5. rejects unsupported platforms before probing anything.

The Render/private-hosted supervisor (`src/server/render-start.ts`) uses the same resolver. Its only Render-specific behavior is environment configuration (`OPENCODE_DATA_HOME`, `OPENCODE_CONFIG_HOME`, `OPENCODE_PORT`, and the loopback bind). Local development never starts that supervisor and never depends on a Linux executable path. Default XDG locations are derived from `UB_DATA_DIR` or the host temporary directory, not a hardcoded `/tmp` or `/var/data` path.

### Runtime diagnostics

| Code | Severity | Meaning |
|---|---|---|
| `OPENCODE_PLATFORM_UNSUPPORTED` | error | Host is not Linux x64, macOS arm64, or macOS x64. |
| `OPENCODE_CLI_MISSING` | error | No usable executable on `PATH` or in the local package. |
| `OPENCODE_CLI_PERMISSION_DENIED` | error | Candidate exists but cannot be executed by this user. |
| `OPENCODE_CLI_VERSION_INCOMPATIBLE` | error | Major version is not `2`, or no version was reported. |
| `OPENCODE_CLI_VERSION_UNTESTED` | warning | A different `2.x` patch is in use. |
| `OPENCODE_SERVER_START_FAILED` | error | The child server exited before answering `/api/info`. |

Diagnostics contain no executable path, credential, prompt, or model output. `npm run diagnose:platform` prints resolution only; `npm run smoke:opencode` starts the resolved server with disposable XDG directories, reads `/api/info` with a generated in-memory password, and stops it without a prompt or model call.

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

### Run observability and recovery surface (Upgrade Phase 2)

Live run progress and late-result recovery use the same bounded transport:

| Purpose | Endpoint(s) / mechanism |
|---|---|
| Run progress phases | Directed guide callbacks plus safe polling: `GET /api/session/:sessionID` (outcome/idle), `GET /api/session/:sessionID/message` (assistant presence), `GET /api/permission/request` (pending permission) |
| Late reply retrieval | `GET /api/session/:sessionID/message` (latest assistant message), validated against the same reply schemas as a live completion |
| Late diff retrieval | `GET /api/session/:sessionID/diff`, re-read after recovery and validated before application |
| Permission still pending | `GET /api/permission/request?location.directory=…` |
| Not used yet | `GET /api/event` (SSE) — inspected in `@opencode/client` 2.0.32; safe polling was chosen because the app's response-size-capped, policy-checked transport is built for bounded responses (see `docs/DECISIONS.md` U2-01) |

Progress content is limited to fixed safe phase summaries; prompts, model output, and raw JSON are never recorded as progress or displayed as partial output.

### Oracle discovery contract (Upgrade Phase 3)

Oracle receives the complete `docs/prompts/00_product_discovery.md` procedure followed by a persistence adapter. The adapter supplies only product-safe source context, active structured memory, the latest redacted user message, and the schema required to save the result. Canonical local paths, provider credentials, raw prior output, and superseded private details are not sent.

The expected reply has `questions` or `proposal` mode, no more than three questions with `whyItMatters` and optional choices, a complete consolidated intake snapshot, assumptions, known constraints, unresolved risks, and a recommended next action. The application validates this shape before persistence. It additionally rejects proposal mode until the source is confirmed and intended user, problem, desired outcome, and must-have features are either user-known or explicitly accepted as stated assumptions.

Project-source import itself does not use OpenCode. A public HTTPS repository is cloned by the application into its private managed root only after explicit confirmation. Selecting or importing that source does not expand Maker permissions: this phase retains Maker's existing isolated workspace boundary.

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

The model comes from OpenCode's discovered catalog. There is no fixed model and no universal reasoning scale.

- A selected model must be reported as available.
- A selected variant must be one the model reports.
- New projects default to **All accessible models** and allow any model OpenCode reports as available, including paid and unknown-price remote models.
- A project may deliberately switch to **Free and local only**; paid and unknown-price remote models are then blocked at selection and again before a run.
- A paid or unknown-price remote model requires an explicit first-use confirmation. The confirmation timestamp is stored in project state and is required before the first request as well as before selection.
- A local model is allowed in either mode because it does not create an OpenCode provider charge in the normal local-runtime configuration.
- The app never invents, substitutes, or auto-fallbacks to a different model.
- If a selected model disappears, a Maker run is blocked until a currently reported model is selected.
- A migrated v1/v2/v3 project keeps its previous free/local policy and selected identity where present.

## Application roles

| Application role | Preferred custom agent | Tested fallback | Purpose |
|---|---|---|---|
| Oracle | `oracle` / `ub-oracle` | `plan` | Run focused multi-turn discovery, preserve structured answers, and propose only when intake is sufficient. |
| Architect | `architect` / `ub-architect` | `plan` | Draft one section at a time with read-only tools. |
| Maker | `maker` / `ub-maker` | `build` | Perform the approved, bounded edit in the isolated demo workspace. |
| Witness | `witness` / `ub-witness` | `plan` | Review evidence from a fresh session. |

The mapping is discovered from `/api/agent`; the current mapping and fallback are shown in the OpenCode panel. If neither a custom agent nor the fallback is visible, session creation uses OpenCode's default and the limitation is visible.

Read-only roles receive session permissions denying `edit`, `shell`, and `external_directory`. Maker receives `edit` allowed while `shell` and `external_directory` remain denied. These application rules supplement, but do not replace, OpenCode's own permission engine.

## Permissions

Pending requests are read from OpenCode and filtered to project-owned sessions. A pending request renders as a contextual alert outside collapsed controls, and the UI offers `Allow once`, `Always`, and `Reject`; it never auto-approves. `Always` asks OpenCode to save the proposed pattern, which may be broad. The application cannot override a configured `deny`. A Maker run that is waiting for permission is recorded as `WAITING_PERMISSION`, not success or failure. Permission polling is best-effort and may lag one refresh interval.

## Sessions, usage, and controls

These controls live in **Advanced diagnostics**, which loads sessions and usage only when the user opens it.

- **List/resume** is restricted to project-owned sessions.
- **Interrupt** is exposed for the selected project session and an active Maker run. Cancellation requests a native interrupt; if interruption fails, the operation is not marked cancelled.
- **Fork** is available only for a session with messages. A new fork is not silently rebound to a product role.
- **Compact** queues a compaction; OpenCode may report `compaction.unavailable` for a short session.
- **Revert** requires a message ID. Stage/clear/commit are advanced controls; OpenCode enforces busy/empty-session errors.
- **Usage** is shown only when OpenCode returns session cost/token values. Quota and balance are not exposed by the HTTP API.
- **Tool catalog** is deferred because OpenCode `2.0.32` does not expose a separate HTTP tool list.
- **Formatter/LSP status** is configuration presence only, not a live health check.
- **Arbitrary session enumeration** is deliberately not exposed.
- The raw project transcript is shown in Advanced diagnostics, not in the primary workshop.

## Timeouts, budgets, and failure mapping

| Control | Default | Behavior |
|---|---:|---|
| Guide timeout | 90s | Timeout is an abandoned/failed native operation; no silent re-prompt. |
| Maker timeout | 180s | `ABANDONED`; reconcile before another run. A late result is not silently applied. |
| Node check timeout | 30s | Failure is recorded as evidence; no passing claim. |
| Session token budget | 200k | Exceeding it is a non-retryable budget failure with the native session retained. |
| Session cost budget | unlimited | Optional deployment and per-project USD limits. The stricter limit wins. `0`, `disabled`, or `unlimited` disables the deployment limit. Cost is checked against values OpenCode reports for the session. |
| Provider rate/quota | — | Structured `PROVIDER_RATE_LIMIT`/`PROVIDER_QUOTA`; no automatic retry. |

A per-session tool-call budget is not enforced because OpenCode's stats API is not a reliable per-session counter. This limitation is exposed at `/api/runtime` and in the UI.

### Provider failures

Provider failures are normalized by `src/server/opencode/provider-errors.ts` into one of:

`PROVIDER_DATA_POLICY`, `PROVIDER_AUTH`, `PROVIDER_RATE_LIMIT`, `PROVIDER_QUOTA`, `MODEL_UNAVAILABLE`, `MODEL_CONTEXT_LIMIT`, `PROVIDER_TEMPORARY`, or `UNKNOWN_PROVIDER_FAILURE`.

Each error records a human explanation, whether saved work changed, a recommended repair, a retry/change-model action, retryability, and a technical block containing the provider, status code, provider code, project-owned session reference, a `provider-…` diagnostic reference, and a redacted safe detail. Authorization headers, API keys, passwords, cookies, and local paths are removed before the value leaves the server.

The **Workspace privacy** preference (`PROVIDER_DEFAULT` or `NO_TRAINING_REQUIRED`) is stored with the project and shown beside the selected model. OpenCode does not expose every provider's training/retention contract, so this app cannot attest provider terms. A provider rejection that mentions training, privacy, data policy, or a data-use preference is classified as `PROVIDER_DATA_POLICY` with a `review-privacy` repair action instead of a generic failure.

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
- A public sample must not ask visitors for provider keys; it has no OpenCode connection at all.
- A remote OpenCode target is possible only with explicit allowlisting and a non-private resolved address. No remote browser-to-local pairing is implemented.
