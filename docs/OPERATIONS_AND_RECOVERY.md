# Operations and recovery

This document covers the local, hosted-demo, and private-hosted operating modes. The application is a single-process Node service with one writer and one active project. It is not a multi-tenant service.

## Data layout

| Path | Purpose | Protection |
|---|---|---|
| `UB_DATA_DIR/project.json` | current project snapshot | canonical data root, `0600` file, regular file only |
| `UB_DATA_DIR/project.json.previous` | last known-good snapshot | written before replacement |
| `UB_DATA_DIR/backups/project-r<revision>-<timestamp>.json` | rolling backups | bounded by `UB_BACKUP_COUNT` and `UB_BACKUP_MAX_AGE_DAYS` |
| `UB_DATA_DIR/project.json.corrupt-*` | quarantined corrupt current files | bounded by `UB_CORRUPT_FILE_COUNT`; never overwritten by recovery |
| `UB_DATA_DIR/project.json.lock` | cross-process writer lock | stale after 30 seconds; normal writes release it |
| `UB_DATA_DIR/demo-workspace/` | the only execution workspace | created `0700`; Maker native edits only here |
| `UB_DATA_DIR/spirit-workspace/` | intentionally empty guide workspace | created `0700`; no project files |
| `dist/web/` | built browser bundle | served through `realpath` containment; no repository/private state |

The default is `.unfinished-business/`, which is gitignored. Never place `UB_DATA_DIR` at a filesystem root, the user's home, the repository root, or a broad system directory. Hosted deployments should use a dedicated disk path such as `/var/data/unfinished-business`.

## Backups, atomic replacement, and migrations

Every successful mutation:

1. acquires the lock;
2. loads and validates the current snapshot;
3. checks the expected revision and action ID;
4. writes a temp file with `O_EXCL`, `0600`;
5. fsyncs the file, then renames it over `project.json`;
6. fsyncs the directory best-effort;
7. keeps `.previous` and a timestamped backup;
8. prunes old backups and corrupt files.

Recovery rules:

- Current valid → use it.
- Current invalid, previous valid → copy the current bytes to `project.json.corrupt-*`, use the previous snapshot, and expose the recovery in logs. The corrupt original remains at its path.
- Both invalid → refuse to initialize/reset. API state routes return `STATE_CORRUPT`; health remains minimal and does not expose details.
- Newer schema version → refuse and preserve the file. Do not downgrade.
- v1 snapshot → migrate on read to v2; the next successful write persists v2.

Manual recovery:

```bash
# Inspect without modifying
ls -l "$UB_DATA_DIR"
ls -l "$UB_DATA_DIR/backups"

# Stop the app, then restore a known-good backup atomically
cp "$UB_DATA_DIR/backups/<chosen>.json" "$UB_DATA_DIR/project.json"
```

Preserve the corrupt file and any `.previous` file until the incident is understood. Do not delete state to “fix” a load error; that loses approvals and evidence.

## Retention

Defaults are configurable and documented in `.env.example`:

| Data | Default | Notes |
|---|---:|---|
| Action records | 500 | idempotency window; an action older than the window may be replayed with a new ID |
| Approval records | 200 | current section status is authoritative; old history is pruned |
| Operation records | 200 | native session references/results |
| Evidence records | 200 | check results and fingerprints |
| Transcript entries | 40 | user/agent/system messages |
| Witness drafts | 10 | last draft sets |
| Backups | 3 | rolling files |
| Corrupt files | 5 | quarantined originals |
| Backup age | 30 days | older files pruned |

Deletion:

- Stop the app and remove `UB_DATA_DIR` to delete the project, demo workspace, backups, and quarantined files.
- Rotate `UB_SESSION_TOKEN` to invalidate existing browser sessions.
- Rotate `UB_ACCESS_PASSWORD` to invalidate hosted Basic Auth sessions.
- Sentry retention is controlled by the Sentry project/plan; disable the DSN to stop sending events.
- No destructive reset endpoint exists by design.

## Failure matrix

| Failure | Detection | Automatic behavior | Operator/UI recovery |
|---|---|---|---|
| OpenCode unavailable | readiness probe fails | no mutation; `ENGINE_UNAVAILABLE`; no retry loop | start/repair `opencode serve`, verify `/api/engine`, retry manually |
| Version incompatible | server version is not 2.x | mutation refused; `ENGINE_INCOMPATIBLE` | install the pinned 2.0.32-compatible server |
| Authentication failure | 401/403 or auth-looking error | `ENGINE_AUTH`; no model call claimed | check `OPENCODE_PASSWORD` and server auth mode |
| Free model missing | model catalog check | `MODEL_UNAVAILABLE`; no substitute | restore the free DeepSeek route; do not add a paid fallback |
| Provider rate/quota limit | 429/quota text | `PROVIDER_LIMITED`; no automatic retry | wait, then manually start a new request |
| Native permission pending | native permission list / timeout | operation `WAITING_PERMISSION`; no approval by app | resolve in OpenCode, then reconcile |
| Native timeout/disconnect | timeout/network error | operation `UNKNOWN`; never replay | reconcile; inspect the native session first |
| App restart with in-flight operation | startup recovery | `QUEUED`/`RUNNING`/`WAITING_PERMISSION` → `UNKNOWN` | reconcile; do not start another run |
| Duplicate action | action ID + payload hash | return existing result; no second native call | none |
| Changed payload with same action ID | hash mismatch | 409 conflict | use a new action ID |
| Stale approval/revision | expected revision/version/hash mismatch | 409; approval does not apply | reload project and use current version/hash |
| Corrupt current state | load/parse/schema failure | quarantine + previous snapshot | inspect; restore backup only if needed |
| Both snapshots corrupt | load failure | `STATE_CORRUPT`; no reset | restore a backup or preserve files for diagnosis |
| Disk full/quota | `ENOSPC`/`EDQUOT` | `STATE_DISK_FULL`; temp removed; previous state intact | free space, rotate backups, retry |
| Read-only disk | `EACCES`/`EPERM`/`EROFS` | `STATE_READ_ONLY` | fix mount/permissions; no state replaced |
| Write lock contention | fresh lock file | `STATE_BUSY` after timeout | wait; inspect stale lock only if older than 30 seconds |
| Node check failure | exit code non-zero | evidence `FAIL`; run result retained | inspect the check output; fix the demo work; re-run under a new action |
| Event stream disconnect | client abort/SSE close | stream released; snapshot resync on reconnect | reopen; no mutation is inferred |
| Test failure | command exit code | no PASS claim | record the failure in Witness; do not rename it |
| Sentry unavailable | SDK transport failure | core workflow continues | no action required; telemetry is optional |

## Budgets

The server exposes effective budgets at `GET /api/runtime` (authenticated):

- guide timeout (`UB_GUIDE_TIMEOUT_MS`);
- Maker timeout (`UB_MAKER_TIMEOUT_MS`);
- Node check timeout (`UB_NODE_CHECK_TIMEOUT_MS`);
- per-session token budget (`UB_MAX_SESSION_TOKENS`);
- per-session cost budget (`UB_MAX_SESSION_COST_USD`, defaults to 0 for the free model).

The app enforces what OpenCode exposes reliably after a session. It does **not** enforce a per-session tool-call budget because OpenCode’s stats API is project/range-oriented, not a reliable per-session counter. The UI and runtime payload state that limitation explicitly. Provider quota is not claimed or predicted.

## Restart procedure

1. Stop the app with `SIGTERM`/`SIGINT`; wait for the server to close.
2. Start OpenCode first (`opencode serve --hostname 127.0.0.1 --port 4096`), then the app.
3. Check `/api/health` (minimal), sign in if hosted, and load `/api/runtime`.
4. Check `/api/project`; any `UNKNOWN` operation must be reconciled before a new run.
5. Inspect `backups/` if startup logged a recovery. Do not start Maker until reconciliation resolves.

Hosted Render restarts are ordinary process restarts; the persistent disk keeps state and OpenCode data. A restart does not undo completed native effects.

## Incident checklist

1. Record correlation/request IDs from the UI or JSON logs; do not copy secrets.
2. Identify the boundary: browser/auth, disk, OpenCode, provider, telemetry, or platform.
3. Preserve state, backups, and quarantine files before changing anything.
4. Reproduce with the smallest safe request; do not run intrusive external tests.
5. If a native operation is uncertain, reconcile before retrying. Never assume a timeout means no side effect.
6. If disk is full, free space first; never delete the only backup.
7. Rotate compromised credentials (`OPENCODE_PASSWORD`, `UB_ACCESS_PASSWORD`, `UB_SESSION_TOKEN`, Sentry auth token) and redeploy/reload.
8. Record the residual limitation and update this document if the recovery path changed.

## Cleanup and maintenance

- Retention runs after each successful save and startup recovery; manual pruning is not required.
- A stale lock older than 30 seconds is reclaimed; do not delete a fresh lock.
- Remove `dist/web` only when rebuilding; the app serves API-only if the bundle is absent.
- Remove `node_modules` and rerun `npm ci` for a clean dependency check.
- Keep `.backboard/`, `.entire/`, and other user-owned artifacts unless the user authorizes deletion. This phase did not modify them.
