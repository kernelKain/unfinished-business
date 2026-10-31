import { useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import {
  DEMO_FIXTURE_VERSION,
  DEMO_SOURCE_LABEL,
  demoFixture,
  demoPreviewSteps,
} from "../../shared/demo.ts";
import { SpiritCharacter } from "../components/SpiritCharacter.tsx";
import { RunInspector } from "../components/RunInspector.tsx";
import { StatusChip } from "../components/StatusChip.tsx";
import { sampleStory } from "../content/landing.ts";

export function DemoTeaser() {
  const [index, setIndex] = useState(0);
  const step = demoPreviewSteps[index];

  return (
    <section className="section sample-section" id="demo" aria-labelledby="sample-title">
      <div className="section-heading">
        <p className="eyebrow">Sample project</p>
        <h2 id="sample-title">One abandoned project, four honest handoffs</h2>
        <p>
          {sampleStory.name} is a small open-source CLI that went quiet before its report could be trusted.
          Follow the same recorded project from a vague idea to a check you can defend.
        </p>
      </div>

      <dl className="sample-story">
        <div>
          <dt>The original problem</dt>
          <dd>{sampleStory.originalProblem}</dd>
        </div>
        <div>
          <dt>What was left unfinished</dt>
          <dd>{sampleStory.unfinished}</dd>
        </div>
        <div>
          <dt>What the team changed</dt>
          <dd>{sampleStory.revival}</dd>
        </div>
      </dl>

      <div className="demo-shell" data-testid="demo-teaser" data-sample={sampleStory.name}>
        <div className="demo-stage">
          <div className="demo-spirit">
            <SpiritCharacter
              id={step.spirit}
              state={step.state}
              label={`${step.spirit} in the ${step.state} state`}
            />
          </div>
          <div className="demo-copy" aria-live="polite">
            <div className="demo-meta">
              <span className="eyebrow">{step.stage}</span>
              <StatusChip status="fixture" label="Recorded sample" />
            </div>
            <h3>{step.title}</h3>
            <p className="demo-summary">{step.summary}</p>
            <p>{step.detail}</p>
            <ul className="demo-lines">
              {step.lines.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
        </div>
        <div className="demo-controls">
          <div className="demo-progress" role="group" aria-label="Sample steps">
            {demoPreviewSteps.map((item, itemIndex) => (
              <button
                key={item.id}
                type="button"
                className="demo-dot"
                aria-label={`Step ${itemIndex + 1}: ${item.title}`}
                aria-current={itemIndex === index ? "step" : undefined}
                onClick={() => setIndex(itemIndex)}
              >
                <span aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="demo-buttons">
            <button className="action secondary" type="button" onClick={() => setIndex(index === 0 ? demoPreviewSteps.length - 1 : index - 1)}>
              <ArrowLeft size={16} aria-hidden="true" /> Back
            </button>
            <button className="action secondary" type="button" onClick={() => setIndex(0)}>
              <RotateCcw size={16} aria-hidden="true" /> Restart
            </button>
            <button className="action" type="button" onClick={() => setIndex((index + 1) % demoPreviewSteps.length)}>
              Next <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="demo-teaser-links">
            <a className="text-link" href="/demo">Open the full guided sample <ArrowRight size={15} aria-hidden="true" /></a>
          </div>
        </div>
      </div>

      <details className="sample-details">
        <summary>Sample details and provenance</summary>
        <div>
          <p>{DEMO_SOURCE_LABEL}. The sample is version {DEMO_FIXTURE_VERSION} and uses no repository, provider key, model quota, or visitor state.</p>
          <p>
            The command shown is <code>{sampleStory.command}</code>. The recorded result is “{sampleStory.check}”.
            The live native session remains <strong>{sampleStory.liveProof}</strong>.
          </p>
          <p>{demoFixture.scenario.provenance}</p>
        </div>
        <RunInspector
          operations={demoFixture.project.operations}
          evidence={demoFixture.project.evidence}
          capabilities={demoFixture.project.capabilities}
          eyebrow="Sample evidence"
          title="The same evidence view, with recorded data"
          note="Every row comes from the canonical sample. The check is recorded; the live session is NOT_RUN."
          sourceLabel="Recorded sample"
          demo
        />
      </details>
    </section>
  );
}
