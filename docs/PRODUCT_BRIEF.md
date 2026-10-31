# Product brief — Unfinished Business

**Status:** Approved product; Upgrade Phase 6 (canonical sample and rewritten landing page) verified locally.
**Owner:** Product/interface.
**Last verified:** 2026-11-01.

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
- Silent paid-model fallback, fabricated usage metrics, testimonials, awards, or guaranteed outcomes.
- Automatic deployment, publication, or submission.

## Release truth (Phase 9)

The release candidate has one project story with three deployment modes:

| Mode | Browser can configure OpenCode? | OpenCode process | Persistence | Intended use |
|---|---|---|---|---|
| `local` | Yes; password may be held in memory | Supplies it separately on loopback | `UB_DATA_DIR` | A developer on their own Linux x64 or macOS machine |
| `private-hosted` | No; environment/secret store owns the URL and password | Loopback child process | Private persistent disk | Protected Render or self-hosted instance |
| `hosted-demo` | No | None | None for visitors | Public recorded sample |

Maker edits only the isolated demo workspace under `UB_DATA_DIR`. The product does not mount an arbitrary local or hosted repository in this release. The Node check is a bounded child process, not an OS sandbox. App approvals constrain workflow transitions; they never override an OpenCode permission denial.

## The four roles

| Spirit | Stage | Function | Approval boundary |
|---|---|---|---|
| Oracle | Clarify | Turn an unfinished idea into a product proposal and open questions | The user approves the product; the proposal alone is not approval |
| Architect | Plan | Draft one planning section against its dependencies | The user approves the exact current version and hash; revisions make old approval stale |
| Maker | Build | Perform a bounded native edit through OpenCode | A separate Maker scope is required; OpenCode still owns tool permission |
| Witness | Review | Inspect evidence in a fresh session and prepare review drafts | Notes are drafts, not a submitted article, video, or proof of success |

### Workshop interface promise

The workshop shows one primary task at a time. The project outline opens as a drawer, Activity & results appears only when there is an operation or check, and Project memory holds decisions, answers, assumptions, constraints, and unresolved questions. Model and permission controls are visible; native IDs, capability mappings, raw evidence, provider payloads, sessions, revert controls, export, and transcripts stay under Technical details or Advanced diagnostics. A correction to Project memory supersedes the prior entry and never changes an approval or draft.

## Runtime modes and landing paths

| Path | What it is | What it is not |
|---|---|---|
| Hosted sample | A labeled recorded sample served without OpenCode, credentials, a session token, or visitor persistence | Not live inference; not a sandbox; not access to a visitor's repository |
| Private hosted | A password-protected workshop on a private disk with a loopback OpenCode child | Not a public sandbox; not access to a visitor's local checkout |
| Local workshop | The browser app, local API, and pinned OpenCode server on the builder's machine over loopback | Not a guarantee of free-model availability; not permission to widen tool scope |

The landing page presents **Try the example** as its one primary action and **Run locally** as the secondary action. Hosted sample and private hosted are described together under local setup and privacy; all three modes are named without implying that a hosted page can read a local checkout. The hosted sample's `/workshop` route explains that it is read-only and offers the guided sample or local setup as exits.

## OpenCode-only claim

Approved language:

> OpenCode supplies the agent loop, model access, native tools, permissions, and sessions. Unfinished Business adds the four-stage workshop, exact-version approvals, dependency invalidation, an evidence ledger, and a first-run connection/discovery panel.

Models are discovered from the OpenCode catalog rather than assumed. New projects may use any model OpenCode reports as available, with an optional free/local-only policy and an optional spending limit. A paid or unknown-price remote route requires an explicit confirmation before its first request; the app never silently substitutes a model or treats a model reply as approval. The free `opencode/deepseek-v4.1-flash-free` route remains one reported option when available, but availability is time-limited and account-dependent.

Provider API keys stay in OpenCode. The first-run panel accepts only the OpenCode server Basic-auth password, holds it in memory for local work, and never exposes a provider-key field.

## Landing information architecture

1. Hero: “Finish the project you already started.”
2. Primary action **Try the example**; secondary action **Run locally**; quiet setup link.
3. Four user outcomes: clarify the idea, approve the plan, build with OpenCode, verify the result.
4. Four-stage workflow explanation with the four spirits.
5. One sample project: Driftwatch, the abandoned open-source CLI, with the problem, unfinished work, bounded revival, and a recorded check.
6. Why OpenCode: “OpenCode does the coding. This workshop does the deciding.”
7. Local setup and privacy: hosted sample, private hosted, local workshop, tested commands, and boundaries.
8. FAQ and final call to action.

The static idea-to-tool recommendation table was removed because it was not interactive or capability-driven. Technical sample provenance, fixture version, caveats, and the evidence inspector live under details rather than in the main story.

## The guided sample's role

The recorded Driftwatch sample is the product's **onboarding proof** and the judge's **fast path to the value story**:

- **Onboarding:** a first-time visitor can complete the whole journey — abandoned project → approved plan → bounded implementation → diff/check → Witness evidence → next step — without an OpenCode account, provider key, model quota, or repository.
- **Judging:** the same interface contracts render live and recorded runs, so the sample demonstrates the approval, permission, progress, evidence, and recovery surfaces without pretending the recorded run is live.
- **Trust:** the sample is explicit about what it cannot prove. The live native session remains `NOT_RUN`; reset affects only the sample; the hosted sample cannot mutate anything.

One canonical fixture powers the sample, the landing preview, the evidence view, screenshots, and evidence examples. The sample is a **guided story**, not a second product surface. It uses the production `RunInspector`, `SpiritCharacter`, `SpiritStageTabs`, `StatusChip`, and shared workflow schemas.

## Calls to action

| Action | Destination | Truthful expectation |
|---|---|---|
| Try the example | `/demo` | An interactive recorded sample; not live inference |
| Run locally | `/workshop` | The real workflow; engine status is visible and may be unreachable |
| Connect OpenCode | Setup dialog | Instructions only; no connection is implied until the engine answers |
| Set up locally | `#local-setup` | Commands match `docs/LOCAL_SETUP.md` |
| Play the 90-second version | Inside `/demo` | A recording path over the same sample; not a competing landing CTA |

## Prohibited claims

Do not add:

- testimonials, customer logos, star ratings, or “trusted by” statements;
- user counts, build counts, time-saved figures, or success rates without a measured source;
- awards, rankings, organizer endorsements, or partner claims not actually granted;
- “guaranteed working build,” “autonomous,” “fully hosted coding agent,” or “reads your repository”;
- live-inference language around the recorded sample;
- claims that app approval overrides an OpenCode permission denial.

## Success criteria

A first-time visitor can explain:

1. what the product does;
2. who Oracle, Architect, Maker, and Witness are;
3. OpenCode's role and the no-second-harness boundary;
4. the difference between the recorded sample, a hosted/private instance, and the local workshop;
5. what the product cannot reach.
