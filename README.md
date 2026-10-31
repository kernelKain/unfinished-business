# Unfinished Business

**Bring your ideas to life.**

A local browser companion built on OpenCode's open-source coding harness. Four friendly spirits guide a builder from an unfinished idea through an approved plan, real implementation, verification, and submission drafts.

| Spirit | Role |
|---|---|
| Oracle | Clarify an idea and approve a useful product scope |
| Architect | Present one planning section, revise it, and wait for approval before continuing |
| Maker | Use OpenCode to perform approved work and show actual results |
| Witness | Review evidence and prepare honest final materials |

OpenCode provides the agent loop, model access, tools, permissions, and native sessions. Unfinished Business adds the workshop interface, stage progression, versioned approvals, decision history, and evidence views.

## Status

Phase 8 hardening is complete on top of the committed foundation, workflow, experience, and deployment phases. Typecheck, the full security/recovery test suite, and the production build pass. The server validates workspace and OpenCode targets, protects all state/mutation/SSE routes, redacts secrets across state/exports/logs/Sentry, preserves and recovers state, and bounds resource use. Oracle, Architect, Maker, and Witness run through OpenCode's free DeepSeek route; Maker edits only an isolated demo workspace, then the app runs a bounded `node --test` there. Sentry remains optional and metadata-only.

The application supports three explicit modes: `local` (loopback), `hosted-demo` (the Render blueprint), and `private-hosted`. It is a trusted single-project tool, not a multi-tenant sandbox; shared-host isolation and remote repository connectors remain deferred. Backboard remains dependent on its API/tooling setup and is not part of this phase.

```bash
npm ci
npm run dev
# Focused hardening checks:
npm run test:security
```

In another terminal, `npm run build && npm start` serves the built workshop and API on `127.0.0.1`. Set `UB_PORT` if `4200` is taken. `OPENCODE_BASE_URL` defaults to `http://127.0.0.1:4096`; remote targets require HTTPS and an explicit allowlist. The server scripts and Vite read the gitignored `.env`; use `.env.example` as the safe template. Start `opencode serve` yourself; this app does not print or store its password. Project data stays in `UB_DATA_DIR` (default `.unfinished-business/`), which is gitignored. All state/mutation routes require the loopback browser session token; `/api/health` is intentionally minimal and public. Do not put `UB_DATA_DIR` at `/`, your home, the repository root, or another broad root.

Environment setup, Sentry release/source-map configuration, and OpenCode password matching are documented in [docs/SENTRY_AND_OPENCODE_SETUP.md](docs/SENTRY_AND_OPENCODE_SETUP.md).

Render deployment and its required secrets are documented in [docs/RENDER_DEPLOYMENT.md](docs/RENDER_DEPLOYMENT.md). The hosted service is password protected and uses a persistent disk; it is not compatible with Render's free plan.

Run the dependency-free diagnostic from the repository:

```bash
node scripts/preflight.mjs
```

It checks the toolchain, read-only Git state, DNS, localhost socket access and Entire status. A temporary localhost listener closes immediately. OpenCode version/help use disposable temporary storage, without changing existing sessions or credentials. It performs no inference, installs, account setup, capture setup or Git writes. Exit code 1 means a blocking diagnostic failed; exit code 0 is only preflight, never a passing integration proof. See the blueprint's execution record for the tested result and resume conditions.

- [Architecture and trust boundaries](docs/ARCHITECTURE.md) — modes, data flow, controls, residual risks.
- [Operations and recovery](docs/OPERATIONS_AND_RECOVERY.md) — backups, migrations, retention, failure matrix, incidents.
- [OpenCode integration](docs/OPENCODE_INTEGRATION.md) — onboarding, URL/auth/version/retry policy.
- [Local setup](docs/LOCAL_SETUP.md) and [hosted deployment](docs/HOSTED_DEPLOYMENT.md) — secure defaults and troubleshooting.
- [UX and visual system](docs/UX_AND_VISUAL_SYSTEM.md) — permission, limit, privacy, and recovery copy.
- [Decisions](docs/DECISIONS.md), [implementation plan](docs/IMPLEMENTATION_PLAN.md), [changelog](docs/CHANGELOG.md).
- [Engineering blueprint](docs/ENGINEERING_BLUEPRINT.md) — canonical product plan and amendments.
- [Product idea packet](docs/Unfinished-Business-Idea-Packet-v1.md) — approved product scope and updated decisions.
- [Complete local prompt set](docs/prompts/README.md) — Prompts 0–3 and current project overrides.

## Development policy

- Repository: [kernelKain/unfinished-business](https://github.com/kernelKain/unfinished-business).
- Work on the existing `main` branch. Do not create phase branches.
- Complete and verify each phase, then make one commit for that phase before starting the next phase.
- Steps are work/checklist units, not individual commits. Commit subjects describe the change without phase or step numbering.
- Preserve unrelated changes. A blocked commit blocks entry to the next implementation phase; do not bypass access restrictions.

The Experience gate is committed and linked to Entire checkpoint `01M6874YH3592P2RKCZ9KV0MVQ`. Phase 8 is the active hardening unit; publication and submission belong to Prompt 3. Backboard/Sentry partner claims remain conditional on actual supported access and evidence.

## Delivery

The first release targets a local browser on Linux. A real recorded demonstration and a reproducible local-start guide provide judge access; the Render hosted demo runs the same isolated demo workspace, not arbitrary repository execution. Backboard, Sentry Agent Tracing, and Entire remain selected partner targets, with qualification conditional on meaningful actual use and evidence.

## License

[MIT](LICENSE). Dependency, prompt, and asset attribution must be checked before redistribution.
