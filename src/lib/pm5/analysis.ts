import { fmtMeters, fmtTenths } from "./pm5";
import { derivePaceTenths, fmtTenthsClock, type TelemetryCurve, type TelemetryDoc, type TelemetrySavedRow, type TelemetryStroke } from "./session";

/* READING A PIECE AFTER IT IS ROWED (owner, 2026-09-17: "I really want to
 * emphasise the post hoc analysis screen"). Everything the review screen
 * prints is worked out here: the splits, the halves, the trends, the
 * average force curve, how the piece ranks against the ones already saved
 * to this account, and the sentences that say all of it in English.
 *
 * PURE. No React, no database, no DOM, no Date.now — one document in
 * (plus the account's other rows, when the page has them), one Analysis
 * out. That is what lets the scratchpad check run the whole thing without
 * a server, and what keeps the screen itself down to markup.
 *
 * HONEST. The sentence generator never invents a comparison it does not
 * have: with nothing else saved at this distance it says so instead of
 * claiming a rank, and with too few strokes to measure it says that too.
 * Nothing here writes a training plan; it reports what moved.
 *
 * NO HEART RATE (owner, 2026-09-17: no belt this month). The documents
 * still carry it and the parser still reads it — nothing in this file
 * looks at it.
 *
 * UNITS. The document is integers the way the monitor sends them, so the
 * arithmetic here is too: TENTHS of a second per 500 m for every split
 * and pace, tenths of a second for a clock, metres, whole watts, joules
 * for work, centimetres for drive length, pounds of force for a curve. */

/* ---- the shapes ------------------------------------------------------ */

export type AnalysisStroke = {
  n: number;
  elapsedS: number;
  distanceM: number;
  /* Tenths of a second per 500 m: the monitor's own figure under the
   * stroke when it sent one, else the distance and time since the stroke
   * before it. */
  paceTenths: number | null;
  spm: number | null;
  mps: number | null;
  workJ: number | null;
  driveS: number | null;
  recoveryS: number | null;
  driveLengthCm: number | null;
  peakLbf: number | null;
  /* False when this is not a stroke of the piece — see COUNTED below. */
  counted: boolean;
};

export type AnalysisSplit = {
  n: number;
  /* Where the split ended, so a bar can be labelled by distance. */
  endMeters: number;
  meters: number;
  seconds: number;
  paceTenths: number | null;
  spm: number | null;
  watts: number | null;
  drag: number | null;
};

export type AnalysisTrend = {
  /* Change per stroke. */
  slope: number;
  /* The trend line read at the first and the last stroke. */
  first: number;
  last: number;
  mean: number;
};

export type AnalysisForce = {
  /* The average stroke of the piece, resampled to a common length. */
  points: number[];
  peakLbf: number;
  peakIndex: number;
  /* Where the peak sits along the drive, as a percentage. */
  peakPct: number;
  curves: number;
};

export type AnalysisRank = {
  rank: number;
  /* This piece included. */
  of: number;
  bestTenths: number;
  bestTitle: string;
  bestAt: string;
  /* This piece against the best OTHER piece: positive is slower. */
  deltaTenths: number;
};

export type AnalysisHalves = {
  firstPaceTenths: number;
  secondPaceTenths: number;
  /* Second half against first: negative is a negative split. */
  deltaTenths: number;
  negative: boolean;
  level: boolean;
};

export type AnalysisSteady = {
  paceMeanTenths: number | null;
  paceSdTenths: number | null;
  workMeanJ: number | null;
  workSdJ: number | null;
  /* How many strokes before the split stayed inside one standard
   * deviation for the rest of the piece, and which stroke that was. Null
   * when it never did, or when there is nothing to measure. */
  settle: { count: number; strokeN: number } | null;
  avgDriveLengthCm: number | null;
};

export type ErgAnalysis = {
  /* the head */
  device: string;
  simulated: boolean;
  startedAt: string;
  meters: number;
  tenths: number;
  clock: string;
  avgPaceTenths: number | null;
  strokes: number;
  avgSpm: number | null;
  avgWatts: number | null;
  dragFactor: number | null;
  recordedVia: string;
  packetsRecorded: number;
  packetsDropped: number;
  /* The console filled its buffers and dropped the front of the piece:
   * the ticks and strokes below begin at this elapsed second, while the
   * totals still describe the whole row. Null when the whole thing is
   * here. */
  headTrimmedFromS: number | null;
  /* What the save left out to get under the byte cap, when it left
   * anything out. */
  thinned: string | null;
  /* the strip */
  metresPerStroke: number | null;
  workPerStrokeJ: number | null;
  driveRecovery: { driveS: number; recoveryS: number; ratio: number } | null;
  /* the splits */
  splits: AnalysisSplit[];
  splitsDerived: boolean;
  /* Where derived bars begin, when the tick stream starts part-way into
   * the piece; 0 when they start at the start. */
  splitsFromMeters: number;
  avgSplitTenths: number | null;
  fastestSplit: AnalysisSplit | null;
  slowestSplit: AnalysisSplit | null;
  /* the shape of it */
  halves: AnalysisHalves | null;
  /* Every stroke in the document. The figures above and below are worked
   * out from the counted ones only. */
  series: AnalysisStroke[];
  strokesCounted: number;
  strokesSetAside: number;
  rateTrend: AnalysisTrend | null;
  mpsTrend: AnalysisTrend | null;
  workTrend: AnalysisTrend | null;
  steady: AnalysisSteady;
  force: AnalysisForce | null;
  compare: { title: string; force: AnalysisForce } | null;
  rank: AnalysisRank | null;
  /* the English */
  read: string[];
  next: string[];
};

export type AnalysisInput = {
  doc: TelemetryDoc;
  /* The row this document was loaded as, when there is one: its id keeps
   * the piece from being ranked against itself. */
  id?: string | null;
  /* Everything else saved to this account, for the rank. */
  history?: TelemetrySavedRow[];
  /* The best comparable piece, loaded whole, for the force curve behind
   * this one. */
  compare?: { title: string; doc: TelemetryDoc } | null;
};

/* ---- small arithmetic ------------------------------------------------ */

const num = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

function meanOf(values: (number | null | undefined)[]): number | null {
  let sum = 0;
  let n = 0;
  for (const v of values) {
    if (!num(v)) continue;
    sum += v;
    n++;
  }
  return n ? sum / n : null;
}

/* Population standard deviation: this is the whole piece, not a sample of
 * it. Needs three strokes before it means anything. */
function sdOf(values: (number | null | undefined)[]): number | null {
  const kept = values.filter(num) as number[];
  if (kept.length < 3) return null;
  const m = kept.reduce((a, b) => a + b, 0) / kept.length;
  const v = kept.reduce((a, b) => a + (b - m) * (b - m), 0) / kept.length;
  return Math.sqrt(v);
}

/* Least squares through the strokes, read at each end. */
function trendOf(points: { x: number; y: number }[]): AnalysisTrend | null {
  if (points.length < 3) return null;
  const n = points.length;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
    sxx += p.x * p.x;
    sxy += p.x * p.y;
  }
  const denom = n * sxx - sx * sx;
  if (!denom) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  const x0 = points[0].x;
  const x1 = points[points.length - 1].x;
  return { slope, first: intercept + slope * x0, last: intercept + slope * x1, mean: sy / n };
}

export function ordinal(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  const d = n % 10;
  return `${n}${d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th"}`;
}

/* A gap in tenths as something to read: seconds under a minute, a clock
 * over one. */
export function fmtGap(tenths: number): string {
  const t = Math.abs(Math.round(tenths));
  return t < 600 ? `${(t / 10).toFixed(1)} s` : fmtTenths(t);
}

/* Tenths of a second per 500 m as a split. */
export function fmtSplit(tenths: number | null | undefined): string {
  return num(tenths) && tenths > 0 ? fmtTenths(Math.round(tenths)) : "—";
}

export function fmtDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

/* ---- the strokes ----------------------------------------------------- */

/* COUNTED. A PM5 that is sitting between pieces, or that has been
 * stopped mid-row and started again, keeps sending stroke packets: the
 * 1,015 m saved off erg 530724321 has ten of them at 95 to 153 strokes a
 * minute, 1.2 m and 17 J. Nobody rowed those. They are not thrown away —
 * they stay in the document and in this series — but a stroke outside a
 * human rate band, or with no drive to speak of, is left out of the
 * averages, the standard deviations and the trends, and the screen says
 * how many it left out. Without that one rule a ten-stroke dropout turns
 * a level piece into a sentence about work per stroke climbing 60%.
 *
 * The band is deliberately wide: 10 to 60 strokes a minute takes in
 * everything from a paddle to a racing start, and 20 cm of drive is a
 * tenth of a real one. */
const RATE_LO = 10;
const RATE_HI = 60;
const DRIVE_MIN_CM = 20;

/* One row per stroke with the two figures the document leaves implied:
 * the split under the stroke and how far the boat went on it. A thinned
 * document is handled by dividing by the stroke numbers, not by assuming
 * every stroke is there. */
export function strokeSeries(strokes: TelemetryStroke[]): AnalysisStroke[] {
  const out: AnalysisStroke[] = [];
  let prev: TelemetryStroke | null = null;
  for (const s of strokes) {
    const gap = prev ? Math.max(1, s.n - prev.n) : 1;
    const dd = prev ? (s.distanceTenths - prev.distanceTenths) / 10 : 0;
    const dt = prev ? (s.elapsedHundredths - prev.elapsedHundredths) / 100 : 0;
    const pace = s.pace && s.pace > 0 ? Math.round(s.pace / 10) : dd > 0 && dt > 0 ? Math.round((dt / dd) * 5000) : null;
    const spm = s.spm > 0 ? s.spm : null;
    const driveLengthCm = s.driveLengthCm > 0 ? s.driveLengthCm : null;
    out.push({
      n: s.n,
      elapsedS: s.elapsedHundredths / 100,
      distanceM: s.distanceTenths / 10,
      paceTenths: pace,
      spm,
      mps: dd > 0 ? dd / gap : null,
      workJ: s.workTenthsJ > 0 ? s.workTenthsJ / 10 : null,
      driveS: s.driveTimeHundredths > 0 ? s.driveTimeHundredths / 100 : null,
      recoveryS: s.recoveryTimeHundredths > 0 ? s.recoveryTimeHundredths / 100 : null,
      driveLengthCm,
      peakLbf: s.peakForceTenthsLbf > 0 ? s.peakForceTenthsLbf / 10 : null,
      counted: spm !== null && spm >= RATE_LO && spm <= RATE_HI && (driveLengthCm === null || driveLengthCm >= DRIVE_MIN_CM),
    });
    prev = s;
  }
  return out;
}

/* THE SETTLE. The first stroke after which the split never leaves the
 * one-standard-deviation band again. Null when the piece never settles,
 * or when there are too few strokes to have a band at all. */
export function settleStroke(series: AnalysisStroke[]): { count: number; strokeN: number } | null {
  const kept = series.filter((s) => s.counted && num(s.paceTenths));
  const values = kept.map((s) => s.paceTenths as number);
  const sd = sdOf(values);
  const mean = meanOf(values);
  if (sd === null || mean === null) return null;
  /* Walk back from the end: the answer is one past the last stroke that
   * broke the band. */
  let k = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    if (Math.abs(values[i] - mean) > sd) {
      k = i + 1;
      break;
    }
  }
  if (k >= values.length) return null;
  return { count: k, strokeN: kept[k].n };
}

/* ---- the splits ------------------------------------------------------ */

/* As the monitor recorded them. A split with neither distance nor time is
 * the monitor clearing its slate and is dropped. */
function monitorSplits(doc: TelemetryDoc): AnalysisSplit[] {
  const out: AnalysisSplit[] = [];
  let prevElapsed = 0;
  let prevDistance = 0;
  for (const s of doc.splits) {
    const a = s.a;
    const b = s.b;
    const meters = a && a.splitDistanceM > 0 ? a.splitDistanceM : a ? a.distanceM - prevDistance : 0;
    const seconds = a && a.splitTimeS > 0 ? a.splitTimeS : a ? a.elapsedS - prevElapsed : 0;
    if (!(meters > 0) || !(seconds > 0)) continue;
    const paceTenths = b && b.avgPaceS > 0 ? Math.round(b.avgPaceS * 10) : derivePaceTenths(meters, Math.round(seconds * 10));
    out.push({
      n: s.n,
      endMeters: a ? Math.round(a.distanceM) : Math.round(prevDistance + meters),
      meters: Math.round(meters),
      seconds,
      paceTenths,
      spm: b && b.avgStrokeRate > 0 ? b.avgStrokeRate : null,
      watts: b && b.powerW > 0 ? b.powerW : null,
      drag: b && b.avgDragFactor > 0 ? b.avgDragFactor : null,
    });
    if (a) {
      prevElapsed = a.elapsedS;
      prevDistance = a.distanceM;
    }
  }
  return out;
}

/* A split size that gives a piece somewhere between four and twenty bars. */
function splitSize(meters: number): number {
  for (const size of [1000, 500, 250, 100, 50, 25]) {
    if (meters / size >= 4) return size;
  }
  return Math.max(25, Math.round(meters / 4));
}

/* WHEN THE MONITOR SENT NO SPLITS — a piece rowed as Just Row, or a
 * connection that came up late — the same bars are cut out of the tick
 * stream by distance. They are marked derived wherever they are printed;
 * they are arithmetic on the samples, not the monitor's own figures. */
/* THE WALK STARTS WHERE THE RECORDING DOES, not at zero. A console paired
 * at 4,200 m has a tick stream that begins there, and measuring the first
 * split from an imaginary 0 m gave it every second of a row it never saw:
 * one bar of 25:00 for a thousand metres, printed under a heading that
 * only warned about the method. So the first mark is the next round number
 * past the first tick, the caller is told where the bars begin, and the
 * screen says so. */
function derivedSplits(doc: TelemetryDoc): { splits: AnalysisSplit[]; fromMeters: number } {
  const none = { splits: [] as AnalysisSplit[], fromMeters: 0 };
  const track = doc.samples
    .map((s) => ({ t: s.elapsedHundredths / 100, d: s.distanceTenths / 10 }))
    .filter((p) => p.t >= 0 && p.d >= 0);
  if (track.length < 3) return none;
  const total = Math.max(...track.map((p) => p.d));
  if (!(total > 0)) return none;
  const size = splitSize(total);
  const out: AnalysisSplit[] = [];
  const start = track[0];
  let prevT = start.t;
  let prevD = start.d;
  let n = 1;
  for (let mark = (Math.floor(start.d / size) + 1) * size; prevD < total - 1; mark += size) {
    const target = Math.min(mark, total);
    const t = timeAt(track, target);
    if (t === null || !(t > prevT)) break;
    const meters = target - prevD;
    const seconds = t - prevT;
    if (meters > 0 && seconds > 0) {
      out.push({
        n: n++,
        endMeters: Math.round(target),
        meters: Math.round(meters),
        seconds,
        paceTenths: derivePaceTenths(meters, Math.round(seconds * 10)),
        spm: null,
        watts: null,
        drag: null,
      });
    }
    prevT = t;
    prevD = target;
    if (target >= total) break;
  }
  return { splits: out, fromMeters: out.length ? start.d : 0 };
}

/* The elapsed time at a distance, straight off the tick stream with one
 * step of interpolation. Null past the end of the piece — and null BEFORE
 * the start of it: a stream that begins at 4,200 m knows nothing about
 * 1,000 m, and answering with its own first tick would pass the whole
 * unrecorded part of the row off as time spent covering that distance. */
function timeAt(track: { t: number; d: number }[], meters: number): number | null {
  if (!track.length || meters < track[0].d) return null;
  let prev: { t: number; d: number } | null = null;
  for (const p of track) {
    if (p.d >= meters) {
      if (!prev || p.d === prev.d) return p.t;
      const f = (meters - prev.d) / (p.d - prev.d);
      return prev.t + f * (p.t - prev.t);
    }
    if (!prev || p.d >= prev.d) prev = p;
  }
  return null;
}

/* ---- the halves ------------------------------------------------------ */

function halvesOf(doc: TelemetryDoc, series: AnalysisStroke[]): AnalysisHalves | null {
  const fromSamples = doc.samples.map((s) => ({ t: s.elapsedHundredths / 100, d: s.distanceTenths / 10 }));
  const fromStrokes = series.map((s) => ({ t: s.elapsedS, d: s.distanceM }));
  const track = (fromSamples.length >= 4 ? fromSamples : fromStrokes).filter((p) => p.t > 0 && p.d > 0);
  if (track.length < 4) return null;
  const totalD = Math.max(...track.map((p) => p.d));
  const totalT = Math.max(...track.map((p) => p.t));
  if (!(totalD > 0) || !(totalT > 0)) return null;
  const half = totalD / 2;
  const tHalf = timeAt(track, half);
  if (tHalf === null || !(tHalf > 0) || !(totalT > tHalf)) return null;
  const firstPaceTenths = Math.round((tHalf / half) * 5000);
  const secondPaceTenths = Math.round(((totalT - tHalf) / (totalD - half)) * 5000);
  const deltaTenths = secondPaceTenths - firstPaceTenths;
  return { firstPaceTenths, secondPaceTenths, deltaTenths, negative: deltaTenths < 0, level: Math.abs(deltaTenths) < 5 };
}

/* ---- the force curve ------------------------------------------------- */

const CURVE_POINTS = 32;

/* THE AVERAGE STROKE of a piece. Every curve is a different length — the
 * monitor sends as many points as the drive took — so each one is
 * stretched onto the same 32 positions along its own drive and then they
 * are averaged. That makes the x axis a PERCENTAGE OF THE DRIVE, which is
 * what lets two pieces be drawn over each other. */
export function averageForceCurve(curves: TelemetryCurve[]): AnalysisForce | null {
  const usable = curves.filter((c) => c.points.length >= 3 && c.points.some((p) => p > 0));
  if (!usable.length) return null;
  const acc = new Array(CURVE_POINTS).fill(0) as number[];
  for (const c of usable) {
    const pts = c.points;
    const last = pts.length - 1;
    for (let i = 0; i < CURVE_POINTS; i++) {
      const x = (i / (CURVE_POINTS - 1)) * last;
      const lo = Math.floor(x);
      const hi = Math.min(last, lo + 1);
      const f = x - lo;
      acc[i] += pts[lo] * (1 - f) + pts[hi] * f;
    }
  }
  const points = acc.map((v) => v / usable.length);
  let peakIndex = 0;
  for (let i = 1; i < points.length; i++) if (points[i] > points[peakIndex]) peakIndex = i;
  return {
    points,
    peakLbf: points[peakIndex],
    peakIndex,
    peakPct: (peakIndex / (CURVE_POINTS - 1)) * 100,
    curves: usable.length,
  };
}

/* ---- the rank -------------------------------------------------------- */

/* Same distance means within a percent, or ten metres, whichever is
 * kinder: a 2,000 m that reads 1,998 is the same piece. */
export function sameDistance(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(10, a * 0.01);
}

/* LIKE WITH LIKE. A simulated piece is ranked against simulated pieces
 * and a rowed one against rowed ones, so a demo can never take the top of
 * a real board. */
export function comparableRows(doc: TelemetryDoc, history: TelemetrySavedRow[], id?: string | null): TelemetrySavedRow[] {
  return history
    .filter((r) => r.id !== id && r.simulated === doc.device.simulated && r.tenths > 0 && sameDistance(doc.totals.meters, r.meters))
    .sort((a, b) => a.tenths - b.tenths);
}

function rankOf(doc: TelemetryDoc, others: TelemetrySavedRow[]): AnalysisRank | null {
  if (!others.length || !(doc.totals.tenths > 0)) return null;
  const best = others[0];
  return {
    rank: 1 + others.filter((r) => r.tenths < doc.totals.tenths).length,
    of: others.length + 1,
    bestTenths: best.tenths,
    bestTitle: best.title,
    bestAt: best.startedAt,
    deltaTenths: doc.totals.tenths - best.tenths,
  };
}

/* ---- the English ----------------------------------------------------- */

/* THE READ: how it ranks, how it was paced, and the one thing that moved
 * through the piece. Three sentences, or two when there is no piece to
 * compare it against and nothing moved. */
function readSentences(a: Omit<ErgAnalysis, "read" | "next">): string[] {
  const out: string[] = [];
  const dist = fmtMeters(a.meters);
  const kind = a.simulated ? "simulated " : "";

  if (!a.rank) {
    out.push(`Nothing else ${kind}at ${dist} is saved to this account, so there is no rank to give this one — it is the mark the next one gets read against.`);
  } else if (a.rank.rank === 1) {
    out.push(`Fastest ${kind}${dist} saved here: ${a.clock}, ${fmtGap(a.rank.deltaTenths)} up on the next one (${a.rank.bestTitle}, ${fmtTenthsClock(a.rank.bestTenths)} on ${fmtDay(a.rank.bestAt)}).`);
  } else {
    out.push(`${ordinal(a.rank.rank)} fastest of the ${a.rank.of} ${kind}${dist} pieces saved here: ${a.clock}, ${fmtGap(a.rank.deltaTenths)} off the best (${fmtTenthsClock(a.rank.bestTenths)} on ${fmtDay(a.rank.bestAt)}).`);
  }

  if (!a.halves) {
    out.push("Too little of the piece came through to compare its halves, so there is nothing to say about how it was paced.");
  } else if (a.halves.level) {
    out.push(`Dead level: the two halves came in within ${fmtGap(a.halves.deltaTenths)} per 500 m of each other, ${fmtSplit(a.halves.firstPaceTenths)} against ${fmtSplit(a.halves.secondPaceTenths)}.`);
  } else if (a.halves.negative) {
    out.push(`Negative split — the back half ran ${fmtGap(a.halves.deltaTenths)} per 500 m faster than the front, ${fmtSplit(a.halves.firstPaceTenths)} into ${fmtSplit(a.halves.secondPaceTenths)}.`);
  } else {
    out.push(`Positive split — the back half cost ${fmtGap(a.halves.deltaTenths)} per 500 m, ${fmtSplit(a.halves.firstPaceTenths)} out to ${fmtSplit(a.halves.secondPaceTenths)}.`);
  }

  const moved = movedSentence(a);
  if (moved) out.push(moved);
  return out;
}

/* The one thing that changed through the piece. Work per stroke first
 * when it moved by more than a twentieth, then rate against length, and
 * when neither moved it says so rather than reaching. */
function movedSentence(a: Omit<ErgAnalysis, "read" | "next">): string | null {
  const w = a.workTrend;
  const r = a.rateTrend;
  const m = a.mpsTrend;
  if (w && w.mean > 0 && Math.abs(w.last - w.first) / w.mean >= 0.05) {
    const fell = w.last < w.first;
    return `Work per stroke ${fell ? "fell away" : "climbed"} through the piece, ${w.first.toFixed(0)} J at the start against ${w.last.toFixed(0)} J at the end.`;
  }
  const dSpm = r ? r.last - r.first : 0;
  const dMps = m ? m.last - m.first : 0;
  if (r && m && Math.abs(dSpm) >= 1 && dMps <= -0.05) {
    return `Rate went ${r.first.toFixed(1)} to ${r.last.toFixed(1)} while the stroke shortened ${m.first.toFixed(2)} m to ${m.last.toFixed(2)} m — the same boat speed bought with more strokes.`;
  }
  if (r && Math.abs(dSpm) >= 1) {
    return `Rate ${dSpm > 0 ? "climbed" : "came down"} through the piece, ${r.first.toFixed(1)} to ${r.last.toFixed(1)} strokes a minute.`;
  }
  if (m && Math.abs(dMps) >= 0.05) {
    return `The stroke ${dMps < 0 ? "shortened" : "lengthened"} through the piece, ${m.first.toFixed(2)} m to ${m.last.toFixed(2)} m, at much the same rate.`;
  }
  if (r || m || w) return "Nothing much moved through the piece: rate, stroke length and work per stroke all held inside a few percent.";
  return null;
}

/* WHAT NEXT: pacing, rate against length, and how steady it was. Read off
 * the same numbers as THE READ — no plan, no week, nothing the piece did
 * not show. */
function nextSentences(a: Omit<ErgAnalysis, "read" | "next">): string[] {
  const out: string[] = [];

  if (!a.halves) {
    out.push("There is not enough of this piece recorded to say how it was paced — connect before the first stroke and the next one will have it.");
  } else if (a.halves.level) {
    out.push("Pacing is not the thing to work on here: the halves came in level, so the time is in the boat speed, not in how it was spent.");
  } else if (a.halves.negative) {
    out.push(`The negative split says the front half had room. Start ${fmtGap(a.halves.deltaTenths / 2)} per 500 m nearer the average and the same finish is a faster piece.`);
  } else {
    out.push(`Take the first half out ${fmtGap(a.halves.deltaTenths / 2)} per 500 m slower. This one gave back ${fmtGap(a.halves.deltaTenths)} per 500 m over the second half, which is the cheapest time on the board.`);
  }

  const r = a.rateTrend;
  const m = a.mpsTrend;
  const dSpm = r ? r.last - r.first : 0;
  const dMps = m ? m.last - m.first : 0;
  if (r && m && dSpm >= 1 && dMps <= -0.05) {
    out.push(`Rate climbed ${r.first.toFixed(1)} to ${r.last.toFixed(1)} while the stroke went ${m.first.toFixed(2)} m to ${m.last.toFixed(2)} m. Holding the rate where it started and rowing the length back is the same speed for less work.`);
  } else if (m && dMps <= -0.05) {
    out.push(`The stroke shortened ${m.first.toFixed(2)} m to ${m.last.toFixed(2)} m at much the same rate — length is what slipped, and it is what to hold next time.`);
  } else if (r && m && dSpm <= -1 && dMps >= 0) {
    out.push(`Rate came down ${r.first.toFixed(1)} to ${r.last.toFixed(1)} and the stroke held at ${m.last.toFixed(2)} m, so the length is there to rate up on.`);
  } else if (r || m) {
    out.push("Rate and stroke length both held inside a few percent, so there is nothing to chase there — the next piece can go at it a beat higher.");
  } else {
    out.push("There are not enough strokes on this one to say anything about rate or stroke length.");
  }

  const sd = a.steady.paceSdTenths;
  const mean = a.steady.paceMeanTenths;
  if (sd === null || mean === null) {
    out.push("Too few strokes came through to measure how steady it was.");
  } else {
    const settle = a.steady.settle;
    const tail = settle === null ? "and it never settled inside that band" : settle.count === 0 ? "and it was inside that band from the first stroke" : `and it took ${settle.count} strokes to settle inside it`;
    const verdict = sd <= 15 ? " That is steady rowing." : sd >= 40 ? " That is a wide band — the split is worth watching stroke to stroke." : "";
    out.push(`Stroke to stroke the split moved ${fmtGap(sd)} either side of ${fmtSplit(Math.round(mean))}, ${tail}.${verdict}`);
  }
  return out;
}

/* ---- the whole thing ------------------------------------------------- */

export function analyseSession(input: AnalysisInput): ErgAnalysis {
  const { doc } = input;
  const t = doc.totals;
  const series = strokeSeries(doc.strokes);
  /* Everything below reads COUNTED strokes only — see the note above
   * strokeSeries. The full series stays on the analysis so a screen can
   * still print how many strokes the document holds. */
  const counted = series.filter((s) => s.counted);

  const monitor = monitorSplits(doc);
  const splitsDerived = monitor.length < 2;
  const derived = splitsDerived ? derivedSplits(doc) : null;
  const splits = derived ? derived.splits : monitor;
  const paces = splits.map((s) => s.paceTenths).filter(num) as number[];
  const avgSplitTenths = t.avgPaceTenths ?? (paces.length ? Math.round(meanOf(paces) as number) : derivePaceTenths(t.meters, t.tenths));

  let fastestSplit: AnalysisSplit | null = null;
  let slowestSplit: AnalysisSplit | null = null;
  for (const s of splits) {
    if (!num(s.paceTenths)) continue;
    if (!fastestSplit || s.paceTenths < (fastestSplit.paceTenths as number)) fastestSplit = s;
    if (!slowestSplit || s.paceTenths > (slowestSplit.paceTenths as number)) slowestSplit = s;
  }

  const drive = meanOf(counted.map((s) => s.driveS));
  const recovery = meanOf(counted.map((s) => s.recoveryS));
  const workMeanJ = meanOf(counted.map((s) => s.workJ));
  const paceValues = counted.map((s) => s.paceTenths);

  const others = comparableRows(doc, input.history ?? [], input.id);

  const body: Omit<ErgAnalysis, "read" | "next"> = {
    device: doc.device.name,
    simulated: doc.device.simulated,
    startedAt: doc.startedAt,
    meters: t.meters,
    tenths: t.tenths,
    clock: fmtTenthsClock(t.tenths),
    avgPaceTenths: t.avgPaceTenths ?? derivePaceTenths(t.meters, t.tenths),
    strokes: t.strokes,
    avgSpm: t.avgSpm,
    avgWatts: t.avgWatts,
    dragFactor: t.dragFactor,
    recordedVia: doc.device.simulated ? "Simulated piece" : "PM5 over Bluetooth",
    packetsRecorded: doc.notes.packetsRecorded,
    packetsDropped: doc.notes.packetsDropped,
    headTrimmedFromS: doc.notes.headTrimmedFromS ?? null,
    thinned: doc.notes.thinned ?? null,
    metresPerStroke: t.strokes > 0 && t.meters > 0 ? t.meters / t.strokes : meanOf(counted.map((s) => s.mps)),
    workPerStrokeJ: workMeanJ,
    driveRecovery: num(drive) && num(recovery) && drive > 0 ? { driveS: drive, recoveryS: recovery, ratio: recovery / drive } : null,
    splits,
    splitsDerived,
    splitsFromMeters: derived ? derived.fromMeters : 0,
    avgSplitTenths,
    fastestSplit,
    slowestSplit,
    halves: halvesOf(doc, series),
    series,
    strokesCounted: counted.length,
    strokesSetAside: series.length - counted.length,
    rateTrend: trendOf(counted.filter((s) => num(s.spm)).map((s) => ({ x: s.n, y: s.spm as number }))),
    mpsTrend: trendOf(counted.filter((s) => num(s.mps)).map((s) => ({ x: s.n, y: s.mps as number }))),
    workTrend: trendOf(counted.filter((s) => num(s.workJ)).map((s) => ({ x: s.n, y: s.workJ as number }))),
    steady: {
      paceMeanTenths: meanOf(paceValues),
      paceSdTenths: sdOf(paceValues),
      workMeanJ,
      workSdJ: sdOf(counted.map((s) => s.workJ)),
      settle: settleStroke(series),
      avgDriveLengthCm: meanOf(counted.map((s) => s.driveLengthCm)),
    },
    force: averageForceCurve(doc.forceCurves),
    compare: null,
    rank: rankOf(doc, others),
  };

  if (input.compare) {
    const force = averageForceCurve(input.compare.doc.forceCurves);
    if (force) body.compare = { title: input.compare.title, force };
  }

  return { ...body, read: readSentences(body), next: nextSentences(body) };
}
