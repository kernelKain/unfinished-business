# Local setup

**Status:** Verified local path.
**Owner:** Engineering.
**Last verified:** 2026-11-01 on Linux with Node 22.22.1, npm 9.2.0, Git, and the pinned OpenCode 2.0.32 binary. This guide is the source for the landing page's setup tabs.

## What you get

- Landing page at `http://127.0.0.1:5173/` (Vite).
- Real workshop at `http://127.0.0.1:5173/workshop`.
- Deterministic demo at `http://127.0.0.1:5173/demo`.
- API on `http://127.0.0.1:4200`.
- OpenCode on `http://127.0.0.1:4096`.

The browser app does not receive provider credentials or the OpenCode password. The local API connects to OpenCode over loopback.

## Prerequisites

- Linux (first release target), Node **22.14+**, npm, and Git (required only for confirmed remote repository imports).
- A supported OpenCode 2.x server. The repository pins `@opencode/cli-linux-x64-baseline@2.0.32`.
- At least one model route that answers on your OpenCode account, or a local model. The free `opencode/deepseek-v4.1-flash-free` route is still available when the provider reports it, but availability is time-limited and not guaranteed.
- A writable `UB_DATA_DIR` whose demo/spirit child directories stay inside that root. Do not point it at `/`, your home, the repository root, or a broad system directory.

New projects allow any model OpenCode reports as available. A paid or unknown-price remote model requires an explicit confirmation, and the optional spending limit is enforced only against cost OpenCode reports. There is no silent model substitution or automatic paid fallback.

## 1. Install

```bash
npm ci
```

The lockfile pins React 19, Vite 8, Motion 14, Playwright, the OpenCode 2.0.32 CLI, and Sentry. `npm ci` is the reproducible install; use it when verifying a release.

## 2. Create a local environment file (optional)

```bash
cp .env.example .env
```

`.env` is gitignored and optional for local work: the first-run connection panel can hold the OpenCode server password in memory. Set only what you need:

```dotenv
UB_DEPLOYMENT_MODE=local
OPENCODE_BASE_URL=http://127.0.0.1:4096
OPENCODE_PASSWORD=
UB_PORT=4200
UB_HOST=127.0.0.1
UB_DATA_DIR=.unfinished-business
```

`UB_DEPLOYMENT_MODE` is canonical (`local`, `private-hosted`, or `hosted-demo`). The legacy `UB_MODE` alias is accepted, but new setups should use `UB_DEPLOYMENT_MODE`.

- `OPENCODE_PASSWORD` must match the password printed by `opencode serve`, or the fixed `OPENCODE_SERVER_PASSWORD` you chose. Leave it blank only if your local server has no password.
- `UB_SESSION_TOKEN` may be blank; the server generates one for the local browser session.
- `UB_DATA_DIR` stores project metadata, confirmed managed repository imports, and the isolated demo and spirit workspaces. It is gitignored.
- Do not put provider API keys in `.env`. Provider accounts belong inside OpenCode.

The security and budget variables in `.env.example` have safe defaults. `UB_MAX_SESSION_COST_USD` defaults to `unlimited`; set a positive USD value to enforce a deployment-wide limit, or use `0`/`disabled` to disable it. A per-project limit can be stricter. Review timeouts, request limits, retention, and redaction before changing them.

## 3. Start OpenCode (terminal 1)

Use the pinned binary:

```bash
./node_modules/@opencode/cli-linux-x64-baseline/bin/opencode serve --hostname 127.0.0.1 --port 4096
```

If you already have a supported global OpenCode installation, this is equivalent:

```bash
opencode serve --hostname 127.0.0.1 --port 4096
```

OpenCode prints a generated server password. Copy it into `OPENCODE_PASSWORD` or enter it in the first-run wizard. Do not commit it.

A full model call was not repeated during the Phase 9 gate. The Phase 9 compatibility probe verified server version, catalog access, and disposable session create/read/remove without inference.

## 4. Start the API (terminal 2)

```bash
npm run dev
```

Expected log:

```text
Unfinished Business listening on http://127.0.0.1:4200
```

Health check:

```bash
curl http://127.0.0.1:4200/api/health
```

Expected:

```json
{"status":"ok","service":"unfinished-business"}
```

All other API reads require the browser session token. The browser obtains it from `/api/session` automatically. For manual curl checks:

```bash
TOKEN=$(curl -s http://127.0.0.1:4200/api/session | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).token')
curl -H "x-ub-session-token: $TOKEN" http://127.0.0.1:4200/api/project
```

`/api/session` is loopback-only in local mode. Do not paste tokens into logs or screenshots.

`npm run dev` deliberately does **not** use Node's `--watch` mode by default, because the pinned Node version tries to watch a missing `.env` and exits. If you have created `.env` and want reloads:

```bash
npm run dev:watch
```

## 5. Start the interface (terminal 3)

```bash
npm run dev:web
```

Open `http://127.0.0.1:5173/`. Vite proxies `/api` to `http://127.0.0.1:4200` (or `UB_PORT`).

The engine pill reflects `/api/connection`; it shows **OpenCode connected** only after the server answers, the major version is compatible, the catalog is readable, and no warning remains. `degraded`, `authentication_required`, `incompatible_version`, `unavailable`, and `not_configured` each carry a diagnostic and a repair action.

If OpenCode is reachable but no model is selected, `/workshop` opens the first-run connection/model panel. If OpenCode is unavailable, the workshop stays visible with the error and an **Open setup** action; it never invents a connection or model.

### First-run project source

Before Oracle or model onboarding, choose one source:

1. **New project** records that no repository exists yet.
2. **Existing local repository** validates an existing directory with the canonical workspace-security policy. Selection does not edit it, and its absolute path is never returned to the browser or sent to Oracle.
3. **Remote repository URL** accepts a public HTTPS owner/repository URL without embedded credentials, query parameters, fragments, private DNS, or a nonstandard port. The first action validates and stages it only. Review the managed-workspace notice, then explicitly confirm to clone it below `UB_DATA_DIR/managed-imports/`.
4. **Continue saved project** treats the existing durable project state as the discovery source.

Remote imports are unauthenticated and noninteractive. Private repositories, SSH URLs, credentialed URLs, and submodule credentials are not supported. A selected or imported repository is discovery context only in Phase 3; Maker continues to edit `UB_DATA_DIR/demo-workspace/`.

### First-run model selection

1. Start OpenCode and note the server password.
2. Enter the URL (`http://127.0.0.1:4096`) and password in the wizard. The password is held in memory; it is not written to project JSON, browser storage, logs, or Sentry.
3. Provider accounts are connected inside OpenCode with `/connect`; the app never asks for provider API keys.
4. The wizard lists only models OpenCode reports as available, including provider, local/remote locality, free/paid/unknown pricing, limits, modalities, tools, and reported variants.
5. Choose a model and, only if reported, a variant. The default access policy is **All accessible models**. Choose **Free and local only** to intentionally reject paid/unknown-price remote models.
6. For a paid or unknown-price remote model, confirm that provider charges may apply before the first request. The confirmation is stored in the project; the app never treats a model reply as confirmation.
7. Set an optional positive USD session spending limit, or leave it unlimited/disabled. The limit is checked against cost OpenCode reports after a session; unknown-price providers may report cost only after a request.
8. If the catalog later changes, the app blocks a Maker run until a currently reported model is selected. It never substitutes one automatically.

## 6. Build and serve one process

```bash
npm run build
npm start
```

Then open `http://127.0.0.1:4200/`. The built app and API share the same server. `npm start` does not start OpenCode; keep the OpenCode server running separately.

## What local mode does and does not touch

- Maker's bounded edit targets `UB_DATA_DIR/demo-workspace`, not your repository checkout.
- A confirmed public remote import lives under `UB_DATA_DIR/managed-imports/`; it is not a Maker target in Phase 3.
- Project metadata, backups, and evidence references live under `UB_DATA_DIR`.
- Native transcripts and sessions stay in OpenCode. The workshop shows a bounded transcript mirror only in Advanced diagnostics.
- The browser has no filesystem or shell endpoint.
- App approvals constrain the workflow; they cannot override an OpenCode tool denial.
- The Node check is a bounded child process, not an OS sandbox.
- Private/authenticated repository import, arbitrary repository execution, multi-user isolation, and remote browser-to-local pairing are not implemented.

## Troubleshooting

### `Port 4200 is already in use`

Stop the previous process or set `UB_PORT` to a free port. Vite reads `UB_PORT` when proxying.

### The engine badge says unreachable

1. Confirm OpenCode is listening: `curl http://127.0.0.1:4096/`.
2. Check `/api/connection` with the session token.
3. Confirm `OPENCODE_BASE_URL` matches.
4. Confirm `OPENCODE_PASSWORD` matches the server. The wizard uses Basic auth with OpenCode's fixed `opencode` username.
5. Restart the API after changing `.env`.

### Authentication required

OpenCode rejected the application connection. Enter the OpenCode server password, not a provider API key. Provider accounts are connected independently inside OpenCode.

### No models are reported

Connect a provider inside OpenCode with `/connect`, choose a model with `/models`, then re-check the connection. The app does not fabricate a catalog. The hosted demo is a different mode and has no engine at all.

### The selected model disappeared

The app blocks a Maker run until a currently reported model is selected. Reopen the OpenCode panel, choose an available model that satisfies the project's access policy, and save it. An in-flight run keeps its own recorded model.

### The free model is unavailable

The route is time-limited and account-dependent. Choose another model OpenCode reports, or switch the project to **All accessible models**. The app will not silently substitute a model. If you choose a paid or unknown-price route, review and confirm the cost warning first.

### A provider request failed

Use the provider error card: it states what happened, whether saved work changed, and the recommended repair. Reconnect a provider inside OpenCode for authentication errors, check quota/billing for quota errors, or choose another reported model. Technical details include a safe diagnostic reference; secret-shaped values and local paths are redacted. The same operation remains visible in Activity & results technical details after the card is dismissed.

### `npm run dev` exits immediately

Use the non-watch script. If you need watch mode, create `.env` first and use `npm run dev:watch`.

### A manual API request returns 403 `INVALID_SESSION`

API reads and writes need `x-ub-session-token`. Obtain it from `/api/session` on loopback. Do not disable the token check.

### A state route returns `STATE_CORRUPT` or `STATE_BUSY`

Do not delete `UB_DATA_DIR`. Inspect `project.json`, `.previous`, and `backups/`; use the previous snapshot or restore a backup after stopping the app. See [OPERATIONS_AND_RECOVERY.md](OPERATIONS_AND_RECOVERY.md).

### A local or path error mentions a broad root

Choose a dedicated child directory under a writable parent, not `/`, your home, `/tmp`, the repository root, or `/var/data` itself.

## Verification commands

```bash
npm run typecheck
npm test
npm run build
npm run budget
npm run test:visual
npm audit --omit=dev --audit-level=high
```

The interface's full visual and accessibility check is `npm run test:visual`. It needs a Chromium executable. The config prefers `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, then system Chrome/Chromium, then Playwright's installed browser.
