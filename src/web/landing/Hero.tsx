import { ArrowRight, CircleDot, PlugZap, TerminalSquare } from "lucide-react";
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
          A workshop for unfinished hackathon projects
        </p>
        <h1 id="hero-title">Finish the project you already started.</h1>
        <p className="hero-lede">
          Unfinished Business takes one abandoned idea through four honest steps: clarify it, approve the
          plan, build with OpenCode, and verify the result. You keep the decisions; OpenCode does the coding.
        </p>
        <div className="hero-actions">
          <a className="action action-large" href="/demo">
            Try the example <ArrowRight size={18} aria-hidden="true" />
          </a>
          <a className="action action-large secondary" href="/workshop">
            <PlugZap size={18} aria-hidden="true" /> Run locally
          </a>
        </div>
        <p className="hero-note">
          <CircleDot size={14} aria-hidden="true" />
          The example is recorded and labeled. Run locally to connect your own OpenCode server.
        </p>
        <dl className="hero-facts" aria-label="The four outcomes">
          <div><dt>01</dt><dd>Clarify the idea</dd></div>
          <div><dt>02</dt><dd>Approve the plan</dd></div>
          <div><dt>03</dt><dd>Build with OpenCode</dd></div>
          <div><dt>04</dt><dd>Verify the result</dd></div>
        </dl>
      </div>
    </section>
  );
}
