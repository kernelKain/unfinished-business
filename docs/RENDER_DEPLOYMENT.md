# Render deployment

The repository includes a Render Blueprint in `render.yaml`. It creates one paid Linux x64 Node web service that runs both Unfinished Business and a private OpenCode server. The OpenCode Linux baseline binary is pinned directly to avoid platform-detection install scripts in Render's build environment. A 1 GB persistent disk stores workflow state and OpenCode data.

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
3. The connection status reports OpenCode `2.0.32` and a connected/discovered catalog. The OpenCode panel lists the providers and models that deployment's OpenCode instance reports; there is no fixed model.
4. The wizard is read-only in `hosted-private` mode. The URL and password come from the service environment/secret store, and provider accounts live in OpenCode's persistent XDG data.
5. Make one harmless workflow request, then confirm server and browser events show release `unfinished-business@<RENDER_GIT_COMMIT>` in Sentry.
6. Confirm the Render build log contains a successful Sentry source-map upload.

Render owns production builds and Sentry source-map uploads because it builds the exact browser bundle it serves. GitHub Actions only typechecks, tests, and verifies that a production bundle can be created; Render waits for those checks before deploying.

## Operational notes

- Do not select Render’s free plan. Free services cannot attach the persistent disk this stateful application requires.
- Render mounts the persistent disk only at runtime. The Blueprint therefore maps its `OPENCODE_*_HOME` settings to XDG paths inside the OpenCode child process instead of exposing `/var/data` to build tools.
- `/api/health` is intentionally public for Render health checks and a future Sentry uptime monitor. All other application and API routes require HTTP Basic Auth.
- `UB_DEPLOYMENT_MODE=hosted-private` keeps the connection UI read-only. Visitors cannot set the OpenCode URL or password, and the shared deployment never asks for provider keys.
- OpenCode provider credentials belong in OpenCode's persistent XDG data (`OPENCODE_DATA_HOME`, `OPENCODE_CONFIG_HOME`) or the OpenCode process environment. Do not add provider keys to this application's environment for forwarding.
- `RENDER_GIT_COMMIT` supplies the release identifier to both browser builds and the running server. Do not set `SENTRY_RELEASE` manually on Render.
- Rotate `UB_ACCESS_PASSWORD` in Render whenever access should be revoked. Rotating it causes a redeploy.
- The Sentry auth token is a build credential. Never prefix it with `VITE_` or commit it.
