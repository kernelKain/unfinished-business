import { useMemo, useState } from "react";
import { BookOpen, Check, Pencil, Plus } from "lucide-react";
import type { MemoryEditKind, WorkshopProject } from "../api.ts";
import { EmptyState } from "./SectionCard.tsx";

type MemoryEntry = WorkshopProject["memory"]["decisions"][number];

const KIND_LABELS: Record<MemoryEditKind, string> = {
  decision: "Decision",
  answer: "User answer",
  assumption: "Assumption",
  constraint: "Constraint",
};

function active(entries: MemoryEntry[] | undefined): MemoryEntry[] {
  return (entries ?? []).filter((entry) => entry.status !== "SUPERSEDED");
}

export function ProjectMemory(props: {
  project: WorkshopProject;
  busy: boolean;
  onSave: (input: { kind: MemoryEditKind; text: string; supersedesId: string | null }) => Promise<boolean>;
}) {
  const decisions = active(props.project.memory.decisions);
  const answers = active(props.project.memory.answers);
  const assumptions = active(props.project.memory.assumptions);
  const constraints = active(props.project.memory.constraints);
  const questions = props.project.oracleIntake.unresolvedQuestions;
  const total = decisions.length + answers.length + assumptions.length + constraints.length + questions.length;
  const [kind, setKind] = useState<MemoryEditKind>("decision");
  const [text, setText] = useState("");
  const [supersedesId, setSupersedesId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const groups = useMemo(() => ([
    { kind: "decision" as const, title: "Decisions", entries: decisions },
    { kind: "answer" as const, title: "User answers", entries: answers },
    { kind: "assumption" as const, title: "Assumptions", entries: assumptions },
    { kind: "constraint" as const, title: "Constraints", entries: constraints },
  ]), [decisions, answers, assumptions, constraints]);

  function startCorrection(entryKind: MemoryEditKind, entry: MemoryEntry) {
    setKind(entryKind);
    setText(entry.text);
    setSupersedesId(entry.id);
    setError(null);
    setSaved(null);
    document.getElementById("memory-text")?.focus();
  }

  function reset() {
    setText("");
    setSupersedesId(null);
    setError(null);
  }

  async function submit() {
    if (text.trim().length < 1) return;
    setError(null);
    setSaved(null);
    const ok = await props.onSave({ kind, text: text.trim(), supersedesId });
    if (!ok) {
      setError("The memory update was not saved. The previous entry is unchanged.");
      return;
    }
    setSaved(supersedesId ? "Memory corrected. The previous entry is kept as superseded." : "Memory saved.");
    reset();
  }

  return (
    <div className="project-memory" data-testid="project-memory">
      {total === 0 ? (
        <EmptyState title="No project memory yet">
          Answers, decisions, assumptions, and constraints appear here after discovery. You can also add one directly.
        </EmptyState>
      ) : null}

      <div className="memory-groups">
        {groups.map((group) => (
          <section className="memory-group" key={group.kind} aria-labelledby={`memory-${group.kind}`}>
            <div className="panel-head">
              <h3 id={`memory-${group.kind}`}>{group.title}</h3>
              <span className="meta">{group.entries.length}</span>
            </div>
            {group.entries.length ? (
              <ul className="memory-list">
                {group.entries.map((entry) => (
                  <li key={entry.id}>
                    <div>
                      {entry.field ? <span className="memory-field">{entry.field}</span> : null}
                      <p>{entry.text}</p>
                    </div>
                    <button className="text-button memory-correct" type="button" disabled={props.busy} onClick={() => startCorrection(group.kind, entry)}>
                      <Pencil size={13} aria-hidden="true" /> Correct
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="meta">Nothing recorded in this group.</p>}
          </section>
        ))}

        <section className="memory-group" aria-labelledby="memory-questions">
          <div className="panel-head">
            <h3 id="memory-questions">Unresolved questions</h3>
            <span className="meta">{questions.length}</span>
          </div>
          {questions.length ? (
            <ul className="memory-list">
              {questions.map((question) => (
                <li key={question.id}>
                  <div>
                    <span className="memory-field">{question.field}</span>
                    <p>{question.prompt}</p>
                    <p className="meta">{question.whyItMatters}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="meta">No open discovery question.</p>}
        </section>
      </div>

      <form className="memory-editor" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <div className="memory-editor-head">
          <span className="panel-icon" aria-hidden="true">{supersedesId ? <Pencil size={16} /> : <Plus size={16} />}</span>
          <div>
            <h3>{supersedesId ? "Correct a memory entry" : "Add to project memory"}</h3>
            <p className="meta">A correction keeps the prior entry as superseded. It never changes an approval or section draft.</p>
          </div>
        </div>
        <label htmlFor="memory-kind">
          Memory type
          <select id="memory-kind" value={kind} onChange={(event) => setKind(event.target.value as MemoryEditKind)} disabled={supersedesId !== null}>
            {Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label htmlFor="memory-text">
          Memory text
          <textarea
            id="memory-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={2000}
            placeholder="Record a decision, answer, assumption, or constraint the workshop should keep."
          />
        </label>
        <div className="actions">
          <button className="action" type="submit" disabled={props.busy || text.trim().length < 1}>
            <Check size={15} aria-hidden="true" /> {supersedesId ? "Save correction" : "Save memory"}
          </button>
          {supersedesId ? (
            <button className="action ghost" type="button" disabled={props.busy} onClick={reset}>Cancel correction</button>
          ) : null}
        </div>
        {error ? <p className="banner bad" role="alert">{error}</p> : null}
        {saved ? <p className="banner good" role="status">{saved}</p> : null}
        <p className="meta"><BookOpen size={13} aria-hidden="true" /> This panel is the user-facing project record. Raw transcripts stay in Advanced diagnostics.</p>
      </form>
    </div>
  );
}
