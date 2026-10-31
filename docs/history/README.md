# History

Superseded planning and setup records are kept here for provenance. They are not current instructions.

| Record | Replaced by |
|---|---|
| [Engineering blueprint](ENGINEERING_BLUEPRINT.md) | [Architecture](../ARCHITECTURE.md), [Implementation plan](../IMPLEMENTATION_PLAN.md), [Decisions](../DECISIONS.md) |
| [Product idea packet](Unfinished-Business-Idea-Packet-v1.md) | [Product brief](../PRODUCT_BRIEF.md), [Decisions](../DECISIONS.md) |
| [Render deployment](RENDER_DEPLOYMENT.md) | [Hosted deployment](../HOSTED_DEPLOYMENT.md) |
| [Sentry and OpenCode setup](SENTRY_AND_OPENCODE_SETUP.md) | [OpenCode integration](../OPENCODE_INTEGRATION.md), [Local setup](../LOCAL_SETUP.md), [Hosted deployment](../HOSTED_DEPLOYMENT.md) |

The four runtime stage prompts are **not** history. They remain in [`docs/prompts/`](../prompts/README.md) and are loaded by `src/server/prompts/loader.ts`.

## Migration notes

Phase 9 compared each superseded file against the canonical set and retained the complete original here rather than deleting unique facts.

- **Engineering blueprint:** phase history, acceptance criteria, proof/failure records, partner constraints, and execution provenance remain in the archived file. Current architecture, plan, and decisions are canonical.
- **Idea packet:** event rules, eligibility notes, category targets, budget/access constraints, decision IDs D01–D15, and source provenance remain in the archived file. Current product positioning and decisions are canonical; discovery-era event and partner statements are not current claims.
- **Render deployment / Sentry and OpenCode setup:** original setup steps and operational notes remain in the archived files; current procedures are in [Hosted deployment](../HOSTED_DEPLOYMENT.md), [OpenCode integration](../OPENCODE_INTEGRATION.md), [Local setup](../LOCAL_SETUP.md), and [Operations](../OPERATIONS_AND_RECOVERY.md).
- Thin pointer files at the old top-level paths keep stable incoming links working.
- The four runtime prompts were **not** moved or archived. They remain in [`docs/prompts/`](../prompts/README.md) and are loaded by `src/server/prompts/loader.ts`.
