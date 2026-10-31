# Unfinished Business

**Bring your ideas to life.**

A local browser companion built on OpenCode's open-source coding harness. Four friendly spirits guide a builder from an unfinished idea through an approved plan, real implementation, verification, and submission drafts.

| Spirit | Role |
|---|---|
| Oracle | Clarify an idea and approve a useful product scope |
| Architect | Present one planning section, revise it, and wait for approval before continuing |
| Maker | Use OpenCode to perform approved work and show actual results |
| Witness | Review evidence and prepare honest final materials |

OpenCode provides the agent loop, model access, tools, permissions, and native sessions. Unfinished Business adds the workshop interface, stage progression, versioned approvals, decision history, evidence views, and a safe first-run connection/discovery experience.

## Status

Phase 2 is implemented: a clean user can connect a compatible OpenCode server, repair authentication, inspect providers/models/capabilities, choose a supported model and reported reasoning variant, and start a bounded Maker run. The Phase 1 asynchronous run lifecycle is the prerequisite: runs return immediately, persist their state, survive a restart as `UNKNOWN`, and are never silently replayed.

The application no longer assumes a fixed model. Models, providers, limits, modalities, tools, variants, and availability are discovered from OpenCode. The chosen model is stored per project and recorded in Maker operation and evidence records. A v1 project with the old fixed-model hint migrates safely; the hint is used only if OpenCode still reports that model.

Provider API keys stay in OpenCode. The application accepts only the OpenCode server Basic-auth password, holds it in memory (or reads `OPENCODE_PASSWORD` for non-interactive starts), and never writes it to project JSON, browser storage, logs, events, Sentry, or exports.

## Requirements

- Node.js `>=22.14`
- OpenCode `2.x`; tested with `2.0.32`
- Linux for the first release (the lockfile includes the Linux baseline CLI)

## Quick start

```bash
npm ci
```

Start OpenCode in one terminal:

```bash
opencode serve --hostname 127.0.0.1 --port 4096
```

Copy `.env.example` to `.env` if you want non-interactive settings. Then:

```bash
npm run dev
```

Open `http://127.0.0.1:5173`. The first-run wizard asks for the server URL and the password printed by `opencode serve`. Provider accounts are connected inside OpenCode with `/connect`, then a model is chosen with `/models`. The wizard lists only the catalog OpenCode reports.

For the built app:

```bash
npm run build && npm start
```

Open `http://127.0.0.1:4200`. Set `UB_PORT` if `4200` is taken. Project data stays in `UB_DATA_DIR` (default `.unfinished-business/`), which is gitignored.

## Documentation

- [OpenCode integration contract](docs/OPENCODE_INTEGRATION.md) — exact tested version/API surface, credentials ownership, discovery, roles, permissions, sessions, limitations.
- [Local setup](docs/LOCAL_SETUP.md) — install/start/connect/provider/model steps and troubleshooting.
- [Hosted deployment](docs/HOSTED_DEPLOYMENT.md) — private-hosted credential handling and public-demo restrictions.
- [Architecture](docs/ARCHITECTURE.md) — configuration and trust boundaries.
- [UX and visual system](docs/UX_AND_VISUAL_SYSTEM.md) — onboarding and advanced-control states.
- [Decisions](docs/DECISIONS.md), [implementation plan](docs/IMPLEMENTATION_PLAN.md), and [changelog](docs/CHANGELOG.md).
- [Engineering blueprint](docs/ENGINEERING_BLUEPRINT.md) — historical phase record and evidence.
- [Product idea packet](docs/Unfinished-Business-Idea-Packet-v1.md) — approved product scope.
- [Complete local prompt set](docs/prompts/README.md) — Prompts 0–3 and project context.
- [Project Prompt 1](docs/prompts/PROMPT_1_ARCHITECT.md) — project-specific Architect instructions.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

The test suite covers the asynchronous run lifecycle, connection state and URL/version policy, provider/model normalization, secret redaction, fixed-model migration, model/variant validation, onboarding HTTP flow, session authorization, and the existing workflow/recovery/contracts/prompt checks.

An opt-in live compatibility check is available:

```bash
OPENCODE_LIVE_DIAGNOSTIC=1 \
OPENCODE_BASE_URL=http://127.0.0.1:4096 \
OPENCODE_PASSWORD='the server password' \
npm run diagnose:opencode
```

It performs no prompt or model inference; it may create/read/remove one disposable empty session. Without the opt-in flag it prints `SKIP`.

## Hosted deployments

`UB_DEPLOYMENT_MODE` selects the policy:

- `local` — first-run connection editing, loopback HTTP allowed.
- `hosted-private` — connection managed by environment/secret store; read-only browser configuration; OpenCode credentials in its persistent XDG data.
- `hosted-demo` — read-only connection and no provider-key prompts; may legitimately show no models.

The existing password-protected Render service is a private hosted deployment. See [docs/HOSTED_DEPLOYMENT.md](docs/HOSTED_DEPLOYMENT.md).

## Development policy

- Repository: [kernelKain/unfinished-business](https://github.com/kernelKain/unfinished-business).
- Work on the existing `main` branch. Do not create phase branches.
- Complete and verify each phase, then make one commit for that phase before starting the next phase.
- Commit subjects describe the change without phase or step numbering.
- Preserve unrelated changes. A blocked commit blocks entry to the next implementation phase; do not bypass access restrictions.

Phase 2 stops at its handoff. Phase 3 independent acceptance, publication, and submission work has not started.

## Delivery

The first release targets a local browser on Linux. A real recorded demonstration and a reproducible local-start guide provide judge access; hosted code execution is outside this release. Backboard, Sentry Agent Tracing, and Entire remain selected partner targets, with qualification conditional on meaningful actual use and evidence.

## License

[MIT](LICENSE). Dependency, prompt, and asset attribution must be checked before redistribution.
