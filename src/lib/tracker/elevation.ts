/**
 * Route elevation (owner, 2026-10-15: elevation on the story stickers and
 * the runner cards). Every elevation number in the snapshot is read off ONE
 * precomputed curve per route — the cumulative positive gain along it — so
 * "gain between two progress values" is two lookups and a subtraction, the
 * same trick as the progress series (computeSeries.ts).
 *
 * Gain = the sum of the positive differences between consecutive route
 * points, with ELEVATION_RULES.hysteresisM of hysteresis: a rise only counts
 * once it has climbed that much past the last counted level, and a fall only
 * resets the level once it has dropped that much. A steady 0.5 m per point
 * climb still counts in full (it accumulates past the threshold); the ±0.4 m
 * jitter of a GPX recorded on a phone counts for nothing. A climb may end
 * under the threshold short of its true top — under 1 m per climb, by design.
 *
 * Pure and isomorphic. The curve is cached per RouteIndex object in a
 * WeakMap, so snapshot.ts's per-process route cache gets it for free on every
 * build after the first (O(n) once per route, ~10k points for 215 km).
 */

import type { RouteIndex } from "./types";

export const ELEVATION_RULES = {
  /** A rise or fall smaller than this (metres) between counted levels is noise. */
  hysteresisM: 1,
} as const;

/** `gain[i]` = metres climbed from the route start to point i. */
export function cumulativeGain(route: RouteIndex, hysteresisM: number = ELEVATION_RULES.hysteresisM): Float64Array {
  const n = route.eleM.length;
  const gain = new Float64Array(n);
  if (n === 0) return gain;
  let ref = route.eleM[0];
  let acc = 0;
  for (let i = 1; i < n; i++) {
    const e = route.eleM[i];
    const d = e - ref;
    if (d >= hysteresisM) {
      acc += d;
      ref = e;
    } else if (d <= -hysteresisM) {
      ref = e;
    }
    gain[i] = acc;
  }
  return gain;
}

const gainCache = new WeakMap<RouteIndex, Float64Array>();

/** The route's gain curve, computed once per RouteIndex object. */
export function routeGain(route: RouteIndex): Float64Array {
  let g = gainCache.get(route);
  if (!g) {
    g = cumulativeGain(route);
    gainCache.set(route, g);
  }
  return g;
}

/** Metres climbed from the start to `m` metres along the route, interpolated between points. */
export function gainAtRouteM(route: RouteIndex, gain: Float64Array, m: number): number {
  const n = gain.length;
  if (n === 0 || !(m > 0)) return 0;
  const { cumM } = route;
  if (m >= cumM[n - 1]) return gain[n - 1];
  // First i with cumM[i] >= m (i >= 1 because m > 0 = cumM[0]).
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumM[mid] < m) lo = mid + 1;
    else hi = mid;
  }
  if (lo === 0) return gain[0];
  const a = lo - 1;
  const span = cumM[lo] - cumM[a];
  const t = span > 0 ? (m - cumM[a]) / span : 1;
  return gain[a] + (gain[lo] - gain[a]) * t;
}

/** Metres climbed between two progress values; 0 when `toM` is not past `fromM`. */
export function gainBetween(route: RouteIndex, gain: Float64Array, fromM: number, toM: number): number {
  if (!(toM > fromM)) return 0;
  return Math.max(0, gainAtRouteM(route, gain, toM) - gainAtRouteM(route, gain, fromM));
}

/** A `(fromM, toM) → metres climbed` closure over the route's cached curve. */
export function climbFn(route: RouteIndex): (fromM: number, toM: number) => number {
  const gain = routeGain(route);
  return (fromM, toM) => gainBetween(route, gain, fromM, toM);
}
