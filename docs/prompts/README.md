# Local prompt set

These are complete procedures saved in this repository, not summaries or links to missing chat messages. Saving or loading a prompt does not activate its workflow.

| Stage | Local file | Version and role |
|---|---|---|
| 0 — Oracle | [Prompt-0-Product-Discovery-v5.1.md](Prompt-0-Product-Discovery-v5.1.md) | Complete unchanged source v5.1: product discovery and approved idea packet |
| 1 — Architect | [PROMPT_1_ARCHITECT.md](PROMPT_1_ARCHITECT.md) | Complete project edition 5.2-project.1: one section, revisions, exact-version approval, then next |
| 2 — Maker | [Prompt-2-Build-and-Verify-v5.1.md](Prompt-2-Build-and-Verify-v5.1.md) | Complete unchanged source v5.1: implementation and development verification |
| 3 — Witness | [Prompt-3-Demo-and-Submission-v1.0.md](Prompt-3-Demo-and-Submission-v1.0.md) | Complete unchanged source v1.0: independent review, article/video/social/interview materials and submission |

The [engineering blueprint](../ENGINEERING_BLUEPRINT.md) and [idea packet](../Unfinished-Business-Idea-Packet-v1.md) hold the current project decisions. Prompt 1 is the local project edition; the user's global source prompts have not been replaced. Prompts 0, 2 and 3 preserve the complete supplied text and source filenames.

## Required project context and precedence

Use the latest explicit user instructions and current blueprint amendments above conflicting source-prompt defaults. Load the complete active stage prompt together with this project context and the relevant approved upstream artifacts. Do not concatenate all four stage prompts on every turn or substitute their titles/summaries for their actual procedures.

For work on Unfinished Business itself:

1. Repository: `https://github.com/kernelKain/unfinished-business`; existing branch: `main`.
2. Do not create phase branches. Complete and verify a phase, then make one commit for that phase before starting the next implementation phase. Internal steps are checklist units, not individual commits. This explicitly replaces the original Prompt 2 per-step commit and phase-branch defaults. If the phase commit is blocked, remain at its gate; do not silently continue to the next phase.
3. Build on OpenCode's native harness. Reuse its agent loop, model access, tools, permissions and sessions. The application adds the interface, staged approvals, decision records and evidence references; it does not rebuild the coding engine or a general command executor.
4. The execution model is chosen from OpenCode's discovered, currently available catalog. Unfinished Business must not hard-code a model or offer a universal reasoning scale. Provider credentials remain in OpenCode. Historical source prompts may mention the earlier free DeepSeek intent; the current integration contract in `docs/OPENCODE_INTEGRATION.md` governs runtime behavior.
5. Inside the product, Architect presents one section, accepts questions/changes, waits for approval of that exact current version and then continues. A question, `next`, model recommendation or reconnect is not approval. Persist progress and reopen affected sections after changes. Maker needs all required current plan sections approved and separate execution scope.
6. Prompt 2 owns implementation, development tests/browser review, technical documentation and build evidence. Prompt 3 owns independent final acceptance, article/video/social/interview production and submission packaging/confirmation. This four-stage split supersedes older Prompt 0 wording assigning general delivery to Prompt 2.
7. The user has supplied 16 working hours, requests agent-led work with minimal necessary input, and prohibits new cash spending. Access/credits are not automatically verified or authorized by a source prompt. Preserve current work and actual permission boundaries.

These settings govern this harness repository. Projects created with the product retain their own approved decisions and latest explicit user policies; do not silently apply this repository's path, accounts, budget or external-action authority to another project.

## Runtime use

This is currently a documentation bundle; there is no implemented prompt loader or verified runtime yet. During implementation, the loader must preserve the entire active procedure and apply the project context above explicitly. It must enforce approvals in application state and native permissions rather than rely on model text. Runtime installation/loading and public redistribution remain subject to the blueprint's version, license and access checks.

An entry stage is activated only by an explicit user instruction or an already authorized product-stage transition. Reading these files, approving one section, or saving documents does not grant implementation, Git, spending, account setup, deployment, public transcript sharing, publication or submission authority.
