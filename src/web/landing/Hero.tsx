import { ArrowRight, CircleDot, PlugZap, TerminalSquare, Timer } from "lucide-react";
import { heroAlt } from "../content/landing.ts";

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <picture className="hero-media" aria-hidden="true">
        <source
          media="(max-width: 720px)"
          type="image/avif"
          srcSet="/assets/hero/hero-ghostlight-portrait-600.avif 600w, /assets/hero/hero-ghostlight-portrait-900.avif 900w"
          sizes="100vw"
        />
        <source
          media="(max-width: 720px)"
          type="image/webp"
          srcSet="/assets/hero/hero-ghostlight-portrait-600.webp 600w, /assets/hero/hero-ghostlight-portrait-900.webp 900w"
          sizes="100vw"
        />
        <source
          type="image/avif"
          srcSet="/assets/hero/hero-ghostlight-wide-768.avif 768w, /assets/hero/hero-ghostlight-wide-1280.avif 1280w, /assets/hero/hero-ghostlight-wide-1920.avif 1920w"
          sizes="(max-width: 1100px) 100vw, 1120px"
        />
        <source
          type="image/webp"
          srcSet="/assets/hero/hero-ghostlight-wide-768.webp 768w, /assets/hero/hero-ghostlight-wide-1280.webp 1280w, /assets/hero/hero-ghostlight-wide-1920.webp 1920w"
          sizes="(max-width: 1100px) 100vw, 1120px"
        />
        <img
          src="/assets/hero/hero-ghostlight-wide-1280.jpg"
          srcSet="/assets/hero/hero-ghostlight-wide-768.jpg 768w, /assets/hero/hero-ghostlight-wide-1280.jpg 1280w"
          sizes="(max-width: 1100px) 100vw, 1120px"
          width="1920"
          height="823"
          alt={heroAlt}
          fetchPriority="high"
          decoding="async"
        />
      </picture>
      <div className="hero-veil" aria-hidden="true" />
      <div className="hero-grain" aria-hidden="true" />
      <div className="hero-inner">
        <p className="hero-kicker">
          <span className="pulse-dot" aria-hidden="true" />
          OpenCode-powered hackathon project builder
        </p>
        <h1 id="hero-title">Turn unfinished ideas into <span className="keep-together">hackathon-ready</span> builds.</h1>
        <p className="hero-lede">
          Four friendly spirits guide one idea through a clear proposal, an approved plan, a real bounded
          build, and evidence you can defend. OpenCode does the coding work; the workshop keeps the decisions honest.
        </p>
        <div className="hero-actions">
          <a className="action action-large" href="/demo">
            Try the example <ArrowRight size={18} aria-hidden="true" />
          </a>
          <a className="action action-large secondary" href="/demo?presentation=1">
            <Timer size={18} aria-hidden="true" /> Watch the guided workflow
          </a>
          <a className="action action-large ghost" href="/workshop">
            <PlugZap size={18} aria-hidden="true" /> Run live with OpenCode
          </a>
        </div>
        <p className="hero-secondary-link">
          <a className="text-link" href="#local-setup">
            <TerminalSquare size={15} aria-hidden="true" /> Set up locally
          </a>
        </p>
        <p className="hero-note">
          <CircleDot size={14} aria-hidden="true" />
          The example is a deterministic fixture, not live inference. Local mode connects to your own OpenCode server.
        </p>
        <dl className="hero-facts">
          <div><dt>Engine</dt><dd>OpenCode 2.x</dd></div>
          <div><dt>Build scope</dt><dd>Isolated workspace</dd></div>
          <div><dt>Evidence</dt><dd>Observed, not assumed</dd></div>
        </dl>
      </div>
    </section>
  );
}
