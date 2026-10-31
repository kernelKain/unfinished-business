# OpenCode integration policy

Unfinished Business is a thin client of an OpenCode 2.x server. It does not fork OpenCode, implement a second model client, or manage provider credentials. Provider keys remain in OpenCode’s own auth storage.

## Onboarding

1. Install the pinned OpenCode 2.0.32 CLI/package for the platform and start a server:

   ```bash
   OPENCODE_SERVER_PASSWORD="choose-a-long-random-password" \
     opencode serve --hostname 127.0.0.1 --port 4096
   ```

2. Put the same value in the app’s gitignored `.env`:

   ```dotenv
   OPENCODE_BASE_URL=http://127.0.0.1:4096
   OPENCODE_PASSWORD=the-same-password
   ```

3. Confirm the required free model appears in the native catalog:

   ```text
   opencode/deepseek-v4.1-flash-free
   ```

4. Start the app and open `/api/engine`. A compatible response must show `available`, `versionCompatible`, `authenticated`, and `modelAvailable` as true. The app does not silently fall back to a paid or substituted model.

5. Run the browser journey. The UI must show the mode, demo-workspace boundary, elapsed/token limits, and any recovery state.

## URL policy

| Rule | Behavior |
|---|---|
| scheme | only `http:`/`https:`; credentials, query, and fragment are rejected |
| default | `http://127.0.0.1:4096` (loopback) |
| non-loopback | HTTPS required |
| non-loopback allowlist | host must be listed in `UB_OPENCODE_ALLOWED_HOSTS` (exact hostname, no wildcard) |
| ports | port 0 is rejected; if `UB_OPENCODE_ALLOWED_PORTS` is set, the effective port must be listed |
| development exception | `UB_OPENCODE_ALLOW_INSECURE_REMOTE=true` is honored only in `local` mode with `NODE_ENV` not `production`; it still requires the host allowlist |
| DNS/IP validation | every request re-resolves; metadata (`169.254.169.254`, `fd00:ec2::254`), link-local, multicast, unspecified, loopback rebinding, and private addresses are rejected unless `UB_OPENCODE_ALLOW_PRIVATE_NETWORK=true` for an intended private network |
| redirects | not followed; a 3xx response is a policy error |
| timeouts | `UB_OPENCODE_REQUEST_TIMEOUT_MS` (default 300s) |
| response size | `UB_OPENCODE_MAX_RESPONSE_BYTES` (default 8 MiB), enforced by Content-Length and a streaming counter |
| credentials | HTTP Basic `opencode:<OPENCODE_PASSWORD>`; the password is never logged, exported, or rendered |

The allowlist is deliberately explicit. Private-hosted deployments that need a remote private-network OpenCode must set both the allowlist and `UB_OPENCODE_ALLOW_PRIVATE_NETWORK=true`, and should document why that network is acceptable.

## Version, authentication, and mutation gate

Before a mutating native call the guide performs a readiness check:

1. `server.info()` succeeds;
2. the server version starts with `2.` (`REQUIRED_OPENCODE_MAJOR=2`);
3. authentication succeeds;
4. `model.list()` contains exactly `opencode/deepseek-v4.1-flash-free`.

Failures map to `ENGINE_UNAVAILABLE`, `ENGINE_INCOMPATIBLE`, `ENGINE_AUTH`, or `MODEL_UNAVAILABLE`. A failed readiness check means no prompt was sent. Readiness is cached briefly (5 seconds) to avoid duplicate probes, but every HTTP request is still URL/DNS revalidated by the safe fetch.

## Sessions and permissions

| Role | Workspace | Native permissions | Mutation |
|---|---|---|---|
| Oracle | `spirit-workspace` | edit/shell/external-directory denied | none |
| Architect | `spirit-workspace` | edit/shell/external-directory denied | none |
| Maker | `demo-workspace` | shell/external-directory denied, edit allowed | bounded edit inside the isolated demo workspace |
| Witness | fresh session, `spirit-workspace` | edit/shell/external-directory denied | none |

The application’s Maker scope is separate from native permission. A native denial always wins; the app never auto-approves a pending native request. The only application-owned command is a bounded `node --test` in the demo workspace after an explicit scope grant and an observed native diff.

## Retry and idempotency policy

- No automatic retry of a native prompt, generation, edit, or check.
- One action ID maps to one payload hash and one result. A duplicate returns the stored result; a different payload conflicts.
- A timeout/network/unknown outcome becomes `UNKNOWN` and requires reconcile. It is never replayed as if it had not happened.
- Provider 429/quota responses are visible as `PROVIDER_LIMITED`; the operator may manually retry after the limit clears.
- A short/empty assistant reply is a malformed response, not a reason to silently prompt a second time.
- Cancellation first asks the native session to interrupt; if interruption fails, the operation is not marked cancelled.

## Budgets and provider gaps

OpenCode exposes session cost/tokens through `SessionInfo`, so the app enforces `UB_MAX_SESSION_COST_USD` (default 0) and `UB_MAX_SESSION_TOKENS`. It also enforces elapsed time for guide/Maker/Node-check calls. OpenCode’s `session.stats` is project/range-oriented, so a reliable per-session tool-call budget is not available; this gap is stated in `/api/runtime` and the UI rather than claimed as enforcement.

## Local development troubleshooting

| Symptom | Check |
|---|---|
| `ENGINE_UNAVAILABLE` | `opencode serve` is running on the configured loopback port; `/api/engine` |
| `ENGINE_AUTH` | `OPENCODE_PASSWORD` matches the server’s printed/`OPENCODE_SERVER_PASSWORD` value |
| `ENGINE_INCOMPATIBLE` | server is 2.x; the pinned client is `@opencode/client@2.0.32` |
| `MODEL_UNAVAILABLE` | free DeepSeek appears in the native model catalog |
| `OPENCODE_HOST_BLOCKED` | remote URL is in `UB_OPENCODE_ALLOWED_HOSTS`; HTTPS is used |
| `OPENCODE_PRIVATE_ADDRESS` | DNS resolves to metadata/private/loopback; use a loopback target or intentionally enable private-network policy |
| `OPENCODE_REDIRECT_BLOCKED` | the target redirects; point directly at the OpenCode origin |
| `NATIVE_UNKNOWN` | reconcile in the UI; inspect the native session before a new run |
| `PERMISSION_PENDING` | resolve the request in OpenCode, then reconcile |
