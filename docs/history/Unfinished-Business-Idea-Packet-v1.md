# Unfinished Business — Idea Packet

> **Superseded historical record.** This approved discovery packet is retained for provenance and decision history. Current product positioning is in [PRODUCT_BRIEF.md](../PRODUCT_BRIEF.md); current decisions are in [DECISIONS.md](../DECISIONS.md). Event, eligibility, and partner statements below were accurate for discovery and are not current submission claims.

**PROMPT 0 → PROMPT 1 IDEA PACKET**

Version: 1.1 (existing filename retained)
Status: APPROVED PRODUCT; technical feasibility and category qualification remain conditional
Approval date: 31 October 2026, IST
Amended: 31 October 2026, IST, by direct user instruction
Working name: Unfinished Business
Tagline: Bring your ideas to life.

## A. Control and authoritative sources

This packet records the approved product proposal and accepted uncertainties. The user selected local browser delivery, requested at least two partner-category opportunities, explicitly added Entire to the Backboard and Sentry targets, and then approved the proposal. Approval covers product discovery and this handoff. It does not activate engineering planning, implementation, installation, Git actions, spending, account setup, publishing, or submission.

The approved workflow has four stages: Prompt 0 defines the product; Prompt 1 plans it; Prompt 2 builds and verifies it; Prompt 3 independently reviews and prepares the final presentation/submission package. The latest four-stage split supersedes older source wording that assigns final article/video/submission production to Prompt 2.

### Applied project amendments

The user confirmed `https://github.com/kernelKain/unfinished-business`, instructed that development stay on the existing branch without creating phase branches, and replaced per-step commits with one verified commit per completed phase before the next phase starts. Build on top of OpenCode's native harness rather than implementing another agent engine. Inside the product, the Architect must present one section, accept questions/revisions, wait for approval of the exact current version, then continue to the next section. These direct amendments preserve the remaining approved product, partner targets and budget; they do not activate implementation or request an immediate planning commit.

The canonical engineering plan is [ENGINEERING_BLUEPRINT.md](ENGINEERING_BLUEPRINT.md). The complete project-specific [Prompt 1 — Architect](../prompts/PROMPT_1_ARCHITECT.md) implements the interactive amendment locally; global source prompts remain unchanged. The user reconfirmed 16 available working hours, requested AI agents perform the work with minimal necessary input, selected the free DeepSeek offering in OpenCode, and reported no challenge entry submitted yet. Runtime access and individual eligibility remain unverified.

The [complete local prompt set](../prompts/README.md) now also contains the full supplied Prompts 0, 2 and 3. Its project context explicitly overrides legacy per-step commit/phase-branch defaults and preserves the four-stage split. These are saved documentation inputs, not an implemented or automatically activated runtime.

Internal prompt sources, read during discovery:

- Prompt 0 — Product Discovery v5.1 (private source `libfile_0b1c03550c948191826464c796bfa36c`; not published).
- Prompt 1 — Engineering Blueprint v5.1 (private source `libfile_ca12d0ec78c88191a760d33d85df1d90`; not published). The user also supplied its instructions directly.
- Prompt 2 — Build & Verify v5.1 (private source `libfile_d7e5bd885adc819180cf5c8ff4e03adb`; not published).
- Prompt 3 — Demo & Submission v1.0 (private source `libfile_78514c906b388191b9660820074e516b`; not published).

These are private source-document references, not public product or submission URLs. Prompt 1 must retain the actual prompt text in its working inputs and plan a distributable, versioned prompt set with appropriate rights and attribution. Do not substitute prompt titles or short summaries for the supplied procedures. Adapt presentation and context delivery without silently weakening their behavior. Do not include private Library links in public launch materials.

Official event sources checked during discovery on 31 October 2026:

- Challenge: https://dev.to/challenges/hacktoberfest-week4-2026-10-26
- Specific rules: https://dev.to/page/hacktoberfest-week4-2026-10-26-contest-rules
- General rules: https://dev.to/page/official-hackathon-rules

Source labels: VERIFIED means directly supported by an inspected source; SUPPORTED means relevant but limited evidence; ASSUMPTION means unvalidated judgment; UNKNOWN means missing evidence. Documented capabilities do not establish working account access or runtime behavior.

## B. Product, problem, and differentiation

### Explanation and name

**One sentence:** A local development companion where four friendly spirits guide a builder from a vague or unfinished idea to an approved plan, a working verified project, and an evidence-backed submission package.

**Linear explanation:** Describe an idea → answer focused questions → approve the product → review and approve a plan and relevant capabilities → permit a bounded build action → inspect its real result and checks → resume safely if interrupted → prepare the final demo and submission materials.

Unfinished Business is an approved working title. Name-check status: UNCHECKED. No collision search, domain availability, trademark clearance, or universal availability is claimed. Final naming is deferred; this working title may be used for planning. A material rename must preserve product identity and update affected records.

### User and need

Primary user: a first-time hackathon builder or developer using AI who struggles with what to ask, which tool capability to choose, how to carry decisions between sessions, and how to know when the result is actually ready.

Trigger: the user has a vague idea or a stalled attempt and wants a manageable next action. The first version accepts a description or short pasted context; it does not promise deep recovery of arbitrary existing repositories.

Current behavior: repeatedly improvise prompts in a coding assistant, copy context between chats, select unfamiliar skills or integrations, and manually track approvals, failures, and submission requirements. An ordinary model conversation or a saved prompt collection remains a legitimate alternative.

Root problem: coordinating intent, decisions, capabilities, execution, and evidence across the whole build. The user needs understandable choices and continuity as well as code generation.

Concrete example: a student describes a campus lost-and-found app that they never finished. The companion clarifies one useful journey, recommends a manageable scope, explains a proposed plan, asks for approval, guides a real bounded implementation, and records what verification observed. On return, the student sees where work stopped and which approvals still apply.

Outcome: a small actual project, recoverable project context, understandable decisions, and reusable final materials with honest readiness labels. Completion and successful publication/submission remain separate facts.

### Product mechanism and meaningful AI role

1. Turn natural language into focused questions, options, and concrete examples using Prompt 0.
2. Carry approved product decisions into Prompt 1 and develop the plan one section at a time. Present the current proposal, risks and recommendations; accept revisions and obtain approval of its exact current version before presenting the next section. Persist section progress and reopen only affected approvals after changes.
3. Use Prompt 2 to guide or execute the approved unit through OpenCode's native harness; reuse its model access, sessions, tools, permissions, execution and interruption rather than building a replacement engine. Show actual activity, results, failures and verification.
4. Preserve decisions, approval scope, progress, and evidence so interruption does not erase the current state.
5. When a requirement changes, identify affected plans and checks while preserving unaffected decisions; distinguish model-suggested impact from verified affected work.
6. Use Prompt 3 for independent final review and complete submission drafts. External publication or submission still requires scoped authorization.

AI helps clarify intent, propose options, explain tradeoffs, generate plans, perform permitted coding work, interpret failures, and draft final materials. The product manages the workflow, records approval and status, and associates evidence with the work it actually describes. Detailed control and enforcement design belongs to Prompt 1.

The four spirits are stage roles in one guided workflow, not a commitment to simultaneous multi-agent execution:

| Spirit | Stage | User value |
|---|---|---|
| The Oracle | Prompt 0 | Choose a useful idea and manageable product promise |
| The Architect | Prompt 1 | Review, revise and approve one plan section at a time, including risks and capabilities |
| The Maker | Prompt 2 | Perform approved work and inspect actual results |
| The Witness | Prompt 3 | Review readiness and prepare an honest final package |

### Non-wrapper case and alternatives

The meaningful product mechanisms are approval-scoped workflow progression; persistent, versioned project decisions and handoffs; affected-decision/evidence warnings after changes; task-based capability recommendations with availability and permission status; and verification-linked completion.

A plain model chat can emulate portions manually. The proposed advantage is reducing that coordination burden through a coherent interface and explicit records. A database, ghost mascot, or long prompt set alone does not prove differentiation.

Inspected alternatives:

- OpenCode already supplies an open-source coding agent and terminal, desktop, and web experiences: https://opencode.ai/v2/docs/
- BMAD already offers structured AI development, explicit decisions, persistent context, and guided delivery: https://github.com/bmad-code-org/BMAD-METHOD

Do not claim staged AI development is new or that no competitors exist. Our proposed narrower advantage is an approachable hackathon journey combining prompting assistance, visible approvals, project memory, real execution, and submission evidence. Existing agents are stronger general-purpose foundations; experienced users may prefer using them directly. No comparative performance or usability improvement has been measured.

## C. Event, eligibility, categories, and proof

Event: Hacktoberfest Open-Source AI Challenge: Week 4. Theme: Ghost in the Machine.

VERIFIED official build/entry window: 26 October 2026 at 9:00 AM PDT through 31 October 2026 at 11:59 PM PDT. IST equivalents: 26 October at 9:30 PM through **1 November 2026 at 12:29 PM IST**. Use the organizer's original timezone when checking the cutoff.

The user's capacity is a maximum of 16 working hours through final submission; do not confuse it with elapsed time until the official deadline. Prompt 1 must reconcile actual remaining working availability with that deadline.

Verified rules relevant to selection:

- A new project must be built within the entry window using open-weight models and/or open-source AI centrally, and respond to the theme.
- The submission is a published DEV post using the supplied template and tags devchallenge and hf26challenge.
- Include a demo, through a deployed link or video walkthrough; a code-repository link; and an explanation of the open-source AI used, its central role, and why openness matters.
- Identify each entered partner category and demonstrate meaningful use of its technology.
- One entry per participant; only the first entry is considered if more than one is submitted. The user reports no entry submitted as of the latest planning intake; check again before final publication to avoid duplicates.
- Each participant may win no more than one prize, even if the project qualifies for multiple categories.
- AI assistance is allowed. Reuse must be sufficiently original and respect rights; repositories must start in the challenge window. Post-deadline commits must be noted in the README.
- Eligibility includes the applicable 18+/age-of-majority requirement, a DEV account in good standing, and other general-rule conditions. India is not in the listed excluded jurisdictions. Individual eligibility remains unconfirmed.
- Writing quality has the greatest stated weight. Theme relevance, creativity, technical execution, and partner use also matter. Numerical weights are UNKNOWN. Positive reactions are the stated tie-breaker in the specific rules.
- Prizes: one overall winner at $250 plus DEV++ and badge, six featured-category winners at $200 each, fourteen partner-category winners at $100 each. Awards or probabilities are not promised.

### Theme and open-source thesis

Proposed theme interpretation: unfinished projects haunt a builder's machine. Friendly spirits help bring an idea to life while preserving the past decisions that shaped it. Changed requirements leave visible ghosts of affected plans; the finished project must show proof of life through observed behavior.

This theme is part of the interaction and project continuity, not only decoration. The proposal supports fresh starts and stalled ideas, while the submitted harness itself must be new eligible work. This interpretation is a product judgment, not organizer endorsement.

Proposed openness benefit: build on an inspectable open-source coding harness and editable workflow prompts; preserve usable project records locally; let users use supported model access without making this app's vendor the required inference provider. Provider portability, offline inference, and complete local privacy must not be claimed beyond implemented proof. Hosted inference transmits selected context externally.

### Qualification map

| Exact target | Requirement → proposed capability → planned observable proof | Fit and condition |
|---|---|---|
| Overall competition | Central open-source AI and theme → open-source coding-agent-backed haunted workflow → real execution, theme interaction, repository, demo, and explanation of openness | CONDITIONAL FIT pending implementation and all entry requirements |
| Best Use of Backboard | Official category permits building with R-CLI → use R-CLI to implement and investigate a substantive harness feature → session, actual changes, checks, and explanation in the article | CONDITIONAL FIT; access, usable inference, credit applicability, and useful contribution unproven |
| Best Use of Sentry Agent Tracing | Show agent operation, performance, findings, and debugging → trace the harness's actual agent workflow and investigate a slow or failed operation → received traces/screenshots, observed findings, and verified improvement | CONDITIONAL FIT; integration, available fields, and useful investigation unproven |
| Best Use of Entire | Share agent sessions or search past work to explain why code exists → record build sessions and use history to explain a real implementation decision → sanitized accessible session/checkpoint references in the write-up | CONDITIONAL FIT; supported agent capture, account access, sharing, and successful evidence unproven |

All three partner targets are SELECTED. The original requirement was at least two meaningful partner opportunities; adding Entire expands the target set, and dropping a selected target requires an explicit amendment. Do not silently call failed setup meaningful use. Backboard and Entire are build-process contributions; Sentry is a runtime-observability contribution. They need not become mandatory end-user accounts.

Record actual model/tool usage separately. OpenCode usage alone establishes none of the partner claims. Gemma, Render, and other categories are not selected merely because models, credits, or an optional sample site might be available.

## D. Builder, capacity, and resources

- Solo builder with backend, systems, pipelines, and API interests. The user requests AI agents perform the work and involve them only for minimal necessary product/access/publication decisions. Basic React/Vite experience; a polished interface and interview value matter. Do not infer understanding from generated code.
- Java, Go, and Python have equal preference under the active prompts. Prompt 1 chooses the language fairly against product needs, ecosystem, complexity, familiarity, and delivery. No backend stack is selected here.
- Maximum 16 working hours through final submission. It must accommodate engineering planning, setup, risky proofs, implementation, understanding/review, integration, checks, fixes, article, demo/video, submission, and contingency. Discovery is separate unless the user includes it; do not infer more build hours from AI assistance.
- Cash cap: $0 new out-of-pocket spending. Previously reported service credits may be considered, subject to their actual access, balances, restrictions, and bounded allocations. Do not combine balances into a cash budget or allow paid overage.
- Relevant reported resources include Render $50, LangSmith $100, Tinker $10, Docker Agentic Platform Compute $250, Paper Instruments $5, other previously reported credits, and existing coding-tool subscriptions/access. These are USER-REPORTED, not verified available runtime funding. Backboard promotional access/balance for this project is UNCONFIRMED. None must be consumed to justify features.
- Prefer at most two essential external product APIs unless a specific need is justified. Development recording/review and telemetry still have privacy, account, quota, and cost effects even when treated separately from product APIs.
- Target: local browser companion on OpenCode's native harness. Confirmed remote: `https://github.com/kernelKain/unfinished-business`; inspected local checkout (path omitted from this public record), branch `main`, Linux. Linux-first release is the engineering proposal; native engine/version/model/permission compatibility and effective Git/network access still require early proof. See the blueprint for starting-state evidence.
- Intended inference: DeepSeek's free offering available through OpenCode, selected by the user. Use OpenCode's supported route, not direct access to a restricted free inference endpoint. Exact runtime access, limits and availability remain unproven; no paid fallback is approved.
- User-specific Codex/Cursor switching rules for this project are not yet supplied. Do not force switches or infer unavailable subscriptions, API balances, or subscription-to-API entitlement.
- Do not request secret values in chat. Supported authentication is a later setup action when needed, not a discovery requirement.

## E. Scope, adoption, and limits

### Essential product scope

1. A coherent local browser experience supporting one project at a time.
2. The four guided stages based on the complete supplied prompt procedures. The Architect presents one section per response, accepts changes, waits for exact-version approval, and compiles the currently approved sections before Maker readiness. Questions or `next` do not grant approval.
3. One supported real coding-agent execution path built on OpenCode's native harness. Reuse its sessions, model access, tools, permissions and execution; exact interface/runtime compatibility remains subject to engineering proof.
4. Explicit product/plan approvals and bounded execution permission; records must not silently expand authority.
5. Persistent decisions, approvals, current work, failures, evidence, and exact next action; useful pause/resume behavior.
6. Warnings for decisions and verification affected by a changed requirement, preserving unaffected approvals.
7. A small curated capability set with explanations and availability/approval status; at least one genuine recommendation and working capability path.
8. Real implementation and verification of a modest demonstration project; completion tied to observed evidence.
9. Independent final review and a complete usable submission draft, with publication kept separate.
10. Selected Backboard, Sentry, and Entire contributions and required evidence for the harness's own entry.
11. A polished representative journey, actual demo recording/video, article, and submission within the user's overall capacity.

Stage coverage must remain meaningful. Do not replace build execution with a fake transcript or replace verification with an unchecked model statement. Do not silently reduce the product to prompt export if execution fails; that changes the core promise and needs an amendment.

### Optional scope, in priority order

- Additional capability explanations or richer stage refinements after the main path works.
- Additional restrained ambient motion or optional sound, after readable interactions and recovery work.
- A hosted, clearly labeled sample walkthrough for judges after local execution and required submission assets are ready.

Cut optional hosting, ambient sound/effects, and extra capability breadth before weakening the essential journey. Exact effort allocation and scope-cut order belong to Prompt 1.

### Exclusions from this release

Universal agent/provider compatibility; multiple independent agent integrations; arbitrary skill/hook/MCP installation or marketplace; deep recovery of arbitrary old repositories; multi-user collaboration; separate polished CLI; hosted remote code execution; automatic deployment, article publication, social posting, or final submission; model training; elaborate custom 3D environments.

### Adoption and fallback

First useful result: the user describes an idea and receives one clear decision or next action with a reason. Full value requires supported local setup and model access; first-use effort has not been measured.

Reasons to decline or stop: installation friction, lack of suitable model access, confusing permissions, too much ceremony, unreliable execution, or preference for a familiar coding agent. Useful repeat use is plausible across builds and interrupted sessions; one completed hackathon journey is also a valid valuable use. Willingness to pay, retention, and demand are unproven.

Initial reach hypothesis: beginner hackathon participants and AI-assisted builders through an honest DEV walkthrough and reproducible example. No subscription, monetization, or product-market-fit claim is approved.

If an optional effect or sample walkthrough fails, preserve the usable local workflow and required real demo. If a model/agent integration, approval boundary, or selected partner path fails, stop dependent investment and propose a focused decision; do not hide the failure with simulated core behavior. Alternate supported model access must respect the $0 cash cap and be verified before adoption.

## F. Demo and experience

### Hook and story

Ten-second Hook: an unfinished idea enters a haunted workshop; a friendly spirit turns it into a clear next action with remembered decisions and an approval control. Do not imply that a complete application is generated within ten seconds.

Short demo story, approximately 60 seconds where practical: introduce a stalled campus lost-and-found idea; show the Oracle clarifying its useful outcome; approve a focused plan; let the Maker perform an actual bounded change; show the result and a real check; change a requirement and show affected evidence; return to the Witness's readiness summary. Edit or shorten the story honestly, disclosing prerecorded work or shortened waits. The final video length is deferred to Prompt 3 and actual event constraints.

Proof must include real execution, useful output, the approved scope boundary, meaningful stage continuity, and an actual verification result. Partner evidence can be shown briefly in the demo and explained in the article. A mascot, progress animation, or root-page response alone is insufficient.

### Interface character and activity

Character: friendly haunted workshop; readable contemporary product interface; restrained darkness, warm light, an illustrated setting, expressive spirits, and purposeful transitions. Ordinary labels remain visible: Approve idea, Review plan, Build next part, Inspect results.

Main activities: describe/clarify the project; inspect and approve a decision or plan; follow a build and respond to a permission request; inspect changes/results/checks; resume work; review final readiness and drafts. Prompt 1 decides screen inventory, layout, typography, colors, tokens, and components. Avoid unnecessary landing pages, login, settings, or extra screens.

Approved animation intentions:

| Actual event | Visual response | User purpose |
|---|---|---|
| A stage activates | Its spirit wakes and workshop light changes | Orient the user |
| Recommendation is ready | A compact spell unfolds into readable explanation | Introduce the decision |
| User approves | A seal settles around the approved decision | Make scope approval visible |
| Agent emits actual activity | Maker reacts and the activity view updates | Communicate real progress without fabricated percentages |
| Requirement changes | Affected artifacts show a ghost outline and clear label | Identify reconsideration needs |
| Verification passes | Proof-of-life indicator lights up | Celebrate observed evidence |

Ambient floating, glow, and dust are restrained optional polish. Respect reduced motion. Sound is optional and initially off. Exclude forced intros, jump scares, animations over text, and effects that delay work. Full custom 3D is outside first-release scope.

Selected inspiration and limits:

- https://hauntedhouse.webflow.io/ — visually inspected; atmospheric illuminated setting and a place that feels alive. Borrow the concept of a lightweight workshop illustration; do not copy its assets or recreate its elaborate 3D scope. Listing: https://www.awwwards.com/sites/haunted-house
- https://godly.design/ — inspected gallery for contemporary interface presentation and hierarchy. Use a small relevant reference set; no specific uninspected design or paid asset is adopted.
- https://motion.dev/ — inspected demonstrations of smooth layout changes, springs, entrances, and exits. Its free/open-source library is a candidate; paid Motion+ examples/tools are not assumed available. Dependency choice remains with Prompt 1.

Prompt 1 obligations: a concrete design brief using real copy/results; primary action and hierarchy; suitable states; selected references and useful qualities; typography/color/spacing/components; accessibility/responsiveness/reduced motion; recovery and exclusions; realistic fixtures matching the intended live behavior. Validate core access before dependent polish and plan a thin real journey early.

Prompt 2 obligations: render a representative screen with short/typical/long content; compare it with the brief; connect real behavior; inspect normal/edge/failure states, narrow/wide layouts, keyboard/focus/labels/contrast, overflow, and recovery; fix the largest observed issues. A screenshot or successful build alone is insufficient.

Useful review references, subject to compatibility/license review and actual selection:

- Design: https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md
- Interface review: https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md
- Browser checks: https://github.com/anthropics/skills/blob/main/skills/webapp-testing/SKILL.md

Judge access: code repository, clear local-start guide, and a video of actual execution. Official rules accept a deployed link or video. Hosting the executable harness is not required by this plan. Any hosted sample must identify sample/fixture behavior and cannot establish remote agent execution or a Render category claim.

## G. Learning and interview value

Learning targets: workflow state and permitted transitions; approval scope and invalidation; persistent decision/evidence history; linking results to the tested work; interruption and uncertain-operation recovery; bounded agent execution; and separation of local operation from external model/tracing services.

For a core feature, trace actual user input through decision generation, approval, permitted action, result, and verification. Explain one tradeoff, inspect one failure, and modify a small behavior with appropriate checks. For the frontend, explain component state, events, request/response flow, and which actual events drive animation.

Familiarity with these concepts is UNCONFIRMED. Separate what the user can explain and modify, what was mainly implemented through AI, and what remains unfamiliar. Generated code, a polished explanation, or a long technology list does not establish mastery. Preserve truthful AI contribution and reuse facts for interviews and the article.

## H. Tools, selection, and access

| Tool | Purpose/benefit | Decision/status | Prompt 1 validation and useful evidence |
|---|---|---|---|
| OpenCode | Native open-source harness underlying the local companion | SELECTED FOUNDATION by user instruction; exact runtime/interface route provisional | Reuse sessions, model access, tools and permissions; verify compatibility, free DeepSeek, interruption and a real bounded action; no duplicate engine |
| Backboard R-CLI | Build and investigate a substantive harness feature for partner evidence | SELECTED build-process contribution | Access, credit/model limits, integration with the development workflow, useful session/diff/check evidence |
| Sentry Agent Tracing | Observe real agent activity and investigate a failure/delay | SELECTED runtime observability | Free-plan access/quotas, supported/manual instrumentation route, actual received data, useful investigation, and privacy controls |
| Entire | Preserve build sessions and explain a real implementation decision | SELECTED build-process recording | Supported agents, account/setup path, capture and sharing controls, actual session/checkpoint evidence before work starts |
| Motion | Candidate for purposeful interaction animation | DEFERRED dependency choice; visual qualities approved | Free-library license, compatibility, performance, reduced motion; no paid kit assumption |
| Render | Optional sample hosting, if genuinely useful after essentials | DEFERRED; not needed for executable local harness | Actual need, remaining time, credit access/cost, and clear sample labeling; no automatic partner target |

No additional mandatory tool bundle is adopted. CodeRabbit, CI, DevRelay, Supabase, and other catalogs are not silently required. Prefer sufficient available tools over duplicate integrations. Exact curated skills, hooks, and MCP implementations are DEFERRED to Prompt 1; user-facing capability explanations and approval remain part of the product.

Official/reference checks:

- OpenCode is documented as open source and supports custom applications/experiences: https://opencode.ai/v2/docs/ and https://opencode.ai/v2/docs/build/
- OpenCode model documentation says free chat models require OpenCode and offerings are time-limited: https://opencode.ai/v2/docs/console/models/. This does not prove free access from every custom client. The exact chosen flow must be verified without bypassing provider restrictions.
- Backboard advertises an open-source R-CLI and other capabilities: https://backboard.io/hackathon. Do not infer that listing proves this account's balance or working authentication.
- Sentry documents workflow/tool/model/custom-logic tracing and manual instrumentation options: https://docs.sentry.io/product/agents/getting-started/. The inspected pricing matrix includes agent tracing on the free Developer plan: https://sentry.io/pricing/. Account availability and quotas still need validation.
- Entire documents local capture and session history: https://docs.entire.com/ and https://github.com/entireio/cli. Inspect actual supported agents and account access before relying on it.

Selection is not installation or external-action permission. No installs, live requests, account configuration, or runtime proofs were performed during discovery.

## I. Evidence, risks, and engineering questions

### Evidence and assumptions

VERIFIED: the inspected official event requirements; advertised high-level OpenCode custom-app support; OpenCode's documented restrictions on free models; Backboard's advertised R-CLI; Sentry's documented agent tracing and free-plan listing; and Entire's documented session-history purpose.

SUPPORTED: these foundations provide plausible routes for the proposed experience. They do not establish that the selected combination works or fits 16 hours.

ASSUMPTIONS: a guided interface reduces coordination burden; the Halloween interactions help users understand progress; beginners value approval and project continuity; and the narrowed scope can fit the supplied time after early validation. No user interviews, adoption metrics, speedups, or competitive advantages have been measured.

USER-CONFIRMED: remote repository, 16 available working hours at planning intake, intended free DeepSeek through OpenCode, AI-led work with minimal necessary input, and no entry submitted yet. Repository path/branch/Linux were inspected. UNKNOWN: actual agent/model access, supported-client free-model behavior, native version compatibility, account quotas/balances, recorded fields, effective Git/network mutation capability, individual contest eligibility and time already consumed after intake.

### Weaknesses and failure conditions

Two largest weaknesses: (1) a crowded category with mature coding assistants and structured workflows; (2) execution integration plus four-stage UX and partner proof may exceed available capacity. The highest-impact weak assumption is that the product can deliver reliable, understandable real execution with approval enforcement through the chosen engine quickly enough to preserve final submission time.

Users may stop because setup is difficult, supported model access is unavailable, the workflow is slower or more ceremonial than direct agent use, or displayed status is unreliable. Do not market it as universally no-code, offline, private, or autonomous.

Mitigations: one project, one engine, small capability set, evidence-based status, early access/control validation, thin real journey before extensive effects, focused representative-screen review, and protected final-stage capacity. Optional hosted samples and ambient polish are cut first.

Reconsider if core execution requires bypassing access rules; approval denial cannot prevent covered actions; interruption leads to unsafe duplicate work; no no-cash inference path exists; selected partner evidence is infeasible; or essential work cannot fit after reserving submission effort. Bring an explicit focused amendment rather than disguising a reduced promise.

### PROMPT 1 MUST VALIDATE — priority order

1. Reconcile the user-confirmed 16-hour capacity and official deadline with time actually consumed; use the confirmed repo and inspected Linux/main starting state. Verify individual eligibility and recheck entry state before publication. Keep dependent uncertainty explicit without re-asking settled repository/capacity inputs.
2. A supported OpenCode/custom-experience route for real bounded execution, usable inference under the $0 cash constraint, and legitimate credential/login behavior. Distinguish model-provider keys from agent subscriptions and never request secret values in chat.
3. An enforceable approval/authority model using native OpenCode permissions across changes, commands, effects and denial. Architect section progression must require exact-current-version approval; revisions/invalidation/resume cannot auto-approve or skip sections. Preserve four-stage behavior without merely concatenating all prompts or replacing their procedures with summaries.
4. Reliable persistent project records, approval scope/version, pause/resume, uncertain-operation handling, and affected-check warnings; define how to avoid marking stale evidence current.
5. Backboard R-CLI access and substantive build contribution; Entire supported capture/account/sharing; Sentry actual tracing/fields/free quota. Give each a bounded future proof and an amendment path before dependent investment.
6. A realistic essential-scope plan including UI, content, checks, learning, fixes, all selected evidence, article, actual demo video, final review, and submission within 16 hours. Do not treat all hours as coding time.
7. Local file/workspace and credential boundaries, provider-bound data, logging/redaction, optional telemetry, recordings, and sanitized public evidence. Local execution does not imply no network transmission.
8. A limited curated capability catalog and at least one usable permission-aware path, with honest unavailable/setup states. Do not install arbitrary skills/hooks/MCPs to satisfy breadth.
9. Representative UI/live contracts, readable motion states, accessibility, failure recovery, and performance. Validate real behavior before expanding polish.
10. Source prompt redistribution rights, dependency/asset licenses and attribution; accurate documentation and a reproducible judge-access path. Preserve AI/reuse disclosures.

Prompt 1 plans these proofs and their bounds; Prompt 2 executes them. Neither documented support nor this product approval is a passing runtime proof. Known essential blockers must be resolved or explicitly amended before dependent execution.

## J. Decisions, history, and stage boundary

| ID | Decision | Status | Reason/uncertainty |
|---|---|---|---|
| D01 | Build a hackathon-development companion using Prompts 0–3 internally | APPROVED | Direct user request; exact prompt adaptation needs validation |
| D02 | Halloween development harness with four stage spirits, project memory, affected-decision ghosts, and proof of life | APPROVED | Theme is reflected in behavior; no organizer endorsement claimed |
| D03 | Local browser companion | APPROVED, explicit user selection | Hosted inference/tracing remain external; Linux inspected, Linux-first support proposed |
| D04 | One project on OpenCode's native harness, small capability set, complete demonstrated journey | APPROVED scope and foundation amendment | Native interface/access/control feasibility conditional on engineering checks |
| D05 | Target Best Use of Backboard and Best Use of Sentry Agent Tracing | APPROVED targets | Actual contribution/access/evidence still required |
| D06 | Add Best Use of Entire | APPROVED amendment | Preserve earlier targets; capture before relevant build work |
| D07 | Maximum 16 working hours through final submission, no new cash spending | APPROVED constraints | Actual remaining hours/credit allocations not measured |
| D08 | Unfinished Business / Bring your ideas to life | APPROVED working identity | Name remains UNCHECKED; final naming deferred |
| D09 | Light illustrated workshop and purposeful real-event-driven animation | APPROVED direction | Detailed design and dependency choices deferred |
| D10 | Hosted executable harness, universal integrations, arbitrary marketplace, deep repo revival, and elaborate 3D | EXCLUDED from release | Protect core delivery and required final materials |
| D11 | Optional clearly labeled hosted sample walkthrough | DEFERRED | Only after essential local journey and submission assets |
| D12 | Remote `https://github.com/kernelKain/unfinished-business` | CONFIRMED by user | Inspected origin uses equivalent SSH URL |
| D13 | Existing branch only; one commit per verified phase before the next phase | APPROVED direct amendment | Supersedes earlier phase branches/per-step commits; no immediate planning commit |
| D14 | Interactive Architect: one section, revisions, exact-version approval, then next | APPROVED direct amendment | Persist progress; reopen affected sections; compile only current approved blocks |
| D15 | Free DeepSeek via OpenCode; AI agents do the work with minimal necessary input | USER-INSTRUCTED | Account/runtime access still needs proof; no paid inference fallback |

No unrelated idea shortlist was requested. Discovery refined the user's existing concept. Deep repository resurrection was narrowed to starting from a description/pasted context; a generic prompt library was rejected as an insufficient product promise. No prior winner study, demand interview, naming search, or runtime experiment was performed.

This packet approves the product and stated uncertainties, not unbuilt functionality or execution. Prompt 1 owns engineering planning; Prompt 2 owns implementation and development verification under active authority; Prompt 3 owns independent final review, article/video/social/interview materials, packaging, and authorized submission confirmation. Keep those final-stage tasks in the overall capacity plan.

Do not import another project's stack, keys, paths, authority, credits cap, or tool-switch plan. The latest project Git policy is binding: remain on existing `main`, create no phase branches, finish and verify a phase, then commit that phase before the next implementation phase. Internal steps are not separate commits; subjects describe the change without phase/step numbering. This supersedes the former per-step/phase-branch defaults. Actual Git capability and active execution authority still need reconciliation; product approval alone does not activate implementation or bypass access controls.

**Next stage:** Prompt 1 may use this packet when the user instructs it to begin. Start with material planning intake and read-only validation. Do not start Prompt 1 or implementation automatically after delivering this packet.

**END IDEA PACKET**
