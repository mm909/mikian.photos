import { MI, type CourseFile, type CourseTurn } from "./course";

/**
 * THE ETAs (owner, 2026-10-21: "I also want etas added to the route page
 * that will be filled in as we get more info like avg pace. We should
 * include an expected finish time at the bottom … we can include the etas on
 * the turn by turn area").
 *
 * NO PACE IS TYPED. The pace is INFERRED from the van's check-ins (owner,
 * same day: "the pace should be inferred from the van's location and current
 * duration of the race. I can input the drive time but I don't want to have
 * to input/guess an avg pace or have to click a 'start/end drive' button";
 * "we prob have to base ETA on the van's position? we won't have the
 * location of the current runners but we will have the occasional van check
 * ins. maybe we assume that we have used the time since the start to get to
 * the van's current location (even if the runners will be a mile behind)").
 *
 * So: the van's pin is snapped to the course → a run mile; the clock since
 * the start, less the Camp Pendleton drive if the van is past it, divided by
 * that mile is the pace; every call after the van is that many minutes away
 * from the pin's time. Until the first check-in the list shows a PLANNED
 * schedule at a default pace, labelled as such. Three settings, all
 * prefilled, drive it (TeamSettings.eta*): the start (5:00 AM PT Friday),
 * the drive in minutes (25), the planned pace (9:00/mi).
 *
 * Pure and isomorphic: the page computes on the client, the test script runs
 * it in Node (`npx tsx src/app/lasd26/route/eta.test.ts`).
 */

/** The gun, Friday 5:00 AM Pacific Daylight Time (events/lasd26.yaml start_time). */
export const RACE_START_ISO = "2026-10-23T05:00:00-07:00";
/** The race's own calendar day, for the start-time input. */
export const RACE_DAY = "2026-10-23";
export const RACE_TZ = "America/Los_Angeles";
/** The offset the race day runs on (PDT; the clocks change 2026-11-01). */
export const RACE_UTC_OFFSET = "-07:00";

export const DEFAULT_DRIVE_MIN = 25;
export const DEFAULT_PLAN_PACE_SEC = 9 * 60;

/** A van check-in farther off the running line than this is not on the course. */
export const OFF_COURSE_M = 1 * MI;
/** A van check-in closer to the start than this says nothing about the pace. */
export const MIN_PACE_MILE = 1;
/** A pace outside this window is a bad pin, not a pace. */
export const PACE_MIN_SEC = 4 * 60;
export const PACE_MAX_SEC = 20 * 60;

export type EtaSettings = {
  driveMin: number;
  /** ISO, or null for the planned start. */
  startAt: string | null;
  planPaceSec: number;
};

export const DEFAULT_ETA_SETTINGS: EtaSettings = { driveMin: DEFAULT_DRIVE_MIN, startAt: null, planPaceSec: DEFAULT_PLAN_PACE_SEC };

export type VanPin = {
  lat: number;
  lon: number;
  accuracyM: number;
  /** ISO. */
  at: string;
  byName: string;
};

/* ─── Geometry ───────────────────────────────────────────────────────────── */

const DEG = Math.PI / 180;
const R_EARTH = 6371000;

/** Metres east and north of (lat0, lon0) — flat, good for the few km we compare. */
function localXY(lat0: number, lon0: number, lat: number, lon: number): [number, number] {
  return [(lon - lon0) * Math.cos(lat0 * DEG) * R_EARTH * DEG, (lat - lat0) * R_EARTH * DEG];
}

/** Nearest point of a [lon, lat] polyline to (lat, lon): the segment, how far along it, how far off. */
function nearestOnLine(coords: [number, number][], lat: number, lon: number): { seg: number; t: number; offM: number } {
  let best = { seg: 0, t: 0, offM: Infinity };
  if (coords.length === 0) return best;
  if (coords.length === 1) {
    const [x, y] = localXY(lat, lon, coords[0][1], coords[0][0]);
    return { seg: 0, t: 0, offM: Math.hypot(x, y) };
  }
  // The point is the origin; every vertex is placed around it.
  let [ax, ay] = localXY(lat, lon, coords[0][1], coords[0][0]);
  for (let i = 1; i < coords.length; i++) {
    const [bx, by] = localXY(lat, lon, coords[i][1], coords[i][0]);
    const vx = bx - ax;
    const vy = by - ay;
    const len2 = vx * vx + vy * vy;
    let t = len2 > 0 ? (-ax * vx - ay * vy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(ax + vx * t, ay + vy * t);
    if (d < best.offM) best = { seg: i - 1, t, offM: d };
    ax = bx;
    ay = by;
  }
  return best;
}

export type Snap = {
  /** Run metres along the course at the nearest point of the running line. */
  routeM: number;
  /** How far the pin sits off the running line, metres. */
  offM: number;
  /** Index into course.coords of the segment's first point. */
  idx: number;
  /** The drives the snapped point is past (0 before Camp Pendleton, 1 after). */
  afterDrives: number;
  /** The pin is nearer the van's road through Camp Pendleton than the running line. */
  onDrive: boolean;
  /** How far along that road, 0..1 (0 when not on it). */
  driveFrac: number;
  /** How far the pin sits off the drive's road, metres (Infinity when the course has no routed drive). */
  driveOffM: number;
};

/** The polyline's cumulative length at each vertex, metres. */
function cumulative(coords: [number, number][]): number[] {
  const out = [0];
  for (let i = 1; i < coords.length; i++) {
    const [ax, ay] = localXY(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
    out.push(out[i - 1] + Math.hypot(ax, ay));
  }
  return out;
}

/**
 * Where a pin falls on the course. The running line first (every leg, with
 * the drive's jump skipped), then the drive's road: the pin counts as ON THE
 * DRIVE only when it is clearly nearer the road than the running line — at
 * the pickup and the restart both lines meet, and a van waiting there is on
 * the course, not on the road.
 */
export function snapToCourse(course: CourseFile, lat: number, lon: number): Snap {
  const n = course.coords.length;
  const drives = [...course.drives].sort((a, b) => a.at - b.at);
  let best = { seg: -1, t: 0, offM: Infinity };
  // Walk the running line segment by segment, never across a drive's jump.
  const jumps = new Set(drives.map((d) => d.at));
  let [ax, ay] = n ? localXY(lat, lon, course.coords[0][1], course.coords[0][0]) : [0, 0];
  for (let i = 1; i < n; i++) {
    const [bx, by] = localXY(lat, lon, course.coords[i][1], course.coords[i][0]);
    if (!jumps.has(i - 1)) {
      const vx = bx - ax;
      const vy = by - ay;
      const len2 = vx * vx + vy * vy;
      let t = len2 > 0 ? (-ax * vx - ay * vy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(ax + vx * t, ay + vy * t);
      if (d < best.offM) best = { seg: i - 1, t, offM: d };
    }
    ax = bx;
    ay = by;
  }
  const idx = Math.max(0, best.seg);
  const routeM = n === 0 ? 0 : best.seg < 0 ? 0 : course.cum_m[idx] + (course.cum_m[Math.min(n - 1, idx + 1)] - course.cum_m[idx]) * best.t;
  const afterDrives = drives.filter((d) => idx > d.at).length;

  let onDrive = false;
  let driveFrac = 0;
  let driveOffM = Infinity;
  const road = drives[0]?.coords;
  if (road && road.length >= 2) {
    const r = nearestOnLine(road, lat, lon);
    driveOffM = r.offM;
    const cum = cumulative(road);
    const total = cum[cum.length - 1] || 1;
    driveFrac = Math.max(0, Math.min(1, (cum[r.seg] + (cum[r.seg + 1] - cum[r.seg]) * r.t) / total));
    onDrive = driveOffM < OFF_COURSE_M && driveOffM + 50 < best.offM;
  }
  return { routeM, offM: best.offM, idx, afterDrives, onDrive, driveFrac, driveOffM };
}

/** The [lon, lat] of every whole run mile along the course, with its mile and a tier for the map's zooms. */
export function mileMarkers(course: CourseFile): { lon: number; lat: number; mile: number; tier: 1 | 5 | 10 }[] {
  const out: { lon: number; lat: number; mile: number; tier: 1 | 5 | 10 }[] = [];
  const n = course.coords.length;
  if (n < 2) return out;
  let i = 1;
  const last = Math.floor(course.length_m / MI);
  for (let mile = 1; mile <= last; mile++) {
    const target = mile * MI;
    while (i < n - 1 && course.cum_m[i] < target) i++;
    const a = i - 1;
    const span = course.cum_m[i] - course.cum_m[a];
    // A span of 0 is the drive's jump: the mile sits at its far end.
    const t = span > 0 ? Math.max(0, Math.min(1, (target - course.cum_m[a]) / span)) : 1;
    const lon = course.coords[a][0] + (course.coords[i][0] - course.coords[a][0]) * t;
    const lat = course.coords[a][1] + (course.coords[i][1] - course.coords[a][1]) * t;
    out.push({ lon, lat, mile, tier: mile % 10 === 0 ? 10 : mile % 5 === 0 ? 5 : 1 });
  }
  return out;
}

/* ─── The model ──────────────────────────────────────────────────────────── */

export type PaceModel = {
  /** plan: the default pace until a van check-in counts. van: inferred from the pin. */
  source: "plan" | "van";
  startAt: Date;
  driveMin: number;
  /** Seconds per run mile. */
  paceSec: number;
  /** The clock time the schedule is anchored to (the start, or the pin's time). */
  anchorAt: Date;
  /** Run seconds the schedule has used at the anchor (0 at the start). */
  anchorRunSec: number;
  /** The van's run mile at the anchor (0 for the plan). */
  anchorMile: number;
  /** What became of the pin: why it did not set the pace, or null. */
  pinNote: string | null;
  snap: Snap | null;
  pin: VanPin | null;
};

export function startOf(settings: EtaSettings): Date {
  const d = settings.startAt ? new Date(settings.startAt) : new Date(RACE_START_ISO);
  return Number.isNaN(d.getTime()) ? new Date(RACE_START_ISO) : d;
}

/** The schedule's run-clock seconds at a run mile, a given number of drives in. */
function runSec(paceSec: number, driveMin: number, mile: number, drives: number, driveFrac = 0): number {
  return mile * paceSec + (drives + driveFrac) * driveMin * 60;
}

/**
 * The pace the list runs at. The pin sets it when it is on the course (or
 * the drive's road), after the start, at least a mile in, and the pace it
 * implies is a running pace; otherwise the planned pace, with a note that
 * says why the pin did not count.
 */
export function paceModel(course: CourseFile, settings: EtaSettings, pin: VanPin | null): PaceModel {
  const startAt = startOf(settings);
  const driveMin = Math.max(0, settings.driveMin);
  const plan = (pinNote: string | null, snap: Snap | null): PaceModel => ({
    source: "plan",
    startAt,
    driveMin,
    paceSec: settings.planPaceSec,
    anchorAt: startAt,
    anchorRunSec: 0,
    anchorMile: 0,
    pinNote,
    snap,
    pin,
  });
  if (!pin) return plan(null, null);
  const at = new Date(pin.at);
  if (Number.isNaN(at.getTime())) return plan("The van's check-in has no time.", null);
  const snap = snapToCourse(course, pin.lat, pin.lon);
  if (at.getTime() <= startAt.getTime()) return plan("The van checked in before the start.", snap);
  if (!snap.onDrive && snap.offM > OFF_COURSE_M) return plan("The van is off the course.", snap);
  // On the drive the van has used the whole run to the pickup plus part of the ride.
  const anchorMile = snap.onDrive ? (course.drives[0]?.mile ?? snap.routeM / MI) : snap.routeM / MI;
  const drives = snap.onDrive ? 0 : snap.afterDrives;
  const driveFrac = snap.onDrive ? snap.driveFrac : 0;
  if (anchorMile < MIN_PACE_MILE) return plan("The van is still at the start.", snap);
  const elapsedSec = (at.getTime() - startAt.getTime()) / 1000;
  const runningSec = elapsedSec - (drives + driveFrac) * driveMin * 60;
  const paceSec = runningSec / anchorMile;
  if (!(paceSec >= PACE_MIN_SEC && paceSec <= PACE_MAX_SEC)) {
    return plan(`The van's check-in gives ${formatPace(paceSec)} — not a pace. Planned pace instead.`, snap);
  }
  return {
    source: "van",
    startAt,
    driveMin,
    paceSec,
    anchorAt: at,
    anchorRunSec: runSec(paceSec, driveMin, anchorMile, drives, driveFrac),
    anchorMile,
    pinNote: null,
    snap,
    pin,
  };
}

export type RowEta = { at: Date; passed: boolean };

/**
 * The ETA of every call, in list order: the mile at the pace, plus the drive
 * for every call from the restart on, measured from the anchor. The RESTART
 * is the pickup's time plus the ride — its own mile is the pickup's by
 * construction (the drive adds no run metres), whatever the organizer's pin
 * snapped to a few metres on. The list never runs backwards. A call whose
 * time is behind the clock is PASSED. The last row is the expected finish.
 */
export function rowEtas(course: CourseFile, model: PaceModel, now: Date): RowEta[] {
  let drives = 0;
  let pickupMile: number | null = null;
  let lastSec = -Infinity;
  return course.turns.map((t: CourseTurn) => {
    if (t.kind === "drive") pickupMile = t.mile;
    let mile = t.mile;
    if (t.kind === "restart") {
      drives++;
      if (pickupMile !== null) mile = pickupMile;
    }
    const sec = Math.max(lastSec, runSec(model.paceSec, model.driveMin, mile, drives) - model.anchorRunSec);
    lastSec = sec;
    const at = new Date(model.anchorAt.getTime() + sec * 1000);
    return { at, passed: at.getTime() <= now.getTime() };
  });
}

/**
 * Where the van's row goes in the list: after the last call it has passed.
 * null when the model has no usable pin. On the drive it sits after the
 * DRIVE call; past it, the restart's mile equals the pickup's, so the
 * drives-passed count breaks the tie.
 */
export function vanRowAfter(course: CourseFile, model: PaceModel): number | null {
  const snap = model.snap;
  if (!snap || model.source !== "van") return null;
  const vanKey = snap.onDrive ? [course.drives[0]?.mile ?? model.anchorMile, 0.5] : [model.anchorMile, snap.afterDrives];
  let after = -1;
  let drives = 0;
  course.turns.forEach((t, i) => {
    if (t.kind === "restart") drives++;
    const key = t.kind === "drive" ? [t.mile, 0.25] : [t.mile, drives];
    if (key[0] < vanKey[0] - 1e-9 || (Math.abs(key[0] - vanKey[0]) <= 1e-9 && key[1] <= vanKey[1])) after = i;
  });
  return after;
}

/* ─── Words ──────────────────────────────────────────────────────────────── */

const clockFmt = new Intl.DateTimeFormat("en-US", { timeZone: RACE_TZ, hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: RACE_TZ, weekday: "short" });
const dateKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: RACE_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** "7:42 AM", and "12:40 AM SAT" once the clock has crossed out of the race day. */
export function formatClock(d: Date, raceDay: Date = new Date(RACE_START_ISO)): string {
  const t = clockFmt.format(d);
  return dateKeyFmt.format(d) === dateKeyFmt.format(raceDay) ? t : `${t} ${dayFmt.format(d).toUpperCase()}`;
}

/** "8:52/MI". */
export function formatPace(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}/MI`;
}

/** "17 H 14 MIN" for a span in seconds. */
export function formatSpan(sec: number): string {
  const m = Math.max(0, Math.round(sec / 60));
  const h = Math.floor(m / 60);
  return h ? `${h} H ${String(m % 60).padStart(2, "0")} MIN` : `${m} MIN`;
}

/** "12 min ago", "just now", "2 h 05 min ago". */
export function formatAgo(from: Date, now: Date): string {
  const m = Math.round((now.getTime() - from.getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min ago`;
}

/** "9:00" ↔ 540; null for anything that is not m:ss or a whole number of minutes. */
export function parsePace(v: string): number | null {
  const s = v.trim();
  const m = /^(\d{1,2})(?::([0-5]\d))?$/.exec(s);
  if (!m) return null;
  const sec = Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0);
  return sec >= PACE_MIN_SEC && sec <= PACE_MAX_SEC ? sec : null;
}

/** 540 → "9:00", for the input. */
export function paceInput(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The start's "HH:MM" on the race day in Pacific time, for a <input type="time">. */
export function startTimeInput(settings: EtaSettings): string {
  const d = startOf(settings);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: RACE_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return parts.replace(/^24/, "00");
}

/** "HH:MM" on the race day → the ISO the settings store, or null for a bad value. */
export function startIsoFromTime(hhmm: string): string | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  if (!m) return null;
  return `${RACE_DAY}T${m[1]}:${m[2]}:00${RACE_UTC_OFFSET}`;
}
