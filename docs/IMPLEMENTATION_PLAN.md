# Implementation plan and phase history

The canonical product/phase record is [ENGINEERING_BLUEPRINT.md](ENGINEERING_BLUEPRINT.md). This file tracks the current implementation queue and the Phase 8 hardening scope.

## Completed phases

| Phase | Commit | Outcome |
|---|---|---|
| Foundation | `14fc6a6` | Node/Hono/React foundation, native v2 client boundary, atomic state, prompts, tests |
| Workflow | `abf87f7` | staged Oracle → Architect → Maker → Witness flow, exact approvals, revision/dependency rules, idempotent actions, native recovery |
| Experience | `b465fa0` | haunted workshop UI, live journey, evidence/activity, fresh Witness drafts |
| Verification / deployment | `ccb3bcd` … `9dd4b9e` | Sentry, Render, Entire, dependency audit, release/source-map workflow |
| Phase 8 hardening | this change | workspace/network/API/state/telemetry/operations hardening + tests/docs |

## Phase 8 units

1. **Threat model and inspection** — trust boundaries, input/sensitive-data inventory, dependency-audit reachability, mode-specific threats. See [ARCHITECTURE.md](ARCHITECTURE.md).
2. **Filesystem and workspace** — canonical roots, broad-root rejection, traversal/symlink/special-file checks, static containment, private permissions, atomic state with backups/quarantine/migrations.
3. **OpenCode and network** — loopback default, HTTPS/allowlist remote policy, DNS/IP classification, redirect refusal, timeout/response caps, version/auth/model readiness, no automatic uncertain retry.
4. **Browser/API/events** — Host/Origin/Sec-Fetch-Site, constant-time session token, Basic Auth in hosted modes, JSON/size/ID checks, rate/concurrency gates, authenticated/bounded SSE, cross-operation checks.
5. **Secrets, telemetry, privacy** — centralized redaction across state/exports/errors/logs/Sentry; independent redaction tests; retention; minimal health.
6. **Budgets and operations** — configurable elapsed/token/cost limits, explicit provider-data gaps, recovery for unavailable/limited/permission/disk/corrupt/restart/unknown/failed-check cases, structured correlation-ID logs.
7. **Cleanup** — removed the unused `opencode/operations` helper and its test, unused transition/config/workspace helpers, and an unused env knob; audited duplicate helpers and environment variables. No user-owned artifacts were removed.
8. **Verification/docs** — typecheck, full tests, production build, targeted manual checks, dependency audit, secure setup/deployment docs, phase handoff.

## Not in Phase 8

- Phase 9 or any new product capability.
- Remote repository connectors, MCP/plugin installation, multi-tenant isolation, arbitrary workspace execution.
- Paid model fallback, provider-quota enforcement claims, or new hosting providers.
- Intrusive external testing or third-party attack traffic.

## Verification commands

```bash
npm ci
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

Manual checks: start the app with a disposable `UB_DATA_DIR`; verify minimal health, session token requirement, runtime/limits, static fallback, traversal rejection, rate/busy responses, restart recovery, and a corrupt-state startup. These are local checks only.
