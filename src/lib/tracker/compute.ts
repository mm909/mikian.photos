/**
 * The compute core (TRACKER_SPEC.md §9): positions + handoffs → the Snapshot
 * of §10, exactly the `Snapshot` type in types.ts.
 *
 * PURE on purpose: no database, no `server-only`, no clock. Everything it
 * needs arrives in ComputeInput and every instant is a Date it is handed, so
 * the unit tests, the snapshot builder (snapshot.ts) and the simulator run
 * the very same code. A full recompute on every build is the chosen design:
 * the on-course fixes of a 16 h relay are ~6/min, a few thousand samples,
 * which this walks in well under 50 ms. snapshot.ts loads only what this
 * reads: runner fixes inside their own on-course windows, baton fixes, and
 * the newest fix per device (`latestFix`) for the dot and the device checks.
 *
 * The semantics below were decided with the owner on 2026-10-06 and the
 * tests in compute.test.ts pin each one:
 *  1. Device time is the truth. Everything is ordered by fixTime; fixes and
 *     handoffs stamped after `asOf` do not exist yet (public delay).
 *  2. Who is on course: relay → the participant of the latest non-voided
 *     handoff at or before t; nobody before the first handoff. Solo → the
 *     one participant, from the event start. A second tap for the runner
 *     already on course (two crew phones, a replayed tap) is the same
 *     handoff, and two taps within 2 s are one exchange: the later runner
 *     at the earlier time.
 *  3. Progress advances ONLY from fixes of the on-course participant's own
 *     device(s) at that fix's time, or of a baton device. Vehicle fixes
 *     never do (the van drives ahead to the next exchange). A fix snapped
 *     more than SNAP_RULES.offRouteMaxM off the route stays on the map but
 *     does not advance progress. Progress is a running max: it never
 *     decreases.
 *  4. Legs: relay → handoff to handoff, the last open-ended and live; solo →
 *     split at checkpoint crossings. Distances are route distance at
 *     interpolated instants, never summed GPS points, so they stay stable
 *     through gaps and late bursts.
 *  5. The dot: on-course runner → baton → vehicle, the first with a fix
 *     fresher than FRESH_FIX_S; else the newest of them all, marked stale.
 *     Once finished: the finisher → baton, never the vehicle (the van
 *     drives wherever it likes after the race).
 *  6. A finished entry (progress within 50 m of the route end) freezes: its
 *     clock stops at finished_at, nobody is on course, its ETA is the fact,
 *     every leg ends by finished_at and a tap recorded after it opens none.
 */

import { FRESH_FIX_S, SNAP_RULES } from "./types";
import type {
  CheckpointKind,
  EventKind,
  EventStatus,
  PositionSourceLabel,
  RouteIndex,
  Snapshot,
  SnapshotBests,
  SnapshotCheckpoint,
  SnapshotEntry,
  SnapshotEta,
  SnapshotGap,
  SnapshotLeg,
  SnapshotNextUp,
  SnapshotOnCourse,
  SnapshotParticipant,
  SnapshotPosition,
  Units,
} from "./types";
import { snapToRoute } from "./routeIndex";
import {
  EMPTY_SERIES,
  lastProgress,
  progressAt,
  seriesFromSamples,
  timeAtProgress,
  type ProgressSeries,
} from "./computeSeries";
import { estimateEta, etaWindow, NO_ETA } from "./eta";

export { EMPTY_SERIES, firstSampleMs, lastProgress, progressAt, seriesFromSamples, timeAtProgress } from "./computeSeries";
export type { ProgressSeries } from "./computeSeries";
export { ETA_RULES, estimateEta, etaPace, etaPaceParts, etaWindow, NO_ETA } from "./eta";
export type { EtaEstimate, EtaInput } from "./eta";

/* ─── Input ───────────────────────────────────────────────────────────────── */

/** One GPS fix as the compute core sees it (snapshot.ts selects exactly these columns). */
export interface Fix {
  fixTime: Date;
  lat: number;
  lon: number;
  accuracyM: number | null;
  batteryPct: number | null;
}

export interface ComputeEvent {
  id: string;
  name: string;
  kind: EventKind;
  units: Units;
  timezone: string;
  startTime: Date;
  publicDelayS: number;
  /** TrackerEvent.status: "live" (derived) or "archived". */
  status: string;
}

export interface ComputeParticipant {
  id: string;
  name: string;
  initials: string;
  sortOrder: number;
  /** TrackerDevice ids with role "runner" bound to this participant. */
  deviceIds: string[];
}

export interface ComputeEntry {
  id: string;
  name: string;
  shortName: string;
  color: string;
  /** Null = the event's default route. */
  routeId: string | null;
  sortOrder: number;
  participants: ComputeParticipant[];
  vehicleDeviceIds: string[];
  batonDeviceIds: string[];
}

export interface ComputeCheckpoint {
  id: string;
  name: string;
  kind: CheckpointKind;
  routeM: number;
  sortOrder: number;
}

export interface ComputeHandoff {
  id: string;
  entryId: string;
  participantId: string;
  time: Date;
  voided: boolean;
}

export interface ComputeInput {
  event: ComputeEvent;
  routes: Map<string, RouteIndex>;
  defaultRouteId: string;
  entries: ComputeEntry[];
  /** Keyed by route id. */
  checkpoints: Map<string, ComputeCheckpoint[]>;
  /** Keyed by device id; each list sorted by fixTime ascending (re-sorted here if not). */
  positions: Map<string, Fix[]>;
  /**
   * The newest fix (≤ asOf) of every bound device — runner, baton AND
   * vehicle — keyed by device id. snapshot.ts loads `positions` only inside
   * the on-course windows (review 2026-10-06: every row of every device
   * since start − 1 h was "vans at ~1 Hz, off-course phones all day → 100k+
   * rows by hour 12", none of which moves progress), so the dot's fallback
   * chain and participants[].device_last_seen read from here. Optional: a
   * device without an entry falls back to the tail of its `positions` list,
   * which is all the tests and the simulator supply.
   */
  latestFix?: Map<string, Fix>;
  handoffs: ComputeHandoff[];
  /** The instant the snapshot describes: generatedAt minus the public delay. */
  asOf: Date;
  generatedAt: Date;
}

/** Thresholds of §9 that are not snapping or freshness rules. */
export const COMPUTE_RULES = {
  /** A leg shorter than this has no pace (GPS noise would make one up). */
  legPaceMinM: 200,
  /** An entry's average pace needs at least this much progress. */
  entryPaceMinM: 500,
  /** Progress within this of the route end counts as finished. */
  finishToleranceM: 50,
  /** Bests consider completed legs at least this long. */
  bestLegMinM: 1000,
  /** Two handoffs this close together are one exchange (two crew phones tapping). */
  sameExchangeS: 2,
} as const;

/* ─── Small helpers ───────────────────────────────────────────────────────── */

const r0 = (x: number): number => Math.round(x);
const r1 = (x: number): number => Math.round(x * 10) / 10;
const iso = (ms: number): string => new Date(ms).toISOString();
const bySortOrder = <T extends { sortOrder: number; id: string }>(a: T, b: T): number =>
  a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const EMPTY_ROUTE: RouteIndex = {
  lengthM: 0,
  lat: new Float64Array(0),
  lon: new Float64Array(0),
  cumM: new Float64Array(0),
  eleM: new Float64Array(0),
  bbox: [0, 0, 0, 0],
};

/** Pace in s/km for a distance and a duration, or null below the distance floor. */
export function paceSPerKm(distanceM: number, timeS: number, minDistanceM: number): number | null {
  if (!(distanceM >= minDistanceM) || distanceM <= 0 || !(timeS > 0)) return null;
  return timeS / (distanceM / 1000);
}

/**
 * Drop fixes after `asOf` and make sure every device's list is in fixTime
 * order. The database hands them sorted; a caller (the simulator, a test)
 * may not, and progress must not depend on arrival order.
 */
export function normalizePositions(positions: Map<string, Fix[]>, asOfMs: number): Map<string, Fix[]> {
  const out = new Map<string, Fix[]>();
  for (const [deviceId, list] of positions) {
    const kept: Fix[] = [];
    let sorted = true;
    for (const f of list) {
      const t = f.fixTime.getTime();
      if (!Number.isFinite(t) || t > asOfMs) continue;
      if (kept.length && t < kept[kept.length - 1].fixTime.getTime()) sorted = false;
      kept.push(f);
    }
    if (!sorted) kept.sort((a, b) => a.fixTime.getTime() - b.fixTime.getTime());
    out.set(deviceId, kept);
  }
  return out;
}

/**
 * Per device, the newest fix at or before `asOf`: the caller's `latestFix`
 * merged with the tail of its (normalized) history list, whichever is
 * newer. Both are consulted because snapshot.ts loads history only inside
 * the on-course windows, while a test or the simulator hands over history
 * alone. A latestFix stamped after `asOf` does not exist yet, like any fix.
 */
export function newestPerDevice(positions: Map<string, Fix[]>, latestFix: Map<string, Fix> | undefined, asOfMs: number): Map<string, Fix> {
  const out = new Map<string, Fix>();
  for (const [deviceId, list] of positions) {
    if (list.length) out.set(deviceId, list[list.length - 1]);
  }
  if (latestFix) {
    for (const [deviceId, f] of latestFix) {
      const t = f.fixTime.getTime();
      if (!Number.isFinite(t) || t > asOfMs) continue;
      const have = out.get(deviceId);
      if (!have || t > have.fixTime.getTime()) out.set(deviceId, f);
    }
  }
  return out;
}

/* ─── Who is on course (§9) ───────────────────────────────────────────────── */

/** A span during which one participant carries the entry's progress. */
export interface CourseSegment {
  participantId: string;
  fromMs: number;
  /** Null while open (the live leg). */
  toMs: number | null;
  /** The handoff that opened it; null for a solo entry. */
  handoffId: string | null;
}

/**
 * Relay: one segment per non-voided handoff at or before `asOf`, in time
 * order, each ending where the next begins. Nobody is on course before the
 * first handoff. Solo: the one participant from the event start.
 *
 * Two taps are not always two legs. Review 2026-10-06: "a second non-voided
 * handoff for the participant who is ALREADY on course (two crew phones, or
 * a replayed tap) creates a sliver leg and inflates counts." So a tap for
 * the runner already on course is the same handoff (the earlier time
 * stands), and a tap within sameExchangeS of the one that opened the current
 * segment is the same exchange with the runner corrected: the later
 * participant at the earlier time. When that correction names the runner of
 * the segment before, nothing happened and that runner's leg stays open.
 */
export function onCourseTimeline(
  kind: EventKind,
  entry: ComputeEntry,
  handoffs: ComputeHandoff[],
  startTime: Date,
  asOf: Date,
): CourseSegment[] {
  if (kind === "solo") {
    const p = [...entry.participants].sort(bySortOrder)[0];
    return p ? [{ participantId: p.id, fromMs: startTime.getTime(), toMs: null, handoffId: null }] : [];
  }
  const asOfMs = asOf.getTime();
  const own = handoffs
    .filter((h) => h.entryId === entry.id && !h.voided && h.time.getTime() <= asOfMs)
    .sort((a, b) => a.time.getTime() - b.time.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const segments: CourseSegment[] = [];
  for (const h of own) {
    const tMs = h.time.getTime();
    const last = segments[segments.length - 1];
    if (last) {
      if (h.participantId === last.participantId) continue;
      if (tMs - last.fromMs <= COMPUTE_RULES.sameExchangeS * 1000) {
        const before = segments[segments.length - 2];
        if (before && before.participantId === h.participantId) {
          segments.pop();
          before.toMs = null;
        } else last.participantId = h.participantId;
        continue;
      }
      last.toMs = tMs;
    }
    segments.push({ participantId: h.participantId, fromMs: tMs, toMs: null, handoffId: h.id });
  }
  return segments;
}

/**
 * Once an entry has finished, nothing after finished_at is a leg. Review
 * 2026-10-06: "a tap recorded after the finish [must] not extend the
 * finishing leg or add a 0 m leg." Every segment ends no later than
 * finished_at and one that would start at or after it is dropped, so the
 * last segment left is the finishing leg and its runner the finisher.
 */
export function clampToFinish(segments: CourseSegment[], finishedAtMs: number): CourseSegment[] {
  const out: CourseSegment[] = [];
  for (const s of segments) {
    if (s.fromMs >= finishedAtMs) continue;
    out.push({ ...s, toMs: s.toMs === null ? finishedAtMs : Math.min(s.toMs, finishedAtMs) });
  }
  return out;
}

/** The segment covering instant `tMs`, or null when nobody is on course then. */
export function onCourseAt(segments: CourseSegment[], tMs: number): CourseSegment | null {
  let lo = 0;
  let hi = segments.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (segments[mid].fromMs <= tMs) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (found < 0) return null;
  const s = segments[found];
  return s.toMs !== null && tMs >= s.toMs ? null : s;
}

/* ─── Progress series (§9 snapping + progress) ────────────────────────────── */

interface Candidate {
  t: number;
  lat: number;
  lon: number;
  /** The participant whose device took the fix; null for a baton device. */
  participantId: string | null;
}

export interface ProgressBuild {
  series: ProgressSeries;
  /** Fixes that advanced (or confirmed) progress. */
  accepted: number;
  /** Fixes of the right device at the right time, but > offRouteMaxM off the route. */
  offRoute: number;
  /** Fixes from a device that was not carrying the entry at that instant. */
  notOnCourse: number;
}

/**
 * Walk the entry's runner and baton fixes in fixTime order and build the
 * series. Each fix is snapped with the window around the progress so far,
 * which keeps overlapping passes apart. For the very first fix the window
 * sits at 0 rather than being skipped: an entry has not gone anywhere yet,
 * and on an out-and-back course whose start and finish coincide a global
 * search would be a coin toss between them. A fix far from the first 5 km
 * still misses the window and falls back to the whole route.
 */
export function buildProgressSeries(
  route: RouteIndex,
  segments: CourseSegment[],
  entry: ComputeEntry,
  positions: Map<string, Fix[]>,
): ProgressBuild {
  const cands: Candidate[] = [];
  for (const p of entry.participants) {
    for (const d of p.deviceIds) {
      for (const f of positions.get(d) ?? []) cands.push({ t: f.fixTime.getTime(), lat: f.lat, lon: f.lon, participantId: p.id });
    }
  }
  for (const d of entry.batonDeviceIds) {
    for (const f of positions.get(d) ?? []) cands.push({ t: f.fixTime.getTime(), lat: f.lat, lon: f.lon, participantId: null });
  }
  cands.sort((a, b) => a.t - b.t);

  const t: number[] = [];
  const m: number[] = [];
  let progress = 0;
  let have = false;
  let offRoute = 0;
  let notOnCourse = 0;
  for (const c of cands) {
    const seg = onCourseAt(segments, c.t);
    if (!seg || (c.participantId !== null && c.participantId !== seg.participantId)) {
      notOnCourse++;
      continue;
    }
    const snap = snapToRoute(route, c.lat, c.lon, have ? progress : 0);
    if (!(snap.offRouteM <= SNAP_RULES.offRouteMaxM)) {
      offRoute++;
      continue;
    }
    if (snap.routeM > progress) progress = snap.routeM;
    have = true;
    t.push(c.t);
    m.push(progress);
  }
  return { series: t.length ? seriesFromSamples(t, m) : EMPTY_SERIES, accepted: t.length, offRoute, notOnCourse };
}

/* ─── Legs (§9) ───────────────────────────────────────────────────────────── */

export interface Leg {
  no: number;
  participantId: string;
  startMs: number;
  endMs: number;
  distanceM: number;
  timeS: number;
  paceSPerKm: number | null;
  live: boolean;
  /** Solo: the checkpoint whose crossing ended this leg. */
  checkpointId: string | null;
}

function makeLeg(
  no: number,
  participantId: string,
  startMs: number,
  endMs: number,
  series: ProgressSeries,
  live: boolean,
  checkpointId: string | null,
): Leg {
  const end = Math.max(startMs, endMs);
  const distanceM = Math.max(0, progressAt(series, end) - progressAt(series, startMs));
  const timeS = (end - startMs) / 1000;
  return { no, participantId, startMs, endMs: end, distanceM, timeS, paceSPerKm: paceSPerKm(distanceM, timeS, COMPUTE_RULES.legPaceMinM), live, checkpointId };
}

/**
 * Relay legs: handoff i to handoff i+1; the last runs to `asOf` and is live
 * — unless the entry has finished, in which case the timeline is clamped
 * (clampToFinish) and the finishing leg closes at finished_at.
 */
export function relayLegs(segments: CourseSegment[], series: ProgressSeries, asOfMs: number, finishedAtMs: number | null): Leg[] {
  const segs = finishedAtMs === null ? segments : clampToFinish(segments, finishedAtMs);
  return segs.map((s, i) => makeLeg(i + 1, s.participantId, s.fromMs, s.toMs ?? asOfMs, series, s.toMs === null, null));
}

/** For passed/finish logic a checkpoint at the route end is reached at the finish tolerance. */
function crossingTargetM(routeM: number, lengthM: number): number {
  const finishTarget = Math.max(0, lengthM - COMPUTE_RULES.finishToleranceM);
  return lengthM > 0 && routeM >= finishTarget ? finishTarget : routeM;
}

/**
 * Solo legs: from the event start, split at each checkpoint crossing (the
 * interpolated instant progress first reached its route_m). Checkpoints at
 * route_m 0 (the start) do not split. The remainder is live unless the
 * entry has finished.
 */
export function soloLegs(
  participantId: string,
  series: ProgressSeries,
  checkpoints: ComputeCheckpoint[],
  lengthM: number,
  startMs: number,
  asOfMs: number,
  finishedAtMs: number | null,
): Leg[] {
  const legs: Leg[] = [];
  let boundary = startMs;
  const sorted = [...checkpoints].sort((a, b) => a.routeM - b.routeM || a.sortOrder - b.sortOrder);
  for (const cp of sorted) {
    if (cp.routeM <= 0) continue;
    const crossing = timeAtProgress(series, crossingTargetM(cp.routeM, lengthM));
    if (crossing === null || crossing > asOfMs || crossing <= boundary) continue;
    legs.push(makeLeg(legs.length + 1, participantId, boundary, crossing, series, false, cp.id));
    boundary = crossing;
  }
  if (finishedAtMs !== null) {
    if (finishedAtMs > boundary) legs.push(makeLeg(legs.length + 1, participantId, boundary, finishedAtMs, series, false, null));
  } else if (asOfMs >= boundary) {
    legs.push(makeLeg(legs.length + 1, participantId, boundary, asOfMs, series, true, null));
  }
  return legs;
}

/* ─── Stats, bests ────────────────────────────────────────────────────────── */

/** The newest fix (≤ asOf) across some devices, from the per-device map of newestPerDevice. */
function newestFix(latest: Map<string, Fix>, deviceIds: string[]): Fix | null {
  let best: Fix | null = null;
  for (const d of deviceIds) {
    const f = latest.get(d);
    if (f && (!best || f.fixTime.getTime() > best.fixTime.getTime())) best = f;
  }
  return best;
}

const hasBattery = (f: Fix): boolean => f.batteryPct !== null && Number.isFinite(f.batteryPct);

/**
 * The battery of the newest fix that reported one (phones omit it on some
 * fixes): each device's newest fix first, then back through what history
 * it has — from snapshot.ts, only its on-course windows.
 */
function newestBattery(latest: Map<string, Fix>, positions: Map<string, Fix[]>, deviceIds: string[]): number | null {
  let bestT = -Infinity;
  let best: number | null = null;
  for (const d of deviceIds) {
    let found: Fix | null = null;
    const newest = latest.get(d);
    if (newest && hasBattery(newest)) found = newest;
    else {
      const list = positions.get(d) ?? [];
      for (let i = list.length - 1; i >= 0 && !found; i--) if (hasBattery(list[i])) found = list[i];
    }
    if (found && found.fixTime.getTime() > bestT) {
      bestT = found.fixTime.getTime();
      best = found.batteryPct;
    }
  }
  return best === null ? null : r0(best);
}

export function participantStats(
  entry: ComputeEntry,
  legs: Leg[],
  onCourseId: string | null,
  latest: Map<string, Fix>,
  positions: Map<string, Fix[]>,
): SnapshotParticipant[] {
  return [...entry.participants].sort(bySortOrder).map((p) => {
    let count = 0;
    let distanceM = 0;
    let timeS = 0;
    for (const l of legs) {
      if (l.participantId !== p.id) continue;
      count++;
      distanceM += l.distanceM;
      timeS += l.timeS;
    }
    const last = newestFix(latest, p.deviceIds);
    return {
      id: p.id,
      name: p.name,
      initials: p.initials,
      legs: count,
      distance_m: r0(distanceM),
      time_s: r0(timeS),
      avg_pace_s_per_km: roundOrNull(paceSPerKm(distanceM, timeS, COMPUTE_RULES.legPaceMinM)),
      on_course: p.id === onCourseId,
      device_last_seen: last ? last.fixTime.toISOString() : null,
      device_battery_pct: newestBattery(latest, positions, p.deviceIds),
    };
  });
}

function roundOrNull(v: number | null): number | null {
  return v === null ? null : r0(v);
}

/** Fastest completed leg (by pace, ≥ 1 km) and longest completed leg (by distance). */
export function bestsOf(legs: Leg[]): SnapshotBests {
  let fastest: Leg | null = null;
  let longest: Leg | null = null;
  for (const l of legs) {
    if (l.live) continue;
    if (l.distanceM >= COMPUTE_RULES.bestLegMinM && l.paceSPerKm !== null && (!fastest || l.paceSPerKm < (fastest.paceSPerKm as number))) fastest = l;
    if (l.distanceM > 0 && (!longest || l.distanceM > longest.distanceM)) longest = l;
  }
  return {
    fastest_leg: fastest ? { leg_no: fastest.no, participant_id: fastest.participantId, pace_s_per_km: r0(fastest.paceSPerKm as number) } : null,
    longest_leg: longest ? { leg_no: longest.no, participant_id: longest.participantId, distance_m: r0(longest.distanceM) } : null,
  };
}

/* ─── Where the dot is (§9 fallback chain) ────────────────────────────────── */

/**
 * Chain: the runner's devices → baton → vehicle. The first group whose
 * newest fix is within FRESH_FIX_S of `asOf` wins; otherwise the newest fix
 * across the chain, flagged stale. Nothing at all → null. The chosen fix is
 * snapped with the window at the entry's progress.
 *
 * `runnerId` is the participant on course — or, once the entry has
 * finished, the finisher — and a finished entry's chain stops at the baton.
 * Review 2026-10-06: "once an entry is finished, onCourseId is null so the
 * chain becomes baton → vehicle and the finished team's dot follows the van
 * wherever it drives after the race."
 */
export function resolvePosition(
  route: RouteIndex,
  entry: ComputeEntry,
  runnerId: string | null,
  latest: Map<string, Fix>,
  asOfMs: number,
  progressM: number,
  finished = false,
): SnapshotPosition | null {
  const groups: Array<{ source: PositionSourceLabel; participantId: string | null; deviceIds: string[] }> = [];
  const runner = runnerId ? entry.participants.find((p) => p.id === runnerId) : undefined;
  if (runner) groups.push({ source: "runner", participantId: runner.id, deviceIds: runner.deviceIds });
  groups.push({ source: "baton", participantId: null, deviceIds: entry.batonDeviceIds });
  if (!finished) groups.push({ source: "vehicle", participantId: null, deviceIds: entry.vehicleDeviceIds });

  let newest: { fix: Fix; group: (typeof groups)[number] } | null = null;
  for (const group of groups) {
    const fix = newestFix(latest, group.deviceIds);
    if (!fix) continue;
    const ageS = (asOfMs - fix.fixTime.getTime()) / 1000;
    if (ageS <= FRESH_FIX_S) return describePosition(route, fix, group.source, group.participantId, ageS, false, progressM);
    if (!newest || fix.fixTime.getTime() > newest.fix.fixTime.getTime()) newest = { fix, group };
  }
  if (!newest) return null;
  const ageS = (asOfMs - newest.fix.fixTime.getTime()) / 1000;
  return describePosition(route, newest.fix, newest.group.source, newest.group.participantId, ageS, true, progressM);
}

function describePosition(
  route: RouteIndex,
  fix: Fix,
  source: PositionSourceLabel,
  participantId: string | null,
  ageS: number,
  stale: boolean,
  progressM: number,
): SnapshotPosition {
  const snap = snapToRoute(route, fix.lat, fix.lon, progressM);
  const offRoute = !(snap.offRouteM <= SNAP_RULES.offRouteMaxM);
  return {
    lat: fix.lat,
    lon: fix.lon,
    fix_time: fix.fixTime.toISOString(),
    age_s: r0(Math.max(0, ageS)),
    source,
    participant_id: participantId,
    stale,
    off_route: offRoute,
    route_m: offRoute ? null : r0(snap.routeM),
    battery_pct: fix.batteryPct === null || !Number.isFinite(fix.batteryPct) ? null : r0(fix.batteryPct),
  };
}

/* ─── Checkpoints (§9 ETA, §11 Meet us) ───────────────────────────────────── */

export function checkpointRows(
  checkpoints: ComputeCheckpoint[],
  series: ProgressSeries,
  lengthM: number,
  progressM: number,
  paceSPerKmUsed: number | null,
  asOf: Date,
): SnapshotCheckpoint[] {
  const asOfMs = asOf.getTime();
  return [...checkpoints]
    .sort((a, b) => a.routeM - b.routeM || a.sortOrder - b.sortOrder)
    .map((cp) => {
      const crossing = timeAtProgress(series, crossingTargetM(cp.routeM, lengthM));
      const passedMs = crossing !== null && crossing <= asOfMs ? crossing : null;
      let eta: string | null = null;
      let earliest: string | null = null;
      let latest: string | null = null;
      if (passedMs === null && paceSPerKmUsed !== null) {
        const w = etaWindow(cp.routeM - progressM, paceSPerKmUsed, asOf);
        eta = w.finish.toISOString();
        earliest = w.earliest.toISOString();
        latest = w.latest.toISOString();
      }
      return {
        id: cp.id,
        name: cp.name,
        kind: cp.kind,
        route_m: r0(cp.routeM),
        passed_at: passedMs === null ? null : iso(passedMs),
        eta,
        eta_earliest: earliest,
        eta_latest: latest,
      };
    });
}

/* ─── Gaps between entries (§9 stats) ─────────────────────────────────────── */

export interface GapInput {
  id: string;
  progressM: number;
  series: ProgressSeries;
}

/**
 * Entries sorted by progress; for each consecutive pair the distance between
 * them and how long ago the leader was where the trailer is now (null when
 * the leader's series does not say). Empty with a single entry.
 */
export function computeGaps(entries: GapInput[], asOfMs: number): SnapshotGap[] {
  const sorted = [...entries].sort((a, b) => b.progressM - a.progressM);
  const gaps: SnapshotGap[] = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const ahead = sorted[i];
    const behind = sorted[i + 1];
    const when = timeAtProgress(ahead.series, behind.progressM);
    /* The time gap is measured at the TRAILER's last known position: when
     * the trailer was last seen there, how long before that had the leader
     * passed the same point. Measured against asOf instead, the gap would
     * grow by the clock while the trailer is in a dead zone — a staleness
     * number dressed as a race gap (the position card already says "last
     * seen 12 min ago"). With fresh data the two readings agree. */
    const nBehind = behind.series.t.length;
    const behindSeenMs = nBehind ? behind.series.t[nBehind - 1] : asOfMs;
    gaps.push({
      ahead: ahead.id,
      behind: behind.id,
      distance_m: r0(Math.max(0, ahead.progressM - behind.progressM)),
      time_s: when === null ? null : r0(Math.max(0, (behindSeenMs - when) / 1000)),
    });
  }
  return gaps;
}

/* ─── Event status ────────────────────────────────────────────────────────── */

export function eventStatus(event: ComputeEvent, asOfMs: number, finishedFlags: boolean[]): EventStatus {
  if (event.status === "archived") return "archived";
  if (asOfMs < event.startTime.getTime()) return "upcoming";
  if (finishedFlags.length > 0 && finishedFlags.every(Boolean)) return "finished";
  return "live";
}

/* ─── One entry ───────────────────────────────────────────────────────────── */

export interface EntryComputation {
  entry: SnapshotEntry;
  series: ProgressSeries;
  progressM: number;
  finished: boolean;
  build: ProgressBuild;
}

export function computeEntry(input: ComputeInput, entry: ComputeEntry, positions: Map<string, Fix[]>, latest: Map<string, Fix>): EntryComputation {
  const { event, asOf } = input;
  const asOfMs = asOf.getTime();
  const startMs = event.startTime.getTime();
  const routeId = entry.routeId ?? input.defaultRouteId;
  const route = input.routes.get(routeId) ?? EMPTY_ROUTE;
  const checkpoints = input.checkpoints.get(routeId) ?? [];
  const lengthM = route.lengthM;
  const participants = [...entry.participants].sort(bySortOrder);

  const segments = onCourseTimeline(event.kind, entry, input.handoffs, event.startTime, asOf);
  const build = buildProgressSeries(route, segments, entry, positions);
  const { series } = build;
  const progressM = lastProgress(series);

  const finishTarget = Math.max(0, lengthM - COMPUTE_RULES.finishToleranceM);
  const finished = lengthM > 0 && progressM >= finishTarget;
  const finishedAtMs = finished ? timeAtProgress(series, finishTarget) : null;

  const current = finished ? null : onCourseAt(segments, asOfMs);
  const onCourseId = current?.participantId ?? null;
  /* The finisher ran the last leg left once the timeline is clamped at the
   * finish. Nobody is on course any more, but the dot is still theirs. */
  const finishTimeline = finishedAtMs === null ? [] : clampToFinish(segments, finishedAtMs);
  const finisherId = finishTimeline.length ? finishTimeline[finishTimeline.length - 1].participantId : null;

  const legs =
    event.kind === "relay"
      ? relayLegs(segments, series, asOfMs, finishedAtMs)
      : participants[0]
        ? soloLegs(participants[0].id, series, checkpoints, lengthM, startMs, asOfMs, finishedAtMs)
        : [];
  const liveLeg = legs.find((l) => l.live) ?? null;

  // A finished entry's clock stops at the finish; otherwise it runs to as-of.
  const clockEndMs = finishedAtMs ?? asOfMs;
  const elapsedS = Math.max(0, (clockEndMs - startMs) / 1000);
  const avgPace = paceSPerKm(progressM, elapsedS, COMPUTE_RULES.entryPaceMinM);
  const remainingM = finished ? 0 : Math.max(0, lengthM - progressM);

  let eta: SnapshotEta;
  let etaPaceUsed: number | null = null;
  if (finished && finishedAtMs !== null) {
    const at = iso(finishedAtMs);
    eta = { finish: at, earliest: at, latest: at, pace_s_per_km: roundOrNull(avgPace) };
  } else {
    const est = estimateEta({ progressSeries: series, progressM, remainingM, asOf, startTime: event.startTime });
    etaPaceUsed = est.pace_s_per_km;
    eta =
      est.finish && est.earliest && est.latest
        ? { finish: est.finish.toISOString(), earliest: est.earliest.toISOString(), latest: est.latest.toISOString(), pace_s_per_km: roundOrNull(est.pace_s_per_km) }
        : { finish: null, earliest: null, latest: null, pace_s_per_km: null };
  }

  const onCourse: SnapshotOnCourse | null =
    onCourseId && liveLeg
      ? (() => {
          const p = participants.find((x) => x.id === onCourseId);
          return p
            ? {
                participant_id: p.id,
                name: p.name,
                initials: p.initials,
                leg_no: liveLeg.no,
                leg_started: iso(liveLeg.startMs),
                leg_distance_m: r0(liveLeg.distanceM),
                leg_time_s: r0(liveLeg.timeS),
                leg_pace_s_per_km: roundOrNull(liveLeg.paceSPerKm),
              }
            : null;
        })()
      : null;

  const snapshotEntry: SnapshotEntry = {
    id: entry.id,
    name: entry.name,
    short_name: entry.shortName,
    color: entry.color,
    route_id: routeId,
    position: resolvePosition(route, entry, finished ? finisherId : onCourseId, latest, asOfMs, progressM, finished),
    progress_m: r0(progressM),
    remaining_m: r0(remainingM),
    percent: finished ? 100 : lengthM > 0 ? r1(Math.max(0, Math.min(100, (progressM / lengthM) * 100))) : 0,
    elapsed_s: r0(elapsedS),
    avg_pace_s_per_km: roundOrNull(avgPace),
    finished,
    finished_at: finishedAtMs === null ? null : iso(finishedAtMs),
    on_course: onCourse,
    next_up: nextUp(event.kind, participants, onCourseId, finished),
    eta,
    checkpoints: checkpointRows(checkpoints, series, lengthM, progressM, etaPaceUsed, asOf),
    participants: participantStats(entry, legs, onCourseId, latest, positions),
    legs: legs
      .slice()
      .sort((a, b) => b.no - a.no)
      .map(
        (l): SnapshotLeg => ({
          no: l.no,
          participant_id: l.participantId,
          start: iso(l.startMs),
          end: l.live ? null : iso(l.endMs),
          distance_m: r0(l.distanceM),
          time_s: r0(l.timeS),
          pace_s_per_km: roundOrNull(l.paceSPerKm),
          live: l.live,
          ...(event.kind === "solo" ? { checkpoint_id: l.checkpointId } : {}),
        }),
      ),
    bests: bestsOf(legs),
  };

  return { entry: snapshotEntry, series, progressM, finished, build };
}

/**
 * Relay: the participant after the one on course, in sort order, wrapping
 * round; the first participant before the first handoff. Nobody once the
 * entry has finished, and never for a solo entry.
 */
export function nextUp(kind: EventKind, participantsSorted: ComputeParticipant[], onCourseId: string | null, finished: boolean): SnapshotNextUp | null {
  if (kind !== "relay" || finished || participantsSorted.length === 0) return null;
  let next: ComputeParticipant | undefined;
  if (onCourseId === null) next = participantsSorted[0];
  else {
    const i = participantsSorted.findIndex((p) => p.id === onCourseId);
    if (participantsSorted.length < 2) return null;
    next = participantsSorted[i < 0 ? 0 : (i + 1) % participantsSorted.length];
  }
  return next ? { participant_id: next.id, name: next.name, initials: next.initials } : null;
}

/* ─── The snapshot ────────────────────────────────────────────────────────── */

export function computeSnapshot(input: ComputeInput): Snapshot {
  const asOfMs = input.asOf.getTime();
  const positions = normalizePositions(input.positions, asOfMs);
  const latest = newestPerDevice(positions, input.latestFix, asOfMs);
  const comps = [...input.entries].sort(bySortOrder).map((e) => computeEntry(input, e, positions, latest));
  const defaultRoute = input.routes.get(input.defaultRouteId) ?? EMPTY_ROUTE;
  return {
    event: {
      slug: input.event.id,
      name: input.event.name,
      kind: input.event.kind,
      units: input.event.units,
      timezone: input.event.timezone,
      start_time: input.event.startTime.toISOString(),
      length_m: r0(defaultRoute.lengthM),
      status: eventStatus(input.event, asOfMs, comps.map((c) => c.finished)),
      public_delay_s: input.event.publicDelayS,
    },
    generated_at: input.generatedAt.toISOString(),
    as_of: input.asOf.toISOString(),
    entries: comps.map((c) => c.entry),
    gaps: computeGaps(
      comps.map((c) => ({ id: c.entry.id, progressM: c.progressM, series: c.series })),
      asOfMs,
    ),
  };
}
