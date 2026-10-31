# Operations and recovery

**Status:** Phase 7 adds deterministic demo reset/isolation. Live workflow recovery remains the Phase 3/4 behavior.
**Last updated:** 2026-10-31.

## Two separate recovery domains

| Domain | State | Reset/recovery | Must not affect |
|---|---|---|---|
| Guided demo (`/demo`) | Browser playback + versioned fixture | Play/Pause, Previous/Next, Replay, Reset, route refresh, presentation mode | Live project, OpenCode session, repository, provider |
| Live workshop (`/workshop`) | `UB_DATA_DIR/project.json` + OpenCode native sessions | Restart app, reconcile unknown run, restore previous snapshot | Demo fixture |

The demo and the workshop share components and schemas, but not state.

## Demo reset and isolation

`src/web/demo/playback.ts` is a pure reducer. The Reset action:

- sets the beat index to 0;
- stops playback;
- clears the inspected spirit tab;
- clears the completed flag;
- leaves the fixture object immutable;
- does not call `/api/*` or `fetch`.

The Playwright suite records requests during playback and asserts that no `/api/` or provider URL is contacted. `tests/demo.test.ts` asserts that reset returns the initial playback state and that the fixture source has no network/time/randomness/environment access.

### Route refresh

- `/demo` loads at beat 1, paused.
- `/demo?presentation=1` loads in the 90-second presentation mode at beat 1, playing.
- A refresh always re-reads the bundled fixture; it does not read a live project.
- The presentation query string is updated with `history.replaceState` when entering or leaving presentation mode.

### Reset in hosted-demo mode

The server also enforces isolation:

- every non-GET `/api/*` request returns `403 DEMO_READ_ONLY`;
- `/api/session` does not issue a token;
- `/api/project` and `/api/export` return the fixture;
- `/api/connection` returns a read-only `hosted-demo` status;
- `/api/opencode/*` is rejected.

Therefore Reset cannot reach a live mutation even if the client is modified. The server rejection is the authority.

## Live project recovery

The live project is stored by `AtomicProjectStore` under `UB_DATA_DIR`:

- `project.json` — current snapshot;
- `project.json.previous` — previous valid snapshot;
- corrupt originals are preserved;
- writes are atomic (temp file → rename);
- expected-revision checks reject stale writes.

Do not delete `UB_DATA_DIR` to troubleshoot a single request. Back it up before a deliberate reset or migration. The app does not expose a destructive reset endpoint.

### Unknown native runs

A run moves `QUEUED → RUNNING → WAITING_PERMISSION → SUCCEEDED/FAILED/CANCELLED/UNKNOWN`.

If the app restarts or the connection drops while a run is in flight:

1. the operation becomes `UNKNOWN`;
2. the app does not repeat the native action automatically;
3. inspect the native session reference and the Run Inspector;
4. use the explicit reconcile action only after confirming the native state;
5. a cancellation does not undo completed effects.

### OpenCode unavailable

If OpenCode is unreachable:

- the workshop keeps the saved section and project state;
- the engine badge reports the actual state;
- no model call is inferred;
- start OpenCode on loopback, then retry the connection check.

The app does not silently switch providers or use a paid fallback.

## Presentation-mode operations

- Enter with the “90s mode” button or `/demo?presentation=1`.
- Each of 10 beats lasts 9 seconds; total 90 seconds.
- The timer is deterministic and independent of network/provider availability.
- Pause/Resume still work; inspecting a spirit tab pauses playback.
- Exit returns to normal interactive mode without changing the fixture.

## Verification

```bash
npm run typecheck
npm test
npm run build
npm run budget
npm run test:visual
```

The demo-specific checks are in `tests/demo.test.ts` and `tests/visual/demo.spec.ts`:

- fixture/schema drift;
- full playback and completion;
- pause/resume/step/replay/reset;
- tab inspection;
- route refresh/presentation mode;
- 90-second timing;
- no network/inference/mutation requests;
- hosted-demo mutation rejection and live-state isolation;
- accessibility labels/live regions and narrow layout.
