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
 *  2. Who is on course: relay → PER SLOT, the participant of the latest
 *     non-voided handoff for that slot at or before t; nobody before the
 *     first handoff. A classic relay has one slot; the LASD26 crew runs
 *     "two by two" (owner, 2026-10-15), one entry with slots A and B that
 *     any roster runner can take, so a tap for slot B replaces the holder
 *     of slot B only. Solo → the one participant, from the event start. A
 *     second tap for the runner already in that slot (two crew phones, a
 *     replayed tap) is the same handoff, and two taps for one slot within
 *     2 s are one exchange: the later runner at the earlier time. Both rules
 *     are per slot — the A and B taps of an exchange land a second apart
 *     and are two legs. ONE RUNNER, ONE SLOT (review 2026-10-15): a tap
 *     that puts a runner into slot B while they hold slot A ends their A
 *     leg at that tap and leaves A empty until its next tap — unless the A
 *     tap was within 2 s, the same tap mis-slotted (two crew phones), which
 *     then never happened in A and A's previous runner is still on course.
 *  3. Progress advances ONLY from fixes of a participant on course (in any
 *     slot) at that fix's time, from their own device(s), or of a baton
 *     device. Vehicle fixes never do (the van drives ahead to the next
 *     exchange). A fix snapped more than SNAP_RULES.offRouteMaxM off the
 *     route stays on the map but does not advance progress. Progress is a
 *     running max: it never decreases, and a pair shares it (they run side
 *     by side; each runner's leg is the pair's distance).
 *  4. Legs: relay → handoff to handoff per slot, numbered per entry in time
 *     order across slots, the open ones (one per occupied slot) live; solo →
 *     split at checkpoint crossings. Distances are route distance at
 *     interpolated instants, never summed GPS points, so they stay stable
 *     through gaps and late bursts.
 *  5. The dot: the on-course runners in slot order → baton → vehicle, the
 *     first with a fix fresher than FRESH_FIX_S; else the newest of them
 *     all, marked stale. Once finished: the finishers → baton, never the
 *     vehicle (the van drives wherever it likes after the race).
 *  6. A finished entry (progress within 50 m of the route end) freezes: its
 *     clock stops at finished_at, nobody is on course, its ETA is the fact,
 *     every leg ends by finished_at and a tap recorded after it opens none.
 *  7. Elevation is read off the route's cumulative-gain curve
 *     (elevation.ts): the entry's gain is 0 → progress, remaining is
 *     progress → route end, a leg's is its start progress → end progress,
 *     a participant's the sum of their legs.
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
import { climbFn } from "./elevation";

export { EMPTY_SERIES, firstSampleMs, lastProgress, progressAt, seriesFromSamples, timeAtProgress } from "./computeSeries";
export type { ProgressSeries } from "./computeSeries";
export { ETA_RULES, estimateEta, etaPace, etaPaceParts, etaWindow, NO_ETA } from "./eta";
export type { EtaEstimate, EtaInput } from "./eta";
export { ELEVATION_RULES, climbFn, cumulativeGain, gainAtRouteM, gainBetween, routeGain } from "./elevation";

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
  /** Runners on course at once: 1 = a classic relay, 2 = pairs (TrackerEntry.slots). */
  slots: number;
  /** Labels per slot, index 0 = slot 1; missing labels fall back to "1", "2", … */
  slotNames: string[];
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
  /** 1-based slot the runner took (TrackerHandoff.slot); 1 for a classic relay. */
  slot: number;
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
  /** Two handoffs for ONE SLOT this close together are one exchange (two crew phones tapping). */
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

/** `(fromM, toM) → metres climbed`; the no-route stand-in climbs nothing. */
export type Climb = (fromM: number, toM: number) => number;
const NO_CLIMB: Climb = () => 0;

/** How many slots an entry really has: a whole number ≥ 1 (bad data → 1). */
export function slotCount(entry: Pick<ComputeEntry, "slots">): number {
  const n = Math.floor(Number(entry.slots));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** The label of a slot: from the file, else its number. */
export function slotName(entry: Pick<ComputeEntry, "slotNames">, slot: number): string {
  const s = entry.slotNames?.[slot - 1];
  return typeof s === "string" && s.trim() ? s : String(slot);
}

/**
 * A handoff's slot folded into the entry's range. A tap stored for a slot
 * the entry no longer has (the file's `slots` edited down after race day)
 * lands in the last slot rather than vanishing with its leg; anything
 * unparsable is slot 1, which is every classic-relay tap.
 */
export function clampSlot(slot: number | null | undefined, slots: number): number {
  const s = Math.floor(Number(slot));
  if (!Number.isFinite(s) || s < 1) return 1;
  return Math.min(slots, s);
}

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

/** A span during which one participant holds one slot of the entry. */
export interface CourseSegment {
  participantId: string;
  /** 1-based; 1 for a classic relay and for a solo entry. */
  slot: number;
  fromMs: number;
  /** Null while open (the live leg). */
  toMs: number | null;
  /** The handoff that opened it; null for a solo entry. */
  handoffId: string | null;
}

/**
 * Relay: per slot, one segment per non-voided handoff at or before `asOf`,
 * in time order, each ending where that slot's next begins; the slots'
 * segments are then merged, sorted by (fromMs, slot), which is the leg
 * order. Nobody is on course before the first handoff. Solo: the one
 * participant from the event start, in slot 1.
 *
 * Two taps are not always two legs. Review 2026-10-06: "a second non-voided
 * handoff for the participant who is ALREADY on course (two crew phones, or
 * a replayed tap) creates a sliver leg and inflates counts." So a tap for
 * the runner already in that slot is the same handoff (the earlier time
 * stands), and a tap within sameExchangeS of the one that opened the slot's
 * current segment is the same exchange with the runner corrected: the later
 * participant at the earlier time. When that correction names the runner of
 * the segment before, nothing happened and that runner's leg stays open.
 * Both rules look at ONE slot: with pairs the crew taps A and B a second
 * apart on purpose.
 *
 * ONE RUNNER, ONE SLOT. Review 2026-10-15 (findings #2 and #4): a tap that
 * put a runner into slot B while they held slot A left them on course
 * twice — "two live legs for one person, their time and distance counted
 * in both". So whenever a tap seats a runner in a slot, they are released
 * from any other slot they hold at that instant (releaseOtherSlots): that
 * leg closes and the slot is empty until its next tap. The taps are walked
 * in time order across the slots, so "hold at that instant" is simply the
 * other slot's open segment.
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
    return p ? [{ participantId: p.id, slot: 1, fromMs: startTime.getTime(), toMs: null, handoffId: null }] : [];
  }
  const asOfMs = asOf.getTime();
  const slots = slotCount(entry);
  const own = handoffs
    .filter((h) => h.entryId === entry.id && !h.voided && h.time.getTime() <= asOfMs)
    .sort((a, b) => a.time.getTime() - b.time.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const perSlot: CourseSegment[][] = Array.from({ length: slots }, () => []);
  for (const h of own) {
    const slot = clampSlot(h.slot, slots);
    const segs = perSlot[slot - 1];
    const tMs = h.time.getTime();
    const last = segs[segs.length - 1];
    // A segment closed by a release leaves the slot empty: the next tap
    // opens a new one and the replay / 2 s rules have nothing to compare.
    const open = last && last.toMs === null ? last : null;
    if (open) {
      if (h.participantId === open.participantId) continue;
      if (tMs - open.fromMs <= COMPUTE_RULES.sameExchangeS * 1000) {
        const before = segs[segs.length - 2];
        // "Nothing happened" only when `before` is the runner this exchange
        // replaced — closed by it, not released earlier into another slot.
        if (before && before.participantId === h.participantId && before.toMs === open.fromMs) {
          segs.pop();
          before.toMs = null;
        } else open.participantId = h.participantId;
        releaseOtherSlots(perSlot, slot, h.participantId, open.fromMs);
        continue;
      }
      open.toMs = tMs;
    }
    segs.push({ participantId: h.participantId, slot, fromMs: tMs, toMs: null, handoffId: h.id });
    releaseOtherSlots(perSlot, slot, h.participantId, tMs);
  }
  return mergeSlots(perSlot);
}

/**
 * One runner, one slot: `participantId` has just taken `slot` at `atMs`, so
 * an open segment of theirs in any OTHER slot ends. Opened within
 * sameExchangeS of `atMs` it was this very tap mis-slotted — two crew
 * phones with different slots picked tapping the same runner a second
 * apart — and is dropped as if it never happened there, which reinstates
 * the runner it had replaced (the one closed by its tap). Older, it closes
 * at `atMs`: that slot is empty until its next tap.
 */
function releaseOtherSlots(perSlot: CourseSegment[][], slot: number, participantId: string, atMs: number): void {
  for (let i = 0; i < perSlot.length; i++) {
    if (i === slot - 1) continue;
    const segs = perSlot[i];
    const open = segs[segs.length - 1];
    if (!open || open.toMs !== null || open.participantId !== participantId) continue;
    if (atMs - open.fromMs <= COMPUTE_RULES.sameExchangeS * 1000) {
      segs.pop();
      const before = segs[segs.length - 1];
      if (before && before.toMs === open.fromMs) before.toMs = null;
    } else open.toMs = atMs;
  }
}

/** The slots' segment lists as one timeline, sorted by (fromMs, slot). */
function mergeSlots(perSlot: CourseSegment[][]): CourseSegment[] {
  if (perSlot.length === 1) return perSlot[0];
  return perSlot.flat().sort((a, b) => a.fromMs - b.fromMs || a.slot - b.slot);
}

/**
 * Once an entry has finished, nothing after finished_at is a leg. Review
 * 2026-10-06: "a tap recorded after the finish [must] not extend the
 * finishing leg or add a 0 m leg." Every segment ends no later than
 * finished_at and one that would start at or after it is dropped, so the
 * segments left ending AT finished_at are the finishing legs and their
 * runners the finishers.
 */
export function clampToFinish(segments: CourseSegment[], finishedAtMs: number): CourseSegment[] {
  const out: CourseSegment[] = [];
  for (const s of segments) {
    if (s.fromMs >= finishedAtMs) continue;
    out.push({ ...s, toMs: s.toMs === null ? finishedAtMs : Math.min(s.toMs, finishedAtMs) });
  }
  return out;
}

/** The segment of `slot` covering instant `tMs`, or null when that slot is empty then. */
export function onCourseAt(segments: CourseSegment[], tMs: number, slot = 1): CourseSegment | null {
  let found: CourseSegment | null = null;
  for (const s of segments) {
    if (s.fromMs > tMs) break; // sorted by fromMs
    if (s.slot === slot) found = s;
  }
  if (!found) return null;
  return found.toMs !== null && tMs >= found.toMs ? null : found;
}

/** The holder of every slot at `tMs`, slot order (null = empty). */
export function holdersAt(segments: CourseSegment[], tMs: number, slots: number): (CourseSegment | null)[] {
  return Array.from({ length: slots }, (_, i) => onCourseAt(segments, tMs, i + 1));
}

/**
 * Is this fix's device carrying the entry at `tMs`? A runner's when they
 * hold any slot then; a baton's (participantId null) when anyone does.
 */
export function carriesAt(segments: CourseSegment[], tMs: number, participantId: string | null): boolean {
  for (const s of segments) {
    if (s.fromMs > tMs) break;
    if (s.toMs !== null && tMs >= s.toMs) continue;
    if (participantId === null || s.participantId === participantId) return true;
  }
  return false;
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
    if (!carriesAt(segments, c.t, c.participantId)) {
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
  /** 1-based slot; 1 for a classic relay and a solo entry. */
  slot: number;
  startMs: number;
  endMs: number;
  distanceM: number;
  timeS: number;
  paceSPerKm: number | null;
  /** Route metres climbed between the leg's start and end progress. */
  elevationGainM: number;
  live: boolean;
  /** Solo: the checkpoint whose crossing ended this leg. */
  checkpointId: string | null;
}

function makeLeg(
  no: number,
  participantId: string,
  slot: number,
  startMs: number,
  endMs: number,
  series: ProgressSeries,
  live: boolean,
  checkpointId: string | null,
  climb: Climb,
): Leg {
  const end = Math.max(startMs, endMs);
  const fromM = progressAt(series, startMs);
  const toM = progressAt(series, end);
  const distanceM = Math.max(0, toM - fromM);
  const timeS = (end - startMs) / 1000;
  return {
    no,
    participantId,
    slot,
    startMs,
    endMs: end,
    distanceM,
    timeS,
    paceSPerKm: paceSPerKm(distanceM, timeS, COMPUTE_RULES.legPaceMinM),
    elevationGainM: climb(fromM, toM),
    live,
    checkpointId,
  };
}

/**
 * Relay legs: one per segment, numbered in the timeline's order (time, then
 * slot); the open ones run to `asOf` and are live — unless the entry has
 * finished, in which case the timeline is clamped (clampToFinish) and the
 * finishing legs close at finished_at.
 */
export function relayLegs(segments: CourseSegment[], series: ProgressSeries, asOfMs: number, finishedAtMs: number | null, climb: Climb = NO_CLIMB): Leg[] {
  const segs = finishedAtMs === null ? segments : clampToFinish(segments, finishedAtMs);
  return segs.map((s, i) => makeLeg(i + 1, s.participantId, s.slot, s.fromMs, s.toMs ?? asOfMs, series, s.toMs === null, null, climb));
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
  climb: Climb = NO_CLIMB,
): Leg[] {
  const legs: Leg[] = [];
  let boundary = startMs;
  const sorted = [...checkpoints].sort((a, b) => a.routeM - b.routeM || a.sortOrder - b.sortOrder);
  for (const cp of sorted) {
    if (cp.routeM <= 0) continue;
    const crossing = timeAtProgress(series, crossingTargetM(cp.routeM, lengthM));
    if (crossing === null || crossing > asOfMs || crossing <= boundary) continue;
    legs.push(makeLeg(legs.length + 1, participantId, 1, boundary, crossing, series, false, cp.id, climb));
    boundary = crossing;
  }
  if (finishedAtMs !== null) {
    if (finishedAtMs > boundary) legs.push(makeLeg(legs.length + 1, participantId, 1, boundary, finishedAtMs, series, false, null, climb));
  } else if (asOfMs >= boundary) {
    legs.push(makeLeg(legs.length + 1, participantId, 1, boundary, asOfMs, series, true, null, climb));
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

/** Per participant, aggregated across every slot they held. */
export function participantStats(
  entry: ComputeEntry,
  legs: Leg[],
  onCourseIds: ReadonlySet<string>,
  latest: Map<string, Fix>,
  positions: Map<string, Fix[]>,
): SnapshotParticipant[] {
  return [...entry.participants].sort(bySortOrder).map((p) => {
    let count = 0;
    let distanceM = 0;
    let timeS = 0;
    let gainM = 0;
    for (const l of legs) {
      if (l.participantId !== p.id) continue;
      count++;
      distanceM += l.distanceM;
      timeS += l.timeS;
      gainM += l.elevationGainM;
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
      elevation_gain_m: r0(gainM),
      on_course: onCourseIds.has(p.id),
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
 * Chain: each on-course runner's devices, in slot order → baton → vehicle.
 * The first group whose newest fix is within FRESH_FIX_S of `asOf` wins;
 * otherwise the newest fix across the chain, flagged stale. Nothing at all
 * → null. The chosen fix is snapped with the window at the entry's progress.
 *
 * `runnerIds` are the participants on course — or, once the entry has
 * finished, the finishers — and a finished entry's chain stops at the
 * baton. Review 2026-10-06: "once an entry is finished, onCourseId is null
 * so the chain becomes baton → vehicle and the finished team's dot follows
 * the van wherever it drives after the race." With pairs the slot A phone
 * is the dot while it is fresh, so the dot does not hop between two phones
 * fifteen metres apart on every build.
 */
export function resolvePosition(
  route: RouteIndex,
  entry: ComputeEntry,
  runnerIds: readonly string[],
  latest: Map<string, Fix>,
  asOfMs: number,
  progressM: number,
  finished = false,
): SnapshotPosition | null {
  const groups: Array<{ source: PositionSourceLabel; participantId: string | null; deviceIds: string[] }> = [];
  for (const id of runnerIds) {
    const runner = entry.participants.find((p) => p.id === id);
    if (runner) groups.push({ source: "runner", participantId: runner.id, deviceIds: runner.deviceIds });
  }
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
  const byId = new Map(participants.map((p) => [p.id, p] as const));
  const slots = slotCount(entry);
  const slotNames = Array.from({ length: slots }, (_, i) => slotName(entry, i + 1));
  const climb = route.cumM.length ? climbFn(route) : NO_CLIMB;

  const segments = onCourseTimeline(event.kind, entry, input.handoffs, event.startTime, asOf);
  const build = buildProgressSeries(route, segments, entry, positions);
  const { series } = build;
  const progressM = lastProgress(series);

  const finishTarget = Math.max(0, lengthM - COMPUTE_RULES.finishToleranceM);
  const finished = lengthM > 0 && progressM >= finishTarget;
  const finishedAtMs = finished ? timeAtProgress(series, finishTarget) : null;

  /* Who holds each slot right now (nobody once finished), and the ids of
   * everyone on course for the participant flags and the dot. */
  const holders = finished ? Array.from({ length: slots }, () => null) : holdersAt(segments, asOfMs, slots);
  const holderIds = holders.map((h) => (h ? h.participantId : null));
  const onCourseIds = new Set(holderIds.filter((id): id is string => id !== null));
  /* The finishers ran the legs still open at the finish instant: after the
   * clamp those are the segments ending exactly at finished_at, slot order.
   * Nobody is on course any more, but the dot is still theirs. */
  const finishTimeline = finishedAtMs === null ? [] : clampToFinish(segments, finishedAtMs);
  const finisherIds = finishTimeline
    .filter((s) => s.toMs === finishedAtMs)
    .sort((a, b) => a.slot - b.slot)
    .map((s) => s.participantId);

  const legs =
    event.kind === "relay"
      ? relayLegs(segments, series, asOfMs, finishedAtMs, climb)
      : participants[0]
        ? soloLegs(participants[0].id, series, checkpoints, lengthM, startMs, asOfMs, finishedAtMs, climb)
        : [];
  const liveLegs = legs.filter((l) => l.live).sort((a, b) => a.slot - b.slot);

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

  const onCourse: SnapshotOnCourse[] = [];
  for (const l of liveLegs) {
    const p = byId.get(l.participantId);
    if (!p) continue;
    onCourse.push({
      participant_id: p.id,
      name: p.name,
      initials: p.initials,
      slot: l.slot,
      slot_name: slotNames[l.slot - 1] ?? String(l.slot),
      leg_no: l.no,
      leg_started: iso(l.startMs),
      leg_distance_m: r0(l.distanceM),
      leg_time_s: r0(l.timeS),
      leg_pace_s_per_km: roundOrNull(l.paceSPerKm),
    });
  }

  const snapshotEntry: SnapshotEntry = {
    id: entry.id,
    name: entry.name,
    short_name: entry.shortName,
    color: entry.color,
    route_id: routeId,
    position: resolvePosition(route, entry, finished ? finisherIds : holderIds.filter((id): id is string => id !== null), latest, asOfMs, progressM, finished),
    progress_m: r0(progressM),
    remaining_m: r0(remainingM),
    percent: finished ? 100 : lengthM > 0 ? r1(Math.max(0, Math.min(100, (progressM / lengthM) * 100))) : 0,
    elapsed_s: r0(elapsedS),
    avg_pace_s_per_km: roundOrNull(avgPace),
    finished,
    finished_at: finishedAtMs === null ? null : iso(finishedAtMs),
    slots,
    slot_names: slotNames,
    on_course: onCourse,
    next_up: nextUp(event.kind, participants, holderIds, slots, finished),
    elevation_gain_m: r0(climb(0, progressM)),
    elevation_remaining_m: finished ? 0 : r0(climb(progressM, lengthM)),
    eta,
    checkpoints: checkpointRows(checkpoints, series, lengthM, progressM, etaPaceUsed, asOf),
    participants: participantStats(entry, legs, onCourseIds, latest, positions),
    legs: legs
      .slice()
      .sort((a, b) => b.no - a.no)
      .map(
        (l): SnapshotLeg => ({
          no: l.no,
          participant_id: l.participantId,
          slot: l.slot,
          start: iso(l.startMs),
          end: l.live ? null : iso(l.endMs),
          distance_m: r0(l.distanceM),
          time_s: r0(l.timeS),
          pace_s_per_km: roundOrNull(l.paceSPerKm),
          elevation_gain_m: r0(l.elevationGainM),
          live: l.live,
          ...(event.kind === "solo" ? { checkpoint_id: l.checkpointId } : {}),
        }),
      ),
    bests: bestsOf(legs),
  };

  return { entry: snapshotEntry, series, progressM, finished, build };
}

/**
 * Relay: per slot, the roster walked in sort order from the one holding it
 * (from the slot's own place for an empty slot: the first runner before the
 * first handoff, the second for slot B), wrapping round, to the first
 * runner NOT on course in any slot — and not already named next for an
 * earlier slot, so a pair's two "next"s are two people. Review 2026-10-15
 * (finding #3): the old rule walked the roster `slots` places at a time,
 * which with the holders out of phase ([R1, R3]) named A's next as R3, who
 * was running, and skipped R2 and R4 altogether. One entry for every slot,
 * null when nobody can be next: the entry has finished, the roster has
 * nobody else, or it is a solo entry.
 */
export function nextUp(
  kind: EventKind,
  participantsSorted: ComputeParticipant[],
  holderIds: readonly (string | null)[],
  slots: number,
  finished: boolean,
): (SnapshotNextUp | null)[] {
  const n = participantsSorted.length;
  const taken = new Set(holderIds.filter((id): id is string => id !== null));
  return Array.from({ length: slots }, (_, i): SnapshotNextUp | null => {
    if (kind !== "relay" || finished || n === 0) return null;
    const holderId = holderIds[i] ?? null;
    const j = holderId === null ? -1 : participantsSorted.findIndex((p) => p.id === holderId);
    const start = j < 0 ? i : j + 1;
    for (let k = 0; k < n; k++) {
      const cand = participantsSorted[(start + k) % n];
      if (taken.has(cand.id)) continue;
      taken.add(cand.id);
      return { participant_id: cand.id, name: cand.name, initials: cand.initials };
    }
    return null;
  });
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
