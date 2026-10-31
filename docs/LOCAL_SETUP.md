# Local setup

This guide starts from a clean checkout on Linux. OpenCode is the only coding harness; Unfinished Business adds the workshop UI, staged approvals, evidence, and connection/discovery controls.

## Prerequisites

- Node.js `22.14` or newer and npm.
- A terminal on the same machine as the workshop.
- OpenCode `2.x`; the tested version is `2.0.32`.

The repository pins the matching client and Linux baseline CLI:

```bash
npm ci
```

## 1. Start OpenCode

```bash
opencode serve --hostname 127.0.0.1 --port 4096
```

If `opencode` is not on `PATH`, install it using the official method for your platform:

```bash
curl -fsSL https://opencode.ai/v2/install | bash
```

OpenCode prints a server password. Keep it out of the repository. The workshop uses it only for its own server-side Basic-auth connection.

For a disposable check without touching your normal OpenCode state, use temporary XDG directories:

```bash
mkdir -p /tmp/ub-opencode
XDG_DATA_HOME=/tmp/ub-opencode/data \
XDG_CONFIG_HOME=/tmp/ub-opencode/config \
XDG_CACHE_HOME=/tmp/ub-opencode/cache \
XDG_STATE_HOME=/tmp/ub-opencode/state \
OPENCODE_SERVER_PASSWORD='choose-a-local-password' \
opencode serve --hostname 127.0.0.1 --port 4096
```

## 2. Check the OpenCode surface (optional)

From the repository:

```bash
OPENCODE_LIVE_DIAGNOSTIC=1 \
OPENCODE_BASE_URL=http://127.0.0.1:4096 \
OPENCODE_PASSWORD='the same server password' \
npm run diagnose:opencode
```

This connects, lists the catalog, and creates/reads/removes one empty session. It performs no prompt or model inference. Without the opt-in flag it prints `SKIP`.

## 3. Start Unfinished Business

```bash
npm run dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` to the application server on `UB_PORT` (default `4200`). For the built app:

```bash
npm run build
npm start
```

Then open `http://127.0.0.1:4200`.

Configuration is read from a gitignored `.env`; use `.env.example` as the safe template:

```dotenv
OPENCODE_BASE_URL=http://127.0.0.1:4096
# Optional for interactive local use. The wizard can hold it in memory instead.
OPENCODE_PASSWORD=
UB_PORT=4200
UB_HOST=127.0.0.1
UB_DATA_DIR=.unfinished-business
UB_DEPLOYMENT_MODE=local
```

Do not put provider API keys in `.env`. Provider keys belong in OpenCode.

## 4. Connect through the first-run wizard

1. Start OpenCode and keep the terminal open.
2. Enter the server URL. Loopback HTTP is allowed locally. Any non-loopback URL must use HTTPS.
3. Enter the password printed by `opencode serve`. OpenCode expects the Basic-auth username `opencode`; it is fixed by the server.
4. Select **Test connection**. This is read-only: `/api/info`, the model/provider catalog, agents, permissions, commands, skills, MCP, and config. No model call is made.
5. Read the provider readiness and choose a model. Only models reported by OpenCode are shown.
6. Choose a variant only if the selected model reports one. **Model default** sends no explicit variant.
7. Select **Use this model**. The choice is stored in the project's `engine` selection; the next Maker run records the model in its operation and evidence.

### Provider accounts and models

Provider setup is OpenCode's job:

```text
/connect    # choose a provider and enter its credentials inside OpenCode
/models     # choose a model
```

Alternatively set provider environment variables for the OpenCode server, or configure `opencode.jsonc`. The workshop never reads those credentials.

If the catalog is empty, the workshop reports `NO_MODELS` and links the repair; it does not ask for a provider key.

## Troubleshooting

| Symptom | Meaning | Repair |
|---|---|---|
| `authentication_required`, HTTP 401 | The password is missing or does not match the server. | Enter the exact password printed by `opencode serve`, or set `OPENCODE_PASSWORD` for the app process. The OpenCode server may need to be restarted with a stable password. |
| `unavailable`, `Transport: fetch failed` / `ECONNREFUSED` | Nothing is listening at that URL. | Start `opencode serve`, confirm the hostname/port, and retry. |
| `incompatible_version` | Server major version is not 2. | Install a 2.x OpenCode, or update Unfinished Business. Discovery stops rather than guessing an older API. |
| `degraded` with `VERSION_UNTESTED` | A 2.x patch differs from the tested `2.0.32`. | Run `npm run diagnose:opencode`. Treat unfamiliar controls as unverified until the diagnostic passes. |
| `ORIGIN_BLOCKED` / 403 | A proxy, hostname, CORS/origin rule, or server policy rejected the request. | This app connects server-side, so browser CORS is not required. Check `--hostname`, reverse-proxy headers, and OpenCode's CORS/origin settings. |
| `PROVIDER_NOT_CONNECTED` | OpenCode reports a provider connection that needs sign-in. | Run `/connect` inside OpenCode and retry discovery. |
| `MODEL_UNAVAILABLE` / `MODEL_DISABLED` | The saved model disappeared or its provider is disabled. | Choose another reported model in the OpenCode panel. The app does not silently substitute. |
| `VARIANT_UNAVAILABLE` | The saved variant is not attached to the model anymore. | Choose **Model default** or a reported variant. |
| `LOCAL_MODEL_LIMITS` | A local model reports a small context/output window. | Reduce scope, increase the runtime's context/output, or choose a larger model. OpenCode cannot report free RAM/VRAM. |
| No models after connecting | The provider catalog is empty or signed out. | Finish `/connect` in OpenCode, run `/models`, then retry discovery. |
| Wizard password forgotten after app restart | The server password is memory-only. | Re-enter it, or set `OPENCODE_PASSWORD` for non-interactive starts. It was never written to project JSON or browser storage. |
| Port already in use | Another process owns `4200` or `5173`. | Set `UB_PORT` / Vite's port; do not kill unrelated processes. |

## Data and privacy

- `UB_DATA_DIR` (default `.unfinished-business/`) is gitignored and contains `project.json`, `connection.json`, the isolated demo workspace, and the spirit workspace.
- `connection.json` stores the URL, auth mode, username, and a “password previously configured” flag. It never stores the password.
- The password is held in the application process only (or supplied through `OPENCODE_PASSWORD`).
- The browser stores no provider keys, no OpenCode password, and no session token beyond the current page memory.
- Exports contain the project, plan, drafts, and selected engine metadata; they do not contain connection secrets.

## Verification commands

```bash
npm run typecheck
npm test
npm run build
npm run test:workflow
npm run test:recovery
```

The onboarding end-to-end check uses a mock OpenCode boundary and a real built browser app; see `docs/IMPLEMENTATION_PLAN.md`.

## Related documents

- [OpenCode integration contract](OPENCODE_INTEGRATION.md)
- [Hosted deployment](HOSTED_DEPLOYMENT.md)
- [Architecture](ARCHITECTURE.md)
- [UX and visual system](UX_AND_VISUAL_SYSTEM.md)
