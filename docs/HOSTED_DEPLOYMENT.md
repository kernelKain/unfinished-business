# Hosted and private deployment

**Status:** Phase 7 adds the public hosted-demo behavior. `render.yaml` still defines the private hosted instance; no public URL is asserted by this document.
**Last updated:** 2026-10-31.

## What a hosted instance is

A hosted instance serves the same build as local mode:

- `/` — the landing page.
- `/demo` — the deterministic walkthrough, clearly labeled as a scripted fixture.
- `/workshop` — the real four-stage workshop.
- `/api/*` — the validated local API.

The instance is **private**: it requires HTTP basic authentication for everything except `/api/health`. The OpenCode server binds to loopback inside the same container. The workshop uses the server's isolated data directory, never a visitor's local repository.

A hosted instance is **not**:

- a public sandbox for arbitrary code execution;
- a remote mount of the visitor's checkout;
- proof that a free model route is available;
- a substitute for the real local workflow when demonstrating actual execution.

## Public hosted demo

`UB_DEPLOYMENT_MODE=hosted-demo` serves the public guided example without OpenCode, provider credentials, a repository, a session token, or user-specific persistence:

| Behavior | Hosted demo |
|---|---|
| Routes | `/`, `/demo`, `/workshop` are public; `/api/health` and `/api/mode` are public |
| API reads | `/api/project` and `/api/export` return the versioned fixture |
| API writes | Every non-GET `/api/*` request returns `403 DEMO_READ_ONLY` before a body is parsed |
| Session token | `/api/session` returns `403`; no token is issued |
| OpenCode | `/api/opencode/*` returns `403`; no server is contacted |
| Connection | `/api/connection` returns a read-only `hosted-demo` status with no engine address |
| Repository | None. The fixture workspace is `demo://campus-umbrella-relay` |
| Persistence | No visitor state is written; reloading returns the same sample |
| Inference | Zero model/provider calls |
| Reset | The demo's Reset control changes only client playback state |

The `/demo` page is fully usable without credentials. The `/workshop` route in this mode shows a read-only notice and clean exits to the guided example or local setup. The server rejection is independent of the UI, so bypassing the browser cannot reach a mutation.

A public hosted demo should not set `UB_ACCESS_PASSWORD` or start `render-start.ts` (which starts OpenCode). Use `npm start` with `UB_DEPLOYMENT_MODE=hosted-demo`. The optional `render.demo.yaml` template does exactly that on a free service; the private hosted instance in `render.yaml` remains `hosted-private` and requires basic auth. Deploying either template is a separate, explicit action.

## Render configuration

`render.yaml` defines:

| Setting | Value/behavior |
|---|---|
| Runtime | Node 22.14 |
| Build | `npm ci && npm run typecheck && npm test && npm run build` |
| Start | `npm run start:render` |
| Health check | `/api/health` (public) |
| Disk | 1 GB mounted at `/var/data` |
| Host binding | `UB_HOST=0.0.0.0` |
| Deployment policy | `UB_DEPLOYMENT_MODE=hosted-private` |
| Data | `UB_DATA_DIR=/var/data/unfinished-business` |
| Access | `UB_ACCESS_USERNAME` + generated `UB_ACCESS_PASSWORD` |
| OpenCode | Generated `OPENCODE_PASSWORD`; loopback `http://127.0.0.1:4096` |
| OpenCode storage | `/var/data/xdg-data`, `/var/data/xdg-config` |
| Sentry | DSN, auth token, and environment supplied as secrets/sync-false values |

`npm run start:render` starts the pinned OpenCode binary on loopback, starts the Hono server, and shuts both down together. If OpenCode exits unexpectedly, the app exits instead of pretending the engine is healthy.

The hosted service is **not compatible with Render's free plan**; it needs a persistent disk and enough memory for the OpenCode runtime.

### Deployment modes

| Mode | Connection editing | Credentials | Intended use |
|---|---|---|---|
| `local` | Browser can edit the URL and enter the server password in memory | `OPENCODE_PASSWORD` optional | Local development |
| `hosted-private` | Browser configuration is read-only | URL/password managed by the environment/secret store | Password-protected private instance |
| `hosted-demo` | Read-only | No provider-key prompt, no OpenCode, no session token, no visitor persistence | A public deterministic sample with the guided example |

The dashboard does not expose the OpenCode server password or provider keys. Provider accounts belong in OpenCode's credential store. In `hosted-demo`, an unconnected provider is an honest empty catalog, not an error to fake.

## Required secrets and values

Set these in the Render dashboard or your deployment secret store. Never commit them.

| Variable | Required | Notes |
|---|---|---|
| `UB_ACCESS_PASSWORD` | Yes in production | The server refuses to start without it when `NODE_ENV=production`. |
| `UB_ACCESS_USERNAME` | Recommended | Defaults to `unfinished-business`. |
| `UB_DEPLOYMENT_MODE` | Recommended | `local`, `hosted-private`, or `hosted-demo`; Render uses `hosted-private`. |
| `OPENCODE_PASSWORD` | Yes on Render | `render-start.ts` requires it and passes it to OpenCode. |
| `UB_SESSION_TOKEN` | Recommended | Generated by Render; protects mutations in addition to basic auth. |
| `SENTRY_DSN` | Optional | Server telemetry. |
| `VITE_SENTRY_DSN` | Optional | Browser telemetry. |
| `SENTRY_AUTH_TOKEN` | Required when uploading source maps in a Render build | The Vite config fails the build if `RENDER` is set without it. |
| `SENTRY_RELEASE` | Recommended with auth token | Must match the browser release. |
| `OPENCODE_BASE_URL` | Default `http://127.0.0.1:4096` | Keep loopback. |

Render generates `UB_ACCESS_PASSWORD`, `UB_SESSION_TOKEN`, and `OPENCODE_PASSWORD` if `generateValue: true` remains in `render.yaml`.

## Deployment checklist

1. Connect the repository and create the service from `render.yaml`.
2. Confirm the persistent disk is mounted at `/var/data` and is not the build directory.
3. Set the Sentry secrets if monitoring is enabled; otherwise ensure the build does not have a partial Sentry auth configuration.
4. Deploy and wait for `/api/health` to return `{"status":"ok"}`.
5. Open the service URL and confirm the browser asks for the access credentials.
6. Confirm the landing page and `/demo` load before authenticating? They do **not**; only `/api/health` is public. Authenticate first.
7. Open `/workshop`, confirm the engine badge, and verify that no paid model is configured.
8. Confirm `/api/session` is usable only after basic authentication, and that mutations still require the session token.
9. Check logs for OpenCode startup failure, missing password, or a missing disk.
10. Do not label the deployment as a public demo or a remote repository reader.

## Security boundary

- `UB_ACCESS_PASSWORD` is required in production; basic auth covers all routes except health.
- `hosted-private` and `hosted-demo` reject browser connection edits; the URL/password must come from the environment.
- `hosted-demo` rejects every non-GET `/api/*` request and does not issue a session token.
- Mutating API routes require the browser-session token and an expected project revision.
- The OpenCode server binds to `127.0.0.1`, not the public interface.
- Discovery drops provider settings, headers, bodies, skill contents, and prompt text before the browser sees it.
- Static serving is limited to `dist/web`; private state under `UB_DATA_DIR` is not served.
- Model output is parsed as a proposal, not authority. It cannot approve a section or grant Maker scope.
- App approval cannot override a native OpenCode denial.
- The hosted demo is fixture data; it does not call a model.

## Rollback and operations

- Roll back by redeploying a previous commit or Render deploy; the persistent disk keeps project metadata across deploys.
- If the disk is lost, the project state is lost. Do not silently recreate a corrupt current snapshot; the store preserves the previous valid snapshot and reports corruption.
- If OpenCode exits, the process exits. Restart the service rather than serving a misleading healthy workshop.
- Rotate `UB_ACCESS_PASSWORD`, `OPENCODE_PASSWORD`, and `UB_SESSION_TOKEN` together if credentials leak.

## What the landing page may say

Approved:

> A hosted instance can show the deterministic walkthrough or run a private, password-protected workshop on the server's own isolated demo workspace.

> Password protection and a loopback OpenCode server are required for a hosted instance.

> Hosted execution is not a public sandbox; the sample is labeled as a sample.

Not approved:

> “Open your local repository from the hosted page.”

> “The public demo runs your code.”

> “Free model access is guaranteed.”

> Any live URL, user count, award, or endorsement that has not been verified.
