import type { WorkshopProject } from "../api.ts";
import { EmptyState } from "./SectionCard.tsx";
import { StatusChip } from "./StatusChip.tsx";

type Operation = WorkshopProject["operations"][number];
type Evidence = WorkshopProject["evidence"][number];
type Capability = WorkshopProject["capabilities"][number];

interface RunInspectorProps {
  operations: Operation[];
  evidence: Evidence[];
  capabilities: Capability[];
  onReconcile?: (operationId: string) => void;
  busy?: boolean;
  eyebrow?: string;
  title?: string;
  note?: string;
}

export function RunInspector({
  operations,
  evidence,
  capabilities,
  onReconcile,
  busy = false,
  eyebrow = "OpenCode evidence",
  title = "Run Inspector",
  note = "Only observed native results are recorded. A missing result stays missing.",
}: RunInspectorProps) {
  const latest = [...operations].reverse();
  const unknown = latest.find((operation) => operation.status === "UNKNOWN");
  return (
    <section className="run-inspector" aria-labelledby="run-inspector-title" data-testid="run-inspector">
      <header className="inspector-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 id="run-inspector-title">{title}</h2>
        </div>
        <span className="inspector-badge">Read-only view</span>
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
                <p className="run-session meta">
                  {operation.nativeSessionId ? `Native session ${trimSession(operation.nativeSessionId)}` : "No native session reference"}
                  {operation.model ? ` · ${operation.model.providerID}/${operation.model.id}${operation.model.variant ? `#${operation.model.variant}` : ""}` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
        {unknown && onReconcile ? (
          <div className="inspector-recovery">
            <p>A run ended without a recorded outcome. Reconcile the native session before retrying; it will not be repeated automatically.</p>
            <button className="action secondary" type="button" disabled={busy} onClick={() => onReconcile(unknown.id)}>
              Reconcile native session
            </button>
          </div>
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

function trimSession(id: string): string {
  return id.length > 18 ? `${id.slice(0, 10)}…${id.slice(-5)}` : id;
}
