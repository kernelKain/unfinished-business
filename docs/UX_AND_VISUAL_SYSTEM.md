# UX and visual system

The workshop is a readable document in a haunted room. Security/recovery messaging must be specific, calm, and never imply that work happened when it did not.

## Modes and demo boundary

The document header shows a persistent status line:

- **Local mode · isolated demo workspace.** Execution is limited to that workspace; there is no arbitrary repository or remote connector.
- **hosted-demo mode · isolated demo workspace.** Same boundary, with hosted access controls.
- **private-hosted mode · isolated demo workspace.** Same boundary, privately operated.

The line also shows the effective Maker timeout and per-session token budget. The tool-call limitation is stated explicitly: *Tool-call counts are unavailable from OpenCode, so elapsed-time and token budgets apply.* Do not invent a tool-call number.

## Recovery messages

| State | Message | Actions |
|---|---|---|
| Engine unavailable | OpenCode is not reachable / rejected credentials / incompatible version | Start or repair OpenCode; retry manually. No paid model is used. |
| Model unavailable | The required free DeepSeek model is not available. No substitute or paid model will be used. | Restore the native model route; do not add a paid fallback. |
| Unknown native outcome | A native run has an unknown outcome and was not repeated. | **Reconcile native session**; inspect before another run. |
| Still running | A native run is still running. It was not started again. | Reconcile after it settles; no duplicate start. |
| Permission pending | A native permission is pending. Resolve it in OpenCode; it was not approved automatically. | Resolve in OpenCode, then reconcile. |
| Rate limited | Too many requests. Wait briefly, then try again. | Retry after the indicated wait. |
| Busy | Another workshop action is still running. Wait for it to finish. | Wait; do not double-click. |
| Stale section | An upstream change marked this section stale. Review it again before approval counts. | Review/revise/reapprove the current section. |
| Duplicate action | The same action returned its existing result. | No second click is needed. |
| Corrupt state | State is preserved but could not be loaded. The saved state was not silently replaced. | Operator restores/repairs; see operations doc. |
| Disk full / read-only | The saved state was not replaced. | Free space/fix mount; retry. |
| Slow response | This is taking longer than usual. The saved section is unchanged until a response arrives. | Wait; do not assume success. |
| Failed check | Evidence shows FAIL; the run is not a pass. | Inspect output; fix the demo work; run again under a new action. |

Errors that include a retryable flag may be retried manually. Errors that are not retryable must not be retried automatically. The UI appends a short operation reference when available; logs/bug reports use that reference, never credentials.

## Privacy messaging

- Witness notes are explicitly **in-app review notes**, not a submitted article/video/entry.
- Exports contain the approved plan and drafts only; they are redacted and exclude native transcripts, secrets, and the workspace path.
- Telemetry is optional. When enabled, prompts, tool arguments/results, headers, cookies, bodies, query strings, user identity, and local paths are excluded. `UB_REDACT_PROMPTS=true` additionally removes transcript prompt text from stored transcript entries.
- Local mode is a trusted-developer tool; the machine user can read the data directory and OpenCode credentials.

## Visual tokens and layout

- Background `#111018`, surface `#1B1824`, raised `#252031`, text `#F4F0E8`, muted `#B8AFCA`, warm `#F4B66C`, spirit `#BFA3FF`, success `#8BD5A7`.
- System sans for work text; restrained serif headings; monospace for evidence/IDs.
- Spacing scale 4/8/12/16/24/32 px.
- At ~390 px the side panels stack; the reading column stays central on desktop.
- `prefers-reduced-motion` disables ambient transforms; the approval seal still appears without animation.
- Keyboard focus, labels, `aria-busy`, `role="status"`/`role="alert"`, and a skip link are required. Errors use text, not color alone.
- The banner styles are used for mode/limits, recovery, and privacy; avoid stacking multiple contradictory banners. The current section/revision text is never overwritten by a partial stream.

## State coverage

Empty, generating, slow, awaiting approval, revision, native permission, malformed response, provider failure, failed check, unknown run, stale approval, corrupt state, rate/busy, and success all have explicit copy. Fixture/live responses share schemas; fixtures cannot establish execution or sponsor proof.
