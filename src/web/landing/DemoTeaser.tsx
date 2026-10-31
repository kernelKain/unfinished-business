import { useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { demoSteps } from "../content/landing.ts";
import { SpiritCharacter } from "../components/SpiritCharacter.tsx";
import { StatusChip } from "../components/StatusChip.tsx";

export function DemoTeaser() {
  const [index, setIndex] = useState(0);
  const step = demoSteps[index];

  return (
    <section className="section demo-teaser" id="demo" aria-labelledby="demo-title">
      <div className="section-heading">
        <p className="eyebrow">Deterministic walkthrough</p>
        <h2 id="demo-title">See the shape of the journey before you run it</h2>
        <p>
          This teaser is a scripted fixture. It does not call a model, open a native session, or claim a
          successful build. Use the controls to inspect the four handoffs.
        </p>
      </div>
      <div className="demo-shell" data-testid="demo-teaser">
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
              <StatusChip status="fixture" label="Scripted sample" />
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
          <div className="demo-progress" role="group" aria-label="Walkthrough steps">
            {demoSteps.map((item, itemIndex) => (
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
          <a className="text-link" href="/demo">Open the full deterministic walkthrough <ArrowRight size={15} aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  );
}
