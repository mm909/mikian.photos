import type { ReactNode } from "react";
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from "react-native-svg";
import { C, F } from "../theme";
import { prng } from "./rng";
import { TOKEN_CX, TOKEN_CY, TOKEN_U, TokenDefs, TokenG, TrailG, type Paint } from "./Token";

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
  const geo: BoardGeo = { W, H, pts, cum, L: cum[N], island: blob(cx, cy, W * 0.15, H * 0.13, 3), corners, unit: Math.max(54, Math.min(92, m * 0.21)), cx, cy };
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

export function Board({ W, H, pieces, t, uid = "bd", fish = true, children }: { W: number; H: number; pieces: Piece[]; t: number; uid?: string; fish?: boolean; children?: ReactNode }) {
  const g = boardOf(W, H);
  const k = g.unit / TOKEN_U;
  const ink = C.ink;
  const water = C.accent;
  /* The path as dashes: a track to go along. */
  const track = g.pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + "Z";
  /* Little waves, set once by the board's size, drifting. */
  const r = prng(Math.round(W * 7 + H));
  const waves = Array.from({ length: 14 }, () => ({ x: r() * W, y: r() * H, p: r() }));
  /* The fish: dots that swim along the river, either side of the path. */
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
        return { x: p.x + nx * (off + wig), y: p.y + ny * (off + wig), dir: v > 0 ? 1 : -1, dx: p.dx, dy: p.dy, i };
      })
    : [];
  const sorted = [...pieces].filter((p) => !p.out).sort((a, b) => along(g, a.s).y - along(g, b.s).y);
  return (
    <Svg width={W} height={H}>
      {pieces.map((p) => (
        <TokenDefs key={`d${p.id}`} uid={`${uid}${p.id}`} />
      ))}
      <Rect x={0} y={0} width={W} height={H} fill={C.paper} />
      <Rect x={0} y={0} width={W} height={H} fill={water} fillOpacity={0.09} />
      {waves.map((w, i) => {
        const x = (w.x + t * 6) % (W + 30) - 15;
        const y = w.y + Math.sin(t * 0.8 + w.p * 6) * 2;
        return <Path key={i} d={`M${x.toFixed(1)} ${y.toFixed(1)} q4 -3.5 8 0 t8 0`} stroke={water} strokeOpacity={0.35} strokeWidth={1.6} fill="none" strokeLinecap="round" />;
      })}
      {/* Land in the corners, with a few tufts. */}
      {g.corners.map((d, i) => (
        <Path key={i} d={d} fill={C.paper} stroke={ink} strokeWidth={2.2} strokeLinejoin="round" />
      ))}
      {[
        [0.06, 0.07],
        [0.92, 0.06],
        [0.94, 0.92],
        [0.07, 0.93],
      ].map(([x, y], i) => (
        <Path key={i} d={`M${(x * W - 5).toFixed(1)} ${(y * H + 3).toFixed(1)} l2 -6 l2 6 l2 -8 l2 8 l2 -5 l1 5`} stroke={C.good} strokeWidth={1.6} fill="none" strokeLinejoin="round" />
      ))}
      {/* The river's path. */}
      <Path d={track} stroke={ink} strokeOpacity={0.22} strokeWidth={2} strokeDasharray="2 9" strokeLinecap="round" fill="none" />
      {/* The island and its palm. */}
      <Path d={g.island} fill={C.paper} stroke={ink} strokeWidth={2.4} strokeLinejoin="round" />
      <Palm x={g.cx + W * 0.02} y={g.cy + H * 0.05} s={g.unit / 60} t={t} />
      {school.map((f) => (
        <G key={f.i}>
          <Circle cx={f.x} cy={f.y} r={2.6} fill={water} fillOpacity={0.75} />
          <Path d={`M${(f.x - f.dir * f.dx * 2.4).toFixed(1)} ${(f.y - f.dir * f.dy * 2.4).toFixed(1)} l${(-f.dir * f.dx * 4 - f.dy * 2.4).toFixed(1)} ${(-f.dir * f.dy * 4 + f.dx * 2.4).toFixed(1)} M${(f.x - f.dir * f.dx * 2.4).toFixed(1)} ${(f.y - f.dir * f.dy * 2.4).toFixed(1)} l${(-f.dir * f.dx * 4 + f.dy * 2.4).toFixed(1)} ${(-f.dir * f.dy * 4 - f.dx * 2.4).toFixed(1)}`} stroke={water} strokeOpacity={0.75} strokeWidth={1.4} strokeLinecap="round" />
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
            <G x={x} y={y} scale={k}>
              <TokenG paint={p.paint} uid={`${uid}${p.id}`} t={t} look={Math.max(-1, Math.min(1, q.dx * 1.4))} hop={p.hop} wobble={p.wobble} orb={!p.firing} />
            </G>
            {p.label ? <Label x={q.x} y={y + 2 * k - 4} text={p.label} mine={!!p.mine} /> : null}
          </G>
        );
      })}
      {children}
    </Svg>
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
    const ay = top.y + Math.sin(a) * len * s;
    const mx = top.x + Math.cos(a) * len * 0.55 * s;
    const my = top.y + Math.sin(a) * len * 0.55 * s - 6 * s;
    return `M${top.x.toFixed(1)} ${top.y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${ax.toFixed(1)} ${ay.toFixed(1)}`;
  };
  return (
    <G>
      <Ellipse cx={x} cy={y + 1} rx={12 * s} ry={3 * s} fill={ink} fillOpacity={0.08} />
      <Path d={`M${x.toFixed(1)} ${y.toFixed(1)} Q${(x + 1 * s).toFixed(1)} ${(y - 16 * s).toFixed(1)} ${top.x.toFixed(1)} ${top.y.toFixed(1)}`} stroke={ink} strokeWidth={2.4 * s} fill="none" strokeLinecap="round" />
      {[-2.7, -2.0, -1.2, -0.5, 0.2].map((a, i) => (
        <Path key={i} d={frond(a + sway * 0.02, 15 + (i % 2) * 3)} stroke={C.good} strokeWidth={2.6 * s} fill="none" strokeLinecap="round" />
      ))}
      <Circle cx={top.x - 2 * s} cy={top.y + 3 * s} r={2 * s} fill={ink} />
      <Circle cx={top.x + 2 * s} cy={top.y + 3.5 * s} r={2 * s} fill={ink} />
    </G>
  );
}
