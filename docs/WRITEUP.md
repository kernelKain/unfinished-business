---
title: "Unfinished Business: Four AI Spirits for Abandoned Code"
published: false
description: "A local-first workshop that uses OpenCode for the build and Entire checkpoints to preserve how the work happened."
tags: devchallenge, hf26challenge, opensource, ai
cover_image: https://raw.githubusercontent.com/kernelKain/unfinished-business/main/docs/assets/screenshots/cover-photo.png
---

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 4: Ghost in the Machine](https://dev.to/challenges/hacktoberfest-week4-2026-10-26).*

## What I Built

A hackathon project can be technically alive and still feel dead.

The repository exists. There may even be a half-working feature. But the next decision is fuzzy, the plan changes every hour, and by demo time nobody can say which result was actually observed and which one was only promised.

I built **Unfinished Business** for that gap.

It is a local-first workshop around OpenCode. Four small spirits take one project from a vague idea to a proposal, a reviewable plan, one bounded implementation, and an evidence-based review. The point is not to make the agent more autonomous. The point is to make the handoffs harder to fake.

OpenCode performs the native work. Entire records the agent sessions and checkpoints behind the project itself. That pairing made provenance part of both the product and the way I built it.

## Demo

- Live interactive example: <https://unfinished-business-demo.onrender.com>
- Source: <https://github.com/kernelKain/unfinished-business>

The Render version is a recorded, read-only example. It needs no login and has no model, provider credential, repository, or write access. For a real run, use the local setup below and connect your own OpenCode account.

For the fastest judge path:

1. Open the live example.
2. Play the 90-second version.
3. Inspect Architect's approved versions and Witness's evidence.
4. Open the Entire session history to verify how the project was built.

## Code

{% github kernelKain/unfinished-business %}

The complete source, local setup, tests, OpenCode integration, and Entire hooks are in the [public repository](https://github.com/kernelKain/unfinished-business).

## The four spirits

![Oracle, Architect, Maker, and Witness with their responsibilities](https://raw.githubusercontent.com/kernelKain/unfinished-business/main/docs/assets/screenshots/four-spirits.png)

*Each spirit has one job and one stopping point. None of them can approve its own work.*

**Oracle** asks the awkward questions first. What is the project actually for? What is known? What is still an assumption? It asks a few questions at a time instead of dropping an intake form on the user.

**Architect** drafts one section of the plan at a time. A revision is shown as a diff. Accepting that draft and approving that exact version are separate actions, so an old approval cannot quietly survive a changed plan.

**Maker** receives a narrow scope only after the current plan is approved. OpenCode still owns the native tools and permission prompts. Clicking “approve” in my interface cannot turn an OpenCode denial into permission.

**Witness** looks at the observed diff and check result in a fresh session. If a run timed out, a check failed, or no live session happened, Witness says that instead of writing a victory paragraph.

The characters also change state with the work. Maker can be ready, building, waiting for permission, blocked, or successful; Witness can report evidence or an inconclusive result. Those states are not decoration—they keep failure and uncertainty visible.

![Every visual state for Oracle, Architect, Maker, and Witness](https://raw.githubusercontent.com/kernelKain/unfinished-business/main/docs/assets/screenshots/spirit-states.png)

*The complete state sheet used by the interface. A success expression appears only after an observed result.*

## One abandoned project

The public example follows Driftwatch, a tiny issue-triage CLI that was left in an awkward state. It reads an `issues.json` export, but it counts closed issues and calculates staleness from the creation date instead of the latest activity.

![The Driftwatch guided sample at the Architect approval step](https://raw.githubusercontent.com/kernelKain/unfinished-business/main/docs/assets/screenshots/guided-example.png)

*The recorded sample pauses at Architect so a judge can inspect the exact approved plan version before Maker receives work.*

Oracle narrows the rule. Architect drafts and revises the plan. Maker receives a two-file scope. A recorded Node check passes four behavioral cases. Witness then makes the important distinction: the fixture demonstrates the interface and evidence language, but it is not proof that a live model just made the change.

That last sentence matters. I wanted the demo to remain useful even when a provider quota is exhausted, without pretending a recording is a live inference result.

## How I Built It

OpenCode is the engine. It owns model access, the agent loop, tools, permissions, interruption, and native sessions.

Unfinished Business owns the workshop around it:

```text
idea → Oracle proposal → Architect sections → Maker scope → Witness evidence
          approve          approve exact       approve        inspect
                            versions
```

There are two deployment paths, and I kept them separate on purpose:

![Architecture diagram: the read-only Render demo stops at a recorded fixture, while the full workshop runs locally against the user's own OpenCode server](https://raw.githubusercontent.com/kernelKain/unfinished-business/main/docs/assets/architecture.png)

*The hosted path stops at a read-only recording. Real model access, approvals, and repository changes remain in the user's local OpenCode environment.*

The Render path ends at a deterministic, read-only fixture. The local path continues from the browser to the Unfinished Business server, then to the user's own OpenCode server and managed workspace. This is why the public demo can be useful without quietly becoming a shared remote coding environment.

Project state is written atomically. Runs are persisted operations with progress, elapsed time, cancellation, retry, and reconciliation controls. A response that arrives after a timeout is validated and applied at most once.

The browser never receives a provider API key. In local mode it talks to the Unfinished Business server, which connects to OpenCode on loopback. The only credential the local wizard accepts is the OpenCode server password, held in the application process rather than project data or browser storage.

## My Agent Session

### Entire kept the build from becoming another ghost

The product is about preserving decisions and evidence, so I wanted the development history to follow the same rule. I used [Entire](https://github.com/entireio/cli) to capture agent-assisted OpenCode sessions as checkpoints connected to the commits they produced.

I did not stay in one coding harness for the whole project. Usage limits meant I had to move between OpenCode, Cursor, and Codex. [My public Entire session history](https://entire.com/gh/kernelKain/unfinished-business/sessions) gave those handoffs one inspectable trail: I could see which session produced a checkpoint, what files it touched, and which commit carried the result instead of trying to reconstruct the previous agent's work from a diff alone.

That was most useful when a limit arrived in the middle of a debugging or hardening pass. I could pick up from a concrete checkpoint and commit trail in the next harness while still reviewing what changed and why the earlier session stopped. Entire did not make the tools interchangeable, but it made switching between them much less lossy.

This was not a badge added after the build. The repository contains the [OpenCode hook integration](https://github.com/kernelKain/unfinished-business/blob/main/.opencode/plugin/entire.ts), [git-refs checkpoint configuration](https://github.com/kernelKain/unfinished-business/blob/main/.entire/settings.json), and a [preflight check](https://github.com/kernelKain/unfinished-business/blob/main/scripts/preflight.mjs) that treats Entire capture as release evidence rather than assuming it is active.

[Implementation commits](https://github.com/kernelKain/unfinished-business/commit/8273240) carry an `Entire-Checkpoint` trailer:

```text
refactor(demo): say a session was not run instead of NOT_RUN

Entire-Checkpoint: 01M6AFB74ZNJM4MXC6K2FAZE5A
```

That link matters when a diff is no longer enough. A maintainer can trace a change back to the agent session and checkpoint that produced it, instead of reverse-engineering intent from the final code. At the time of this write-up, Entire shows 37 checkpoints across 42 commits, covering model integration, platform fixes, Render hardening, documentation, and the recorded demo. Those checkpoints contain 59 recorded messages and about 7.0 million tracked tokens—6.0 million input and 972,500 output—with one development trail merged. The numbers make the practical value clearer: this was a long, multi-harness build, and Entire kept its history inspectable instead of reducing it to one final diff.

![Entire session dashboard showing 37 checkpoints across 42 commits, 59 messages, and approximately 7 million tracked tokens](https://raw.githubusercontent.com/kernelKain/unfinished-business/main/docs/assets/screenshots/entire-session-dashboard.png)

*The public Entire dashboard captures the scale of the development trail: 37 checkpoints, 42 linked commits, 59 messages, and one merged trail.*

Entire also exposed a useful failure honestly: later documentation-only commits made while the `entire` binary was unavailable did not receive a checkpoint trailer. The Git hook reported that and continued without pretending the session had been captured. That is exactly the behavior I wanted for this project—missing evidence stays missing instead of being reconstructed after the fact.

## Why Does Open Innovation Matter?

The project would make much less sense if it were tied to one closed model endpoint.

OpenCode gives the user control over the engine. They can connect OpenCode Go, another provider, or a local model, and the workshop discovers the catalog OpenCode actually reports. The workflow does not need to be rewritten when the model changes.

That openness is also a boundary. Provider authentication stays in OpenCode. Native permissions stay in OpenCode. A model reply is treated as a proposal, not as authority to approve a section or widen an implementation scope.

The public Render deployment uses the same interface without shipping my provider access to every visitor. Judges can understand the product immediately; people who want a real run bring their own OpenCode setup.

## The Spirit of It

The project landed for me when Witness refused to call a recorded fixture a live success. That small refusal captured what I wanted from the whole system. Unfinished projects do not need another agent that confidently invents progress; they need a careful way to recover their intent, finish one bounded piece, and preserve what really happened.

## What did not fit neatly

The hardest part was not generating plan text. It was keeping the state honest when real tools are slow or fail.

A model can finish after the HTTP request times out. A permission request can remain pending. A provider can report that a model exists and then reject the request because a quota ended. A revision can make a previously approved section stale.

Those are product states now. They do not disappear behind a spinner, and they do not trigger an automatic second native action.

The current release also has real limits:

- Maker edits an isolated managed workspace, not any repository selected in the browser.
- The public site is a preview, not a remote code-execution sandbox.
- Windows and Linux ARM64 are not supported.
- A spending limit can only use cost OpenCode reports; an unknown-price provider may report that after the request.
- The recorded example proves the interface journey, not live inference.

## Run the real workshop

You need Node.js 22.14 or newer and a supported OpenCode 2.x installation.

```bash
git clone https://github.com/kernelKain/unfinished-business.git
cd unfinished-business
npm ci
```

In OpenCode, run `/connect`, choose OpenCode Go or another provider, and confirm a model with `/models`. Then start the server:

```bash
npx --no-install opencode serve --hostname 127.0.0.1 --port 4096
```

In another terminal:

```bash
npm start
```

Open <http://127.0.0.1:4310> and use the OpenCode server password in the wizard. Do not paste a provider key into Unfinished Business.

## Built with

- TypeScript, React, Vite, Hono, and Zod
- OpenCode through `@opencode/client` and the pinned cross-platform CLI
- Entire CLI with OpenCode hooks and git-ref checkpoints
- Atomic JSON project storage
- Node's test runner and Playwright
- Render for the public read-only preview
- Optional Sentry instrumentation

## Prize categories

### Best Use of Entire — primary category

Entire is the development-memory layer behind Unfinished Business. Its OpenCode hooks captured real agent sessions, attached checkpoints to implementation commits, and pushed checkpoint refs separately from the main code history. That gives reviewers something a polished final diff cannot provide: the prompt, agent transcript, touched files, and session context behind a change.

It was especially valuable when usage limits pushed me between OpenCode, Cursor, and Codex: the [public session history](https://entire.com/gh/kernelKain/unfinished-business/sessions) kept the work reviewable across those harness changes instead of splitting the project's development story into disconnected fragments.

It also mirrors the product's central idea. Unfinished Business keeps an evidence trail inside the application; Entire keeps an evidence trail for how the application itself was built. Both treat provenance as part of the work rather than a story written afterward.

The claim is verifiable in the repository through the hook integration, enabled settings, commit trailers, remote checkpoint refs, and preflight evidence check linked above.

### Best Use of Render — secondary category

Render hosts the no-login interactive front end and recorded workflow while the server independently enforces read-only behavior. It serves the real React and Hono application, rejects mutation routes in hosted-demo mode, and exposes no provider key, repository access, or shared coding environment. That gives judges a useful product tour without pretending the deployment is a public code-execution sandbox.

## AI assistance and timing

I used coding agents while building and reviewing the project. I verified the resulting behavior with automated tests, clean-start checks, and the public demo boundary. The application itself keeps model output behind explicit human approval and native OpenCode permissions.

The original repository was created during the Week 4 challenge window. Maintenance and documentation commits made after the October 31, 2026 cutoff are post-deadline improvements and should not be treated as part of the submitted build.
