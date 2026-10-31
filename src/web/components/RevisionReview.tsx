import { useState } from "react";
import { Check, GitCompareArrows, RotateCcw, Trash2 } from "lucide-react";
import { Markdown } from "./Markdown.tsx";
import { RevisionDiff, type DiffView } from "./RevisionDiff.tsx";

export interface PendingRevision {
  id: string;
  version: number;
  content: string;
  status: string;
  createdAt: string;
  baseVersion: number;
  summary: string;
  requestedChange: string;
}

/**
 * The review gate between generation and the current draft. Nothing here
 * approves a section; acceptance only replaces the draft and marks affected
 * approvals stale.
 */
export function RevisionReview({
  sectionTitle,
  currentContent,
  candidate,
  busy,
  onAccept,
  onReject,
  onRequestAnother,
}: {
  sectionTitle: string;
  currentContent: string;
  candidate: PendingRevision;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  onRequestAnother: () => void;
}) {
  const [tab, setTab] = useState<"changes" | "revision">("changes");
  const [view, setView] = useState<DiffView | undefined>(undefined);

  return (
    <section className="revision-review" aria-labelledby="revision-review-title">
      <div className="revision-review-head">
        <div>
          <p className="eyebrow">Proposed revision · not applied</p>
          <h3 id="revision-review-title">Review v{candidate.version} of {sectionTitle}</h3>
        </div>
        <span className="revision-badge">v{candidate.baseVersion} → v{candidate.version}</span>
      </div>
      <p className="revision-summary">{candidate.summary || "The Architect prepared a revision for review."}</p>
      {candidate.requestedChange ? (
        <p className="meta revision-request">Requested: {candidate.requestedChange}</p>
      ) : null}
      <div className="revision-tabs" role="tablist" aria-label="Revision review view">
        <button type="button" role="tab" aria-selected={tab === "changes"} className={tab === "changes" ? "is-active" : ""} onClick={() => setTab("changes")}>
          <GitCompareArrows size={15} aria-hidden="true" /> Changes
        </button>
        <button type="button" role="tab" aria-selected={tab === "revision"} className={tab === "revision" ? "is-active" : ""} onClick={() => setTab("revision")}>
          Full revision
        </button>
      </div>
      {tab === "changes" ? (
        <RevisionDiff before={currentContent} after={candidate.content} view={view} onViewChange={setView} />
      ) : (
        <div className="reading section-reading revision-preview">
          <Markdown content={candidate.content} />
        </div>
      )}
      <p className="meta">Accepting replaces the current draft. It does not approve the section; approval stays a separate exact-version action.</p>
      <div className="actions">
        <button className="action" type="button" disabled={busy} onClick={onAccept}>
          <Check size={15} aria-hidden="true" /> Accept revision
        </button>
        <button className="action secondary" type="button" disabled={busy} onClick={onRequestAnother}>
          <RotateCcw size={15} aria-hidden="true" /> Request another revision
        </button>
        <button className="action ghost" type="button" disabled={busy} onClick={onReject}>
          <Trash2 size={15} aria-hidden="true" /> Discard
        </button>
      </div>
    </section>
  );
}
