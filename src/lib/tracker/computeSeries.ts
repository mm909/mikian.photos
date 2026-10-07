/**
 * The progress series: every derived number in the tracker (legs, stats,
 * ETAs, gaps, checkpoint times) is read off this one curve.
 *
 * A series is the running MAXIMUM of accepted route_m, sampled at the time
 * of every accepted fix (TRACKER_SPEC.md §9 "Entry progress … never
 * decreases"). Two parallel Float64Arrays rather than an array of objects:
 * a 16 h relay is a few thousand samples and the ETA, gap and checkpoint
 * code binary-search it many times per build.
 *
 * Isomorphic and pure — shared by compute.ts, eta.ts, the tests and the
 * simulator.
 */

export interface ProgressSeries {
  /** Epoch milliseconds, strictly non-decreasing. */
  readonly t: Float64Array;
  /** Metres along the route, non-decreasing (a running max). */
  readonly m: Float64Array;
}

export const EMPTY_SERIES: ProgressSeries = { t: new Float64Array(0), m: new Float64Array(0) };

export function seriesFromSamples(t: ArrayLike<number>, m: ArrayLike<number>): ProgressSeries {
  if (t.length !== m.length) throw new Error("progress series: t and m differ in length");
  return { t: Float64Array.from(t), m: Float64Array.from(m) };
}

/** The entry's progress so far: the last sample, or 0 with no samples. */
export function lastProgress(s: ProgressSeries): number {
  const n = s.m.length;
  return n ? s.m[n - 1] : 0;
}

/** Time of the first accepted fix (the "start" checkpoint's passed_at), or null. */
export function firstSampleMs(s: ProgressSeries): number | null {
  return s.t.length ? s.t[0] : null;
}

/** First index i with a[i] >= v, or a.length when every value is smaller. */
function lowerBound(a: Float64Array, v: number): number {
  let lo = 0;
  let hi = a.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (a[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Progress at an exact instant: linear interpolation between the samples on
 * either side (spec §9 "Legs"). Before the first sample the entry has not
 * moved (0); after the last, it is wherever it was last seen.
 */
export function progressAt(s: ProgressSeries, tMs: number): number {
  const n = s.t.length;
  if (n === 0) return 0;
  if (tMs < s.t[0]) return 0;
  if (tMs >= s.t[n - 1]) return s.m[n - 1];
  const i = lowerBound(s.t, tMs); // s.t[i] >= tMs, and i >= 1 because tMs >= s.t[0]
  if (s.t[i] === tMs) return s.m[i];
  const a = i - 1;
  const span = s.t[i] - s.t[a];
  if (span <= 0) return s.m[i];
  return s.m[a] + ((s.m[i] - s.m[a]) * (tMs - s.t[a])) / span;
}

/**
 * The first instant the series reached `m` metres, interpolated between the
 * sample just short of it and the one at or past it. Null when progress has
 * not got there yet. A target at or below the first sample's progress is
 * "reached" at the first sample (the start checkpoint, route_m 0).
 *
 * Because the series is a running max the sample before the lower bound is
 * strictly less than `m`, so the interpolation never divides by zero.
 */
export function timeAtProgress(s: ProgressSeries, m: number): number | null {
  const n = s.m.length;
  if (n === 0) return null;
  if (m <= s.m[0]) return s.t[0];
  if (m > s.m[n - 1]) return null;
  const i = lowerBound(s.m, m); // s.m[i] >= m, i >= 1
  if (s.m[i] === m) {
    // Several samples may sit exactly at m (a stop); the FIRST of them is the crossing.
    return s.t[i];
  }
  const a = i - 1;
  const dm = s.m[i] - s.m[a];
  return s.t[a] + ((s.t[i] - s.t[a]) * (m - s.m[a])) / dm;
}
