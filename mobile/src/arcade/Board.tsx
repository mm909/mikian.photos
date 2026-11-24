import type { ReactNode } from "react";
import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { C, F, isDark } from "../theme";
import { prng } from "./rng";
import { TOKEN_CX, TOKEN_CY, TOKEN_U, TokenDefs, TokenG, TrailG, headOf, lwOf, star, type Paint } from "./Token";

/* HOME: THE BOARD (owner, 2026-11-24, 3 AM: "Between games you go home: your
 * piece wanders a winding path on a small 2D board, like a lazy river. It
 * must move through the board, not sit still the way the race does"; "The
 * board is a game board: an island in the middle, land in the corners. Room
 * for up to four"; "fish (dots moving in the water)").
 *
 * The water fills the board; land sits in its four corners; an island with
 * a palm is in the middle; the path is a dashed lazy river round the
 * island, winding in and out. A piece goes along it as far as its rower
 * has rowed: one lap is LAP_M meters (about half a minute at 2:00), so the
 * piece is always visibly going, quicker when the rower is. Its trail is
 * drawn along the path behind it. Up to four go round it, spread out round
 * the lap (the lobby and the match put two across the island from each
 * other).
 *
 * A COSY BOARD (2026-11-24, the art pass): the land is sand with grass on
 * it and stands a little proud of the water (a dark edge under it); the
 * water shoals pale round every shore and a line of surf breathes there;
 * the path is a ring of spaces, as on a board game, every fifth a bigger
 * one; the fish are fish; a lighthouse winks in one corner. All of it is
 * quiet (low contrast, slow), so the pieces and the figures stay the
 * loudest things on it.
 *
 * Drawn as one picture thirty times a second by the show (screens/Show.tsx);
 * what is in flight in a match is drawn over it (`children`). */

export const LAP_M = 125;
const N = 220;

export type BoardGeo = {
  W: number;
  H: number;
  /* The path, N points round, and how far along it each is. */
  pts: { x: number; y: number }[];
  cum: number[];
  L: number;
  island: string;
  corners: string[];
  /* The grass on the island and on each corner, and the path's spaces as
   * two drawings (the small ones, and every fifth). */
  islandGrass: string;
  grass: string[];
  spaces: string;
  bigSpaces: string;
  rc: number;
  /* The pieces' size: a box of TOKEN_U units is this many points. */
  unit: number;
  cx: number;
  cy: number;
};

const cache = new Map<string, BoardGeo>();

/* A blob round (x, y), radii rx and ry, its edge wavering by the seed. */
function blob(x: number, y: number, rx: number, ry: number, seed: number, n = 14): string {
  const r = prng(seed);
  const ks = Array.from({ length: n }, () => 0.86 + r() * 0.22);
  let d = "";
  const at = (i: number) => {
    const a = (i / n) * Math.PI * 2;
    return { x: x + Math.cos(a) * rx * ks[i % n], y: y + Math.sin(a) * ry * ks[i % n] };
  };
  for (let i = 0; i < n; i++) {
    const p = at(i);
    const q = at(i + 1);
    const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    d += i === 0 ? `M${mid.x.toFixed(1)} ${mid.y.toFixed(1)}` : "";
    const nx = at(i + 2);
    d += ` Q${q.x.toFixed(1)} ${q.y.toFixed(1)} ${((q.x + nx.x) / 2).toFixed(1)} ${((q.y + nx.y) / 2).toFixed(1)}`;
  }
  return `${d}Z`;
}

export function boardOf(W: number, H: number): BoardGeo {
  const key = `${Math.round(W)}x${Math.round(H)}`;
  const had = cache.get(key);
  if (had) return had;
  const cx = W / 2;
  const cy = H / 2;
  const m = Math.min(W, H);
  /* The lazy river: an oval round the island that winds in and out. */
  const rx = W * 0.36;
  const ry = H * 0.33;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2;
    const k = 1 + 0.075 * Math.sin(3 * a + 0.6) + 0.035 * Math.sin(5 * a + 2.1);
    pts.push({ x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k });
  }
  const cum = [0];
  for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + Math.hypot(pts[i % N].x - pts[i - 1].x, pts[i % N].y - pts[i - 1].y));
  const rc = m * 0.2;
  const corners = [
    [0, 0],
    [W, 0],
    [W, H],
    [0, H],
  ].map(([x, y], i) => blob(x, y, rc * 1.15, rc, 11 + i * 7, 16));
  const land: [number, number][] = [
    [0, 0],
    [W, 0],
    [W, H],
    [0, H],
  ];
  const grass = land.map(([x, y], i) => blob(x, y, rc * 0.78, rc * 0.66, 23 + i * 5, 12));
  const geo: BoardGeo = { W, H, pts, cum, L: cum[N], island: blob(cx, cy, W * 0.15, H * 0.13, 3), corners, islandGrass: blob(cx + W * 0.008, cy - H * 0.006, W * 0.1, H * 0.082, 9, 12), grass, spaces: "", bigSpaces: "", rc, unit: Math.max(54, Math.min(92, m * 0.21)), cx, cy };
  /* The spaces: evenly along the path, about one every 15 points, a whole
   * number of fives round the lap. */
  const count = Math.max(20, Math.round(geo.L / 15 / 5) * 5);
  const dot = (x: number, y: number, r: number) => `M${(x - r).toFixed(1)} ${y.toFixed(1)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  for (let i = 0; i < count; i++) {
    const q = along(geo, (i / count) * geo.L);
    if (i % 5 === 0) geo.bigSpaces += dot(q.x, q.y, 4.2);
    else geo.spaces += dot(q.x, q.y, 2.1);
  }
  cache.set(key, geo);
  return geo;
}

/* Where along the path `s` points is, and which way it is going. */
export function along(g: BoardGeo, s: number): { x: number; y: number; dx: number; dy: number } {
  const L = g.L;
  const u = ((s % L) + L) % L;
  let lo = 0;
  let hi = N;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (g.cum[mid] <= u) lo = mid;
    else hi = mid;
  }
  const a = g.pts[lo];
  const b = g.pts[(lo + 1) % N];
  const seg = g.cum[lo + 1] - g.cum[lo] || 1;
  const k = (u - g.cum[lo]) / seg;
  const dx = (b.x - a.x) / seg;
  const dy = (b.y - a.y) / seg;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, dx, dy };
}

/* How far along the path a piece is for the meters its rower has rowed;
 * `slot` spreads up to four round the lap. */
export const sOf = (g: BoardGeo, meters: number, slot = 0): number => (meters / LAP_M) * g.L + (slot * g.L) / 4;

export type Piece = {
  id: string;
  paint: Paint;
  /* Along the path, points. */
  s: number;
  hop: number;
  wobble: number;
  label?: string;
  /* Shown in the accent (the rower's own). */
  mine?: boolean;
  /* Off the board: out of the match. */
  out?: boolean;
  /* The shot at its side is in flight. */
  firing?: boolean;
};

/* Where a piece's box sits on the board, for what is drawn over it. */
export function pieceAt(g: BoardGeo, s: number): { x: number; y: number } {
  const p = along(g, s);
  return { x: p.x, y: p.y - (TOKEN_CY - 44) * (g.unit / TOKEN_U) };
}

export function Board({ W, H, pieces, t, uid = "bd", fish = true, palm = true, children }: { W: number; H: number; pieces: Piece[]; t: number; uid?: string; fish?: boolean; /* Off when a monster has the island (single player). */ palm?: boolean; children?: ReactNode }) {
  const g = boardOf(W, H);
  const k = g.unit / TOKEN_U;
  const ink = C.ink;
  const water = C.accent;
  const dark = isDark();
  /* The board's own colours, matte, one set for each look. */
  const SAND = dark ? "#3A3120" : "#F7EBCB";
  const GRASS = dark ? "#1E3F2C" : "#CDE8C4";
  const SURF = dark ? "#9FD3F2" : "#FFFFFF";
  const lands = [...g.corners, g.island];
  /* Little waves, set once by the board's size, drifting. */
  const r = prng(Math.round(W * 7 + H));
  const waves = Array.from({ length: 12 }, () => ({ x: r() * W, y: r() * H, p: r() }));
  const glints = Array.from({ length: 4 }, () => ({ x: r() * W, y: r() * H, p: r() }));
  /* The surf breathes in and out along every shore. */
  const surf = 0.5 + 0.5 * Math.sin(t * 1.1);
  /* The fish: they swim along the river, either side of the path. */
  const school = fish
    ? Array.from({ length: 7 }, (_, i) => {
        const side = i % 2 ? 1 : -1;
        const off = side * (g.unit * (0.42 + (i % 3) * 0.12));
        const v = (i % 3 === 0 ? -1 : 1) * (14 + i * 3);
        const s = (i / 7) * g.L + t * v;
        const p = along(g, s);
        const nx = -p.dy;
        const ny = p.dx;
        const wig = Math.sin(t * 2 + i) * 3;
        const dir = v > 0 ? 1 : -1;
        return { x: p.x + nx * (off + wig), y: p.y + ny * (off + wig), a: (Math.atan2(p.dy * dir, p.dx * dir) * 180) / Math.PI, i };
      })
    : [];
  const sorted = [...pieces].filter((p) => !p.out).sort((a, b) => along(g, a.s).y - along(g, b.s).y);
  const lw = lwOf(g.unit);
  /* The lighthouse stands in the top right corner. */
  const lx = W - g.rc * 0.4;
  const ly = g.rc * 0.56;
  const ls = Math.max(0.8, g.rc / 78);
  return (
    <Svg width={W} height={H}>
      {pieces.map((p) => (
        <TokenDefs key={`d${p.id}`} uid={`${uid}${p.id}`} />
      ))}
      <Rect x={0} y={0} width={W} height={H} fill={C.paper} />
      <Rect x={0} y={0} width={W} height={H} fill={water} fillOpacity={dark ? 0.22 : 0.13} />
      {/* The shallows: the water pales in two steps toward every shore. */}
      {lands.map((d, i) => (
        <Path key={`s${i}`} d={d} fill="none" stroke={SURF} strokeOpacity={dark ? 0.07 : 0.4} strokeWidth={34} strokeLinejoin="round" />
      ))}
      {lands.map((d, i) => (
        <Path key={`t${i}`} d={d} fill="none" stroke={SURF} strokeOpacity={dark ? 0.08 : 0.45} strokeWidth={18} strokeLinejoin="round" />
      ))}
      {waves.map((w, i) => {
        const x = ((w.x + t * 6) % (W + 30)) - 15;
        const y = w.y + Math.sin(t * 0.8 + w.p * 6) * 2;
        return <Path key={i} d={`M${x.toFixed(1)} ${y.toFixed(1)} q4 -3.5 8 0 t8 0`} stroke={water} strokeOpacity={0.2 + 0.2 * Math.abs(Math.sin(t * 0.5 + w.p * 9))} strokeWidth={1.8} fill="none" strokeLinecap="round" />;
      })}
      {glints.map((w, i) => {
        const tw = Math.max(0, Math.sin(t * 1.3 + w.p * 20));
        return tw > 0.05 ? <Path key={`g${i}`} d={star(w.x, w.y, 1 + 3.4 * tw)} fill={SURF} fillOpacity={dark ? 0.5 : 0.95} /> : null;
      })}
      {/* The river's path: a ring of spaces, every fifth a bigger one. */}
      <Path d={g.spaces} fill={ink} fillOpacity={0.24} />
      <Path d={g.bigSpaces} fill={C.paper} fillOpacity={dark ? 0.5 : 0.7} stroke={ink} strokeOpacity={0.34} strokeWidth={1.6} />
      {/* The surf: a line off every shore, going in and out. */}
      {lands.map((d, i) => (
        <Path key={`f${i}`} d={d} fill="none" stroke={SURF} strokeOpacity={dark ? 0.3 + 0.2 * surf : 0.95} strokeWidth={7 + 5 * surf} strokeLinejoin="round" />
      ))}
      {/* The land: its edge in shade under it, the sand, the grass. */}
      {lands.map((d, i) => (
        <Path key={`d${i}`} d={d} fill={dark ? "#000000" : ink} fillOpacity={dark ? 0.7 : 0.2} transform="translate(0 4)" />
      ))}
      {lands.map((d, i) => (
        <Path key={`l${i}`} d={d} fill={SAND} stroke={ink} strokeWidth={2.2} strokeLinejoin="round" />
      ))}
      {g.grass.map((d, i) => (
        <Path key={`g${i}`} d={d} fill={GRASS} />
      ))}
      <Path d={g.islandGrass} fill={GRASS} />
      {/* A few tufts, and a flower or two. */}
      {[
        [0.065, 0.075],
        [0.9, 0.035],
        [0.94, 0.925],
        [0.07, 0.93],
      ].map(([x, y], i) => (
        <G key={i}>
          <Path d={`M${(x * W - 5).toFixed(1)} ${(y * H + 3).toFixed(1)} l2 -6 l2 6 l2 -8 l2 8 l2 -5 l1 5`} stroke={C.good} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {i % 2 === 0 ? (
            <G>
              <Circle cx={x * W + (i ? -16 : 13)} cy={y * H - 5} r={2.4} fill="#F28CB1" stroke={ink} strokeWidth={0.8} />
              <Circle cx={x * W + (i ? -16 : 13)} cy={y * H - 5} r={0.8} fill="#F5C935" />
              <Circle cx={x * W + (i ? 4 : -12)} cy={y * H + (i ? -14 : 9)} r={2} fill="#F5C935" stroke={ink} strokeWidth={0.8} />
            </G>
          ) : null}
        </G>
      ))}
      <Lighthouse x={lx} y={ly} s={ls} t={t} />
      {/* The island: a pebble or two on its sand, and its palm. */}
      <Ellipse cx={g.cx - W * 0.1} cy={g.cy + H * 0.045} rx={3.4} ry={2.4} fill={C.gray} fillOpacity={0.55} stroke={ink} strokeWidth={1} />
      <Ellipse cx={g.cx + W * 0.085} cy={g.cy - H * 0.075} rx={2.6} ry={1.9} fill={C.gray} fillOpacity={0.55} stroke={ink} strokeWidth={1} />
      {palm ? <Palm x={g.cx + W * 0.02} y={g.cy + H * 0.05} s={g.unit / 60} t={t} /> : null}
      {school.map((f) => (
        <G key={f.i} transform={`translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) rotate(${f.a.toFixed(0)}) scale(0.85)`} opacity={0.62}>
          <Path d={`M-4.5 0 L-9 ${(-3.4 + Math.sin(t * 9 + f.i) * 1.6).toFixed(1)} L-9 ${(3.4 + Math.sin(t * 9 + f.i) * 1.6).toFixed(1)} Z`} fill={water} />
          <Ellipse cx={0} cy={0} rx={5.4} ry={2.9} fill={water} />
          <Circle cx={2.8} cy={-0.8} r={0.8} fill={C.paper} />
        </G>
      ))}
      {/* The trails, under every piece. */}
      {sorted.map((p) => {
        const pts = Array.from({ length: 11 }, (_, i) => {
          const q = along(g, p.s - i * 8 * k);
          return { x: q.x, y: q.y + 12 * k };
        });
        return <G key={`t${p.id}`}>{TrailG({ a: p.paint.aura, pts, t, w: k })}</G>;
      })}
      {sorted.map((p) => {
        const q = along(g, p.s);
        const x = q.x - TOKEN_CX * k;
        const y = q.y - (TOKEN_CY + 4) * k;
        return (
          <G key={p.id}>
            <G transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k.toFixed(3)})`}>
              <TokenG paint={p.paint} uid={`${uid}${p.id}`} t={t} look={Math.max(-1, Math.min(1, q.dx * 1.4))} hop={p.hop} wobble={p.wobble} orb={!p.firing} lw={lw} />
            </G>
            {p.label ? <Label x={q.x} y={y + (2 - headOf(p.paint)) * k - 4} text={p.label} mine={!!p.mine} /> : null}
          </G>
        );
      })}
      {children}
    </Svg>
  );
}

/* A lighthouse in line art, its lamp winking. */
function Lighthouse({ x, y, s, t }: { x: number; y: number; s: number; t: number }) {
  const ink = C.ink;
  const on = 0.5 + 0.5 * Math.sin(t * 1.6);
  return (
    <G transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(2)})`}>
      <Ellipse cx={0} cy={1} rx={11} ry={3} fill={ink} fillOpacity={0.12} />
      <Circle cx={0} cy={-27} r={9 + 3 * on} fill="#F5C935" fillOpacity={0.14 + 0.2 * on} />
      <Path d="M-6 0 L-4 -22 H4 L6 0 Z" fill="#FAFAFA" />
      <Path d="M-5.5 -6 L-5 -12 H5 L5.5 -6 Z" fill="#D8362A" />
      <Path d="M-4.4 -18 L-4.1 -22 H4.1 L4.4 -18 Z" fill="#D8362A" />
      <Path d="M-6 0 L-4 -22 H4 L6 0 Z" fill="none" stroke={ink} strokeWidth={1.8} strokeLinejoin="round" />
      <Rect x={-5.4} y={-24.4} width={10.8} height={2.6} fill={ink} />
      <Rect x={-3.2} y={-30} width={6.4} height={5.8} fill="#F5C935" fillOpacity={0.55 + 0.45 * on} stroke={ink} strokeWidth={1.4} />
      <Path d="M-4.6 -30 L0 -34.6 L4.6 -30 Z" fill="#D8362A" stroke={ink} strokeWidth={1.4} strokeLinejoin="round" />
      <Line x1={0} y1={-3.6} x2={0} y2={0} stroke={ink} strokeWidth={2.2} />
    </G>
  );
}

/* A name over a piece, haloed so it reads on the water. */
function Label({ x, y, text, mine }: { x: number; y: number; text: string; mine: boolean }) {
  return (
    <G>
      <SvgText x={x} y={y} fontFamily={F.monoBold} fontSize={12} letterSpacing={1} textAnchor="middle" stroke={C.paper} strokeWidth={4} strokeLinejoin="round" fill={C.paper}>
        {text}
      </SvgText>
      <SvgText x={x} y={y} fontFamily={F.monoBold} fontSize={12} letterSpacing={1} textAnchor="middle" fill={mine ? C.accent : C.ink}>
        {text}
      </SvgText>
    </G>
  );
}

/* A palm in line art, its fronds stirring. */
function Palm({ x, y, s, t }: { x: number; y: number; s: number; t: number }) {
  const ink = C.ink;
  const sway = Math.sin(t * 0.9) * 2;
  const top = { x: x + 6 * s + sway * 0.4, y: y - 30 * s };
  const frond = (a: number, len: number) => {
    const ax = top.x + Math.cos(a) * len * s;
    const ay = top.y + Math.sin(a) * len * s + 3 * s;
    const mx = top.x + Math.cos(a) * len * 0.55 * s;
    const my = top.y + Math.sin(a) * len * 0.55 * s - 7 * s;
    return `M${top.x.toFixed(1)} ${top.y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${ax.toFixed(1)} ${ay.toFixed(1)}`;
  };
  const trunk = `M${x.toFixed(1)} ${y.toFixed(1)} Q${(x + 1 * s).toFixed(1)} ${(y - 16 * s).toFixed(1)} ${top.x.toFixed(1)} ${top.y.toFixed(1)}`;
  const fronds = [-2.75, -2.05, -1.3, -0.55, 0.15].map((a, i) => frond(a + sway * 0.02, 16 + (i % 2) * 3));
  return (
    <G>
      <Ellipse cx={x + 2 * s} cy={y + 1} rx={13 * s} ry={3.2 * s} fill={ink} fillOpacity={0.12} />
      <Path d={trunk} stroke={ink} strokeWidth={5.4 * s} fill="none" strokeLinecap="round" />
      <Path d={trunk} stroke="#B5793F" strokeWidth={2.8 * s} fill="none" strokeLinecap="round" />
      {fronds.map((d, i) => (
        <Path key={`o${i}`} d={d} stroke={ink} strokeWidth={5.6 * s} fill="none" strokeLinecap="round" />
      ))}
      {fronds.map((d, i) => (
        <Path key={i} d={d} stroke={isDark() ? "#58b07c" : "#3E9B5F"} strokeWidth={3.2 * s} fill="none" strokeLinecap="round" />
      ))}
      <Circle cx={top.x - 2 * s} cy={top.y + 3 * s} r={2.2 * s} fill="#6B4A2B" stroke={ink} strokeWidth={1 * s} />
      <Circle cx={top.x + 2.4 * s} cy={top.y + 3.6 * s} r={2.2 * s} fill="#6B4A2B" stroke={ink} strokeWidth={1 * s} />
    </G>
  );
}
