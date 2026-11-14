import { TELEMETRY_SCHEMA, type TelemetryDoc } from "@/lib/pm5/session";

/* THE ROW AS A FUNCTION OF TIME (owner, 2026-11-13: "graphics for the daily
 * reel videos ... meters going up for that row ... my cumulative meters
 * traveled w/ the avg pace at that time, or just elapsed time").
 *
 * A reel clip is the saved piece squeezed into a few seconds, so every
 * painter asks the same question — what did the monitor read at second t —
 * and this file answers it from the saved document. NO DOM, NO REACT: the
 * vitest check imports it straight.
 *
 * Seconds, metres, seconds per 500 m. Nothing is invented: the metres are
 * the monitor's ticks joined by straight lines, the average pace is the
 * time over the distance at that moment, and watts are Concept2's own
 * 2.80 / (s/m)^3 when a tick carried none. */

export type ReelTick = { t: number; m: number; pace: number; spm: number; watts: number };

export type ReelStroke = {
  /* When the stroke's packet landed; the drive is the driveS before it. */
  t: number;
  n: number;
  driveS: number;
  /* The force curve, as the monitor sent it; null when thinned away. */
  points: number[] | null;
  peak: number;
  pace: number;
  watts: number;
};

export type ReelSeries = {
  /* Where the ticks begin: 0 unless the head of the piece was dropped. */
  startS: number;
  totalS: number;
  totalM: number;
  calories: number | null;
  ticks: ReelTick[];
  strokes: ReelStroke[];
  /* The scale every force curve is drawn against. */
  maxForce: number;
  maxPoints: number;
};

export type ReelFrame = {
  t: number;
  m: number;
  /* Seconds per 500 m right now, and averaged from the start. 0 = none yet. */
  pace: number;
  avgPace: number;
  spm: number;
  watts: number;
  /* Index into series.strokes of the stroke being pulled or last pulled, -1 before the first. */
  stroke: number;
  /* 0 → 1 through that stroke's drive; 1 once it is done. */
  drive: number;
};

export const wattsFromPace = (pace: number): number => (pace > 0 ? 2.8 / Math.pow(pace / 500, 3) : 0);
/* Concept2's calories an hour for a 175 lb rower: 4 x 0.8604 W + 300. */
export const calHrFromWatts = (w: number): number => (w > 0 ? w * 4 * 0.8604 + 300 : 0);

export function buildSeries(doc: TelemetryDoc): ReelSeries {
  const ticks: ReelTick[] = [];
  for (const s of doc.samples) {
    const t = s.elapsedHundredths / 100;
    const m = s.distanceTenths / 10;
    const last = ticks[ticks.length - 1];
    if (last && (t <= last.t || m < last.m)) continue;
    const pace = s.paceHundredths > 0 ? s.paceHundredths / 100 : 0;
    ticks.push({ t, m, pace, spm: s.spm, watts: s.watts ?? Math.round(wattsFromPace(pace)) });
  }
  /* A document with no status ticks still has its strokes. */
  if (ticks.length < 2) {
    ticks.length = 0;
    for (const s of doc.strokes) {
      const t = s.elapsedHundredths / 100;
      const last = ticks[ticks.length - 1];
      if (last && t <= last.t) continue;
      ticks.push({ t, m: s.distanceTenths / 10, pace: s.pace ? s.pace / 100 : 0, spm: s.spm, watts: s.watts });
    }
  }

  const trimmed = (doc.notes?.headTrimmedFromS ?? 0) > 0;
  if (!trimmed && (!ticks.length || ticks[0].t > 0)) {
    const first = ticks[0];
    ticks.unshift({ t: 0, m: 0, pace: first?.pace ?? 0, spm: first?.spm ?? 0, watts: first?.watts ?? 0 });
  }
  const lastTick = ticks[ticks.length - 1];
  const totalS = Math.max(lastTick?.t ?? 0, doc.totals.tenths / 10);
  const totalM = Math.max(lastTick?.m ?? 0, doc.totals.meters);
  /* The piece ends on the monitor's own totals, not on the last tick short of them. */
  if (lastTick && (lastTick.t < totalS || lastTick.m < totalM)) {
    if (lastTick.t < totalS) ticks.push({ ...lastTick, t: totalS, m: totalM });
    else lastTick.m = totalM;
  }

  const curves = new Map<number, number[]>();
  for (const c of doc.forceCurves) if (c.points.length > 1) curves.set(c.n, c.points);
  let maxForce = 0;
  let maxPoints = 0;
  const strokes: ReelStroke[] = doc.strokes.map((s) => {
    const points = curves.get(s.n) ?? null;
    if (points) {
      maxPoints = Math.max(maxPoints, points.length);
      for (const p of points) if (p > maxForce) maxForce = p;
    }
    const pace = s.pace ? s.pace / 100 : 0;
    return {
      t: s.elapsedHundredths / 100,
      n: s.n,
      driveS: s.driveTimeHundredths > 0 ? s.driveTimeHundredths / 100 : 0.7,
      points,
      peak: s.peakForceTenthsLbf / 10,
      pace,
      watts: s.watts || Math.round(wattsFromPace(pace)),
    };
  });

  return { startS: ticks[0]?.t ?? 0, totalS, totalM, calories: doc.totals.calories, ticks, strokes, maxForce, maxPoints };
}

/* The last index whose key is <= t, or -1. */
function before<T>(list: T[], t: number, key: (v: T) => number): number {
  let lo = 0;
  let hi = list.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (key(list[mid]) <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

export function frameAt(series: ReelSeries, at: number): ReelFrame {
  const t = Math.max(series.startS, Math.min(series.totalS, at));
  const { ticks, strokes } = series;
  const i = Math.max(0, before(ticks, t, (k) => k.t));
  const a = ticks[i] ?? { t: 0, m: 0, pace: 0, spm: 0, watts: 0 };
  const b = ticks[i + 1] ?? a;
  const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;
  const m = a.m + (b.m - a.m) * f;
  /* The tick the rower is heading into carries the pace of this stretch;
   * the first tick of a piece often carries none. */
  const pace = a.pace > 0 ? a.pace : b.pace;
  const avgPace = m > 10 && t > 2 ? (t / m) * 500 : pace;

  /* The stroke whose drive has begun. */
  const si = before(strokes, t, (s) => s.t - s.driveS);
  const st = si >= 0 ? strokes[si] : null;
  const drive = st ? Math.max(0, Math.min(1, (t - (st.t - st.driveS)) / st.driveS)) : 0;

  return { t, m, pace, avgPace, spm: a.spm || b.spm, watts: a.watts || b.watts || Math.round(wattsFromPace(pace)), stroke: si, drive };
}

/* Row time for a moment of the clip: the picked stretch of the row laid
 * evenly over the clip's length. */
export function rowTimeAt(clipS: number, lengthS: number, fromS: number, toS: number): number {
  if (!(lengthS > 0)) return toS;
  return fromS + (toS - fromS) * Math.max(0, Math.min(1, clipS / lengthS));
}

/* ---- a piece to try the page on, with no database ---------------------- */

/* LOCAL DEV ONLY (the page serves it at /erg/reel/sample outside
 * production): a 5 k at about 2:05 with a wobble, a tick a second, a stroke
 * every 2.4 s and a bell of a force curve. */
export function sampleDoc(): TelemetryDoc {
  const samples: TelemetryDoc["samples"] = [];
  const strokes: TelemetryDoc["strokes"] = [];
  const forceCurves: TelemetryDoc["forceCurves"] = [];
  let m = 0;
  let t = 0;
  let n = 0;
  let nextStroke = 1.2;
  while (m < 5000) {
    t += 1;
    const pace = 125 + 4 * Math.sin(t / 47) - (m > 4500 ? 6 : 0);
    m = Math.min(5000, m + 500 / pace);
    samples.push({ elapsedHundredths: t * 100, distanceTenths: Math.round(m * 10), paceHundredths: Math.round(pace * 100), avgPaceHundredths: Math.round((t / m) * 50000), spm: 24 + (m > 4500 ? 4 : 0), hr: null, watts: Math.round(wattsFromPace(pace)), drag: 118 });
    while (nextStroke <= t) {
      n++;
      const peak = 150 + 12 * Math.sin(n / 9);
      strokes.push({ n, elapsedHundredths: Math.round(nextStroke * 100), distanceTenths: Math.round(m * 10), watts: Math.round(wattsFromPace(pace)), spm: 24, hr: null, driveLengthCm: 138, driveTimeHundredths: 78, recoveryTimeHundredths: 162, peakForceTenthsLbf: Math.round(peak * 10), avgForceTenthsLbf: Math.round(peak * 6), workTenthsJ: 5200, pace: Math.round(pace * 100) });
      forceCurves.push({ n, points: Array.from({ length: 28 }, (_, i) => Math.round(peak * Math.pow(Math.sin((Math.PI * i) / 27), 0.8) * (1 - 0.25 * (i / 27)))) });
      nextStroke += 2.4;
    }
  }
  return {
    schema: TELEMETRY_SCHEMA,
    device: { name: "SIMULATED PM5", serial: "", simulated: true },
    startedAt: "2026-11-13T15:00:00.000Z",
    endedAt: null,
    workout: { type: 0, target: 5000, durationType: 0 },
    totals: { meters: 5000, tenths: t * 10, strokes: n, avgPaceTenths: Math.round((t / 5000) * 5000), avgWatts: 180, avgSpm: 24, avgHr: null, dragFactor: 118, calories: 310 },
    strokes,
    samples,
    splits: [],
    forceCurves,
    summary: { s39: null, s3a: null, s3c: null },
    notes: { packetsRecorded: 0, packetsDropped: 0 },
  };
}
