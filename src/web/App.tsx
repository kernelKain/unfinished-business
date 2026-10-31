import { useEffect, useState } from "react";
import { Eye, Hammer, ScrollText, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import {
  ApiError,
  approveProduct,
  approveSection,
  grantScope,
  loadEngine,
  loadExport,
  loadProject,
  reconcileRun,
  reviseSection,
  runMaker,
  sendMessage,
  type EngineStatus,
  type WorkshopProject,
} from "./api.ts";

const spirits = [
  ["ORACLE", "Oracle", Sparkles],
  ["ARCHITECT", "Architect", ScrollText],
  ["MAKER", "Maker", Hammer],
  ["WITNESS", "Witness", Eye],
] as const;

export function App() {
  const [project, setProject] = useState<WorkshopProject | null>(null);
  const [engine, setEngine] = useState<EngineStatus | null>(null);
  const [text, setText] = useState("");
  const [scope, setScope] = useState("Build the approved plan in the isolated demo workspace and leave a passing Node test.");
  const [change, setChange] = useState("");
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    void Promise.all([loadProject(), loadEngine()])
      .then(([loaded, native]) => {
        setProject(loaded);
        setEngine(native);
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "The workshop could not be loaded.");
      });
  }, []);

  async function act(work: () => Promise<{ project: WorkshopProject }>) {
    setBusy(true);
    setSlow(false);
    setError(null);
    const timer = window.setTimeout(() => setSlow(true), 8_000);
    try {
      setProject((await work()).project);
    } catch (caught) {
      const loaded = await loadProject().catch(() => null);
      if (loaded) setProject(loaded);
      setError(caught instanceof ApiError
        ? `${caught.message} ${caught.retryable ? "You can try a new request. The current section was not overwritten." : "Nothing was repeated."}`
        : "The workshop lost its connection. Reload before trying again.");
    } finally {
      window.clearTimeout(timer);
      setBusy(false);
      setSlow(false);
    }
  }

  if (!project) {
    return (
      <main className="workshop">
        <h1>Unfinished Business</h1>
        <p>{error ?? "The workshop is waking up."}</p>
      </main>
    );
  }

  const section = project.sections.find((item) => item.id === project.currentSectionId) ?? null;
  const unknown = project.operations.find((item) => item.status === "UNKNOWN") ?? null;
  const header = project.stage === "ORACLE"
    ? "What's still haunting your to-do list?"
    : section
      ? `${section.title} — section ${section.order} of ${project.sections.length}`
      : project.nextAction;

  return (
    <>
      <a className="skip" href="#document">Skip to the working document</a>
      <main className="workshop">
        <nav className="stage-strip" aria-label="Spirits">
          {spirits.map(([id, label, Icon]) => {
            const done = stageOrder(project.stage) > stageOrder(id);
            return (
              <button key={id} type="button" className={done ? "stage done" : "stage"} aria-current={project.stage === id ? "step" : undefined} disabled>
                <Icon aria-hidden="true" size={18} />
                {label}
              </button>
            );
          })}
        </nav>
        <div className="frame">
          <aside className="side">
            <section className="panel">
              <h2>Outline</h2>
              <ol>
                {project.sections.map((item) => (
                  <li key={item.id} className={item.status === "STALE" ? "ghost" : undefined}>
                    {item.title} — {statusLabel(item)}
                  </li>
                ))}
              </ol>
            </section>
          </aside>
          <article className="document" id="document" aria-busy={busy}>
            <Lantern />
            <p className="eyebrow">{project.stage}</p>
            <h1>
              {header}
              {project.product.status === "APPROVED" && section?.status === "APPROVED" ? (
                <Seal label="Approved" reduceMotion={reduceMotion} />
              ) : null}
            </h1>
            <p className="status-line">Stopped here: {project.nextAction}</p>
            {engine && !engine.available ? (
              <p className="banner bad" role="status">
                {engine.limitation?.includes("fetch failed")
                  ? "OpenCode is not reachable on the configured loopback address."
                  : engine.limitation}{" "}
                Start OpenCode, then try again. No paid model will be used.
              </p>
            ) : null}
            {unknown ? (
              <p className="banner bad" role="status">
                A native run is unknown and was not repeated.
                <button className="action secondary" type="button" disabled={busy} onClick={() => void act(() => reconcileRun(project, unknown.id))}>Reconcile native session</button>
              </p>
            ) : null}
            {slow ? <p className="banner" role="status">This is taking longer than usual. The saved section is unchanged until a response arrives.</p> : null}
            {error ? <p className="banner bad" role="alert">{error}</p> : null}

            {project.stage === "ORACLE" ? (
              <OraclePanel project={project} text={text} setText={setText} busy={busy} act={act} />
            ) : null}
            {project.stage === "ARCHITECT" && section ? (
              <ArchitectPanel
                project={project}
                section={section}
                change={change}
                setChange={setChange}
                text={text}
                setText={setText}
                busy={busy}
                act={act}
                reduceMotion={reduceMotion}
              />
            ) : null}
            {project.stage === "ARCHITECT" && !section ? (
              <ScopePanel project={project} scope={scope} setScope={setScope} busy={busy} act={act} />
            ) : null}
            {project.stage === "MAKER" ? (
              <MakerPanel project={project} busy={busy} act={act} />
            ) : null}
            {project.stage === "WITNESS" ? (
              <WitnessPanel project={project} text={text} setText={setText} busy={busy} act={act} exportNote={exportNote} setExportNote={setExportNote} />
            ) : null}
          </article>
          <aside className="side">
            <Activity project={project} />
          </aside>
        </div>
      </main>
    </>
  );
}

function OraclePanel(props: {
  project: WorkshopProject;
  text: string;
  setText: (value: string) => void;
  busy: boolean;
  act: (work: () => Promise<{ project: WorkshopProject }>) => Promise<void>;
}) {
  const proposal = props.project.product.proposal;
  return (
    <>
      <p>Describe an idea you want to bring to life.</p>
      {proposal ? (
        <div className="reading prose">
          <h2>Oracle proposal</h2>
          <p>{proposal}</p>
          {props.project.product.openQuestions.length ? (
            <ul>{props.project.product.openQuestions.map((question) => <li key={question}>{question}</li>)}</ul>
          ) : null}
        </div>
      ) : null}
      <label>
        Idea or question
        <textarea value={props.text} onChange={(event) => props.setText(event.target.value)} maxLength={8000} />
      </label>
      <div className="actions">
        {proposal ? (
          <button className="action" type="button" disabled={props.busy} onClick={() => void props.act(() => approveProduct(props.project))}>
            Approve product
          </button>
        ) : (
          <button className="action" type="button" disabled={props.busy || props.text.trim().length < 1} onClick={() => void props.act(() => sendMessage(props.project, "clarify", props.text))}>
            Wake the Oracle
          </button>
        )}
        {proposal ? (
          <button className="action secondary" type="button" disabled={props.busy || props.text.trim().length < 1} onClick={() => void props.act(() => sendMessage(props.project, "question", props.text))}>
            Ask a question
          </button>
        ) : null}
      </div>
    </>
  );
}

function ArchitectPanel(props: {
  project: WorkshopProject;
  section: WorkshopProject["sections"][number];
  change: string;
  setChange: (value: string) => void;
  text: string;
  setText: (value: string) => void;
  busy: boolean;
  reduceMotion: boolean | null;
  act: (work: () => Promise<{ project: WorkshopProject }>) => Promise<void>;
}) {
  return (
    <>
      <p className="meta">{props.section.status} · version {props.section.version}</p>
      {props.section.status === "STALE" ? <p className="banner">An upstream change marked this section stale. Review it again before approval counts.</p> : null}
      <div className="reading prose">
        {props.section.content || "This section has no draft yet."}
      </div>
      {props.section.status === "APPROVED" ? <Seal label="Section approved" reduceMotion={props.reduceMotion} /> : null}
      <div className="actions">
        <button className="action" type="button" disabled={props.busy} onClick={() => void props.act(() => sendMessage(props.project, "draft", props.text.trim() || `Draft ${props.section.title}`))}>
          Draft section
        </button>
        {props.section.status === "DRAFT" ? (
          <button className="action secondary" type="button" disabled={props.busy} onClick={() => void props.act(() => approveSection(props.project, props.section.version, props.section.hash, props.section.id))}>
            Approve section
          </button>
        ) : null}
      </div>
      <label>
        Ask a question
        <textarea value={props.text} onChange={(event) => props.setText(event.target.value)} maxLength={8000} />
      </label>
      <button className="action secondary" type="button" disabled={props.busy || props.text.trim().length < 1} onClick={() => void props.act(() => sendMessage(props.project, "question", props.text))}>
        Ask
      </button>
      <label>
        Replacement text for this section
        <textarea value={props.change} onChange={(event) => props.setChange(event.target.value)} maxLength={8000} />
      </label>
      <button className="action secondary" type="button" disabled={props.busy || props.change.trim().length < 1} onClick={() => void props.act(() => reviseSection(props.project, props.section.id, props.change))}>
        Request changes
      </button>
    </>
  );
}

function ScopePanel(props: {
  project: WorkshopProject;
  scope: string;
  setScope: (value: string) => void;
  busy: boolean;
  act: (work: () => Promise<{ project: WorkshopProject }>) => Promise<void>;
}) {
  return (
    <>
      <p>Every current section is approved. Maker still needs a separate scope before any native edit.</p>
      <label>
        Maker scope
        <textarea value={props.scope} onChange={(event) => props.setScope(event.target.value)} maxLength={2000} />
      </label>
      <button className="action" type="button" disabled={props.busy || props.scope.trim().length < 8} onClick={() => void props.act(() => grantScope(props.project, props.scope.trim()))}>
        Grant Maker scope
      </button>
    </>
  );
}

function MakerPanel(props: {
  project: WorkshopProject;
  busy: boolean;
  act: (work: () => Promise<{ project: WorkshopProject }>) => Promise<void>;
}) {
  const recommended = props.project.capabilities.find((item) => item.id === "node-check");
  return (
    <>
      <p>Scope: {props.project.makerScope.statement}</p>
      {recommended ? (
        <p className="banner">Recommended path: {recommended.purpose}. {recommended.nativeMapping}. Permission: {recommended.permission}.</p>
      ) : null}
      <button className="action" type="button" disabled={props.busy} onClick={() => void props.act(() => runMaker(props.project))}>
        Run Maker
      </button>
    </>
  );
}

function WitnessPanel(props: {
  project: WorkshopProject;
  text: string;
  setText: (value: string) => void;
  busy: boolean;
  act: (work: () => Promise<{ project: WorkshopProject }>) => Promise<void>;
  exportNote: string | null;
  setExportNote: (value: string | null) => void;
}) {
  return (
    <>
      <p>Witness reads the evidence in a fresh session and writes review notes. Those notes are not a submitted article or video.</p>
      <label>
        What should Witness examine?
        <textarea value={props.text} onChange={(event) => props.setText(event.target.value)} maxLength={8000} />
      </label>
      <div className="actions">
        <button className="action" type="button" disabled={props.busy || props.text.trim().length < 1} onClick={() => void props.act(() => sendMessage(props.project, "witness", props.text))}>
          Review evidence
        </button>
        <button className="action secondary" type="button" disabled={props.busy} onClick={() => void loadExport().then((exported) => props.setExportNote(exported.limitation + (exported.plan ? " Compiled plan is ready." : " Plan is not fully approved."))).catch((caught: unknown) => props.setExportNote(caught instanceof Error ? caught.message : "Export failed."))}>
          Check export
        </button>
      </div>
      {props.exportNote ? <p className="banner" role="status">{props.exportNote}</p> : null}
      {props.project.witnessDrafts.map((draft) => (
        <section key={draft.id} className="reading">
          <h2>{draft.title}</h2>
          <p className="prose">{draft.content}</p>
        </section>
      ))}
    </>
  );
}

function Activity({ project }: { project: WorkshopProject }) {
  const latest = [...project.operations].reverse().slice(0, 4);
  return (
    <>
      <section className="panel">
        <h2>Activity</h2>
        {latest.length === 0 ? <p>No native run yet.</p> : (
          <ul>
            {latest.map((item) => (
              <li key={item.id}>
                <span className="meta">{item.kind} · {item.status}</span>
                <div className="evidence">{(item.result ?? "No result recorded.").slice(0, 280)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel">
        <h2>Evidence</h2>
        {project.evidence.length === 0 ? <p>No check has been observed.</p> : (
          <ul>
            {project.evidence.map((item) => (
              <li key={item.id}>{item.checkId}: {item.result}{item.limitation ? ` — ${item.limitation}` : ""}</li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Seal({ label, reduceMotion }: { label: string; reduceMotion: boolean | null }) {
  if (reduceMotion) return <span className="seal">{label}</span>;
  return <motion.span className="seal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>{label}</motion.span>;
}

function Lantern() {
  return (
    <svg className="lantern" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="12" y="3" width="8" height="3" rx="1" fill="#f4b66c" />
      <path d="M10 8h12l-1 16H11L10 8z" fill="#252031" stroke="#f4b66c" />
      <circle className="flame" cx="16" cy="16" r="3" fill="#f4b66c" />
    </svg>
  );
}

function statusLabel(section: WorkshopProject["sections"][number]): string {
  if (section.status === "DRAFT") return `Draft v${section.version}`;
  if (section.status === "NOT_STARTED") return "Not started";
  if (section.status === "APPROVED") return "Approved";
  return "Stale";
}

function stageOrder(stage: WorkshopProject["stage"]): number {
  return spirits.findIndex(([id]) => id === stage);
}
