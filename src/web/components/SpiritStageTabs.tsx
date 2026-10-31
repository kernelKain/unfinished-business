import { spiritProfiles, type SpiritId } from "../spirits.ts";
import { SpiritCharacter } from "./SpiritCharacter.tsx";

const order = spiritProfiles.map((profile) => profile.stage);

export function stageIndex(stage: string): number {
  const index = order.indexOf(stage as (typeof order)[number]);
  return index === -1 ? 0 : index;
}

export function SpiritStageTabs({
  stage,
  activeStage = stage,
  onSelect,
  ariaLabel = "Four-stage workflow",
}: {
  stage: string;
  activeStage?: string;
  onSelect?: (spirit: SpiritId) => void;
  ariaLabel?: string;
}) {
  const active = stageIndex(activeStage);
  const progress = stageIndex(stage);
  return (
    <nav className="stage-strip" aria-label={ariaLabel}>
      <ol>
        {spiritProfiles.map((spirit, index) => {
          const state = index === active ? "active" : index < progress ? "complete" : "waiting";
          const inspecting = Boolean(onSelect) && active !== progress && index === active;
          const content = (
            <>
              <SpiritCharacter id={spirit.id} state="idle" decorative className="stage-spirit" />
              <span className="stage-copy">
                <span className="stage-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="stage-name">{spirit.name}</span>
                <span className="stage-state">
                  {inspecting ? "Inspecting" : state === "complete" ? "Complete" : state === "active" ? "You are here" : "Waiting"}
                </span>
              </span>
              <span className="visually-hidden">
                {`Stage ${index + 1} of ${spiritProfiles.length}: ${spirit.name}, ${inspecting ? "inspecting" : state}`}
              </span>
            </>
          );
          return (
            <li
              key={spirit.id}
              className="stage"
              data-state={state}
              data-inspecting={inspecting ? "true" : undefined}
              aria-current={index === active ? "step" : undefined}
            >
              {onSelect ? (
                <button
                  className="stage-hit"
                  type="button"
                  onClick={() => onSelect(spirit.id)}
                  aria-label={`Inspect ${spirit.name}, stage ${index + 1} of ${spiritProfiles.length}`}
                >
                  {content}
                </button>
              ) : content}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
