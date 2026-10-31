# Hosted deployment

Two hosted shapes are supported:

- **`hosted-demo`** — the public Render blueprint in this repository. One service, one private OpenCode child process, one persistent disk, isolated demo workspace.
- **`private-hosted`** — a private server or container behind your own TLS/proxy. The same application, with explicit public origin and a private data disk.

Neither shape provides multi-tenant isolation or arbitrary-repository execution.

## Hosted requirements

| Control | Requirement |
|---|---|
| `UB_MODE` | `hosted-demo` or `private-hosted` |
| `UB_ACCESS_PASSWORD` | required; HTTP Basic Auth gate |
| `UB_ACCESS_USERNAME` | optional; defaults to `unfinished-business` |
| `UB_SESSION_TOKEN` | required; long random value, stable across restarts |
| `UB_PUBLIC_URL` or `RENDER_EXTERNAL_HOSTNAME` | required; explicit HTTPS origin for Host/Origin checks |
| `UB_HOST` | `0.0.0.0` behind the proxy |
| `UB_DATA_DIR` | a dedicated persistent disk path, never `/`, home, repo root, or `/var/data` itself |
| `OPENCODE_BASE_URL` | loopback child (`http://127.0.0.1:4096`) or an allowlisted HTTPS origin |
| `OPENCODE_PASSWORD` | required when the native server uses Basic Auth |
| `UB_TRUST_PROXY` | `true` (default in hosted modes) so `x-forwarded-proto`/client forwarding is considered |
| Sentry | optional; DSNs are public identifiers, auth token is a build secret |

`UB_MODE=hosted-demo` requires a public URL and HTTPS. The config loader refuses a missing token/password or a non-HTTPS public URL (loopback exceptions only).

## Render blueprint

`render.yaml` creates one paid Linux x64 Node service with a 1 GB disk:

- `npm ci && npm run typecheck && npm test && npm run build`
- `npm run start:render`
- public health check at `/api/health`
- generated `UB_ACCESS_PASSWORD`, `UB_SESSION_TOKEN`, `OPENCODE_PASSWORD`
- `OPENCODE_BASE_URL=http://127.0.0.1:4096`
- XDG paths for OpenCode inside `/var/data`
- `UB_MODE=hosted-demo` and `UB_PUBLIC_URL` derived from `RENDER_EXTERNAL_HOSTNAME`

Create the service:

1. Push the deployment commit to GitHub.
2. In Render, choose **New → Blueprint** and connect the repository.
3. Review the region/instance/disk before applying. A disk-backed service cannot be moved between regions in place.
4. Supply the three `sync: false` values: `SENTRY_DSN`, `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`.
5. Apply. Render generates the auth, session, and OpenCode passwords.
6. Open the service URL; sign in with `unfinished-business` and the generated `UB_ACCESS_PASSWORD`.

Verify:

1. `/api/health` returns `{"status":"ok","service":"unfinished-business"}` without auth.
2. The app loads only after Basic Auth.
3. `/api/runtime` (after auth + session token) reports the hosted mode, demo workspace, and limits.
4. `/api/engine` reports OpenCode 2.0.32, authentication, and the free model.
5. Sentry server/browser events use the same release as the uploaded source maps.
6. A restart preserves `project.json`, backups, and the demo workspace on the disk.

## Private-hosted deployment

```dotenv
UB_MODE=private-hosted
UB_HOST=0.0.0.0
UB_PORT=4200
UB_PUBLIC_URL=https://workshop.example.com
UB_ACCESS_USERNAME=unfinished-business
UB_ACCESS_PASSWORD=<long-random>
UB_SESSION_TOKEN=<long-random>
UB_DATA_DIR=/srv/unfinished-business
OPENCODE_BASE_URL=http://127.0.0.1:4096
OPENCODE_PASSWORD=<matches the native server>
UB_TRUST_PROXY=true
```

Put a TLS-terminating proxy in front and forward `Host`, `X-Forwarded-Proto`, and `X-Forwarded-For`. The app accepts only the explicit public host/origin plus loopback. Do not enable `UB_OPENCODE_ALLOW_INSECURE_REMOTE` in a hosted mode; it is local-development only.

If OpenCode runs on another host, set:

```dotenv
OPENCODE_BASE_URL=https://opencode.internal.example.com
UB_OPENCODE_ALLOWED_HOSTS=opencode.internal.example.com
# only if that host intentionally resolves to a private address
UB_OPENCODE_ALLOW_PRIVATE_NETWORK=true
```

Treat that allowlist as a security decision. Metadata/link-local/loopback rebinding remains blocked.

## Authentication and browser behavior

- Basic Auth is required for every route except `/api/health`.
- After Basic Auth, the browser fetches `/api/session` and sends `x-ub-session-token` on every state/mutation/SSE request.
- Origin and `Sec-Fetch-Site` checks reject cross-site requests.
- Mutations require `application/json`, a bounded body, the session token, and a free mutation slot.
- `/api/events` is authenticated and counts against `UB_MAX_SSE_CONNECTIONS`; the browser UI currently polls rather than using EventSource.

## Persistent disk and operations

- The disk holds `project.json`, `.previous`, `backups/`, `corrupt-*`, `demo-workspace/`, `spirit-workspace/`, and OpenCode XDG data/config.
- Backups and quarantine files are pruned by count/age. See [OPERATIONS_AND_RECOVERY.md](OPERATIONS_AND_RECOVERY.md).
- Never delete the disk or state to fix a bad load. Preserve corrupt files and restore a known backup after stopping the app.
- Rotating `UB_ACCESS_PASSWORD` or `UB_SESSION_TOKEN` invalidates access/sessions; Render redeploys on env changes.
- Rotate leaked OpenCode/Sentry credentials and redeploy.

## Troubleshooting

| Symptom | Check |
|---|---|
| 421 `INVALID_HOST` | `UB_PUBLIC_URL`/`RENDER_EXTERNAL_HOSTNAME` matches the requested host and the proxy preserves `Host` |
| 403 `INVALID_ORIGIN` | browser origin is exactly `https://<public host>`; `UB_ALLOWED_ORIGINS` if a second origin is intentional |
| 401 on API/static | Basic Auth credentials; `UB_ACCESS_PASSWORD` was regenerated |
| 403 `INVALID_SESSION` | reload the page; token/session may have rotated |
| App starts but `/api/engine` is 503 | OpenCode child failed; inspect `start:render` logs for the exit code without printing env values |
| `STATE_DISK_FULL` | free disk; rotate backups; the app preserves the previous state |
| `STATE_CORRUPT` | inspect disk; restore a backup; do not initialize over it |
| `OPENCODE_PRIVATE_ADDRESS` | remote OpenCode resolves to a blocked address; correct DNS or intentionally set the private-network flag |
| Health passes but app cannot load | Basic Auth/JS asset fetch failed; check CSP and proxy headers |

## Residual risks

Shared-host isolation is **not** provided. Maker edits only the isolated demo workspace and native permissions deny shell/external-directory actions, but a malicious project dependency executed by the Node check is not sandboxed. Do not offer this deployment to mutually untrusted users. The remote connector/arbitrary repository support is deliberately deferred; `private-hosted` does not add it.
