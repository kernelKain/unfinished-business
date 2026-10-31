# UX and visual system

The product is a guided workshop, not a control panel. The main journey is always visible first; OpenCode configuration and harness controls live behind one expandable panel.

## Onboarding states

The first-run wizard has three visible steps: **Server**, **Model**, **Verify**.

| State | What the user sees | Primary action |
|---|---|---|
| `not_configured` | The start command, URL field, username, password field, and the provider-key ownership note. | **Test connection** |
| `checking` | Button label changes to **Checking…**; no success is implied. | Wait |
| `authentication_required` | “OpenCode rejected the application connection” plus the server-password repair, not a provider-key request. | Re-enter password / retry |
| `incompatible_version` | Exact server version, tested `2.0.32`, and a 2.x repair. | Install compatible server |
| `unavailable` | “The server did not answer” plus start/URL/port repair. | Start OpenCode, retry |
| `connected` / `degraded` | Provider readiness, full model list, limit/pricing/tool/modality facts, and only the variants reported for the chosen model. | Choose model |
| Model saved | Model and variant appear in the main journey’s **Run model** panel and in the OpenCode panel. | Continue journey |
| Wizard dismissed | The journey is visible with a connection/model banner; Maker stays blocked until setup is repaired. | **Choose model** / **Open setup** |

### Copy rules

- Say **OpenCode server password**, never “API key”.
- State clearly that provider keys stay in OpenCode and that the workshop cannot accept them.
- A failure names the exact state and gives one repair path. Do not say “something went wrong”.
- A model is never called “free” unless every reported cost row is zero.
- A model is never given a generic low/medium/high scale. Variants are exactly the reported IDs, plus **Model default**.
- Usage is shown only when reported; otherwise say “not reported”, not `0`.
- Quota is not available programmatically; link to the provider console and say so.

## Main journey

The existing spirit strip, lantern, outline, working document, and activity/evidence sidebars remain. New information is deliberately small:

- A **Run model** panel in the left sidebar shows the selected model, variant, pricing, tool support, context, and local status.
- Connection problems appear as a banner above the working document with **Open setup** or **Review**.
- An active run appears as a banner saying it is working in the background, with **Cancel run**. The saved document is not replaced by a blocking spinner.
- An unselected or disappeared model blocks Maker with an explicit **Choose model** action. No silent substitution.
- The top bar has an **OpenCode** button for the connection wizard.

## Advanced OpenCode panel

One `<details>` disclosure, collapsed by default, labelled **OpenCode settings and controls**. Sections:

1. **Status** — state pill, URL, version, managed/local, refresh, connection setup, diagnostics.
2. **Model and reasoning** — discovered models grouped by provider, variant list for the chosen model, pricing/limits/tools/modality/locality, **Save model**.
3. **Agents, roles, and permissions** — Oracle/Architect/Maker/Witness mapping with explicit fallback; visible agents; pending requests with **Allow once**, **Always**, **Reject**.
4. **Discovered harness capabilities** — supported/deferred matrix with a reason for each deferred item; commands, skills, MCP, formatter/LSP configuration.
5. **Usage, tokens, and cost** — only reported totals; quota explanation and provider links.
6. **Project sessions** — list/resume, fork (disabled when empty), compact, interrupt, revert stage/clear/commit, cancel active run.
7. **Export check** — the same review-note limitation as the journey.

### Deferred rendering

A control the installed version does not support is rendered as **deferred**, not hidden and not fabricated. Examples: separate tool catalog, provider quota, live formatter/LSP health. The reason is visible in the capability grid and in `docs/OPENCODE_INTEGRATION.md`.

## Visual tokens

The existing haunted-workshop palette is retained:

- background `#111018`, surface `#1b1824`, raised `#252031`;
- text `#f4f0e8`, muted `#b8afca`;
- accent `#f4b66c`, spirit `#bfa3ff`, success `#8bd5a7`, danger `#ffb4a8`;
- Georgia for headings, system sans for UI, monospace for technical metadata;
- 16px cards, 12px controls, 44px minimum action height.

New components reuse these tokens rather than introducing a second design language.

## Accessibility

- Onboarding is a labelled region; diagnostics are a list with text, not color alone.
- State pills include the state word, so color is supplementary.
- The advanced panel uses native disclosure semantics.
- Inputs have visible labels; the password field has a specific description.
- Focus remains a 3px solid outline plus a `box-shadow` ring for browsers that report outline style inconsistently.
- Reduced-motion preference disables the lantern flicker and seal fade.
- `prefers-contrast: more` strengthens borders; forced-colors keeps buttons and the lantern usable.
- The layout stacks at narrow widths; long model IDs, URLs, diagnostics, and diffs wrap rather than overflow.

## Error and recovery copy examples

| Situation | Copy |
|---|---|
| Password mismatch | “OpenCode rejected the application connection. Enter the same password printed by `opencode serve`.” |
| No models | “OpenCode returned no selectable models. Connect a provider inside OpenCode with `/connect`, then retry.” |
| Unavailable model | “The selected model is no longer reported by OpenCode. Choose another model; the previous selection was not replaced automatically.” |
| Unsupported variant | “Variant `max` is not attached to this model. Reported variants: low, medium, high.” |
| Local limits | “This local model reports a small context/output window. Reduce scope or choose a model with larger limits. OpenCode does not report free RAM or VRAM.” |
| Origin/proxy | “A proxy or origin rule rejected the server-side request. Browser CORS is not required because the app connects from its own process.” |
| Restart during run | “The application restarted while this native run was in flight. Reconcile the OpenCode session before another attempt.” |

## What not to do

- Do not put provider-key inputs anywhere.
- Do not put model or connection controls in the main document.
- Do not show a fixed model name in marketing copy or a default chip.
- Do not claim a run passed, a model is free, or a quota is available without an observed value.
- Do not auto-approve a permission request.
- Do not automatically switch a project to a different model when the saved one disappears.
