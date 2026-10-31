import { demoFixture, type DemoBeat, type DemoSpiritId } from "../../shared/demo.ts";

export interface DemoPlaybackState {
  index: number;
  playing: boolean;
  inspected: DemoSpiritId | null;
  completed: boolean;
  presentation: boolean;
}

export type DemoPlaybackAction =
  | { type: "play" }
  | { type: "pause" }
  | { type: "toggle" }
  | { type: "next" }
  | { type: "previous" }
  | { type: "replay" }
  | { type: "reset" }
  | { type: "inspect"; spirit: DemoSpiritId }
  | { type: "present" }
  | { type: "exit-presentation" }
  | { type: "tick" }
  | { type: "complete" };

export const DEMO_LAST_INDEX = demoFixture.beats.length - 1;

export function initialDemoPlayback(presentation = false): DemoPlaybackState {
  return {
    index: 0,
    playing: presentation,
    inspected: null,
    completed: false,
    presentation,
  };
}

/**
 * Pure playback state. Reset only changes this fixture state; it cannot call a
 * mutation route or touch the live project.
 */
export function demoPlaybackReducer(state: DemoPlaybackState, action: DemoPlaybackAction): DemoPlaybackState {
  switch (action.type) {
    case "play":
      if (state.completed) return { ...state, index: 0, playing: true, completed: false, inspected: null };
      return { ...state, playing: true };
    case "pause":
      return { ...state, playing: false };
    case "toggle":
      if (state.playing) return { ...state, playing: false };
      return {
        ...state,
        playing: true,
        completed: false,
        index: state.completed ? 0 : state.index,
        inspected: state.completed ? null : state.inspected,
      };
    case "next":
      return advance(state, true);
    case "previous":
      return {
        ...state,
        index: Math.max(0, state.index - 1),
        playing: false,
        completed: false,
      };
    case "replay":
      return { ...state, index: 0, playing: true, inspected: null, completed: false };
    case "reset":
      return { ...state, index: 0, playing: false, inspected: null, completed: false };
    case "inspect":
      return { ...state, inspected: action.spirit, playing: false };
    case "present":
      return { ...state, presentation: true, index: 0, playing: true, inspected: null, completed: false };
    case "exit-presentation":
      return { ...state, presentation: false, playing: false };
    case "tick":
      return state.playing ? advance(state, false) : state;
    case "complete":
      return { ...state, playing: false, completed: true };
    default:
      return state;
  }
}

function advance(state: DemoPlaybackState, manual: boolean): DemoPlaybackState {
  if (state.index >= DEMO_LAST_INDEX) {
    return { ...state, playing: false, completed: true };
  }
  return {
    ...state,
    index: state.index + 1,
    playing: manual ? false : state.playing,
    inspected: null,
  };
}

export function currentBeat(state: DemoPlaybackState): DemoBeat {
  return demoFixture.beats[state.index] ?? demoFixture.beats[0];
}

export function focusedSpirit(state: DemoPlaybackState): DemoSpiritId {
  return state.inspected ?? currentBeat(state).spirit;
}

export function presentationFromSearch(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get("presentation") === "1";
}

export function presentationSearch(search: string, presentation: boolean): string {
  const params = new URLSearchParams(search);
  if (presentation) params.set("presentation", "1");
  else params.delete("presentation");
  const next = params.toString();
  return next ? `?${next}` : "";
}
