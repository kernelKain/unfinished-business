import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Eye, Hammer, PlugZap, ScrollText, Settings2, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { ConnectionStatus } from "../../shared/opencode.ts";
import { modeDescriptor } from "../../shared/modes.ts";
import {
  ApiError,
  approveProduct,
  approveSection,
  cancelRun,
  findSelectedModel,
  grantScope,
  loadConnection,
  loadExport,
  loadProject,
  reconcileRun,
  reviseSection,
  runMaker,
  sendMessage,
  type WorkshopProject,
} from "../api.ts";
import { Brand } from "../components/Brand.tsx";
import { RunInspector } from "../components/RunInspector.tsx";
import { SectionCard, EmptyState } from "../components/SectionCard.tsx";
import { SpiritCharacter, type SpiritState } from "../components/SpiritCharacter.tsx";
import { SpiritStageTabs, stageIndex } from "../components/SpiritStageTabs.tsx";
import { StatusChip } from "../components/StatusChip.tsx";
import { Onboarding } from "../onboarding.tsx";
import { OpenCodePanel } from "../opencode-panel.tsx";
import { stageSpirit } from "../spirits.ts";

export function WorkshopPage() {
  const [project, setProject] = useState<WorkshopProject | null>(null);
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [text, setText] = useState("");
  const [scope, setScope] = useState("Build the approved plan in the isolated demo workspace and leave a passing Node test.");
  const [change, setChange] = useState("");
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    void Promise.all([loadProject(), loadConnection()])
      .then(([loaded, native]) => {
        setProject(loaded);
        setConnection(native);
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "The workshop could not be loaded.");
      });
  }, []);

  const activeRun = useMemo(
    () => project?.operations.find((operation) => operation.status === "RUNNING" || operation.status === "QUEUED") ?? null,
    [project],
  );

  useEffect(() => {
    if (!activeRun) return;
    const timer = window.setInterval(() => {
      void loadProject().then(setProject).catch(() => {
        // A transient poll failure must not replace the visible project state.
      });
    }, 1_500);
    return () => window.clearInterval(timer);
  }, [activeRun?.id]);

  async function act(work: () => Promise<{ project: WorkshopProject }>) {
    setBusy(true);
    setSlow(false);
    setError(null);
    const timer = window.setTimeout(() => setSlow(true), 8_000);
    try {
      const result = await work();
      setProject(result.project);
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

  if (!project || !connection) {
    return (
      <div className="workshop-shell">
        <WorkshopHeader connection={connection} onSetup={() => setSetupOpen(true)} />
        <main className="workshop-loading">
          <div className="loading-spirit" aria-hidden="true"><SpiritCharacter id="oracle" state="listening" decorative /></div>
          <p className="eyebrow">Waking the workshop</p>
          <h1>Unfinished Business</h1>
          <p role={error ? "alert" : "status"}>{error ?? "Reading the saved project and checking the engine."}</p>
          {error ? <button className="action secondary" type="button" onClick={() => window.location.reload()}>Reload the workshop</button> : null}
        </main>
      </div>
    );
  }

  const section = project.sections.find((item) => item.id === project.currentSectionId) ?? null;
  const abandoned = project.operations.find((item) => item.status === "ABANDONED") ?? null;
  const profile = stageSpirit(project.stage);
  const characterState = spiritStateFor(project, section);
  const approved = project.sections.filter((item) => item.status === "APPROVED").length;
  const selectedModel = findSelectedModel(connection.discovery, project.engine.model);
  const hostedDemo = connection.deploymentMode === "hosted-demo";
  const firstRun = !connection.discovery || !project.engine.model;
  const showOnboarding = !hostedDemo && (setupOpen || (firstRun && !onboardingDismissed && connection.state !== "unavailable"));
  const connected = connection.state === "connected" || connection.state === "degraded";
  const header = project.stage === "ORACLE"
    ? "What's still haunting your to-do list?"
    : section
      ? `${section.title} — section ${section.order} of ${project.sections.length}`
      : project.nextAction;

  if (showOnboarding) {
    return (
      <div className="workshop-shell">
        <WorkshopHeader connection={connection} onSetup={() => setSetupOpen(true)} />
        <main className="workshop workshop-onboarding">
          <Onboarding
            connection={connection}
            project={project}
            firstRun={firstRun}
            onConnection={(status) => {
              setConnection(status);
              if (status.discovery && project.engine.model) setSetupOpen(false);
            }}
            onProject={(updated) => {
              setProject(updated);
              if (updated.engine.model) setSetupOpen(false);
            }}
            onClose={() => {
              setSetupOpen(false);
              setOnboardingDismissed(true);
            }}
          />
          {error ? <p className="banner bad" role="alert">{error}</p> : null}
        </main>
      </div>
    );
  }

  return (
    <div className="workshop-shell">
      <a className="skip" href="#document">Skip to the working document</a>
      <WorkshopHeader connection={connection} onSetup={() => setSetupOpen(true)} />

      <main className="workshop">
        <header className="workshop-titlebar">
          <div className="workshop-title-copy">
            <p className="eyebrow">Ghostlight Hacker Workshop</p>
            <p className="workshop-stage-name">{profile.name} · stage {stageIndex(project.stage) + 1} of 4</p>
            <p className="meta">Revision {project.revision} · {approved} of {project.sections.length} sections approved</p>
          </div>
          <div className="workshop-character" aria-hidden="true">
            <SpiritCharacter id={profile.id} state={characterState} decorative />
          </div>
        </header>

        <SpiritStageTabs stage={project.stage} />

        <div className="frame">
          <aside className="side">
            <section className="panel outline-panel" aria-labelledby="outline-title">
              <div className="panel-head">
                <h2 id="outline-title">Plan outline</h2>
                <span className="meta">{approved}/{project.sections.length}</span>
              </div>
              <div className="progress-track" aria-hidden="true"><span style={{ width: `${(approved / project.sections.length) * 100}%` }} /></div>
              <ol className="section-list">
                {project.sections.map((item) => (
                  <SectionCard key={item.id} section={item} current={item.id === project.currentSectionId} />
                ))}
              </ol>
            </section>
            <section className="panel engine-panel">
              <div className="panel-head">
                <h2>Engine</h2>
                <StatusChip status={connection.state} label={connectionLabel(connection.state)} />
              </div>
              <p className="meta">
                {connection.serverVersion ? `OpenCode ${connection.serverVersion}` : "OpenCode 2.x"}
                {connection.baseUrl ? ` · ${connection.baseUrl}` : ""}
              </p>
              <p className="meta">
                {selectedModel
                  ? `${selectedModel.name} · ${selectedModel.providerID}/${selectedModel.id}${project.engine.model?.variant ? `#${project.engine.model.variant}` : ""}`
                  : "No supported model selected"}
              </p>
              {selectedModel ? <p className="meta">{modelFacts(selectedModel)}</p> : null}
              {hostedDemo ? (
                <a className="text-link button-link" href="/demo">Open the guided example</a>
              ) : (
                <button className="text-link button-link" type="button" onClick={() => setSetupOpen(true)}>
                  <PlugZap size={15} aria-hidden="true" /> OpenCode setup
                </button>
              )}
            </section>
          </aside>

          <article className="document" id="document" aria-busy={busy}>
            <div className="document-heading">
              <div>
                <p className="eyebrow">{project.stage}</p>
                <h1>{header}</h1>
              </div>
              <div className={`document-spirit state-${characterState}`} aria-hidden="true">
                <SpiritCharacter id={profile.id} state={characterState} decorative />
              </div>
            </div>
            <div className="document-status">
              <span className="status-line">Stopped here: {project.nextAction}</span>
              {project.product.status === "APPROVED" && section?.status === "APPROVED" ? (
                <Seal label="Approved" reduceMotion={reduceMotion} />
              ) : null}
            </div>

            {!connected ? (
              <div className="error-panel" role="status">
                <AlertTriangle size={18} aria-hidden="true" />
                <div>
                  <strong>OpenCode is {connection.state.replaceAll("_", " ")}.</strong>
                  <p>{connection.diagnostics[0]?.message ?? "The engine did not answer. Nothing was inferred."} No paid model will be used.</p>
                  <button className="action secondary" type="button" onClick={() => setSetupOpen(true)}>Open setup</button>
                </div>
              </div>
            ) : connection.state === "degraded" ? (
              <div className="warning-panel" role="status">
                <AlertTriangle size={18} aria-hidden="true" />
                <div>
                  <strong>OpenCode is connected with warnings.</strong>
                  <p>{connection.diagnostics[0]?.message ?? "Review the OpenCode panel before a run."}</p>
                  <button className="action secondary" type="button" onClick={() => setSetupOpen(true)}>Review</button>
                </div>
              </div>
            ) : null}
            {!selectedModel ? (
              <div className="warning-panel" role="status">
                <AlertTriangle size={18} aria-hidden="true" />
                <div>
                  <strong>The selected model is not in the current OpenCode catalog.</strong>
                  <p>Choose a reported model before a Maker run. The app does not assume a model or a paid fallback.</p>
                  <button className="action secondary" type="button" onClick={() => setSetupOpen(true)}>Choose model</button>
                </div>
              </div>
            ) : null}
            {activeRun ? (
              <p className="banner" role="status">
                <strong>{activeRun.kind === "maker" ? "Maker" : "OpenCode"}</strong> is working in the background
                {activeRun.model ? ` with ${activeRun.model.providerID}/${activeRun.model.id}` : ""}. The saved project updates when it finishes.
                <button className="action secondary" type="button" disabled={busy} onClick={() => void act(() => cancelRun(project, activeRun.id))}>Cancel run</button>
              </p>
            ) : null}
            {abandoned ? (
              <div className="warning-panel" role="status">
                <AlertTriangle size={18} aria-hidden="true" />
                <div>
                  <strong>A native run was abandoned without a confirmed outcome and was not repeated.</strong>
                  <p>Use the Run Inspector to reconcile the native session before trying again.</p>
                </div>
              </div>
            ) : null}
            {slow ? <p className="banner" role="status">This is taking longer than usual. The saved section is unchanged until a response arrives.</p> : null}
            {error ? <p className="banner bad" role="alert">{error}</p> : null}

            {hostedDemo ? (
              <HostedDemoPanel />
            ) : (
              <>
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
                  <MakerPanel project={project} busy={busy} activeRun={activeRun} act={act} onChooseModel={() => setSetupOpen(true)} />
                ) : null}
                {project.stage === "WITNESS" ? (
                  <WitnessPanel project={project} text={text} setText={setText} busy={busy} act={act} exportNote={exportNote} setExportNote={setExportNote} />
                ) : null}
              </>
            )}
          </article>

          <aside className="side inspector-side">
            <RunInspector
              operations={project.operations}
              evidence={project.evidence}
              capabilities={project.capabilities}
              busy={busy}
              onReconcile={(operationId) => void act(() => reconcileRun(project, operationId))}
              note="This view never invents a result. Unknown runs and failed checks stay visible."
            />
            <section className="panel transcript-panel">
              <div className="panel-head">
                <h2>Session notes</h2>
                <span className="meta">{project.transcript.length}</span>
              </div>
              {project.transcript.length === 0 ? (
                <EmptyState title="No notes yet">The first spirit exchange will appear here.</EmptyState>
              ) : (
                <ol className="transcript-list">
                  {project.transcript.slice(-4).reverse().map((entry) => (
                    <li key={entry.id}>
                      <span className="meta">{entry.spirit}</span>
                      <p>{entry.text.slice(0, 220)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </aside>
        </div>
        <OpenCodePanel
          connection={connection}
          project={project}
          onConnection={setConnection}
          onProject={setProject}
          onOpenSetup={() => setSetupOpen(true)}
        />
      </main>
    </div>
  );
}

function HostedDemoPanel() {
  const demo = modeDescriptor("demo");
  return (
    <section className="stage-panel hosted-demo-panel" aria-labelledby="hosted-demo-title">
      <div className="panel-intro">
        <span className="panel-icon"><Eye size={18} aria-hidden="true" /></span>
        <div>
          <h2 id="hosted-demo-title">This hosted instance is a read-only demo</h2>
          <p>{demo.summary}</p>
        </div>
      </div>
      <ul className="check-list">
        {demo.capabilities.filter((capability) => !capability.available).map((capability) => (
          <li key={capability.id}>
            <AlertTriangle size={15} aria-hidden="true" />
            <span><strong>{capability.label}:</strong> {capability.detail}</span>
          </li>
        ))}
      </ul>
      <div className="actions">
        <a className="action" href="/demo">Try the guided example</a>
        <a className="action secondary" href="/#local-setup">Set up locally</a>
        <a className="action ghost" href="/">Read the overview</a>
      </div>
      <p className="meta">All mutation, run, approval, and session-token routes are rejected in this mode.</p>
    </section>
  );
}

function WorkshopHeader({ connection, onSetup }: { connection: ConnectionStatus | null; onSetup: () => void }) {
  const state = connection?.state;
  const live = state === "connected";
  const warn = state === "degraded" || state === "checking";
  return (
    <header className="workshop-header">
      <div className="workshop-header-inner">
        <Brand compact />
        <div className="workshop-header-actions">
          <a href="/">Overview</a>
          <a href="/demo">Demo</a>
          <button className="engine-pill" type="button" onClick={onSetup} aria-label="Open OpenCode connection setup">
            <span className={live ? "engine-dot is-live" : warn ? "engine-dot is-warn" : "engine-dot"} aria-hidden="true" />
            {connection ? connectionLabel(state) : "Checking OpenCode"}
          </button>
        </div>
      </div>
    </header>
  );
}

function connectionLabel(state: ConnectionStatus["state"] | undefined): string {
  if (!state) return "Checking OpenCode";
  if (state === "connected") return "OpenCode connected";
  if (state === "degraded") return "OpenCode warnings";
  if (state === "authentication_required") return "OpenCode auth required";
  if (state === "incompatible_version") return "OpenCode incompatible";
  if (state === "not_configured") return "OpenCode not configured";
  if (state === "checking") return "Checking OpenCode";
  return "OpenCode unreachable";
}

function modelFacts(model: NonNullable<ReturnType<typeof findSelectedModel>>): string {
  return `${model.pricing === "free" ? "free" : model.pricing === "paid" ? "paid" : "price unknown"} · ${model.tools ? "tools" : "no tools"} · ${model.limits.context ? `${Math.round(model.limits.context / 1000)}k context` : "context unknown"}${model.local ? " · local" : ""}`;
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
    <section className="stage-panel" aria-labelledby="oracle-panel-title">
      <div className="panel-intro">
        <span className="panel-icon"><Sparkles size={18} aria-hidden="true" /></span>
        <div>
          <h2 id="oracle-panel-title">Oracle: clarify the idea</h2>
          <p>Describe an idea you want to bring to life. The Oracle proposes a product scope; you approve it.</p>
        </div>
      </div>
      {proposal ? (
        <div className="reading prose proposal-card">
          <div className="proposal-head"><h3>Oracle proposal</h3><StatusChip status={props.project.product.status} /></div>
          <p>{proposal}</p>
          {props.project.product.openQuestions.length ? (
            <div className="open-questions">
              <h4>Open questions</h4>
              <ul>{props.project.product.openQuestions.map((question) => <li key={question}>{question}</li>)}</ul>
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState title="The bench is quiet">No proposal exists yet. Wake the Oracle with an idea or question.</EmptyState>
      )}
      <label htmlFor="oracle-text">Idea or question</label>
      <textarea id="oracle-text" value={props.text} onChange={(event) => props.setText(event.target.value)} maxLength={8000} />
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
    </section>
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
    <section className="stage-panel" aria-labelledby="architect-panel-title">
      <div className="panel-intro">
        <span className="panel-icon"><ScrollText size={18} aria-hidden="true" /></span>
        <div>
          <h2 id="architect-panel-title">Architect: review one section</h2>
          <p>Approve this exact version, or ask for a change. A revision makes the old approval stale.</p>
        </div>
        <div className="panel-badges">
          <StatusChip status={props.section.status} />
          <span className="meta">v{props.section.version}</span>
        </div>
      </div>
      {props.section.status === "STALE" ? (
        <div className="warning-panel"><AlertTriangle size={18} aria-hidden="true" /><p>An upstream change marked this section stale. Review it again before approval counts.</p></div>
      ) : null}
      <div className="reading prose section-reading">
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
      <div className="form-grid">
        <div>
          <label htmlFor="architect-question">Ask a question</label>
          <textarea id="architect-question" value={props.text} onChange={(event) => props.setText(event.target.value)} maxLength={8000} />
          <button className="action secondary" type="button" disabled={props.busy || props.text.trim().length < 1} onClick={() => void props.act(() => sendMessage(props.project, "question", props.text))}>
            Ask
          </button>
        </div>
        <div>
          <label htmlFor="architect-change">Replacement text for this section</label>
          <textarea id="architect-change" value={props.change} onChange={(event) => props.setChange(event.target.value)} maxLength={8000} />
          <button className="action secondary" type="button" disabled={props.busy || props.change.trim().length < 1} onClick={() => void props.act(() => reviseSection(props.project, props.section.id, props.change))}>
            Request changes
          </button>
        </div>
      </div>
    </section>
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
    <section className="stage-panel" aria-labelledby="scope-panel-title">
      <div className="panel-intro">
        <span className="panel-icon"><Hammer size={18} aria-hidden="true" /></span>
        <div>
          <h2 id="scope-panel-title">Maker: grant a separate scope</h2>
          <p>Every current section is approved. Maker still needs a separate, explicit scope before any native edit.</p>
        </div>
      </div>
      <label htmlFor="maker-scope">Maker scope</label>
      <textarea id="maker-scope" value={props.scope} onChange={(event) => props.setScope(event.target.value)} maxLength={2000} />
      <button className="action" type="button" disabled={props.busy || props.scope.trim().length < 8} onClick={() => void props.act(() => grantScope(props.project, props.scope.trim()))}>
        Grant Maker scope
      </button>
    </section>
  );
}

function MakerPanel(props: {
  project: WorkshopProject;
  busy: boolean;
  activeRun: WorkshopProject["operations"][number] | null;
  act: (work: () => Promise<{ project: WorkshopProject }>) => Promise<void>;
  onChooseModel: () => void;
}) {
  const recommended = props.project.capabilities.find((item) => item.id === "node-check");
  const selected = props.project.engine.model;
  return (
    <section className="stage-panel" aria-labelledby="maker-panel-title">
      <div className="panel-intro">
        <span className="panel-icon"><Hammer size={18} aria-hidden="true" /></span>
        <div>
          <h2 id="maker-panel-title">Maker: run the approved unit</h2>
          <p>OpenCode performs the edit. The app records the native session and shows the result it observed.</p>
        </div>
      </div>
      <div className="scope-card">
        <span className="meta">Granted scope</span>
        <p>{props.project.makerScope.statement}</p>
      </div>
      <p className="meta">
        Chosen model: {selected ? `${selected.providerID}/${selected.id}${selected.variant ? `#${selected.variant}` : ""}` : "none selected"}.
        This model is recorded in the run evidence.
      </p>
      {!selected ? (
        <div className="warning-panel" role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>A supported model must be chosen before Maker can run.</strong>
            <button className="action secondary" type="button" onClick={props.onChooseModel}>Choose model</button>
          </div>
        </div>
      ) : null}
      {recommended ? (
        <div className="capability-card">
          <div className="panel-head"><h3>Recommended path</h3><StatusChip status={recommended.availability} /></div>
          <p>{recommended.purpose}. {recommended.nativeMapping}.</p>
          <p className="meta">Permission: {recommended.permission}.</p>
        </div>
      ) : null}
      <button className="action" type="button" disabled={props.busy || !selected || Boolean(props.activeRun)} onClick={() => void props.act(() => runMaker(props.project))}>
        {props.activeRun ? "Maker is running…" : "Run Maker"}
      </button>
      {props.activeRun ? <p className="meta">The request returns immediately. Polling reads the persisted operation until OpenCode finishes.</p> : null}
      <p className="meta">Approval here does not override an OpenCode permission denial.</p>
    </section>
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
    <section className="stage-panel" aria-labelledby="witness-panel-title">
      <div className="panel-intro">
        <span className="panel-icon"><Eye size={18} aria-hidden="true" /></span>
        <div>
          <h2 id="witness-panel-title">Witness: inspect the evidence</h2>
          <p>Witness reads evidence in a fresh session and writes review notes. Those notes are not a submitted article or video.</p>
        </div>
      </div>
      <label htmlFor="witness-text">What should Witness examine?</label>
      <textarea id="witness-text" value={props.text} onChange={(event) => props.setText(event.target.value)} maxLength={8000} />
      <div className="actions">
        <button className="action" type="button" disabled={props.busy || props.text.trim().length < 1} onClick={() => void props.act(() => sendMessage(props.project, "witness", props.text))}>
          Review evidence
        </button>
        <button className="action secondary" type="button" disabled={props.busy} onClick={() => void loadExport().then((exported) => props.setExportNote(exported.limitation + (exported.plan ? " Compiled plan is ready." : " Plan is not fully approved."))).catch((caught: unknown) => props.setExportNote(caught instanceof Error ? caught.message : "Export failed."))}>
          Check export
        </button>
      </div>
      {props.exportNote ? <p className="banner" role="status">{props.exportNote}</p> : null}
      {props.project.witnessDrafts.length === 0 ? (
        <EmptyState title="No review notes yet">Witness has not reviewed this evidence. An empty review is not approval.</EmptyState>
      ) : null}
      {props.project.witnessDrafts.map((draft) => (
        <section key={draft.id} className="reading witness-draft">
          <h2>{draft.title}</h2>
          <p className="prose">{draft.content}</p>
        </section>
      ))}
      <a className="text-link" href="/demo">See scripted recovery states <ArrowRight size={15} aria-hidden="true" /></a>
    </section>
  );
}

function Seal({ label, reduceMotion }: { label: string; reduceMotion: boolean | null }) {
  if (reduceMotion) return <span className="seal">{label}</span>;
  return <motion.span className="seal" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }}>{label}</motion.span>;
}

function spiritStateFor(
  project: WorkshopProject,
  section: WorkshopProject["sections"][number] | null,
): SpiritState {
  if (project.stage === "ORACLE") {
    return project.product.status === "PROPOSED" ? "clarification" : "listening";
  }
  if (project.stage === "ARCHITECT") {
    return section && (section.status === "DRAFT" || section.status === "STALE") ? "drawing" : "approval";
  }
  if (project.stage === "MAKER") {
    const latest = [...project.operations].reverse().find((operation) => operation.kind === "maker");
    if (!latest) return "idle";
    if (latest.status === "WAITING_PERMISSION") return "permission";
    if (latest.status === "ABANDONED" || latest.status === "COMPLETED_UNAPPLIED") return "permission";
    if (latest.status === "FAILED" || latest.status === "CANCELLED") return "blocked";
    if (latest.status === "SUCCEEDED") return "success";
    return "building";
  }
  if (project.evidence.some((item) => item.result === "FAIL" || item.result === "INCONCLUSIVE")) return "warning";
  if (project.witnessDrafts.length > 0) return "evidence";
  return "scanning";
}
