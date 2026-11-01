import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, BookOpen, Eye, Hammer, ScrollText, Settings2, ShieldAlert, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { ConnectionStatus } from "../../shared/opencode.ts";
import type { ProviderErrorDetails } from "../../shared/workflow.ts";
import { modeDescriptor } from "../../shared/modes.ts";
import { sectionContract } from "../../shared/section-contracts.ts";
import {
  abandonRun,
  acceptSectionRevision,
  ApiError,
  approveProduct,
  approveSection,
  cancelRun,
  confirmRemoteSource,
  findSelectedModel,
  grantScope,
  loadConnection,
  loadPermissions,
  loadProject,
  reconcileRun,
  rejectSectionRevision,
  replyPermission,
  requestSectionRevision,
  retryRun,
  runMaker,
  saveMemory,
  selectProjectSource,
  sendMessage,
  type MemoryEditKind,
  type PendingPermission,
  type WorkshopProject,
} from "../api.ts";
import { Brand } from "../components/Brand.tsx";
import { Markdown } from "../components/Markdown.tsx";
import { ProjectMemory } from "../components/ProjectMemory.tsx";
import { ProviderErrorCard } from "../components/ProviderErrorCard.tsx";
import { RevisionReview } from "../components/RevisionReview.tsx";
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
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<ProviderErrorDetails | null>(null);
  const [dismissedProviderOperationId, setDismissedProviderOperationId] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [permissions, setPermissions] = useState<PendingPermission[]>([]);
  const [liveMessage, setLiveMessage] = useState("Workshop ready.");
  const documentRef = useRef<HTMLElement | null>(null);
  const previousStage = useRef<string | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    void Promise.all([loadProject(), loadConnection()])
      .then(([loaded, native]) => {
        setProject(loaded);
        setConnection(native);
      })
      .catch((caught: unknown) => {
        setError(caught instanceof ApiError
          ? caught.message
          : "The workshop lost its connection. Reload before trying again.");
      });
  }, []);

  const activeRun = useMemo(
    () => project?.operations.find((operation) => operation.status === "RUNNING" || operation.status === "QUEUED") ?? null,
    [project],
  );
  const latestProviderOperation = useMemo(() => {
    const latest = project?.operations.at(-1) ?? null;
    return latest?.providerError ? latest : null;
  }, [project]);

  useEffect(() => {
    if (!activeRun) return;
    const timer = window.setInterval(() => {
      void loadProject().then(setProject).catch(() => {
        // A transient poll failure must not replace the visible project state.
      });
    }, 1_500);
    return () => window.clearInterval(timer);
  }, [activeRun?.id]);

  useEffect(() => {
    if (!connection || connection.deploymentMode === "hosted-demo") return;
    if (connection.state !== "connected" && connection.state !== "degraded") return;
    let cancelled = false;
    const load = async () => {
      try {
        const result = await loadPermissions();
        if (!cancelled) setPermissions(result.permissions);
      } catch {
        // Permission polling is best-effort; the run inspector still shows a pending state.
      }
    };
    void load();
    const timer = window.setInterval(load, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [connection?.state, connection?.deploymentMode, activeRun?.id]);

  useEffect(() => {
    if (!project) return;
    if (previousStage.current && previousStage.current !== project.stage) {
      documentRef.current?.focus();
      setLiveMessage(`${project.stage} stage ready.`);
    }
    previousStage.current = project.stage;
  }, [project?.stage]);

  useEffect(() => {
    if (busy) setLiveMessage("Working on your request.");
    else if (activeRun) setLiveMessage(`${runRoleName(activeRun)} is running in OpenCode.`);
    else if (permissions.length) setLiveMessage("OpenCode is waiting for permission.");
    else setLiveMessage("Workshop ready.");
  }, [busy, activeRun?.id, permissions.length]);

  async function refreshPermissions() {
    if (connection?.deploymentMode === "hosted-demo") return;
    try {
      const result = await loadPermissions();
      setPermissions(result.permissions);
    } catch {
      // Leave the last visible permission state rather than inventing an empty one.
    }
  }

  useEffect(() => {
    if (!project || selectedSectionId) return;
    if (project.currentSectionId) setSelectedSectionId(project.currentSectionId);
  }, [project, selectedSectionId]);

  async function act(work: () => Promise<{ project: WorkshopProject }>): Promise<boolean> {
    setBusy(true);
    setSlow(false);
    setError(null);
    setProviderError(null);
    const timer = window.setTimeout(() => setSlow(true), 8_000);
    try {
      const result = await work();
      setProject(result.project);
      return true;
    } catch (caught) {
      const loaded = await loadProject().catch(() => null);
      if (loaded) setProject(loaded);
      if (caught instanceof ApiError && caught.providerError) {
        setProviderError(caught.providerError);
      } else {
        setError(caught instanceof ApiError
          ? `${caught.message} ${caught.retryable ? "You can try a new request. The current section was not overwritten." : "Nothing was repeated."}`
          : "The workshop lost its connection. Reload before trying again.");
      }
      return false;
    } finally {
      window.clearTimeout(timer);
      setBusy(false);
      setSlow(false);
    }
  }

  if (!project || !connection) {
    return (
      <div className="workshop-shell">
        <WorkshopHeader connection={connection} model={null} onSetup={() => setSetupOpen(true)} onControls={() => setSetupOpen(true)} />
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

  const currentSection = project.sections.find((item) => item.id === project.currentSectionId) ?? null;
  const section = project.sections.find((item) => item.id === selectedSectionId) ?? currentSection;
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
  const storedProviderError = latestProviderOperation && latestProviderOperation.id !== dismissedProviderOperationId
    ? latestProviderOperation.providerError
    : null;
  const visibleProviderError = providerError ?? storedProviderError;
  const dismissProviderError = () => {
    setProviderError(null);
    if (latestProviderOperation) setDismissedProviderOperationId(latestProviderOperation.id);
  };

  if (!hostedDemo && project.source.status !== "CONFIRMED") {
    return (
      <div className="workshop-shell">
        <WorkshopHeader connection={connection} model={null} onSetup={() => setSetupOpen(true)} onControls={() => setSetupOpen(true)} />
        <main className="workshop workshop-onboarding">
          <ProjectSourceOnboarding project={project} busy={busy} act={act} />
          {error ? <p className="banner bad" role="alert">{error}</p> : null}
        </main>
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <div className="workshop-shell">
        <WorkshopHeader connection={connection} model={null} onSetup={() => setSetupOpen(true)} onControls={() => setSetupOpen(true)} />
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

  const hasActivity = project.operations.length > 0 || project.evidence.length > 0;
  const memoryCount = [
    ...project.memory.decisions,
    ...(project.memory.answers ?? []),
    ...(project.memory.assumptions ?? []),
    ...project.memory.constraints,
  ].filter((entry) => entry.status !== "SUPERSEDED").length + project.oracleIntake.unresolvedQuestions.length;
  const activityOpen = Boolean(activeRun || abandoned);
  const latestOperation = project.operations.at(-1) ?? null;

  return (
    <div className="workshop-shell">
      <a className="skip" href="#document">Skip to the main task</a>
      <WorkshopHeader
        connection={connection}
        model={selectedModel}
        onSetup={() => setSetupOpen(true)}
        onControls={openOpenCodePanel}
      />

      <main className="workshop">
        <header className="workshop-titlebar compact-titlebar">
          <div className="workshop-title-copy">
            <p className="eyebrow">Ghostlight Hacker Workshop</p>
            <p className="workshop-stage-name">{profile.name} · stage {stageIndex(project.stage) + 1} of 4</p>
            <p className="meta">Revision {project.revision} · {approved} of {project.sections.length} sections approved</p>
          </div>
          <div className="workshop-title-actions">
            <div className="workshop-character" aria-hidden="true">
              <SpiritCharacter id={profile.id} state={characterState} decorative />
            </div>
          </div>
        </header>

        <SpiritStageTabs stage={project.stage} />

        <details className="workshop-drawer outline-drawer">
          <summary>
            <span><BookOpen size={17} aria-hidden="true" /> Project outline</span>
            <span className="meta">{approved}/{project.sections.length} approved</span>
          </summary>
          <div className="workshop-drawer-body">
            <div className="progress-track" aria-hidden="true"><span style={{ width: `${(approved / project.sections.length) * 100}%` }} /></div>
            <ol className="section-list">
              {project.sections.map((item) => (
                <SectionCard
                  key={item.id}
                  section={item}
                  current={item.id === project.currentSectionId}
                  selected={item.id === section?.id}
                  onSelect={() => setSelectedSectionId(item.id)}
                />
              ))}
            </ol>
          </div>
        </details>

        <article
          className="document focused-document"
          id="document"
          ref={documentRef}
          tabIndex={-1}
          aria-busy={busy}
          aria-labelledby="main-task-title"
        >
          <div className="document-heading">
            <div>
              <p className="eyebrow">{project.stage}</p>
              <h1 id="main-task-title">{header}</h1>
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

          {permissions.length ? (
            <div className="permission-banner" role="alert" aria-labelledby="permission-banner-title">
              <ShieldAlert size={20} aria-hidden="true" />
              <div>
                <strong id="permission-banner-title">OpenCode is waiting for your permission.</strong>
                <p>{permissions[0].action} · {permissions[0].resources.join(", ")}</p>
              </div>
              <button className="action" type="button" onClick={openPermissionControls}>Review permission</button>
            </div>
          ) : null}

          {!connected ? (
            <div className="error-panel" role="status">
              <AlertTriangle size={18} aria-hidden="true" />
              <div>
                <strong>OpenCode is {connection.state.replaceAll("_", " ")}.</strong>
                <p>{connection.diagnostics[0]?.message ?? "The engine did not answer. Nothing was inferred."} The app will not substitute another model.</p>
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
              <strong>{runRoleName(activeRun)}</strong> is working in the background
              {activeRun.model ? ` with ${activeRun.model.providerID}/${activeRun.model.id}` : ""}
              {activeRun.progress?.phase
                ? ` — observed: ${activeRun.progress.phase.replaceAll("_", " ").toLowerCase()}`
                : ""}. The saved project updates when it finishes.
              <button className="action secondary" type="button" disabled={busy} onClick={() => void act(() => cancelRun(project, activeRun.id))}>Cancel run</button>
            </p>
          ) : null}
          {abandoned ? (
            <div className="warning-panel" role="status">
              <AlertTriangle size={18} aria-hidden="true" />
              <div>
                <strong>A native run was abandoned without a confirmed outcome and was not repeated.</strong>
                <p>Open Activity &amp; results to reconcile the native session before trying again.</p>
              </div>
            </div>
          ) : null}
          {slow ? <p className="banner" role="status">This is taking longer than usual. The saved section is unchanged until a response arrives.</p> : null}
          {visibleProviderError ? (
            <ProviderErrorCard
              error={visibleProviderError}
              onChangeModel={() => {
                dismissProviderError();
                setSetupOpen(true);
              }}
              onDismiss={dismissProviderError}
            />
          ) : null}
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
                  isCurrent={section.id === project.currentSectionId}
                  change={change}
                  setChange={setChange}
                  text={text}
                  setText={setText}
                  busy={busy}
                  act={act}
                  reduceMotion={reduceMotion}
                  onRequestChange={(request) => void act(async () => {
                    const result = await requestSectionRevision(project, section.id, request);
                    setChange("");
                    return result;
                  })}
                  onAcceptCandidate={(candidateId) => void act(() => acceptSectionRevision(project, section.id, candidateId))}
                  onRejectCandidate={(candidateId) => void act(() => rejectSectionRevision(project, section.id, candidateId))}
                  onRequestAnother={() => {
                    setChange("");
                    document.getElementById("architect-change")?.focus();
                  }}
                />
              ) : null}
              {project.stage === "ARCHITECT" && !section ? (
                <ScopePanel project={project} scope={scope} setScope={setScope} busy={busy} act={act} />
              ) : null}
              {project.stage === "MAKER" ? (
                <MakerPanel project={project} busy={busy} activeRun={activeRun} act={act} onChooseModel={() => setSetupOpen(true)} />
              ) : null}
              {project.stage === "WITNESS" ? (
                <WitnessPanel project={project} text={text} setText={setText} busy={busy} act={act} />
              ) : null}
            </>
          )}
        </article>

        {hasActivity ? (
          <details className="workshop-drawer activity-drawer" open={activityOpen}>
            <summary>
              <span><Sparkles size={17} aria-hidden="true" /> Activity &amp; results</span>
              <span className="meta">
                {latestOperation
                  ? `${runRoleName(latestOperation)} · ${latestOperation.status.replaceAll("_", " ").toLowerCase()}`
                  : `${project.evidence.length} check${project.evidence.length === 1 ? "" : "s"}`}
              </span>
            </summary>
            <div className="workshop-drawer-body">
              <RunInspector
                operations={project.operations}
                evidence={project.evidence}
                capabilities={project.capabilities}
                busy={busy}
                onReconcile={(operationId) => void act(() => reconcileRun(project, operationId))}
                onCancel={(operationId) => void act(() => cancelRun(project, operationId))}
                onRetry={(operationId) => void act(() => retryRun(project, operationId))}
                onAbandon={(operationId) => void act(() => abandonRun(project, operationId))}
                onOpenOpenCode={() => openOpenCodePanel()}
                note="This view never invents a result. Unknown runs and failed checks stay visible."
              />
            </div>
          </details>
        ) : null}

        <details className="workshop-drawer memory-drawer" open={memoryCount > 0}>
          <summary>
            <span><BookOpen size={17} aria-hidden="true" /> Project memory</span>
            <span className="meta">{memoryCount} recorded</span>
          </summary>
          <div className="workshop-drawer-body">
            <ProjectMemory
              project={project}
              busy={busy}
              onSave={(input: { kind: MemoryEditKind; text: string; supersedesId: string | null }) =>
                act(() => saveMemory(project, input.kind, input.text, input.supersedesId))}
            />
          </div>
        </details>

        <OpenCodePanel
          connection={connection}
          project={project}
          permissions={permissions}
          onConnection={setConnection}
          onProject={setProject}
          onOpenSetup={() => setSetupOpen(true)}
          onPermissionsChanged={refreshPermissions}
        />
      </main>
      <p className="visually-hidden" role="status" aria-live="polite">{liveMessage}</p>
    </div>
  );
}

function ProjectSourceOnboarding(props: {
  project: WorkshopProject;
  busy: boolean;
  act: (work: () => Promise<{ project: WorkshopProject }>) => Promise<boolean>;
}) {
  const [kind, setKind] = useState<"NEW_PROJECT" | "LOCAL_REPOSITORY" | "REMOTE_REPOSITORY" | "SAVED_PROJECT">("NEW_PROJECT");
  const [value, setValue] = useState("");
  const [replacePending, setReplacePending] = useState(false);

  if (props.project.source.status === "PENDING_CONFIRMATION" && !replacePending) {
    return (
      <section className="stage-panel source-onboarding" aria-labelledby="source-confirm-title">
        <div className="panel-intro">
          <span className="panel-icon"><ScrollText size={18} aria-hidden="true" /></span>
          <div>
            <p className="eyebrow">Project source · confirmation</p>
            <h1 id="source-confirm-title">Confirm the managed import workspace</h1>
            <p>The URL passed validation and contains no embedded credentials. The repository has not been imported and no agent has write access yet.</p>
          </div>
        </div>
        <div className="reading prose proposal-card">
          <h2>{props.project.source.label ?? "Remote repository"}</h2>
          <p>{props.project.source.repositoryUrl}</p>
          <p className="meta">The import stays inside the app-managed data directory. Confirmation permits the import; it does not approve a product, grant Maker write access, or start a run.</p>
        </div>
        <div className="actions">
          <button className="action" type="button" disabled={props.busy} onClick={() => void props.act(() => confirmRemoteSource(props.project))}>
            Confirm and import
          </button>
          <button className="action secondary" type="button" disabled={props.busy} onClick={() => setReplacePending(true)}>
            Choose a different source
          </button>
        </div>
      </section>
    );
  }

  const choices = [
    ["NEW_PROJECT", "New project", "Start discovery without an existing repository."],
    ["LOCAL_REPOSITORY", "Existing local repository", "Validate an existing directory with the workspace security policy."],
    ["REMOTE_REPOSITORY", "Remote repository URL", "Validate a credential-free HTTPS URL, then import only after confirmation."],
    ["SAVED_PROJECT", "Continue saved project", "Resume the project state already stored by this installation."],
  ] as const;
  const needsValue = kind === "LOCAL_REPOSITORY" || kind === "REMOTE_REPOSITORY";
  const submit = () => {
    if (kind === "LOCAL_REPOSITORY") return props.act(() => selectProjectSource(props.project, { kind, path: value.trim() }));
    if (kind === "REMOTE_REPOSITORY") return props.act(() => selectProjectSource(props.project, { kind, url: value.trim() }));
    if (kind === "SAVED_PROJECT") return props.act(() => selectProjectSource(props.project, { kind }));
    return props.act(() => selectProjectSource(props.project, { kind, label: value.trim() || null }));
  };

  return (
    <section className="stage-panel source-onboarding" aria-labelledby="source-title">
      <div className="panel-intro">
        <span className="panel-icon"><Sparkles size={18} aria-hidden="true" /></span>
        <div>
          <p className="eyebrow">Project source · step 1</p>
          <h1 id="source-title">Where is this project starting?</h1>
          <p>The Oracle uses this choice to ask relevant discovery questions. Choosing a source never approves a product or starts implementation.</p>
        </div>
      </div>
      <fieldset className="source-choice-grid">
        <legend className="sr-only">Choose a project source</legend>
        {choices.map(([id, label, description]) => (
          <label className={`source-choice ${kind === id ? "selected" : ""}`} key={id}>
            <input type="radio" name="project-source" value={id} checked={kind === id} onChange={() => { setKind(id); setValue(""); }} />
            <span><strong>{label}</strong><small>{description}</small></span>
          </label>
        ))}
      </fieldset>
      {kind === "LOCAL_REPOSITORY" ? (
        <label>Local repository path<input value={value} onChange={(event) => setValue(event.target.value)} placeholder="/path/to/repository" /></label>
      ) : kind === "REMOTE_REPOSITORY" ? (
        <label>Remote repository URL<input value={value} onChange={(event) => setValue(event.target.value)} placeholder="https://github.com/owner/repository.git" /></label>
      ) : kind === "NEW_PROJECT" ? (
        <label>Working name <span className="meta">optional</span><input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Untitled project" /></label>
      ) : null}
      <div className="actions">
        <button className="action" type="button" disabled={props.busy || (needsValue && !value.trim())} onClick={() => void submit()}>
          Continue to discovery
        </button>
      </div>
    </section>
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
        <a className="action ghost" href="/">Read the overview</a>
      </div>
      <p className="meta">All mutation, run, approval, and session-token routes are rejected in this mode.</p>
    </section>
  );
}

function WorkshopHeader({
  connection,
  model,
  onSetup,
  onControls,
}: {
  connection: ConnectionStatus | null;
  model: ReturnType<typeof findSelectedModel> | null;
  onSetup: () => void;
  onControls: () => void;
}) {
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
          <span className="header-model-inline" title={model ? `${model.providerID}/${model.id}` : "No model selected"}>
            {model ? model.name : "No model selected"}
          </span>
          <button className="engine-pill" type="button" onClick={onSetup} aria-label="Open OpenCode connection setup">
            <span className={live ? "engine-dot is-live" : warn ? "engine-dot is-warn" : "engine-dot"} aria-hidden="true" />
            {connection ? connectionLabel(state) : "Checking OpenCode"}
          </button>
          <button className="text-button header-controls" type="button" onClick={onControls}>
            <Settings2 size={15} aria-hidden="true" />
            <span className="header-controls-label">Model &amp; connection</span>
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

function OraclePanel(props: {
  project: WorkshopProject;
  text: string;
  setText: (value: string) => void;
  busy: boolean;
  act: (work: () => Promise<{ project: WorkshopProject }>) => Promise<boolean>;
}) {
  const proposal = props.project.product.proposal;
  const structured = props.project.product.structuredProposal;
  const questions = props.project.oracleIntake.unresolvedQuestions;
  const activeAnswers = (props.project.memory.answers ?? []).filter((entry) => entry.status !== "SUPERSEDED");
  const activeAssumptions = (props.project.memory.assumptions ?? []).filter((entry) => entry.status !== "SUPERSEDED");
  return (
    <section className="stage-panel" aria-labelledby="oracle-panel-title">
      <div className="panel-intro">
        <span className="panel-icon"><Sparkles size={18} aria-hidden="true" /></span>
        <div>
          <h2 id="oracle-panel-title">Oracle: guided project discovery</h2>
          <p>Answer a few focused questions at a time. The Oracle saves facts, decisions, and assumptions separately before proposing a product.</p>
        </div>
      </div>
      {proposal ? (
        <div className="reading prose proposal-card">
          <div className="proposal-head"><h3>{structured?.title ?? "Oracle proposal"}</h3><StatusChip status={props.project.product.status} /></div>
          <p>{structured?.summary ?? proposal}</p>
          {structured ? (
            <div className="proposal-evidence-grid">
              <div><h4>Facts</h4>{structured.facts.length ? <ul>{structured.facts.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="meta">None recorded.</p>}</div>
              <div><h4>User decisions</h4>{structured.userDecisions.length ? <ul>{structured.userDecisions.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="meta">None recorded.</p>}</div>
              <div><h4>Assumptions</h4>{structured.assumptions.length ? <ul>{structured.assumptions.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="meta">None.</p>}</div>
            </div>
          ) : null}
        </div>
      ) : questions.length ? (
        <div className="oracle-questions" aria-label="Oracle questions">
          {questions.map((question, index) => (
            <article className="reading proposal-card" key={question.id}>
              <p className="eyebrow">Question {index + 1} · {question.field}</p>
              <h3>{question.prompt}</h3>
              <p>{question.whyItMatters}</p>
              {question.suggestedChoices.length ? <p className="meta">Suggested choices: {question.suggestedChoices.join(" · ")}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Discovery is ready">Tell the Oracle what you want to build. It will ask only the highest-value follow-ups before proposing scope.</EmptyState>
      )}
      {(activeAnswers.length || activeAssumptions.length) ? (
        <details className="memory-card">
          <summary>Project memory · {activeAnswers.length} answers · {activeAssumptions.length} assumptions</summary>
          {activeAnswers.length ? <div><h4>Recorded answers</h4><ul>{activeAnswers.map((entry) => <li key={entry.id}><strong>{entry.field ?? "answer"}:</strong> {entry.text}</li>)}</ul></div> : null}
          {activeAssumptions.length ? <div><h4>Stated assumptions</h4><ul>{activeAssumptions.map((entry) => <li key={entry.id}><strong>{entry.field ?? "assumption"}:</strong> {entry.text}</li>)}</ul></div> : null}
        </details>
      ) : null}
      <label htmlFor="oracle-text">{proposal ? "Correction or follow-up" : questions.length ? "Your answers or corrections" : "Project goal"}</label>
      <textarea id="oracle-text" value={props.text} onChange={(event) => props.setText(event.target.value)} maxLength={8000} />
      <div className="actions">
        {proposal ? (
          <button className="action" type="button" disabled={props.busy} onClick={() => void props.act(() => approveProduct(props.project))}>
            Approve product
          </button>
        ) : (
          <button className="action" type="button" disabled={props.busy || props.text.trim().length < 1} onClick={() => void props.act(() => sendMessage(props.project, "clarify", props.text))}>
            {questions.length ? "Save answers" : "Begin discovery"}
          </button>
        )}
        {proposal ? (
          <button className="action secondary" type="button" disabled={props.busy || props.text.trim().length < 1} onClick={() => void props.act(() => sendMessage(props.project, "question", props.text))}>
            Ask a question
          </button>
        ) : null}
        {!proposal && props.text.trim().length > 0 ? (
          <button className="action secondary" type="button" disabled={props.busy} onClick={() => void props.act(() => sendMessage(props.project, "clarify", props.text, true))}>
            Proceed with stated assumptions
          </button>
        ) : null}
        {proposal && props.text.trim().length > 0 ? (
          <button className="action secondary" type="button" disabled={props.busy} onClick={() => void props.act(() => sendMessage(props.project, "clarify", props.text))}>
            Correct an answer
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ArchitectPanel(props: {
  project: WorkshopProject;
  section: WorkshopProject["sections"][number];
  isCurrent: boolean;
  change: string;
  setChange: (value: string) => void;
  text: string;
  setText: (value: string) => void;
  busy: boolean;
  reduceMotion: boolean | null;
  act: (work: () => Promise<{ project: WorkshopProject }>) => Promise<boolean>;
  onRequestChange: (request: string) => void;
  onAcceptCandidate: (candidateId: string) => void;
  onRejectCandidate: (candidateId: string) => void;
  onRequestAnother: () => void;
}) {
  const pending = props.section.candidateRevisions.findLast((candidate) => candidate.status === "PENDING") ?? null;
  const history = [...props.section.candidateRevisions].reverse();
  const approvals = props.project.approvals.filter((approval) => approval.sectionId === props.section.id);
  const contract = sectionContract(props.section.id);
  return (
    <section className="stage-panel" aria-labelledby="architect-panel-title">
      <div className="panel-intro">
        <span className="panel-icon"><ScrollText size={18} aria-hidden="true" /></span>
        <div>
          <h2 id="architect-panel-title">Architect: review one section</h2>
          <p>Request changes to generate a candidate, inspect the complete diff, then accept or discard it. Approval is always a separate exact-version action.</p>
        </div>
        <div className="panel-badges">
          <StatusChip status={props.section.status} />
          <span className="meta">v{props.section.version}</span>
          {!props.isCurrent ? <span className="meta">Reviewing an earlier section</span> : null}
        </div>
      </div>
      {props.section.status === "STALE" ? (
        <div className="warning-panel"><AlertTriangle size={18} aria-hidden="true" /><p>An upstream change marked this section stale. Review it again before approval counts.</p></div>
      ) : null}
      <div className="section-reading-head">
        <h3>Current draft · v{props.section.version}</h3>
        {props.section.status === "APPROVED" ? <Seal label="Section approved" reduceMotion={props.reduceMotion} /> : null}
      </div>
      {props.section.content ? (
        <div className="reading section-reading">
          <Markdown content={props.section.content} />
        </div>
      ) : (
        <EmptyState title="No draft yet">Draft this section or describe the change you want. Nothing is written until you accept a proposed revision.</EmptyState>
      )}
      {pending ? (
        <RevisionReview
          sectionTitle={props.section.title}
          currentContent={props.section.content}
          candidate={pending}
          busy={props.busy}
          onAccept={() => props.onAcceptCandidate(pending.id)}
          onReject={() => props.onRejectCandidate(pending.id)}
          onRequestAnother={props.onRequestAnother}
        />
      ) : null}
      <div className="actions">
        {props.section.status === "DRAFT" && props.isCurrent && !pending ? (
          <button className="action" type="button" disabled={props.busy} onClick={() => void props.act(() => approveSection(props.project, props.section.version, props.section.hash, props.section.id))}>
            Approve this draft
          </button>
        ) : null}
        <button
          className={props.section.status === "DRAFT" && props.isCurrent && !pending ? "action secondary" : "action"}
          type="button"
          disabled={props.busy || !props.isCurrent || Boolean(pending)}
          onClick={() => void props.act(() => sendMessage(props.project, "draft", props.text.trim() || `Draft ${props.section.title}`, false, props.section.id))}
        >
          {props.section.content ? "Draft a fresh candidate" : "Draft section"}
        </button>
        {!props.isCurrent ? <span className="meta">Only the current section can be drafted or approved. You can still request a change on this section.</span> : null}
      </div>
      {contract ? (
        <details className="contract-card">
          <summary>Section content contract</summary>
          <p>{contract.detailGuidance}</p>
          <div className="contract-grid">
            <div>
              <h4>Required topics</h4>
              <ul>{contract.requiredTopics.map((topic) => <li key={topic.id}>{topic.label}</li>)}</ul>
            </div>
            <div>
              <h4>Acceptance criteria</h4>
              <ul>{contract.acceptanceCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
            </div>
          </div>
        </details>
      ) : null}
      <div className="form-grid">
        <div>
          <label htmlFor="architect-question">Ask a question</label>
          <textarea id="architect-question" value={props.text} onChange={(event) => props.setText(event.target.value)} maxLength={8000} />
          <button className="action secondary" type="button" disabled={props.busy || props.text.trim().length < 1} onClick={() => void props.act(() => sendMessage(props.project, "question", props.text))}>
            Ask
          </button>
        </div>
        <div>
          <label htmlFor="architect-change">Describe the change you want</label>
          <textarea
            id="architect-change"
            value={props.change}
            onChange={(event) => props.setChange(event.target.value)}
            maxLength={8000}
            placeholder="Keep the current structure, but add the failure-recovery path and tighten the acceptance criteria."
          />
          <button className="action secondary" type="button" disabled={props.busy || props.change.trim().length < 1} onClick={() => props.onRequestChange(props.change.trim())}>
            Request changes
          </button>
          <p className="meta">This generates a proposed revision. The current draft is not replaced until you accept it.</p>
        </div>
      </div>
      {(history.length || approvals.length) ? (
        <details className="revision-history">
          <summary>Revision and approval history · {history.length} proposed · {approvals.length} approved</summary>
          {history.length ? (
            <div>
              <h4>Proposed revisions</h4>
              <ol>
                {history.map((candidate) => (
                  <li key={candidate.id} data-status={candidate.status}>
                    <strong>v{candidate.version} · {candidate.status.toLowerCase()}</strong>
                    <span className="meta"> {new Date(candidate.createdAt).toLocaleString()}</span>
                    <p>{candidate.summary || "No summary recorded."}</p>
                    {candidate.requestedChange ? <p className="meta">Requested: {candidate.requestedChange}</p> : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          {approvals.length ? (
            <div>
              <h4>Approvals</h4>
              <ol>
                {approvals.map((approval) => (
                  <li key={approval.id}>
                    <strong>v{approval.version}</strong>
                    <span className="meta"> {new Date(approval.approvedAt).toLocaleString()}</span>
                    {approval.staleReason ? <p className="meta">Stale: {approval.staleReason}</p> : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </details>
      ) : null}
    </section>
  );
}

function ScopePanel(props: {
  project: WorkshopProject;
  scope: string;
  setScope: (value: string) => void;
  busy: boolean;
  act: (work: () => Promise<{ project: WorkshopProject }>) => Promise<boolean>;
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
  act: (work: () => Promise<{ project: WorkshopProject }>) => Promise<boolean>;
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
  act: (work: () => Promise<{ project: WorkshopProject }>) => Promise<boolean>;
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
      </div>
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

function runRoleName(operation: WorkshopProject["operations"][number]): string {
  if (operation.kind === "maker") return "Maker";
  if (operation.kind === "witness") return "Witness";
  if (operation.intent === "clarify") return "Oracle";
  if (operation.intent === "draft") return "Architect";
  return "OpenCode";
}

/** Opens the model and connection controls without loading advanced diagnostics. */
function openOpenCodePanel(): void {
  const panel = document.getElementById("opencode-panel");
  if (!panel) return;
  const model = document.getElementById("opencode-model-connection");
  if (model instanceof HTMLDetailsElement) model.open = true;
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
  panel.focus();
}

/** Jumps to the contextual permission request, which stays outside collapsed diagnostics. */
function openPermissionControls(): void {
  const permission = document.getElementById("opencode-permission");
  if (!permission) return;
  permission.scrollIntoView({ behavior: "smooth", block: "center" });
  permission.querySelector<HTMLElement>("button, h2")?.focus();
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
