/**
 * Deterministic line diff for reviewing an Architect revision.
 *
 * The same data feeds the unified and side-by-side views, so both views show
 * exactly the same additions, removals, and line numbers.
 */

export type DiffLineType = "context" | "added" | "removed";

export interface DiffLine {
  type: DiffLineType;
  oldLine: number | null;
  newLine: number | null;
  text: string;
}

export interface DiffHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
}

export interface SideBySideRow {
  type: "context" | "change";
  oldLine: number | null;
  newLine: number | null;
  oldText: string | null;
  newText: string | null;
}

export interface DiffSummary {
  added: number;
  removed: number;
  unchanged: number;
}

function splitLines(value: string): string[] {
  if (value.length === 0) return [];
  return value.replace(/\r\n?/g, "\n").split("\n");
}

/**
 * Longest-common-subsequence line diff. Section drafts are bounded by the
 * candidate schema, so the quadratic table stays small; the cap is a safety
 * valve for unexpected input.
 */
export function computeLineDiff(before: string, after: string): DiffLine[] {
  const oldLines = splitLines(before);
  const newLines = splitLines(after);
  if (oldLines.length * newLines.length > 4_000_000) {
    return [
      ...oldLines.map((text, index) => ({ type: "removed" as const, oldLine: index + 1, newLine: null, text })),
      ...newLines.map((text, index) => ({ type: "added" as const, oldLine: null, newLine: index + 1, text })),
    ];
  }

  const lengths = Array.from({ length: oldLines.length + 1 }, () => new Uint32Array(newLines.length + 1));
  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      lengths[oldIndex][newIndex] = oldLines[oldIndex] === newLines[newIndex]
        ? lengths[oldIndex + 1][newIndex + 1] + 1
        : Math.max(lengths[oldIndex + 1][newIndex], lengths[oldIndex][newIndex + 1]);
    }
  }

  const lines: DiffLine[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < oldLines.length && newIndex < newLines.length) {
    if (oldLines[oldIndex] === newLines[newIndex]) {
      lines.push({ type: "context", oldLine: oldIndex + 1, newLine: newIndex + 1, text: oldLines[oldIndex] });
      oldIndex += 1;
      newIndex += 1;
    } else if (lengths[oldIndex + 1][newIndex] >= lengths[oldIndex][newIndex + 1]) {
      lines.push({ type: "removed", oldLine: oldIndex + 1, newLine: null, text: oldLines[oldIndex] });
      oldIndex += 1;
    } else {
      lines.push({ type: "added", oldLine: null, newLine: newIndex + 1, text: newLines[newIndex] });
      newIndex += 1;
    }
  }
  while (oldIndex < oldLines.length) {
    lines.push({ type: "removed", oldLine: oldIndex + 1, newLine: null, text: oldLines[oldIndex] });
    oldIndex += 1;
  }
  while (newIndex < newLines.length) {
    lines.push({ type: "added", oldLine: null, newLine: newIndex + 1, text: newLines[newIndex] });
    newIndex += 1;
  }
  return lines;
}

export function summarizeDiff(lines: DiffLine[]): DiffSummary {
  return {
    added: lines.filter((line) => line.type === "added").length,
    removed: lines.filter((line) => line.type === "removed").length,
    unchanged: lines.filter((line) => line.type === "context").length,
  };
}

/** Groups the diff into unified hunks with a small amount of context. */
export function buildUnifiedHunks(lines: DiffLine[], context = 3): DiffHunk[] {
  const changed = lines
    .map((line, index) => (line.type === "context" ? -1 : index))
    .filter((index) => index >= 0);
  if (!changed.length) return [];
  const ranges: Array<[number, number]> = [];
  for (const index of changed) {
    const start = Math.max(0, index - context);
    const end = Math.min(lines.length, index + context + 1);
    const previous = ranges.at(-1);
    if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
    else ranges.push([start, end]);
  }
  return ranges.map(([start, end]) => {
    const hunkLines = lines.slice(start, end);
    const firstOld = hunkLines.find((line) => line.oldLine !== null)?.oldLine ?? 0;
    const firstNew = hunkLines.find((line) => line.newLine !== null)?.newLine ?? 0;
    return {
      oldStart: firstOld,
      oldCount: hunkLines.filter((line) => line.type !== "added").length,
      newStart: firstNew,
      newCount: hunkLines.filter((line) => line.type !== "removed").length,
      lines: hunkLines,
    };
  });
}

/**
 * Pairs removals and additions within each change run. Unpaired lines get an
 * empty cell, which keeps the two columns aligned and readable.
 */
export function buildSideBySideRows(hunks: DiffHunk[]): SideBySideRow[] {
  const rows: SideBySideRow[] = [];
  for (const hunk of hunks) {
    let index = 0;
    while (index < hunk.lines.length) {
      const line = hunk.lines[index];
      if (line.type === "context") {
        rows.push({
          type: "context",
          oldLine: line.oldLine,
          newLine: line.newLine,
          oldText: line.text,
          newText: line.text,
        });
        index += 1;
        continue;
      }
      const removed: DiffLine[] = [];
      const added: DiffLine[] = [];
      while (index < hunk.lines.length && hunk.lines[index].type !== "context") {
        if (hunk.lines[index].type === "removed") removed.push(hunk.lines[index]);
        else added.push(hunk.lines[index]);
        index += 1;
      }
      const count = Math.max(removed.length, added.length);
      for (let offset = 0; offset < count; offset += 1) {
        rows.push({
          type: "change",
          oldLine: removed[offset]?.oldLine ?? null,
          newLine: added[offset]?.newLine ?? null,
          oldText: removed[offset]?.text ?? null,
          newText: added[offset]?.text ?? null,
        });
      }
    }
  }
  return rows;
}
