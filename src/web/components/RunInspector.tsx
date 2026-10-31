import { useState } from "react";
import type { WorkshopProject } from "../api.ts";
import { EmptyState } from "./SectionCard.tsx";
import { StatusChip } from "./StatusChip.tsx";

type Operation = WorkshopProject["operations"][number];
type Evidence = WorkshopProject["evidence"][number];
type Capability = WorkshopProject["capabilities"][number];

const TERMINAL_STATUSES = new Set(["SUCCEEDED", "FAILED", "CANCELLED"]);

const phaseLabels: Record<string, string> = {
  CONNECTING: "connecting",
  SESSION_CREATED: "session created",
  WAITING_FOR_MODEL: "waiting for the model",
  RECEIVING_OUTPUT: "receiving output",
  VALIDATING_RESULT: "validating result",
  WAITING_PERMISSION: "waiting for permission",
  APPLYING_RESULT: "applying result",
  RUNNING_CHECKS: "running checks",
  AWAITING_RECONCILIATION: "awaiting reconciliation",
};

const roleLabels: Record<string, string> = {
  maker: "Maker",
  witness: "Witness",
  guide: "OpenCode",
};

interface RunInspectorProps {
  operations: Operation[];
  evidence: Evidence[];
  capabilities: Capability[];
  onReconcile?: (operationId: string) => void;
  onCancel?: (operationId: string) => void;
  onRetry?: (operationId: string) => void;
  onAbandon?: (operationId: string) => void;
  onOpenOpenCode?: () => void;
  busy?: boolean;
  eyebrow?: string;
  title?: string;
  note?: string;
  sourceLabel?: string;
  /** The recorded sample renders the same read-only evidence without live controls. */
  demo?: boolean;
}

export function RunInspector({
  operations,
  evidence,
  capabilities,
  onReconcile,
  onCancel,
  onRetry,
  onAbandon,
  onOpenOpenCode,
  busy = false,
  eyebrow = "OpenCode activity",
  title = "Activity & results",
  note = "Only observed native results are recorded. A missing result stays missing.",
  sourceLabel,
  demo = false,
}: RunInspectorProps) {
  const [dismissedRecoveryId, setDismissedRecoveryId] = useState<string | null>(null);
  const latest = [...operations].reverse();
  const outstanding = latest.find((operation) => !TERMINAL_STATUSES.has(operation.status));
  const abandoned = latest.find((operation) => operation.status === "ABANDONED");
  const recoveryTarget = demo
    ? abandoned
    : outstanding?.id === dismissedRecoveryId ? null : outstanding;
  const latestOperation = latest[0] ?? null;
  const changes = latest.filter((operation) => operation.kind === "maker" && operation.result);
  const hasTechnical = operations.length > 0 || evidence.length > 0 || capabilities.length > 0;

  return (
    <section className="run-inspector" aria-labelledby="run-inspector-title" data-testid="run-inspector" data-demo={demo ? "true" : undefined}>
      <header className="inspector-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 id="run-inspector-title">{title}</h2>
        </div>
        <div className="inspector-badges">
          {sourceLabel ? <span className="inspector-source">{sourceLabel}</span> : null}
          <span className="inspector-badge">Read-only view</span>
        </div>
      </header>
      <p className="inspector-note">{note}</p>

      <div className="activity-grid">
        <section className="inspector-block activity-section" aria-labelledby="activity-progress-title">
          <h3 id="activity-progress-title">Progress</h3>
          {latestOperation ? (
            <>
              <div className="activity-summary">
                <div className="run-row-head">
                  <span className="meta">{roleLabels[latestOperation.kind] ?? latestOperation.kind}</span>
                  <StatusChip status={latestOperation.status} />
                </div>
                <p className="run-result">{latestOperation.result ?? "No native result recorded."}</p>
                {latestOperation.progress?.phase ? (
                  <p className="run-session meta" data-testid="run-progress">
                    Progress: {phaseLabels[latestOperation.progress.phase] ?? latestOperation.progress.phase.toLowerCase()}
                    {latestOperation.progress.detail && !demo ? ` — ${latestOperation.progress.detail}` : ""}
                  </p>
                ) : null}
              </div>
              {latest.length > 1 ? (
                <ol className="run-list compact-run-list">
                  {latest.slice(1, 4).map((operation) => (
                    <li key={operation.id} className="run-row" data-status={operation.status}>
                      <div className="run-row-head">
                        <span className="meta">{roleLabels[operation.kind] ?? operation.kind}</span>
                        <StatusChip status={operation.status} />
                      </div>
                      <p className="run-session meta">Recorded {operation.finishedAt ? new Date(operation.finishedAt).toLocaleString() : "while running"}.</p>
                    </li>
                  ))}
                </ol>
              ) : null}
              {demo && abandoned && onReconcile ? (
                <div className="inspector-recovery" data-testid="inspector-recovery">
                  <p>A run ended without a recorded outcome. Reconcile the native session before retrying; it will not be repeated automatically.</p>
                  <button className="action secondary" type="button" disabled={busy} onClick={() => onReconcile(abandoned.id)}>
                    Reconcile native session
                  </button>
                </div>
              ) : null}
              {!demo && recoveryTarget && (onReconcile || onCancel || onRetry || onAbandon) ? (
                <RecoveryControls
                  operation={recoveryTarget}
                  busy={busy}
                  onReconcile={onReconcile}
                  onCancel={onCancel}
                  onRetry={onRetry}
                  onAbandon={onAbandon}
                  onOpenOpenCode={onOpenOpenCode}
                  onDismiss={() => setDismissedRecoveryId(recoveryTarget.id)}
                />
              ) : null}
            </>
          ) : (
            <EmptyState title="No native run yet">
              Maker has not started an OpenCode session. Empty is the honest state.
            </EmptyState>
          )}
        </section>

        <section className="inspector-block activity-section" aria-labelledby="activity-changes-title">
          <h3 id="activity-changes-title">Changes</h3>
          {changes.length ? (
            <ol className="run-list">
              {changes.slice(0, 4).map((operation) => (
                <li key={operation.id} className="run-row" data-status={operation.status}>
                  <div className="run-row-head">
                    <span className="meta">{roleLabels[operation.kind] ?? operation.kind}</span>
                    <StatusChip status={operation.status} />
                  </div>
                  <p className="run-result">{changeSummary(operation.result)}</p>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="No file changes observed">
              A diff appears here only after OpenCode reports one. A missing diff is not a successful build.
            </EmptyState>
          )}
        </section>

        <section className="inspector-block activity-section" aria-labelledby="activity-checks-title">
          <h3 id="activity-checks-title">Checks</h3>
          {evidence.length ? (
            <ul className="evidence-list">
              {evidence.slice(0, 6).map((item) => (
                <li key={item.id} className="evidence-row">
                  <div className="run-row-head">
                    <span className="evidence-check">{item.checkId}</span>
                    <StatusChip status={item.result} />
                  </div>
                  <p className="run-result">{item.result === "PASS" ? "Observed passing result." : item.limitation ?? "No limitation recorded."}</p>
                  {item.limitation && item.result === "PASS" ? <p className="run-limitation">{item.limitation}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No check observed">
              A check appears here only after its native result is read.
            </EmptyState>
          )}
        </section>
      </div>

      {hasTechnical ? (
        <details className="technical-details">
          <summary>Technical details</summary>
          <div className="technical-grid">
            <div>
              <h4>Native references</h4>
              {operations.length ? (
                <ul className="technical-list">
                  {operations.slice().reverse().slice(0, 8).map((operation) => (
                    <li key={operation.id}>
                      <strong>{roleLabels[operation.kind] ?? operation.kind}</strong>
                      <span>{operation.nativeSessionId ?? "no session reference"}</span>
                      <span>{operation.nativeMessageId ?? "no message reference"}</span>
                      {operation.model ? <span>{operation.model.providerID}/{operation.model.id}{operation.model.variant ? `#${operation.model.variant}` : ""}</span> : null}
                      {operation.agent ? <span>agent {operation.agent}</span> : null}
                      {operation.intent ? <span>intent {operation.intent}</span> : null}
                      {operation.retryOf ? <span>retry of {operation.retryOf}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : <p className="meta">No native reference is recorded.</p>}
            </div>

            <div>
              <h4>Capability mappings</h4>
              {capabilities.length ? (
                <ul className="technical-list">
                  {capabilities.map((capability) => (
                    <li key={capability.id}>
                      <strong>{capability.id}</strong>
                      <span>{capability.nativeMapping}</span>
                      <span>{capability.permission}</span>
                      <span>{capability.observedOutcome ?? "not observed"}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="meta">No capability mapping is available.</p>}
            </div>

            <div>
              <h4>Raw evidence</h4>
              {evidence.length ? (
                <ul className="technical-list">
                  {evidence.map((item) => (
                    <li key={item.id}>
                      <strong>{item.checkId}</strong>
                      <span>{item.nativeResultReference}</span>
                      <span>fingerprint {item.testedFingerprint}</span>
                      <span>{item.observedAt}</span>
                      {item.model ? <span>{item.model.providerID}/{item.model.id}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : <p className="meta">No raw evidence row is recorded.</p>}
            </div>

            <div>
              <h4>Provider payloads</h4>
              {operations.some((operation) => operation.providerError) ? (
                <ul className="technical-list">
                  {operations.filter((operation) => operation.providerError).map((operation) => (
                    <li key={operation.id}>
                      <strong>{operation.providerError?.category}</strong>
                      <span>{operation.providerError?.technical.provider} · status {operation.providerError?.technical.statusCode ?? "unknown"} · code {operation.providerError?.technical.providerCode ?? "none"}</span>
                      <span>diagnostic {operation.providerError?.technical.diagnosticReference}</span>
                      <span>{operation.providerError?.technical.safeDetail}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="meta">No provider error payload is recorded.</p>}
            </div>
          </div>
          <p className="inspector-footnote">
            Workflow approval is not tool permission. OpenCode remains the authority for native tool decisions.
          </p>
        </details>
      ) : null}
    </section>
  );
}

function RecoveryControls({
  operation,
  busy,
  onReconcile,
  onCancel,
  onRetry,
  onAbandon,
  onOpenOpenCode,
  onDismiss,
}: {
  operation: Operation;
  busy: boolean;
  onReconcile?: (operationId: string) => void;
  onCancel?: (operationId: string) => void;
  onRetry?: (operationId: string) => void;
  onAbandon?: (operationId: string) => void;
  onOpenOpenCode?: () => void;
  onDismiss: () => void;
}) {
  const isRunning = operation.status === "RUNNING" || operation.status === "QUEUED";
  const heading = operation.status === "WAITING_PERMISSION"
    ? "A native permission is pending. Resolve it in OpenCode, then reconcile."
    : operation.status === "COMPLETED_UNAPPLIED"
      ? "A validated late result is waiting to be reconciled and applied once."
      : operation.status === "ABANDONED"
        ? "A run was abandoned without a confirmed outcome. Reconcile to recover it, or mark it abandoned."
        : `${roleLabels[operation.kind] ?? "OpenCode"} is working.`;
  return (
    <div className="inspector-recovery" data-testid="inspector-recovery">
      <p>
        <strong>{heading}</strong>
      </p>
      <p className="meta">
        {isRunning
          ? `Elapsed ${formatElapsed(operation.startedAt)}${operation.progress?.phase ? ` · ${phaseLabels[operation.progress.phase] ?? operation.progress.phase.toLowerCase()}` : ""}. A timed-out run never blocks the saved plan; reconcile, cancel, or keep waiting.`
          : "Reconciliation retrieves and validates the native session's actual late result before applying it once."}
      </p>
      <div className="inspector-recovery-actions">
        {onReconcile ? (
          <button className="action secondary" type="button" disabled={busy} onClick={() => onReconcile(operation.id)}>
            Reconcile now
          </button>
        ) : null}
        <button className="action ghost" type="button" disabled={busy} onClick={onDismiss}>
          Continue waiting
        </button>
        {onOpenOpenCode ? (
          <button className="action secondary" type="button" onClick={onOpenOpenCode}>
            Open in OpenCode
          </button>
        ) : null}
        {isRunning && onCancel ? (
          <button className="action danger" type="button" disabled={busy} onClick={() => onCancel(operation.id)}>
            Cancel
          </button>
        ) : null}
        {operation.status === "FAILED" && onRetry ? (
          <button className="action secondary" type="button" disabled={busy} onClick={() => onRetry(operation.id)}>
            Retry after failure
          </button>
        ) : null}
        {(operation.status === "COMPLETED_UNAPPLIED" || operation.status === "WAITING_PERMISSION" || operation.status === "ABANDONED") && onAbandon ? (
          <button className="action ghost" type="button" disabled={busy} onClick={() => onAbandon(operation.id)}>
            Mark abandoned
          </button>
        ) : null}
      </div>
    </div>
  );
}

function formatElapsed(startedAt: string | null | undefined): string {
  if (!startedAt) return "an unknown time";
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) return "an unknown time";
  const seconds = Math.max(0, Math.round((Date.now() - started) / 1000));
  if (seconds < 90) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/** Keeps the change summary in Changes and the check output in Checks. */
function changeSummary(result: string | null): string {
  if (!result) return "No change summary recorded.";
  return result.split(/\n{2}Node check exit|\nNode check exit/)[0]?.trim() || "No change summary recorded.";
}
