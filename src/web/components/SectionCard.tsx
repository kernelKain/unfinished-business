import type { WorkshopProject } from "../api.ts";
import { StatusChip } from "./StatusChip.tsx";

export function SectionCard({
  section,
  current,
  selected,
  onSelect,
}: {
  section: WorkshopProject["sections"][number];
  current: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const pending = section.candidateRevisions.some((candidate) => candidate.status === "PENDING");
  return (
    <li className="section-card" data-status={section.status} data-current={current ? "true" : undefined} data-selected={selected ? "true" : undefined}>
      <button className="section-select" type="button" onClick={onSelect} aria-current={selected ? "true" : undefined}>
        <span className="section-order" aria-hidden="true">{String(section.order).padStart(2, "0")}</span>
        <span className="section-copy">
          <span className="section-title">{section.title}</span>
          <span className="section-meta">
            <StatusChip status={section.status} />
            <span className="meta">v{section.version}</span>
            {pending ? <span className="section-pending">Proposed v{section.version + 1}</span> : null}
          </span>
        </span>
        {current ? <span className="section-flag">Current</span> : null}
      </button>
    </li>
  );
}

export function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-glyph" aria-hidden="true" />
      <p className="empty-title">{title}</p>
      <p>{children}</p>
    </div>
  );
}
