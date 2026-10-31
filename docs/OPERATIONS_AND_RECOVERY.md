# Operations and recovery

**Status:** Implemented release candidate.
**Owner:** Operations/engineering.
**Last verified:** 2026-11-01; schema v7 migration, source onboarding/import safety, Oracle memory and editable Project memory, candidate revisions, run observability/recovery, focused workshop controls, provider-budget enforcement, corruption, restart, and hosted-demo isolation covered by tests.

The application is a single-process Node service with one writer and one active project. It is not a multi-tenant service.

## Two recovery domains

| Domain | State | Reset/recovery | Must not affect |
|---|---|---|---|
| Guided sample (`/demo`) | Browser playback + canonical Driftwatch fixture | Play/Pause, Previous/Next, Replay, Reset, route refresh, presentation mode | Live project, OpenCode session, repository, provider |
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

Playwright records requests during playback and asserts that no `/api/` or provider URL is contacted. `tests/demo.test.ts` asserts reset returns the initial state and the fixture source has no network/time/randomness/environment access. `tests/web.test.ts` and the Playwright consistency case assert that the landing preview and `/demo` report the same recorded check and `NOT_RUN` live proof.

Route refresh always re-reads the bundled fixture. `/demo` starts paused; `/demo?presentation=1` starts in the 90-second path. The landing preview derives from the same fixture, so there is no second operation/evidence state to reconcile.

In hosted-demo mode the server independently enforces isolation: `/api/project` and `/api/export` return the fixture, `/api/session` issues no token, `/api/connection` reports a read-only demo status, `/api/opencode/*` is unavailable, and every non-GET `/api/*` request returns `403 DEMO_READ_ONLY`.

## Data layout

| Path | Purpose | Protection |
|---|---|---|
| `UB_DATA_DIR/project.json` | Current project snapshot | Canonical data root, regular file, `0600` |
| `UB_DATA_DIR/project.json.previous` | Last known-good snapshot | Written before replacement |
| `UB_DATA_DIR/backups/project-r<revision>-<timestamp>.json` | Rolling backups | Bounded by `UB_BACKUP_COUNT` and `UB_BACKUP_MAX_AGE_DAYS` |
| `UB_DATA_DIR/project.json.corrupt-*` | Quarantined corrupt current files | Bounded by `UB_CORRUPT_FILE_COUNT`; never overwritten by recovery |
| `UB_DATA_DIR/project.json.lock` | Cross-process writer lock | Stale after 30 seconds; normal writes release it |
| `UB_DATA_DIR/demo-workspace/` | Bounded Maker execution workspace | Created `0700`; Maker native edits only here |
| `UB_DATA_DIR/spirit-workspace/` | Intentionally empty guide workspace | Created `0700`; no project files |
| `UB_DATA_DIR/managed-imports/<project-id>/` | Explicitly confirmed public remote repository import | Root created `0700`; clone staged privately and atomically renamed; not granted to Maker in Phase 3 |
| `dist/web/` | Built browser bundle | Served through `realpath` containment; no repository/private state |

The default is `.unfinished-business/`, which is gitignored. Never place `UB_DATA_DIR` at a filesystem root, the user's home, `/Users`, `/Volumes`, the temporary root (including the resolved macOS `/private/var/folders/...` form), the repository root, or a broad system directory. Hosted deployments use a dedicated disk path such as `/var/data/unfinished-business`.

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
- Schema v1, either supported v2 shape, schema v3, schema v4, schema v5, or schema v6 → deterministically migrate on read; the next successful write persists canonical schema v7. Candidate revisions retain their content, base version/hash, summary, requested change, decision time, and status across migration. Phase 5 added no schema version: Project memory corrections use the existing memory entry `status` and `supersedesId` fields.

Migration policy:

- preserve proposals, section content/status/version/hash, approvals, transcripts, operations, evidence, native session references, and selected model data;
- add source/intake/memory/candidate/model-preference fields with explicit defaults;
- map legacy projects to a confirmed saved-project source and preserve legacy Oracle summary/questions in structured intake and memory;
- retain answer provenance and superseded corrections; do not rewrite old transcript entries as current facts;
- map v3 `requireFreeOrLocal: true` to `FREE_OR_LOCAL_ONLY` and `false` to `ALL_ACCESSIBLE`; map a zero v3 cost limit to unlimited;
- map legacy operation `UNKNOWN` to `ABANDONED` without erasing the recorded result or native references;
- backfill every non-terminal migrated operation with a deterministic `AWAITING_RECONCILIATION` progress marker stamped with the fixed epoch sentinel, so old unknown runs remain reconcilable;
- use the fixed epoch sentinel for timestamps absent from old files, never the migration wall clock;
- make repeated migration idempotent; refuse and preserve future schema versions.

Project-memory editing:

- `POST /api/memory` requires the session token and an `actionId`/`expectedRevision`.
- A correction names an existing entry, marks it `SUPERSEDED`, and appends a new active entry linked by `supersedesId`.
- Memory edits never change a section draft, approval, Maker scope, operation, or native session.
- The UI's Project memory drawer reads the same buckets; raw transcript excerpts stay in Advanced diagnostics.

Manual recovery:

```bash
# Stop the app first. Inspect without modifying.
ls -l "$UB_DATA_DIR"
ls -l "$UB_DATA_DIR/backups"

# Restore a known-good backup atomically.
cp "$UB_DATA_DIR/backups/<chosen>.json" "$UB_DATA_DIR/project.json"
```

Preserve the corrupt file and `.previous` until the incident is understood. Do not delete state to "fix" a load error.

## Project-source import and recovery

A remote URL selection performs validation only and records `PENDING_CONFIRMATION`. It makes no network request and grants no agent access. Confirmation revalidates the URL, clones into a private temporary directory below `managed-imports/`, and atomically renames the completed checkout to the project target. Git credential helpers, terminal prompts, redirects, and stdout/stderr are disabled.

If import fails, the temporary directory is removed, the source remains pending, and the saved error is a fixed message without Git output or credentials. If the final managed target already exists, the service refuses to overwrite it. Operators should inspect the target out of band before retrying; do not delete an existing managed workspace unless its ownership and recovery value are known.

Local repositories are never copied or modified during selection. Their canonical path is private state, omitted from the public project response and Oracle prompt, and validated with the same broad-root/symlink policy used for application workspaces.

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

Deletion: stop the app and remove `UB_DATA_DIR` to delete the project, managed imports, demo workspace, backups, and quarantined files. Rotate `UB_SESSION_TOKEN` to invalidate browser sessions and `UB_ACCESS_PASSWORD` to invalidate hosted Basic Auth. No destructive reset endpoint exists.

## Late, unapplied, and abandoned native runs

The operation state set is `QUEUED`, `RUNNING`, `WAITING_PERMISSION`, `COMPLETED_UNAPPLIED`, `SUCCEEDED`, `FAILED`, `CANCELLED`, and `ABANDONED`.

Oracle, Architect, Witness, and Maker runs are persisted asynchronous operations. Stage messages (`clarify`, `draft`, `witness`) and Maker runs return `202 Accepted` with the queued operation; the run continues in the background and the saved project updates as it progresses. Progress phases are recorded while the run is in flight and cleared at a terminal status. A `question` remains a synchronous request because it changes no saved state.

`COMPLETED_UNAPPLIED` means a native result was observed but its actual reply/diff has not yet been retrieved and validated, or validation produced content that is recorded but not yet applied. Reconciling again retrieves and validates the result and applies it **exactly once** (`appliedAt` guard plus the idempotent action record).

Reconciliation (`POST /api/runs/:id/reconcile`, or **Reconcile now** in Activity & results):

1. keeps `RUNNING`/`WAITING_PERMISSION` honestly if the session is still running or a native permission is still pending;
2. reads the native outcome through `session.get` — an idle session without a reported outcome is `unknown`, never success;
3. on a succeeded Maker session, retrieves the real file diff (`session.diff`), re-runs the bounded Node check, and applies it once with evidence;
4. on a succeeded guide session, retrieves the latest assistant message, validates it against `ORACLE_REPLY`/`SECTION_DRAFT`/`WITNESS_REPLY` exactly as a live reply would be, and applies it once;
5. confirms a `FAILED` outcome without repeating anything;
6. leaves a still-unknown outcome `ABANDONED` with the recovery marker; nothing is invented.

Additional controls:

| Control | Effect |
|---|---|
| Continue waiting | Dismisses the recovery panel; polling continues; nothing is repeated |
| Open in OpenCode | Focuses the app's OpenCode panel with the native session list |
| Cancel | Interrupts the native session (for an active in-process runner) and records `CANCELLED` |
| Retry after failure | `POST /api/runs/:id/retry` — Maker runs only, after a confirmed `FAILED` outcome; creates a new operation with `retryOf` lineage |
| Mark abandoned | `POST /api/runs/:id/abandon` — refuses active in-process runners and already-finished/abandoned rows |

Retries never reuse the prior native session or operation id, so a retried run cannot duplicate a previous native edit; the original row keeps its history.

If the app restarts or the connection drops while a run is in flight:

1. startup recovery marks the operation `ABANDONED` with the `AWAITING_RECONCILIATION` marker and keeps the native session reference;
2. the app does not repeat the native action automatically;
3. use Reconcile now to adopt the actual late result once, or Mark abandoned to record the operator decision;
4. cancellation does not undo completed effects.

## Failure matrix

| Failure | Detection | Automatic behavior | Recovery |
|---|---|---|---|
| OpenCode unavailable | readiness probe fails | no mutation; `ENGINE_UNAVAILABLE`; no retry loop | Start/repair `opencode serve`, verify `/api/engine`, retry manually |
| Version incompatible | server is not 2.x | mutation refused; `ENGINE_INCOMPATIBLE` | Install the pinned compatible server |
| OpenCode authentication failure | server 401/403/auth-looking error | `ENGINE_AUTH`; no model call claimed | Check `OPENCODE_PASSWORD` and server auth mode |
| Selected model missing/unavailable | catalog/selection check | `MODEL_UNAVAILABLE`; no substitute | Choose another model reported by OpenCode |
| Free/local-only policy blocks a model | project access mode + catalog pricing | selection and run rejected; no provider request | Choose a free/local model or deliberately switch to All accessible models |
| Paid/unknown-price model not yet confirmed | project acceptance timestamp | selection and run rejected; no provider request | Review the pricing/metadata warning and confirm before the first request |
| Provider privacy/data-policy rejection | provider status/message | `PROVIDER_DATA_POLICY`; no automatic retry | Review the provider's terms, choose a compliant route, or deliberately change the workspace privacy preference |
| Provider authentication failure | 401/provider auth text | `PROVIDER_AUTH`; no automatic retry | Reconnect the provider inside OpenCode, then retry |
| Provider rate/quota limit | 429/402/quota text | `PROVIDER_RATE_LIMIT`/`PROVIDER_QUOTA`; no automatic retry | Wait for the limit window or check quota/billing, then start a new request |
| Native permission pending | permission list/timeout/progress phase | operation `WAITING_PERMISSION`; app never approves | Resolve in OpenCode, then reconcile |
| Native timeout/disconnect | timeout/network error | operation `ABANDONED` with recovery marker; never replay | Reconcile now (retrieves and validates the late result once), retry after a confirmed failure, or mark abandoned |
| Late native success/diff | response arrives after timeout | retrieved and validated on reconcile; applied exactly once | Reconcile now; if the diff/reply is not retrievable yet it stays `COMPLETED_UNAPPLIED` and reconcile again later |
| App restart with in-flight work | startup recovery | in-flight statuses → `ABANDONED` with recovery marker | Reconcile now; do not start another run before reconciliation |
| Retry of an uncertain run | retry endpoint gate | refused (`RETRY_NOT_CONFIRMED`) | Reconcile first; only a confirmed `FAILED` Maker run can be retried |
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

Provider failures are also stored on the operation (`providerError`) with a `provider-…` diagnostic reference. The UI card explains what happened, whether saved work changed, and the repair action. Technical details are redacted of authorization headers, API keys, passwords, cookies, and local paths. Dismissing the card does not erase the operation evidence; inspect it in Activity & results under Technical details.

## Budgets

`GET /api/runtime` exposes effective deployment budgets (authenticated):

- guide timeout (`UB_GUIDE_TIMEOUT_MS`, default 90s);
- Maker timeout (`UB_MAKER_TIMEOUT_MS`, default 180s);
- Node check timeout (`UB_NODE_CHECK_TIMEOUT_MS`, default 30s);
- per-session token budget (`UB_MAX_SESSION_TOKENS`, default 200k);
- optional deployment-wide session cost limit (`UB_MAX_SESSION_COST_USD`; `unlimited`, `disabled`, `0`, or unset means no app limit).

Per-project cost/token/duration limits are stored in `project.modelPreferences.budget` and can be updated through `POST /api/model-preferences`; the current values appear in `GET /api/project`.

The stricter deployment or project limit wins. The app enforces what OpenCode exposes reliably after a session. It does **not** enforce a per-session tool-call budget because OpenCode's stats API is project/range-oriented. For a model whose price is unknown, OpenCode may report cost only after a request; the limit cannot prevent a charge that occurs before that report. Provider quota is not predicted or guaranteed.

## Restart procedure

1. Stop the app with `SIGTERM`/`SIGINT`; wait for the server to close.
2. Start OpenCode first, then the app.
3. Check `/api/health` (minimal), sign in if hosted, and load `/api/runtime` with the session token.
4. Check `/api/project`; reconcile any `ABANDONED` operation (Reconcile now) before a new run — the app will refuse a new run until the uncertainty is resolved or abandoned.
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
