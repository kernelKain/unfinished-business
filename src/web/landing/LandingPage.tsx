import { useState } from "react";
import {
  ArrowRight,
  Check,
  Cpu,
  FileCheck2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Brand } from "../components/Brand.tsx";
import { RunInspector } from "../components/RunInspector.tsx";
import { SetupCommandTabs } from "../components/SetupCommandTabs.tsx";
import { SetupDialog } from "../components/SetupDialog.tsx";
import { SpiritCharacter } from "../components/SpiritCharacter.tsx";
import { StatusChip } from "../components/StatusChip.tsx";
import {
  demoCapabilities,
  demoEvidence,
  demoOperations,
  faqs,
  privacyPoints,
  recommendations,
  usageModes,
} from "../content/landing.ts";
import { DemoTeaser } from "./DemoTeaser.tsx";
import { Hero } from "./Hero.tsx";
import { SpiritRoster } from "./SpiritRoster.tsx";

export function LandingPage() {
  const [connectOpen, setConnectOpen] = useState(false);

  return (
    <>
      <a className="skip" href="#main-content">Skip to main content</a>
      <header className="site-header">
        <div className="site-header-inner">
          <Brand />
          <nav className="site-nav" aria-label="Primary">
            <a href="#workflow">Workflow</a>
            <a href="#demo">Demo</a>
            <a href="#controls">Controls</a>
            <a href="#local-setup">Setup</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="site-header-actions">
            <button className="text-button" type="button" onClick={() => setConnectOpen(true)}>Connect OpenCode</button>
            <a className="action" href="/workshop">Open workshop</a>
          </div>
        </div>
      </header>

      <main id="main-content">
        <Hero />

        <section className="positioning" aria-labelledby="positioning-title">
          <div className="positioning-copy">
            <p className="eyebrow">OpenCode is the engine</p>
            <h2 id="positioning-title">A workshop around the coding harness you can inspect.</h2>
            <p>
              Unfinished Business does not rebuild the agent loop. OpenCode owns the model route, tools,
              permissions, execution, interruption, and native sessions. This product owns the staged
              approvals, dependency ghosts, and evidence views around that work.
            </p>
          </div>
          <ul className="positioning-points">
            <li><Cpu size={20} aria-hidden="true" /><span><strong>One engine.</strong> No second coding harness, no copied transcript database.</span></li>
            <li><FileCheck2 size={20} aria-hidden="true" /><span><strong>Exact-version approvals.</strong> A changed section makes the old approval stale.</span></li>
            <li><ShieldCheck size={20} aria-hidden="true" /><span><strong>Honest evidence.</strong> A check appears only when its native result is observed.</span></li>
          </ul>
        </section>

        <section className="section" id="modes" aria-labelledby="modes-title">
          <div className="section-heading">
            <p className="eyebrow">Two ways to use it</p>
            <h2 id="modes-title">Choose the honest path for the moment</h2>
            <p>Both paths use the same four-stage workflow. Neither path silently reaches into a visitor's local repository.</p>
          </div>
          <div className="mode-grid">
            {usageModes.map((mode) => (
              <article className={`mode-card mode-${mode.tone}`} key={mode.id}>
                <div className="mode-top">
                  <p className="eyebrow">{mode.kicker}</p>
                  {mode.id === "hosted" ? <StatusChip status="sample" label="Labeled sample" /> : <StatusChip status="local" label="Full mode" />}
                </div>
                <h3>{mode.title}</h3>
                <p>{mode.summary}</p>
                <ul className="check-list">
                  {mode.bullets.map((bullet) => <li key={bullet}><Check size={15} aria-hidden="true" /><span>{bullet}</span></li>)}
                </ul>
                <a className="text-link" href={mode.cta.href}>{mode.cta.label} <ArrowRight size={15} aria-hidden="true" /></a>
              </article>
            ))}
          </div>
        </section>

        <SpiritRoster />
        <DemoTeaser />

        <section className="section controls-section" id="controls" aria-labelledby="controls-title">
          <div className="section-heading">
            <p className="eyebrow">OpenCode controls and evidence</p>
            <h2 id="controls-title">See what the engine did — and what it refused</h2>
            <p>
              The Run Inspector is a read-only view over native session references and observed results.
              Workflow approval never overrides a native denial.
            </p>
          </div>
          <div className="controls-grid">
            <div className="controls-copy">
              <div className="control-card">
                <span className="control-icon"><Wrench size={20} aria-hidden="true" /></span>
                <h3>Maker scope is separate</h3>
                <p>Plan approval does not start an edit. Maker needs an explicit statement, and OpenCode still owns the tool permission.</p>
              </div>
              <div className="control-card">
                <span className="control-icon"><LockKeyhole size={20} aria-hidden="true" /></span>
                <h3>Unknown is not success</h3>
                <p>A disconnected run stays unknown until its native session is reconciled. The app does not repeat uncertain execution.</p>
              </div>
              <div className="control-card">
                <span className="control-icon"><Sparkles size={20} aria-hidden="true" /></span>
                <h3>Evidence has a source</h3>
                <p>Each check points at a native result. A missing or failed result remains visible instead of becoming a green badge.</p>
              </div>
              <p className="fixture-note">The inspector below uses labeled fixture data from the deterministic walkthrough.</p>
            </div>
            <RunInspector
              operations={demoOperations}
              evidence={demoEvidence}
              capabilities={demoCapabilities}
              eyebrow="Fixture inspector"
              title="What evidence looks like"
              note="This preview is scripted. Real sessions show their own native references and results."
            />
          </div>
        </section>

        <section className="section recommendations" id="recommendations" aria-labelledby="recommendations-title">
          <div className="section-heading">
            <p className="eyebrow">Idea to tool recommendation</p>
            <h2 id="recommendations-title">Small capabilities, explicitly chosen</h2>
            <p>
              The workshop recommends from the current capability set. It does not install packages or widen
              permissions to make an idea fit.
            </p>
          </div>
          <div className="recommendation-table" role="table" aria-label="Example idea to tool recommendations">
            <div className="recommendation-row recommendation-head" role="row">
              <span role="columnheader">Unfinished idea</span>
              <span role="columnheader">Likely fit</span>
              <span role="columnheader">Recommended path</span>
              <span role="columnheader">Permission boundary</span>
            </div>
            {recommendations.map((item) => (
              <div className="recommendation-row" role="row" key={item.idea}>
                <span role="cell" className="recommendation-idea">{item.idea}</span>
                <span role="cell">{item.fit}</span>
                <span role="cell"><span className="recommendation-path">{item.path}</span></span>
                <span role="cell" className="recommendation-permission">{item.permission}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="section setup-section" id="local-setup" aria-labelledby="setup-title">
          <div className="section-heading">
            <p className="eyebrow">Local setup</p>
            <h2 id="setup-title">Run it on your machine in three terminals</h2>
            <p>
              These commands match the repository scripts and <span className="mono">docs/LOCAL_SETUP.md</span>.
              The pinned OpenCode server is the only coding engine.
            </p>
          </div>
          <div className="setup-grid">
            <div className="setup-copy">
              <h3>Before you start</h3>
              <ul className="check-list">
                <li><Check size={15} aria-hidden="true" /><span>Node 22.14 or newer.</span></li>
                <li><Check size={15} aria-hidden="true" /><span>A gitignored <span className="mono">.env</span> copied from <span className="mono">.env.example</span>.</span></li>
                <li><Check size={15} aria-hidden="true" /><span>OpenCode 2.x and a free-model route that answers on your account.</span></li>
              </ul>
              <p>
                The app and OpenCode bind to loopback by default. The browser never receives the OpenCode
                password; the server connects to the local engine.
              </p>
              <a className="text-link" href="#privacy">Read the privacy boundary <ArrowRight size={15} aria-hidden="true" /></a>
            </div>
            <SetupCommandTabs />
          </div>
        </section>

        <section className="section privacy-section" id="privacy" aria-labelledby="privacy-title">
          <div className="section-heading">
            <p className="eyebrow">Privacy and security</p>
            <h2 id="privacy-title">What this product cannot reach</h2>
            <p>Clear boundaries are part of the design, not fine print.</p>
          </div>
          <ul className="privacy-grid">
            {privacyPoints.map((point, index) => (
              <li key={point.title} className="privacy-card">
                <span className="privacy-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <h3>{point.title}</h3>
                <p>{point.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="section faq-section" id="faq" aria-labelledby="faq-title">
          <div className="section-heading">
            <p className="eyebrow">FAQ</p>
            <h2 id="faq-title">Questions worth asking before you trust a demo</h2>
          </div>
          <div className="faq-list">
            {faqs.map((item) => (
              <details key={item.question} className="faq-item">
                <summary>{item.question}<span className="faq-mark" aria-hidden="true" /></summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="final-cta" aria-labelledby="final-cta-title">
          <div className="final-spirits" aria-hidden="true">
            <SpiritCharacter id="oracle" state="listening" decorative />
            <SpiritCharacter id="architect" state="drawing" decorative />
            <SpiritCharacter id="maker" state="success" decorative />
            <SpiritCharacter id="witness" state="evidence" decorative />
          </div>
          <p className="eyebrow">Start with the honest version</p>
          <h2 id="final-cta-title">Bring the unfinished thing back to the bench.</h2>
          <p>Walk the deterministic example first, then connect your own OpenCode server when you are ready to do real work.</p>
          <div className="final-actions">
            <a className="action action-large" href="/demo">Try the example <ArrowRight size={18} aria-hidden="true" /></a>
            <a className="action action-large secondary" href="/demo?presentation=1">Watch the guided workflow</a>
            <a className="action action-large ghost" href="/workshop">Run live with OpenCode</a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <Brand compact />
        <p>Built on OpenCode. No fabricated testimonials, usage figures, awards, or live-run claims.</p>
        <nav aria-label="Footer">
          <a href="/workshop">Workshop</a>
          <a href="/demo">Demo</a>
          <a href="#privacy">Privacy</a>
          <a href="#faq">FAQ</a>
        </nav>
      </footer>

      <SetupDialog open={connectOpen} onClose={() => setConnectOpen(false)} />
    </>
  );
}
