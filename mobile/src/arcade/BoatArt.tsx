import { useEffect, useRef, useState } from "react";
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, LinearGradient, Path, Polygon, Rect, Stop } from "react-native-svg";
import { C } from "../theme";
import { wear, type AuraPaint, type Equipped, type HullPaint, type OarsPaint, type RowerPaint } from "./skins";

/* THE ROWER'S BOAT, side on, bow to the right, in four layers drawn one
 * over the other (owner, 2026-11-24: skins go on the boat "drawn in layers
 * so each part can be swapped: hull, oars, rower ... a little person
 * rowing; animate the oars/stroke ... aura/effects, a halo above, flames
 * off the oar blades, sparkles in the wake"). Side on reads at the size of
 * a phone, where a boat from above is a sliver.
 *
 * THE STROKE. `phase` runs 0 to 1, the catch at 0: the drive is the first
 * DRIVE of it (legs, then back, then arms), the recovery the rest (arms,
 * back, then up the slide). The rower faces the stern, so at the catch the
 * hands are out toward the stern, and through the pin the blade is toward
 * the bow and in the water; at the finish it is behind, and out.
 *
 * `t` is the wall's seconds, for the things that move on their own (the
 * legendary layers); `wobble` 0 to 1 shakes the whole boat (the game's
 * "while they drift, the boat visibly wobbles").
 *
 * Drawn in a box 220 by 120; `width` scales it. */

export const BOAT_W = 220;
export const BOAT_H = 120;
const DRIVE = 0.36;
const WATER = 79;
const PIN = { x: 112, y: 54 };
const FEET = { x: 88, y: 64 };

const smooth = (x: number): number => {
  const v = Math.max(0, Math.min(1, x));
  return v * v * (3 - 2 * v);
};
const col = (c: string | undefined, fallback: string): string => (c === "ink" ? C.ink : c === "paper" ? C.paper : (c ?? fallback));
const f1 = (v: number) => v.toFixed(1);

/* A two-bone joint between `a` and `b` with bones `l1` and `l2`: the elbow
 * or the knee, bent to the side `bend` says (1 up, -1 down of a to b). */
function joint(a: { x: number; y: number }, b: { x: number; y: number }, l1: number, l2: number, bend: 1 | -1): { x: number; y: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.max(1e-3, Math.min(l1 + l2 - 0.01, Math.hypot(dx, dy)));
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const ux = dx / Math.hypot(dx, dy || 1e-3);
  const uy = dy / Math.hypot(dx, dy || 1e-3);
  /* The normal that points up the page when a is left of b. */
  return { x: a.x + ux * along + uy * h * bend, y: a.y + uy * along - ux * h * bend };
}

/* Where everything is at one point of the stroke. */
export function pose(phase: number) {
  const p = phase - Math.floor(phase);
  let legs: number;
  let back: number;
  let arms: number;
  if (p < DRIVE) {
    const d = p / DRIVE;
    legs = smooth(d / 0.55);
    back = smooth((d - 0.3) / 0.45);
    arms = smooth((d - 0.55) / 0.45);
  } else {
    const r = (p - DRIVE) / (1 - DRIVE);
    arms = 1 - smooth(r / 0.3);
    back = 1 - smooth((r - 0.2) / 0.35);
    legs = 1 - smooth((r - 0.45) / 0.55);
  }
  const wet = p < DRIVE * 0.96;
  const hip = { x: 98 + 26 * legs, y: 60 };
  /* Leaning to the stern at the catch, past upright at the finish. */
  const lean = ((-24 + 44 * back) * Math.PI) / 180;
  const TORSO = 20;
  const sh = { x: hip.x + TORSO * Math.sin(lean), y: hip.y - TORSO * Math.cos(lean) };
  const head = { x: sh.x + 7 * Math.sin(lean) - 1.5, y: sh.y - 7 * Math.cos(lean) };
  /* The hands: out to the stern, then in to the ribs. */
  const hand = { x: sh.x - 21 + 16 * arms, y: 55.5 - 1.5 * arms };
  const elbow = joint(sh, hand, 11, 11, -1);
  const knee = joint(FEET, hip, 15.5, 15.5, 1);
  /* The oar, through the pin: what is stern of the pin inboard is bow of
   * it outboard, and the side view squeezes the outboard part. */
  const k = 1.35;
  const tipX = PIN.x + (PIN.x - hand.x) * k;
  const dip = wet ? WATER + 5 : WATER - 7;
  /* Into the water quickly at the catch and out at the finish. */
  const tipY = dip;
  return { p, hip, sh, head, hand, elbow, knee, lean, wet, tip: { x: tipX, y: tipY } };
}

/* A blade: a fat four-sided shape from `a` to `b`, `w` across, pushed `off`
 * of its width to one side. */
function blade(a: { x: number; y: number }, b: { x: number; y: number }, w: number, off = 0): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  const nx = (-dy / L) * w;
  const ny = (dx / L) * w;
  const s0 = -0.5 + off;
  const s1 = 0.5 + off;
  return [
    [a.x + nx * s0, a.y + ny * s0],
    [b.x + nx * s0, b.y + ny * s0],
    [b.x + nx * s1, b.y + ny * s1],
    [a.x + nx * s1, a.y + ny * s1],
  ]
    .map(([x, y]) => `${f1(x)},${f1(y)}`)
    .join(" ");
}

const HULL = "M14 65 C70 62 150 62 208 65.5 C190 81 150 87 110 87 C66 87 32 82 14 65 Z";

const star = (x: number, y: number, r: number): string => `M${f1(x)} ${f1(y - r)} Q${f1(x)} ${f1(y)} ${f1(x + r)} ${f1(y)} Q${f1(x)} ${f1(y)} ${f1(x)} ${f1(y + r)} Q${f1(x)} ${f1(y)} ${f1(x - r)} ${f1(y)} Q${f1(x)} ${f1(y)} ${f1(x)} ${f1(y - r)}Z`;

export type Paint = ReturnType<typeof wear>;

export function BoatArt({ paint, width, phase, t = 0, wobble = 0, uid = "b" }: { paint: Paint; width: number; phase: number; t?: number; wobble?: number; /* Unique among the boats on one screen: the patterns are clipped by name. */ uid?: string }) {
  const height = (width * BOAT_H) / BOAT_W;
  const P = pose(phase);
  const rock = wobble * 9 * Math.sin(t * 7.3) + wobble * 3 * Math.sin(t * 13.1);
  const bob = wobble * 3 * Math.sin(t * 5.1);
  const ink = C.ink;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${BOAT_W} ${BOAT_H}`}>
      <Defs>
        <ClipPath id={`${uid}hull`}>
          <Path d={HULL} />
        </ClipPath>
        <LinearGradient id={`${uid}chrome`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FBFCFD" />
          <Stop offset="0.35" stopColor="#9AA3AE" />
          <Stop offset="0.6" stopColor="#E9EDF1" />
          <Stop offset="1" stopColor="#5F6772" />
        </LinearGradient>
        <LinearGradient id={`${uid}gold`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFE58A" />
          <Stop offset="0.5" stopColor="#D9A21B" />
          <Stop offset="1" stopColor="#FFF1B8" />
        </LinearGradient>
      </Defs>
      {/* The boat is drawn a little in from the right, so the wake has
          water behind the stern to be on. */}
      <G x={36} y={12} scale={0.82}>
        <AuraBack aura={paint.aura} t={t} />
        <G y={bob} rotation={rock} origin="110, 72">
          {/* The far oar, behind everything. */}
          <Oar o={paint.oars} P={P} far t={t} />
          <Rower r={paint.rower} P={P} t={t} uid={uid} />
          <Hull h={paint.hull} t={t} uid={uid} />
          {/* The rigger and the pin. */}
          <Line x1={PIN.x - 4} y1={66} x2={PIN.x} y2={PIN.y + 2} stroke={ink} strokeWidth={1.6} />
          <Line x1={PIN.x + 6} y1={66} x2={PIN.x} y2={PIN.y + 2} stroke={ink} strokeWidth={1.6} />
          <Oar o={paint.oars} P={P} t={t} />
        </G>
        <AuraFront aura={paint.aura} P={P} t={t} bob={bob} />
      </G>
    </Svg>
  );
}

/* ---- the hull ------------------------------------------------------------ */

function Hull({ h, t, uid }: { h: HullPaint; t: number; uid: string }) {
  const ink = C.ink;
  const fill = h.pattern === "chrome" ? `url(#${uid}chrome)` : col(h.fill, C.paper);
  const second = col(h.second, ink);
  const clip = `url(#${uid}hull)`;
  const glow = 0.55 + 0.45 * Math.sin(t * 3.2);
  return (
    <G>
      <Path d={HULL} fill={fill} />
      <G clipPath={clip}>
        {h.pattern === "twotone" ? <Rect x={0} y={76} width={220} height={14} fill={second} /> : null}
        {h.pattern === "stripe" ? <Rect x={0} y={70} width={220} height={5} fill={second} /> : null}
        {h.pattern === "checker"
          ? Array.from({ length: 34 }, (_, i) => [0, 1, 2, 3].map((row) => ((i + row) % 2 === 0 ? <Rect key={`${i}-${row}`} x={14 + i * 6} y={62 + row * 6.5} width={6} height={6.5} fill={second} /> : null)))
          : null}
        {h.pattern === "carbon" ? Array.from({ length: 40 }, (_, i) => <Line key={i} x1={i * 6} y1={88} x2={i * 6 + 22} y2={60} stroke={second} strokeWidth={1.6} />) : null}
        {h.pattern === "molten" ? (
          <G>
            <Path d="M24 70 L40 75 L52 71 L70 77 L86 72 L102 79 L120 73 L138 78 L156 72 L172 76 L196 69" stroke={second} strokeWidth={4} strokeOpacity={0.35 * glow} fill="none" />
            <Path d="M24 70 L40 75 L52 71 L70 77 L86 72 L102 79 L120 73 L138 78 L156 72 L172 76 L196 69" stroke="#FFC24A" strokeWidth={1.4} strokeOpacity={0.6 + 0.4 * glow} fill="none" />
            <Path d="M60 81 L66 76 M130 81 L126 75 M92 66 L96 71" stroke="#FFC24A" strokeWidth={1.2} strokeOpacity={glow} />
          </G>
        ) : null}
        {/* THE SHINE that makes a rare a rare: a light along the top. */}
        {h.gloss || h.pattern === "chrome" ? (
          <G>
            <Path d="M30 67.5 C80 66 150 66 196 68" stroke="#FFFFFF" strokeOpacity={0.75} strokeWidth={2.2} fill="none" strokeLinecap="round" />
            <Rect x={((t * 40) % 260) - 30} y={60} width={7} height={26} fill="#FFFFFF" fillOpacity={0.35} rotation={-20} origin={`${((t * 40) % 260) - 27}, 73`} />
          </G>
        ) : null}
      </G>
      <Path d={HULL} fill="none" stroke={ink} strokeWidth={1.8} strokeLinejoin="round" />
      {h.bird ? <Bird t={t} /> : null}
    </G>
  );
}

/* A little bird on the bow, which looks about now and then. */
function Bird({ t }: { t: number }) {
  const look = Math.sin(t * 1.7) > 0.6 ? -1 : 1;
  const hop = Math.max(0, Math.sin(t * 2.3)) ** 8 * 2.5;
  const x = 194;
  const y = 61 - hop;
  return (
    <G>
      <Ellipse cx={x} cy={y} rx={5.5} ry={4} fill="#5B8FD6" stroke={C.ink} strokeWidth={1.2} />
      <Path d={`M${x - 5} ${y - 1} L${x - 10} ${y - 3.5} L${x - 8.5} ${y + 1}Z`} fill="#3E6DB0" stroke={C.ink} strokeWidth={1} strokeLinejoin="round" />
      <Circle cx={x + 3.5 * look} cy={y - 4.5} r={3.2} fill="#5B8FD6" stroke={C.ink} strokeWidth={1.2} />
      <Circle cx={x + 4.6 * look} cy={y - 5.2} r={0.8} fill={C.ink} />
      <Path d={`M${x + 6.4 * look} ${y - 4.8} L${x + 9.4 * look} ${y - 4.1} L${x + 6.4 * look} ${y - 3.4}Z`} fill="#F2A71B" />
      <Line x1={x - 1} y1={y + 3.5} x2={x - 1} y2={y + 5.5} stroke={C.ink} strokeWidth={1} />
      <Line x1={x + 1.5} y1={y + 3.5} x2={x + 1.5} y2={y + 5.5} stroke={C.ink} strokeWidth={1} />
    </G>
  );
}

/* ---- the oars ------------------------------------------------------------ */

function Oar({ o, P, far = false, t }: { o: OarsPaint; P: ReturnType<typeof pose>; far?: boolean; t: number }) {
  const ink = C.ink;
  const dx = far ? -3 : 0;
  const dy = far ? -2.5 : 0;
  const hand = { x: P.hand.x + dx, y: P.hand.y + dy };
  const tip = { x: P.tip.x + dx, y: P.tip.y + dy };
  const L = Math.hypot(tip.x - hand.x, tip.y - hand.y) || 1;
  const ux = (tip.x - hand.x) / L;
  const uy = (tip.y - hand.y) / L;
  const root = { x: tip.x - ux * 15, y: tip.y - uy * 15 };
  const a = col(o.blade, ink);
  const b = col(o.second, ink);
  const shaft = col(o.shaft, ink);
  const flick = 0.75 + 0.25 * Math.sin(t * 19) * Math.sin(t * 7);
  return (
    <G opacity={far ? 0.32 : 1}>
      <Line x1={hand.x} y1={hand.y} x2={root.x} y2={root.y} stroke={shaft} strokeWidth={2} strokeLinecap="round" />
      {o.extra === "ribbon" && !far ? (
        <Path d={`M${f1(root.x - ux * 10)} ${f1(root.y - uy * 10)} q-8 ${f1(4 + 3 * Math.sin(t * 6))} -16 ${f1(1 + 4 * Math.sin(t * 6 + 1))} t-14 ${f1(3 * Math.sin(t * 6 + 2))}`} stroke="#F3A6C8" strokeWidth={2.6} fill="none" strokeLinecap="round" />
      ) : null}
      <Polygon points={blade(root, tip, 7)} fill={a} stroke={ink} strokeWidth={1} strokeLinejoin="round" />
      {o.pattern === "split" ? <Polygon points={blade(root, tip, 3.5, 0.25)} fill={b} /> : null}
      {o.pattern === "tip" ? <Polygon points={blade({ x: tip.x - ux * 5, y: tip.y - uy * 5 }, tip, 7)} fill={b} stroke={ink} strokeWidth={1} /> : null}
      {o.pattern === "gloss" ? <Line x1={root.x + 1} y1={root.y - 1.5} x2={tip.x - ux * 2} y2={tip.y - uy * 2 - 1.5} stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={1.4} strokeLinecap="round" /> : null}
      {o.extra === "flame" && !far ? (
        <G>
          {[0, 1, 2].map((i) => {
            const s = (0.8 + 0.35 * Math.sin(t * 11 + i * 2.1)) * (i === 1 ? 1.25 : 0.9);
            const x = root.x + ux * (3 + i * 5);
            const y = root.y + uy * (3 + i * 5) - 3;
            return (
              <G key={i}>
                <Path d={`M${f1(x - 4 * s)} ${f1(y)} Q${f1(x - 3 * s)} ${f1(y - 9 * s)} ${f1(x + 1 * s)} ${f1(y - 15 * s)} Q${f1(x + 5 * s)} ${f1(y - 7 * s)} ${f1(x + 4 * s)} ${f1(y)} Z`} fill="#F0631E" fillOpacity={0.9} />
                <Path d={`M${f1(x - 2 * s)} ${f1(y)} Q${f1(x - 1.5 * s)} ${f1(y - 5 * s)} ${f1(x + 0.5 * s)} ${f1(y - 9 * s)} Q${f1(x + 2.5 * s)} ${f1(y - 4 * s)} ${f1(x + 2 * s)} ${f1(y)} Z`} fill="#FFD23F" />
              </G>
            );
          })}
        </G>
      ) : null}
      {o.extra === "bolt" && !far && flick > 0.62 ? (
        <Path d={`M${f1(tip.x - 2)} ${f1(tip.y - 16)} l4 6 l-4 1 l5 8 M${f1(root.x - 6)} ${f1(root.y - 12)} l3 5 l-3 1 l4 6`} stroke={b} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      ) : null}
    </G>
  );
}

/* ---- the rower ----------------------------------------------------------- */

function Rower({ r, P, t, uid }: { r: RowerPaint; P: ReturnType<typeof pose>; t: number; uid: string }) {
  const ink = C.ink;
  const kit = r.shimmer ? `url(#${uid}gold)` : col(r.kit, ink);
  const second = col(r.second, C.paper);
  const { hip, sh, head, hand, elbow, knee, lean } = P;
  /* The torso as a shape, eight across, so a kit can have stripes. */
  const nx = Math.cos(lean) * 4.2;
  const ny = Math.sin(lean) * 4.2;
  const torso = `${f1(hip.x - nx)},${f1(hip.y - ny)} ${f1(sh.x - nx)},${f1(sh.y - ny)} ${f1(sh.x + nx)},${f1(sh.y + ny)} ${f1(hip.x + nx)},${f1(hip.y + ny)}`;
  const along = (k: number) => ({ x: hip.x + (sh.x - hip.x) * k, y: hip.y + (sh.y - hip.y) * k });
  const band = (k0: number, k1: number, fill: string) => {
    const a = along(k0);
    const b = along(k1);
    return <Polygon points={`${f1(a.x - nx)},${f1(a.y - ny)} ${f1(b.x - nx)},${f1(b.y - ny)} ${f1(b.x + nx)},${f1(b.y + ny)} ${f1(a.x + nx)},${f1(a.y + ny)}`} fill={fill} />;
  };
  const shimmer = r.shimmer ? 0.5 + 0.5 * Math.sin(t * 4) : 0;
  return (
    <G>
      {r.shimmer ? <Circle cx={(hip.x + sh.x) / 2} cy={(hip.y + sh.y) / 2 - 2} r={19} fill="#FFD866" fillOpacity={0.12 + 0.14 * shimmer} /> : null}
      {/* The legs: the thigh in the kit, the shin bare. */}
      <Line x1={knee.x} y1={knee.y} x2={88} y2={64} stroke={ink} strokeWidth={3.4} strokeLinecap="round" />
      <Line x1={hip.x} y1={hip.y} x2={knee.x} y2={knee.y} stroke={ink} strokeWidth={5.4} strokeLinecap="round" />
      <Line x1={hip.x} y1={hip.y} x2={knee.x} y2={knee.y} stroke={kit} strokeWidth={3.4} strokeLinecap="round" />
      {/* The seat, under the hips. */}
      <Line x1={hip.x - 5} y1={63.5} x2={hip.x + 5} y2={63.5} stroke={ink} strokeWidth={2} strokeLinecap="round" />
      <Polygon points={torso} fill={kit} stroke={ink} strokeWidth={1.4} strokeLinejoin="round" />
      {r.pattern === "stripe" ? (
        <G>
          {band(0.28, 0.42, second)}
          {band(0.62, 0.76, second)}
        </G>
      ) : null}
      {r.pattern === "twotone" ? band(0, 0.45, second) : null}
      {r.pattern === "gloss" ? (
        <Line x1={along(0.2).x - nx * 0.4} y1={along(0.2).y - ny * 0.4} x2={along(0.85).x - nx * 0.4} y2={along(0.85).y - ny * 0.4} stroke="#FFFFFF" strokeOpacity={0.8} strokeWidth={1.6} strokeLinecap="round" />
      ) : null}
      {r.pattern ? <Polygon points={torso} fill="none" stroke={ink} strokeWidth={1.4} strokeLinejoin="round" /> : null}
      {/* The arm. */}
      <Line x1={sh.x} y1={sh.y} x2={elbow.x} y2={elbow.y} stroke={ink} strokeWidth={3.4} strokeLinecap="round" />
      <Line x1={elbow.x} y1={elbow.y} x2={hand.x} y2={hand.y} stroke={ink} strokeWidth={3} strokeLinecap="round" />
      {/* The head. */}
      <Circle cx={head.x} cy={head.y} r={5.6} fill={C.paper} stroke={ink} strokeWidth={1.6} />
      <Hat r={r} head={head} t={t} />
      {r.shimmer ? <Path d={star(sh.x + 10, sh.y - 6 - 3 * shimmer, 2.5 + 1.5 * shimmer)} fill="#FFE27A" /> : null}
    </G>
  );
}

function Hat({ r, head, t }: { r: RowerPaint; head: { x: number; y: number }; t: number }) {
  const ink = C.ink;
  const { x, y } = head;
  if (r.hat === "cap")
    return (
      <G>
        <Path d={`M${f1(x - 6)} ${f1(y - 1)} Q${f1(x)} ${f1(y - 10)} ${f1(x + 6)} ${f1(y - 1)} Z`} fill="#1C2E5A" stroke={ink} strokeWidth={1.2} />
        <Path d={`M${f1(x - 6)} ${f1(y - 1.5)} L${f1(x - 11)} ${f1(y - 0.5)} L${f1(x - 6)} ${f1(y + 0.5)}Z`} fill={ink} />
        <Circle cx={x} cy={y - 5} r={1.4} fill="#F2C230" />
      </G>
    );
  if (r.hat === "crown")
    return <Path d={`M${f1(x - 6)} ${f1(y - 4)} L${f1(x - 6)} ${f1(y - 11)} L${f1(x - 3)} ${f1(y - 7)} L${f1(x)} ${f1(y - 12.5)} L${f1(x + 3)} ${f1(y - 7)} L${f1(x + 6)} ${f1(y - 11)} L${f1(x + 6)} ${f1(y - 4)} Z`} fill="#F2C230" stroke={ink} strokeWidth={1.1} strokeLinejoin="round" strokeOpacity={0.8 + 0.2 * Math.sin(t * 3)} />;
  if (r.hat === "viking")
    return (
      <G>
        <Path d={`M${f1(x - 6.2)} ${f1(y - 1)} Q${f1(x)} ${f1(y - 11)} ${f1(x + 6.2)} ${f1(y - 1)} Z`} fill="#9AA3AE" stroke={ink} strokeWidth={1.2} />
        <Path d={`M${f1(x - 5.5)} ${f1(y - 4)} Q${f1(x - 11)} ${f1(y - 6)} ${f1(x - 10)} ${f1(y - 13)} Q${f1(x - 7)} ${f1(y - 8)} ${f1(x - 3.5)} ${f1(y - 6.5)}Z`} fill={C.paper} stroke={ink} strokeWidth={1} />
        <Path d={`M${f1(x + 5.5)} ${f1(y - 4)} Q${f1(x + 11)} ${f1(y - 6)} ${f1(x + 10)} ${f1(y - 13)} Q${f1(x + 7)} ${f1(y - 8)} ${f1(x + 3.5)} ${f1(y - 6.5)}Z`} fill={C.paper} stroke={ink} strokeWidth={1} />
      </G>
    );
  if (r.hat === "headband") return <Line x1={x - 5.8} y1={y - 2.5} x2={x + 5.8} y2={y - 2.5} stroke={col(r.second, "#F2C230")} strokeWidth={2.4} strokeLinecap="round" />;
  return null;
}

/* ---- the aura ------------------------------------------------------------ */

const RAINBOW = ["#E8443A", "#F28C28", "#F5C935", "#4CB963", "#3A8FD8", "#7B54C9"];

/* What is behind the boat: the wake and the water round it. */
function AuraBack({ aura, t }: { aura: AuraPaint; t: number }) {
  const c = col(aura.color, C.ink);
  switch (aura.kind) {
    case "foam":
      return (
        <G>
          {[0, 1, 2].map((i) => (
            <Path key={i} d={`M${10 - i * 14} ${WATER - 1 - i * 0.5} q-5 -${4 - i} -11 0`} stroke={C.gray} strokeWidth={2} fill="none" strokeLinecap="round" />
          ))}
        </G>
      );
    case "ripples":
      return (
        <G>
          {[0, 1, 2].map((i) => {
            const k = (t * 0.6 + i / 3) % 1;
            return <Ellipse key={i} cx={110} cy={WATER + 2} rx={90 + 40 * k} ry={4 + 6 * k} stroke={c} strokeOpacity={0.55 * (1 - k)} strokeWidth={1.4} fill="none" />;
          })}
        </G>
      );
    case "speed":
      return (
        <G>
          {[0, 1, 2, 3].map((i) => {
            const x = 10 - ((t * 60 + i * 23) % 40);
            return <Line key={i} x1={x} y1={58 + i * 6} x2={x - 16} y2={58 + i * 6} stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeOpacity={0.85} />;
          })}
        </G>
      );
    case "rainbow":
      return (
        <G>
          {RAINBOW.map((rc, i) => {
            const y = WATER - 7 + i * 2.6;
            const w = 3 * Math.sin(t * 5 + i * 0.5);
            return <Path key={rc} d={`M24 ${f1(y)} C4 ${f1(y + w)} -14 ${f1(y - w)} -40 ${f1(y + w * 0.6)}`} stroke={rc} strokeWidth={3} fill="none" strokeLinecap="round" />;
          })}
        </G>
      );
    case "cloud":
      return (
        <G>
          {[0, 1, 2, 3].map((i) => {
            const k = (t * 1.4 + i / 4) % 1;
            return <Line key={i} x1={92 + i * 9} y1={24 + k * 30} x2={90 + i * 9} y2={29 + k * 30} stroke="#5A8FD8" strokeWidth={1.6} strokeLinecap="round" strokeOpacity={1 - k} />;
          })}
        </G>
      );
    default:
      return null;
  }
}

/* What is over the boat: a halo, a cloud, stars. */
function AuraFront({ aura, P, t, bob }: { aura: AuraPaint; P: ReturnType<typeof pose>; t: number; bob: number }) {
  const c = col(aura.color, C.ink);
  switch (aura.kind) {
    case "bubbles":
      return (
        <G>
          {[0, 1, 2, 3, 4].map((i) => {
            const k = (t * 0.7 + i / 5) % 1;
            return <Circle key={i} cx={8 - i * 9 + 3 * Math.sin(t * 3 + i)} cy={WATER - 2 - k * 26} r={2.4 + i * 0.5} stroke={c} strokeWidth={1.6} fill="none" strokeOpacity={1 - k * 0.8} />;
          })}
        </G>
      );
    case "stars":
      return (
        <G>
          {[0, 1, 2, 3].map((i) => {
            const k = 0.5 + 0.5 * Math.sin(t * 4 + i * 1.7);
            return <Path key={i} d={star(8 - i * 12, WATER - 6 - (i % 2) * 9, 3 + 3 * k)} fill={c} stroke={C.ink} strokeWidth={0.8} fillOpacity={0.6 + 0.4 * k} />;
          })}
        </G>
      );
    case "halo":
      return <Ellipse cx={P.head.x} cy={P.head.y - 11 + bob + 1.2 * Math.sin(t * 2.4)} rx={7.5} ry={2.4} stroke={c} strokeWidth={2.2} fill="none" />;
    case "cloud":
      return (
        <G y={1.5 * Math.sin(t * 1.3)}>
          <Path d="M86 22 q0 -9 10 -8 q4 -8 13 -4 q9 -3 11 6 q8 1 6 7 q-1 4 -6 4 h-30 q-6 0 -4 -5z" fill="#C9D1DC" stroke={C.ink} strokeWidth={1.2} strokeLinejoin="round" />
        </G>
      );
    case "starfall":
      return (
        <G>
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const k = (t * 0.5 + i / 6) % 1;
            const x = 40 + ((i * 37) % 150) - k * 20;
            return <Path key={i} d={star(x, 6 + k * 60, 2.4 + 1.6 * Math.sin(t * 5 + i))} fill={c} stroke={C.ink} strokeWidth={0.6} fillOpacity={1 - k * 0.7} />;
          })}
        </G>
      );
    default:
      return null;
  }
}

/* ---- a boat on its own, rowing ----------------------------------------- */

/* The wall's seconds, thirty times a second while `on`. */
export function useWallClock(on = true): number {
  const [t, setT] = useState(() => Date.now() / 1000);
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    let last = 0;
    const loop = (ts: number) => {
      if (ts - last >= 32) {
        last = ts;
        setT(Date.now() / 1000);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  return t;
}

/* The boat rowing at its own steady rate, for the locker. */
export function RowingBoat({ equipped, width, spm = 24, still = false, uid }: { equipped: Partial<Equipped>; width: number; spm?: number; still?: boolean; uid?: string }) {
  const t = useWallClock(!still);
  const start = useRef(t);
  const phase = still ? 0.5 : ((t - start.current) * spm) / 60;
  return <BoatArt paint={wear(equipped)} width={width} phase={phase} t={still ? 0.6 : t} uid={uid} />;
}
