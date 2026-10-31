# Unfinished Business — Engineering Blueprint

> Historical execution record. The current integration contract is [OPENCODE_INTEGRATION.md](OPENCODE_INTEGRATION.md); current decisions are in [DECISIONS.md](DECISIONS.md). Fixed-model statements below describe the phases in which they were written and are preserved as history, not as current instructions.

Version: 0.2.7  
Updated: 31 October 2026, IST  
Status: EXPERIENCE_VERIFIED_UNCOMMITTED; partner access remains blocked  
Canonical path: `docs/ENGINEERING_BLUEPRINT.md`  
Stage: Prompt 2 — Experience phase gate; Verification has not started

## 1. Control, scope, and acceptance

### Authoritative inputs and amendments

The [idea packet](Unfinished-Business-Idea-Packet-v1.md), revision 1.1 in its existing filename, preserves the approved product. The complete [project Prompt 1](prompts/PROMPT_1_ARCHITECT.md) adapts the supplied v5.1 procedure for interactive section review. The user's global prompt has not been changed.

All four complete local procedures are saved in the [prompt set](prompts/README.md). Prompts 0, 2 and 3 preserve the supplied source text; Prompt 1 is the complete project edition. Their source provenance remains recorded below; redistribution rights and runtime loading still require the planned checks:

| Local procedure | Source provenance |
|---|---|
| [Prompt 0 v5.1](prompts/Prompt-0-Product-Discovery-v5.1.md) | `libfile_0b1c03550c948191826464c796bfa36c` |
| [Project Prompt 1 5.2-project.1](prompts/PROMPT_1_ARCHITECT.md) | Adapted from v5.1, `libfile_ca12d0ec78c88191a760d33d85df1d90` |
| [Prompt 2 v5.1](prompts/Prompt-2-Build-and-Verify-v5.1.md) | `libfile_d7e5bd885adc819180cf5c8ff4e03adb` |
| [Prompt 3 v1.0](prompts/Prompt-3-Demo-and-Submission-v1.0.md) | `libfile_78514c906b388191b9660820074e516b` |

These are private working references, not public product URLs. Do not replace the actual procedures with titles/summaries or expose private source references in launch materials. Prompt 0 owns product discovery; Prompt 1 plans; Prompt 2 builds/verifies; Prompt 3 independently reviews and prepares article/video/social/interview/submission materials.

The prompt-set README supplies explicit project context above conflicting legacy defaults, including Prompt 2's original per-step commits/phase branches and older delivery wording. Source copies remain unchanged; loaders must include that context alongside the full active prompt. Saving the bundle does not activate a stage or prove a runtime loader exists.

| Amendment | Direct user instruction | Applied effect |
|---|---|---|
| AM-01 | Remote is `https://github.com/kernelKain/unfinished-business` | Confirmed repository identity; SSH origin is equivalent |
| AM-02 | No branch creation; commit each completed phase before the next | Existing `main` throughout; one phase commit, no per-step commits |
| AM-03 | Build on top of OpenCode's harness to simplify delivery | Native execution, tools, permissions, sessions and model access are reused |
| AM-04 | In-product Prompt 1 gives one section, accepts changes and waits for approval | Exact-version section gates replace consolidated-plan review |
| AM-05 | 16 working hours; AI agents do the work with minimal user input; free DeepSeek; nothing submitted yet | Recorded constraints and user-reported access/submission state |

AM-01–04 are applied as instructed, without asking for the same permission again. Other engineering choices remain proposals. This document supersedes chat-only blueprint 0.1; its proposed phase branches, per-step auto-commits and single overall Architect review no longer apply. No unapproved autonomy or spending proposal becomes authorization through this update.

### Inspected starting state

- Local root: `/home/kernel-kain/Documents/Github/unfinished-business`; branch `main`; HEAD `f4276a3` (`Initial commit`).
- Origin: `git@github.com:kernelKain/unfinished-business.git`.
- Before the documentation update: README, MIT license, untracked `docs/` containing the idea packet; no application/dependency manifests.
- Linux; OpenCode and Entire binaries present. Installed OpenCode SDK package metadata reports 1.18.26, which does not establish the executable's version or actual access.
- No applicable AGENTS.md found in inspected ancestors or `docs/`.
- Declared permissions mark `.git` read-only. Git writes must be available in an authorized environment before a phase commit; do not bypass this restriction.
- Shell outbound DNS failed during research; browser research succeeded. Native runtime/inference access remains unproven.
- No installation, engine run, test/build, account configuration, branch creation, commit, push, deployment or submission has been completed by planning.

Evidence labels: VERIFIED = inspected fact; SUPPORTED = relevant documented support with limits; ASSUMPTION = design judgment; UNKNOWN = missing evidence. Runtime check status is separate.

### Preserved product and release scope

**Unfinished Business — Bring your ideas to life.** A local browser companion on OpenCode: Oracle clarifies an unfinished idea; Architect develops an approved plan one section at a time; Maker performs permitted real work; Witness reviews evidence and prepares complete usable drafts.

Journey: describe idea → clarify/approve product → review/revise/approve plan sections → grant bounded execution scope → observe native activity → inspect real changes/checks → resume or change a requirement → review readiness/drafts. The four spirits are sequential roles, not a requirement for simultaneous agents.

MUST: one active project; full supplied prompt procedures; native OpenCode execution using the selected free DeepSeek; explicit approvals/work scope; persistent decisions/section versions/native session references/evidence/next action; affected-work warnings; small native capability catalog with one genuine recommendation and working path; real demonstrated project/check; fresh Witness review and complete drafts; Backboard/Sentry/Entire proof; polished main journey; actual article/video/submission work within capacity.

SHOULD: richer capability explanations and restrained ambient effects. LATER/excluded: hosted executable harness, multiple engines, arbitrary skill/MCP installation, deep arbitrary-repository recovery, collaboration, polished separate CLI, automatic deployment/publication/submission, model training and elaborate 3D.

Cut optional hosting, sound, ambient effects, then capability breadth. Essential execution, approvals, four-stage continuity or selected partner targets need an explicit amendment if infeasible.

### Acceptance criteria

| ID | Condition | Observable result |
|---|---|---|
| AC-01 | New unfamiliar idea | Relevant Oracle clarification/proposal without self-approval |
| AC-02 | Architect draft/revision/approval/resume | One active section; exact current-version/hash approval; next section withheld until approval; progress persists |
| AC-03 | Approved Maker unit | Actual native OpenCode change; denied actions do not execute |
| AC-04 | Restart/disconnection | Metadata/native references recover; uncertain execution reconciled before retry |
| AC-05 | Requirement/approved section changes | Only affected downstream approvals/checks become stale; Maker gated if required plan sections are stale |
| AC-06 | Capability recommendation | Purpose, native tool mapping, availability, permission and observed result; at least one path works |
| AC-07 | Verification | Actual native command/result/output reference/tested fingerprint; model assertion cannot create PASS |
| AC-08 | Witness review | Fresh context distinguishes pass/fail/missing/stale and produces complete usable drafts |
| AC-09 | Browser journey | Usable narrow/wide layout, keyboard/focus, readable content, reduced motion, overflow/recovery |
| AC-10 | Selected partner work | Substantive R-CLI contribution, received Sentry agent trace/investigation, explanatory Entire history |
| AC-11 | Fresh setup/privacy inspection | Reproducible local startup, clear access state, no credentials/private records in public assets |
| AC-12 | Entry preparation | Actual video/article/code access/disclosures/category evidence match tested build; confirmation separate |

## 2. Architecture, stack, and contracts

### OpenCode is the foundation

Build a thin local browser application around an official supported OpenCode client/server route. Do not fork OpenCode, create another inference client, rebuild its tool loop, duplicate its transcript database, or write a general command executor. App approvals constrain workflow; they cannot override a native denial.

| Owner | Responsibilities |
|---|---|
| OpenCode | Provider credentials/model access; agent/tool loop; native tools/skills; tool permissions; execution; interruption; native sessions/transcripts |
| Unfinished Business | Haunted UI; stage prompts; section/artifact approvals; dependency invalidation; app metadata; native result references; sanitized telemetry |

Oracle/Architect/Witness have no mutation tools. Maker uses native tools within approved scope. Witness gets fresh review context on the same selected model; do not claim a separate independent model. Reuse native configuration/capabilities instead of a new marketplace or plugin platform. A capability can be **inspect changes** or **run the approved Node check**, mapped to native tools and permission status.

### Stack proposal and language assessment

Python/FastAPI fits workflow/API work but adds an SDK/type boundary; Go fits process control but adds contract/UI integration; Java fits explicit modeling but adds setup/packaging. TypeScript is recommended for this 16-hour release because it shares native client contracts with the UI. Familiarity remains UNCONFIRMED rather than inferred from AI-generated implementation.

| Layer | Choice/version policy | Tradeoff/proof |
|---|---|---|
| Runtime | Node 22.14+; verify actual version | No system upgrade by default |
| Browser | React 19, TypeScript, Vite; exact compatible patches locked in foundation | Existing basic React/Vite experience; version compatibility check |
| Local API | Hono and Node adapter | Small routing layer, controlled static root |
| Engine boundary | Official SDK matched to selected local server | Inspected package 1.18.26; executable compatibility needs EP-01 |
| Validation | Shared Zod schemas | Invalid model/browser data cannot become authority |
| App persistence | Atomic versioned JSON snapshot, evidence references | One project/writer; no database service or copied native transcripts |
| Motion/icons | Free Motion and Lucide | Purposeful effects; CSS fallback, no paid kit |
| Telemetry | Sentry Node SDK/manual boundary spans | Record actual native workflow; exact instrumentation checked before coding |
| Verification | Node test runner and available browser tools | Product verification uses native OpenCode actions; no replacement runner |

Inspect actual installed licenses and lock compatible exact package versions in foundation. Expected permissive licensing is not a completed audit. Avoid prereleases/unrelated upgrades.

Intended model: free DeepSeek through OpenCode. Research on 31 October listed `opencode/deepseek-v4.1-flash-free`; the offering is time-limited and account/runtime access is unproven. Do not call its restricted free inference endpoint directly from this app or R-CLI.

EP-01 establishes installed server version, matching official client, native events/permissions/session access and the free-model route. V1/V2 APIs differ materially. Implement one verified route, not speculative dual support. If the supported route changes this contract, use a focused amendment. Do not migrate existing user sessions or change global configuration silently.

### Proposed modules and records

| Path | Responsibility |
|---|---|
| `src/web/` | Workshop, active section/revisions, activity/evidence/recovery |
| `src/server/http/` | Validated local routes and browser-session protection |
| `src/server/workflow/` | Stage/section transitions, approvals/dependency invalidation |
| `src/server/opencode/` | Thin native client, role sessions, normalized events/reconciliation |
| `src/server/store/` | Atomic app metadata, not native transcript storage |
| `src/server/evidence/` | Native outcome references/check mapping/fingerprints; no arbitrary executor |
| `src/server/telemetry/` | Optional sanitized spans |
| `src/shared/` | Request/result/state schemas |
| `prompts/`, `tests/`, `docs/` | Complete runtime prompts; meaningful tests; blueprint/setup/evidence |

Private app metadata lives under ignored `.unfinished-business/`, outside static assets. Use one writer/process lock, expected-revision checks, temp write/flush/atomic replacement and a recoverable previous snapshot. Preserve corrupt originals and offer recovery; never silently reset state. Schema versioning is explicit. No destructive reset endpoint is needed.

| Record | Required fields |
|---|---|
| Project | ID/schema/revision/workspace/stage/current section/native sessions/next action |
| PlanSection | Stable ID/order/content/version/hash/dependencies/status/approval reference |
| Approval | Exact artifact/section version/hash, scope/time/revocation/stale reason |
| Artifact | Type/version/hash/dependencies/status and exact approved content |
| Operation | Action ID/payload hash/native session/message IDs/starting fingerprint/status/result |
| Evidence | Check ID/native result reference/tested fingerprint/result/time/limits |
| Capability | Purpose/native mapping/availability/permission/latest observed outcome |

Persist app approvals before acknowledging success. Native session/message/tool IDs link the actual activity; missing native data is a recovery problem, not proof. Runs move QUEUED → RUNNING → WAITING_PERMISSION → SUCCEEDED/FAILED/CANCELLED/UNKNOWN. Disconnect produces UNKNOWN until native state is reconciled. Do not automatically repeat uncertain execution. Cancellation does not undo completed effects.

### Local API contract

Mutations require unique action ID and expected project revision. Same ID/payload returns existing result; different payload conflicts. Proposed input limit 64 KiB. Validate structured model proposals; partial/malformed output cannot replace an approved artifact or execute work.

| Route | Purpose |
|---|---|
| `GET /api/project` | Current snapshot/section/capabilities/next action |
| `POST /api/messages` | Active stage/section message linked to native session |
| `POST /api/sections/:id/revisions` | Revise same section, supersede materially changed approval |
| `POST /api/sections/:id/approve` | Approve exact version/hash; reject stale submissions |
| `POST /api/approvals` | Non-section artifact/work scope |
| `POST /api/runs` | Start identified permitted native unit once |
| `POST /api/permissions/:id` | Resolve current native request within granted scope |
| `POST /api/changes` | Changed requirement and affected dependencies |
| `POST /api/runs/:id/cancel` | Native interruption/reconciliation |
| `GET /api/events` | App sequence/native activity; snapshot resync on gaps |
| `GET /api/export` | Sanitized approved blueprint and complete generated drafts |

Error codes: 400 validation; 409 stale revision/approval or ID conflict; 503 unavailable engine. Include stable code, readable message, retryability and operation ID. App owns a small event sequence; do not assume native replay. After reconnect, read native sessions/messages/permissions before continuing.

## 3. Interactive Architect and experience

### Required section-review behavior

Use eight dependency-ready areas: (1) control/product/scope/acceptance, (2) architecture/contracts, (3) experience, (4) tools/access/cost, (5) verification/risks, (6) phases/queue, (7) delivery, (8) execution directive/readiness. No fixed 14-section ceremony.

1. Resolve only missing decisions for the current section; draft that section alone.
2. Show title/order, version/status, concrete recommendation, reasons/tradeoffs and material missing inputs.
3. Offer **Approve section**, **Request changes**, **Ask a question**. A question or `next` is not approval.
4. On changes, revise the same section, increment its version and explain the difference. Do not advance on an old approval.
5. Persist exact current ID/version/hash approval before exposing the next section. Duplicate approvals apply once; stale approvals conflict.
6. Keep approved sections in a collapsed outline. Resume at the earliest section needing a decision, with its reason.
7. An upstream change reopens that section and marks only actual dependent sections/criteria/evidence stale. Reapprove affected sections individually; preserve unrelated approvals.
8. Compile exact approved blocks only after every required current section is approved and plan readiness is coherent. Compilation adds no unapproved choices. Maker additionally needs separate work permission.

Statuses: NOT_STARTED/DRAFT/APPROVED/STALE. The application enforces state; model prose cannot approve itself or advance stages. Use the complete active prompt plus approved upstream records and concise current state, not all four full prompts every turn or abbreviated replacements.

This behavior is inside the product. The current user explicitly requested direct documentation amendments; these edits do not require eight new chat approvals. The full project prompt is maintained locally, not in the global Library source.

### Design brief

Friendly haunted workshop around a readable working document. Warm light, restrained darkness, original lightweight illustration, expressive stage spirits. No forced intro, login flow, unnecessary landing page, elaborate 3D or copied reference assets.

Layout: workshop/stage strip, central conversation/document, collapsed section outline and activity/evidence panel. At ~390px panels stack; at desktop the reading column stays central. Representative planning header: **Architecture — section 2 of 8**, **Draft v2**, **Approve section**. Returning state explains where work stopped and the exact safe next action.

First-use copy: **What's still haunting your to-do list?** Describe an idea you want to bring to life. **Wake the Oracle**.

Tokens: background `#111018`, surface `#1B1824`, raised `#252031`, text `#F4F0E8`, muted `#B8AFCA`, warm accent `#F4B66C`, spirit accent `#BFA3FF`, success `#8BD5A7`. System sans work text, restrained serif headings, monospace evidence; spacing 4/8/12/16/24/32 px. Rendered contrast must be checked.

| Reference | Useful quality | Boundary |
|---|---|---|
| https://hauntedhouse.webflow.io/ | Illuminated atmosphere/place that feels alive | No copied assets/3D recreation. This turn's scene stayed behind loading; approved discovery records earlier inspection |
| https://godly.design/ | Coherent hierarchy/presentation from discovery | No specific paid/uninspected asset adopted |
| https://motion.dev/docs/react-accessibility | Meaningful transitions/reduced motion | Free library only; disable ambient transforms for reduced motion |

Animate real events: spirit activation, persisted approval seal, native Maker activity, ghost outline for affected artifacts, proof light after observed checks. No fabricated percentages or delayed controls. Sound is deferred/off.

Cover empty/generating/slow/awaiting approval/revision/native permission/malformed response/provider failure/failed check/unknown run/stale approval/success. Give concrete recovery, preserve current section and revision text, and never overwrite approved content with a partial stream. Fixture/live responses share schemas and explicit section versions/status; fixtures cannot establish execution or sponsor proof.

Prompt 2 checks representative short/typical/long content, narrow/wide layouts, keyboard/focus/labels/contrast, reduced motion, overflow and recovery. A UX checkpoint follows a thin real journey, covers actual observed UX, and does not prove untested integrations.

## 4. Tools, access, security, and costs

| Tool | Decision/useful evidence | Access/fallback |
|---|---|---|
| OpenCode + free DeepSeek | SELECTED foundation; actual bounded work | Binary present, access user-reported; EP-01/02 |
| Backboard R-CLI | SELECTED substantive build/investigation contribution | Account/credit/model route unconfirmed; EP-04 |
| Sentry Agent Tracing | SELECTED actual workflow traces/investigation | Account/quota/delivery unconfirmed; EP-05 |
| Entire | SELECTED development history explaining a real change | Binary present; native capture before relevant work; EP-06 |
| Motion/Lucide | Proposed UI dependencies | Inspect exact license/version; no paid kit |
| Render | DEFERRED optional sample | Not in implementation queue |
| CodeRabbit/CI/DevRelay/Supabase/extra MCP | UNNECESSARY for current scope | Do not restore legacy tool bundles |

Cash cap: $0 new spending. Free DeepSeek only; no paid model fallback, recharge or silent provider switch. The earlier proposed up-to-$1 existing Backboard promotional allocation remains UNAPPROVED: verify balance/applicability and obtain scoped authorization before charged calls. Sentry free entitlement only, hosting $0; other reported credits unused. Initial operational ceiling 40 model operations across proofs/evaluation/demo, including retries; not a guaranteed quota. Exhaustion pauses dependent work.

Credentials stay in supported OpenCode auth storage or ignored local environment, never bundles/logs/screenshots/public records. Proposed local variables: `OPENCODE_BASE_URL`, exact native authentication variables after version proof, optional `SENTRY_DSN`, `UB_PORT`, `UB_DATA_DIR`. Verify presence without printing values. Safe placeholder example; no sourcing environment files as executable code.

Bind owned servers to loopback; validate origin/host; require browser-session token on mutations. Serve only built public assets, never repository/private state. Canonicalize paths and exclude protected/unrelated directories. No arbitrary browser shell/filesystem endpoint. Treat model/retrieved/review content as untrusted; disable raw HTML. Inspect native merged per-agent permission configuration; fail closed on unknown tool/scope metadata, never override native denial or enable broad auto-approve. Planning approval is not every tool action's permission.

This is a trusted local developer tool, not an operating-system sandbox. Use isolated modest synthetic demo workspaces; do not promise isolation from malicious executed project code. Rely on native bounded actions instead of building a second executor.

Sentry optional for normal users but selected for entry evidence: default no prompts/outputs/file contents/personal IDs; actual workflow/tool duration/errors, tokens/cost only from genuine native data. SDK/version-specific manual fields must be verified. Telemetry failure cannot disable core local work. Entire capture starts before recorded work, without requiring mirroring; keep automatic transcript upload disabled and inspect/sanitize before any sharing. Development recording is distinct from runtime tracing.

## 5. Early proofs and verification

Full runtime proofs remain NOT_RUN; the EP-01 diagnostic subset is INCONCLUSIVE for the full integration claim. The executed preflight findings are recorded in Section 9. Documentation, version/help checks and DNS diagnostics are not native model/edit/permission proof. Bounds below are included in phase capacity.

| Proof | Future smallest proof/owner/bound | Passing evidence | Failure/stop |
|---|---|---|---|
| EP-01 | Agent verifies server/SDK/free model/session/events and one bounded edit; 25m, max 3 operations, $0 | Correct native route/model, real diff/session | Stop dependent investment; supported-route amendment, no simulated core |
| EP-02 | Deny edit/outside-scope action, approve one scoped edit; agent, 20m, max 3 operations | Denied effects absent; approved native edit occurs | Core blocker until fixed |
| EP-03 | Interrupt disposable run/restart app; agent, 15m, max 1 operation | Reconciled native state/metadata without duplicate work | Stop execution/resume expansion |
| EP-04 | Verify R-CLI access and substantive task; agent, 20m, zero new cash | Session/useful contribution/relevant check | Access or explicit partner amendment; charged calls wait for approved credit allocation |
| EP-05 | Sanitized real operation and labeled controlled failure; agent, 15m, max 1 model operation/free entitlement | Received actual agent trace/timing/error investigation | Resolve access/instrumentation/privacy or amend target |
| EP-06 | Enable supported capture before real change; inspect checkpoint after phase commit; agent, 15m, $0 | Actual history explains phase work | No retrospective claim; stop work intended as proof until capture works |

EP-06 setup starts in foundation and completes its checkpoint evidence at the foundation commit, not an extra proof commit. The phase gate waits for that evidence. If access cannot be completed within the bounded proof, dependent work remains blocked until access is resolved or an explicit amendment changes the commitment.

Current shell-network/read-only Git/account limitations may need one precise user access/environment action. Use permitted agent routes first; never bypass restrictions or label unavailable evidence PASS.

| Check | Exact future command/procedure | Expected result/evidence |
|---|---|---|
| CK-01 | `npm run typecheck`; `npm run build` | Compatible contracts/runnable output |
| CK-02 | `npm run test:workflow` | Single current section; revision/approval guards; stale/duplicate approval; dependency invalidation; approved-only compilation |
| CK-03 | `npm run test:permissions` plus EP-02 | Native denial/approved scope verified through effects |
| CK-04 | `npm run test:recovery` plus EP-03 | Atomic metadata, duplicate prevention, section/native-run resume |
| CK-05 | `npm run test:contracts` | Fixture/live schemas; malformed/partial output cannot approve/execute |
| CK-06 | Live Oracle → approved Architect sections → Maker → Witness | Real output/change/check; exact compiled plan; complete drafts |
| CK-07 | Browser at ~390px/desktop, short/long/error/reduced-motion content | Keyboard/focus/labels/contrast/overflow/recovery |
| CK-08 | R-CLI contribution + Sentry trace/investigation + Entire checkpoint inspection | Meaningful separate partner evidence |
| CK-09 | Fresh local setup and credential/static-root inspection | Reproducibility/privacy/access status |
| CK-10 | Final judge rehearsal, media playback and public link checks | Final assets/claims match tested build/current requirements |

Scripts are proposed and assigned below, not already present. Test consequential behavior, not implementation mirrors or arbitrary coverage. Deterministic state/control checks plus direct output inspection; no model-only self-grading.

Evaluation cases: clear/ambiguous/missing/long idea, malformed/partial response, instruction injection, denial, provider failure, duplicate action, stale section approval, upstream revision after downstream approval and interrupted approval/run. Include unfamiliar cases separate from polished demo fixtures.

Evidence retains AC/check ID, procedure/result, revision plus relevant content fingerprint, environment/data mode, native/output reference and limitation. Status PASS/FAIL/NOT_RUN/INCONCLUSIVE/STALE. HEAD alone does not identify uncommitted tested code. Reuse valid evidence and invalidate only affected checks. A model statement is not an exit code or observed effect.

Repair: reproduce/evidence → one hypothesis → smallest fix → affected retest. After three focused failed cycles stop speculative mutation; propose bounded diagnosis/fallback/amendment without weakening criteria or renaming failure budgets.

## 6. Capacity, phases, and Git gates

16 working hours includes planning/setup/proofs/implementation/review/checks/fixes/technical docs/final materials/submission. AI assistance adds no hours. Read actual remaining time at each gate. Feature freeze target 10.5 working hours consumed; protect final-stage work/contingency. Earlier of official cutoff minus 30 minutes or remaining work budget is the delivery guard.

| Allocation | Hours |
|---|---:|
| Planning/review | 0.75 |
| Foundation/risky proofs | 1.75 |
| Workflow backend | 3.00 |
| Complete browser journey | 3.00 |
| Partner integration/reliability/technical handoff | 2.00 |
| Prompt 3 review/materials/submission | 4.00 |
| Contingency | 1.50 |
| Total | 16.00 |

### Binding current-branch phase-commit policy

- Stay on existing `main`. Do not create/switch phase branches, make stacked branches, create worktrees to evade this policy, or open phase PRs.
- Internal units are checklists, not commits. Finish a phase and its relevant checks, inspect owned diff/index/secrets, make one ordinary phase commit, verify it, then begin the next phase.
- Preserve unrelated changes; stage only owned authorized files. Failed/partial phases are not committed as complete.
- A blocked commit is VERIFIED_UNCOMMITTED and blocks the next implementation phase. No bypass, hidden backup/status commits or silent return to per-step commits.
- Subjects state the coherent change without phase/step numbering. No push/merge is implied. If a committed phase later needs a material repair, report the situation and resolve any extra repair-commit exception; never rewrite shared history to preserve a count.
- Prompt 1 docs remain uncommitted planning work and can join the first authorized foundation phase commit; no separate planning commit is requested now.

### Proposed phase queue

All phases use `main`; each implementation phase starts after its predecessor's verified commit. Units are agent-owned with user participation only for real access/product/publication decisions. Capture history before intended recorded work. Proposed queue does not itself activate implementation or Git actions.

| Phase / entry | Ordered units / scope / learning | Exit and single commit |
|---|---|---|
| Foundation, 1.75h; execution activated and preflight reconciled | F1 preserve docs/user work, scripts/lockfile/complete prompts/ignored state; F2 capture before substantive work, native version/model/permission proof; F3 bounded partner access. No UI polish. Learning: app/harness boundary | CK-01/03/05 as applicable, EP-01/02 passed, partner paths proven or explicitly blocked/amended, capture checkpoint verified at commit. `chore: establish the OpenCode-backed application foundation` |
| Workflow, 3h; foundation committed | W1 atomic stage/section metadata and checks; W2 exact approvals/revision/idempotency/invalidation; W3 thin native session/event/permission/recovery/evidence bridge. No duplicate engine/runner. Learning: approvals/uncertain operations | CK-02/03/04/05, EP-03, section progression/revision/restart verified. `feat: add durable staged planning and native execution` |
| Experience, 3h; workflow committed | X1 representative workshop and content; X2 live Oracle + interactive eight-section Architect; X3 Maker/native capabilities/activity/results; X4 fresh Witness/drafts and purposeful motion. Learning: event → API → native session → persisted outcome | CK-06/07, meaningful UX checkpoint, real end-to-end path, limitations recorded. `feat: deliver the guided haunted workshop journey` |
| Verification, 2h; experience committed | V1 complete substantive R-CLI contribution and actual partner findings; V2 regression/privacy/fresh-setup/rendered checks and observed fixes; V3 technical README/implemented architecture/evidence/Prompt 2 handoff. No final article/video production | CK-01–09, selected build commitments and MUSTs verified. `fix: verify and document the complete local workflow` |
| Final package, 4h; verification committed and Prompt 3 activated | D1 independent acceptance 45m; D2 actual article/video/captions/fields/compact social/interview materials 150m; D3 final access/rules/claims and authorized confirmation 45m. Source defects route to Prompt 2 | CK-10, actual accurate accessible assets; publication separate. If repository artifact edits authorized, one commit: `docs: prepare the verified demo and submission package` |

Each unit records outcome, preconditions/affected modules, preservation, AC/check IDs, actual evidence, effort/proof limit, learning where due, stop/fallback, owner/tool and exact next action in one concise execution record. No per-unit commit subjects or separate trackers.

Demonstration: modest campus lost-and-found project with useful behavior and a genuine behavioral test. Prefer a dependency-free Node example built/checked through native OpenCode actions. This is synthetic demo content, not a hardcoded response path; test unfamiliar inputs as well.

| AC | Units | Checks | Visible evidence |
|---|---|---|---|
| 01 | W1/X2 | CK-05/06 | Relevant idea clarification |
| 02 | W1/W2/X2 | CK-02/04/06 | Section draft/revise/approve/next, exact final compilation |
| 03 | F2/W2/W3/X3 | CK-03/06 | Denial and actual approved diff |
| 04 | W1/W3/X3 | CK-04/06 | Restart/uncertain-run reconciliation |
| 05 | W2/X2/X3 | CK-02/06 | Only dependent approvals/evidence stale |
| 06 | W3/X3 | CK-03/06 | Native capability recommendation and result |
| 07 | W3/V2 | CK-04/06 | Real command/result/tested fingerprint |
| 08 | X4/D1/D2 | CK-06/10 | Fresh review/complete evidence-grounded drafts |
| 09 | X1–X4/V2 | CK-07 | Rendered normal/edge/failure journey |
| 10 | F2/F3/V1/D2 | CK-08 | Separate genuine partner evidence |
| 11 | F1/F2/V3 | CK-09 | Reproducible setup/private-state separation |
| 12 | D1–D3 | CK-10 | Actual video/article and eventual entry receipt |

Learning notes after workflow/agent/UI milestones identify real files, a tradeoff and failure. No compulsory quiz interrupts agent-led work; understanding stays unconfirmed until demonstrated.

## 7. Delivery, event, and sources

Local executable harness, Linux first. No hosted execution/database/production deployment or auto-deploy trigger. Judge access: repository, reproducible local guide and actual video. Hosted sample stays deferred and cannot establish live remote execution.

Future scripts, created during foundation: `npm ci` (locked reproduction), `npm run dev` (local development), `npm run build` (compile), `npm start` (built loopback API/assets), check scripts in Section 5. These are proposed, not currently runnable instructions. Startup tracks owned processes/ports and native authentication; never terminate unrelated processes or silently alter user OpenCode configuration.

Official sources inspected during earlier planning research on 31 October 2026:

- https://dev.to/challenges/hacktoberfest-week4-2026-10-26
- https://dev.to/page/hacktoberfest-week4-2026-10-26-contest-rules
- https://dev.to/page/official-hackathon-rules (discovery source; personal conditions rechecked before entry)

Cutoff: 31 October 2026 11:59 PM PDT = 1 November 2026 12:29 PM IST. One entry; user reports none submitted. Final gate checks personal eligibility/DEV account, new project window, template/tags `devchallenge` and `hf26challenge`, demo/repository, reuse/licenses/AI disclosure and partner declarations. Writing quality has the greatest stated weight; no invented scores/probabilities.

| Target | Actual qualification evidence required |
|---|---|
| Overall | Native OpenCode central to real execution; functional theme/approvals/continuity; openness explanation/repository/demo |
| Best Use of Backboard | Substantive R-CLI implementation/investigation; actual session/contribution/check |
| Best Use of Sentry Agent Tracing | Received real agent/tool traces, actual findings/debugging; tokens/cost only when observed |
| Best Use of Entire | Captured development history explaining a real decision; sanitized accessible write-up evidence |

Targets remain conditional. Label controlled faults as tests; never invent an incident, improvement, cost, capture history or pass.

Technical source register (documented support, not runtime proof):

- https://opencode.ai/docs/server/ — V1 headless sessions/permissions/events.
- https://opencode.ai/docs/permissions/ — native rules, per-agent overrides; no blanket auto mode.
- https://opencode.ai/v2/docs/build/ and https://opencode.ai/v2/docs/build/client/ — official custom-client route and different V2 contracts/event semantics.
- https://opencode.ai/v2/docs/console/models/ — time-limited free DeepSeek and OpenCode-only free-chat route.
- https://vite.dev/guide/ and https://hono.dev/docs/getting-started/nodejs — runtime compatibility and Node adapter/static-root behavior.
- https://docs.sentry.io/product/agents/getting-started/ and https://docs.sentry.io/platforms/javascript/guides/node/agent-tracing/ — agent tracing/privacy; manual SDK details need version-matched validation.
- https://sentry.io/pricing/ — discovery free-plan reference; actual account/quota unknown.
- https://github.com/entireio/cli — local capture without account/mirroring and checkpoint/privacy behavior. Installed `entire agent-help` syntax was inspected, not executed as setup.
- https://backboard.io/hackathon — R-CLI offering; account/model/credit path unproven.

Prompt 3 receives actual tested revision/fingerprints, native references, scenario/reset procedure, architecture, limits, AI contributions and license facts. It produces complete article/template fields, actual video plus script/captions, compact social/interview materials and final checklist. A script is not a produced video. Verify capture/edit capability; otherwise request the precise minimal necessary user action and retain VIDEO_PENDING.

External drafts/uploads/publication/submission need scoped authorization. Inspect remote state before uncertain retries. Distinguish draft ready/video verified/requested/pending/confirmed entry. No click or local file proves final submission.

## 8. Execution directive and readiness

Current authorization: the user's 31 October instruction to execute the supplied Prompt 2 activates execution under A1. The later explicit continuation covers rechecking preflight and resolving the OpenCode v2/free DeepSeek proof, preserves existing work/main, reiterates one verified phase commit before the next phase, and prohibits new spending. Earlier documentation permissions and directly instructed AM-01–04 persist. Activation does not manufacture approval of the remaining draft engineering proposals or expand to account changes, charged calls, publication or submission. Phase commits are explicitly requested, subject to actual Git access and the phase gate. No branch creation. Prior planning files and current preflight work remain uncommitted.

For Prompt 2, user wants agent-led work/minimal inputs. Plan one approved active phase with commit gate before the next; record actual work/Git authorization when execution is activated. The phase-commit policy is directly instructed and supersedes legacy per-step defaults. The previous unapproved A2/per-step AUTO proposal is not active. Do not ask again for unchanged explicitly granted scope; ask only for real missing access/authority, material unresolved choice or external action.

Product Architect section approvals remain mandatory even when AI agents perform implementation. Approved planning does not grant execution/spending/Git/account/publication permission.

First sequence after Prompt 2 activation:

1. Read this blueprint, amended packet, complete project Prompt 1 and other full supplied prompts; reconcile new instructions.
2. Inspect `main`/HEAD/diff/index/untracked ownership, effective Git/network/runtime access, clock/budget, native processes/ports and credentials presence without values.
3. Preserve known docs/unrelated edits; establish active phase and Git scope. Resolve access before a phase commit is needed; no bypass.
4. Begin foundation within active scope, capture before intended recorded work, EP-01/02 before dependent investment.
5. Verify and commit the phase, inspect result/capture evidence, then enter the next phase only if authorized. Real proof/UX/budget/permission boundaries remain enforced.

One execution record: blueprint/amendments, phase/unit, branch/HEAD/owned diff, authority/phase-commit state, checks/tested fingerprint, native sessions/processes, partner evidence, time/operation/cost bounds, blockers and exact next action. Pause preserves partial work/unknown operations. Resume inspects actual native/local state; summaries cannot manufacture evidence or approvals.

Readiness: EXECUTION_PREFLIGHT_BLOCKED. Direct amendments are applied; other engineering proposals await relevant review. Prompt 2 is active, but no complete runtime proof has passed. Checks still needed: compatible native/free-model route, native denial, recovery, partner access, Git/network capability, redistribution rights and personal eligibility. Failed essential proof with no viable route blocks its dependents and requires resolved access or a focused amendment. Do not claim build/video/submission completion or activate Prompt 3 automatically.

## 9. Prompt 2 execution record

Initial run date: 31 October 2026, IST. Initial unit: first preflight before Foundation F1/F2; state BLOCKED, phase NOT_COMPLETE. Supplied procedure: `Pasted text(2).txt` (full Prompt 2 read), with the project overrides in `docs/prompts/README.md`. No new product/stack approval is inferred from activation. The latest resumed assessment below supersedes the initial access/HEAD facts; retain the initial observations as history.

| Area | Actual observed state |
|---|---|
| Repository | Existing `main`, HEAD `f4276a3` (`Initial commit`), equivalent SSH origin confirmed; index empty |
| Preserved incoming work | Modified README and all untracked `docs/` existed before execution; no reset/stash/cleanup/staging |
| Current work | Added `scripts/preflight.mjs`; updated README/status and this canonical record; no application, manifest, lockfile or SDK adapter created |
| Authority/Git | A1 preflight and local diagnostics only. Existing-branch/one-commit-per-verified-phase policy unchanged; `.git` is explicitly read-only in the session permission profile. No Git write attempted; no phase or commit completed |
| Toolchain | Node `v22.14.0`; npm `10.9.2`; binary OpenCode `v2.0.32`; adjacent `@opencode-ai/sdk` `1.18.26`, MIT metadata inspected |
| Native startup | Normal `opencode --version`/`serve --help` fail with EROFS opening the global log. Supported temporary XDG data/cache/state paths allow both commands to exit 0. Existing auth/session storage was not copied, edited or migrated |
| Client route | Official v2 client documentation specifies `@opencode/client`. The older package's `./v2` export alone does not prove compatibility with native v2.0.32. No client installed/adapter implemented; version-matched contract/live proof remains required |
| Network | OS resolver fails for `opencode.ai` and `registry.npmjs.org` with temporary name-resolution failure. Diagnostic DNS queries fail with ECONNREFUSED. Browser research works separately; it cannot establish shell/package/inference connectivity |
| Entire | `entire agent-help` and `entire status` inspected; status says not set up. No enable/auth/setup was performed. No captured development/checkpoint proof exists for this work |
| Other access | `SENTRY_DSN`, `BACKBOARD_API_KEY`, `OPENCODE_BASE_URL` absent from the process; absence does not establish missing account/other supported configuration. Existing OpenCode auth/config files are present, but values were not printed and authentication was not tested |
| Processes | No application/native run started. Port inspection with `ss -ltn` was denied; port availability remains unknown. Diagnostic children completed; the repeatable script removes its own disposable runtime directory |
| Usage/capacity | Zero model operations, billed requests, installs or new spending. Original 16-hour total and protected final-stage buffer retained; actual remaining user working availability is unknown, not reset by this record |

### Checks and proof status

Tested script SHA-256: `2eb8b27eec787eae933b4f38b2f52cb5503401f7a68978f4466e612259eb7b53` (31 October 2026, 09:39 IST). HEAD `f4276a3` plus this uncommitted script identifies the diagnostic; it is not an application-build fingerprint.

| Check | Procedure and actual result | Tested state/limit |
|---|---|---|
| Preflight syntax | `node --check scripts/preflight.mjs` — PASS | Initial script fingerprint recorded above; syntax only |
| Preflight behavior | `node scripts/preflight.mjs` — exits 1 with BLOCKED | Reports genuine DNS/capture blockers, CLI version/help success, read-only branch/HEAD; no inference or account/Git changes |
| EP-01 | INCONCLUSIVE; CLI/version/help subset completed | Free DeepSeek/server/client/session/events/bounded edit NOT_RUN; network blocked |
| EP-02–05 | NOT_RUN | Dependent native operations and partner proofs not established |
| EP-06 | INCONCLUSIVE; access inspection completed | Capture not enabled; history/checkpoint NOT_RUN, never retrospectively claimed |
| CK-01–10 | NOT_RUN | Planned application scripts/journeys do not exist yet; diagnostic results do not substitute for them |

### Exact resume condition and next unit

Resume in an agent environment that permits network access for npm/OpenCode, localhost server sockets, normal native runtime storage (or an explicitly isolated supported runtime) and `.git` writes for the required phase commit. No attempt to evade the current restrictions is authorized. Entire has already been enabled; do not repeat setup. The latest `entire status` no longer reports pending hook approvals; do not ask to approve them again without new evidence. Verify actual session capture before work intended as recording evidence. Do not infer public transcript-sharing permission.

Run `node scripts/preflight.mjs` and inspect its findings after access changes. Reconcile the still-draft engineering choices with a focused decision before dependent application implementation. The next build unit is the bounded native v2/free-DeepSeek/client/permission proof (EP-01/02), using the official supported client contract and no paid fallback. Select/lock the client only after compatibility proof; stop dependent investment if free access or denial enforcement fails. No Workflow-phase work before the full Foundation exit and its verified phase commit.

This is a BLOCKED build state, not BUILD_COMPLETE or a Prompt 3 handoff. The preserved final-stage work remains independent final acceptance, article, actual video, social/interview material and authorized submission; none has started.

### Latest resumed assessment — 31 October 2026, 09:46 IST

The user explicitly requested continuation, rechecking preflight and resolving the native v2/free DeepSeek proof without new spending. That scope and the phase-commit instruction are active; repeating permission requests would not resolve the remaining environment restrictions.

| Area | Latest evidence and result |
|---|---|
| Preserved repository changes | `main`, HEAD `e9585b0` (`Enable Entire`), index empty. The user-added commit contains `.codex/hooks.json`, `.cursor/hooks.json`, `.entire` settings and `.opencode/plugins/entire.ts`; preserved without edits. Existing README/docs/script changes retained |
| Entire setup | `entire status`: enabled for Codex/Cursor/OpenCode; seven Codex hooks need approval via `/hooks`. `entire session current`: this Codex session has no Entire session state. Local checkpoint list: zero; remote unreachable. Setup is verified; capture/checkpoint evidence remains INCONCLUSIVE |
| Network | Repeated OS resolution for npm/OpenCode fails with temporary name-resolution failure; bounded diagnostic DNS returns ECONNREFUSED. No provider/inference request attempted |
| Localhost | Python socket creation/bind is denied with EPERM. The updated Node diagnostic independently reports `LOOPBACK_BIND: FAIL` with EPERM. No native server can be exercised in this environment |
| Native command contracts | Disposable-XDG `opencode run --help` and `models --help` exit 0. Native v2 supports `--standalone`/`--server`; run supports explicit `--model`, `--agent`, JSON output and session options. No auto-approval, actual run, model-list request or inferred API behavior |
| Git | Current session permission profile still marks `.git` read-only. User's enable commit proves an external session could write, not that this agent now can. No write probe, staging or phase commit attempted |
| Changes/checks | Preflight now detects denied localhost sockets and pending Entire hook approval. `node --check scripts/preflight.mjs`: PASS. `node scripts/preflight.mjs`: expected exit 1/BLOCKED with specific DNS/localhost/hook failures |
| Tested state | HEAD `e9585b0` plus uncommitted script SHA-256 `2f5adfac75570a6d112ba21364cc19820f32742ac6bacded86e1c6ea6c2673dd`. Diagnostic findings establish environment limits only; no application/partner runtime success |
| Budget/proofs/next | Zero model operations or spending. EP-01 remains INCONCLUSIVE; native edit/permission proof NOT_RUN; no phase completed. Resume conditions above remain necessary. Continue the same proof unit after access/hook changes; do not start dependent phases |

### Hook inspection and proof-contract follow-up

After the user's next continuation, `entire status` no longer shows the seven-hook approval warning. `entire session current` still reports no Entire state for this Codex session; local checkpoints remain zero and the remote is unreachable. Approval-warning clearance is observed, while recording remains INCONCLUSIVE. Repeated preflight still reports DNS ECONNREFUSED and localhost EPERM; no free-model call or native execution was attempted.

Inspected `.codex/hooks.json`: seven event handlers, each invoking the corresponding `entire hooks codex ...` command if the Entire executable exists. Events are SessionStart, UserPromptSubmit, PostToolUse, Stop (assistant turn completion), SessionEnd, SubagentStart and SubagentStop. Six have 30-second timeouts; SessionEnd has three seconds. The two subagent events observe agents when used; their presence does not authorize or require delegation. Separate Cursor and OpenCode integration files notify Entire of their native lifecycle events. None of these registrations grants network, localhost or filesystem permissions to this session.

Official v2 proof-contract checks on 31 October 2026:

- https://opencode.ai/v2/docs/permissions/ specifies ordered `permissions` rules with `action`, `resource`, `effect`; the last match wins and no match asks. V2 uses `shell`/`subagent`, while V1 uses different field/action names. Do not reuse the old SDK's permission examples for native v2 without validation.
- https://opencode.ai/v2/docs/console/models/ still lists `deepseek-v4.1-flash-free`, selected natively as `opencode/deepseek-v4.1-flash-free`, with limited-time free pricing and the OpenCode-only free-chat restriction. This is documented availability, not evidence of this account's actual access. No direct inference endpoint call, paid fallback or new provider client is permitted by this check.

These inspections refine the existing EP-01/02 protocol; they neither pass it nor authorize starting dependent application phases. Current unit remains BLOCKED with the same resume conditions, preserved `main`/HEAD `e9585b0`, zero model usage/new spending and no phase commit.

### Foundation continuation — 31 October 2026, 10:01 IST

The current user instruction resumed Prompt 2, required a fresh preflight, preserved all existing work and `main`, retained the single verified phase-commit gate, and prohibited spending. The work below stays within Foundation; Workflow has not started.

| Area | Actual evidence and result |
|---|---|
| Rechecked preflight | `node scripts/preflight.mjs` exits 0 with `PREFLIGHT_ONLY`: DNS for OpenCode/npm, loopback bind, Node 22.14.0, OpenCode 2.0.32 CLI/server help and Git reads pass. This does not itself prove inference or Git writes |
| Official/native contract | Current official V2 docs specify `@opencode/client`; npm provides the MIT-licensed exact match `@opencode/client@2.0.32`. The current native catalog lists `opencode/deepseek-v4.1-flash-free` at zero input/output price |
| EP-01 free route/edit | PASS. Native session `ses_e6fcabfd5ffeS2jIJNg4L7haaQ` used the named free model and wrote only `tests/fixtures/opencode-native-proof/allowed.txt`; exact content SHA-256 `1a2234e5bdc2bc225cee00def1abe8abb60b7b51311bf9cf5d6d6376935d8b01`; reported cost `0` |
| EP-01 client/session/events | PASS. Exact client 2.0.32 connected to local server 2.0.32, created session `ses_e6fc984a3ffeFaf19Vk11620XE` at the proof fixture and received native `server.connected`; temporary server storage/password were removed after the check |
| EP-02 denial | PASS. Session `ses_e6fcb00eeffeM04R1WNW53uSyM` attempted the native write; OpenCode returned `Permission denied: edit`, `denied.txt` remained absent and reported cost was `0`. No `--auto` or permission override was used |
| Foundation implementation | Exact dependency lock, Vite/React entry, loopback Hono server, shared Zod status contract, thin OpenCode client/probe, complete four-stage prompt loader, ignored private state and deterministic contract/permission/prompt tests are present. No duplicate agent loop or inference client was added |
| Verification | `npm run typecheck`, `npm run build`, `npm test`, `npm run test:contracts`, `npm run test:permissions`, and production-dependency `npm audit --omit=dev --audit-level=high` pass; seven tests pass and the audit reports zero vulnerabilities |
| Live local integration | With disposable native storage and a throwaway local password, `/api/health` returned `ok`; `/api/engine` returned available OpenCode `2.0.32`, exact free model and `modelAvailable: true`. No inference occurred in this probe |
| Dependency metadata | Direct runtime/development packages are exact-locked; inspected licenses are MIT/ISC/Apache-2.0. Prompt-source redistribution rights remain unresolved and must be settled before any push/public release of the untracked prompt bundle |
| EP-04/05 | BLOCKED for partner-dependent work: `BACKBOARD_API_KEY` and `SENTRY_DSN` are absent from this process, no supported alternate access was found, and no account setup, charged call or credential output occurred. Core Workflow work does not claim either partner proof |
| EP-06 | INCONCLUSIVE until the phase commit. `entire checkpoint list --pending --json` now identifies this Codex session, the original prompt and 19 touched Foundation files; zero local checkpoints exist before the commit and the checkpoint remote is currently unreachable |
| Git/cost | Branch remains `main`, HEAD remains `e9585b0`, index is empty, existing work is preserved and no push occurred. Two native proof runs reported cost `0`; package downloads and local checks incurred no new cash spending |

Foundation code and applicable checks are VERIFIED_UNCOMMITTED. The next permitted action is the single Foundation commit `chore: establish the OpenCode-backed application foundation`, followed immediately by commit and Entire checkpoint inspection. Only after that gate may Workflow begin. Partner-dependent work remains blocked pending supported access or a focused amendment; Prompt 3, deployment, publication and submission remain out of scope.

### Workflow continuation — 31 October 2026, IST

Foundation committed cleanly on `main` as `14fc6a6` (`chore: establish the OpenCode-backed application foundation`). Entire created readable checkpoint `01M683PGNKWVGNV1SEFKS51S73`, associated it with the Codex session/commit and recorded redaction metadata. The checkpoint remote remained unreachable and outgoing-queue inspection could not acquire its read-only lock; no checkpoint or source push was attempted. This satisfies local EP-06 evidence with the stated remote limitation.

| Area | Actual evidence and result |
|---|---|
| W1 durable state | Added the versioned eight-section project schema, explicit dependencies/statuses, current section/next action, approvals, actions, operations and evidence records |
| W2 approvals/invalidation | Exact section version/hash is required; only the active dependency-ready section can be approved; changed upstream content increments its version and marks only transitive dependent approvals/sections stale; compilation rejects every unresolved section |
| W2 idempotency/concurrency | Unique action ID plus canonical payload hash returns one existing result for a retry, conflicts on changed payload and uses expected project revision for optimistic concurrency |
| W3 persistence/recovery | Atomic temp-write/rename retains a previous snapshot. A corrupt current file is preserved and reported while the valid previous snapshot is offered; it is never silently reset |
| W3 HTTP/security | Validated project/revision/approval routes enforce the 64 KiB content bound and a local browser-session token for mutations; conflicts return 409 and malformed requests return 400 |
| W3 native operation state | Operations retain payload/native session/message references and move through the planned statuses. Disconnect produces UNKNOWN and never retries; explicit native reconciliation can resolve it to a terminal state |
| EP-03 | PASS for app restart/idempotency plus deterministic native-state reconciliation. A live local run persisted revision 1, stopped/restarted on the same data, retried the same action and returned `duplicate: true`; revision/action count remained 1. Native interruption itself is modeled/tested without an additional inference call |
| CK-02/03/04/05 | PASS for implemented scope. `npm run typecheck`, `npm run build`, `npm test`, `npm run test:workflow`, `npm run test:recovery`, contract and permission tests pass. Full suite: 15 tests, zero failures |
| Scope/cost | No Experience UI work, deployment, publication, account changes, partner calls, extra model operations or spending occurred. EP-04/05 remain blocked as recorded above |

Workflow is committed on `main` as `abf87f7` (`feat: add durable staged planning and native execution`). Entire has a logs-only checkpoint for that commit. Experience was the next phase.

### Experience continuation — 31 October 2026, IST

The user authorized the phase commit and continuation, then completion of the Experience phase, with local permissions for that phase and no new spending. Verification, deployment, publication, and Prompt 3 stayed out of scope.

| Area | Actual evidence and result |
|---|---|
| Journey | Oracle proposal, exact section approval, Maker scope, native edit, and a fresh Witness review are wired through validated routes. A model reply cannot approve a product or section. Short malformed replies leave the section unchanged. Longer prose is stored as an unapproved draft. |
| Live path | Disposable workshop at a temporary data directory. Free DeepSeek produced an umbrella-relay proposal and the first Architect section. Sections 2–8 were explicit user-text approvals, including one long section. Maker wrote `ledger.mjs` and `ledger.test.mjs` in the isolated demo workspace. `node --test` failed: `snapshot` is declared twice in `ledger.mjs`. Witness, in a separate session, reported that failure and said not to claim the ledger works. |
| CK-06 | FAIL for the demo ledger behavior. PASS for the control path: real native output, a real check, an exact compiled plan, and drafts that match the failure. Session id for the timed-out Maker wait was not captured. |
| CK-07 | Browser at 1280px and 390px. Oracle headline, stacked narrow layout, wrapped spirit strip, long proposal scroll, Witness findings, and an unreachable-engine recovery message were observed. Reduced motion removes the lantern flicker. Headless Chrome reported the focus outline width without a solid outline style, so the committed style also draws a focus ring with `box-shadow`. |
| Checks | `npm run typecheck`, `npm run build`, `npm test` (21 tests), and production `npm audit --omit=dev --audit-level=high` pass. |
| Partners | EP-04/05 remain blocked. `BACKBOARD_API_KEY` and `SENTRY_DSN` were not present. No charged call. |
| Cost | Free-model route only. The client rejects a non-zero reported session cost or a substituted model. No new cash spending. |

Experience is VERIFIED_UNCOMMITTED. The next permitted action is the single phase commit `feat: deliver the guided haunted workshop journey`, then commit and Entire inspection. Verification stays gated until that succeeds. The ledger syntax error is a demo-workspace defect, not a reason to claim the check passed.
