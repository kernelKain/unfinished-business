# Implementation plan

## Phase 1 prerequisite — asynchronous run lifecycle

Status: **implemented, tested, documented** before Phase 2 configuration UI.

| Unit | Work | Evidence |
|---|---|---|
| P1.1 | Persist `QUEUED`/`RUNNING`/terminal operation state with model, agent, start/finish timestamps. | `src/server/experience/runs.ts`, `src/server/workflow/model.ts` |
| P1.2 | Return `202` from `POST /api/runs` after enqueue; poll project state instead of holding the request. | `src/server/app.ts`, `src/web/api.ts`, `src/web/App.tsx` |
| P1.3 | Apply background completion against the latest revision; serialize store writes and use unique temp files. | `WorkflowService.executeLatest`, `AtomicProjectStore` |
| P1.4 | Interrupt/cancel semantics that cannot be overwritten by late completion. | `ExperienceService.cancel`, `MakerRunCoordinator` |
| P1.5 | Restart recovery: in-flight runs become `UNKNOWN`, never replayed. | `markInterruptedRuns` in `src/server/index.ts` |
| P1.6 | Tests for non-blocking return, completion, failure, duplicate action, cancel, and inactive run. | `tests/runs.test.ts`; 53 tests pass |

The Phase 1 async lifecycle is documented in [ARCHITECTURE.md](ARCHITECTURE.md#asynchronous-maker-lifecycle).

## Phase 2 — onboarding, discovery, supported controls

Status: **implemented and verified for the local Phase 2 handoff**.

| Unit | Work | Primary files |
|---|---|---|
| 2.1 | Connection state model (`not_configured`, `checking`, `connected`, `authentication_required`, `incompatible_version`, `unavailable`, `degraded`) and diagnostics. | `src/shared/opencode.ts`, `src/server/opencode/connection.ts` |
| 2.2 | URL policy: loopback HTTP, remote HTTPS, no URL credentials. | `src/server/opencode/client.ts` |
| 2.3 | First-run wizard: URL/auth, connectivity test, provider readiness, model choice, variant choice, harmless verification. | `src/web/onboarding.tsx` |
| 2.4 | Provider/model normalization: key, name, pricing, local, limits, modalities, tools, reasoning, variants, availability. | `src/server/opencode/discovery.ts` |
| 2.5 | Remove the fixed model; schema v2 `engine` selection; v1 migration preserving legacy identity only when the catalog still reports it. No unrelated/paid auto-substitution. | `src/server/workflow/model.ts`, `tests/migration.test.ts`, `tests/connection.test.ts` |
| 2.6 | Selected-model validation; reject unavailable models and unreported variants. | `ConnectionService.validateSelection`, `tests/onboarding.test.ts` |
| 2.7 | Capability-driven OpenCode panel: models, agents/roles, permissions, commands, skills, MCP, formatter/LSP, sessions, usage. | `src/web/opencode-panel.tsx` |
| 2.8 | Role mapping to explicit agents with visible fallback. | `src/server/opencode/discovery.ts`, `src/server/experience/guide.ts` |
| 2.9 | Project-scoped session list/resume/interrupt/fork/compact/revert and permission replies. | `src/server/opencode/sessions.ts`, `tests/sessions.test.ts` |
| 2.10 | Maker uses the chosen model and records it in operation/evidence/export. | `src/server/experience/service.ts`, `src/server/experience/runs.ts`, `tests/experience.test.ts` |
| 2.11 | Secret redaction and rejection of provider-key payloads; no browser storage. | `src/server/opencode/client.ts`, `src/server/app.ts`, `tests/connection.test.ts` |
| 2.12 | Deployment modes and managed connection UI. | `src/server/index.ts`, `src/web/onboarding.tsx`, `render.yaml` |
| 2.13 | Opt-in live compatibility diagnostic. | `scripts/opencode-live-diagnostic.ts` |
| 2.14 | Documentation set and active-doc cleanup. | `docs/*`, `README.md`, `.env.example` |

## Verification matrix

| Check | Status | Evidence |
|---|---|---|
| Typecheck | PASS | `npm run typecheck` |
| Full tests | PASS — 55 tests | `npm test` (connection, migration, onboarding, runs, sessions, experience, workflow, recovery) |
| Production build | PASS | `npm run build`; Vite reports only the existing large-chunk warning |
| Live OpenCode compatibility | PASS for tested surface | `npm run diagnose:opencode` against `2.0.32`; no inference |
| Onboarding browser E2E | PASS | built app + mock server at `2.0.32`: unavailable → reconnect → model step → model saved; no secrets in browser storage or API response |
| Secret redaction | PASS | `tests/connection.test.ts` |
| Async run prerequisite | PASS | `tests/runs.test.ts` |
| Model migration | PASS | `tests/migration.test.ts` |

## Deferred / out of scope

- Phase 3: independent final acceptance, article/video/social/submission materials.
- A separate tool catalog UI (not exposed by OpenCode `2.0.32`).
- Provider quota/balance programmatically (not exposed by the HTTP API).
- Live formatter/LSP health (configuration presence only).
- Automatic provider-key entry (never; keys belong in OpenCode).
- Arbitrary remote OpenCode URLs over plain HTTP (never).
- Automatic replay of an interrupted native run (never; reconcile instead).

## Phase handoff rule

Stop after Phase 2 verification and documentation. Do not start Phase 3.
