import { useEffect, useReducer, useRef } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Info,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Timer,
  X,
} from "lucide-react";
import {
  DEMO_BEAT_MS,
  DEMO_PRESENTATION_BEAT_MS,
  DEMO_PRESENTATION_TOTAL_MS,
  demoFixture,
  evidenceForBeat,
  operationsForBeat,
  sectionForBeat,
  type DemoBeat,
} from "../../shared/demo.ts";
import { modeDescriptor } from "../../shared/modes.ts";
import { Brand } from "../components/Brand.tsx";
import { RunInspector } from "../components/RunInspector.tsx";
import { SpiritCharacter, type SpiritState } from "../components/SpiritCharacter.tsx";
import { SpiritStageTabs } from "../components/SpiritStageTabs.tsx";
import { StatusChip } from "../components/StatusChip.tsx";
import { spiritProfile, spiritProfiles, type SpiritId } from "../spirits.ts";
import {
  currentBeat,
  demoPlaybackReducer,
  focusedSpirit,
  initialDemoPlayback,
  presentationFromSearch,
  presentationSearch,
} from "./playback.ts";

const stateGallery: Record<SpiritId, SpiritState[]> = {
  oracle: ["idle", "listening", "clarification"],
  architect: ["idle", "drawing", "approval"],
  maker: ["idle", "building", "permission", "blocked", "success"],
  witness: ["idle", "scanning", "evidence", "warning", "stamp"],
};

export function DemoPage() {
  const [playback, dispatch] = useReducer(
    demoPlaybackReducer,
    undefined,
    () => initialDemoPlayback(typeof window !== "undefined" && presentationFromSearch(window.location.search)),
  );
  const guidedRef = useRef<HTMLDivElement>(null);
  const beat = currentBeat(playback);
  const focus = focusedSpirit(playback);
  const focusProfile = spiritProfile(focus);
  const inspecting = playback.inspected !== null && playback.inspected !== beat.spirit;
  const demoMode = modeDescriptor("demo");

  useEffect(() => {
    if (!playback.playing) return;
    const duration = playback.presentation ? DEMO_PRESENTATION_BEAT_MS : DEMO_BEAT_MS;
    const timer = window.setTimeout(() => dispatch({ type: "tick" }), duration);
    return () => window.clearTimeout(timer);
  }, [playback.playing, playback.presentation, playback.index]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const search = presentationSearch(window.location.search, playback.presentation);
    window.history.replaceState(null, "", `${window.location.pathname}${search}${window.location.hash}`);
  }, [playback.presentation]);

  function startPresentation() {
    dispatch({ type: "present" });
    window.requestAnimationFrame(() => guidedRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }

  function selectTab(spirit: SpiritId) {
    dispatch({ type: "inspect", spirit });
  }

  return (
    <>
      <a className="skip" href="#demo-main">Skip to the guided example</a>
      <header className="site-header demo-header">
        <div className="site-header-inner">
          <Brand />
          <div className="site-header-actions">
            <span className="demo-mode-badge">Recorded sample</span>
            <a className="text-link" href="/">Overview</a>
            <a className="action" href="/workshop">Run locally</a>
          </div>
        </div>
      </header>

      <main id="demo-main" className={`demo-page${playback.presentation ? " demo-presentation" : ""}`}>
        <section className="demo-intro" aria-labelledby="demo-page-title">
          <div>
            <p className="eyebrow">Guided sample</p>
            <h1 id="demo-page-title">{demoFixture.scenario.name}</h1>
            <p>
              Follow one abandoned open-source project through four honest steps: clarify the idea, approve
              the plan, build one bounded change with OpenCode, and verify the result.
            </p>
            <div className="demo-intro-actions">
              <button className="action" type="button" onClick={() => dispatch({ type: "replay" })}>
                <Play size={17} aria-hidden="true" /> Play the sample
              </button>
              <button className="action secondary" type="button" onClick={startPresentation}>
                <Timer size={17} aria-hidden="true" /> Play the 90-second version
              </button>
              <a className="action ghost" href="/workshop">Run locally</a>
            </div>
          </div>
          <aside className="demo-honesty" aria-label="What this demo is">
            <Info size={20} aria-hidden="true" />
            <h2>What this is</h2>
            <p>
              This is a recorded sample. No model, provider, repository, or visitor state is used.
            </p>
            <details className="demo-honesty-details">
              <summary>Sample details</summary>
              <p>{demoFixture.sourceLabel}. No OpenCode session, provider call, repository read, or model quota is used.</p>
              <ul>
                <li>Every run, diff, check, and finding is recorded sample data.</li>
                <li>The live session remains <strong>NOT_RUN</strong>.</li>
                <li>Reset changes only this sample.</li>
              </ul>
            </details>
          </aside>
        </section>

        <section className="demo-playback" aria-label="Guided playback controls" ref={guidedRef}>
          <div className="demo-playback-top">
            <div>
              <p className="eyebrow">{playback.presentation ? "90-second presentation" : "Guided playback"}</p>
              <p className="demo-playback-status" role="status" aria-live="polite">
                {playback.completed ? "Complete" : playback.playing ? "Playing" : "Paused"} · Step {playback.index + 1} of {demoFixture.beats.length}
              </p>
            </div>
            <div className="demo-progress-wrap">
              <div
                className="demo-progress-track"
                role="progressbar"
                aria-label="Demo progress"
                aria-valuemin={1}
                aria-valuemax={demoFixture.beats.length}
                aria-valuenow={playback.index + 1}
              >
                <span style={{ width: `${((playback.index + 1) / demoFixture.beats.length) * 100}%` }} />
              </div>
              <span className="meta">
                {playback.presentation
                  ? `${DEMO_PRESENTATION_TOTAL_MS / 1000}s recording path`
                  : `${demoFixture.beats.length} steps · ${DEMO_BEAT_MS / 1000}s each`}
              </span>
            </div>
          </div>
          <div className="demo-controls">
            <button className="action secondary" type="button" onClick={() => dispatch({ type: "previous" })} aria-label="Previous step">
              <SkipBack size={16} aria-hidden="true" /> Previous
            </button>
            <button className="action" type="button" onClick={() => dispatch({ type: "toggle" })} aria-label={playback.playing ? "Pause" : "Play"}>
              {playback.playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
              {playback.playing ? "Pause" : "Play"}
            </button>
            <button className="action secondary" type="button" onClick={() => dispatch({ type: "next" })} aria-label="Next step">
              Next <SkipForward size={16} aria-hidden="true" />
            </button>
            <button className="action secondary" type="button" onClick={() => dispatch({ type: "replay" })} aria-label="Replay from the beginning">
              <RotateCcw size={16} aria-hidden="true" /> Replay
            </button>
            <button className="action secondary" type="button" onClick={() => dispatch({ type: "reset" })} aria-label="Reset demo">
              <X size={16} aria-hidden="true" /> Reset
            </button>
            {playback.presentation ? (
              <button className="action ghost" type="button" onClick={() => dispatch({ type: "exit-presentation" })}>
                Exit presentation
              </button>
            ) : (
              <button className="action ghost" type="button" onClick={startPresentation}>
                <Timer size={16} aria-hidden="true" /> 90s mode
              </button>
            )}
          </div>
          {playback.inspected ? (
            <p className="demo-inspect-note" role="status">
              Playback paused so you can inspect {spiritProfile(playback.inspected).name}. Resume when ready.
            </p>
          ) : null}
        </section>

        <SpiritStageTabs
          stage={beat.stage}
          activeStage={focusProfile.stage}
          onSelect={selectTab}
          ariaLabel="Inspect the four spirits"
        />

        <div className="demo-guided-grid">
          <article className="demo-beat-card" aria-live="polite" data-demo="true" data-beat={beat.id}>
            <div className="demo-beat-art">
              <SpiritCharacter id={beat.spirit} state={beat.state} label={`${spiritProfile(beat.spirit).name} in the ${beat.state} state`} />
              <StatusChip status="fixture" label="Sample data" />
            </div>
            <div className="demo-beat-copy">
              <p className="eyebrow">{beat.stage} · Step {playback.index + 1} of {demoFixture.beats.length}</p>
              <h2>{beat.title}</h2>
              <p className="demo-summary">{beat.summary}</p>
              <p>{beat.detail}</p>
              <p className="demo-callout"><strong>Guided callout.</strong> {beat.callout}</p>
              {inspecting ? (
                <p className="demo-inspect-note">
                  Inspecting {focusProfile.name}. The guided step is still {spiritProfile(beat.spirit).name}.
                </p>
              ) : null}
            </div>
          </article>

          <aside className="demo-workspace" aria-label={`${focusProfile.name} workspace`} data-demo="true">
            <div className="panel-head">
              <div>
                <p className="eyebrow">{focusProfile.role}</p>
                <h2>{focusProfile.name} tab</h2>
              </div>
              <StatusChip status={focus === beat.spirit ? "fixture" : "inspect"} label={focus === beat.spirit ? "Current" : "Inspecting"} />
            </div>
            <SpiritWorkspace spirit={focus} beat={beat} />
          </aside>
        </div>

        {!playback.presentation ? (
          <section className="demo-inspector-section" aria-labelledby="demo-inspector-title">
            <div className="section-heading">
              <p className="eyebrow">Sample evidence</p>
              <h2 id="demo-inspector-title">The same evidence view, with recorded data</h2>
              <p>
                The workshop renders this component from live operations. Here every row is labeled sample
                data, and the missing live session stays visible.
              </p>
            </div>
            <RunInspector
              operations={operationsForBeat(beat)}
              evidence={evidenceForBeat(beat)}
              capabilities={demoFixture.project.capabilities}
              eyebrow="Recorded sample evidence"
              title="Observed result, including the missing live proof"
              note="Every row is recorded sample data. The passing check is not live; the live session is NOT_RUN."
              sourceLabel="Recorded sample"
              demo
            />
          </section>
        ) : null}

        <section className="demo-evidence-section" id="fixture-evidence" aria-labelledby="fixture-evidence-title">
          <div className="section-heading">
            <p className="eyebrow">Recorded sample evidence</p>
            <h2 id="fixture-evidence-title">Representative diff and recorded check</h2>
            <p>{demoFixture.diff.sourceLabel}. The source label stays visible with the result.</p>
          </div>
          <div className="demo-evidence-grid">
            <article className="demo-diff" data-demo="true">
              <div className="panel-head">
                <h3>Representative diff</h3>
                <StatusChip status="fixture" label="Sample data" />
              </div>
              <p>{demoFixture.diff.summary}</p>
              {demoFixture.diff.files.map((file) => (
                <div className="demo-diff-file" key={file.path}>
                  <div className="demo-file-head">
                    <span className="mono">{file.path}</span>
                    <span className="meta">+{file.additions} −{file.deletions}</span>
                  </div>
                  <pre className="demo-diff-code" aria-label={`Diff for ${file.path}`}>
                    {file.hunks.map((hunk) => (
                      <span key={hunk.header}>
                        <span className="diff-line diff-header">{hunk.header}</span>
                        {hunk.lines.map((line, index) => (
                          <span className={`diff-line diff-${line.type === "+" ? "add" : line.type === "-" ? "remove" : "context"}`} key={`${hunk.header}-${index}`}>
                            {line.type} {line.text}
                          </span>
                        ))}
                      </span>
                    ))}
                  </pre>
                </div>
              ))}
            </article>

            <article className="demo-check" data-demo="true">
              <div className="panel-head">
                <h3>Recorded check</h3>
                <StatusChip status={demoFixture.verification.result} />
              </div>
              <p className="mono demo-command">{demoFixture.verification.command}</p>
              <p>{demoFixture.verification.summary}</p>
              <pre className="demo-check-output" aria-label="Recorded check output">
                {demoFixture.verification.output.join("\n")}
              </pre>
              <p className="meta">Tested fingerprint: {demoFixture.verification.testedFingerprint}</p>
              <p className="demo-limitation">{demoFixture.verification.limitation}</p>
            </article>
          </div>
        </section>

        <section className="demo-witness-section" aria-labelledby="witness-review-title">
          <div className="section-heading">
            <p className="eyebrow">Witness review</p>
            <h2 id="witness-review-title">Findings, readiness, and the next honest step</h2>
            <p>Pass, limitation, and missing proof stay separate. A review draft is not a submitted article.</p>
          </div>
          <div className="demo-witness-grid">
            <article className="demo-findings" data-demo="true">
              <h3>Findings</h3>
              <ul>
                {demoFixture.witness.findings.map((finding) => (
                  <li key={finding.text} data-kind={finding.kind}>
                    <StatusChip status={finding.kind} label={finding.kind} />
                    <p>{finding.text}</p>
                  </li>
                ))}
              </ul>
            </article>
            <article className="demo-readiness" data-demo="true">
              <h3>Submission readiness</h3>
              <p>{demoFixture.witness.readiness}</p>
              <h3>Next actions</h3>
              <ol>
                {demoFixture.witness.nextActions.map((action) => <li key={action}>{action}</li>)}
              </ol>
            </article>
          </div>
        </section>

        {!playback.presentation ? (
          <>
            <section className="demo-gallery-section" id="spirit-states" aria-labelledby="gallery-title">
              <div className="section-heading">
                <p className="eyebrow">Character states</p>
                <h2 id="gallery-title">Every spirit, every state</h2>
                <p>Idle motion is subtle; working, blocked, warning, and success states are tied to workflow status.</p>
              </div>
              <div className="state-gallery">
                {spiritProfiles.map((spirit) => (
                  <div className="state-gallery-group" key={spirit.id}>
                    <h3>{spirit.name}</h3>
                    <p>{spirit.form}</p>
                    <ul>
                      {stateGallery[spirit.id].map((state) => {
                        const definition = spirit.states.find((item) => item.id === state);
                        return (
                          <li key={state} data-testid={`spirit-state-${spirit.id}-${state}`}>
                            <SpiritCharacter id={spirit.id} state={state} label={`${spirit.name}, ${definition?.label ?? state}`} />
                            <span className="state-gallery-label">{definition?.label ?? state}</span>
                            <span className="state-gallery-description">{definition?.description}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <section className="demo-recovery-section" id="recovery-states" aria-labelledby="recovery-title">
              <div className="section-heading">
                <p className="eyebrow">Recovery and reset</p>
                <h2 id="recovery-title">Pause, inspect, resume, or reset without touching live state</h2>
                <p>These are representative states, not live events. Reset affects only this sample.</p>
              </div>
              <div className="recovery-grid">
                <article className="recovery-card" data-testid="demo-recovery">
                  <StatusChip status="ABANDONED" />
                  <h3>Native run abandoned</h3>
                  <p>The connection dropped after OpenCode started. The app does not repeat the action automatically.</p>
                  <button className="action secondary" type="button" disabled>Reconcile native session</button>
                </article>
                <article className="recovery-card">
                  <StatusChip status="BLOCKED" />
                  <h3>Permission refused</h3>
                  <p>OpenCode denied the requested tool. Workflow approval does not override the native decision.</p>
                  <p className="meta">No retry was attempted.</p>
                </article>
                <article className="recovery-card">
                  <StatusChip status="ENGINE_UNAVAILABLE" label="Engine unreachable" />
                  <h3>OpenCode is not reachable</h3>
                  <p>The workshop keeps the saved section unchanged and tells you to start the engine before retrying.</p>
                  <p className="meta">Loopback connection failed.</p>
                </article>
                <article className="recovery-card">
                  <StatusChip status="NOT_RUN" label="Empty evidence" />
                  <h3>No check observed</h3>
                  <p>There is no evidence row until a native result exists. Empty is an honest state, not a pass.</p>
                  <button className="action secondary" type="button" onClick={() => dispatch({ type: "reset" })}>Reset demo</button>
                </article>
              </div>
            </section>
          </>
        ) : null}

        <section className="demo-bottom-cta">
          <div>
            <p className="eyebrow">Clean exit</p>
            <h2>Ready to do the real thing?</h2>
            <p>Start OpenCode locally, connect the workshop, and replace recorded sample evidence with a native result.</p>
          </div>
          <div className="final-actions">
            <a className="action action-large" href="/workshop">Run locally <ArrowRight size={18} aria-hidden="true" /></a>
            <a className="action action-large secondary" href="/#local-setup">Local setup</a>
          </div>
          <p className="demo-capability-note">
            <Check size={15} aria-hidden="true" /> {demoMode.capabilities.find((item) => item.id === "mutations")?.detail}
          </p>
        </section>
      </main>

      <footer className="site-footer">
        <Brand compact />
        <p>Recorded sample. No live model call, no fabricated result.</p>
        <nav aria-label="Footer">
          <a href="/">Overview</a>
          <a href="/workshop">Workshop</a>
          <a href="/#privacy">Privacy</a>
        </nav>
      </footer>
    </>
  );
}

function SpiritWorkspace({ spirit, beat }: { spirit: SpiritId; beat: DemoBeat }) {
  if (spirit === "oracle") {
    return (
      <div className="demo-workspace-body">
        <p>{demoFixture.oracle.clarification}</p>
        <div className="demo-reading">
          <h3>Approved product summary</h3>
          <p>{demoFixture.oracle.approvedSummary}</p>
        </div>
        <h3>Resolved questions</h3>
        <ul className="check-list">
          {demoFixture.oracle.resolvedQuestions.map((question) => <li key={question}><Check size={14} aria-hidden="true" /><span>{question}</span></li>)}
        </ul>
        <p className="meta">Status: product approved. The proposal alone was not approval.</p>
      </div>
    );
  }

  if (spirit === "architect") {
    const section = sectionForBeat(beat) ?? demoFixture.project.sections[0];
    return (
      <div className="demo-workspace-body">
        <ol className="demo-section-list">
          {demoFixture.project.sections.map((item) => (
            <li key={item.id} data-status={item.status}>
              <span>{String(item.order).padStart(2, "0")} · {item.title}</span>
              <span className="demo-section-meta"><StatusChip status={item.status} /> v{item.version}</span>
            </li>
          ))}
        </ol>
        <div className="demo-reading">
          <h3>{section.title} · v{section.version}</h3>
          <p className="prose">{section.content}</p>
        </div>
        <div className="demo-revision-note">
          <strong>Revision trail</strong>
          {demoFixture.revisions.map((revision) => (
            <p key={revision.sectionId}>
              {revision.sectionId}: v{revision.fromVersion} → v{revision.toVersion}. {revision.summary}
            </p>
          ))}
        </div>
      </div>
    );
  }

  if (spirit === "maker") {
    const operations = operationsForBeat(beat);
    return (
      <div className="demo-workspace-body">
        <div className="scope-card">
          <span className="meta">Maker authorization</span>
          <p>{demoFixture.makerAuthorization}</p>
        </div>
        <h3>Run progress</h3>
        {operations.length === 0 ? (
          <p className="meta">No Maker run is visible in this beat. Step to the run, diff, or check beat.</p>
        ) : (
          <ul className="demo-run-list">
            {operations.map((operation) => (
              <li key={operation.id}>
                <span className="meta">{operation.kind}</span>
                <StatusChip status={operation.status} />
                <p>{operation.result ?? "No result recorded."}</p>
                <p className="meta">{operation.nativeSessionId ? `Sample session ${operation.nativeSessionId}` : "No session reference"}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="meta">OpenCode remains the native tool-permission authority. This panel replays a recorded sample, not a live session.</p>
      </div>
    );
  }

  return (
    <div className="demo-workspace-body">
      <h3>Findings</h3>
      <ul className="demo-findings-list">
        {demoFixture.witness.findings.map((finding) => (
          <li key={finding.text} data-kind={finding.kind}>
            <StatusChip status={finding.kind} label={finding.kind} />
            <p>{finding.text}</p>
          </li>
        ))}
      </ul>
      <h3>Submission readiness</h3>
      <p>{demoFixture.witness.readiness}</p>
      <h3>Next actions</h3>
      <ol className="demo-next-list">
        {demoFixture.witness.nextActions.map((action) => <li key={action}>{action}</li>)}
      </ol>
    </div>
  );
}
