import type { ErgAnalysis } from "./analysis";
import type { TelemetryDoc } from "./session";

/* ONE ROW AS A HANDFUL OF FIGURES, AND EVERYBODY'S ROWS AS A FIELD (owner,
 * 2026-11-22, of the cards on a row's analytics: "for as many as we're able
 * to, let's create that second pane like we have for the force curve where
 * it compares us against other people"; "what does mine look like compared
 * to everyone else, and what does that mean about me? ... if I'm really
 * consistent, then showing that my split spread is only this, whereas the
 * average is around this").
 *
 * Three things live here, and the phone and the server both run them, so a
 * rower's own figure and the field's are worked out by the same lines:
 *
 *   craftOf     the two scores out of 100 that are not speed (steady pace,
 *               same stroke), moved here from the phone's read.
 *   measureOf   one recording as the figures a card compares: how steady,
 *               how it was paced, rate and length, where the push peaks,
 *               the work in a stroke and how much of it was kept.
 *   fieldOf     many rowers' measures as a field: ONE FIGURE A ROWER (their
 *               recordings averaged first, so somebody with forty rows
 *               counts once), each list sorted, nobody's name in it.
 *
 * PURE, as analysis.ts is: no React, no database. The app's copy is made by
 * `npm run sync:pm5` in mobile/. */

export type XY = { x: number; y: number };

const num = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

export const meanOf = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
export const sdOf = (v: number[]) => {
  const m = meanOf(v);
  return v.length ? Math.sqrt(meanOf(v.map((x) => (x - m) ** 2))) : 0;
};

/* A MOVING AVERAGE, centred: each point is the mean of the points around
 * it, `win` of them, fewer at the two ends. What a stroke-by-stroke figure
 * is doing, without each stroke's own wobble. */
export function smooth(pts: XY[], win: number): XY[] {
  const half = Math.max(1, Math.floor(win / 2));
  return pts.map((p, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(pts.length - 1, i + half); j++) {
      sum += pts[j].y;
      n++;
    }
    return { x: p.x, y: sum / n };
  });
}
/* How wide the window is for a piece of this many strokes: about a
 * twentieth of it, never under five strokes. */
export const windowOf = (n: number) => Math.max(5, Math.round(n / 20) | 1);

/* THE FIRST AND THE LAST STROKES ARE NOT THE PIECE (owner, 2026-11-21:
 * "we can also cut off like the last or first stroke ... the meters per
 * stroke dropped a lot because it finished"): the flywheel spinning up and
 * the handle being let go. Two off each end, and then any stroke left at
 * either end that still sits far outside the rest. */
export function trimEnds(pts: XY[]): XY[] {
  if (pts.length < 14) return pts;
  let out = pts.slice(2, -2);
  const ys = out.map((p) => p.y);
  const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
  const sd = Math.sqrt(ys.reduce((a, b) => a + (b - mean) ** 2, 0) / ys.length) || 1;
  while (out.length > 10 && Math.abs(out[0].y - mean) > 3 * sd) out = out.slice(1);
  while (out.length > 10 && Math.abs(out[out.length - 1].y - mean) > 3 * sd) out = out.slice(0, -1);
  return out;
}

/* A list stretched onto `n` places, straight between its own points. */
function stretch(points: number[], n: number): number[] {
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

/* A line read at `n` even places from its first x to its last: a piece of
 * any length on the same frame, by how far through it the rower was. */
function alongX(pts: XY[], n: number): number[] {
  const x0 = pts[0].x;
  const x1 = pts[pts.length - 1].x;
  const out: number[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / (n - 1);
    while (j < pts.length - 2 && pts[j + 1].x < x) j++;
    const a = pts[j];
    const b = pts[j + 1];
    const f = b.x > a.x ? Math.max(0, Math.min(1, (x - a.x) / (b.x - a.x))) : 0;
    out.push(a.y + (b.y - a.y) * f);
  }
  return out;
}

/* ---- the two scores ------------------------------------------------------ */

/* A SCORE TO CHASE THAT IS NOT SPEED (owner, 2026-11-21: "I really like the
 * idea of the how steady metric ... giving you like a rating for how steady
 * you are that you can work on ... it doesn't matter if I'm rowing a 201 or
 * a 230 if I am going for this like constant rate"; "the consistency of
 * your force curve is probably something that you would want to optimize").
 *
 *   STEADY        100, less ten for every 1% the split wandered from its
 *                 own average, read five strokes at a time (the standard
 *                 deviation of the split over its mean). A 2:00 split held within a
 *                 second and a bit scores 90.
 *   SAME STROKE   100, less three for every 1% the shape of a stroke
 *                 differed from the average stroke, each curve first scaled
 *                 to its own peak, so pulling harder does not count against
 *                 it: only pulling differently does.
 *
 * Both leave out the first strokes and the last, which are the flywheel
 * and the finish. Neither knows how fast the piece was. */
export type Craft = { steady: number | null; paceMean: number; paceSd: number; within1: number; paces: number[]; same: number | null; rateSd: number | null };
export function craftOf(a: ErgAnalysis, doc: TelemetryDoc): Craft {
  const counted = a.series.filter((s) => s.counted);
  /* Five strokes at a time: one stroke's split jumps a second or two by
   * itself on any monitor, and that is not the rower wandering. */
  const paces = smooth(trimEnds(counted.filter((s) => num(s.paceTenths) && (s.paceTenths as number) > 0).map((s) => ({ x: s.n, y: (s.paceTenths as number) / 10 }))), 5).map((p) => p.y);
  const paceMean = meanOf(paces);
  const paceSd = sdOf(paces);
  const steady = paces.length >= 10 && paceMean > 0 ? Math.max(0, Math.min(100, Math.round(100 - (paceSd / paceMean) * 1000))) : null;
  const within1 = paces.length ? paces.filter((p) => Math.abs(p - paceMean) <= 1).length / paces.length : 0;
  /* The shape of each stroke against the average shape. */
  const shapes = (doc.forceCurves ?? [])
    .slice(3, -2)
    .filter((c) => c.points.length >= 6 && Math.max(...c.points) > 0)
    .map((c) => {
      const r = stretch(c.points, 32);
      const peak = Math.max(...r) || 1;
      return r.map((v) => v / peak);
    });
  let same: number | null = null;
  if (shapes.length >= 8) {
    const mean = shapes[0].map((_, i) => meanOf(shapes.map((s) => s[i])));
    const rms = meanOf(shapes.map((s) => Math.sqrt(meanOf(s.map((v, i) => (v - mean[i]) ** 2)))));
    same = Math.max(0, Math.min(100, Math.round(100 - rms * 300)));
  }
  const rates = trimEnds(counted.filter((s) => num(s.spm)).map((s) => ({ x: s.n, y: s.spm as number }))).map((p) => p.y);
  return { steady, paceMean, paceSd, within1, paces, same, rateSd: rates.length >= 10 ? sdOf(rates) : null };
}

/* ---- one row, measured --------------------------------------------------- */

/* How many places a piece's pacing is read at, start to finish. */
export const SHAPE_STEPS = 24;

/* Every figure is null when the recording cannot say it; nothing is guessed. */
export type RowMeasure = {
  /* The two scores, out of 100. */
  steady: number | null;
  same: number | null;
  /* How far the split wandered: its standard deviation, in seconds a 500.
   * The figure the card prints as SPLIT SPREAD. */
  spread: number | null;
  /* The same for the rate, in strokes a minute. */
  rateSd: number | null;
  /* Strokes a minute, meters a stroke, joules a stroke: the piece's averages. */
  rate: number | null;
  length: number | null;
  work: number | null;
  /* The work in a stroke over the last third against the first third, in
   * percent: -8 is eight percent given back. */
  fade: number | null;
  /* The second half against the first, in seconds a 500: positive is slower. */
  halves: number | null;
  /* Where the push peaks, in percent of the drive. */
  peak: number | null;
  /* The average split, in seconds a 500. */
  pace: number | null;
  /* The split along the piece at SHAPE_STEPS even places, each as a percent
   * off the piece's own average: negative is quicker. */
  pacing: number[] | null;
};

export function measureOf(a: ErgAnalysis, doc: TelemetryDoc, craft: Craft = craftOf(a, doc)): RowMeasure {
  const counted = a.series.filter((s) => s.counted);
  let pacing: number[] | null = null;
  const paceRaw = trimEnds(counted.filter((s) => num(s.paceTenths) && (s.paceTenths as number) > 0 && num(s.distanceM)).map((s) => ({ x: s.distanceM, y: (s.paceTenths as number) / 10 })));
  if (paceRaw.length >= 30) {
    const line = smooth(paceRaw, windowOf(paceRaw.length) * 2);
    const mean = meanOf(line.map((p) => p.y));
    if (mean > 0 && line[line.length - 1].x > line[0].x) pacing = alongX(line, SHAPE_STEPS).map((v) => (v / mean - 1) * 100);
  }
  let fade: number | null = null;
  const work = smooth(trimEnds(counted.filter((s) => num(s.workJ)).map((s) => ({ x: s.n, y: s.workJ as number }))), windowOf(counted.length));
  if (work.length >= 30) {
    const third = Math.floor(work.length / 3);
    const first = meanOf(work.slice(0, third).map((p) => p.y));
    const last = meanOf(work.slice(-third).map((p) => p.y));
    if (first > 0) fade = (last / first - 1) * 100;
  }
  const rate = a.rateTrend && num(a.rateTrend.mean) ? a.rateTrend.mean : a.avgSpm;
  return {
    steady: craft.steady,
    same: craft.same,
    spread: num(a.steady.paceSdTenths) ? a.steady.paceSdTenths / 10 : null,
    rateSd: craft.rateSd,
    rate: num(rate) && rate > 0 ? rate : null,
    length: num(a.metresPerStroke) && a.metresPerStroke > 0 ? a.metresPerStroke : null,
    work: num(a.workPerStrokeJ) && a.workPerStrokeJ > 0 ? a.workPerStrokeJ : null,
    fade,
    halves: a.halves ? a.halves.deltaTenths / 10 : null,
    peak: a.force && num(a.force.peakPct) ? a.force.peakPct : null,
    pace: num(a.avgPaceTenths) && a.avgPaceTenths > 0 ? a.avgPaceTenths / 10 : null,
    pacing,
  };
}

/* ---- everybody ----------------------------------------------------------- */

/* The figures a field is kept for. Each is a list with one number a rower,
 * smallest first. */
export const FIELD_KEYS = ["steady", "same", "spread", "rateSd", "rate", "length", "work", "fade", "halves", "peak"] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

export type FieldStats = { rows: number; rowers: number } & Record<FieldKey, number[]> & {
    /* Rate and length together, a pair a rower, for the picture of both. */
    pairs: [number, number][];
    /* The pacing of the average rower: each rower's own shape first, then
     * the rowers together. Percent off their own average split. */
    pacing: number[] | null;
  };

const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;

/* `byRower` is each rower's recordings, measured. A rower with nothing to
 * say for a figure is left out of that figure's list and no other. */
export function fieldOf(byRower: RowMeasure[][]): FieldStats | null {
  /* A recording with nothing to say (ticks and no strokes) is no row here. */
  const says = (m: RowMeasure) => FIELD_KEYS.some((k) => num(m[k])) || !!m.pacing;
  const rowers = byRower.map((list) => list.filter(says)).filter((list) => list.length > 0);
  if (!rowers.length) return null;
  const avg = (list: RowMeasure[], k: FieldKey): number | null => {
    const vals = list.map((m) => m[k]).filter(num);
    return vals.length ? meanOf(vals) : null;
  };
  const out = { rows: rowers.reduce((n, l) => n + l.length, 0), rowers: rowers.length, pairs: [], pacing: null } as unknown as FieldStats;
  for (const k of FIELD_KEYS)
    out[k] = rowers
      .map((l) => avg(l, k))
      .filter(num)
      .map((v) => round(v, 2))
      .sort((x, y) => x - y);
  for (const l of rowers) {
    const r = avg(l, "rate");
    const m = avg(l, "length");
    if (r !== null && m !== null) out.pairs.push([round(r, 1), round(m, 2)]);
  }
  const shapes = rowers
    .map((l) => l.map((m) => m.pacing).filter((p): p is number[] => !!p && p.length === SHAPE_STEPS))
    .filter((l) => l.length > 0)
    .map((l) => l[0].map((_, i) => meanOf(l.map((p) => p[i]))));
  if (shapes.length) out.pacing = shapes[0].map((_, i) => round(meanOf(shapes.map((s) => s[i])), 3));
  return out;
}

/* ---- where one figure stands in a list ----------------------------------- */

/* The value a share `q` of a sorted list sits under, straight between its
 * neighbours. */
export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const t = (sorted.length - 1) * Math.max(0, Math.min(1, q));
  const i = Math.floor(t);
  const j = Math.min(sorted.length - 1, i + 1);
  return sorted[i] + (sorted[j] - sorted[i]) * (t - i);
}
export const medianOf = (sorted: number[]) => quantile(sorted, 0.5);

/* How many of the list sit under a figure and how many over it. A figure
 * within `tie` of one of them is level with it, and counts as neither. */
export function placeOf(sorted: number[], mine: number, tie = 0): { n: number; under: number; over: number } {
  let under = 0;
  let over = 0;
  for (const v of sorted) {
    if (v < mine - tie) under++;
    else if (v > mine + tie) over++;
  }
  return { n: sorted.length, under, over };
}
