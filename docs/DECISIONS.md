# Decisions

## ADR-001 — Explicit runtime modes

**Decision:** `local`, `hosted-demo`, and `private-hosted` are selected by `UB_MODE`, with `RENDER`/`NODE_ENV` fallbacks. Local mode refuses non-loopback listeners; hosted modes require Basic Auth, a session token, and an explicit public URL.

**Why:** Security controls must match the deployment shape. A single generic checklist would either expose local mode or over-constrain the Render demo.

**Consequence:** Misconfiguration fails closed at startup with a readable `ConfigError`; no silent public/loopback downgrade.

## ADR-002 — Demo workspace is the only execution root

**Decision:** Maker and the Node check run only in `UB_DATA_DIR/demo-workspace`. Spirit sessions use an intentionally empty `spirit-workspace`. No workspace path is accepted from the browser.

**Why:** Prevent repository edits, traversal, and arbitrary host execution without building a second sandbox.

**Consequence:** This is not OS isolation; a malicious demo dependency is still a shared-host risk.

## ADR-003 — Canonical paths and static containment

**Decision:** All configured roots are created/resolved, checked against broad-root policy, and contained with `realpath`. Static requests reject traversal/symlink escape and only serve regular files from the built web root.

**Why:** Path traversal and symlink escape are the highest-impact local-file risks.

## ADR-004 — Loopback OpenCode + explicit remote allowlist

**Decision:** Default to loopback HTTP. Remote targets require HTTPS, an exact host allowlist, DNS/IP classification, no redirects, timeouts, and response-size limits. The insecure-remote exception exists only for local development.

**Why:** Prevent SSRF, DNS rebinding, metadata-service access, and uncontrolled body/time consumption.

## ADR-005 — Revalidate DNS on every request

**Decision:** The injected safe fetch resolves/checks the target on every request instead of caching policy decisions.

**Why:** A one-time check is vulnerable to DNS rebinding. The cost is acceptable for a single-user demo.

## ADR-006 — Session token + Basic Auth + Origin/CSRF policy

**Decision:** Hosted modes require Basic Auth; all state/mutation/SSE routes require a constant-time session token; Origin and `Sec-Fetch-Site` are checked; mutations require JSON; bodies are capped; rate and concurrency gates return 429.

**Why:** The app has no cookie session, so a custom header provides CSRF resistance. Basic Auth is the hosted identity gate.

**Consequence:** CLI clients must first obtain the loopback token; EventSource cannot send the header, so the UI polls and the SSE route is for fetch-based clients.

## ADR-007 — Serialized workflow + action idempotency

**Decision:** The full load → external native call → save sequence holds one async lock. Action IDs are unique, payload-hash checked, and retained for a bounded window.

**Why:** Prevent revision races and duplicate side effects.

**Consequence:** Concurrent mutations return 429 or wait briefly; an action older than the retention window can be replayed with a new ID.

## ADR-008 — Native uncertainty is `UNKNOWN`, never retried

**Decision:** Timeouts/disconnects/in-flight restarts become `UNKNOWN`; reconciliation reads native state; the app never automatically repeats a prompt/edit/check. Cancellation tries native interrupt and refuses to mark cancelled if interruption fails.

**Why:** A timeout does not prove the side effect did not happen.

## ADR-009 — Atomic store with corrupt preservation and schema v2

**Decision:** Temp write + fsync + rename, `.previous`, rolling backups, lock file, corrupt quarantine, explicit migrations, and refusal of newer schema versions. No reset endpoint.

**Why:** Approvals/evidence are the product; silently resetting is worse than a visible recovery state.

**Consequence:** Operators must restore backups or repair files; the app will stay in `STATE_CORRUPT` rather than start empty.

## ADR-010 — Centralized redaction and metadata-only telemetry

**Decision:** Redact at persistence, exports, errors, logs, and Sentry callbacks independently. Sentry data collection is disabled; prompts/tool data/user identity are never sent. `UB_REDACT_PROMPTS` can additionally blank transcript prompt text.

**Why:** A single redaction layer is easy to bypass; independent tests catch regressions.

## ADR-011 — Honest budgets

**Decision:** Enforce elapsed time, session tokens, and cost where OpenCode exposes reliable data. Expose `toolCallBudget: null` with the provider-data limitation. Do not claim quota enforcement.

**Why:** The provider/OpenCode contract does not expose a reliable per-session tool-call/quota fact in this build.

## ADR-012 — Dependency audit deferral

**Decision:** Keep Sentry 11.10.x and accept the moderate `glob`/`minimatch` advisory until a compatible fix exists. The vulnerable path is the Vite bundler plugin at build time, not the runtime server path. The npm-suggested fix is a major Sentry downgrade.

**Why:** Downgrading the telemetry SDK across a major version is riskier and unverified for this release. The issue must be rechecked before the next dependency refresh.

## ADR-013 — No remote connector or multi-tenant isolation in this phase

**Decision:** Defer arbitrary repository connectors, MCP/plugin installation, and shared-host isolation. Keep one active project and one demo workspace.

**Why:** These are product changes with large security scope, not hardening of the completed workflow. They are recorded as residual risks rather than implied capabilities.
