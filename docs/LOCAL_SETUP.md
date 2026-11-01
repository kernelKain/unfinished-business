# Local setup

**Status:** Linux x64 verified locally; macOS Apple Silicon and macOS Intel verified by CI run `41252770576`.
**Owner:** Engineering.
**Last verified:** 2026-11-01 on Linux x64 with Node 22.22.1, npm 9.2.0, Git, and the pinned OpenCode 2.0.32 CLI. macOS jobs run the same install, resolution, typecheck, test, build, workspace-safety, and OpenCode smoke steps. This guide is the source for the landing page's setup tabs.

## What you get

- Landing page at `http://127.0.0.1:5173/` (Vite).
- Real workshop at `http://127.0.0.1:5173/workshop`.
- Guided sample at `http://127.0.0.1:5173/demo`.
- API on `http://127.0.0.1:4310`.
- OpenCode on `http://127.0.0.1:4096`.

The browser app does not receive provider credentials or the OpenCode password. The local API connects to OpenCode over loopback.

## Prerequisites

- **Linux x64**, **macOS Apple Silicon (arm64)**, or **macOS Intel (x64)**; Node **22.14+**, npm, and Git (required only for confirmed remote repository imports).
- A supported OpenCode 2.x server. The repository pins the official cross-platform `@opencode/cli@2.0.32` and `@opencode/client@2.0.32`; npm selects the native binary for the host.
- At least one model route that answers on your OpenCode account, or a local model. The free `opencode/deepseek-v4.1-flash-free` route is still available when the provider reports it, but availability is time-limited and not guaranteed.
- A writable `UB_DATA_DIR` whose demo/spirit child directories stay inside that root. Do not point it at `/`, your home, `/Users`, `/Volumes`, the temporary root, the repository root, or another broad system directory.

Windows, Linux ARM64, and 32-bit hosts are not supported or claimed. `npm run diagnose:platform` reports an unsupported-platform diagnostic before probing any binary.

New projects allow any model OpenCode reports as available. A paid or unknown-price remote model requires an explicit confirmation, and the optional spending limit is enforced only against cost OpenCode reports. There is no silent model substitution or automatic paid fallback.

## 1. Install

```bash
npm ci
```

The lockfile pins React 19, Vite 8, Motion 14, Playwright, the cross-platform OpenCode 2.0.32 CLI, and Sentry. `npm ci` is the reproducible install; use it when verifying a release. The `@opencode/cli` postinstall materializes the native `opencode` binary for Linux x64, macOS arm64, or macOS x64.

## 2. Create a local environment file (optional)

```bash
cp .env.example .env
```

`.env` is gitignored and optional for local work: the first-run connection panel can hold the OpenCode server password in memory. Set only what you need:

```dotenv
UB_DEPLOYMENT_MODE=local
OPENCODE_BASE_URL=http://127.0.0.1:4096
OPENCODE_PASSWORD=
UB_PORT=4310
UB_HOST=127.0.0.1
UB_DATA_DIR=.unfinished-business
```

`UB_DEPLOYMENT_MODE` is canonical (`local`, `private-hosted`, or `hosted-demo`). The legacy `UB_MODE` alias is accepted, but new setups should use `UB_DEPLOYMENT_MODE`.

- `OPENCODE_PASSWORD` must match the password printed by `opencode serve`, or the fixed `OPENCODE_SERVER_PASSWORD` you chose. Leave it blank only if your local server has no password.
- `UB_OPENCODE_EXECUTABLE` is optional. Leave it empty so the resolver prefers a compatible global `opencode` on `PATH`, then the lockfile-installed `@opencode/cli` binary. Set it only when a specific executable must be used.
- `UB_SESSION_TOKEN` may be blank; the server generates one for the local browser session.
- `UB_DATA_DIR` stores project metadata, confirmed managed repository imports, and the isolated demo and spirit workspaces. It is gitignored.
- Do not put provider API keys in `.env`. Provider accounts belong inside OpenCode.

The security and budget variables in `.env.example` have safe defaults. `UB_MAX_SESSION_COST_USD` defaults to `unlimited`; set a positive USD value to enforce a deployment-wide limit, or use `0`/`disabled` to disable it. A per-project limit can be stricter. Review timeouts, request limits, retention, and redaction before changing them.

## 3. Start OpenCode (terminal 1)

Use the lockfile-installed cross-platform CLI:

```bash
npx --no-install opencode serve --hostname 127.0.0.1 --port 4096
```

This command is the same on Linux x64, macOS Apple Silicon, and macOS Intel. If you already have a compatible global OpenCode 2.x installation, this is equivalent:

```bash
opencode serve --hostname 127.0.0.1 --port 4096
```

The application itself prefers a compatible global `opencode` on `PATH`; otherwise it resolves the lockfile-installed binary. If you install globally instead:

```bash
# npm on Linux or macOS
npm install -g @opencode/cli@2.0.32
opencode --version

# Homebrew on macOS
brew install anomalyco/tap/opencode-v2
opencode --version
```

OpenCode prints a generated server password. Copy it into `OPENCODE_PASSWORD` or enter it in the first-run wizard. Do not commit it.

A full model call was not repeated during the Phase 9 gate. The Phase 9 compatibility probe verified server version, catalog access, and disposable session create/read/remove without inference.

### Platform diagnostics

Run these before opening a support issue:

```bash
npm run diagnose:platform   # executable, source, version, platform support, permission
npm run smoke:opencode      # starts the resolved server, reads /api/info, stops it
```

The diagnostic emits one of:

| Code | Meaning | Repair |
|---|---|---|
| `OPENCODE_PLATFORM_UNSUPPORTED` | Host is not Linux x64, macOS arm64, or macOS x64 | Run on a supported host; do not claim the current host as supported. |
| `OPENCODE_CLI_MISSING` | No usable `opencode` on `PATH` and no materialized `@opencode/cli` binary | Run `npm ci`; if install scripts were disabled, reinstall with scripts enabled. |
| `OPENCODE_CLI_PERMISSION_DENIED` | A candidate exists but is not executable by this user | Fix ownership/mode or reinstall without `sudo`. |
| `OPENCODE_CLI_VERSION_INCOMPATIBLE` | Major version is not 2, or no version was reported | Install `@opencode/cli@2.0.32` or the matching Homebrew tap. |
| `OPENCODE_CLI_VERSION_UNTESTED` | A different 2.x patch was found | Use 2.0.32 for the tested surface, or run the live diagnostic. |
| `OPENCODE_SERVER_START_FAILED` | The server exited before answering `/api/info` | Check the port, data/config directory permissions, and the CLI version. |

No diagnostic prints the executable path, credentials, prompts, or model output.

## 4. Start the API (terminal 2)

```bash
npm run dev
```

Expected log:

```text
Unfinished Business listening on http://127.0.0.1:4310
```

Health check:

```bash
curl http://127.0.0.1:4310/api/health
```

Expected:

```json
{"status":"ok","service":"unfinished-business"}
```

All other API reads require the browser session token. The browser obtains it from `/api/session` automatically. For manual curl checks:

```bash
TOKEN=$(curl -s http://127.0.0.1:4310/api/session | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).token')
curl -H "x-ub-session-token: $TOKEN" http://127.0.0.1:4310/api/project
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

Open `http://127.0.0.1:5173/`. Vite proxies `/api` to `http://127.0.0.1:4310` (or `UB_PORT`).

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

Then open `http://127.0.0.1:4310/`. The built app and API share the same server. `npm start` does not start OpenCode; keep the OpenCode server running separately.

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

### `Port 4310 is already in use`

Stop the previous process or set `UB_PORT` to a free port. Vite reads `UB_PORT` when proxying.

### The engine badge says unreachable

1. Confirm OpenCode is listening: `curl http://127.0.0.1:4096/`.
2. Check `/api/connection` with the session token.
3. Confirm `OPENCODE_BASE_URL` matches.
4. Confirm `OPENCODE_PASSWORD` matches the server. The wizard uses Basic auth with OpenCode's fixed `opencode` username.
5. Run `npm run diagnose:platform` and `npm run smoke:opencode` to separate CLI resolution from server/network problems.
6. Restart the API after changing `.env`.

### The workshop lost its connection

The initial project/connection load failed. Start or restart the API, confirm `http://127.0.0.1:4310/api/health`, then use **Reload the workshop**. Do not repeat a mutation blindly; reload first and inspect the persisted revision. The UI intentionally replaces raw browser fetch text with this actionable message.

### The OpenCode executable is missing or not executable

`npm run diagnose:platform` returns `OPENCODE_CLI_MISSING` or `OPENCODE_CLI_PERMISSION_DENIED`. Run `npm ci` with install scripts enabled. On macOS/Linux, avoid `sudo`; fix ownership on the install directory instead. `@opencode/cli` materializes its native binary during postinstall, so `--ignore-scripts` installs are incomplete.

### Unsupported architecture

`npm run diagnose:platform` returns `OPENCODE_PLATFORM_UNSUPPORTED`. Supported hosts are Linux x64, macOS Apple Silicon, and macOS Intel. Linux ARM64, Windows, and 32-bit hosts are not tested or claimed. Use one of the supported hosts or a remote allowlisted OpenCode server from the supported application host.

### OpenCode CLI version is incompatible

The resolver reports `OPENCODE_CLI_VERSION_INCOMPATIBLE` when the major version is not 2 or no version can be parsed. Install the pinned CLI with `npm install -g @opencode/cli@2.0.32`, or on macOS run `brew install anomalyco/tap/opencode-v2`. A different 2.x patch resolves but shows `OPENCODE_CLI_VERSION_UNTESTED`.

### OpenCode server failed to start

`npm run smoke:opencode` reports `OPENCODE_SERVER_START_FAILED` when the server exits before answering `/api/info`. Confirm port 4096 or the chosen port is free, the XDG/data directories are writable, and a compatible CLI is selected. The smoke script starts a disposable server, makes no model call, and stops it automatically.

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

Choose a dedicated child directory under a writable parent, not `/`, your home, `/Users`, `/Volumes`, the temporary root (including its resolved macOS `/private/var/folders/...` form), the repository root, or `/var/data` itself.

## Verification commands

```bash
npm run typecheck
npm test
npm run build
npm run budget
npm run test:visual
npm run test:platform
npm run smoke:opencode
npm audit --omit=dev --audit-level=high
```

The current gate is 207 unit/integration/component tests, 26 Playwright visual/accessibility/resilience tests, and `npm audit` with zero vulnerabilities. The Playwright suite covers 390px, 768px, and 1440px layouts plus loading, offline, 200% zoom, long content, keyboard, contrast, and reduced-motion checks.

The interface's full visual and accessibility check is `npm run test:visual`. It needs a Chromium executable. The config prefers `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, then system Chrome/Chromium (including the standard macOS application paths), then Playwright's installed browser. The web-server data directory comes from the host temporary directory, not a hardcoded `/tmp`.
