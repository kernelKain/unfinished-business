# Operations and recovery

**Status:** Implemented release candidate.
**Owner:** Operations/engineering.
**Last verified:** 2026-11-01; schema v3 migration, recovery, corruption, restart, and hosted-demo isolation covered by tests.

The application is a single-process Node service with one writer and one active project. It is not a multi-tenant service.

## Two recovery domains

| Domain | State | Reset/recovery | Must not affect |
|---|---|---|---|
| Guided demo (`/demo`) | Browser playback + versioned fixture | Play/Pause, Previous/Next, Replay, Reset, route refresh, presentation mode | Live project, OpenCode session, repository, provider |
| Live workshop (`/workshop`) | `UB_DATA_DIR/project.json` + OpenCode native sessions | Restart app, reconcile abandoned run, restore previous snapshot/backup | Demo fixture |

The demo and workshop share components and schemas, but not state.

## Demo reset and isolation

`src/web/demo/playback.ts` is a pure reducer. Reset:

- sets the beat index to 0;
- stops playback;
- clears the inspected spirit tab;
- clears the completed flag;
- leaves the fixture immutable;
- does not call `/api/*` or `fetch`.

Playwright records requests during playback and asserts that no `/api/` or provider URL is contacted. `tests/demo.test.ts` asserts reset returns the initial state and the fixture source has no network/time/randomness/environment access.

Route refresh always re-reads the bundled fixture. `/demo` starts paused; `/demo?presentation=1` starts in the 90-second path.

In hosted-demo mode the server independently enforces isolation: `/api/project` and `/api/export` return the fixture, `/api/session` issues no token, `/api/connection` reports a read-only demo status, `/api/opencode/*` is unavailable, and every non-GET `/api/*` request returns `403 DEMO_READ_ONLY`.

## Data layout

| Path | Purpose | Protection |
|---|---|---|
| `UB_DATA_DIR/project.json` | Current project snapshot | Canonical data root, regular file, `0600` |
| `UB_DATA_DIR/project.json.previous` | Last known-good snapshot | Written before replacement |
| `UB_DATA_DIR/backups/project-r<revision>-<timestamp>.json` | Rolling backups | Bounded by `UB_BACKUP_COUNT` and `UB_BACKUP_MAX_AGE_DAYS` |
| `UB_DATA_DIR/project.json.corrupt-*` | Quarantined corrupt current files | Bounded by `UB_CORRUPT_FILE_COUNT`; never overwritten by recovery |
| `UB_DATA_DIR/project.json.lock` | Cross-process writer lock | Stale after 30 seconds; normal writes release it |
| `UB_DATA_DIR/demo-workspace/` | The only execution workspace | Created `0700`; Maker native edits only here |
| `UB_DATA_DIR/spirit-workspace/` | Intentionally empty guide workspace | Created `0700`; no project files |
| `dist/web/` | Built browser bundle | Served through `realpath` containment; no repository/private state |

The default is `.unfinished-business/`, which is gitignored. Never place `UB_DATA_DIR` at a filesystem root, the user's home, `/tmp` itself, the repository root, or a broad system directory. Hosted deployments use a dedicated disk path such as `/var/data/unfinished-business`.

## Atomic writes, backups, and migration

Every successful mutation:

1. acquires the lock;
2. loads and validates the current snapshot;
3. checks expected revision and action ID;
4. writes a private temp file with `O_EXCL`;
5. fsyncs the file, then renames over `project.json`;
6. fsyncs the directory best-effort;
7. keeps `.previous` and a timestamped backup;
8. prunes old backups/corrupt files.

Recovery rules:

- Current valid → use it.
- Current invalid, previous valid → copy the current bytes to `project.json.corrupt-*`, use the previous snapshot, and log the recovery. The corrupt original remains.
- Both invalid → refuse to reset. State routes return `STATE_CORRUPT`; health stays minimal.
- Newer schema version → refuse and preserve. Do not downgrade.
- Schema v1 or either supported v2 shape → deterministically migrate on read; the next successful write persists canonical schema v3.

Migration policy:

- preserve proposals, section content/status/version/hash, approvals, transcripts, operations, evidence, native session references, and selected model data;
- add source/intake/memory/candidate/model-preference fields with explicit defaults;
- map legacy operation `UNKNOWN` to `ABANDONED` without erasing the recorded result or native references;
- use the fixed epoch sentinel for timestamps absent from old files, never the migration wall clock;
- make repeated migration idempotent; refuse and preserve future schema versions.

Manual recovery:

```bash
# Stop the app first. Inspect without modifying.
ls -l "$UB_DATA_DIR"
ls -l "$UB_DATA_DIR/backups"

# Restore a known-good backup atomically.
cp "$UB_DATA_DIR/backups/<chosen>.json" "$UB_DATA_DIR/project.json"
```

Preserve the corrupt file and `.previous` until the incident is understood. Do not delete state to "fix" a load error.

## Retention

| Data | Default | Notes |
|---|---:|---|
| Action records | 500 | Idempotency window; an older action may be replayed with a new ID |
| Approval records | 200 | Current section status is authoritative |
| Operation records | 200 | Native session references/results |
| Evidence records | 200 | Check results and fingerprints |
| Transcript entries | 40 | User/agent/system messages |
| Witness drafts | 10 | Last draft sets |
| Backups | 3 | Rolling files |
| Corrupt files | 5 | Quarantined originals |
| Backup age | 30 days | Older files pruned |

Deletion: stop the app and remove `UB_DATA_DIR` to delete the project, demo workspace, backups, and quarantined files. Rotate `UB_SESSION_TOKEN` to invalidate browser sessions and `UB_ACCESS_PASSWORD` to invalidate hosted Basic Auth. No destructive reset endpoint exists.

## Late, unapplied, and abandoned native runs

The operation state set is `QUEUED`, `RUNNING`, `WAITING_PERMISSION`, `COMPLETED_UNAPPLIED`, `SUCCEEDED`, `FAILED`, `CANCELLED`, and `ABANDONED`.

`COMPLETED_UNAPPLIED` reserves a safe state for a response or Maker diff that arrives after the active request deadline. Its output exists, but no later phase may treat it as applied without an explicit review/apply transition.

If the app restarts or the connection drops while a run is in flight:

1. the operation becomes `ABANDONED`;
2. the app does not repeat the native action automatically;
3. inspect the native session reference and Run Inspector;
4. use the explicit reconcile action only after confirming native state;
5. cancellation does not undo completed effects.

Startup recovery marks `QUEUED`, `RUNNING`, and `WAITING_PERMISSION` operations `ABANDONED` and records a system transcript entry. It never re-sends a prompt.

## Failure matrix

| Failure | Detection | Automatic behavior | Recovery |
|---|---|---|---|
| OpenCode unavailable | readiness probe fails | no mutation; `ENGINE_UNAVAILABLE`; no retry loop | Start/repair `opencode serve`, verify `/api/engine`, retry manually |
| Version incompatible | server is not 2.x | mutation refused; `ENGINE_INCOMPATIBLE` | Install the pinned compatible server |
| Authentication failure | 401/403/auth-looking error | `ENGINE_AUTH`; no model call claimed | Check `OPENCODE_PASSWORD` and server auth mode |
| Free/local model missing | catalog/selection check | `MODEL_UNAVAILABLE`; no substitute | Restore a free/local model; do not add paid fallback |
| Paid model selected | pricing policy | selection rejected | Choose a free or local model |
| Provider rate/quota limit | 429/quota text | `PROVIDER_LIMITED`; no automatic retry | Wait, then start a new request |
| Native permission pending | permission list/timeout | operation `WAITING_PERMISSION`; app never approves | Resolve in OpenCode, then reconcile |
| Native timeout/disconnect | timeout/network error | operation `ABANDONED`; never replay | Reconcile; inspect native session first |
| Late native success/diff | response arrives after timeout | retain as `COMPLETED_UNAPPLIED`; do not claim application | Review and explicitly apply or discard in a later phase |
| App restart with in-flight work | startup recovery | in-flight statuses → `ABANDONED` | Reconcile; do not start another run |
| Duplicate action | action ID + payload hash | return existing result; no second native call | None |
| Changed payload with same action ID | hash mismatch | 409 conflict | Use a new action ID |
| Stale approval/revision | revision/version/hash mismatch | 409; approval does not apply | Reload and use current version/hash |
| Corrupt current state | load/parse/schema failure | quarantine + previous snapshot | Inspect; restore backup only if needed |
| Both snapshots corrupt | load failure | `STATE_CORRUPT`; no reset | Restore backup or preserve for diagnosis |
| Disk full/quota | `ENOSPC`/`EDQUOT` | `STATE_DISK_FULL`; temp removed; previous intact | Free space, rotate backups, retry |
| Read-only disk | `EACCES`/`EPERM`/`EROFS` | `STATE_READ_ONLY` | Fix mount/permissions; no state replaced |
| Write lock contention | fresh lock file | `STATE_BUSY` after timeout | Wait; inspect stale lock only if older than 30 seconds |
| Node check failure | non-zero exit | evidence `FAIL`; run result retained | Inspect output; fix demo work; re-run under a new action |
| Event stream disconnect | client abort/SSE close | stream released | Reopen; no mutation inferred |
| Invalid session token | header mismatch | 403 `INVALID_SESSION` | Reopen the browser session; do not disable the check |
| Invalid host/origin | Host/Origin/Sec-Fetch policy | 421/403 | Use the configured host/origin |
| Rate/concurrency limit | limiter/gate | 429 with retry hint | Wait briefly; do not bypass |
| Sentry unavailable | transport failure | core workflow continues | No action required; telemetry optional |

## Budgets

`GET /api/runtime` exposes effective budgets (authenticated):

- guide timeout (`UB_GUIDE_TIMEOUT_MS`, default 90s);
- Maker timeout (`UB_MAKER_TIMEOUT_MS`, default 180s);
- Node check timeout (`UB_NODE_CHECK_TIMEOUT_MS`, default 30s);
- per-session token budget (`UB_MAX_SESSION_TOKENS`, default 200k);
- per-session cost budget (`UB_MAX_SESSION_COST_USD`, default 0).

The app enforces what OpenCode exposes reliably after a session. It does **not** enforce a per-session tool-call budget because OpenCode's stats API is project/range-oriented. Provider quota is not predicted or guaranteed.

## Restart procedure

1. Stop the app with `SIGTERM`/`SIGINT`; wait for the server to close.
2. Start OpenCode first, then the app.
3. Check `/api/health` (minimal), sign in if hosted, and load `/api/runtime` with the session token.
4. Check `/api/project`; reconcile any `ABANDONED` operation before a new run.
5. Inspect `backups/` if startup logged recovery.
6. Hosted Render restarts are ordinary process restarts; the persistent disk keeps state and OpenCode data.

## Incident checklist

1. Record correlation/request IDs from the UI or JSON logs; do not copy secrets.
2. Identify the boundary: browser/auth, disk, OpenCode, provider, telemetry, or platform.
3. Preserve state, backups, and quarantine files before changing anything.
4. Reproduce with the smallest safe request; do not run intrusive external tests.
5. If a native operation is uncertain, reconcile before retrying. A timeout does not mean no side effect.
6. If disk is full, free space first; never delete the only backup.
7. Rotate compromised credentials (`OPENCODE_PASSWORD`, `UB_ACCESS_PASSWORD`, `UB_SESSION_TOKEN`, Sentry auth token) and redeploy/reload.
8. Record the residual limitation and update this document if recovery changes.

## Cleanup and maintenance

- Retention runs after each successful save and startup recovery; manual pruning is not required.
- A stale lock older than 30 seconds is reclaimed; do not delete a fresh lock.
- Remove `dist/web` only when rebuilding; the app serves API-only if the bundle is absent.
- Remove `node_modules` and rerun `npm ci` for a clean dependency check.
- Keep `.backboard/`, `.entire/`, and other user-owned artifacts unless the user authorizes deletion.
