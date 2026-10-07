/**
 * The ETA estimator (TRACKER_SPEC.md §9 "ETA"), kept behind ONE function so
 * it can be swapped per event kind later (multi-day pacing for a Moab-style
 * solo is phase 6). compute.ts calls `estimateEta` once per entry for the
 * finish and reuses the pace it chose for every upcoming checkpoint, so one
 * build never mixes two paces for one entry.
 *
 * v1 (spec, decided 2026-10-06):
 *   pace   = 0.7 × wall-clock pace over the entry's LAST 10 MILES of
 *            progress (from the instant progress was progress − 10 mi to the
 *            latest sample; when progress is under 10 mi, since the first
 *            sample) + 0.3 × whole-event pace (elapsed ÷ progress)
 *   finish = as-of + remaining × pace
 *   window = ± max(10 min, 5 % of the remaining TIME)
 *   no ETA while progress < 1 km.
 *
 * Pure: no clock, no I/O. Times are epoch ms in, Dates out.
 */

import { MI } from "./format";
import { timeAtProgress, type ProgressSeries } from "./computeSeries";

export const ETA_RULES = {
  /** No estimate before this much progress (metres). */
  minProgressM: 1000,
  /** The "recent pace" window (metres): 10 miles. */
  recentWindowM: 10 * MI,
  /** Weight of the recent pace; the whole-event pace gets the rest. */
  recentWeight: 0.7,
  /** The window is never narrower than this (seconds)… */
  minWindowS: 10 * 60,
  /** …or than this fraction of the remaining time. */
  windowFraction: 0.05,
} as const;

export interface EtaInput {
  progressSeries: ProgressSeries;
  progressM: number;
  remainingM: number;
  asOf: Date;
  startTime: Date;
}

export interface EtaEstimate {
  finish: Date | null;
  earliest: Date | null;
  latest: Date | null;
  /** The blended pace the estimate used (s/km, unrounded); null when there is none. */
  pace_s_per_km: number | null;
}

export const NO_ETA: EtaEstimate = { finish: null, earliest: null, latest: null, pace_s_per_km: null };

/** The two component paces, exposed for tests and the dev stats. */
export interface PaceParts {
  recent: number | null;
  whole: number | null;
  blended: number | null;
}

/**
 * Blend the recent and whole-event paces (s/km). Either component may be
 * missing (a one-sample series has no recent pace; an as-of before the
 * start has no whole-event pace), in which case the other stands alone.
 */
export function etaPaceParts(series: ProgressSeries, progressM: number, asOf: Date, startTime: Date): PaceParts {
  const none: PaceParts = { recent: null, whole: null, blended: null };
  if (!(progressM >= ETA_RULES.minProgressM)) return none;
  const n = series.t.length;
  if (n === 0) return none;

  const tLast = series.t[n - 1];
  let recent: number | null = null;
  if (progressM >= ETA_RULES.recentWindowM) {
    const t0 = timeAtProgress(series, progressM - ETA_RULES.recentWindowM);
    if (t0 !== null && tLast > t0) recent = (tLast - t0) / 1000 / (ETA_RULES.recentWindowM / 1000);
  } else {
    const d = progressM - series.m[0];
    if (d > 0 && tLast > series.t[0]) recent = (tLast - series.t[0]) / 1000 / (d / 1000);
  }

  const elapsedS = (asOf.getTime() - startTime.getTime()) / 1000;
  const whole = elapsedS > 0 ? elapsedS / (progressM / 1000) : null;

  let blended: number | null;
  if (recent !== null && whole !== null) blended = ETA_RULES.recentWeight * recent + (1 - ETA_RULES.recentWeight) * whole;
  else blended = recent ?? whole;
  if (blended !== null && !(blended > 0 && Number.isFinite(blended))) blended = null;
  return { recent, whole, blended };
}

/** The blended pace alone (s/km), or null when there is not enough progress. */
export function etaPace(series: ProgressSeries, progressM: number, asOf: Date, startTime: Date): number | null {
  return etaPaceParts(series, progressM, asOf, startTime).blended;
}

/**
 * Arrival window for `remainingM` more metres at `paceSPerKm`, from `asOf`.
 * Used for the finish and for every upcoming checkpoint alike.
 */
export function etaWindow(remainingM: number, paceSPerKm: number, asOf: Date): { finish: Date; earliest: Date; latest: Date } {
  const remainingS = (Math.max(0, remainingM) / 1000) * paceSPerKm;
  const finishMs = asOf.getTime() + remainingS * 1000;
  const halfWidthMs = Math.max(ETA_RULES.minWindowS, ETA_RULES.windowFraction * remainingS) * 1000;
  return {
    finish: new Date(finishMs),
    earliest: new Date(finishMs - halfWidthMs),
    latest: new Date(finishMs + halfWidthMs),
  };
}

/** THE estimator. Swap this body (or dispatch on event kind) to change the model. */
export function estimateEta(input: EtaInput): EtaEstimate {
  const pace = etaPace(input.progressSeries, input.progressM, input.asOf, input.startTime);
  if (pace === null) return NO_ETA;
  return { ...etaWindow(input.remainingM, pace, input.asOf), pace_s_per_km: pace };
}
