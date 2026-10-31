import { useId } from "react";
import type { SpiritId } from "../spirits.ts";

export type SpiritState =
  | "idle"
  | "listening"
  | "clarification"
  | "drawing"
  | "approval"
  | "building"
  | "permission"
  | "blocked"
  | "success"
  | "scanning"
  | "evidence"
  | "warning"
  | "stamp";

interface SpiritCharacterProps {
  id: SpiritId;
  state?: SpiritState;
  /** A label turns the drawing into an image exposed to assistive technology. */
  label?: string;
  className?: string;
  decorative?: boolean;
}

export function SpiritCharacter({
  id,
  state = "idle",
  label,
  className = "",
  decorative = false,
}: SpiritCharacterProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const hidden = decorative || !label;
  const classes = ["spirit", `spirit-${id}`, `is-${state}`, className].filter(Boolean).join(" ");
  return (
    <svg
      className={classes}
      viewBox="0 0 120 140"
      role={hidden ? undefined : "img"}
      aria-hidden={hidden ? "true" : undefined}
      aria-label={hidden ? undefined : label}
      focusable="false"
      data-spirit={id}
      data-state={state}
    >
      {hidden ? null : <title>{label}</title>}
      {id === "oracle" ? <Oracle uid={uid} /> : null}
      {id === "architect" ? <Architect uid={uid} /> : null}
      {id === "maker" ? <Maker uid={uid} /> : null}
      {id === "witness" ? <Witness uid={uid} /> : null}
    </svg>
  );
}

function Oracle({ uid }: { uid: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`${uid}-oracle-glow`} cx="50%" cy="46%" r="52%">
          <stop offset="0%" stopColor="#ffe2ae" stopOpacity="0.95" />
          <stop offset="48%" stopColor="#f4b66c" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#f4b66c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-oracle-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#bca8ff" stopOpacity="0.3" />
          <stop offset="52%" stopColor="#5f4f9c" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#9fe7ff" stopOpacity="0.22" />
        </linearGradient>
      </defs>
      <g className="oracle-halo">
        <circle cx="60" cy="70" r="52" fill={`url(#${uid}-oracle-glow)`} />
        <circle className="oracle-ring oracle-ring-a" cx="60" cy="70" r="42" />
        <circle className="oracle-ring oracle-ring-b" cx="60" cy="70" r="34" />
      </g>
      <g className="spirit-body">
        <line x1="60" y1="8" x2="60" y2="24" className="metal-line" />
        <circle cx="60" cy="7" r="3.5" className="spirit-metal" />
        <path d="M45 26h30l-4 10H49z" className="spirit-metal" />
        <path d="M38 38c0-7 9-11 22-11s22 4 22 11l-4 42c-.7 9-8 14-18 14s-17.3-5-18-14z" fill={`url(#${uid}-oracle-glass)`} className="oracle-glass" />
        <path d="M45 91h30l4 12H41z" className="spirit-metal" />
        <rect x="53" y="103" width="14" height="5" rx="2" className="spirit-dark" />
        <ellipse className="oracle-mask" cx="60" cy="62" rx="22" ry="17" />
        <path className="oracle-eye" d="M47 62q13-11 26 0q-13 11-26 0z" />
        <circle className="oracle-pupil" cx="60" cy="62" r="3.4" />
        <path className="oracle-wisp" d="M31 54c-5 2-7 6-6 11" />
        <path className="oracle-wisp" d="M89 54c5 2 7 6 6 11" />
        <path className="oracle-wisp" d="M36 80c-4 3-5 8-3 13" />
        <path className="oracle-wisp" d="M84 80c4 3 5 8 3 13" />
      </g>
      <g className="oracle-listen">
        <path d="M28 62c-8 5-8 17 0 22" />
        <path d="M92 62c8 5 8 17 0 22" />
        <path d="M18 55c-12 8-12 28 0 36" />
        <path d="M102 55c12 8 12 28 0 36" />
      </g>
      <g className="oracle-question">
        <circle cx="50" cy="24" r="2.6" />
        <circle cx="60" cy="18" r="2.6" />
        <circle cx="70" cy="24" r="2.6" />
      </g>
    </>
  );
}

function Architect({ uid }: { uid: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`${uid}-architect-glow`} cx="50%" cy="52%" r="55%">
          <stop offset="0%" stopColor="#9fe7ff" stopOpacity="0.5" />
          <stop offset="55%" stopColor="#6f86ff" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#6f86ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-architect-cloak`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cbd8ff" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#5a67c8" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="72" r="54" fill={`url(#${uid}-architect-glow)`} className="architect-aura" />
      <path className="architect-tail" d="M60 96c-4 12 3 18 0 30c8-7 11-15 8-26" />
      <path className="architect-cloak" d="M60 29l38 78l-38-13l-38 13z" fill={`url(#${uid}-architect-cloak)`} />
      <g className="architect-compass">
        <path className="architect-arm" d="M60 26l-26 70" />
        <path className="architect-arm architect-arm-b" d="M60 26l26 70" />
        <path className="architect-arm architect-arm-c" d="M60 26l0 44" />
        <circle cx="60" cy="26" r="7" className="spirit-metal" />
        <circle cx="60" cy="26" r="3" className="architect-joint" />
        <path className="architect-tip" d="M31 101l-5 11l11-5z" />
        <path className="architect-tip" d="M89 101l5 11l-11-5z" />
        <path className="architect-tip" d="M60 73l-4 10l4 6l4-6z" />
      </g>
      <g className="architect-sheet">
        <path d="M22 84l25-4l7 21l-25 5z" />
        <path d="M29 86l16-3M31 92l16-3M33 98l16-3" className="blueprint-line" />
        <circle cx="47" cy="86" r="2" className="blueprint-dot" />
      </g>
      <g className="architect-seal">
        <path d="M60 52l4 10l11 2l-8 8l2 11l-9-5l-9 5l2-11l-8-8l11-2z" />
      </g>
    </>
  );
}

function Maker({ uid }: { uid: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`${uid}-maker-glow`} cx="50%" cy="58%" r="58%">
          <stop offset="0%" stopColor="#8ff0c0" stopOpacity="0.34" />
          <stop offset="55%" stopColor="#5fa8ff" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#5fa8ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-maker-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e6e9ff" stopOpacity="0.9" />
          <stop offset="55%" stopColor="#9aa8d8" stopOpacity="0.72" />
          <stop offset="100%" stopColor="#6d7bb4" stopOpacity="0.62" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="76" r="55" fill={`url(#${uid}-maker-glow)`} className="maker-aura" />
      <path className="maker-arm maker-arm-left" d="M34 66c-11 4-15 14-13 25" />
      <path className="maker-arm maker-arm-right" d="M86 66c11 4 15 14 13 25" />
      <path className="maker-hand" d="M20 91l-2-8m5 8l1-10m4 10l3-8" />
      <path className="maker-hand" d="M100 91l2-8m-5 8l-1-10m-4 10l-3-8" />
      <path className="maker-body" d="M32 61c0-18 12-31 28-31s28 13 28 31v40l-8-6l-7 7l-7-7l-6 7l-7-7l-7 7l-8-6z" fill={`url(#${uid}-maker-body)`} />
      <path className="maker-visor" d="M39 48h42v19c0 5-4 8-9 8H48c-5 0-9-3-9-8z" />
      <circle className="maker-eye" cx="51" cy="60" r="3.2" />
      <circle className="maker-eye" cx="69" cy="60" r="3.2" />
      <path className="maker-smile" d="M53 68q7 4 14 0" />
      <path className="maker-belt" d="M37 84h46v10H37z" />
      <rect className="maker-pouch" x="41" y="86" width="10" height="12" rx="2" />
      <rect className="maker-pouch" x="69" y="86" width="10" height="12" rx="2" />
      <path className="maker-wrench" d="M18 54l9 9m-11 5l11-11m-3-3a5 5 0 1 1 6 6l-2 2" />
      <g className="maker-sparks">
        <path d="M20 62l-6-6m10 1l2-8m-13 14l-8 1" />
        <circle cx="16" cy="52" r="1.6" />
        <circle cx="26" cy="46" r="1.3" />
      </g>
      <g className="maker-permission">
        <path d="M60 96v-8m0-5v-.5" />
        <circle cx="60" cy="80" r="13" />
      </g>
      <g className="maker-blocked">
        <path d="M60 75l12 4v10c0 8-5 13-12 16c-7-3-12-8-12-16V79z" />
        <path d="M52 81l16 16" />
      </g>
      <g className="maker-success">
        <circle cx="60" cy="76" r="34" />
        <path d="M50 76l7 7l14-16" />
        <path d="M44 40l-4-5m40 5l4-5m-20-7v-6" />
      </g>
    </>
  );
}

function Witness({ uid }: { uid: string }) {
  return (
    <>
      <defs>
        <radialGradient id={`${uid}-witness-glow`} cx="50%" cy="48%" r="58%">
          <stop offset="0%" stopColor="#c7b6ff" stopOpacity="0.48" />
          <stop offset="55%" stopColor="#7a8cff" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#7a8cff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-witness-wing`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#efeaff" stopOpacity="0.62" />
          <stop offset="60%" stopColor="#9a8fe0" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#6a5dab" stopOpacity="0.16" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="70" r="55" fill={`url(#${uid}-witness-glow)`} className="witness-aura" />
      <g className="witness-wing witness-wing-left">
        <path d="M56 54C38 34 17 38 12 52c-5 15 9 31 37 30z" fill={`url(#${uid}-witness-wing)`} />
        <path d="M51 56C39 46 26 47 21 55c-4 8 5 17 22 18" className="wing-vein" />
        <path d="M48 62C38 57 29 58 25 63" className="wing-vein" />
        <circle cx="30" cy="53" r="3.4" className="wing-eye" />
      </g>
      <g className="witness-wing witness-wing-right">
        <path d="M64 54c18-20 39-16 44-2c5 15-9 31-37 30z" fill={`url(#${uid}-witness-wing)`} />
        <path d="M69 56c12-10 25-9 30-1c4 8-5 17-22 18" className="wing-vein" />
        <path d="M72 62c10-5 19-4 23 1" className="wing-vein" />
        <circle cx="90" cy="53" r="3.4" className="wing-eye" />
      </g>
      <path className="witness-antenna" d="M55 36c-4-10-8-14-14-16" />
      <path className="witness-antenna" d="M65 36c4-10 8-14 14-16" />
      <circle cx="41" cy="20" r="2.4" className="spirit-metal" />
      <circle cx="79" cy="20" r="2.4" className="spirit-metal" />
      <path className="witness-body" d="M60 28c8 0 13 7 14 17l3 41c1 9-6 16-17 16s-18-7-17-16l3-41c1-10 6-17 14-17z" />
      <g className="witness-lens">
        <circle cx="60" cy="58" r="18" />
        <circle cx="60" cy="58" r="12" />
        <circle cx="60" cy="58" r="5.5" className="witness-pupil" />
        <path d="M60 38l5 14l14 6l-14 6l-5 14l-5-14l-14-6l14-6z" className="witness-shutter" />
      </g>
      <path className="witness-lens-line" d="M42 58h36" />
      <path className="witness-stamp" d="M44 104h32l-3 12H47z" />
      <path className="witness-stamp" d="M52 116v4h16v-4" />
      <g className="witness-evidence">
        <path d="M43 90h34v24H43z" />
        <path d="M49 96h22M49 102h22M49 108h13" className="evidence-line" />
      </g>
      <g className="witness-warning">
        <path d="M60 84l16 27H44z" />
        <path d="M60 94v10m0 5v.5" />
      </g>
    </>
  );
}
