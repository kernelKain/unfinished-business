import { useState } from "react";
import { ArrowLeft, ArrowRight, Info, RotateCcw } from "lucide-react";
import { Brand } from "../components/Brand.tsx";
import { RunInspector } from "../components/RunInspector.tsx";
import { SpiritCharacter, type SpiritState } from "../components/SpiritCharacter.tsx";
import { StatusChip } from "../components/StatusChip.tsx";
import {
  demoCapabilities,
  demoEvidence,
  demoOperations,
  demoSteps,
} from "../content/landing.ts";
import { spiritProfiles, type SpiritId } from "../spirits.ts";

const stateGallery: Record<SpiritId, SpiritState[]> = {
  oracle: ["idle", "listening", "clarification"],
  architect: ["idle", "drawing", "approval"],
  maker: ["idle", "building", "permission", "blocked", "success"],
  witness: ["idle", "scanning", "evidence", "warning", "stamp"],
};

export function DemoPage() {
  const [index, setIndex] = useState(0);
  const step = demoSteps[index];

  return (
    <>
      <a className="skip" href="#demo-main">Skip to the walkthrough</a>
      <header className="site-header demo-header">
        <div className="site-header-inner">
          <Brand />
          <div className="site-header-actions">
            <a className="text-link" href="/">Back to overview</a>
            <a className="action" href="/workshop">Open the real workshop</a>
          </div>
        </div>
      </header>

      <main id="demo-main" className="demo-page">
        <section className="demo-intro" aria-labelledby="demo-page-title">
          <div>
            <p className="eyebrow">Deterministic walkthrough</p>
            <h1 id="demo-page-title">A scripted look at the four handoffs</h1>
            <p>
              This page never calls OpenCode or a model. It shows the interface states, approval boundaries,
              and evidence wording with fixture data. Real work happens only in the workshop with a connected engine.
            </p>
            <div className="demo-intro-actions">
              <a className="action" href="/workshop">Connect and run for real</a>
              <a className="action secondary" href="/#local-setup">Local setup</a>
            </div>
          </div>
          <aside className="demo-honesty" aria-label="What this demo proves">
            <Info size={20} aria-hidden="true" />
            <h2>What this proves</h2>
            <ul>
              <li>The four stages and their permission language.</li>
              <li>How failures and missing evidence are displayed.</li>
              <li>Not live inference, not a successful build, not remote repository access.</li>
            </ul>
          </aside>
        </section>

        <nav className="demo-stepper" aria-label="Walkthrough steps">
          <ol>
            {demoSteps.map((item, itemIndex) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="demo-step-button"
                  aria-current={itemIndex === index ? "step" : undefined}
                  onClick={() => setIndex(itemIndex)}
                >
                  <span className="demo-step-number">{String(itemIndex + 1).padStart(2, "0")}</span>
                  <span>{item.stage}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <section className="demo-main-card" aria-live="polite">
          <div className="demo-main-art">
            <SpiritCharacter id={step.spirit} state={step.state} label={`${step.spirit} in the ${step.state} state`} />
            <StatusChip status="fixture" label="Scripted sample" />
          </div>
          <div className="demo-main-copy">
            <p className="eyebrow">Step {index + 1} of {demoSteps.length}</p>
            <h2>{step.title}</h2>
            <p className="demo-summary">{step.summary}</p>
            <p>{step.detail}</p>
            <ul className="demo-lines">
              {step.lines.map((line) => <li key={line}>{line}</li>)}
            </ul>
            <div className="demo-buttons">
              <button className="action secondary" type="button" onClick={() => setIndex(index === 0 ? demoSteps.length - 1 : index - 1)}>
                <ArrowLeft size={16} aria-hidden="true" /> Back
              </button>
              <button className="action secondary" type="button" onClick={() => setIndex(0)}>
                <RotateCcw size={16} aria-hidden="true" /> Restart
              </button>
              <button className="action" type="button" onClick={() => setIndex((index + 1) % demoSteps.length)}>
                Next <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        <section className="demo-inspector-section" aria-labelledby="demo-inspector-title">
          <div className="section-heading">
            <p className="eyebrow">Fixture evidence</p>
            <h2 id="demo-inspector-title">The Run Inspector keeps the failure visible</h2>
            <p>The same component appears in the workshop with real native session references when a run exists.</p>
          </div>
          <RunInspector
            operations={demoOperations}
            evidence={demoEvidence}
            capabilities={demoCapabilities}
            eyebrow="Fixture inspector"
            title="Observed result, including the failure"
            note="Fixture IDs are labeled and are not a live session. The failing check is shown as failing."
          />
        </section>

        <section className="demo-gallery-section" id="spirit-states" aria-labelledby="gallery-title">
          <div className="section-heading">
            <p className="eyebrow">Character states</p>
            <h2 id="gallery-title">Every spirit, every state</h2>
            <p>Idle motion is subtle; working, blocked, warning, and success states are tied to actual workflow status.</p>
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
            <p className="eyebrow">Error and empty states</p>
            <h2 id="recovery-title">Recovery without pretending</h2>
            <p>These are representative UI states, not live events.</p>
          </div>
          <div className="recovery-grid">
            <article className="recovery-card" data-testid="demo-recovery">
              <StatusChip status="UNKNOWN" />
              <h3>Native run unknown</h3>
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
            </article>
          </div>
        </section>

        <section className="demo-bottom-cta">
          <h2>Ready to do the real thing?</h2>
          <p>Start OpenCode locally, connect the workshop, and keep every failure visible.</p>
          <div className="final-actions">
            <a className="action action-large" href="/workshop">Open the workshop</a>
            <a className="action action-large secondary" href="/#local-setup">Read local setup</a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <Brand compact />
        <p>Deterministic demo. No live model call, no fabricated result.</p>
        <nav aria-label="Footer">
          <a href="/">Overview</a>
          <a href="/workshop">Workshop</a>
          <a href="/#privacy">Privacy</a>
        </nav>
      </footer>
    </>
  );
}
