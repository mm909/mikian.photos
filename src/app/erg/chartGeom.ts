/* THE CHART MATHS, WITH NO REACT IN IT (owner, 2026-09-17: "let me click on
 * the charts on the live look on the erg to open them up and scrub through
 * them and make them bigger — I should also be able to hover over these
 * values, my cursor should be able to go to a certain point and see the XY
 * values on it").
 *
 * Everything a chart needs to know about where a number lands on glass:
 * the domain, the two scales, the ticks, the bars, and the point nearest a
 * cursor. It was inside charts.tsx and is out here for two reasons.
 *
 * ONE: the same function has to answer for two geometries now. A panel is
 * 360 units wide and stretched into whatever column the grid gave it; an
 * OPENED chart measures its own box and takes that many units, so its scale
 * is exactly one and every font size in the sheet renders at the number it
 * says. Handing both of those to one computePlot is what stops the panel and
 * the sheet ever drawing the same piece differently.
 *
 * TWO: src/app/erg/s/ReviewCharts.tsx — the screen that reads a SAVED row
 * back — is a server component and can never import a hook. It can import
 * this. The owner has already said the live coach view and the after view
 * should be one component set with two data sources; this file is that seam,
 * cut early and cheaply. The one thing still missing on that day is a
 * serialisable formatter, because a server component cannot pass an xFmt
 * across the boundary. That is a lookup table added here when the review
 * screen asks for a cursor, and not before.
 *
 * NO REACT IMPORT OF ANY KIND, not even a type. The one thing it does
 * import is src/lib/rowStats.ts, which imports nothing itself — the same
 * pure statistics the Rowtember numbers page runs on. */

import { kde, linspace, mean, peaks, percentileRank, quantile, sd, silverman, sortAsc } from "@/lib/rowStats";

export type XY = { x: number; y: number };

export type Series = {
  points: XY[];
  /* line: the solid one; dashed: the quieter second; bars: filled. */
  kind: "line" | "dashed" | "bars";
  label: string;
};

export type Pad = { l: number; r: number; t: number; b: number };

/* The panel has not moved a pixel: 360 units across, the same pad it always
 * had. The opened pad is in real CSS pixels, because an opened chart is
 * painted at its measured size. */
export const VW = 360;
export const PAD: Pad = { l: 46, r: 10, t: 10, b: 28 };
export const PADZ: Pad = { l: 58, r: 18, t: 18, b: 36 };

export const fmtNum = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

/* Round ticks: the axis wants about n labels at a step that reads. */
export function ticks(min: number, max: number, n = 4): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / n;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  const step = (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

/* At most `cap` points on a line, keeping the last one so a chart ends
 * where the piece does. A played-back forty-five minute row hands the whole
 * of itself to a panel 360 units wide; drawing twelve thousand points into
 * that is a slower frame and not one extra pixel of truth. */
export function thinPoints(points: XY[], cap = 600): XY[] {
  if (points.length <= cap) return points;
  const k = Math.ceil(points.length / cap);
  const out: XY[] = [];
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
  invertY: boolean;
  sx: (x: number) => number;
  sy: (y: number) => number;
  /* A viewBox x back to a data x, clamped into the domain. */
  ix: (vx: number) => number;
  xt: number[];
  yt: number[];
  barW: number;
  barBaseY: number;
  /* The finite points of each series, in series order — THE SAME ARRAYS the
   * paths are built from, so a reading can never name a point that is not
   * on the glass. */
  drawn: XY[][];
  /* Which series the rule snaps to: the first one with two points. */
  lead: number;
  /* Which series the SPREAD describes, which is not always the same one
   * (review, 2026-09-17). lead is the interaction anchor and must always
   * exist; this one is allowed to be -1, and is, whenever the only drawable
   * series is a DASHED companion. Those are cumulants and not samples — the
   * deviation of a running mean shrinks towards zero as a row goes on
   * whatever the rower does — so a distribution of one would be arithmetic
   * rather than a fact about anybody. */
  statLead: number;
};

export type PlotOpts = {
  W: number;
  H: number;
  pad: Pad;
  invertY?: boolean;
  refY?: number;
  yMin?: number;
  yMax?: number;
};

/* THE DOMAIN AND THE SCALES. This is the body that used to live inside
 * Chart, moved across unchanged and in the same order — the min and max of
 * x, the widening when they are equal, the yMin fallback that counts refY,
 * the eight per cent of air on only the side that was not pinned, the rule
 * that a bar chart starts at zero. None of that may visibly move in this
 * change, so none of it has been improved.
 *
 * NULL IS THE EMPTY BRANCH: fewer than two finite points anywhere and there
 * is no chart to draw, which is the caller's cue to print its empty word. */
export function computePlot(series: Series[], o: PlotOpts): Plot | null {
  const invertY = o.invertY ?? false;
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
  /* A little air above and below the data. */
  const air = (hi - lo) * 0.08;
  if (o.yMin === undefined) lo -= air;
  if (o.yMax === undefined) hi += air;
  const hasBars = series.some((s) => s.kind === "bars");
  if (hasBars && o.yMin === undefined) lo = Math.min(lo, 0);

  const pw = o.W - o.pad.l - o.pad.r;
  const ph = o.H - o.pad.t - o.pad.b;
  const sx = (x: number) => o.pad.l + ((x - x0) / (x1 - x0)) * pw;
  const sy = (y: number) => {
    const f = (y - lo) / (hi - lo);
    return invertY ? o.pad.t + f * ph : o.pad.t + (1 - f) * ph;
  };
  const ix = (vx: number) => x0 + Math.min(1, Math.max(0, (vx - o.pad.l) / pw)) * (x1 - x0);

  /* THE TICKS FOLLOW THE BOX. Four labels across an 1,100 pixel axis is an
   * empty axis; nine across 360 units is a smear. At the panel width both
   * of these still evaluate to four, so the panels do not move. */
  const xt = ticks(x0, x1, Math.max(4, Math.min(9, Math.round(pw / 110))));
  const yt = ticks(lo, hi, Math.max(4, Math.min(8, Math.round(ph / 46))));

  const barN = Math.max(1, ...series.filter((s) => s.kind === "bars").map((s) => s.points.length));
  const barW = Math.max(1, (pw / barN) * 0.7);

  return {
    W: o.W,
    H: o.H,
    pad: o.pad,
    pw,
    ph,
    x0,
    x1,
    lo,
    hi,
    invertY,
    sx,
    sy,
    ix,
    xt,
    yt,
    barW,
    barBaseY: sy(Math.max(lo, 0)),
    drawn,
    lead: drawn.findIndex((p) => p.length >= 2),
    statLead: drawn.findIndex((p, i) => p.length >= 2 && series[i].kind !== "dashed"),
  };
}

/* THE POINT UNDER THE CURSOR, by x alone.
 *
 * Every series on this console ascends in x — samples by elapsed time,
 * strokes by number — and thinPoints walks backwards and reverses, so a
 * thinned array ascends too. So this is a bisect and not a walk: six hundred
 * points answer in ten comparisons, which matters because it runs once per
 * series per frame on a tree that is already repainting twelve times a
 * second.
 *
 * X ONLY, NEVER A TWO-DIMENSIONAL SCREEN DISTANCE, and the reasons are facts
 * about these nine charts. The pace chart is invertY, so a 2-D search would
 * have to run back through sy() to be right. The watts chart is bars per
 * stroke PLUS a dashed running average over one x domain, and a vertical
 * rule reports both at that stroke where a 2-D nearest reports one and hides
 * the other. And pace and stroke rate share x = elapsed, where one rule
 * reads as AT 12:04 rather than as a point on one of two curves. */
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

/* The average gap between one series points, in x. What counts as NEAR the
 * rule: a series with nothing within about one and a half gaps of it prints
 * a dash rather than naming a value forty strokes away. */
export function stepOf(p: Plot, pts: XY[]): number {
  return (p.x1 - p.x0) / Math.max(1, pts.length - 1);
}

/* ------------------------------------------------- the shape of a number */

/* THE SPREAD OF ONE KPI (owner, 2026-09-17: "when most of these graphs I
 * also want a KDE showing the results of each KPI and their mean and sd").
 *
 * A time series says what happened in what order. This says what the piece
 * was MADE of: where the mass of the strokes sat, how wide it was, and where
 * the number is right now inside its own history. Two rowers with the same
 * average split can have completely different shapes here, and the shape is
 * the part a coach reads.
 *
 * IT IS DRAWN ON THE CHART OWN Y SCALE — a hill lying on its side against
 * the right edge, the mean a dashed rule across the plot, one standard
 * deviation a slab across it. One sy() for the line and for its own
 * distribution, which is what makes an inverted axis correct by
 * construction rather than by care: the pace chart draws faster upward, and
 * a density with its own geometry would need its own flip and its own
 * flipped words, in two places that would eventually disagree.
 *
 * The maths is src/lib/rowStats.ts — the same gaussian kernel and the same
 * Silverman bandwidth the Rowtember numbers page has drawn all month. That
 * file imports nothing, so a client component can use it and so can a
 * server one.
 *
 * WHAT IT COSTS, on a screen that repaints twelve times a second. A gaussian
 * kernel is one exp() per value per grid point; nine charts of six hundred
 * points on a hundred and twenty point grid at twelve hertz is about eight
 * million exp() a second, which is a third of a core on a mid Android. So
 * there are two tiers. STATS — the mean, the deviation, the sorted copy and
 * the percentile — is one pass and one sort, no grid and no exp(), and every
 * chart gets it. CURVE is asked for only by a chart that is OPEN, and the
 * opened sheet is modal, so at most one exists. See useSpread in charts.tsx
 * for the clock on top of that. */

export type Spread = {
  /* Values used, after thinning, and values offered. A thinned sample says
   * so on screen rather than quietly describing a third of the piece. */
  n: number;
  nAll: number;
  mean: number;
  /* rowStats.sd is the POPULATION deviation, over n. It describes the values
   * it was handed, which is the right question for a distribution. It is NOT
   * the same quantity as predict.blockSigma, which divides by n minus one
   * because it is estimating an unseen future. The two are never printed
   * beside each other: this one prints as SD, that one as a plus or minus. */
  sd: number;
  /* Ascending. quantile and percentileRank both require sorted input and
   * neither sorts for you. */
  sorted: number[];
  /* The window the curve was drawn over, already clipped to the axis. */
  lo: number;
  hi: number;
  /* Null when only stats were asked for. */
  xs: number[] | null;
  ys: number[] | null;
  /* How many humps. Two is a real answer on an interval piece and it is the
   * one case where the mean is a pace nobody rowed. */
  modes: number;
};

/* Under eight values there is no distribution, only eight values. */
export const SPREAD_MIN = 8;
/* Under three the deviation is a number but not a fact; the slab is not
 * drawn, though the mean rule still is. */
export const SPREAD_SD_MIN = 3;
/* The kernel is linear in this, so it is the cost dial. */
export const SPREAD_CAP = 300;
/* The strip is at most ninety six units wide, and in an opened chart one
 * unit is one pixel. More grid than that is invisible. */
export const SPREAD_GRID = 96;

export function computeSpread(pts: XY[], want: "stats" | "curve", domain: [number, number]): Spread | null {
  const all = pts.filter((p) => Number.isFinite(p.y));
  if (all.length < SPREAD_MIN) return null;
  const used = thinPoints(all, SPREAD_CAP);
  const v = used.map((p) => p.y);
  const sorted = sortAsc(v);
  const m = mean(v);
  const s = sd(v);

  /* EVERY SAMPLE THE SAME is a real answer and not a curve, and it has to be
   * caught BEFORE silverman: a monitor sitting at a steady 24 spm sends one
   * integer for a minute, and silverman ends with `return h > 0 ? h : 1`, so
   * it hands back a made-up width of one and the kernel draws a confident
   * hill over data that has no width at all. */
  if (!(s > 0)) {
    return { n: v.length, nAll: all.length, mean: m, sd: 0, sorted, lo: m, hi: m, xs: null, ys: null, modes: 0 };
  }
  if (want === "stats") {
    return { n: v.length, nAll: all.length, mean: m, sd: s, sorted, lo: sorted[0], hi: sorted[sorted.length - 1], xs: null, ys: null, modes: 0 };
  }

  const h = silverman(v);
  /* The middle ninety eight per cent, widened by a bandwidth so the curve
   * comes down to the axis, then clipped to what the chart actually shows so
   * the hill can never run off its own plot. */
  const dLo = Math.min(domain[0], domain[1]);
  const dHi = Math.max(domain[0], domain[1]);
  const lo = Math.max(dLo, quantile(sorted, 0.01) - h);
  const hi = Math.min(dHi, quantile(sorted, 0.99) + h);
  if (!(hi > lo)) {
    return { n: v.length, nAll: all.length, mean: m, sd: s, sorted, lo: sorted[0], hi: sorted[sorted.length - 1], xs: null, ys: null, modes: 0 };
  }

  const xs = linspace(lo, hi, SPREAD_GRID);
  const raw = kde(v, h, xs);
  const top = Math.max(...raw);
  const ys = top > 0 ? raw.map((y) => y / top) : raw.map(() => 0);
  /* Blunt on purpose: a second hump must stand fifteen per cent of the
   * tallest above the dip before it counts, so a wobbly hill does not
   * conjure a mode out of noise. */
  const modes = top > 0 ? peaks(ys, 0.15).length : 0;

  return { n: v.length, nAll: all.length, mean: m, sd: s, sorted, lo, hi, xs, ys, modes };
}

/* Where one value sits among the others, as a percentage at or below it.
 * The caller decides what that MEANS: on an inverted axis lower is faster,
 * so the sentence flips and the picture does not. */
export function spreadRank(sp: Spread, v: number): number {
  return percentileRank(sp.sorted, v);
}

/* The height of the curve at one value, for the dot that marks where the
 * rower is on their own hill. Linear between grid points. */
export function densityAt(sp: Spread, v: number): number {
  if (!sp.xs || !sp.ys || sp.xs.length < 2) return 0;
  if (v <= sp.xs[0]) return sp.ys[0];
  const last = sp.xs.length - 1;
  if (v >= sp.xs[last]) return sp.ys[last];
  let i = 0;
  while (i < last - 1 && sp.xs[i + 1] < v) i++;
  const span = sp.xs[i + 1] - sp.xs[i];
  const t = span > 0 ? (v - sp.xs[i]) / span : 0;
  return sp.ys[i] + (sp.ys[i + 1] - sp.ys[i]) * t;
}
