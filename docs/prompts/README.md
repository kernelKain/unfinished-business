# Local runtime prompt set

**Status:** Runtime procedures; not phase history or implementation-prompt material.
**Owner:** Product/runtime.
**Last verified:** 2026-10-31.

These are the complete procedures loaded by `src/server/prompts/loader.ts`. They are not summaries or links to missing chat messages. Saving or loading a prompt does not activate its workflow.

| Stage | Local file | Version and role |
|---|---|---|
| 0 — Oracle | [Prompt-0-Product-Discovery-v5.1.md](Prompt-0-Product-Discovery-v5.1.md) | Complete unchanged source v5.1: product discovery and approved idea packet |
| 1 — Architect | [PROMPT_1_ARCHITECT.md](PROMPT_1_ARCHITECT.md) | Complete project edition 5.2-project.1: one section, revisions, exact-version approval, then next |
| 2 — Maker | [Prompt-2-Build-and-Verify-v5.1.md](Prompt-2-Build-and-Verify-v5.1.md) | Complete unchanged source v5.1: implementation and development verification |
| 3 — Witness | [Prompt-3-Demo-and-Submission-v1.0.md](Prompt-3-Demo-and-Submission-v1.0.md) | Complete unchanged source v1.0: independent review, article/video/social/interview materials and submission |

The [superseded engineering blueprint](../history/ENGINEERING_BLUEPRINT.md) and [idea packet](../history/Unfinished-Business-Idea-Packet-v1.md) preserve project provenance. Current decisions live in [DECISIONS.md](../DECISIONS.md), [PRODUCT_BRIEF.md](../PRODUCT_BRIEF.md), and [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md). Prompt 1 is the local project edition; the user's global source prompts have not been replaced. Prompts 0, 2 and 3 preserve the complete supplied text and source filenames.

## Required project context and precedence

Use the latest explicit user instructions and the current product/decision documents above conflicting source-prompt defaults. Load the complete active stage prompt together with this project context and the relevant approved upstream artifacts. Do not concatenate all four stage prompts on every turn or substitute their titles/summaries for their actual procedures.

For work on Unfinished Business itself:

1. Repository: `https://github.com/kernelKain/unfinished-business`; existing branch: `main`.
2. Do not create phase branches. Complete and verify a phase, then make one commit for that phase before starting the next implementation phase. Internal steps are checklist units, not individual commits. This explicitly replaces the original Prompt 2 per-step commit and phase-branch defaults. If the phase commit is blocked, remain at its gate; do not silently continue to the next phase.
3. Build on OpenCode's native harness. Reuse its agent loop, model access, tools, permissions and sessions. The application adds the interface, staged approvals, decision records and evidence references; it does not rebuild the coding engine or a general command executor.
4. The execution model is chosen from OpenCode's discovered, currently available catalog. Do not assume a universal reasoning scale. The app rejects paid or unpriced remote models and accepts free or local models; provider credentials remain in OpenCode. Provider credentials remain in OpenCode. Historical source prompts may mention the earlier free DeepSeek intent; the current integration contract in `docs/OPENCODE_INTEGRATION.md` governs runtime behavior.
5. Inside the product, Architect presents one section, accepts questions/changes, waits for approval of that exact current version and then continues. A question, `next`, model recommendation or reconnect is not approval. Persist progress and reopen affected sections after changes. Maker needs all required current plan sections approved and separate execution scope.
6. Prompt 2 owns implementation, development tests/browser review, technical documentation and build evidence. Prompt 3 owns independent final acceptance, article/video/social/interview production and submission packaging/confirmation. This four-stage split supersedes older Prompt 0 wording assigning general delivery to Prompt 2.
7. The user has supplied 16 working hours, requests agent-led work with minimal necessary input, and prohibits new cash spending. Access/credits are not automatically verified or authorized by a source prompt. Preserve current work and actual permission boundaries.

These settings govern this harness repository. Projects created with the product retain their own approved decisions and latest explicit user policies; do not silently apply this repository's path, accounts, budget or external-action authority to another project.

## Runtime use

The loader is implemented in `src/server/prompts/loader.ts`. It resolves the active stage file under `docs/prompts/`, refuses a file shorter than 1,000 characters (so a summary cannot silently replace a procedure), and passes the complete text plus concise current state to OpenCode. `tests/prompts.test.ts` verifies that all four procedures load and remain substantive.

The loader preserves the entire active procedure and applies the project context above explicitly. Approvals are enforced in application state and native permissions, not by model text. Runtime loading does not grant installation, Git, spending, account, deployment, publication, or submission authority.

Do not place implementation-phase prompts (such as this Phase 9 release-gate instruction) in `docs/prompts/`. Do not archive these four runtime files with the superseded planning documents. If a runtime prompt is renamed, update the loader map, prompt tests, links, provenance, and migration notes in one change.

An entry stage is activated only by an explicit user instruction or an already authorized product-stage transition. Reading these files, approving one section, or saving documents does not grant implementation, Git, spending, account setup, deployment, public transcript sharing, publication, or submission authority.
