# Render deployment

The canonical hosted operations guide is [HOSTED_DEPLOYMENT.md](HOSTED_DEPLOYMENT.md). This page is the Render-specific checklist.

The repository includes a Render Blueprint in `render.yaml`. It creates one paid Linux x64 Node web service in `hosted-demo` mode that runs both Unfinished Business and a private OpenCode server. The OpenCode Linux baseline binary is pinned directly to avoid platform-detection install scripts in Render's build environment. A 1 GB persistent disk stores workflow state and OpenCode data.

## Create the service

1. Push the deployment changes to GitHub.
2. In Render, choose **New → Blueprint** and connect `kernelKain/unfinished-business`.
3. Review the service before applying it. The Blueprint selects Singapore and the `0.5c-512mb` paid instance because this application requires a persistent disk. Change the region before the first deployment if Singapore is not appropriate; a disk-backed service cannot be moved between regions in place.
4. Enter the three values marked `sync: false`:
   - `SENTRY_DSN`: the DSN for the `unfinished-business-server` Sentry project.
   - `VITE_SENTRY_DSN`: the DSN for the `unfinished-business-web` Sentry project.
   - `SENTRY_AUTH_TOKEN`: the current organization CI token with release/source-map permissions. Keep it only in Render's secret store.
5. Apply the Blueprint. Render generates `UB_ACCESS_PASSWORD`, `UB_SESSION_TOKEN`, and `OPENCODE_PASSWORD` automatically.

The two DSNs are also listed in `.env.example`. In Sentry, they are available under each project’s **Settings → Client Keys (DSN)**. Create or rotate the auth token under **Settings → Developer Settings → Custom Integrations**.

## Sign in and verify

When the deployment is live, open its `onrender.com` URL. The browser displays an HTTP Basic Auth prompt:

- Username: `unfinished-business`
- Password: copy `UB_ACCESS_PASSWORD` from the Render service’s **Environment** page.

Then verify:

1. `https://<service>.onrender.com/api/health` returns `{"status":"ok","service":"unfinished-business"}` without authentication.
2. The app URL requires authentication and loads after the credentials are entered.
3. The engine status reports OpenCode `2.0.32` and the configured free model as available.
4. Make one harmless workflow request, then confirm server and browser events show release `unfinished-business@<RENDER_GIT_COMMIT>` in Sentry.
5. Confirm the Render build log contains a successful Sentry source-map upload.

Render owns production builds and Sentry source-map uploads because it builds the exact browser bundle it serves. GitHub Actions only typechecks, tests, and verifies that a production bundle can be created; Render waits for those checks before deploying.

## Operational notes

- Do not select Render’s free plan. Free services cannot attach the persistent disk this stateful application requires.
- Render mounts the persistent disk only at runtime. The Blueprint therefore maps its `OPENCODE_*_HOME` settings to XDG paths inside the OpenCode child process instead of exposing `/var/data` to build tools.
- `/api/health` is intentionally public and minimal for Render health checks and a future Sentry uptime monitor. It returns only `status` and `service`; no mode, paths, versions, or debug details. All other application and API routes require HTTP Basic Auth, and state/mutation/SSE routes also require the loopback session token.
- `UB_MODE=hosted-demo`, `UB_TRUST_PROXY=true`, and `UB_REDACT_LOCAL_PATHS=true` are set by the Blueprint. `UB_PUBLIC_URL` is derived from `RENDER_EXTERNAL_HOSTNAME` so Host/Origin checks have an explicit HTTPS origin.
- `RENDER_GIT_COMMIT` supplies the release identifier to both browser builds and the running server. Do not set `SENTRY_RELEASE` manually on Render.
- Rotate `UB_ACCESS_PASSWORD` in Render whenever access should be revoked. Rotating it causes a redeploy. Rotating `UB_SESSION_TOKEN` invalidates existing browser sessions.
- The Sentry auth token is a build credential. Never prefix it with `VITE_` or commit it.
- Do not enable `UB_OPENCODE_ALLOW_INSECURE_REMOTE` in this mode. OpenCode stays on loopback.
- The persistent disk holds state, backups, quarantined corrupt files, and the isolated demo workspace. Never use `/` or `/var/data` itself as `UB_DATA_DIR`.
