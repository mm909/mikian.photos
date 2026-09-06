import { splitSeconds } from "@/lib/row100k";
import { kde, linspace, mean, percentileRank, quantile, sd, silverman, sortAsc } from "@/lib/rowStats";
import { fmtClock, fmtM } from "../analysis/fmt";
import type { KdeChart, KdeYou } from "../analysis/model";

/* THE FIELD on the stats page — every row's length and pace as a
 * distribution. Pure and server-side: rows in, plain JSON out (owner ask,
 * 2026-09-05: the split KDE and a length KDE from the numbers page and a
 * stat report — mean, median, SD, P10–P90 — with nothing explained; the
 * split-vs-distance scatter went back to the numbers page on the second
 * look, which keeps its own model in analysis/compute.ts). Same maths as
 * compute.ts, narrowed to what this section prints, so the two pages
 * never disagree on a figure.
 *
 * Who is in what: the aggregates — means, medians, SDs, percentiles, the
 * density curves — count everyone. The individual marks (the grey rug
 * ticks) leave out a rower the blackout is hiding from this viewer, since
 * an unlabelled tick at a known distance is still that rower's number. The
 * viewer's own marks are always theirs. (The most-common-row tile went on
 * the owner's second look, 2026-09-05 evening.) */

export type FieldEntry = { participantId: string; meters: number; seconds: number };

/* A split outside this band is a typo, not a row (validateEntry lets new
 * rows in at 60–900; the field reads tighter). Meters need only be > 0. */
export const SPLIT_LO = 60;
export const SPLIT_HI = 600;

export type FieldStats = { n: number; mean: number; median: number; sd: number; p10: number; p90: number };

export type FieldModel = {
  sessions: number;
  rowers: number;
  length: FieldStats | null;
  pace: FieldStats | null;
  lengthKde: KdeChart | null;
  paceKde: KdeChart | null;
};

export type FieldYou = {
  sessions: number;
  avgLen: number;
  avgPace: number | null;
  /* share (0–100) of the OTHER rowers whose average this beats — longer
   * for length, faster for pace; null when there is nobody to compare */
  lenPct: number | null;
  pacePct: number | null;
  lengthYou: KdeYou | null;
  paceYou: KdeYou | null;
};

type Sess = { pid: string; meters: number; seconds: number; split: number | null };

/* Sessions before a density is drawn. */
const MIN_KDE = 5;
const GRID = 120;
/* The grey rug is a thinned sample, never the full set. */
const RUG = 240;

const r1 = (v: number) => Math.round(v * 10) / 10;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

function toSess(e: FieldEntry): Sess | null {
  if (!(e.meters > 0)) return null;
  const split = e.seconds > 0 ? splitSeconds(e.meters, e.seconds) : NaN;
  return {
    pid: e.participantId,
    meters: e.meters,
    seconds: e.seconds,
    split: split >= SPLIT_LO && split <= SPLIT_HI ? split : null,
  };
}

export function statsOf(xs: number[]): FieldStats | null {
  if (!xs.length) return null;
  const s = sortAsc(xs);
  return {
    n: xs.length,
    mean: mean(xs),
    median: quantile(s, 0.5),
    sd: sd(xs),
    p10: quantile(s, 0.1),
    p90: quantile(s, 0.9),
  };
}

function tickStep(range: number, steps: number[], maxTicks: number): number {
  for (const s of steps) if (range / s <= maxTicks) return s;
  return steps[steps.length - 1];
}

function ticksBetween(lo: number, hi: number, step: number): number[] {
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

function thin(sorted: number[], k: number): number[] {
  if (sorted.length <= k) return sorted;
  return Array.from({ length: k }, (_, i) => sorted[Math.round((i * (sorted.length - 1)) / (k - 1))]);
}

/* A density on [lo, hi], its peak scaled to 1 (KdeSvg scales to the peak
 * anyway, and a per-meter density rounded to five places would be zero). */
function curve(xs: number[], lo: number, hi: number): { xs: number[]; ys: number[] } {
  const grid = linspace(lo, hi, GRID);
  const raw = kde(xs, silverman(xs), grid);
  const top = Math.max(...raw);
  return { xs: grid.map(r1), ys: raw.map((v) => (top > 0 ? r3(v / top) : 0)) };
}

export function buildField(
  entries: FieldEntry[],
  opts: { isHidden: (participantId: string) => boolean; meId: string | null },
): { field: FieldModel; you: FieldYou | null } {
  const sess: Sess[] = [];
  for (const e of entries) {
    const s = toSess(e);
    if (s) sess.push(s);
  }
  const n = sess.length;
  const paced = sess.filter((s): s is Sess & { split: number } => s.split !== null);
  const shown = (s: Sess) => !opts.isHidden(s.pid);

  /* ------------------------------------------------------------ length */
  const meters = sess.map((s) => s.meters);
  const sortedM = sortAsc(meters);
  const length = statsOf(meters);
  let lengthKde: KdeChart | null = null;
  if (n >= MIN_KDE && length) {
    const q99 = quantile(sortedM, 0.99);
    const step = tickStep(q99, [500, 1000, 2000, 2500, 5000, 10000, 20000, 50000], 6);
    const hi = Math.max(step, Math.ceil(q99 / step) * step);
    const c = curve(meters, 0, hi);
    lengthKde = {
      ...c,
      xMin: 0,
      xMax: hi,
      ticks: ticksBetween(0, hi, step),
      mean: length.mean,
      sd: length.sd,
      median: length.median,
      rug: thin(sortAsc(sess.filter(shown).map((s) => s.meters)), RUG),
      take: "",
    };
  }

  /* -------------------------------------------------------------- pace */
  const splits = paced.map((s) => s.split);
  const sortedSp = sortAsc(splits);
  const pace = statsOf(splits);
  let paceKde: KdeChart | null = null;
  if (paced.length >= MIN_KDE && pace) {
    const lo = Math.max(SPLIT_LO, Math.min(100, Math.floor(quantile(sortedSp, 0.01) / 10) * 10));
    const hi = Math.min(SPLIT_HI, Math.max(200, Math.ceil(quantile(sortedSp, 0.99) / 10) * 10));
    const c = curve(splits, lo, hi);
    paceKde = {
      ...c,
      xMin: lo,
      xMax: hi,
      ticks: ticksBetween(lo, hi, tickStep(hi - lo, [10, 20, 30, 60, 120], 7)),
      mean: pace.mean,
      sd: pace.sd,
      median: pace.median,
      rug: thin(sortAsc(paced.filter(shown).map((s) => r1(s.split))), RUG),
      take: "",
    };
  }

  /* ------------------------------------------------------- per rower */
  const perPid = new Map<string, { lens: number[]; splits: number[] }>();
  for (const s of sess) {
    const r = perPid.get(s.pid) ?? { lens: [], splits: [] };
    r.lens.push(s.meters);
    if (s.split !== null) r.splits.push(s.split);
    perPid.set(s.pid, r);
  }

  const field: FieldModel = {
    sessions: n,
    rowers: perPid.size,
    length,
    pace,
    lengthKde,
    paceKde,
  };

  /* --------------------------------------------------------------- you */
  const meId = opts.meId;
  const mineAll = meId ? perPid.get(meId) : undefined;
  if (!meId || !mineAll) return { field, you: null };
  const mine = sess.filter((s) => s.pid === meId);
  const minePaced = paced.filter((s) => s.pid === meId);
  const avgLen = mean(mineAll.lens);
  const avgPace = mineAll.splits.length ? mean(mineAll.splits) : null;

  /* Ranked against every OTHER rower's average (everyone, no club filter),
   * ties counted half, so nobody is ranked against themselves. */
  const otherLens: number[] = [];
  const otherPaces: number[] = [];
  for (const [pid, r] of perPid) {
    if (pid === meId) continue;
    otherLens.push(mean(r.lens));
    if (r.splits.length) otherPaces.push(mean(r.splits));
  }
  const lenPct = otherLens.length ? Math.round(percentileRank(sortAsc(otherLens), avgLen)) : null;
  const pacePct =
    avgPace !== null && otherPaces.length
      ? Math.round(100 - percentileRank(sortAsc(otherPaces), avgPace))
      : null;

  const longest = Math.max(...mine.map((s) => s.meters));
  const best = minePaced.length ? Math.min(...minePaced.map((s) => s.split)) : NaN;

  const you: FieldYou = {
    sessions: mine.length,
    avgLen,
    avgPace,
    lenPct,
    pacePct,
    lengthYou: lengthKde
      ? {
          rug: mine.map((s) => s.meters),
          median: avgLen,
          best: longest,
          tag: `YOU · AVG ${fmtM(avgLen)}`,
          bestTag: `LONGEST ${fmtM(longest)}`,
        }
      : null,
    paceYou:
      paceKde && avgPace !== null
        ? {
            rug: minePaced.map((s) => r1(s.split)),
            median: avgPace,
            best,
            tag: `YOU · AVG ${fmtClock(avgPace)}`,
            bestTag: `BEST ${fmtClock(best)}`,
          }
        : null,
  };
  return { field, you };
}
