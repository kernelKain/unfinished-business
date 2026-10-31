# Architecture

Unfinished Business is a browser workshop on top of OpenCode's native harness. OpenCode owns the agent loop, providers, models, tools, permissions, and sessions. The application owns the product journey, staged approvals, evidence, connection discovery, and the trust boundary around secrets.

## Runtime topology

```text
Browser (React)
  │  same-origin HTTP, optional Basic auth, X-UB-Session-Token for mutations
  ▼
Unfinished Business server (Hono)
  │  server-side Basic auth; never forwards provider credentials
  ▼
OpenCode server (loopback by default; HTTPS remotely)
  │
  ├─ OpenCode credential store / XDG data directory
  ├─ provider + model catalog
  ├─ agents, permissions, commands, skills, MCP
  └─ native sessions, diffs, usage
```

The browser never calls OpenCode directly. This avoids browser CORS/origin dependencies and keeps the OpenCode password and provider credentials out of the page. The browser receives normalized model/agent/capability facts and project state only.

## Server modules

| Module | Responsibility |
|---|---|
| `src/server/app.ts` | HTTP routes, request validation, authorization guards, error mapping. |
| `src/server/index.ts` | Process composition, deployment mode, persistent paths, stale-run reconciliation. |
| `src/server/render-start.ts` | Hosted process supervision: starts OpenCode, then the app. |
| `src/server/opencode/client.ts` | Exact client construction, URL policy, version policy, error classification, redaction. |
| `src/server/opencode/connection.ts` | Connection state, settings persistence, discovery, diagnostics, model choice/validation. |
| `src/server/opencode/discovery.ts` | Pure normalization from OpenCode catalogs to product-safe facts. |
| `src/server/opencode/sessions.ts` | Project-scoped session list/resume/interrupt/fork/compact/revert/permission/usage actions. |
| `src/server/experience/guide.ts` | Thin adapter from spirit roles to native sessions and model/agent selection. |
| `src/server/experience/runs.ts` | Background Maker run lifecycle and persisted operation updates. |
| `src/server/experience/service.ts` | Journey transitions and orchestration across Oracle/Architect/Maker/Witness. |
| `src/server/workflow/*` | Durable project schema, exact approvals, invalidation, migration helpers. |
| `src/server/store/*` | Atomic JSON persistence, previous snapshot, serialized writes. |

## Persisted project (schema v2)

```jsonc
{
  "schemaVersion": 2,
  "revision": 0,
  "stage": "ORACLE",
  "engine": {
    "model": { "providerID": "opencode", "id": "flint-40b-free", "variant": "high" },
    "source": "user",
    "updatedAt": "2026-10-31T…",
    "legacyModel": null
  },
  "operations": [
    {
      "id": "…",
      "kind": "maker",
      "status": "SUCCEEDED",
      "model": { "providerID": "opencode", "id": "flint-40b-free", "variant": "high" },
      "agent": "build",
      "nativeSessionId": "ses_…",
      "startedAt": "…",
      "finishedAt": "…",
      "result": "…"
    }
  ],
  "evidence": [
    { "checkId": "CK-06", "result": "PASS", "model": { "providerID": "opencode", "id": "flint-40b-free" } }
  ]
}
```

- `engine.model` is the user's discovered model choice. It is not a constant.
- `engine.source` records `none`, `user`, `migrated-legacy`, or `auto-discovery`.
- Operations and evidence record the model used, so run evidence is reproducible even after a later selection change.
- `connection.json` is a separate file and contains no password.

### Migration from v1

The v1 schema was written when the code hard-coded `opencode/deepseek-v4.1-flash-free`. `migrateProject()`:

1. reads a v1 document;
2. keeps every section, action, operation, evidence, and native-session reference;
3. adds `engine: { model: null, source: "migrated-legacy", legacyModel: "opencode/deepseek-v4.1-flash-free" }`;
4. adds null model/agent/timestamps to historical operations/evidence;
5. returns schema v2.

On the next discovery, the legacy model is used only if OpenCode still reports it and it is available. Otherwise the user chooses a reported model. No unavailable model is silently substituted. A corrupt current file is preserved and the previous snapshot is offered.

## Connection state machine

```text
not_configured
  → checking
      → connected
      → degraded (untested patch, provider auth, pending permission, model issue, partial probe)
      → authentication_required (401)
      → incompatible_version (major ≠ 2 or unparseable)
      → unavailable (transport, timeout, origin/403, malformed response)
```

A check is read-only. It calls `/api/info` first, then catalog/agent/permission/command/skill/MCP/config endpoints. A failed check returns a diagnostic code and repair text; it never leaves an optimistic success status. The wizard and panel both surface the same diagnostics.

### URL and trust boundary

- `http://` is allowed only for `localhost`, `127.0.0.1`, and `::1`.
- `https://` is allowed for any host.
- URL userinfo, query strings, and fragments are rejected.
- The server password is sent as `Authorization: Basic` from the server process. It is not sent to or stored by the browser.
- `hosted-private` and `hosted-demo` treat the connection as managed; browser configuration routes return 409.
- Provider keys are never accepted by any application route.

## Asynchronous Maker lifecycle

The Phase 1 prerequisite is the non-blocking run model used here:

1. `POST /api/runs` claims the action, validates Maker scope and the selected model, persists a `QUEUED` operation with model/agent/timestamps, starts the in-process runner, and returns `202` immediately.
2. The runner persists `RUNNING`, then the native session ID as soon as OpenCode creates it.
3. The native turn, diff, and bounded Node check run outside the HTTP request.
4. Completion is applied with `executeLatest()`, a bounded retry against the current revision, so unrelated user actions can happen while the run is in flight.
5. A process restart converts `QUEUED`/`RUNNING` operations to `UNKNOWN` with a repair note. Nothing is replayed.
6. Cancellation interrupts the native session and marks the operation `CANCELLED`; a late completion cannot overwrite that state.
7. The browser polls `/api/project` while an operation is active and renders the persisted status. It does not hold an HTTP request open for the whole run.

`AtomicProjectStore` serializes writes and uses a UUID temporary filename so two background updates cannot collide or overwrite each other silently.

## Capability-driven UI

The UI renders from discovered facts, not fixed constants:

- models, providers, variants, limits, modalities, tool support, pricing, local status;
- agents and role mapping;
- pending permissions;
- commands, skills, MCP servers, formatter/LSP configuration;
- session controls and reported usage.

Unsupported controls are visible as deferred with a reason. The main journey remains the focus; advanced controls live inside the expandable OpenCode panel.

## Trust boundaries and data handling

| Boundary | Rule |
|---|---|
| Browser → app | Basic auth when hosted; session token for mutations; no provider credentials accepted. |
| App → OpenCode | Server-side only; Basic auth password in memory or `OPENCODE_PASSWORD`; HTTPS required off loopback. |
| App → disk | Project JSON, connection metadata (no password), isolated workspaces. |
| App → logs/Sentry | Redacted error messages; no authorization headers, passwords, provider keys, or prompt bodies. |
| App → export | Approved plan, drafts, selected engine metadata; no secrets. |
| OpenCode → app catalogs | Normalized, allow-listed fields; raw provider/model/config settings are discarded. |

## Deployment modes

- `local`: wizard may configure a loopback or HTTPS URL; project data under `UB_DATA_DIR`.
- `hosted-private`: connection managed by environment/secret store; OpenCode XDG data on a persistent disk; visitors do not provide credentials.
- `hosted-demo`: connection managed and read-only; no provider-key prompts; may show `NO_MODELS` when no provider is connected.

See [HOSTED_DEPLOYMENT.md](HOSTED_DEPLOYMENT.md) for the exact environment.

## Known limitations

- OpenCode `2.0.32` has no separate HTTP tool catalog.
- Formatter/LSP status is configuration presence, not live process health.
- Quota/balance is not available via the HTTP API.
- Cost/token values depend on provider reporting.
- Other 2.x patches are degraded until the live diagnostic is run.
- Fork requires a non-empty session.
