# Product brief — Unfinished Business

**Status:** Approved for the Phase 4 interface. Last updated 2026-10-31.

## One sentence

Unfinished Business is an OpenCode-powered hackathon project builder where four friendly spirits guide one unfinished idea through a clear proposal, an approved plan, a bounded real build, and evidence you can defend.

## Positioning

Unfinished Business is a **workshop around OpenCode**, not a replacement coding agent. OpenCode owns the model route, agent loop, native tools, tool permissions, execution, interruption, and native sessions. This product owns the four-stage workshop, exact-version approvals, dependency invalidation, evidence views, the first-run connection/discovery flow, and the Ghostlight interface.

The product is for a builder with an idea but no finished submission: a student at a hackathon, a solo maker on a short deadline, or a developer returning to a stalled project. It is not a multi-user platform, a hosted remote-code-execution service, or an autonomous deployer.

### Promise

- Make the next honest action obvious.
- Never turn a model reply into an approval.
- Never turn an unobserved result into evidence.
- Keep failures and empty states visible.
- Let a visitor understand the product before connecting an engine.

### Non-goals

- Remote access to a visitor's local repository.
- A public hosted sandbox with arbitrary execution.
- A second coding harness, inference client, or command executor.
- Paid-model fallback, fabricated usage metrics, testimonials, awards, or guaranteed outcomes.
- Automatic deployment, publication, or submission.

## The four roles

| Spirit | Stage | Function | Approval boundary |
|---|---|---|---|
| Oracle | Clarify | Turn an unfinished idea into a product proposal and open questions | The user approves the product; the proposal alone is not approval |
| Architect | Plan | Draft one planning section against its dependencies | The user approves the exact current version and hash; revisions make old approval stale |
| Maker | Build | Perform a bounded native edit through OpenCode | A separate Maker scope is required; OpenCode still owns tool permission |
| Witness | Review | Inspect evidence in a fresh session and prepare review drafts | Notes are drafts, not a submitted article, video, or proof of success |

## Two honest usage paths

| Path | What it is | What it is not |
|---|---|---|
| Hosted demo or private deployment | A labeled deterministic walkthrough, or a password-protected workshop using the server's own isolated demo workspace | Not a public sandbox; not access to a visitor's local repository |
| Full local mode | The browser app, local API, and pinned OpenCode server running on the builder's machine over loopback | Not a guarantee of free-model availability; not permission to widen tool scope |

The landing page must describe both paths without implying that a hosted page can read a local checkout.

## OpenCode-only claim

Approved language:

> OpenCode supplies the agent loop, model access, native tools, permissions, and sessions. Unfinished Business adds the four-stage workshop, exact-version approvals, dependency invalidation, an evidence ledger, and a first-run connection/discovery panel.

Models are discovered from the OpenCode catalog rather than assumed. The free DeepSeek route, `opencode/deepseek-v4.1-flash-free`, was the intended development route and was listed by the tested server, but it is time-limited and must be verified on the user's own account. No paid fallback is configured by this repository.

Provider API keys stay in OpenCode. The first-run panel accepts only the OpenCode server Basic-auth password, holds it in memory for local work, and never exposes a provider-key field.

## Landing information architecture

1. Hero: “Turn unfinished ideas into hackathon-ready builds.”
2. Value statement and OpenCode-only positioning.
3. Primary actions: try the example, connect OpenCode, set up locally.
4. Two ways to use it: hosted/private and full local.
5. Four-spirit workflow explanation.
6. Deterministic demo teaser with an explicit fixture label.
7. OpenCode controls and evidence preview.
8. Idea-to-tool recommendation preview.
9. Local setup command tabs sourced from tested documentation.
10. Privacy and security boundaries.
11. FAQ and final call to action.

## Calls to action

| Action | Destination | Truthful expectation |
|---|---|---|
| Try the example | `/demo` | A scripted fixture, not live inference |
| Connect OpenCode | Setup dialog | Instructions only; no connection is implied until the engine answers |
| Set up locally | `#local-setup` | Commands match `docs/LOCAL_SETUP.md` |
| Open workshop | `/workshop` | The real workflow; engine status is visible and may be unreachable |
| Walk through the fixture | `/demo` | Representative states with fixture IDs |

## Prohibited claims

Do not add:

- testimonials, customer logos, star ratings, or “trusted by” statements;
- user counts, build counts, time-saved figures, or success rates without a measured source;
- awards, rankings, organizer endorsements, or partner claims not actually granted;
- “guaranteed working build,” “autonomous,” “fully hosted coding agent,” or “reads your repository”;
- live-inference language around the deterministic demo;
- claims that app approval overrides an OpenCode permission denial.

## Success criteria

A first-time visitor can explain:

1. what the product does;
2. who Oracle, Architect, Maker, and Witness are;
3. OpenCode's role and the no-second-harness boundary;
4. the difference between the deterministic demo, a hosted/private instance, and full local mode;
5. what the product cannot reach.
