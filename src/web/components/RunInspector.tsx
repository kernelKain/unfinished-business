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
  /** The deterministic demo renders the same read-only evidence without live controls. */
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
  eyebrow = "OpenCode evidence",
  title = "Run Inspector",
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

      <div className="inspector-block">
        <h3>Native runs</h3>
        {latest.length === 0 ? (
          <EmptyState title="No native run yet">
            Maker has not started an OpenCode session. Empty is the honest state.
          </EmptyState>
        ) : (
          <ol className="run-list">
            {latest.slice(0, 6).map((operation) => (
              <li key={operation.id} className="run-row" data-status={operation.status}>
                <div className="run-row-head">
                  <span className="meta">{operation.kind}</span>
                  <StatusChip status={operation.status} />
                </div>
                <p className="run-result">{operation.result ?? "No native result recorded."}</p>
                {operation.progress?.phase ? (
                  <p className="run-session meta" data-testid="run-progress">
                    Progress: {phaseLabels[operation.progress.phase] ?? operation.progress.phase.toLowerCase()}
                    {operation.progress.detail && !demo ? ` — ${operation.progress.detail}` : ""}
                  </p>
                ) : null}
                <p className="run-session meta">
                  {operation.nativeSessionId ? `Native session ${trimSession(operation.nativeSessionId)}` : "No native session reference"}
                  {operation.model ? ` · ${operation.model.providerID}/${operation.model.id}${operation.model.variant ? `#${operation.model.variant}` : ""}` : ""}
                </p>
                {operation.providerError ? (
                  <p className="run-provider-error">
                    <strong>{operation.providerError.category.replaceAll("_", " ")}</strong>
                    {" · "}
                    {operation.providerError.savedWorkChanged === "no" ? "Saved work unchanged." : "Saved work may have changed."}
                    {" "}
                    Diagnostic {operation.providerError.technical.diagnosticReference}.
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
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
      </div>

      <div className="inspector-block">
        <h3>Evidence ledger</h3>
        {evidence.length === 0 ? (
          <EmptyState title="No check observed">
            A check appears here only after its native result is read.
          </EmptyState>
        ) : (
          <ul className="evidence-list">
            {evidence.slice(0, 6).map((item) => (
              <li key={item.id} className="evidence-row">
                <div className="run-row-head">
                  <span className="evidence-check">{item.checkId}</span>
                  <StatusChip status={item.result} />
                </div>
                <p className="run-result">{item.result === "PASS" ? "Observed passing result." : item.limitation ?? "No limitation recorded."}</p>
                {item.limitation && item.result === "PASS" ? <p className="run-limitation">{item.limitation}</p> : null}
                {item.model ? <p className="run-session meta">Model {item.model.providerID}/{item.model.id}{item.model.variant ? `#${item.model.variant}` : ""}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="inspector-block">
        <h3>Permissions and capability boundary</h3>
        {capabilities.length === 0 ? (
          <p className="meta">No capability metadata is available.</p>
        ) : (
          <ul className="permission-list">
            {capabilities.map((capability) => (
              <li key={capability.id}>
                <span className="permission-name">{capability.purpose}</span>
                <span className="permission-detail">{capability.permission}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="inspector-footnote">
          Workflow approval is not tool permission. OpenCode remains the authority for native tool decisions.
        </p>
      </div>
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

function trimSession(id: string): string {
  return id.length > 18 ? `${id.slice(0, 10)}…${id.slice(-5)}` : id;
}
