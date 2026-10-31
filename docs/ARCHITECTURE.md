# Architecture — Unfinished Business

**Status:** Implemented through Phase 4. Last updated 2026-10-31.

## 1. System shape

```text
Browser
  ├─ /            landing page (eager)
  ├─ /demo        deterministic walkthrough (lazy chunk)
  └─ /workshop    real workshop (lazy chunk)
        │
        │ fetch /api/*  (same origin; mutations carry x-ub-session-token)
        ▼
Hono server (src/server/app.ts)
  ├─ /api/health                 public
  ├─ /api/connection             connection state + discovery summary
  ├─ /api/connection/check       read-only connection/discovery check
  ├─ /api/connection/configure   local only; server URL + in-memory password
  ├─ /api/engine/selection       persist a discovered model/variant
  ├─ /api/opencode/*             project-owned sessions, permissions, usage
  ├─ /api/project                current snapshot
  ├─ /api/messages               stage messages
  ├─ /api/approvals              product + Maker scope
  ├─ /api/sections/*             revisions + exact-version approvals
  ├─ /api/runs/*                 Maker run, cancel, reconcile
  ├─ /api/export                 approved plan + drafts
  └─ static dist/web             SPA fallback for non-API paths
        │
        ▼
OpenCode 2.x server over loopback
  ├─ discovered model catalog
  ├─ native tools and permissions
  ├─ sessions/transcripts
  └─ isolated demo workspace
```

Unfinished Business never implements a second agent loop, inference client, general command executor, or transcript store. OpenCode owns those. The app owns workflow state, approvals, dependency invalidation, evidence references, and the interface.

## 2. Frontend routing

`src/web/routes.ts` is the pure route resolver:

| Path | Route | Rendering |
|---|---|---|
| `/` | `landing` | Eager `LandingPage` |
| `/demo` | `demo` | Lazy `DemoPage` |
| `/workshop` | `workshop` | Lazy `WorkshopPage` |
| anything else | `landing` | Landing fallback |

`src/web/App.tsx` reads `window.location.pathname`, listens for `popstate`, updates `document.title` and `document.documentElement.dataset.route`, and scrolls to the top on route change. Navigations are ordinary anchors, so they work without a client router and the server's SPA fallback can serve `index.html`.

The workshop and demo are split with `React.lazy`. Measured production chunks:

- initial `index-*.js`: 192.8 KiB gzip;
- `WorkshopPage-*.js`: 54.8 KiB gzip (includes onboarding/discovery UI);
- `DemoPage-*.js`: 2.6 KiB gzip;
- CSS: 12.6 KiB gzip.

The workshop keeps its existing Phase 3 structure: four-stage navigation, plan outline, working document, activity/evidence rail. The visual layer changed; the stage and approval semantics did not.

## 3. Static serving and assets

`src/server/index.ts` serves `dist/web` when it exists:

- `/` → `index.html`.
- real files → their content type.
- unknown non-API paths → `index.html` (SPA fallback).
- `/api/*` is never served from disk.
- Path resolution is checked against the `dist/web` root to prevent traversal.
- Private state under `UB_DATA_DIR` is outside the static root and is never served.

Public hero assets are produced by `scripts/build-hero-assets.py`:

```text
assets/source/hero-ghostlight-workshop.webp   (master, not shipped)
        │
        ├─ public/assets/hero/hero-ghostlight-wide-{1920,1280,768}.{avif,webp}
        ├─ public/assets/hero/hero-ghostlight-wide-{1280,768}.jpg
        └─ public/assets/hero/hero-ghostlight-portrait-{900,600}.{avif,webp}
```

Vite copies `public/` to `dist/web/`, so production URLs are `/assets/hero/...`. The `<picture>` element selects the portrait crop below 720px and wide crops above it. Explicit width/height and CSS aspect ratios prevent layout shift.

## 4. Frontend modules

| Path | Responsibility |
|---|---|
| `src/web/App.tsx` | Route switch, lazy loading, page title |
| `src/web/routes.ts` | Pure path resolution and titles |
| `src/web/landing/` | Hero, usage modes, spirit roster, deterministic teaser, setup, privacy, FAQ, final CTA |
| `src/web/demo/` | Scripted walkthrough, all-state gallery, recovery states |
| `src/web/workshop/` | Real Oracle/Architect/Maker/Witness workflow, connection state, active-run polling |
| `src/web/onboarding.tsx` | First-run connection check and model/variant selection |
| `src/web/opencode-panel.tsx` | Advanced discovered capability, session, permission, usage, and revert controls |
| `src/web/components/SpiritCharacter.tsx` | Original inline SVG characters and state classes |
| `src/web/components/RunInspector.tsx` | Native runs, evidence ledger, permission boundary |
| `src/web/components/SpiritStageTabs.tsx` | Semantic four-stage navigation |
| `src/web/components/SectionCard.tsx` | Outline cards and empty state |
| `src/web/components/SetupCommandTabs.tsx` | Accessible command tabs |
| `src/web/components/SetupDialog.tsx` | Native `<dialog>` setup help |
| `src/web/components/Brand.tsx` | Brand mark and type lockup |
| `src/web/spirits.ts` | Spirit profiles and state labels |
| `src/web/content/landing.ts` | Landing copy, fixtures, recommendations, FAQ |
| `src/web/setup.ts` | Tested setup command data |
| `src/web/styles.css` | Tokens, components, character states, responsive and accessibility rules |

The landing and demo import only browser-safe modules. `WorkshopProject` is a type-only import from `src/web/api.ts`; no server module enters the client bundle.

## 5. Connection, discovery, and deployment modes

`ConnectionService` (`src/server/opencode/connection.ts`) owns the OpenCode server URL, optional in-memory Basic-auth password, version check, and normalized discovery. `src/shared/opencode.ts` validates the browser-safe connection and discovery shapes.

- `local` allows browser connection editing and loopback HTTP.
- `hosted-private` manages the URL/credentials in the environment and makes browser configuration read-only.
- `hosted-demo` is read-only and may legitimately show no models until a provider is connected inside OpenCode.

Discovery normalizes providers, models, agents, roles, permissions, commands, skills, MCP servers, formatter/LSP presence, capabilities, and usage. Provider settings, headers, request bodies, skill contents, and prompt text are dropped before leaving the server. Provider API keys never enter Unfinished Business; only the OpenCode server Basic-auth password may be held in memory. See `docs/OPENCODE_INTEGRATION.md`.

Connection states are `not_configured`, `checking`, `connected`, `authentication_required`, `incompatible_version`, `unavailable`, and `degraded`. Every non-connected state carries at least one diagnostic with a repair action. The UI never replaces a failed check with an optimistic connected state.

## 6. State and evidence flow

The API contract for workflow mutations is unchanged from Phase 3:

- Every mutation sends `actionId` and `expectedRevision`.
- Browser mutations require `x-ub-session-token`, issued by `/api/session` over loopback (or after basic auth in a hosted deployment).
- Approvals target an exact section version and hash.
- A revision supersedes the old approval and invalidates dependent sections.
- Maker requires all current sections approved plus a separate scope grant.
- Runs are recorded as operations; unknown runs are reconciled, not repeated.
- Evidence records an observed native result; a missing result is an empty state.

The Run Inspector is read-only. The only write it can trigger is the existing reconcile action for an unknown operation. It cannot approve, retry, or grant permission.

## 7. Workflow authorization is unchanged

Phase 4 did not change:

- session-token checks;
- basic-auth behavior;
- revision conflicts;
- exact-version approval checks;
- Maker scope gating;
- native permission authority;
- atomic project storage.

The setup dialog and landing page are instructions only. Opening them does not assert that OpenCode is reachable.

## 8. Why the demo is separate

The deterministic demo renders fixture data with visible “scripted sample” labels. It exists because a first-time visitor should understand the interface before installing an engine, and because visual regression tests need stable states that do not depend on a model call. It is a separate route so the real workshop cannot accidentally use fixture data.

## 9. Not in this architecture

- A second coding harness or command executor.
- A public arbitrary-execution sandbox.
- Remote access to a visitor's local repository.
- A database service.
- Automatic publication or submission.
- A heavy animation or 3D framework.
