import { spiritProfiles } from "../spirits.ts";
import { SpiritCharacter } from "./SpiritCharacter.tsx";

const order = spiritProfiles.map((profile) => profile.stage);

export function stageIndex(stage: string): number {
  const index = order.indexOf(stage as (typeof order)[number]);
  return index === -1 ? 0 : index;
}

export function SpiritStageTabs({ stage }: { stage: string }) {
  const active = stageIndex(stage);
  return (
    <nav className="stage-strip" aria-label="Four-stage workflow">
      <ol>
        {spiritProfiles.map((spirit, index) => {
          const state = index < active ? "complete" : index === active ? "active" : "waiting";
          return (
            <li
              key={spirit.id}
              className="stage"
              data-state={state}
              aria-current={index === active ? "step" : undefined}
            >
              <SpiritCharacter id={spirit.id} state={index === active ? "idle" : "idle"} decorative className="stage-spirit" />
              <span className="stage-copy">
                <span className="stage-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="stage-name">{spirit.name}</span>
                <span className="stage-state">
                  {state === "complete" ? "Complete" : state === "active" ? "You are here" : "Waiting"}
                </span>
              </span>
              <span className="visually-hidden">
                {`Stage ${index + 1} of ${spiritProfiles.length}: ${spirit.name}, ${state}`}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
