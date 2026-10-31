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

Prompt 2 is active. Foundation is committed at `14fc6a6`, with readable Entire checkpoint `01M683PGNKWVGNV1SEFKS51S73`. The native OpenCode 2.0.32/free-DeepSeek route and permission enforcement passed at zero reported model cost. Workflow state, exact approvals, selective invalidation, idempotent actions, atomic recovery, local mutation protection, and native-operation reconciliation are implemented and verified; the single Workflow phase commit is the current gate. Backboard and Sentry access remain blocked because their credentials are absent, so no partner request or paid fallback has run.

Run the dependency-free diagnostic from the repository:

```bash
node scripts/preflight.mjs
```

It checks the toolchain, read-only Git state, DNS, localhost socket access and Entire status. A temporary localhost listener closes immediately. OpenCode version/help use disposable temporary storage, without changing existing sessions or credentials. It performs no inference, installs, account setup, capture setup or Git writes. Exit code 1 means a blocking diagnostic failed; exit code 0 is only preflight, never a passing integration proof. See the blueprint's execution record for the tested result and resume conditions.

- [Engineering blueprint](docs/ENGINEERING_BLUEPRINT.md) — canonical implementation plan and amendments.
- [Product idea packet](docs/Unfinished-Business-Idea-Packet-v1.md) — approved product scope and updated decisions.
- [Complete local prompt set](docs/prompts/README.md) — Prompts 0–3 and current project overrides.
- [Project Prompt 1](docs/prompts/PROMPT_1_ARCHITECT.md) — complete project-specific Architect instructions with section-by-section review.

## Development policy

- Repository: [kernelKain/unfinished-business](https://github.com/kernelKain/unfinished-business).
- Work on the existing `main` branch. Do not create phase branches.
- Complete and verify each phase, then make one commit for that phase before starting the next phase.
- Steps are work/checklist units, not individual commits. Commit subjects describe the change without phase or step numbering.
- Preserve unrelated changes. A blocked commit blocks entry to the next implementation phase; do not bypass access restrictions.

The active unit is the Workflow phase gate. No Experience-phase work starts until the verified Workflow commit is complete and inspected. Publication and submission belong to Prompt 3.

## Delivery

The first release targets a local browser on Linux. A real recorded demonstration and a reproducible local-start guide provide judge access; hosted code execution is outside this release. Backboard, Sentry Agent Tracing, and Entire remain selected partner targets, with qualification conditional on meaningful actual use and evidence.

## License

[MIT](LICENSE). Dependency, prompt, and asset attribution must be checked before redistribution.
