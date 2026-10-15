/**
 * Synthetic routes, fixes and events for the tracker's unit tests
 * (compute.test.ts, routeIndex.test.ts) and for anyone poking at the compute
 * core from a script. No vitest import here, so it is plain app code that
 * tsc checks; it is never bundled by a page.
 *
 * Geometry: a flat local frame around (34.0, −118.5). One degree of latitude
 * is R·π/180 ≈ 111 195 m; a metre east is that divided by cos(lat).
 */

import { buildRouteIndex, densify, pointAtRouteM } from "./routeIndex";
import type { EventKind, RouteIndex, Units } from "./types";
import type { ComputeCheckpoint, ComputeEntry, ComputeEvent, ComputeHandoff, ComputeInput, Fix } from "./compute";

export const LAT0 = 34.0;
export const LON0 = -118.5;
export const M_PER_DEG_LAT = (6371000 * Math.PI) / 180;
const DEG = Math.PI / 180;

/** The event start used by every scenario: 2026-10-23 12:00 UTC. */
export const T0 = Date.UTC(2026, 9, 23, 12, 0, 0);
export const MIN = 60_000;
/** `at(25)` = 25 minutes after the start, as a Date. */
export const at = (minutes: number): Date => new Date(T0 + minutes * MIN);
export const atIso = (minutes: number): string => at(minutes).toISOString();

export const ROUTE_ID = "test:route:main";

/** A straight route due north from (LAT0, LON0), densified to ≤ 25 m. */
export function northRoute(lengthM: number): RouteIndex {
  return buildRouteIndex(
    densify([
      { lat: LAT0, lon: LON0, ele: 0 },
      { lat: LAT0 + lengthM / M_PER_DEG_LAT, lon: LON0, ele: 0 },
    ]),
  );
}

/**
 * A straight route due north with an elevation profile: `[metres along,
 * elevation]` breakpoints, interpolated linearly between them by densify.
 * `profileRoute([[0, 0], [5000, 100], [10_000, 50]])` climbs 100 m over the
 * first 5 km and drops 50 m over the next 5.
 */
export function profileRoute(profile: [number, number][]): RouteIndex {
  return buildRouteIndex(densify(profile.map(([m, ele]) => ({ lat: LAT0 + m / M_PER_DEG_LAT, lon: LON0, ele }))));
}

/**
 * North `legM`, a `gapM` jog east, then back south: the outbound and return
 * passes run `gapM` apart, which is what the snapping window must resolve.
 * Length ≈ 2·legM + gapM.
 */
export function outAndBackRoute(legM: number, gapM: number): RouteIndex {
  const dLon = gapM / (M_PER_DEG_LAT * Math.cos(LAT0 * DEG));
  const top = LAT0 + legM / M_PER_DEG_LAT;
  return buildRouteIndex(
    densify([
      { lat: LAT0, lon: LON0, ele: 0 },
      { lat: top, lon: LON0, ele: 0 },
      { lat: top, lon: LON0 + dLon, ele: 0 },
      { lat: LAT0, lon: LON0 + dLon, ele: 0 },
    ]),
  );
}

/** A fix `m` metres along the route (optionally shifted east), at a Date or epoch ms. */
export function fixOnRoute(
  route: RouteIndex,
  m: number,
  t: Date | number,
  opts: { eastM?: number; battery?: number | null; accuracy?: number } = {},
): Fix {
  const p = pointAtRouteM(route, m);
  const eastM = opts.eastM ?? 0;
  return {
    fixTime: t instanceof Date ? t : new Date(t),
    lat: p.lat,
    lon: p.lon + eastM / (M_PER_DEG_LAT * Math.cos(p.lat * DEG)),
    accuracyM: opts.accuracy ?? 10,
    batteryPct: opts.battery === undefined ? 80 : opts.battery,
  };
}

/**
 * Constant-pace fixes along the route from `fromM` to `toM`, starting
 * `fromMin` minutes after T0, one every `everyS` seconds (default 30). The
 * last fix lands exactly on `toM` when the duration divides evenly.
 */
export function walk(
  route: RouteIndex,
  o: { fromM: number; toM: number; fromMin: number; paceSPerKm: number; everyS?: number; battery?: number | null },
): Fix[] {
  const everyS = o.everyS ?? 30;
  const speed = 1000 / o.paceSPerKm; // m/s
  const durS = (o.toM - o.fromM) / speed;
  const n = Math.floor(durS / everyS + 1e-9);
  const out: Fix[] = [];
  for (let i = 0; i <= n; i++) {
    const s = i * everyS;
    out.push(fixOnRoute(route, o.fromM + speed * s, T0 + o.fromMin * MIN + s * 1000, { battery: o.battery }));
  }
  return out;
}

/** Stationary fixes at `m`, from `fromMin` to `toMin`, one every `everyS`. */
export function stand(route: RouteIndex, o: { m: number; fromMin: number; toMin: number; everyS?: number }): Fix[] {
  const everyS = o.everyS ?? 30;
  const out: Fix[] = [];
  for (let s = 0; s <= (o.toMin - o.fromMin) * 60 + 1e-9; s += everyS) {
    out.push(fixOnRoute(route, o.m, T0 + o.fromMin * MIN + s * 1000));
  }
  return out;
}

/**
 * An entry with `n` participants. Ids: entry `e:A`, participants `p:A1…`,
 * runner devices `d:A1…`, vehicle `d:van-A`, baton `d:baton-A` (if asked).
 * One slot (a classic relay) unless `slots` says otherwise; `slotNames`
 * default to none, so compute labels the slots "1", "2", …
 */
export function mkEntry(
  short: string,
  n: number,
  opts: { vehicle?: boolean; baton?: boolean; sortOrder?: number; routeId?: string | null; slots?: number; slotNames?: string[] } = {},
): ComputeEntry {
  const participants = Array.from({ length: n }, (_, i) => ({
    id: `p:${short}${i + 1}`,
    name: `Runner ${short}${i + 1}`,
    initials: `${short}${i + 1}`,
    sortOrder: i,
    deviceIds: [`d:${short}${i + 1}`],
  }));
  return {
    id: `e:${short}`,
    name: `Team ${short}`,
    shortName: short,
    color: short === "A" ? "#D4FF3A" : "#FF6A3D",
    routeId: opts.routeId ?? null,
    sortOrder: opts.sortOrder ?? (short === "A" ? 0 : 1),
    participants,
    vehicleDeviceIds: opts.vehicle === false ? [] : [`d:van-${short}`],
    batonDeviceIds: opts.baton ? [`d:baton-${short}`] : [],
    slots: opts.slots ?? 1,
    slotNames: opts.slotNames ?? [],
  };
}

/** start · Mid (5 km) · Far (12 km, or 25 km on a 30 km route) · finish. */
export function mkCheckpoints(lengthM: number): ComputeCheckpoint[] {
  const far = lengthM >= 30_000 ? 25_000 : 12_000;
  return [
    { id: "cp:1", name: "Start", kind: "start", routeM: 0, sortOrder: 0 },
    { id: "cp:2", name: "Mid", kind: "town", routeM: 5000, sortOrder: 1 },
    { id: "cp:3", name: "Far", kind: "town", routeM: far, sortOrder: 2 },
    { id: "cp:4", name: "Finish", kind: "finish", routeM: lengthM, sortOrder: 3 },
  ];
}

let handoffSeq = 0;
/** A tap at `minutes` after T0; `slot` 1 unless the entry runs pairs. */
export function mkHandoff(entryId: string, participantId: string, minutes: number, voided = false, slot = 1): ComputeHandoff {
  return { id: `h:${++handoffSeq}`, entryId, participantId, time: at(minutes), voided, slot };
}

export interface ScenarioOpts {
  route: RouteIndex;
  entries: ComputeEntry[];
  positions: Record<string, Fix[]>;
  /** The newest fix per device, as snapshot.ts loads it (history is not loaded for a van or an idle phone). */
  latestFix?: Record<string, Fix>;
  handoffs?: ComputeHandoff[];
  /** Minutes after T0 the snapshot describes. */
  asOfMin: number;
  /** Minutes after T0 the snapshot is built; defaults to asOfMin (no public delay). */
  generatedAtMin?: number;
  kind?: EventKind;
  units?: Units;
  publicDelayS?: number;
  status?: string;
  checkpoints?: ComputeCheckpoint[];
}

export function mkEvent(o: Partial<ComputeEvent> = {}): ComputeEvent {
  return {
    id: "test",
    name: "Test event",
    kind: "relay",
    units: "imperial",
    timezone: "America/Los_Angeles",
    startTime: at(0),
    publicDelayS: 0,
    status: "live",
    ...o,
  };
}

export function mkInput(o: ScenarioOpts): ComputeInput {
  return {
    event: mkEvent({ kind: o.kind ?? "relay", units: o.units ?? "imperial", publicDelayS: o.publicDelayS ?? 0, status: o.status ?? "live" }),
    routes: new Map([[ROUTE_ID, o.route]]),
    defaultRouteId: ROUTE_ID,
    entries: o.entries,
    checkpoints: new Map([[ROUTE_ID, o.checkpoints ?? mkCheckpoints(o.route.lengthM)]]),
    positions: new Map(Object.entries(o.positions)),
    ...(o.latestFix ? { latestFix: new Map(Object.entries(o.latestFix)) } : {}),
    handoffs: o.handoffs ?? [],
    asOf: at(o.asOfMin),
    generatedAt: at(o.generatedAtMin ?? o.asOfMin),
  };
}
