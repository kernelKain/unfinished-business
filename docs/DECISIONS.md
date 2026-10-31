# Decisions

Current decisions for the OpenCode connection, discovery, and supported-control phase. Older decisions remain in the [engineering blueprint](ENGINEERING_BLUEPRINT.md) and idea packet as historical records.

## D-20 — OpenCode remains the only coding harness

**Decision.** The application does not add a second agent loop, provider client, tool executor, or command runner. It calls the OpenCode server through the exact `@opencode/client` version and keeps product roles as adapters.

**Reason.** The product value is the workshop, staged approvals, and evidence. Rebuilding execution would duplicate permission and recovery logic.

## D-21 — Discovery replaces the fixed DeepSeek assumption

**Decision.** Models, providers, limits, modalities, tool support, reasoning variants, and availability come from the OpenCode catalog. The project stores the chosen model and each operation/evidence row records the model used.

**Reason.** A fixed model becomes wrong when a catalog changes, a provider is removed, or a user chooses another supported model. The fixed identity remains only as a migration hint.

**Consequences.** A user must choose a model when the catalog has one. If the saved model disappears, the app reports `MODEL_UNAVAILABLE` and does not silently substitute.

## D-22 — Variants are model-reported, never a universal scale

**Decision.** Only variant IDs returned for the selected model are selectable. “Model default” means no explicit variant. The app does not invent low/medium/high for a model that does not report them.

**Reason.** OpenCode documents that variant names come from the selected model's current catalog metadata and unknown variants fail model resolution.

## D-23 — Provider keys never enter Unfinished Business

**Decision.** The application has no provider-key field, route, log field, browser storage key, project field, or export field. The only credential it accepts is the OpenCode server Basic-auth password.

**Reason.** OpenCode owns provider authentication. Duplicating it creates a second secret store and a new leak surface.

**Consequences.** The wizard asks only for the server password. Unknown credential-shaped request fields are rejected. Hosted deployments configure provider accounts inside OpenCode or its environment.

## D-24 — The OpenCode server password is memory-only in the wizard

**Decision.** A password entered in the wizard is held in the application process. `connection.json` stores URL, auth mode, username, and a “password previously configured” flag, never the password. Non-interactive deployments use `OPENCODE_PASSWORD` from their secret store.

**Reason.** It avoids a new on-disk secret format while keeping local first-run usable. A restart can require re-entry; that is an honest state, not a silent auth failure.

**Consequences.** After a restart without `OPENCODE_PASSWORD`, the next check returns `authentication_required`. The UI says the process no longer holds the password.

## D-25 — Connection checks are read-only

**Decision.** A check calls `/api/info`, catalogs, agents, permissions, commands, skills, MCP, and config. It does not prompt a model, edit a session, or change provider state. The live diagnostic may create/get/remove one empty session; it never prompts.

**Reason.** “Connected” must not imply inference succeeded or a paid request occurred.

## D-26 — Remote URLs require HTTPS; loopback may use HTTP

**Decision.** `http://` is limited to `localhost`, `127.0.0.1`, and `::1`. Other hosts must be `https://`. Credentials in a URL are rejected.

**Reason.** A server password over plaintext remote HTTP is unacceptable. The app connects server-side, so browser CORS is not a reason to weaken this rule.

## D-27 — Session actions are project-scoped

**Decision.** The session API lists and acts only on sessions referenced by the active project. It does not enumerate every OpenCode session. Fork/compact/revert/interrupt require that ownership check.

**Reason.** A shared OpenCode instance may contain other projects' sessions. A browser control must not become a cross-project administration surface.

## D-28 — Maker runs are asynchronous and persisted

**Decision.** `POST /api/runs` returns `202` after persisting a `QUEUED` operation and starting the in-process runner. Completion is written against the latest project revision. A restart converts in-flight runs to `UNKNOWN`; cancellation cannot be overwritten by a late completion.

**Reason.** The Phase 1 prerequisite required a non-blocking, non-lossy run model. Holding an HTTP request for a multi-minute model turn loses the request on a proxy timeout and hides progress.

## D-29 — Unsupported controls are deferred visibly

**Decision.** The installed version's gaps are rendered as deferred with a reason. In `2.0.32`: no separate HTTP tool catalog; no provider quota; formatter/LSP is configuration presence only; fork requires a non-empty session.

**Reason.** “Not supported” is a product state, not a reason to guess an endpoint or fabricate a capability.

## D-30 — Deployment modes are explicit

**Decision.** `local`, `hosted-private`, and `hosted-demo` have different connection-edit and credential rules. Hosted modes manage the connection through environment/secret stores and expose read-only connection UI. The public demo never asks visitors for provider keys.

**Reason.** A shared hosted instance must not turn a browser visitor into the owner of the OpenCode server or provider account.

## D-31 — Version policy is major-compatible with tested-patch warnings

**Decision.** Accept OpenCode major 2; warn/degrade on a patch other than `2.0.32`; reject other majors. Record the tested version in the integration document and expose it through the live diagnostic.

**Reason.** The HTTP contract is versioned by major, but optional fields and controls can drift within a major. A warning is more honest than claiming untested compatibility.
