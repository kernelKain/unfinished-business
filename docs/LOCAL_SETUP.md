# Local setup

**Verified:** 2026-10-31 on Linux with Node 22.22.1, npm 9.2.0, and the pinned OpenCode 2.0.32 binary. This guide is the source for the landing page's setup tabs.

## What you get

- The landing page at `http://127.0.0.1:5173/` (Vite).
- The real workshop at `http://127.0.0.1:5173/workshop`.
- The deterministic demo at `http://127.0.0.1:5173/demo`.
- The API on `http://127.0.0.1:4200`.
- OpenCode on `http://127.0.0.1:4096`.

The browser app does not receive the OpenCode password. The local API connects to OpenCode over loopback.

## Prerequisites

- Linux (the first release target), Node **22.14+**, npm.
- A supported OpenCode 2.x server. This repository pins `@opencode/cli-linux-x64-baseline@2.0.32`.
- A free-model route that answers on your OpenCode account. The intended route is `opencode/deepseek-v4.1-flash-free`; availability is time-limited and not guaranteed.
- The repository checkout with `npm ci` completed.

No paid inference fallback is configured. Do not add one silently.

## 1. Install

```bash
npm ci
```

The lockfile pins React 19, Vite 8, Motion 14, the OpenCode 2.0.32 CLI, and the Sentry packages. `npm ci` is reproducible; do not substitute `npm install` when verifying a release.

## 2. Create a local environment file (optional)

```bash
cp .env.example .env
```

`.env` is optional for local work: the first-run connection panel can hold the OpenCode server password in memory. Use `.env` for non-interactive starts and repeatable settings. `.env` is gitignored. Set only what you need:

```dotenv
OPENCODE_BASE_URL=http://127.0.0.1:4096
OPENCODE_PASSWORD=
UB_PORT=4200
UB_HOST=127.0.0.1
UB_DATA_DIR=.unfinished-business
UB_DEPLOYMENT_MODE=local
```

`UB_DEPLOYMENT_MODE` must be `local` for browser connection editing. `hosted-private` and `hosted-demo` make connection configuration read-only and are covered in `docs/HOSTED_DEPLOYMENT.md`.

- `OPENCODE_PASSWORD` must match the password printed by `opencode serve`, or the fixed `OPENCODE_SERVER_PASSWORD` you chose. Leave it blank only if your local server has no password.
- `UB_SESSION_TOKEN` may be left blank; the server generates one for the local browser session.
- `UB_DATA_DIR` is gitignored and stores project metadata plus the isolated demo and spirit workspaces.

Sentry values are optional for local work. Do not put a Sentry auth token or any secret in a committed file.

## 3. Start OpenCode (terminal 1)

Use the pinned binary:

```bash
./node_modules/@opencode/cli-linux-x64-baseline/bin/opencode serve --hostname 127.0.0.1 --port 4096
```

If you already have a supported global OpenCode installation, this is equivalent:

```bash
opencode serve --hostname 127.0.0.1 --port 4096
```

Verified in this environment:

```text
opencode v2.0.32
serve --help: --hostname, --port, --cors, --service, --stdio
```

A full model call was not repeated during the Phase 4 interface work. Verify the free route on your own account before claiming a live run.

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

`npm run dev` deliberately does **not** use Node's `--watch` mode, because the pinned Node version tries to watch a missing `.env` and exits. If you have created `.env` and want reloads, use:

```bash
npm run dev:watch
```

## 5. Start the interface (terminal 3)

```bash
npm run dev:web
```

Open `http://127.0.0.1:5173/`. Vite proxies `/api` to `http://127.0.0.1:4200` (or `UB_PORT`).

The engine pill in the workshop header reflects `/api/connection`; it shows **OpenCode connected** only after the server answers, the major version is compatible, the catalog is readable, and no warning remains. `degraded`, `authentication_required`, `incompatible_version`, `unavailable`, and `not_configured` each carry a diagnostic and a repair action.

If OpenCode is reachable but no model is selected, `/workshop` opens the first-run connection/model panel. If OpenCode is unavailable, the workshop stays visible with the error and an **Open setup** action; it never invents a connection or a model.

### First-run model selection

1. Start OpenCode and note the server password.
2. Enter the URL (`http://127.0.0.1:4096`) and password in the wizard. The password is held in memory; it is not written to project JSON, browser storage, logs, or Sentry.
3. Provider accounts are connected inside OpenCode with `/connect`; the app never asks for provider API keys.
4. The wizard lists only models that OpenCode reports as available, including free/paid/unknown pricing, context/output limits, modalities, tools, and reported variants.
5. Choose a model and, only if reported, a variant. The selection is stored per project and recorded in Maker operation/evidence records.
6. If the catalog later changes, the app blocks a Maker run until a currently reported model is selected.

## 6. Build and serve one process

```bash
npm run build
npm start
```

Then open `http://127.0.0.1:4200/`. The built app and API share the same server. `npm start` does not start OpenCode; keep the OpenCode server running separately.

## What "local mode" does and does not touch

- Maker's bounded edit targets the isolated demo workspace under `UB_DATA_DIR`, not your repository checkout.
- Project metadata and evidence references live under `UB_DATA_DIR`.
- Native transcripts and sessions stay in OpenCode.
- The browser has no filesystem or shell endpoint.
- App approvals constrain the workflow; they cannot override an OpenCode tool denial.

## Troubleshooting

### `Port 4200 is already in use`

Stop the previous process or set `UB_PORT` to a free port. Vite reads `UB_PORT` when proxying.

### The engine badge says unreachable

1. Confirm OpenCode is listening: `curl http://127.0.0.1:4096/`.
2. Check the normalized state and diagnostic: `curl http://127.0.0.1:4200/api/connection`.
3. Confirm `OPENCODE_BASE_URL` matches.
4. Confirm `OPENCODE_PASSWORD` matches the server. The wizard uses Basic auth with OpenCode's fixed `opencode` username.
5. Restart the API after changing `.env`.

### Authentication required

OpenCode rejected the application connection. Enter the OpenCode server password, not a provider API key. Provider accounts are connected independently inside OpenCode.

### No models are reported

Connect a provider inside OpenCode with `/connect`, choose a model there with `/models`, then re-check the connection. A hosted demo may legitimately show no models. The app does not fabricate a catalog or assume a fixed model.

### The selected model disappeared

The app blocks a Maker run until a currently reported model is selected. Reopen the OpenCode panel, choose an available model, and save it. An in-flight run keeps its own recorded model.

### The free model is unavailable

The route is time-limited and account-dependent. The app will not silently switch to a paid model. Check the OpenCode server output and your model access, then retry.

### `npm run dev` exits immediately

This repository's pinned Node needs the non-watch script without `.env`. Use `npm run dev`. If you need watch mode, create `.env` first and use `npm run dev:watch`.

### Vite serves the page but API calls fail

Confirm the API is running on 4200 (or the `UB_PORT` you set) and that Vite was started after the env value was available.

## Verification commands

```bash
npm run typecheck
npm test
npm run build
npm run budget
```

The interface's full visual and accessibility check is:

```bash
npm run test:visual
```

It needs a Chromium executable. The config prefers `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, then system Chrome/Chromium, then Playwright's installed browser.
