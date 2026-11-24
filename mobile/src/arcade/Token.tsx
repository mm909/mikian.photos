import type { ReactNode } from "react";
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { C, isDark } from "../theme";
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
 * `wobble` 0 to 1 rocks it (a shot off its pace).
 *
 * THE POLISH (2026-11-24, the art pass): the piece has a face (it blinks,
 * it smiles, it frets when its aim is off), it squashes as it leaves the
 * board and stretches in the air, and its lines thicken as it gets small
 * (`lw`, from `lwOf`), so the outline holds at 26 points and at 130. THE
 * LADDER is drawn so no step passes for another: a common is flat colour
 * and nothing else; an uncommon is two colours; a rare shines (a streak, a
 * glint crossing, a twinkle); an epic has a thing added; a legendary never
 * stops moving. */

export const TOKEN_U = 64;
/* The middle of the box, which a board puts on the path. */
export const TOKEN_CX = 32;
export const TOKEN_CY = 40;

const BOX = { x: 17, y: 25, w: 30, h: 29, r: 8 };
const ORB = { x: 56, y: 41, r: 6.4 };
/* The ink of a face on a box of a fixed colour: the same in both looks. */
const INK = "#15171a";

export type Paint = ReturnType<typeof wear>;
const f1 = (v: number) => v.toFixed(1);
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
/* The part of a number after the point, for what goes round and round. */
const frac = (v: number) => v - Math.floor(v);
const col = (c: string | undefined, fallback: string): string => (c === "ink" ? C.ink : c === "paper" ? C.paper : (c ?? fallback));
const RAINBOW = ["#E8443A", "#F28C28", "#F5C935", "#4CB963", "#3A8FD8", "#7B54C9"];
/* A four-point twinkle. */
export const star = (x: number, y: number, r: number): string => `M${f1(x)} ${f1(y - r)} Q${f1(x)} ${f1(y)} ${f1(x + r)} ${f1(y)} Q${f1(x)} ${f1(y)} ${f1(x)} ${f1(y + r)} Q${f1(x)} ${f1(y)} ${f1(x - r)} ${f1(y)} Q${f1(x)} ${f1(y)} ${f1(x)} ${f1(y - r)}Z`;
/* A number of its own for each drawing, 0 to 1, so two pieces on a board do
 * not blink together. */
const seedOf = (s: string): number => {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
  return h / 997;
};
/* HOW THICK THE LINES ARE for a piece drawn `pts` points to its 64 units: a
 * small piece gets a heavier line and a big one a lighter, so the outline is
 * about a point and a half at 26 and four and a half at 130. */
export const lwOf = (pts: number): number => clamp((TOKEN_U / Math.max(8, pts)) ** 0.45, 0.8, 1.5);
/* Scaled about a point: one transform, read the same by the phone and the
 * browser (the browser does not know `scaleY`). */
const about = (ox: number, oy: number, sx: number, sy: number): string => `translate(${f1(ox)} ${f1(oy)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)}) translate(${f1(-ox)} ${f1(-oy)})`;

const CROWN = `M21 ${BOX.y + 1} V${BOX.y - 9} L26 ${BOX.y - 4} L32 ${BOX.y - 12} L38 ${BOX.y - 4} L43 ${BOX.y - 9} V${BOX.y + 1} Z`;

/* The gradients the pieces use, once per drawing: `uid` keeps two drawings
 * on one screen apart. */
export function TokenDefs({ uid }: { uid: string }) {
  return (
    <Defs>
      <ClipPath id={`${uid}box`}>
        <Rect x={BOX.x} y={BOX.y} width={BOX.w} height={BOX.h} rx={BOX.r} />
      </ClipPath>
      <ClipPath id={`${uid}crown`}>
        <Path d={CROWN} />
      </ClipPath>
      <LinearGradient id={`${uid}chrome`} x1="0" y1="0" x2="0.9" y2="1">
        <Stop offset="0" stopColor="#FFFFFF" />
        <Stop offset="0.34" stopColor="#AEB7C2" />
        <Stop offset="0.5" stopColor="#59616C" />
        <Stop offset="0.56" stopColor="#F4F6F8" />
        <Stop offset="1" stopColor="#8E97A3" />
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

export function TokenG({ paint, uid, t = 0, look = 0, hop = 0, wobble = 0, orb = true, local = true, lw = 1 }: { paint: Paint; uid: string; t?: number; look?: number; hop?: number; wobble?: number; /* The circle at its side: off while it is in flight. */ orb?: boolean; /* The aura round the piece (the board draws the trails). */ local?: boolean; /* How thick its lines are (lwOf). */ lw?: number }) {
  const seed = seedOf(uid);
  const rock = wobble * (10 * Math.sin(t * 9.1) + 4 * Math.sin(t * 15.3));
  const h = clamp(hop);
  /* SQUASH AND STRETCH: low in the hop (leaving the board, and landing) it
   * is squashed wide; in the air it is stretched tall. Standing, it
   * breathes a little. */
  const air = clamp((h - 0.25) / 0.75);
  const st = h < 0.25 ? -0.11 * Math.sin((h / 0.25) * Math.PI) : 0.12 * air;
  const breath = h > 0 ? 0 : 0.012 * Math.sin(t * 2.2 + seed * 6);
  const sy = 1 + st + breath;
  const sx = 1 - st * 0.75 - breath * 0.6;
  const lift = air * 7.5;
  const dark = isDark();
  return (
    <G>
      {/* The shadow on the board stays down; it shrinks as the piece goes up. */}
      <Ellipse cx={32} cy={55.6} rx={(15.5 - air * 4) * sx} ry={3.6 - air * 1} fill={dark ? "#000000" : C.ink} fillOpacity={dark ? 0.55 : 0.17} />
      {local ? <AuraBack a={paint.aura} t={t} /> : null}
      <G transform={`translate(0 ${f1(-lift)}) rotate(${f1(rock)} 32 54)`}>
        <G transform={about(32, 54, sx, sy)}>
          <Body h={paint.hull} uid={uid} t={t} lw={lw} seed={seed} />
          <Face look={look} fill={paint.hull} t={t} seed={seed} hop={h} worry={wobble} lw={lw} />
          <Hat r={paint.rower} uid={uid} t={t} lw={lw} />
          {paint.hull.bird ? <Bird t={t} lw={lw} /> : null}
        </G>
        {/* The circle bobs at its side, and trails the hop a little. */}
        {orb ? <ShotArt o={paint.oars} x={ORB.x} y={ORB.y + Math.sin(t * 2.6 + seed * 6) * 1.6 + lift * 0.35} r={ORB.r} t={t} lw={lw} /> : null}
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
      <TokenG paint={paint} uid={uid} t={t} look={look} hop={hop} wobble={wobble} lw={lwOf(size)} />
    </Svg>
  );
}

/* The dark boxes, whose faces are drawn in white so they still read. */
const DARKS = new Set(["#1A1A1A", "#2A2D33", "#2B1A14", "#1C2E5A"]);
const isDarkFill = (h: HullPaint): boolean => DARKS.has(h.fill) || (h.fill === "paper" && isDark()) || (h.fill === "ink" && !isDark());

/* ---- the box -------------------------------------------------------------- */

const CRACK = (x: number, y: number, w: number) => `M${x} ${y + 17} L${x + 6} ${y + 20.5} L${x + 11} ${y + 15.5} L${x + 18} ${y + 21.5} L${x + 24} ${y + 16.5} L${x + w} ${y + 19.5}`;

function Body({ h, uid, t, lw, seed }: { h: HullPaint; uid: string; t: number; lw: number; seed: number }) {
  const ink = C.ink;
  const fill = h.pattern === "chrome" ? `url(#${uid}chrome)` : col(h.fill, C.paper);
  const second = col(h.second, ink);
  const { x, y, w, h: hh, r } = BOX;
  const glow = 0.55 + 0.45 * Math.sin(t * 3.4);
  const molten = h.pattern === "molten";
  /* Molten has its own light; the streak is the rares'. */
  const shine = !molten && (h.gloss || h.pattern === "chrome");
  /* The glint crosses once every four seconds, and is off the box the rest
   * of the time. */
  const shineX = frac((t * 20) / 80 + seed) * 80 - 22;
  return (
    <G>
      {/* A legendary is lit from behind. */}
      {molten ? <Circle cx={32} cy={40} r={23 + 2 * glow} fill="#F0631E" fillOpacity={0.08 + 0.09 * glow} /> : null}
      <Rect x={x} y={y} width={w} height={hh} rx={r} fill={fill} />
      <G clipPath={`url(#${uid}box)`}>
        {h.pattern === "twotone" ? (
          <G>
            <Rect x={x} y={y + hh * 0.58} width={w} height={hh} fill={second} />
            <Line x1={x} y1={y + hh * 0.58} x2={x + w} y2={y + hh * 0.58} stroke={INK} strokeWidth={1.3 * lw} />
          </G>
        ) : null}
        {h.pattern === "stripe" ? (
          h.bird ? (
            /* Planks: the bird's perch is a wooden box. */
            <G>
              <Rect x={x} y={y + hh * 0.6} width={w} height={hh} fill={second} fillOpacity={0.55} />
              <Line x1={x} y1={y + hh * 0.6} x2={x + w} y2={y + hh * 0.6} stroke={second} strokeWidth={1.6 * lw} />
              <Line x1={x} y1={y + hh * 0.84} x2={x + w} y2={y + hh * 0.84} stroke={second} strokeWidth={1.3 * lw} />
            </G>
          ) : (
            /* Two racing stripes down it, a wide and a narrow. */
            <G>
              <Rect x={x + 4.6} y={y} width={5.4} height={hh} fill={second} />
              <Rect x={x + 11.6} y={y} width={2.2} height={hh} fill={second} />
            </G>
          )
        ) : null}
        {h.pattern === "checker"
          ? Array.from({ length: 5 }, (_, i) => Array.from({ length: 5 }, (_, j) => ((i + j) % 2 === 0 ? <Rect key={`${i}-${j}`} x={x + i * 6} y={y + j * 6} width={6} height={6} fill={second} /> : null)))
          : null}
        {h.pattern === "carbon" ? (
          <G>
            {Array.from({ length: 9 }, (_, i) => (
              <Line key={i} x1={x - 10 + i * 6} y1={y + hh} x2={x + 6 + i * 6} y2={y} stroke={second} strokeWidth={2.2} />
            ))}
            {Array.from({ length: 9 }, (_, i) => (
              <Line key={`b${i}`} x1={x - 10 + i * 6} y1={y} x2={x + 6 + i * 6} y2={y + hh} stroke="#000000" strokeOpacity={0.4} strokeWidth={1.2} />
            ))}
          </G>
        ) : null}
        {molten ? (
          <G>
            {/* The lava it stands in, its top rolling. */}
            <Path
              d={`M${x} ${y + hh} ${Array.from({ length: 7 }, (_, i) => `L${f1(x + i * 5)} ${f1(y + hh - 6.2 + 1.5 * Math.sin(i * 1.4 + t * 3.2))}`).join(" ")} L${x + w} ${y + hh} Z`}
              fill="#F0631E"
              stroke="#FFC24A"
              strokeWidth={1.2}
            />
            <Path d={CRACK(x, y, w)} stroke={second} strokeWidth={5} strokeOpacity={0.25 + 0.3 * glow} fill="none" strokeLinejoin="round" />
            <Path d={CRACK(x, y, w)} stroke="#FFC24A" strokeWidth={1.7} strokeOpacity={0.65 + 0.35 * glow} fill="none" strokeLinejoin="round" />
            <Path d={`M${x + 11} ${y + 15.5} L${x + 9} ${y + 8} L${x + 12} ${y + 4} M${x + 24} ${y + 16.5} L${x + 26} ${y + 9}`} stroke="#FFC24A" strokeWidth={1.3} strokeOpacity={0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 4.3 + 1))} fill="none" strokeLinejoin="round" />
          </G>
        ) : null}
        {/* Every box has a foot: a shade along the bottom, so it stands on
            the board like a piece and is not a sticker. */}
        {molten ? null : <Rect x={x} y={y + hh - 4.2} width={w} height={4.2} fill="#000000" fillOpacity={0.13} />}
        {/* THE SHINE that makes a rare a rare: a streak of light round its
            corner, and a glint that crosses now and then. */}
        {shine ? (
          <G>
            <Path d={`M${x + 4.2} ${y + 7.6} Q${x + 4.2} ${y + 4.2} ${x + 7.6} ${y + 4.2} H${x + 13}`} stroke="#FFFFFF" strokeOpacity={0.95} strokeWidth={2.6} fill="none" strokeLinecap="round" />
            <Circle cx={x + 17} cy={y + 4.2} r={1.3} fill="#FFFFFF" fillOpacity={0.95} />
            <Path d={`M${x + w - 4.2} ${y + hh - 12} V${y + hh - 8}`} stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={2} strokeLinecap="round" />
            <Rect x={x + shineX} y={y - 8} width={6} height={hh + 16} fill="#FFFFFF" fillOpacity={0.4} transform={`rotate(24 ${f1(x + shineX + 3)} ${f1(y + hh / 2)})`} />
            <Rect x={x + shineX + 8.5} y={y - 8} width={1.8} height={hh + 16} fill="#FFFFFF" fillOpacity={0.4} transform={`rotate(24 ${f1(x + shineX + 9.4)} ${f1(y + hh / 2)})`} />
          </G>
        ) : null}
      </G>
      <Rect x={x} y={y} width={w} height={hh} rx={r} fill="none" stroke={ink} strokeWidth={2.8 * lw} />
      {/* A rare twinkles at its corner. */}
      {shine ? <Path d={star(x + w - 2.5, y + 3.5, 2.2 + 2.6 * Math.max(0, Math.sin(t * 2.4 + seed * 6)))} fill="#FFFFFF" stroke={INK} strokeWidth={0.8} strokeLinejoin="round" /> : null}
      {/* Embers off the molten box, going up and out. */}
      {molten
        ? [0, 1, 2, 3, 4].map((i) => {
            const k = frac(t * 0.5 + i / 5 + seed);
            return <Circle key={i} cx={x + 4 + i * 5.4 + Math.sin(t * 3 + i * 2) * 1.8} cy={y + 1 - k * 21} r={1.9 * (1 - k) + 0.5} fill={k < 0.45 ? "#FFC24A" : "#F0631E"} fillOpacity={1 - k * 0.9} />;
          })
        : null}
    </G>
  );
}

/* THE FACE: two eyes looking where it is going, a blink now and then, a
 * small smile that opens at the top of a hop, and a worried "o" under
 * slanted brows when its aim is off (`worry`). */
function Face({ look, fill, t, seed, hop, worry, lw }: { look: number; fill: HullPaint; t: number; seed: number; hop: number; worry: number; lw: number }) {
  const dark = isDarkFill(fill);
  const fi = dark ? "#FFFFFF" : INK;
  const busy = fill.pattern === "checker" || fill.pattern === "carbon" || fill.pattern === "chrome" || fill.pattern === "molten";
  const fret = worry > 0.12;
  const dx = clamp(look, -1, 1) * 1.7;
  const dy = -hop * 0.9 + (fret ? 0.4 : 0);
  const blink = !fret && frac(t * 0.27 + seed) < 0.035;
  const mouthW = 1.7 * lw;
  return (
    <G>
      {busy ? null : (
        <G>
          <Ellipse cx={21.6} cy={42} rx={2.3} ry={1.4} fill="#FF7F96" fillOpacity={0.55} />
          <Ellipse cx={42.4} cy={42} rx={2.3} ry={1.4} fill="#FF7F96" fillOpacity={0.55} />
        </G>
      )}
      {[25.7, 38.3].map((ex, i) =>
        blink ? (
          <Path key={ex} d={`M${ex - 3.6} 36.4 Q${ex} 39.6 ${ex + 3.6} 36.4`} stroke={fi} strokeWidth={1.9 * lw} fill="none" strokeLinecap="round" />
        ) : (
          <G key={ex}>
            <Circle cx={ex} cy={36.3} r={4.3} fill="#FFFFFF" stroke={dark ? "#FFFFFF" : INK} strokeWidth={1.4 * lw} />
            <Circle cx={ex + dx} cy={36.7 + dy} r={fret ? 1.9 : 2.4} fill={INK} />
            <Circle cx={ex + dx + 0.9} cy={35.7 + dy} r={0.85} fill="#FFFFFF" />
            {fret ? <Line x1={ex + (i ? 3.6 : -3.6)} y1={30.4} x2={ex + (i ? -2.6 : 2.6)} y2={28.4} stroke={fi} strokeWidth={1.7 * lw} strokeLinecap="round" /> : null}
          </G>
        ),
      )}
      {fret ? (
        <Ellipse cx={32} cy={45.4} rx={1.8} ry={2.1} fill={fi} />
      ) : hop > 0.45 ? (
        <G>
          <Path d="M29 43 Q32 48.4 35 43 Z" fill={fi} stroke={fi} strokeWidth={1.2} strokeLinejoin="round" />
          <Ellipse cx={32} cy={45.6} rx={1.3} ry={0.8} fill="#FF7F96" />
        </G>
      ) : (
        <G>
          {fill.pattern === "checker" ? <Path d="M29.2 43.5 Q32 46.6 34.8 43.5" stroke="#FFFFFF" strokeWidth={mouthW + 2.2} fill="none" strokeLinecap="round" /> : null}
          <Path d="M29.2 43.5 Q32 46.6 34.8 43.5" stroke={fi} strokeWidth={mouthW} fill="none" strokeLinecap="round" />
        </G>
      )}
    </G>
  );
}

/* A little bird on the box's shoulder: it looks about, hops, and chirps. */
function Bird({ t, lw }: { t: number; lw: number }) {
  const ink = C.ink;
  const turn = Math.sin(t * 1.7) > 0.55 ? -1 : 1;
  const hopB = Math.max(0, Math.sin(t * 2.3)) ** 8 * 2.6;
  const chirp = frac(t * 0.31) < 0.16;
  const x = 41.5;
  const y = 20.4 - hopB;
  const sw = 1.4 * lw;
  return (
    <G>
      <Path d={`M${x - 4.4} ${y - 0.4} L${x - 10} ${y - 3.6} L${x - 8.6} ${y + 2}Z`} fill="#3E6DB0" stroke={ink} strokeWidth={sw * 0.85} strokeLinejoin="round" />
      <Ellipse cx={x} cy={y} rx={5.8} ry={4.5} fill="#5B8FD6" stroke={ink} strokeWidth={sw} />
      <Path d={`M${x - 3.6} ${y - 0.6} Q${x - 1} ${y + 3.8} ${x + 2.6} ${y - 0.2} Z`} fill="#3E6DB0" />
      <Circle cx={x + 3.4 * turn} cy={y - 5} r={3.5} fill="#5B8FD6" stroke={ink} strokeWidth={sw} />
      <Circle cx={x + 4.4 * turn} cy={y - 5.6} r={1} fill={INK} />
      <Path d={`M${x + 6.6 * turn} ${y - 5.6} L${x + 10 * turn} ${y - 4.5} L${x + 6.6 * turn} ${y - 3.4}Z`} fill="#F2A71B" stroke={ink} strokeWidth={0.7} strokeLinejoin="round" />
      {chirp ? <Path d={`M${x + 11.6 * turn} ${y - 8} l${2 * turn} -1.6 M${x + 12.4 * turn} ${y - 4.6} l${2.4 * turn} 0`} stroke={ink} strokeWidth={1.2} strokeLinecap="round" /> : null}
    </G>
  );
}

/* ---- the hat -------------------------------------------------------------- */

function Hat({ r, uid, t, lw }: { r: RowerPaint; uid: string; t: number; lw: number }) {
  const ink = C.ink;
  const bare = r.kit === "ink" && !r.hat && !r.pattern;
  if (bare) return null;
  const kit = r.shimmer ? `url(#${uid}gold)` : col(r.kit, ink);
  const second = col(r.second, C.paper);
  const top = BOX.y;
  const sw = 2.1 * lw;
  if (r.hat === "crown") {
    /* THE CROWN: a light runs across the gold, its jewels change, and
     * three sparks go round it. */
    const s = 0.5 + 0.5 * Math.sin(t * 4);
    const sweep = frac((t * 26) / 70) * 70 - 20;
    const jewels = ["#E8443A", "#3A8FD8", "#4CB963"];
    const turn = Math.floor(t * 1.6);
    return (
      <G>
        <Circle cx={32} cy={top - 6} r={14 + 2 * s} fill="#FFD866" fillOpacity={0.12 + 0.14 * s} />
        <Path d={CROWN} fill={kit} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
        <G clipPath={`url(#${uid}crown)`}>
          <Rect x={14 + sweep} y={top - 16} width={5} height={22} fill="#FFFFFF" fillOpacity={0.75} transform={`rotate(20 ${f1(16 + sweep)} ${top - 5})`} />
          <Rect x={20} y={top - 2.2} width={24} height={1} fill="#8C6A12" fillOpacity={0.5} />
        </G>
        <Path d={CROWN} fill="none" stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
        {[21, 32, 43].map((px, i) => (
          <Circle key={px} cx={px} cy={i === 1 ? top - 12.6 : top - 9.6} r={1.7} fill="#FFE58A" stroke={ink} strokeWidth={0.9 * lw} />
        ))}
        {[26, 32, 38].map((jx, i) => (
          <Circle key={jx} cx={jx} cy={top - 2.2 - (i === 1 ? 1.2 : 0)} r={i === 1 ? 2 : 1.4} fill={jewels[(i + turn) % 3]} stroke={ink} strokeWidth={0.8} />
        ))}
        {[0, 1, 2].map((i) => {
          const a = t * 1.5 + i * 2.094;
          const k = 0.5 + 0.5 * Math.sin(t * 5 + i * 2);
          return <Path key={i} d={star(32 + Math.cos(a) * 17, top - 7 + Math.sin(a) * 6, 1.6 + 1.8 * k)} fill="#FFE27A" stroke={ink} strokeWidth={0.6} strokeLinejoin="round" />;
        })}
      </G>
    );
  }
  if (r.hat === "viking")
    return (
      <G>
        <Path d={`M20.5 ${top - 2} Q13 ${top - 4} 12 ${top - 16} Q17.5 ${top - 9} 24 ${top - 8.5}Z`} fill="#F4EBD3" stroke={ink} strokeWidth={sw * 0.85} strokeLinejoin="round" />
        <Path d={`M43.5 ${top - 2} Q51 ${top - 4} 52 ${top - 16} Q46.5 ${top - 9} 40 ${top - 8.5}Z`} fill="#F4EBD3" stroke={ink} strokeWidth={sw * 0.85} strokeLinejoin="round" />
        <Path d={`M20 ${top + 2} Q20 ${top - 12} 32 ${top - 12} Q44 ${top - 12} 44 ${top + 2} Z`} fill="#A9B2BD" stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
        <Path d={`M24 ${top - 3.5} Q24.5 ${top - 9} 29 ${top - 10.4}`} stroke="#FFFFFF" strokeOpacity={0.8} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        <Rect x={19.4} y={top - 2.6} width={25.2} height={4.6} rx={1.4} fill={kit} stroke={ink} strokeWidth={sw * 0.8} />
        <Rect x={30.4} y={top - 12} width={3.2} height={10} fill={kit} stroke={ink} strokeWidth={sw * 0.6} />
        {[23.5, 32, 40.5].map((rx) => (
          <Circle key={rx} cx={rx} cy={top - 0.3} r={1} fill="#F2C230" stroke={ink} strokeWidth={0.5} />
        ))}
      </G>
    );
  if (r.hat === "cap")
    return (
      <G>
        <Path d={`M18.5 ${top - 3} Q16 ${top - 14.5} 32 ${top - 14.5} Q48 ${top - 14.5} 45.5 ${top - 3} Z`} fill={second} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
        <Rect x={19.5} y={top - 6} width={25} height={4.6} fill={kit} stroke={ink} strokeWidth={sw * 0.75} />
        <Line x1={20.4} y1={top - 3.7} x2={43.6} y2={top - 3.7} stroke="#F2C230" strokeWidth={1.1} />
        <Path d={`M19.5 ${top - 1.4} Q32 ${top + 4.6} 47.5 ${top + 0.6} Q47.8 ${top - 1} 44.5 ${top - 1.4} Z`} fill={INK} stroke={ink} strokeWidth={sw * 0.5} strokeLinejoin="round" />
        <Path d={`M24 ${top + 0.4} Q32 ${top + 2.8} 42 ${top + 0.6}`} stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={0.9} fill="none" strokeLinecap="round" />
        {/* The badge: an anchor on gold. */}
        <Circle cx={32} cy={top - 9.4} r={3.3} fill="#F2C230" stroke={ink} strokeWidth={1 * lw} />
        <Path d={`M32 ${top - 11.4} V${top - 7.6} M30.2 ${top - 8.8} Q32 ${top - 6.6} 33.8 ${top - 8.8} M30.9 ${top - 10.4} H33.1`} stroke={INK} strokeWidth={0.9} fill="none" strokeLinecap="round" />
      </G>
    );
  if (r.hat === "headband") {
    const fl = Math.sin(t * 5);
    const fl2 = Math.sin(t * 5 + 1);
    const tail1 = `M17 ${top + 3.6} Q11 ${f1(top + 2 + 2 * fl)} 6 ${f1(top + 5 + fl)}`;
    const tail2 = `M17 ${top + 4.6} Q12 ${f1(top + 8 + 2 * fl2)} 7.5 ${f1(top + 10.5 + fl2)}`;
    return (
      <G>
        {/* A sweatband round the top of the box, its knot and two tails
            flying back. */}
        <Path d={tail1} stroke={ink} strokeWidth={4.4} strokeLinecap="round" fill="none" />
        <Path d={tail2} stroke={ink} strokeWidth={4.4} strokeLinecap="round" fill="none" />
        <Path d={tail1} stroke={kit} strokeWidth={2.6} strokeLinecap="round" fill="none" />
        <Path d={tail2} stroke={kit} strokeWidth={2.6} strokeLinecap="round" fill="none" />
        <Rect x={BOX.x - 1.2} y={top + 1} width={BOX.w + 2.4} height={5.6} rx={2} fill={kit} stroke={ink} strokeWidth={sw * 0.8} />
        <Rect x={BOX.x - 0.4} y={top + 3} width={BOX.w + 0.8} height={1.7} fill={second} />
        <Circle cx={BOX.x - 0.6} cy={top + 3.9} r={2.2} fill={kit} stroke={ink} strokeWidth={sw * 0.7} />
      </G>
    );
  }
  /* A BEANIE, the plain hat: a dome, its turned-up band and a pom. */
  const dome = `M20 ${top + 1} Q20 ${top - 13} 32 ${top - 13} Q44 ${top - 13} 44 ${top + 1} Z`;
  const neon = r.pattern === "gloss";
  const bandFill = r.pattern === "twotone" ? second : neon ? col(r.second, ink) : kit;
  const glint = frac((t * 22) / 76) * 76 - 20;
  return (
    <G>
      {/* A rare one glows. */}
      {neon ? <Path d={dome} fill="none" stroke={kit} strokeOpacity={0.3 + 0.12 * Math.sin(t * 3)} strokeWidth={7} strokeLinejoin="round" /> : null}
      <Circle cx={32} cy={top - 14.6} r={3.4} fill={r.pattern === "twotone" || r.pattern === "stripe" ? second : kit} stroke={ink} strokeWidth={sw * 0.8} />
      <Path d={dome} fill={kit} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
      {r.pattern === "stripe" ? (
        <G>
          <Path d={`M21.4 ${top - 6.4} H42.6`} stroke={second} strokeWidth={3} />
          <Path d={`M25.4 ${top - 11} H38.6`} stroke={second} strokeWidth={2.2} />
        </G>
      ) : null}
      {neon ? (
        <G>
          <Path d={`M24 ${top - 4.4} Q24 ${top - 9.4} 29 ${top - 11}`} stroke="#FFFFFF" strokeOpacity={0.9} strokeWidth={2.4} fill="none" strokeLinecap="round" />
          <Rect x={18 + glint} y={top - 15} width={3.4} height={14} fill="#FFFFFF" fillOpacity={glint > 2 && glint < 24 ? 0.6 : 0} transform={`rotate(22 ${f1(19.7 + glint)} ${top - 8})`} />
          <Path d={star(43.5, top - 11.5, 2 + 2.4 * Math.max(0, Math.sin(t * 2.4 + 1)))} fill="#FFFFFF" stroke={INK} strokeWidth={0.8} strokeLinejoin="round" />
        </G>
      ) : null}
      <Rect x={19} y={top - 3.2} width={26} height={6.2} rx={2.6} fill={bandFill} stroke={ink} strokeWidth={sw * 0.9} />
      {/* The band's ribs, knitted. */}
      {[23, 27.5, 32, 36.5, 41].map((rx) => (
        <Line key={rx} x1={rx} y1={top - 1.6} x2={rx} y2={top + 1.4} stroke={neon ? kit : "#000000"} strokeOpacity={neon ? 0.9 : 0.28} strokeWidth={1.1} strokeLinecap="round" />
      ))}
    </G>
  );
}

/* ---- the circle it shoots ------------------------------------------------ */

/* The shot, at its side or in flight: drawn the same either way. */
export function ShotArt({ o, x, y, r, t = 0, lw = 1 }: { o: OarsPaint; x: number; y: number; r: number; t?: number; lw?: number }) {
  const ink = C.ink;
  const a = col(o.blade, ink);
  const b = col(o.second, ink);
  const w = Math.max(1.2, r * 0.32) * lw;
  if (o.extra === "flame") {
    /* A FIREBALL: the coal, and the flame off it, never still. */
    const s = 1 + 0.13 * Math.sin(t * 13) + 0.06 * Math.sin(t * 23 + 1);
    const sway = r * 0.28 * Math.sin(t * 8.3);
    const tipX = x + r * 0.1 + sway;
    return (
      <G>
        <Circle cx={x} cy={y - r * 0.2} r={r * 1.9} fill="#F0631E" fillOpacity={0.14 + 0.08 * Math.sin(t * 11)} />
        <Path d={`M${f1(x - r * 1.08)} ${f1(y + r * 0.3)} Q${f1(x - r * 1.3)} ${f1(y - r * 1.2 * s)} ${f1(tipX)} ${f1(y - r * 2.5 * s)} Q${f1(x + r * 1.4)} ${f1(y - r * 1.1 * s)} ${f1(x + r * 1.08)} ${f1(y + r * 0.3)} Q${f1(x)} ${f1(y + r * 1.55)} ${f1(x - r * 1.08)} ${f1(y + r * 0.3)}Z`} fill="#F0631E" stroke={ink} strokeWidth={w * 0.8} strokeLinejoin="round" />
        <Path d={`M${f1(x - r * 0.62)} ${f1(y + r * 0.4)} Q${f1(x - r * 0.7)} ${f1(y - r * 0.7 * s)} ${f1(x + r * 0.05 + sway * 0.6)} ${f1(y - r * 1.5 * s)} Q${f1(x + r * 0.8)} ${f1(y - r * 0.5)} ${f1(x + r * 0.62)} ${f1(y + r * 0.4)} Q${f1(x)} ${f1(y + r * 1.1)} ${f1(x - r * 0.62)} ${f1(y + r * 0.4)}Z`} fill="#FFD23F" />
        <Path d={`M${f1(x - r * 0.3)} ${f1(y + r * 0.2)} Q${f1(x)} ${f1(y - r * 0.8 * s)} ${f1(x + r * 0.3)} ${f1(y + r * 0.2)}Z`} fill="#FFF6D0" />
        <Circle cx={x} cy={y + r * 0.42} r={r * 0.42} fill={a} />
        {[0, 1, 2].map((i) => {
          const k = frac(t * 1.1 + i / 3);
          return <Circle key={i} cx={x + (i - 1) * r * 0.7 + Math.sin(t * 6 + i * 2) * r * 0.25} cy={y - r * (1.6 + k * 1.9)} r={r * 0.16 * (1.3 - k)} fill={i % 2 ? "#FFD23F" : "#F0631E"} fillOpacity={1 - k} />;
        })}
      </G>
    );
  }
  if (o.extra === "bolt") {
    /* BALL LIGHTNING: arcs jump off it to somewhere new eight times a
     * second. */
    const tick = Math.floor(t * 8);
    const flick = 0.5 + 0.5 * Math.sin(t * 19) * Math.sin(t * 7);
    return (
      <G>
        <Circle cx={x} cy={y} r={r * 1.75} fill={b} fillOpacity={0.1 + 0.16 * flick} />
        {[0, 1, 2].map((i) => {
          const an = tick * 2.4 + i * 2.094 + i * i;
          const ca = Math.cos(an);
          const sa = Math.sin(an);
          const j = ((tick + i) % 2 ? 1 : -1) * r * 0.32;
          const p = (d: number, off: number) => `${f1(x + ca * r * d - sa * off)} ${f1(y + sa * r * d + ca * off)}`;
          return <Path key={i} d={`M${p(1.05, 0)} L${p(1.35, j)} L${p(1.55, -j * 0.7)} L${p(1.95, j * 0.4)}`} stroke={b} strokeWidth={w * 0.75} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
        })}
        <Circle cx={x} cy={y} r={r} fill={a} stroke={ink} strokeWidth={w} />
        <Circle cx={x} cy={y} r={r * 0.72} fill="none" stroke={b} strokeOpacity={0.35 + 0.4 * flick} strokeWidth={w * 0.45} />
        <Path d={`M${f1(x + r * 0.22)} ${f1(y - r * 0.78)} L${f1(x - r * 0.4)} ${f1(y + r * 0.08)} L${f1(x + r * 0.12)} ${f1(y + r * 0.08)} L${f1(x - r * 0.22)} ${f1(y + r * 0.8)} L${f1(x + r * 0.5)} ${f1(y - r * 0.2)} L${f1(x)} ${f1(y - r * 0.2)} Z`} fill={b} stroke={b} strokeWidth={w * 0.3} strokeLinejoin="round" />
      </G>
    );
  }
  if (o.extra === "ribbon") {
    /* A GIFT: tied with a ribbon, a bow on top, its tails flying. */
    const k = Math.sin(t * 6);
    const k2 = Math.sin(t * 6 + 1.2);
    const rib = "#FFE3EF";
    const deep = "#B62A6E";
    const tail = (dy: number, kk: number) => `M${f1(x - r * 0.8)} ${f1(y + r * dy)} q${f1(-r * 0.7)} ${f1(r * (0.4 + 0.35 * kk))} ${f1(-r * 1.3)} ${f1(r * (0.1 + 0.4 * kk))}`;
    return (
      <G>
        <Path d={tail(0.45, k)} stroke={deep} strokeWidth={w * 1.1} fill="none" strokeLinecap="round" />
        <Path d={tail(-0.05, k2)} stroke={a} strokeWidth={w * 1.1} fill="none" strokeLinecap="round" />
        <Circle cx={x} cy={y} r={r} fill={a} />
        <Path d={`M${f1(x - r * 0.92)} ${f1(y)} H${f1(x + r * 0.92)} M${f1(x)} ${f1(y - r * 0.92)} V${f1(y + r * 0.92)}`} stroke={rib} strokeWidth={w * 0.9} />
        <Circle cx={x} cy={y} r={r} fill="none" stroke={ink} strokeWidth={w} />
        {/* The bow: two loops and the knot. */}
        <Ellipse cx={x - r * 0.62} cy={y - r * 1.18} rx={r * 0.58} ry={r * 0.4} fill={rib} stroke={ink} strokeWidth={w * 0.65} transform={`rotate(24 ${f1(x - r * 0.62)} ${f1(y - r * 1.18)})`} />
        <Ellipse cx={x + r * 0.62} cy={y - r * 1.18} rx={r * 0.58} ry={r * 0.4} fill={rib} stroke={ink} strokeWidth={w * 0.65} transform={`rotate(-24 ${f1(x + r * 0.62)} ${f1(y - r * 1.18)})`} />
        <Circle cx={x} cy={y - r * 1.02} r={r * 0.3} fill={a} stroke={ink} strokeWidth={w * 0.6} />
      </G>
    );
  }
  if (o.pattern === "split")
    return (
      <G>
        <Path d={`M${f1(x)} ${f1(y - r)} A${r} ${r} 0 0 0 ${f1(x)} ${f1(y + r)} Z`} fill={a} />
        <Path d={`M${f1(x)} ${f1(y - r)} A${r} ${r} 0 0 1 ${f1(x)} ${f1(y + r)} Z`} fill={b} />
        <Line x1={x} y1={y - r} x2={x} y2={y + r} stroke={ink} strokeWidth={w * 0.5} />
        <Circle cx={x} cy={y} r={r} fill="none" stroke={ink} strokeWidth={w} />
      </G>
    );
  if (o.pattern === "tip")
    return (
      <G>
        <Circle cx={x} cy={y} r={r} fill={a} stroke={ink} strokeWidth={w} />
        <Circle cx={x} cy={y} r={r * 0.6} fill="none" stroke={b} strokeWidth={w * 0.55} />
        <Circle cx={x} cy={y} r={r * 0.26} fill={b} />
      </G>
    );
  if (o.pattern === "gloss")
    /* GOLD: it shines, and twinkles. */
    return (
      <G>
        <Circle cx={x} cy={y} r={r} fill={a} stroke={ink} strokeWidth={w} />
        <Path d={`M${f1(x + r * 0.62)} ${f1(y - r * 0.3)} A${f1(r * 0.7)} ${f1(r * 0.7)} 0 0 1 ${f1(x - r * 0.3)} ${f1(y + r * 0.62)}`} stroke={col(o.shaft, "#8C6A12")} strokeOpacity={0.7} strokeWidth={w * 0.7} fill="none" strokeLinecap="round" />
        <Path d={`M${f1(x - r * 0.6)} ${f1(y - r * 0.05)} A${f1(r * 0.6)} ${f1(r * 0.6)} 0 0 1 ${f1(x - r * 0.05)} ${f1(y - r * 0.6)}`} stroke="#FFFFFF" strokeOpacity={0.95} strokeWidth={w * 0.8} fill="none" strokeLinecap="round" />
        <Path d={star(x + r * 0.85, y - r * 0.9, r * (0.35 + 0.45 * Math.max(0, Math.sin(t * 2.6))))} fill="#FFFFFF" stroke={INK} strokeWidth={Math.max(0.6, w * 0.3)} strokeLinejoin="round" />
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
          const k = frac(t * 0.55 + i / 3);
          return <Ellipse key={i} cx={32} cy={55} rx={15 + 17 * k} ry={3.6 + 4.6 * k} stroke={c} strokeOpacity={0.75 * (1 - k)} strokeWidth={1.8} fill="none" />;
        })}
      </G>
    );
  if (a.kind === "halo") return <Ellipse cx={32} cy={24} rx={20} ry={16} fill={c} fillOpacity={0.07 + 0.04 * Math.sin(t * 2.4)} />;
  return null;
}

function AuraFront({ a, t, lift }: { a: AuraPaint; t: number; lift: number }) {
  const c = col(a.color, C.ink);
  const ink = C.ink;
  switch (a.kind) {
    case "bubbles":
      return (
        <G>
          {[0, 1, 2, 3, 4].map((i) => {
            const k = frac(t * 0.55 + i / 5);
            const bx = [11, 53, 8, 56, 14][i] + 2.2 * Math.sin(t * 3 + i);
            const by = 54 - k * 36;
            const br = 2 + (i % 3) * 0.7;
            return (
              <G key={i} opacity={1 - k * 0.85}>
                <Circle cx={bx} cy={by} r={br} stroke={c} strokeWidth={1.5} fill={c} fillOpacity={0.14} />
                <Path d={`M${f1(bx - br * 0.5)} ${f1(by - br * 0.1)} A${f1(br * 0.5)} ${f1(br * 0.5)} 0 0 1 ${f1(bx - br * 0.1)} ${f1(by - br * 0.5)}`} stroke="#FFFFFF" strokeWidth={0.9} fill="none" strokeLinecap="round" />
              </G>
            );
          })}
        </G>
      );
    case "halo": {
      const hy = 9 - lift + 1.2 * Math.sin(t * 2.4);
      const k = 0.5 + 0.5 * Math.sin(t * 3.1);
      return (
        <G>
          <Ellipse cx={32} cy={hy} rx={14.5} ry={5.4} fill="#FFE58A" fillOpacity={0.22 + 0.1 * k} />
          <Ellipse cx={32} cy={hy} rx={11} ry={3.3} stroke={ink} strokeWidth={4.6} fill="none" />
          <Ellipse cx={32} cy={hy} rx={11} ry={3.3} stroke={c} strokeWidth={3} fill="none" />
          <Path d={`M22.4 ${f1(hy - 1.4)} Q27 ${f1(hy - 3.6)} 33 ${f1(hy - 3.4)}`} stroke="#FFF1B8" strokeWidth={1.1} fill="none" strokeLinecap="round" />
          <Path d={star(45.5, hy - 4.5, 1.6 + 2 * k)} fill="#FFFFFF" stroke={INK} strokeWidth={0.7} strokeLinejoin="round" />
        </G>
      );
    }
    case "cloud":
      return (
        <G transform={`translate(0 ${f1(1.4 * Math.sin(t * 1.3))})`}>
          {[0, 1, 2, 3].map((i) => {
            const k = frac(t * 1.3 + i / 4);
            return <Line key={i} x1={22.5 + i * 6.2} y1={3 + k * 17} x2={21.4 + i * 6.2} y2={7 + k * 17} stroke="#5A8FD8" strokeWidth={1.7} strokeLinecap="round" strokeOpacity={1 - k} />;
          })}
          <Path d="M17 -0.5 q0 -7 8 -6 q3 -6.4 10.4 -3.2 q7.4 -2 8.4 5 q6 1 5 5 q-1 3.2 -5 3.2 h-23 q-5 0 -3.8 -4z" fill="#C9D1DC" stroke={ink} strokeWidth={1.6} strokeLinejoin="round" />
          <Path d="M21 0.5 h22" stroke={col(a.color, "#8A96A8")} strokeWidth={1.2} strokeLinecap="round" strokeOpacity={0.7} />
          <Path d="M24 -4.2 q1.4 -3 5 -2.6" stroke="#FFFFFF" strokeWidth={1.3} fill="none" strokeLinecap="round" />
        </G>
      );
    case "stars":
      return (
        <G>
          {[0, 1, 2].map((i) => {
            const k = 0.5 + 0.5 * Math.sin(t * 4 + i * 2.1);
            return <Path key={i} d={star([10, 54, 50][i], [30, 22, 52][i], 2 + 2.6 * k)} fill={c} stroke={ink} strokeWidth={0.8} strokeLinejoin="round" fillOpacity={0.65 + 0.35 * k} />;
          })}
        </G>
      );
    case "starfall":
      /* Shooting stars, each with its streak, coming down across it. */
      return (
        <G>
          {[0, 1, 2, 3, 4].map((i) => {
            const k = frac(t * 0.55 + i / 5);
            const sx = [10, 24, 46, 60, 34][i] - k * 12;
            const sy = -9 + k * 62;
            const r = 2.2 + 1.3 * Math.sin(t * 5 + i);
            const o = k < 0.1 ? k / 0.1 : 1 - Math.max(0, k - 0.6) / 0.4;
            return (
              <G key={i} opacity={o}>
                <Line x1={sx + 1.2} y1={sy - 5} x2={sx + 3.4} y2={sy - 16} stroke={i % 2 ? "#F28C28" : c} strokeWidth={2} strokeLinecap="round" strokeOpacity={0.8} />
                <Path d={star(sx, sy, r + 1.6)} fill={i % 2 ? "#FFE27A" : c} stroke={ink} strokeWidth={0.9} strokeLinejoin="round" />
              </G>
            );
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
          {pts.slice(1).map((p, i) => {
            const side = i % 2 ? 1 : -1;
            const r = (3 - (i / n) * 2) * w;
            return <Circle key={i} cx={p.x} cy={p.y + side * 1.6 * w + Math.sin(t * 3 + i) * 0.6 * w} r={r} fill="#FFFFFF" stroke={C.gray} strokeWidth={1.1 * w} strokeOpacity={1 - i / n} fillOpacity={0.95 * (1 - i / n)} />;
          })}
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
            return <Line key={i} x1={p.x - (dy / L) * off} y1={p.y + (dx / L) * off} x2={q.x - (dy / L) * off} y2={q.y + (dx / L) * off} stroke={c} strokeWidth={(2.8 - i * 0.3) * w} strokeLinecap="round" strokeOpacity={0.95 - i * 0.16} />;
          })}
        </G>
      );
    case "stars":
      return (
        <G>
          {pts.slice(1).filter((_, i) => i % 2 === 0).map((p, i) => {
            const k = 0.5 + 0.5 * Math.sin(t * 5 + i * 1.3);
            return <Path key={i} d={star(p.x, p.y - 3 * w, (1.8 + 2.2 * k) * w)} fill={c} stroke={ink} strokeWidth={0.7 * w} strokeLinejoin="round" fillOpacity={(1 - i / n) * (0.6 + 0.4 * k)} strokeOpacity={1 - i / n} />;
          })}
        </G>
      );
    case "rainbow": {
      /* A ribbon of six colours that waves along its length, with a
       * twinkle or two riding it. */
      const lineOf = (off: number) => {
        let d = "";
        pts.forEach((p, i) => {
          const q = pts[Math.min(n - 1, i + 1)];
          const o = pts[Math.max(0, i - 1)];
          const dx = q.x - o.x;
          const dy = q.y - o.y;
          const L = Math.hypot(dx, dy) || 1;
          const wave = Math.sin(t * 6 - i * 0.8) * (0.6 + i * 0.22) * w;
          d += `${i ? "L" : "M"}${f1(p.x - (dy / L) * (off + wave))} ${f1(p.y + (dx / L) * (off + wave))}`;
        });
        return d;
      };
      return (
        <G>
          {RAINBOW.map((rc, i) => (
            <Path key={rc} d={lineOf((i - 2.5) * 2.3 * w)} stroke={rc} strokeWidth={2.7 * w} fill="none" strokeLinecap="butt" strokeLinejoin="round" />
          ))}
          {[2, 5, 8].map((at, i) => {
            const p = pts[Math.min(n - 1, at)];
            const k = 0.5 + 0.5 * Math.sin(t * 6 + i * 2.2);
            return <Path key={at} d={star(p.x, p.y - (10 + i * 1.5) * w, (1.4 + 2.2 * k) * w)} fill="#FFFFFF" stroke={ink} strokeWidth={0.7 * w} strokeLinejoin="round" />;
          })}
        </G>
      );
    }
    default:
      return null;
  }
}

/* How far over the usual a name must sit to clear what is on the piece's
 * head, in the piece's units. */
export const headOf = (p: Paint): number => (p.aura.kind === "cloud" ? 16 : p.aura.kind === "halo" ? 9 : p.rower.hat === "crown" || p.rower.hat === "viking" ? 7 : p.rower.kit !== "ink" || p.rower.hat || p.hull.bird ? 4 : 0);

/* What the piece wears, from the locker's choice. */
export const paintOf = (eq: Partial<Equipped> | null | undefined): Paint => wear(eq);
