const positive = new Set(["PASS", "SUCCEEDED", "APPROVED", "GRANTED", "AVAILABLE", "COMPLETE"]);
const active = new Set(["RUNNING", "QUEUED", "BUILDING", "DRAFT", "LISTENING", "DRAWING", "SCANNING"]);
const warning = new Set(["WAITING_PERMISSION", "COMPLETED_UNAPPLIED", "ABANDONED", "NOT_RUN", "INCONCLUSIVE", "STALE", "PROPOSED", "PAUSED"]);
const danger = new Set(["FAIL", "FAILED", "BLOCKED", "CANCELLED", "REFUSED"]);

export type StatusTone = "positive" | "active" | "warning" | "danger" | "neutral";

export function statusTone(status: string): StatusTone {
  const normalized = status.toUpperCase();
  if (positive.has(normalized)) return "positive";
  if (active.has(normalized)) return "active";
  if (warning.has(normalized)) return "warning";
  if (danger.has(normalized)) return "danger";
  return "neutral";
}

export function statusText(status: string): string {
  return status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

export function StatusChip({ status, label }: { status: string; label?: string }) {
  const tone = statusTone(status);
  return (
    <span className="status-chip" data-tone={tone} data-status={status}>
      <span className="status-dot" aria-hidden="true" />
      {label ?? statusText(status)}
    </span>
  );
}
