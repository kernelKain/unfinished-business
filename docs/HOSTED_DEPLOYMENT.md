# Hosted and private deployment

**Status:** Deployment procedure reviewable; no deployment or public URL authorized or asserted.
**Owner:** Engineering/deployment.
**Last verified:** 2026-10-31 by static Blueprint/config review and a local hosted-demo smoke run.

## Two hosted shapes

| Shape | Mode | Public? | OpenCode | Persistence | Template |
|---|---|---|---|---|---|
| Hosted sample | `hosted-demo` | Yes, read-only | None | No visitor state | `render.demo.yaml` |
| Private workshop | `private-hosted` | Password-protected | Loopback child | Private persistent disk | `render.yaml` |

Both serve the same build:

- `/` — landing page;
- `/demo` — labeled recorded Driftwatch sample;
- `/workshop` — real workshop (read-only notice in demo mode);
- `/api/*` — validated API.

A hosted instance is **not** a public sandbox, a remote mount of a visitor's checkout, proof of free-model availability, or a substitute for the local real-execution demonstration.

## Hosted sample behavior

`UB_DEPLOYMENT_MODE=hosted-demo` serves the public guided example without OpenCode, provider credentials, a repository, a session token, or visitor persistence:

| Behavior | Hosted sample |
|---|---|
| Routes | `/`, `/demo`, `/workshop` public; `/api/health` and `/api/mode` public |
| API reads | `/api/project` and `/api/export` return the versioned fixture |
| API writes | Every non-GET `/api/*` request returns `403 DEMO_READ_ONLY` before a body is parsed |
| Session token | `/api/session` returns `403`; no token is issued |
| OpenCode | `/api/opencode/*` is unavailable; no connection object is constructed |
| Connection | `/api/connection` returns a read-only demo status with no engine address |
| Repository | None. Sample workspace is `demo://driftwatch` |
| Persistence | No visitor state is written; reload returns the same sample |
| Inference | Zero model/provider calls |
| Reset | Changes only client playback state |

Do not set `UB_ACCESS_PASSWORD` or start `render-start.ts` for the demo. Use `npm start` with `UB_DEPLOYMENT_MODE=hosted-demo`; `render.demo.yaml` does that on a free service. The server rejection is independent of the UI.

### Local review of the demo

```bash
npm run build
UB_DEPLOYMENT_MODE=hosted-demo \
UB_HOST=127.0.0.1 \
UB_PORT=4319 \
UB_DATA_DIR=/tmp/opencode/ub-demo-smoke \
node --import tsx src/server/start.ts
```

Then verify:

```bash
curl -s http://127.0.0.1:4319/api/health
curl -s http://127.0.0.1:4319/api/project
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4319/api/session          # 403
curl -s -X POST -H 'content-type: application/json' \
  -d '{"actionId":"demo","expectedRevision":0}' \
  http://127.0.0.1:4319/api/runs                                                   # 403 DEMO_READ_ONLY
```

The Phase 9 smoke run passed these checks and confirmed `/demo` returns HTML.

## Private hosted configuration

`render.yaml` defines one paid Linux x64 Node web service:

| Setting | Value/behavior |
|---|---|
| Runtime | Node 22.14 |
| Plan | `0.5c-512mb`; persistent disk required |
| Build | `npm ci && npm run typecheck && npm test && npm run build` |
| Start | `npm run start:render` |
| Health check | `/api/health` (public, minimal) |
| Disk | 1 GB at `/var/data` |
| Host binding | `UB_HOST=0.0.0.0` |
| Deployment mode | `UB_DEPLOYMENT_MODE=private-hosted` |
| Data | `UB_DATA_DIR=/var/data/unfinished-business` |
| Access | `UB_ACCESS_USERNAME` + generated `UB_ACCESS_PASSWORD` |
| Session token | Generated `UB_SESSION_TOKEN` |
| OpenCode | Generated `OPENCODE_PASSWORD`; loopback `http://127.0.0.1:4096` |
| OpenCode storage | `/var/data/xdg-data`, `/var/data/xdg-config` |
| Origin policy | `RENDER_EXTERNAL_HOSTNAME` supplies the public HTTPS origin |
| Sentry | DSNs and auth token supplied as sync-false secrets |

`npm run start:render` starts the pinned OpenCode baseline binary on loopback, then the Hono server. It forwards termination to both and exits if OpenCode exits unexpectedly. It does not require a build tool on the runtime disk; the binary is pinned in the lockfile.

The private service is **not compatible with Render's free plan** because it needs a persistent disk and enough memory for OpenCode.

## Environment variables

Canonical mode is `UB_DEPLOYMENT_MODE` (`local`, `private-hosted`, `hosted-demo`). `UB_MODE` remains a compatibility alias; the legacy `hosted-private` spelling maps to `private-hosted`.

| Variable | Required | Notes |
|---|---|---|
| `UB_DEPLOYMENT_MODE` | Yes on Render | `private-hosted` for `render.yaml`; `hosted-demo` for `render.demo.yaml`. |
| `UB_HOST` | Yes on Render | `0.0.0.0` behind the proxy. Local mode must stay loopback. |
| `UB_PUBLIC_URL` | Private hosted | Explicit HTTPS origin. Render derives it from `RENDER_EXTERNAL_HOSTNAME`. |
| `UB_ALLOWED_HOSTS` / `UB_ALLOWED_ORIGINS` | Optional | Additional comma-separated host/origin entries. The public URL host/origin is added automatically. |
| `UB_TRUST_PROXY` | Hosted | Defaults to true in hosted modes; trust `X-Forwarded-*` only behind a controlled proxy. |
| `UB_ACCESS_PASSWORD` | Private hosted | Basic Auth password; the server refuses to start without it. |
| `UB_ACCESS_USERNAME` | Recommended | Defaults to `unfinished-business`. |
| `UB_SESSION_TOKEN` | Private hosted | Required; generated by Render. |
| `UB_DATA_DIR` | Yes | Dedicated persistent directory, e.g. `/var/data/unfinished-business`. |
| `UB_MAX_SESSION_COST_USD` | Optional | `unlimited` (default), `disabled`, or `0` for no app ceiling; a positive value sets a deployment-wide USD ceiling. A project limit can be stricter; cost is checked against OpenCode's reported value. |
| `OPENCODE_BASE_URL` | Yes | Keep `http://127.0.0.1:4096` for the private child. Remote targets require HTTPS + allowlist. |
| `OPENCODE_PASSWORD` | Private hosted | Required by `render-start.ts`; passed to OpenCode as both `OPENCODE_PASSWORD` and `OPENCODE_SERVER_PASSWORD`. |
| `OPENCODE_DATA_HOME` / `OPENCODE_CONFIG_HOME` | Private hosted | XDG paths on the persistent disk. |
| `UB_OPENCODE_ALLOWED_HOSTS` | Remote only | Explicit HTTPS host allowlist. |
| `UB_OPENCODE_ALLOWED_PORTS` | Optional | Comma-separated port allowlist. |
| `UB_OPENCODE_ALLOW_PRIVATE_NETWORK` | Rare | Only when a private network target is intended. |
| `SENTRY_DSN` / `VITE_SENTRY_DSN` | Optional | Public project identifiers, not auth tokens. |
| `SENTRY_AUTH_TOKEN` | Source maps only | Build secret; never `VITE_`-prefixed or committed. |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_URL` | Source maps only | Sentry project/region configuration. |

Do not set `SENTRY_RELEASE` manually on Render; both server and browser derive `unfinished-business@<RENDER_GIT_COMMIT>`.

## Reviewable deployment procedure

No step below was executed in Phase 9. Deployment is a separate authorized action.

1. Push the release commit to the intended repository. Do not push from this worktree without authorization.
2. In Render, create a Blueprint from `render.yaml` (private) or `render.demo.yaml` (public demo).
3. Review the service plan, region, disk mount, health check, and generated secrets before applying.
4. For the private service, supply the Sentry DSNs and optional auth token. Confirm the build fails rather than deploys without source maps when `SENTRY_AUTH_TOKEN` is present and required.
5. Apply. Confirm the disk is mounted at `/var/data` and is not the build directory.
6. Wait for `/api/health` to return `{"status":"ok","service":"unfinished-business"}`.
7. For the private service, open the URL and sign in with `unfinished-business` and the generated `UB_ACCESS_PASSWORD`. Confirm HTTPS and the host/origin policy.
8. For the demo, confirm `/api/session` is 403, `/api/project` returns the fixture, a mutation is `403 DEMO_READ_ONLY`, and `/api/engine` reports no OpenCode connection.
9. For the private service, open `/workshop`, run a connection check, and confirm the engine status. Do not claim a model call succeeded until the provider actually returns one.
10. Confirm logs contain correlation IDs but no passwords, prompts, bodies, provider keys, or local paths.
11. Verify Sentry release/source-map association only when authorized credentials and a deployment exist. Check the event release matches the uploaded maps and deploy.
12. Keep the public URL, deployment result, and any partner/competition claim out of documentation until separately verified.

## Security boundary

- Basic Auth covers every route except `/api/health` in private mode.
- The hosted demo is public but read-only; it issues no session token.
- Every protected API route in local/private modes requires the session token in addition to Basic Auth.
- Mutations require `application/json`, an expected project revision, and a unique action ID.
- Host/Origin/`Sec-Fetch-Site` checks, a request-size cap, per-client rate limit, and a non-blocking mutation gate apply.
- The private OpenCode server binds to `127.0.0.1`; remote targets need explicit HTTPS allowlisting.
- Static serving is contained to `dist/web`; private state is never served.
- Provider credentials stay inside OpenCode.
- Model output is a proposal, not authority; it cannot approve a section or grant Maker scope.
- App approval cannot override a native OpenCode denial.

## Rollback and operations

- Redeploy a previous commit or Render deploy. The persistent disk keeps project metadata across normal deploys.
- If the disk is lost, project state is lost. Preserve `project.json.previous`, `backups/`, and corrupt files when diagnosing.
- If OpenCode exits, the wrapper exits rather than serving a misleading healthy workshop. Restart the service.
- Rotate `UB_ACCESS_PASSWORD`, `OPENCODE_PASSWORD`, and `UB_SESSION_TOKEN` together if credentials leak.
- A public demo needs no backup; it stores no visitor state.
- See [OPERATIONS_AND_RECOVERY.md](OPERATIONS_AND_RECOVERY.md) for the failure matrix and recovery procedure.

## Approved and prohibited claims

Approved:

> A hosted instance can show the recorded Driftwatch sample or run a private, password-protected workshop on the server's own isolated demo workspace.

> Password protection and a loopback OpenCode server are required for the private instance.

> Hosted execution is not a public sandbox; the sample is labeled as a sample.

Not approved:

> “Open your local repository from the hosted page.”

> “The public demo runs your code.”

> “Free model access is guaranteed.”

> Any live URL, user count, award, sponsor endorsement, deployment result, or competition result that has not been verified.
