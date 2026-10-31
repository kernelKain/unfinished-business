import { useEffect, useMemo, useState } from "react";
import {
  buildSideBySideRows,
  buildUnifiedHunks,
  computeLineDiff,
  summarizeDiff,
} from "../../shared/diff.ts";

export type DiffView = "unified" | "side-by-side";

function defaultView(): DiffView {
  if (typeof window === "undefined") return "unified";
  return window.matchMedia("(min-width: 900px)").matches ? "side-by-side" : "unified";
}

/**
 * Review surface for one proposed section revision. The default view follows
 * the available width; both views are always available through the toggle.
 */
export function RevisionDiff({
  before,
  after,
  view,
  onViewChange,
}: {
  before: string;
  after: string;
  view?: DiffView;
  onViewChange?: (view: DiffView) => void;
}) {
  const [localView, setLocalView] = useState<DiffView>(() => defaultView());
  const selected = view ?? localView;
  const lines = useMemo(() => computeLineDiff(before, after), [before, after]);
  const hunks = useMemo(() => buildUnifiedHunks(lines), [lines]);
  const rows = useMemo(() => buildSideBySideRows(hunks), [hunks]);
  const stats = useMemo(() => summarizeDiff(lines), [lines]);

  useEffect(() => {
    if (view !== undefined) return;
    const query = window.matchMedia("(min-width: 900px)");
    const listener = () => setLocalView(query.matches ? "side-by-side" : "unified");
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, [view]);

  const choose = (next: DiffView) => {
    if (onViewChange) onViewChange(next);
    else setLocalView(next);
  };

  return (
    <div className="revision-diff">
      <div className="diff-toolbar">
        <div className="diff-stats" aria-label="Diff summary">
          <span className="diff-added">+{stats.added}</span>
          <span className="diff-removed">−{stats.removed}</span>
          <span className="meta">{stats.unchanged} unchanged</span>
        </div>
        <div className="diff-toggle" role="group" aria-label="Diff layout">
          <button type="button" className={selected === "unified" ? "is-active" : ""} aria-pressed={selected === "unified"} onClick={() => choose("unified")}>Unified</button>
          <button type="button" className={selected === "side-by-side" ? "is-active" : ""} aria-pressed={selected === "side-by-side"} onClick={() => choose("side-by-side")}>Side by side</button>
        </div>
      </div>
      {hunks.length === 0 ? (
        <p className="meta">The proposed revision is identical to the current draft.</p>
      ) : selected === "unified" ? (
        <div className="diff-unified" role="table" aria-label="Unified diff">
          {hunks.map((hunk, hunkIndex) => (
            <div className="diff-hunk" key={`hunk-${hunkIndex}`} role="rowgroup">
              <div className="diff-hunk-head" role="row">
                <span>@@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@</span>
              </div>
              {hunk.lines.map((line, lineIndex) => (
                <div className={`diff-line ${line.type}`} key={`line-${hunkIndex}-${lineIndex}`} role="row">
                  <span className="diff-gutter" aria-hidden="true">{line.oldLine ?? ""}</span>
                  <span className="diff-gutter" aria-hidden="true">{line.newLine ?? ""}</span>
                  <span className="diff-sign" aria-hidden="true">{line.type === "added" ? "+" : line.type === "removed" ? "−" : " "}</span>
                  <span className="diff-text">{line.text || " "}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="diff-side-by-side" role="table" aria-label="Side-by-side diff">
          <div className="diff-column-head" role="row">
            <span>Current draft</span>
            <span>Proposed revision</span>
          </div>
          {rows.map((row, index) => (
            <div className={`diff-pair ${row.type}`} key={`pair-${index}`} role="row">
              <div className={`diff-cell old ${row.oldText === null ? "empty" : ""}`} role="cell">
                <span className="diff-gutter" aria-hidden="true">{row.oldLine ?? ""}</span>
                <span className="diff-text">{row.oldText ?? ""}</span>
              </div>
              <div className={`diff-cell new ${row.newText === null ? "empty" : ""}`} role="cell">
                <span className="diff-gutter" aria-hidden="true">{row.newLine ?? ""}</span>
                <span className="diff-text">{row.newText ?? ""}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
