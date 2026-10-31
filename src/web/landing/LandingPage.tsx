import { useState } from "react";
import {
  ArrowRight,
  Check,
  FileCheck2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { Brand } from "../components/Brand.tsx";
import { SetupCommandTabs } from "../components/SetupCommandTabs.tsx";
import { SetupDialog } from "../components/SetupDialog.tsx";
import { SpiritCharacter } from "../components/SpiritCharacter.tsx";
import { faqs, privacyPoints, usageModes } from "../content/landing.ts";
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
            <a href="#demo">Sample</a>
            <a href="#why-opencode">Why OpenCode</a>
            <a href="#local-setup">Setup</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="site-header-actions">
            <button className="text-button" type="button" onClick={() => setConnectOpen(true)}>Connect OpenCode</button>
            <a className="text-link" href="/workshop">Run locally</a>
          </div>
        </div>
      </header>

      <main id="main-content">
        <Hero />

        <SpiritRoster />

        <DemoTeaser />

        <section className="section why-opencode" id="why-opencode" aria-labelledby="why-opencode-title">
          <div className="section-heading">
            <p className="eyebrow">Why OpenCode</p>
            <h2 id="why-opencode-title">OpenCode does the coding. This workshop does the deciding.</h2>
            <p>
              OpenCode is the open-source engine. It owns model access, tools, permissions, sessions, and
              execution. Unfinished Business gives that work a four-stage workshop: clarify, approve, build,
              and verify. Approving a plan here never overrides a tool denial inside OpenCode.
            </p>
          </div>
          <ul className="outcome-list">
            <li><Check size={18} aria-hidden="true" /><span><strong>You decide what ships.</strong> The plan is approved one exact version at a time, and a revision makes the old approval stale.</span></li>
            <li><FileCheck2 size={18} aria-hidden="true" /><span><strong>You can point to the plan.</strong> Every section has its dependencies, version, and hash, so the handoff to Maker is inspectable.</span></li>
            <li><ShieldCheck size={18} aria-hidden="true" /><span><strong>You can defend the result.</strong> A check is recorded only when a result is observed; a missing native session stays visible.</span></li>
            <li><LockKeyhole size={18} aria-hidden="true" /><span><strong>You keep the boundary.</strong> Maker scope is granted separately, and OpenCode remains the authority for every native tool decision.</span></li>
          </ul>
        </section>

        <section className="section setup-section" id="local-setup" aria-labelledby="setup-title">
          <div className="section-heading">
            <p className="eyebrow">Local setup and privacy</p>
            <h2 id="setup-title">Run it on your machine, or use the read-only sample</h2>
            <p>
              Both paths use the same four-stage workshop. Neither silently reaches into a visitor's local
              repository. These commands match the repository scripts and <span className="mono">docs/LOCAL_SETUP.md</span>.
            </p>
          </div>

          <ul className="run-path-list" aria-label="Ways to run">
            {usageModes.map((mode) => (
              <li className={`run-path run-path-${mode.tone}`} key={mode.id}>
                <div>
                  <p className="eyebrow">{mode.kicker}</p>
                  <h3>{mode.title}</h3>
                  <p>{mode.summary}</p>
                </div>
                <ul className="check-list">
                  {mode.bullets.map((bullet) => <li key={bullet}><Check size={15} aria-hidden="true" /><span>{bullet}</span></li>)}
                </ul>
                <a className="text-link" href={mode.cta.href}>{mode.cta.label} <ArrowRight size={15} aria-hidden="true" /></a>
              </li>
            ))}
          </ul>

          <div className="setup-grid">
            <div className="setup-copy">
              <h3>Before you start</h3>
              <ul className="check-list">
                <li><Check size={15} aria-hidden="true" /><span>Node 22.14 or newer.</span></li>
                <li><Check size={15} aria-hidden="true" /><span>A gitignored <span className="mono">.env</span> copied from <span className="mono">.env.example</span>.</span></li>
                <li><Check size={15} aria-hidden="true" /><span>OpenCode 2.x and a model route that answers on your account, or a local model.</span></li>
              </ul>
              <p>
                The app and OpenCode bind to loopback by default. The browser never receives the OpenCode
                password; the server connects to the local engine.
              </p>
              <a className="text-link" href="#privacy">Read the privacy boundary <ArrowRight size={15} aria-hidden="true" /></a>
            </div>
            <SetupCommandTabs />
          </div>

          <div className="privacy-block" id="privacy">
            <div className="section-heading">
              <p className="eyebrow">Privacy and security</p>
              <h2 id="privacy-title">What this product cannot reach</h2>
              <p>Clear boundaries are part of the design, not fine print.</p>
            </div>
            <ul className="privacy-list">
              {privacyPoints.map((point, index) => (
                <li key={point.title}>
                  <span className="privacy-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <h3>{point.title}</h3>
                  <p>{point.body}</p>
                </li>
              ))}
            </ul>
          </div>
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
          <p>Walk the recorded sample first, then connect your own OpenCode server when you are ready to do real work.</p>
          <div className="final-actions">
            <a className="action action-large" href="/demo">Try the example <ArrowRight size={18} aria-hidden="true" /></a>
            <a className="action action-large secondary" href="/workshop">Run locally</a>
            <a className="text-link" href="#local-setup">Read the setup guide <ArrowRight size={15} aria-hidden="true" /></a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <Brand compact />
        <p>Built on OpenCode. No fabricated testimonials, usage figures, awards, or live-run claims.</p>
        <nav aria-label="Footer">
          <a href="/workshop">Workshop</a>
          <a href="/demo">Sample</a>
          <a href="#privacy">Privacy</a>
          <a href="#faq">FAQ</a>
        </nav>
      </footer>

      <SetupDialog open={connectOpen} onClose={() => setConnectOpen(false)} />
    </>
  );
}
