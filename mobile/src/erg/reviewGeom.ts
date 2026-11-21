import type { TelemetryDoc } from "../pm5/session";

/* THE READ'S CHART MATHS, with no React and no colour in it. The website
 * keeps this in src/app/erg/chartGeom.ts, with the statistics in
 * src/lib/rowStats.ts; the phone has neither file, so the parts the read
 * draws with are ported here, in the same order and with the same rules, so
 * a chart on the phone and the same chart on the site cannot disagree about
 * where a number lands. What is new is at the foot: the piece cut back out
 * of a saved document, which the site gets from its live console. */

export type XY = { x: number; y: number };

export type Series = {
  points: XY[];
  /* line: the solid one; dashed: the quieter second; bars: filled. */
  kind: "line" | "dashed" | "bars";
  label: string;
};

export type Pad = { l: number; r: number; t: number; b: number };

export const fmtNum = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

/* Round ticks: the axis wants about n labels at a step that reads. */
export function ticks(min: number, max: number, n = 4): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / n;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  const step = (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p;
  if (!(step > 0)) return [min];
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9 && out.length < 40; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

/* At most `cap` points on a line, keeping the last one so a chart ends
 * where the piece does. A phone chart is some three hundred points wide;
 * drawing seven thousand ticks into it is a slower screen and not one more
 * pixel of truth. */
export function thinPoints<T>(points: T[], cap = 300): T[] {
  if (points.length <= cap) return points;
  const k = Math.ceil(points.length / cap);
  const out: T[] = [];
  for (let i = points.length - 1; i >= 0; i -= k) out.push(points[i]);
  return out.reverse();
}

export type Plot = {
  W: number;
  H: number;
  pad: Pad;
  pw: number;
  ph: number;
  x0: number;
  x1: number;
  lo: number;
  hi: number;
  sx: (x: number) => number;
  sy: (y: number) => number;
  /* A point across the chart back to a data x, clamped into the domain. */
  ix: (px: number) => number;
  xt: number[];
  yt: number[];
  barW: number;
  barBaseY: number;
  /* The finite points of each series, in series order: the same arrays the
   * paths are built from, so a reading can never name a point that is not
   * on the glass. */
  drawn: XY[][];
  /* Which series the hairline snaps to: the first one with two points. */
  lead: number;
};

export type PlotOpts = { W: number; H: number; pad: Pad; invertY?: boolean; refY?: number; yMin?: number; yMax?: number };

/* THE DOMAIN AND THE SCALES, as the site works them out: the reference rule
 * counts towards the range, eight per cent of air on the side that was not
 * pinned, a bar chart starts at zero. Null is the empty branch: fewer than
 * two finite points and there is no chart to draw. */
export function computePlot(series: Series[], o: PlotOpts): Plot | null {
  const invertY = o.invertY ?? false;
  const pw = o.W - o.pad.l - o.pad.r;
  const ph = o.H - o.pad.t - o.pad.b;
  if (!(pw > 20) || !(ph > 20)) return null;
  const drawn = series.map((s) => s.points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
  const all = drawn.flat();
  if (all.length < 2) return null;

  let x1 = Math.max(...all.map((p) => p.x));
  const x0 = Math.min(...all.map((p) => p.x));
  if (x1 === x0) x1 = x0 + 1;

  let lo = o.yMin ?? Math.min(...all.map((p) => p.y), o.refY ?? Number.POSITIVE_INFINITY);
  let hi = o.yMax ?? Math.max(...all.map((p) => p.y), o.refY ?? Number.NEGATIVE_INFINITY);
  if (hi === lo) {
    lo -= 1;
    hi += 1;
  }
  const air = (hi - lo) * 0.08;
  if (o.yMin === undefined) lo -= air;
  if (o.yMax === undefined) hi += air;
  const hasBars = series.some((s) => s.kind === "bars");
  if (hasBars && o.yMin === undefined) lo = Math.min(lo, 0);

  const sx = (x: number) => o.pad.l + ((x - x0) / (x1 - x0)) * pw;
  const sy = (y: number) => {
    const f = (y - lo) / (hi - lo);
    return invertY ? o.pad.t + f * ph : o.pad.t + (1 - f) * ph;
  };
  const ix = (px: number) => x0 + Math.min(1, Math.max(0, (px - o.pad.l) / pw)) * (x1 - x0);

  /* The ticks follow the box: a phone column wants three or four labels on
   * each axis, not the nine a desktop sheet has room for. */
  const xt = ticks(x0, x1, Math.max(3, Math.min(9, Math.round(pw / 95))));
  const yt = ticks(lo, hi, Math.max(3, Math.min(8, Math.round(ph / 44))));

  const barN = Math.max(1, ...series.filter((s) => s.kind === "bars").map((s) => s.points.length));
  const barW = Math.max(1, (pw / barN) * 0.7);

  return { W: o.W, H: o.H, pad: o.pad, pw, ph, x0, x1, lo, hi, sx, sy, ix, xt, yt, barW, barBaseY: sy(Math.max(lo, 0)), drawn, lead: drawn.findIndex((p) => p.length >= 2) };
}

/* THE POINT UNDER THE FINGER, by x alone. Every series here ascends in x,
 * so this is a bisect and not a walk. */
export function nearestByX(pts: XY[], x: number): XY | null {
  if (!pts.length) return null;
  let lo = 0;
  let hi = pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].x < x) lo = mid + 1;
    else hi = mid;
  }
  const a = pts[lo];
  const b = lo > 0 ? pts[lo - 1] : a;
  return Math.abs(a.x - x) <= Math.abs(b.x - x) ? a : b;
}

/* The average gap between one series' points, in x. What counts as near the
 * hairline: a series with nothing within a gap and a half of it prints
 * nothing rather than naming a value forty strokes away. */
export function stepOf(p: Plot, pts: XY[]): number {
  return (p.x1 - p.x0) / Math.max(1, pts.length - 1);
}

/* ---- the shape of a number ---------------------------------------------- */

const meanOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/* Population deviation: it describes the values it was handed. */
function sdOf(xs: number[]): number {
  const m = meanOf(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length);
}

/* Linear-interpolated quantile of an ASCENDING array. */
function quantile(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 1) return sorted[0];
  const h = Math.min(Math.max(p, 0), 1) * (n - 1);
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, n - 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
}

/* Silverman's rule of thumb for a gaussian kernel. */
function silverman(xs: number[], sorted: number[]): number {
  const s = sdOf(xs);
  const robust = (quantile(sorted, 0.75) - quantile(sorted, 0.25)) / 1.34;
  const a = robust > 0 ? Math.min(s, robust) : s;
  const h = 0.9 * a * Math.pow(xs.length, -0.2);
  return h > 0 ? h : 1;
}

/* How many humps stand at least `prominence` of the tallest above the dip
 * between them and it. Blunt on purpose, so a wobbly hill does not conjure a
 * second group out of noise. */
function humps(ys: number[], prominence = 0.15): number {
  const maxima: number[] = [];
  for (let i = 1; i < ys.length - 1; i++) if (ys[i] > ys[i - 1] && ys[i] >= ys[i + 1]) maxima.push(i);
  if (!maxima.length) return 0;
  const top = Math.max(...ys);
  const tallest = maxima.reduce((a, b) => (ys[b] > ys[a] ? b : a));
  let kept = 1;
  for (const m of maxima) {
    if (m === tallest) continue;
    let dip = Infinity;
    for (let i = Math.min(m, tallest); i <= Math.max(m, tallest); i++) if (ys[i] < dip) dip = ys[i];
    if (ys[m] - dip >= prominence * top) kept++;
  }
  return kept;
}

export type Spread = {
  /* Values used, after thinning, and values offered. */
  n: number;
  nAll: number;
  mean: number;
  sd: number;
  /* Ascending. */
  sorted: number[];
  /* The density on a grid, tallest point 1. Null when every value is the
   * same: that is a real answer and not a curve. */
  xs: number[] | null;
  ys: number[] | null;
  /* Two is a real answer on an interval piece, and the one case where the
   * mean is a pace nobody rowed. */
  modes: number;
};

/* Under eight values there is no distribution, only eight values. */
export const SPREAD_MIN = 8;
const SPREAD_CAP = 300;
const SPREAD_GRID = 64;

/* THE SPREAD OF ONE MEASURE: what the piece was made of, where a line over
 * time says what happened in what order. The middle ninety-eight per cent,
 * widened by a bandwidth so the hill comes down to the axis. */
export function computeSpread(pts: XY[]): Spread | null {
  const all = pts.filter((p) => Number.isFinite(p.y));
  if (all.length < SPREAD_MIN) return null;
  const v = thinPoints(all, SPREAD_CAP).map((p) => p.y);
  const sorted = [...v].sort((a, b) => a - b);
  const m = meanOf(v);
  const s = sdOf(v);
  const flat: Spread = { n: v.length, nAll: all.length, mean: m, sd: s > 0 ? s : 0, sorted, xs: null, ys: null, modes: 0 };
  if (!(s > 0)) return flat;

  const h = silverman(v, sorted);
  const range = sorted[sorted.length - 1] - sorted[0];
  const lo = Math.max(sorted[0] - range * 0.2, quantile(sorted, 0.01) - h);
  const hi = Math.min(sorted[sorted.length - 1] + range * 0.2, quantile(sorted, 0.99) + h);
  if (!(hi > lo)) return flat;

  const xs = Array.from({ length: SPREAD_GRID }, (_, i) => lo + ((hi - lo) * i) / (SPREAD_GRID - 1));
  const raw = xs.map((g) => {
    let acc = 0;
    for (const x of v) {
      const z = (g - x) / h;
      acc += Math.exp(-0.5 * z * z);
    }
    return acc;
  });
  const top = Math.max(...raw);
  if (!(top > 0)) return flat;
  const ys = raw.map((y) => y / top);
  return { ...flat, xs, ys, modes: humps(ys) };
}

/* The height of the hill at one value, for the dot that marks where the
 * rower is on it. Linear between grid points. */
export function densityAt(sp: Spread, v: number): number {
  if (!sp.xs || !sp.ys || sp.xs.length < 2) return 0;
  const last = sp.xs.length - 1;
  if (v <= sp.xs[0]) return sp.ys[0];
  if (v >= sp.xs[last]) return sp.ys[last];
  let i = 0;
  while (i < last - 1 && sp.xs[i + 1] < v) i++;
  const span = sp.xs[i + 1] - sp.xs[i];
  const t = span > 0 ? (v - sp.xs[i]) / span : 0;
  return sp.ys[i] + (sp.ys[i + 1] - sp.ys[i]) * t;
}

/* A deviation on the measure's own scale: two significant figures below
 * one, so a real spread of three centimetres does not print as 0.0. */
function fmtSd(s: number): string {
  if (!(s > 0)) return "0";
  const dp = s >= 1 ? 1 : Math.min(6, 1 - Math.floor(Math.log10(s)));
  return s.toFixed(dp);
}

/* THE LINE OVER A DISTRIBUTION: what the piece was made of, in words. The
 * direction word comes off `faster` and nothing else: where a low number is
 * a fast one, a rower at the 22nd percentile of their own splits is faster
 * than 78% of them. */
export function spreadWords(sp: Spread, now: number | null, fmt: (y: number) => string, faster: boolean): string {
  const bits: string[] = [`MEAN ${fmt(sp.mean)}`];
  if (!(sp.sd > 0)) return `${bits[0]} · EVERY SAMPLE THE SAME`;
  bits.push(`SD ${fmtSd(sp.sd)}`);
  if (sp.modes >= 2) bits.push("TWO GROUPS");
  if (now !== null && Number.isFinite(now)) {
    bits.push(`NOW ${fmt(now)}`);
    const z = (now - sp.mean) / sp.sd;
    bits.push(`${z >= 0 ? "+" : "−"}${Math.abs(z).toFixed(1)} SD`);
    let below = 0;
    let equal = 0;
    for (const x of sp.sorted) {
      if (x < now) below++;
      else if (x === now) equal++;
      else break;
    }
    const pct = ((below + equal / 2) / sp.sorted.length) * 100;
    bits.push(faster ? `FASTER THAN ${Math.round(100 - pct)}%` : `ABOVE ${Math.round(pct)}%`);
  }
  if (sp.n < sp.nAll) bits.push(`FROM ${sp.n.toLocaleString("en-US")} OF ${sp.nAll.toLocaleString("en-US")}`);
  return bits.join(" · ");
}

/* ---- force curves ------------------------------------------------------- */

export const FORCE_GRID = 48;

/* One stroke on the frame of its own drive, linear between its samples:
 * strokes do not all have the same number of points, and a raw index would
 * smear a short stroke over a long one. Empty when there is no curve. */
export function resample(points: number[], n = FORCE_GRID): number[] {
  const out: number[] = [];
  const last = points.length - 1;
  if (last < 1) return out;
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * last;
    const j = Math.min(last - 1, Math.floor(t));
    out.push(points[j] + (points[j + 1] - points[j]) * (t - j));
  }
  return out;
}

/* ---- the piece, cut back out of the document ---------------------------- */

/* One tick of the monitor: the clock, the meters, the split it showed, the
 * average so far and the rate. Seconds and meters, as the charts count. */
export type Tick = { t: number; d: number; pace: number; avgPace: number; spm: number };

/* The ticks in order. A tick that runs behind the one before it, in time or
 * in distance, is a stray from another piece and is left out, so both the
 * clock and the meters ascend and either can be searched. */
export function pieceTicks(doc: TelemetryDoc): Tick[] {
  const out: Tick[] = [];
  for (const s of doc.samples) {
    const t = s.elapsedHundredths / 100;
    const d = s.distanceTenths / 10;
    if (!Number.isFinite(t) || !Number.isFinite(d) || t < 0 || d < 0) continue;
    const prev = out[out.length - 1];
    if (prev && (t < prev.t || d < prev.d)) continue;
    out.push({ t, d, pace: s.paceHundredths / 100, avgPace: s.avgPaceHundredths / 100, spm: s.spm });
  }
  return out;
}

/* The last item at or before `v` on an ascending key; -1 before the first. */
export function lastAtOrBefore<T>(items: T[], key: (item: T) => number, v: number): number {
  let lo = 0;
  let hi = items.length - 1;
  let at = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (key(items[mid]) <= v) {
      at = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return at;
}

/* One measure of the track read at a value of the other: the meters at a
 * second, or the second at a meter. Linear between two points, held at the
 * ends. */
export function along(track: { t: number; d: number }[], from: "t" | "d", v: number): number {
  const to = from === "t" ? "d" : "t";
  if (!track.length) return 0;
  const i = lastAtOrBefore(track, (p) => p[from], v);
  if (i < 0) return track[0][to];
  if (i >= track.length - 1) return track[track.length - 1][to];
  const a = track[i];
  const b = track[i + 1];
  const span = b[from] - a[from];
  return span > 0 ? a[to] + ((v - a[from]) / span) * (b[to] - a[to]) : a[to];
}

export type Block = { n: number; meters: number; seconds: number };

/* EVERY 500 M, cut from the tick stream with the crossing interpolated
 * between the two ticks either side of it. The walk starts where the ticks
 * do: a recording that begins part-way into a block cannot measure that
 * block, so its first crossing only starts the clock. Blocks are numbered
 * by where they are in the piece. */
export function blocks500(ticks: Tick[], blockM = 500): Block[] {
  const out: Block[] = [];
  const first = ticks[0];
  if (!first) return out;
  const onBoundary = Math.abs(first.d / blockM - Math.round(first.d / blockM)) < 1e-9;
  let mark = onBoundary ? first.d + blockM : Math.ceil(first.d / blockM) * blockM;
  let skip = first.d > 0 && !onBoundary;
  let n = Math.round(mark / blockM);
  let prevT = first.t;
  let prev: Tick | null = null;
  for (const s of ticks) {
    while (s.d >= mark && out.length < 400) {
      const t = prev && s.d > prev.d ? prev.t + ((mark - prev.d) * (s.t - prev.t)) / (s.d - prev.d) : s.t;
      const seconds = t - prevT;
      if (skip) skip = false;
      else if (seconds > 0) out.push({ n, meters: blockM, seconds });
      prevT = t;
      mark += blockM;
      n++;
    }
    prev = s;
  }
  return out;
}
