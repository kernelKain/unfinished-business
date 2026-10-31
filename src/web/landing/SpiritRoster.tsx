import { spiritProfiles, type SpiritId } from "../spirits.ts";
import { SpiritCharacter, type SpiritState } from "../components/SpiritCharacter.tsx";

const representativeState: Record<SpiritId, SpiritState> = {
  oracle: "listening",
  architect: "drawing",
  maker: "permission",
  witness: "scanning",
};

export function SpiritRoster() {
  return (
    <section className="section spirit-section" id="workflow" aria-labelledby="workflow-title">
      <div className="section-heading">
        <p className="eyebrow">Four functions, one workflow</p>
        <h2 id="workflow-title">The spirits are stages, not a crowd of chatbots</h2>
        <p>
          Each spirit has one job and a visible state. The workshop moves forward only when the current
          handoff is approved; a model reply is never treated as permission.
        </p>
      </div>
      <ol className="spirit-grid">
        {spiritProfiles.map((spirit, index) => (
          <li key={spirit.id} className={`spirit-card spirit-card-${spirit.id}`}>
            <div className="spirit-card-art">
              <SpiritCharacter
                id={spirit.id}
                state={representativeState[spirit.id]}
                label={`${spirit.name}: ${spirit.form}`}
              />
              <span className="spirit-card-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            </div>
            <div className="spirit-card-copy">
              <p className="eyebrow">{spirit.form}</p>
              <h3>{spirit.name}</h3>
              <p className="spirit-role">{spirit.role}</p>
              <p>{spirit.summary}</p>
              <p className="spirit-work">{spirit.work}</p>
              <ul className="state-list" aria-label={`${spirit.name} states`}>
                {spirit.states.map((state) => (
                  <li key={state.id} data-state={state.id} title={state.description}>{state.label}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
