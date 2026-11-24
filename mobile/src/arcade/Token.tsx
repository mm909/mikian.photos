import type { ReactNode } from "react";
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { C } from "../theme";
import { wear, type AuraPaint, type Equipped, type HullPaint, type OarsPaint, type RowerPaint } from "./skins";

/* THE PIECE: a small game token in line art (owner, 2026-11-24: the first
 * boat "looked pretty bad ... think chess piece size ... more Monopoly piece
 * going around a board rather than giant boats ... it doesn't have to be a
 * boat ... we just have to have something that we can put skins on"; "we
 * can always just do line art ... I am a box. I am shooting circles. My
 * rewards are a cool box hat and a cool circle thing"). The boat
 * (BoatArt.tsx) stays in the code, should he want it back.
 *
 * A BOX WITH EYES, and the four layers of skins mapped onto it, so every
 * item already won is still worn:
 *   hull   the box: its colour, two-tone, a stripe, checks, carbon, chrome,
 *          molten, a bird on its shoulder;
 *   oars   the circle it shoots, floating at its side: a ring, a colour, a
 *          split, a bullseye, gold, a ribbon, a fireball, ball lightning;
 *   rower  what is on its head: nothing (the stock box), a beanie, a
 *          headband, a captain's cap, a viking helmet, a crown;
 *   aura   what goes with it: a trail on the board (foam, speed lines,
 *          stars, a rainbow), or round it (ripples, bubbles, a halo, its
 *          own raincloud, starfall).
 *
 * READ FROM THE SEAT, three to six feet away (2026-11-22): a thick ink
 * outline, flat fills, one highlight; nothing that needs a close look.
 *
 * Drawn in a box of 64 units, the box itself 30 across with its foot at
 * y = 54 and its middle at x = 32. `TokenG` draws it inside another
 * drawing (the board); `TokenArt` is the piece on its own, for the locker
 * and the chest. `t` is the wall's seconds, for what moves on its own;
 * `look` -1 to 1 turns the eyes; `hop` 0 to 1 lifts it (a stroke's catch);
 * `wobble` 0 to 1 rocks it (a shot off its pace). */

export const TOKEN_U = 64;
/* The middle of the box, which a board puts on the path. */
export const TOKEN_CX = 32;
export const TOKEN_CY = 40;

const BOX = { x: 17, y: 25, w: 30, h: 29, r: 8 };
const ORB = { x: 56, y: 41, r: 6.4 };

export type Paint = ReturnType<typeof wear>;
const f1 = (v: number) => v.toFixed(1);
const col = (c: string | undefined, fallback: string): string => (c === "ink" ? C.ink : c === "paper" ? C.paper : (c ?? fallback));
const RAINBOW = ["#E8443A", "#F28C28", "#F5C935", "#4CB963", "#3A8FD8", "#7B54C9"];
/* A four-point twinkle. */
export const star = (x: number, y: number, r: number): string => `M${f1(x)} ${f1(y - r)} Q${f1(x)} ${f1(y)} ${f1(x + r)} ${f1(y)} Q${f1(x)} ${f1(y)} ${f1(x)} ${f1(y + r)} Q${f1(x)} ${f1(y)} ${f1(x - r)} ${f1(y)} Q${f1(x)} ${f1(y)} ${f1(x)} ${f1(y - r)}Z`;

/* The gradients the pieces use, once per drawing: `uid` keeps two drawings
 * on one screen apart. */
export function TokenDefs({ uid }: { uid: string }) {
  return (
    <Defs>
      <ClipPath id={`${uid}box`}>
        <Rect x={BOX.x} y={BOX.y} width={BOX.w} height={BOX.h} rx={BOX.r} />
      </ClipPath>
      <LinearGradient id={`${uid}chrome`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#FBFCFD" />
        <Stop offset="0.4" stopColor="#9AA3AE" />
        <Stop offset="0.65" stopColor="#E9EDF1" />
        <Stop offset="1" stopColor="#5F6772" />
      </LinearGradient>
      <LinearGradient id={`${uid}gold`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#FFE58A" />
        <Stop offset="0.5" stopColor="#D9A21B" />
        <Stop offset="1" stopColor="#FFF1B8" />
      </LinearGradient>
    </Defs>
  );
}

/* ---- the piece, inside another drawing --------------------------------- */

export function TokenG({ paint, uid, t = 0, look = 0, hop = 0, wobble = 0, orb = true, local = true }: { paint: Paint; uid: string; t?: number; look?: number; hop?: number; wobble?: number; /* The circle at its side: off while it is in flight. */ orb?: boolean; /* The aura round the piece (the board draws the trails). */ local?: boolean }) {
  const rock = wobble * (10 * Math.sin(t * 9.1) + 4 * Math.sin(t * 15.3));
  const lift = hop * 6;
  /* A hop squashes it as it lands and stretches it as it goes up. */
  const sy = 1 + hop * 0.06;
  return (
    <G>
      {/* The shadow on the board stays down; it shrinks as the piece goes up. */}
      <Ellipse cx={32} cy={55.5} rx={15 - hop * 3} ry={3.4 - hop * 0.8} fill={C.ink} fillOpacity={0.16} />
      {local ? <AuraBack a={paint.aura} t={t} /> : null}
      <G y={-lift} rotation={rock} origin="32, 54">
        <G scaleY={sy} origin="32, 54">
          <Body h={paint.hull} uid={uid} t={t} />
          <Face look={look} dark={isDarkFill(paint.hull)} />
          <Hat r={paint.rower} uid={uid} t={t} />
          {paint.hull.bird ? <Bird t={t} /> : null}
        </G>
        {orb ? <ShotArt o={paint.oars} x={ORB.x} y={ORB.y + Math.sin(t * 2.6) * 1.6} r={ORB.r} t={t} /> : null}
      </G>
      {local ? <AuraFront a={paint.aura} t={t} lift={lift} /> : null}
    </G>
  );
}

/* The piece on its own: `size` is the box's 64 units in points. A little
 * room is kept round it for the halo, the cloud and the circle, and, with
 * `trail`, for a short trail behind it to the left. */
export function TokenArt({ paint, size, t = 0, uid = "tk", trail = false, look = 0.4, hop = 0, wobble = 0 }: { paint: Paint; size: number; t?: number; uid?: string; trail?: boolean; look?: number; hop?: number; wobble?: number }) {
  const x0 = trail ? -30 : -4;
  const vw = 72 - x0;
  const y0 = -12;
  const vh = 72;
  const k = size / TOKEN_U;
  const pts = trail ? Array.from({ length: 9 }, (_, i) => ({ x: 26 - i * 6.5, y: 52 + Math.sin(i * 0.9 + t * 2) * 1.2 })) : [];
  return (
    <Svg width={vw * k} height={vh * k} viewBox={`${x0} ${y0} ${vw} ${vh}`}>
      <TokenDefs uid={uid} />
      {trail ? <TrailG a={paint.aura} pts={pts} t={t} w={1} /> : null}
      <TokenG paint={paint} uid={uid} t={t} look={look} hop={hop} wobble={wobble} />
    </Svg>
  );
}

/* The dark boxes, whose eyes are ringed in white so they still read. */
const DARKS = new Set(["#1A1A1A", "#2A2D33", "#2B1A14", "#1C2E5A"]);
const isDarkFill = (h: HullPaint): boolean => DARKS.has(h.fill);

/* ---- the box -------------------------------------------------------------- */

function Body({ h, uid, t }: { h: HullPaint; uid: string; t: number }) {
  const ink = C.ink;
  const fill = h.pattern === "chrome" ? `url(#${uid}chrome)` : col(h.fill, C.paper);
  const second = col(h.second, ink);
  const { x, y, w, h: hh, r } = BOX;
  const glow = 0.55 + 0.45 * Math.sin(t * 3.4);
  const shineX = ((t * 22) % 80) - 20;
  return (
    <G>
      <Rect x={x} y={y} width={w} height={hh} rx={r} fill={fill} />
      <G clipPath={`url(#${uid}box)`}>
        {h.pattern === "twotone" ? <Rect x={x} y={y + hh * 0.55} width={w} height={hh} fill={second} /> : null}
        {h.pattern === "stripe" ? <Rect x={x} y={y + hh * 0.56} width={w} height={5} fill={second} /> : null}
        {h.pattern === "checker"
          ? Array.from({ length: 5 }, (_, i) => Array.from({ length: 5 }, (_, j) => ((i + j) % 2 === 0 ? <Rect key={`${i}-${j}`} x={x + i * 6} y={y + j * 6} width={6} height={6} fill={second} /> : null)))
          : null}
        {h.pattern === "carbon" ? Array.from({ length: 9 }, (_, i) => <Line key={i} x1={x - 10 + i * 6} y1={y + hh} x2={x + 6 + i * 6} y2={y} stroke={second} strokeWidth={2} />) : null}
        {h.pattern === "molten" ? (
          <G>
            <Path d={`M${x} ${y + 18} L${x + 7} ${y + 21} L${x + 12} ${y + 16} L${x + 19} ${y + 22} L${x + 24} ${y + 17} L${x + w} ${y + 20}`} stroke={second} strokeWidth={4.5} strokeOpacity={0.4 * glow} fill="none" />
            <Path d={`M${x} ${y + 18} L${x + 7} ${y + 21} L${x + 12} ${y + 16} L${x + 19} ${y + 22} L${x + 24} ${y + 17} L${x + w} ${y + 20}`} stroke="#FFC24A" strokeWidth={1.6} strokeOpacity={0.6 + 0.4 * glow} fill="none" />
            <Path d={`M${x + 12} ${y + 16} L${x + 10} ${y + 9} M${x + 19} ${y + 22} L${x + 21} ${y + 28}`} stroke="#FFC24A" strokeWidth={1.3} strokeOpacity={glow} />
          </G>
        ) : null}
        {/* THE SHINE that makes a rare a rare: a light down the left, and a
            glint that crosses now and then. */}
        {h.gloss || h.pattern === "chrome" ? (
          <G>
            <Path d={`M${x + 5} ${y + hh - 8} V${y + 9} Q${x + 5} ${y + 5} ${x + 9} ${y + 5}`} stroke="#FFFFFF" strokeOpacity={0.8} strokeWidth={2.4} fill="none" strokeLinecap="round" />
            <Rect x={x + shineX} y={y - 6} width={5} height={hh + 12} fill="#FFFFFF" fillOpacity={0.32} rotation={24} origin={`${x + shineX + 2.5}, ${y + hh / 2}`} />
          </G>
        ) : null}
      </G>
      <Rect x={x} y={y} width={w} height={hh} rx={r} fill="none" stroke={ink} strokeWidth={2.6} />
    </G>
  );
}

/* Two eyes, looking where it is going. */
function Face({ look, dark }: { look: number; dark: boolean }) {
  const ink = C.ink;
  const dx = Math.max(-1, Math.min(1, look)) * 1.6;
  return (
    <G>
      {[26, 38].map((ex) => (
        <G key={ex}>
          <Circle cx={ex} cy={36} r={3.9} fill="#FFFFFF" stroke={dark ? "#FFFFFF" : ink} strokeWidth={1.4} />
          <Circle cx={ex + dx} cy={36.4} r={2} fill="#15171a" />
        </G>
      ))}
    </G>
  );
}

/* A little bird on the box's shoulder, which looks about now and then. */
function Bird({ t }: { t: number }) {
  const ink = C.ink;
  const turn = Math.sin(t * 1.7) > 0.55 ? -1 : 1;
  const hopB = Math.max(0, Math.sin(t * 2.3)) ** 8 * 2;
  const x = 43;
  const y = 21.5 - hopB;
  return (
    <G>
      <Ellipse cx={x} cy={y} rx={4.6} ry={3.4} fill="#5B8FD6" stroke={ink} strokeWidth={1.2} />
      <Path d={`M${x - 4} ${y - 1} L${x - 8} ${y - 3} L${x - 7} ${y + 1}Z`} fill="#3E6DB0" stroke={ink} strokeWidth={1} strokeLinejoin="round" />
      <Circle cx={x + 2.8 * turn} cy={y - 3.8} r={2.7} fill="#5B8FD6" stroke={ink} strokeWidth={1.2} />
      <Circle cx={x + 3.6 * turn} cy={y - 4.3} r={0.7} fill="#15171a" />
      <Path d={`M${x + 5.2 * turn} ${y - 4} L${x + 7.8 * turn} ${y - 3.4} L${x + 5.2 * turn} ${y - 2.8}Z`} fill="#F2A71B" />
    </G>
  );
}

/* ---- the hat -------------------------------------------------------------- */

function Hat({ r, uid, t }: { r: RowerPaint; uid: string; t: number }) {
  const ink = C.ink;
  const bare = r.kit === "ink" && !r.hat && !r.pattern;
  if (bare) return null;
  const kit = r.shimmer ? `url(#${uid}gold)` : col(r.kit, ink);
  const second = col(r.second, C.paper);
  const top = BOX.y;
  if (r.hat === "crown") {
    const s = 0.5 + 0.5 * Math.sin(t * 4);
    return (
      <G>
        <Circle cx={32} cy={top - 7} r={13} fill="#FFD866" fillOpacity={0.1 + 0.14 * s} />
        <Path d={`M21 ${top + 1} V${top - 9} L26 ${top - 4} L32 ${top - 12} L38 ${top - 4} L43 ${top - 9} V${top + 1} Z`} fill={kit} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
        <Circle cx={32} cy={top - 3} r={1.8} fill="#E8443A" stroke={ink} strokeWidth={0.8} />
        <Path d={star(44 + 2 * s, top - 13 - 2 * s, 2 + 1.6 * s)} fill="#FFE27A" stroke={ink} strokeWidth={0.6} />
      </G>
    );
  }
  if (r.hat === "viking")
    return (
      <G>
        <Path d={`M20 ${top - 2} Q14 ${top - 5} 13 ${top - 15} Q18 ${top - 9} 23 ${top - 8}Z`} fill={C.paper} stroke={ink} strokeWidth={1.6} strokeLinejoin="round" />
        <Path d={`M44 ${top - 2} Q50 ${top - 5} 51 ${top - 15} Q46 ${top - 9} 41 ${top - 8}Z`} fill={C.paper} stroke={ink} strokeWidth={1.6} strokeLinejoin="round" />
        <Path d={`M20 ${top + 2} Q20 ${top - 12} 32 ${top - 12} Q44 ${top - 12} 44 ${top + 2} Z`} fill="#9AA3AE" stroke={ink} strokeWidth={2} />
        <Line x1={20.5} y1={top - 1} x2={43.5} y2={top - 1} stroke={kit} strokeWidth={3} />
        <Line x1={32} y1={top - 12} x2={32} y2={top - 2} stroke={ink} strokeWidth={1.4} />
      </G>
    );
  if (r.hat === "cap")
    return (
      <G>
        <Path d={`M19 ${top - 3} Q18 ${top - 13} 32 ${top - 13} Q46 ${top - 13} 45 ${top - 3} Z`} fill={kit} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
        <Rect x={20} y={top - 5} width={24} height={4} fill={second} stroke={ink} strokeWidth={1.4} />
        <Path d={`M21 ${top - 1} Q32 ${top + 4} 46 ${top} L46 ${top - 1.5} Z`} fill={ink} />
        <Circle cx={32} cy={top - 9} r={2.2} fill="#F2C230" stroke={ink} strokeWidth={0.9} />
      </G>
    );
  if (r.hat === "headband")
    return (
      <G>
        {/* A sweatband round the top of the box, its two tails flying back. */}
        <Path d={`M17 ${top + 7} Q11 ${top + 6 + 2 * Math.sin(t * 5)} 7 ${top + 9} M17 ${top + 8} Q12 ${top + 11 + 2 * Math.sin(t * 5 + 1)} 8 ${top + 13}`} stroke={kit} strokeWidth={3} strokeLinecap="round" fill="none" />
        <Rect x={BOX.x - 1} y={top + 3} width={BOX.w + 2} height={6} rx={2} fill={kit} stroke={ink} strokeWidth={1.6} />
        <Rect x={BOX.x - 1} y={top + 5} width={BOX.w + 2} height={2} fill={second} />
      </G>
    );
  /* A BEANIE, the plain hat: a dome, its turned-up band and a pom. */
  const dome = `M20 ${top + 1} Q20 ${top - 13} 32 ${top - 13} Q44 ${top - 13} 44 ${top + 1} Z`;
  return (
    <G>
      <Circle cx={32} cy={top - 14.5} r={3.2} fill={r.pattern === "twotone" ? second : kit} stroke={ink} strokeWidth={1.6} />
      <Path d={dome} fill={kit} stroke={ink} strokeWidth={2} strokeLinejoin="round" />
      {r.pattern === "stripe" ? (
        <G>
          <Path d={`M21.5 ${top - 6} H42.5`} stroke={second} strokeWidth={3} />
          <Path d={`M25 ${top - 11} H39`} stroke={second} strokeWidth={2.6} />
        </G>
      ) : null}
      {r.pattern === "gloss" ? <Path d={`M24 ${top - 3} Q24 ${top - 9} 29 ${top - 11}`} stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={2.2} fill="none" strokeLinecap="round" /> : null}
      <Rect x={19} y={top - 3} width={26} height={6} rx={2.5} fill={r.pattern === "twotone" ? second : kit} stroke={ink} strokeWidth={1.8} />
      {r.pattern === "gloss" ? <Rect x={19} y={top - 3} width={26} height={6} rx={2.5} fill={col(r.second, ink)} fillOpacity={0.9} stroke={ink} strokeWidth={1.8} /> : null}
    </G>
  );
}

/* ---- the circle it shoots ------------------------------------------------ */

/* The shot, at its side or in flight: drawn the same either way. */
export function ShotArt({ o, x, y, r, t = 0 }: { o: OarsPaint; x: number; y: number; r: number; t?: number }) {
  const ink = C.ink;
  const a = col(o.blade, ink);
  const b = col(o.second, ink);
  const w = Math.max(1.2, r * 0.32);
  if (o.extra === "flame") {
    const s = 1 + 0.12 * Math.sin(t * 13);
    return (
      <G>
        <Path d={`M${f1(x - r * 1.05)} ${f1(y + r * 0.3)} Q${f1(x - r * 1.1)} ${f1(y - r * 1.5 * s)} ${f1(x + r * 0.1)} ${f1(y - r * 2.3 * s)} Q${f1(x + r * 1.3)} ${f1(y - r * 1.2 * s)} ${f1(x + r * 1.05)} ${f1(y + r * 0.3)} Q${f1(x)} ${f1(y + r * 1.5)} ${f1(x - r * 1.05)} ${f1(y + r * 0.3)}Z`} fill="#F0631E" stroke={ink} strokeWidth={w * 0.8} strokeLinejoin="round" />
        <Path d={`M${f1(x - r * 0.55)} ${f1(y + r * 0.4)} Q${f1(x - r * 0.5)} ${f1(y - r * 0.7 * s)} ${f1(x + r * 0.1)} ${f1(y - r * 1.25 * s)} Q${f1(x + r * 0.7)} ${f1(y - r * 0.5)} ${f1(x + r * 0.55)} ${f1(y + r * 0.4)}Z`} fill="#FFD23F" />
        <Circle cx={x} cy={y + r * 0.35} r={r * 0.42} fill={a} />
      </G>
    );
  }
  if (o.extra === "bolt") {
    const on = Math.sin(t * 19) * Math.sin(t * 7) > -0.2;
    return (
      <G>
        <Circle cx={x} cy={y} r={r} fill={a} stroke={ink} strokeWidth={w} />
        <Path d={`M${f1(x + r * 0.2)} ${f1(y - r * 0.75)} L${f1(x - r * 0.35)} ${f1(y + r * 0.05)} L${f1(x + r * 0.15)} ${f1(y + r * 0.05)} L${f1(x - r * 0.25)} ${f1(y + r * 0.8)}`} stroke={b} strokeWidth={w * 1.1} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        {on ? <Path d={`M${f1(x + r * 1.2)} ${f1(y - r * 0.9)} l${f1(r * 0.5)} ${f1(r * 0.4)} l${f1(-r * 0.3)} ${f1(r * 0.2)} l${f1(r * 0.5)} ${f1(r * 0.5)} M${f1(x - r * 1.3)} ${f1(y + r * 0.6)} l${f1(-r * 0.4)} ${f1(r * 0.3)}`} stroke={b} strokeWidth={w * 0.8} fill="none" strokeLinecap="round" /> : null}
      </G>
    );
  }
  if (o.extra === "ribbon") {
    const k = Math.sin(t * 6);
    return (
      <G>
        <Path d={`M${f1(x - r * 0.6)} ${f1(y + r * 0.6)} q${f1(-r * 0.9)} ${f1(r * (0.6 + 0.4 * k))} ${f1(-r * 1.6)} ${f1(r * (0.1 + 0.5 * k))} t${f1(-r * 1.2)} ${f1(r * 0.5 * k)}`} stroke="#F3A6C8" strokeWidth={w * 1.4} fill="none" strokeLinecap="round" />
        <Circle cx={x} cy={y} r={r} fill={a} stroke={ink} strokeWidth={w} />
        <Path d={`M${f1(x - r * 0.7)} ${f1(y)} H${f1(x + r * 0.7)} M${f1(x)} ${f1(y - r * 0.7)} V${f1(y + r * 0.7)}`} stroke="#FFFFFF" strokeOpacity={0.8} strokeWidth={w * 0.7} />
      </G>
    );
  }
  if (o.pattern === "split")
    return (
      <G>
        <Path d={`M${f1(x)} ${f1(y - r)} A${r} ${r} 0 0 0 ${f1(x)} ${f1(y + r)} Z`} fill={a} />
        <Path d={`M${f1(x)} ${f1(y - r)} A${r} ${r} 0 0 1 ${f1(x)} ${f1(y + r)} Z`} fill={b} />
        <Circle cx={x} cy={y} r={r} fill="none" stroke={ink} strokeWidth={w} />
      </G>
    );
  if (o.pattern === "tip")
    return (
      <G>
        <Circle cx={x} cy={y} r={r} fill={a} stroke={ink} strokeWidth={w} />
        <Circle cx={x} cy={y} r={r * 0.42} fill={b} stroke={ink} strokeWidth={w * 0.6} />
      </G>
    );
  if (o.pattern === "gloss")
    return (
      <G>
        <Circle cx={x} cy={y} r={r} fill={a} stroke={ink} strokeWidth={w} />
        <Circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.28} fill="#FFFFFF" fillOpacity={0.9} />
      </G>
    );
  /* The stock one is a ring; a common one is filled with its colour. */
  if (o.blade === "ink") return <Circle cx={x} cy={y} r={r * 0.85} fill={C.paper} stroke={ink} strokeWidth={w * 1.15} />;
  return <Circle cx={x} cy={y} r={r} fill={a} stroke={ink} strokeWidth={w} />;
}

/* ---- the aura round the piece --------------------------------------------- */

function AuraBack({ a, t }: { a: AuraPaint; t: number }) {
  const c = col(a.color, C.ink);
  if (a.kind === "ripples")
    return (
      <G>
        {[0, 1, 2].map((i) => {
          const k = (t * 0.55 + i / 3) % 1;
          return <Ellipse key={i} cx={32} cy={55} rx={16 + 16 * k} ry={4 + 4 * k} stroke={c} strokeOpacity={0.6 * (1 - k)} strokeWidth={1.6} fill="none" />;
        })}
      </G>
    );
  return null;
}

function AuraFront({ a, t, lift }: { a: AuraPaint; t: number; lift: number }) {
  const c = col(a.color, C.ink);
  const ink = C.ink;
  switch (a.kind) {
    case "bubbles":
      return (
        <G>
          {[0, 1, 2, 3].map((i) => {
            const k = (t * 0.6 + i / 4) % 1;
            return <Circle key={i} cx={(i % 2 ? 12 : 52) + 2 * Math.sin(t * 3 + i)} cy={54 - k * 34} r={1.8 + i * 0.5} stroke={c} strokeWidth={1.5} fill="none" strokeOpacity={1 - k * 0.8} />;
          })}
        </G>
      );
    case "halo":
      return <Ellipse cx={32} cy={8 - lift + 1.2 * Math.sin(t * 2.4)} rx={11} ry={3.2} stroke={c} strokeWidth={2.6} fill="none" />;
    case "cloud":
      return (
        <G y={1.4 * Math.sin(t * 1.3)}>
          {[0, 1, 2].map((i) => {
            const k = (t * 1.3 + i / 3) % 1;
            return <Line key={i} x1={25 + i * 7} y1={2 + k * 18} x2={24 + i * 7} y2={6 + k * 18} stroke="#5A8FD8" strokeWidth={1.6} strokeLinecap="round" strokeOpacity={1 - k} />;
          })}
          <Path d="M18 -1 q0 -7 8 -6 q3 -6 10 -3 q7 -2 8 5 q6 1 5 5 q-1 3 -5 3 h-22 q-5 0 -4 -4z" fill="#C9D1DC" stroke={ink} strokeWidth={1.4} strokeLinejoin="round" />
        </G>
      );
    case "stars":
      return (
        <G>
          {[0, 1, 2].map((i) => {
            const k = 0.5 + 0.5 * Math.sin(t * 4 + i * 2.1);
            return <Path key={i} d={star([10, 54, 50][i], [30, 22, 52][i], 2 + 2.4 * k)} fill={c} stroke={ink} strokeWidth={0.7} fillOpacity={0.6 + 0.4 * k} />;
          })}
        </G>
      );
    case "starfall":
      return (
        <G>
          {[0, 1, 2, 3, 4].map((i) => {
            const k = (t * 0.5 + i / 5) % 1;
            return <Path key={i} d={star([8, 20, 44, 56, 30][i] - k * 6, -8 + k * 60, 1.8 + 1.4 * Math.sin(t * 5 + i))} fill={c} stroke={ink} strokeWidth={0.6} fillOpacity={1 - k * 0.7} />;
          })}
        </G>
      );
    default:
      return null;
  }
}

/* ---- the trail on the board ------------------------------------------------ */

/* THE TRAIL behind a piece as it goes: `pts` from the piece back, in the
 * drawing's own units; `w` how many of them a unit of the piece is (the
 * board draws pieces scaled). Only the aura that is a trail draws here. */
export function TrailG({ a, pts, t, w = 1 }: { a: AuraPaint; pts: { x: number; y: number }[]; t: number; w?: number }): ReactNode {
  if (pts.length < 2) return null;
  const c = col(a.color, C.ink);
  const ink = C.ink;
  const n = pts.length;
  switch (a.kind) {
    case "foam":
      return (
        <G>
          {pts.slice(1).map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={(2.6 - (i / n) * 1.6) * w} fill={C.paper} stroke={C.gray} strokeWidth={1.1 * w} strokeOpacity={1 - i / n} fillOpacity={1 - i / n} />
          ))}
        </G>
      );
    case "speed":
      return (
        <G>
          {pts.slice(1, 6).map((p, i) => {
            const q = pts[Math.min(n - 1, i + 2)];
            const off = ((i % 2 ? 1 : -1) * 4 + Math.sin(t * 8 + i) * 1.5) * w;
            const dx = q.x - p.x;
            const dy = q.y - p.y;
            const L = Math.hypot(dx, dy) || 1;
            return <Line key={i} x1={p.x - (dy / L) * off} y1={p.y + (dx / L) * off} x2={q.x - (dy / L) * off} y2={q.y + (dx / L) * off} stroke={c} strokeWidth={2.4 * w} strokeLinecap="round" strokeOpacity={0.9 - i * 0.15} />;
          })}
        </G>
      );
    case "stars":
      return (
        <G>
          {pts.slice(1).filter((_, i) => i % 2 === 0).map((p, i) => {
            const k = 0.5 + 0.5 * Math.sin(t * 5 + i * 1.3);
            return <Path key={i} d={star(p.x, p.y - 3 * w, (1.6 + 2 * k) * w)} fill={c} stroke={ink} strokeWidth={0.6 * w} fillOpacity={(1 - i / n) * (0.6 + 0.4 * k)} />;
          })}
        </G>
      );
    case "rainbow": {
      const lineOf = (off: number) => {
        let d = "";
        pts.forEach((p, i) => {
          const q = pts[Math.min(n - 1, i + 1)];
          const o = pts[Math.max(0, i - 1)];
          const dx = q.x - o.x;
          const dy = q.y - o.y;
          const L = Math.hypot(dx, dy) || 1;
          const wave = Math.sin(t * 5 - i * 0.6) * 1.2 * w;
          d += `${i ? "L" : "M"}${f1(p.x - (dy / L) * (off + wave))} ${f1(p.y + (dx / L) * (off + wave))}`;
        });
        return d;
      };
      return (
        <G>
          {RAINBOW.map((rc, i) => (
            <Path key={rc} d={lineOf((i - 2.5) * 2.2 * w)} stroke={rc} strokeWidth={2.4 * w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </G>
      );
    }
    default:
      return null;
  }
}

/* What the piece wears, from the locker's choice. */
export const paintOf = (eq: Partial<Equipped> | null | undefined): Paint => wear(eq);
