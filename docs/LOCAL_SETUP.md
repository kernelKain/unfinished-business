# Local setup

This is the supported development and demo path: Node 22.14+, a loopback OpenCode 2.0.32 server, and one local browser session.

## Prerequisites

- Node.js `22.14.0` or newer (`node --version`).
- npm with a lockfile-consistent install (`npm ci`).
- OpenCode 2.0.32 available on `PATH` or via the pinned repository dependency.
- A free `opencode/deepseek-v4.1-flash-free` model route in that OpenCode account.
- No paid model fallback is required or allowed.

## Fresh setup

```bash
npm ci
cp .env.example .env
```

Edit `.env` for local use. At minimum set `OPENCODE_PASSWORD` to the password printed by `opencode serve` (or the `OPENCODE_SERVER_PASSWORD` you chose). Keep `UB_MODE=local` and the loopback defaults.

Start OpenCode in one terminal:

```bash
OPENCODE_SERVER_PASSWORD="choose-a-long-random-password" \
  opencode serve --hostname 127.0.0.1 --port 4096
```

Start the app in another:

```bash
npm run dev
```

Open `http://127.0.0.1:4200`. The server creates `UB_DATA_DIR` (default `.unfinished-business/`) with private permissions, initializes schema v2 state, and keeps Maker inside `demo-workspace/`.

For the production-style local path:

```bash
npm run build
npm start
```

`UB_PORT` changes the port. `UB_HOST` must remain loopback in local mode. `UB_SESSION_TOKEN` is generated for the process when omitted; set it explicitly if you want a stable token across local restarts.

## Secure local defaults

- The listener is loopback-only; local mode refuses a non-loopback `UB_HOST`.
- All state/mutation routes require `x-ub-session-token`; `/api/health` is the only public API route.
- `/api/session` only issues a token on loopback when Basic Auth is not configured.
- Origin/Sec-Fetch-Site checks reject cross-site browser requests; mutations require JSON and a bounded body.
- `OPENCODE_BASE_URL` defaults to loopback. Remote targets require HTTPS, an explicit `UB_OPENCODE_ALLOWED_HOSTS` entry, and DNS/IP validation.
- The free model is mandatory; any model substitution or non-zero reported cost fails the operation.
- Logs and Sentry spans omit secrets, prompts, headers, cookies, bodies, tool arguments/results, and user identity.

Local mode is a trusted-developer tool. Any process running as the same OS user can read `.unfinished-business/`, the generated token, and OpenCode credentials. Do not expose a local-mode listener to an untrusted network.

## Useful checks

```bash
npm run typecheck
npm test
npm run build
node scripts/preflight.mjs   # diagnostic only; not a native proof
curl http://127.0.0.1:4200/api/health
```

Authenticated checks need the token; the browser obtains it automatically. From a shell:

```bash
TOKEN=$(curl -s http://127.0.0.1:4200/api/session | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).token')
curl -H "x-ub-session-token: $TOKEN" http://127.0.0.1:4200/api/runtime
curl -H "x-ub-session-token: $TOKEN" http://127.0.0.1:4200/api/engine
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| Port in use | set `UB_PORT`/`PORT` to a free port; the server logs the conflict without killing unrelated processes |
| `OPENCODE_PASSWORD is required` | the app is in a hosted mode; for local use set `UB_MODE=local` |
| OpenCode not reachable | start `opencode serve` and confirm the base URL/port |
| Authentication error | copy the current server password into `.env`; restart both sides if you rotated it |
| Free model missing | verify the native model catalog and account access; do not add a paid model |
| `INVALID_SESSION` | reload the page to fetch a fresh loopback token |
| `INVALID_ORIGIN`/`INVALID_HOST` | use `127.0.0.1`/`localhost`, not a proxy hostname, in local mode |
| State corrupt | inspect `.unfinished-business/`; a `.corrupt-*` copy is preserved and `.previous` may be recoverable. See [OPERATIONS_AND_RECOVERY.md](OPERATIONS_AND_RECOVERY.md) |
| Disk full | free space; the app refuses to replace state and returns `STATE_DISK_FULL` |
| Maker run unknown | click **Reconcile native session**; do not start another run until it resolves |
| Permission pending | resolve it in OpenCode; the app does not auto-approve native requests |
| SSE test hangs | `/api/events` requires the header token; EventSource cannot set it, so use fetch streaming or the polling UI |

## Resetting local data

Stop the app, then remove the data directory:

```bash
rm -rf .unfinished-business
```

This deletes approvals, evidence, drafts, backups, and the demo workspace. Do not do this while diagnosing a corruption incident unless you have preserved the files you need. `.backboard/`, `.entire/`, and other user-owned artifacts are not part of this reset.
