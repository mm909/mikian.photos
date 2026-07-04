import "server-only";
import { db } from "./db";

/**
 * Relay route tracker data assembly (TSP France).
 *
 * Reads the Relay* tables and computes everything the public page shows:
 * per-runner stats, team totals, and waypoint ETAs. Fails OPEN — if the tables
 * aren't migrated yet (`prisma db push` pending) every read collapses to an
 * empty tracker with `ready: false`, so the page renders a friendly empty
 * state instead of a 500.
 *
 * ETA model (deliberately simple, labeled "at current moving pace" in the UI):
 *   pace = team total moving time / team total completed distance.
 *   remaining distance to a waypoint = distance ALONG THE PLANNED LINE from
 *   the team's current position (end of the latest completed segment) to the
 *   waypoint's nearest point on that line. When there's no planned line (or
 *   the waypoint sits far off it), fall back to straight-line distance × 1.25
 *   (a mild windiness factor). No rest/night modeling — v1.
 */

export type RelayPoint = [lat: number, lng: number, ele: number];

export type RelaySegmentDto = {
  id: string;
  runnerId: string | null;
  name: string | null;
  kind: "completed" | "planned";
  points: RelayPoint[];
  distanceM: number;
  gainM: number;
  movingTimeSec: number | null;
  startedAt: string | null;
  endedAt: string | null;
  sortOrder: number;
  /** Route-planner binding: set on a planned segment LOCKED between two
   *  waypoints (see /tsp/plan). Null on completed legs / free-form plans. */
  fromWaypointId: string | null;
  toWaypointId: string | null;
};

export type RelayRunnerDto = {
  id: string;
  name: string;
  color: string;
  /** Optional profile link (Instagram, usually) — names link out when set. */
  url: string | null;
  sortOrder: number;
  // Computed from their completed segments:
  distanceM: number;
  gainM: number;
  movingTimeSec: number;
  segmentCount: number;
  /** Seconds per km at their average moving pace; null before any distance. */
  paceSecPerKm: number | null;
};

export type RelayWaypointDto = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  sortOrder: number;
  /** Meters left to this waypoint from the team's current position; null when
   *  it can't be computed (no pace yet), <= 0 when already passed. */
  remainingM: number | null;
  /** ISO timestamp of the estimated arrival at current moving pace. */
  etaAt: string | null;
  passed: boolean;
};

export type RelayData = {
  /** False when the Relay tables aren't in the DB yet (push pending). */
  ready: boolean;
  eventId: string;
  runners: RelayRunnerDto[];
  segments: RelaySegmentDto[];
  waypoints: RelayWaypointDto[];
  totals: {
    distanceM: number;
    gainM: number;
    movingTimeSec: number;
    paceSecPerKm: number | null;
    plannedDistanceM: number;
    /** Last completed-segment end (or upload) — the "updated N ago" stamp. */
    lastUpdatedAt: string | null;
  };
  /** The team's current position — end of the latest completed segment. */
  position: { lat: number; lng: number } | null;
};

const R_EARTH = 6371000;
function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(x));
}

/** Parse the stored Json into a well-formed point list (defensive). */
function asPoints(raw: unknown): RelayPoint[] {
  if (!Array.isArray(raw)) return [];
  const out: RelayPoint[] = [];
  for (const p of raw) {
    if (Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
      out.push([p[0], p[1], Number.isFinite(p[2]) ? p[2] : 0]);
    }
  }
  return out;
}

export async function getRelayData(eventId: string): Promise<RelayData> {
  const empty: RelayData = {
    ready: false,
    eventId,
    runners: [],
    segments: [],
    waypoints: [],
    totals: {
      distanceM: 0,
      gainM: 0,
      movingTimeSec: 0,
      paceSecPerKm: null,
      plannedDistanceM: 0,
      lastUpdatedAt: null,
    },
    position: null,
  };

  let runnersRaw, segmentsRaw, waypointsRaw;
  try {
    [runnersRaw, segmentsRaw, waypointsRaw] = await Promise.all([
      db.relayRunner.findMany({ where: { eventId }, orderBy: { sortOrder: "asc" } }),
      db.routeSegment.findMany({
        where: { eventId },
        orderBy: [{ sortOrder: "asc" }, { startedAt: "asc" }, { createdAt: "asc" }],
      }),
      db.routeWaypoint.findMany({ where: { eventId }, orderBy: { sortOrder: "asc" } }),
    ]);
  } catch {
    // Tables not migrated yet — render the empty tracker rather than 500.
    return empty;
  }

  const segments: RelaySegmentDto[] = segmentsRaw.map((s) => ({
    id: s.id,
    runnerId: s.runnerId,
    name: s.name,
    kind: s.kind === "planned" ? "planned" : "completed",
    points: asPoints(s.points),
    distanceM: s.distanceM,
    gainM: s.gainM,
    movingTimeSec: s.movingTimeSec,
    startedAt: s.startedAt?.toISOString() ?? null,
    endedAt: s.endedAt?.toISOString() ?? null,
    sortOrder: s.sortOrder,
    fromWaypointId: s.fromWaypointId ?? null,
    toWaypointId: s.toWaypointId ?? null,
  }));
  const completed = segments.filter((s) => s.kind === "completed");
  const planned = segments.filter((s) => s.kind === "planned");

  // Per-runner + team stats from completed segments.
  const runners: RelayRunnerDto[] = runnersRaw.map((r) => {
    const mine = completed.filter((s) => s.runnerId === r.id);
    const distanceM = mine.reduce((a, s) => a + s.distanceM, 0);
    const gainM = mine.reduce((a, s) => a + s.gainM, 0);
    const movingTimeSec = mine.reduce((a, s) => a + (s.movingTimeSec ?? 0), 0);
    return {
      id: r.id,
      name: r.name,
      color: r.color,
      url: r.url ?? null,
      sortOrder: r.sortOrder,
      distanceM,
      gainM,
      movingTimeSec,
      segmentCount: mine.length,
      paceSecPerKm:
        distanceM > 100 && movingTimeSec > 0 ? movingTimeSec / (distanceM / 1000) : null,
    };
  });

  const totalDistanceM = completed.reduce((a, s) => a + s.distanceM, 0);
  const totalGainM = completed.reduce((a, s) => a + s.gainM, 0);
  const totalMovingSec = completed.reduce((a, s) => a + (s.movingTimeSec ?? 0), 0);
  const teamPaceSecPerKm =
    totalDistanceM > 100 && totalMovingSec > 0 ? totalMovingSec / (totalDistanceM / 1000) : null;

  // Current position = end of the LATEST completed segment (by endedAt, then
  // upload order — segments without timestamps still advance the position).
  const latest = [...completed]
    .sort(
      (a, b) =>
        Date.parse(a.endedAt ?? "1970-01-01") - Date.parse(b.endedAt ?? "1970-01-01")
    )
    .pop();
  const lastPoint = latest?.points[latest.points.length - 1] ?? null;
  const position = lastPoint ? { lat: lastPoint[0], lng: lastPoint[1] } : null;

  // ---- Waypoint ETAs -----------------------------------------------------
  // Build the planned line (concatenated planned segments) with cumulative
  // distances so "distance along the plan" is a lookup.
  const plannedPts: RelayPoint[] = planned.flatMap((s) => s.points);
  const cum: number[] = new Array(plannedPts.length).fill(0);
  for (let i = 1; i < plannedPts.length; i++) {
    cum[i] =
      cum[i - 1] +
      haversineM(plannedPts[i - 1][0], plannedPts[i - 1][1], plannedPts[i][0], plannedPts[i][1]);
  }
  const plannedDistanceM = cum.length ? cum[cum.length - 1] : 0;

  /** Nearest planned-line point to (lat,lng) → { alongM, offM } or null. */
  function snapToPlan(lat: number, lng: number): { alongM: number; offM: number } | null {
    if (plannedPts.length === 0) return null;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < plannedPts.length; i++) {
      const d = haversineM(lat, lng, plannedPts[i][0], plannedPts[i][1]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return { alongM: cum[best], offM: bestD };
  }

  const nowMs = Date.now();
  const posSnap = position ? snapToPlan(position.lat, position.lng) : null;
  const waypoints: RelayWaypointDto[] = waypointsRaw.map((w) => {
    let remainingM: number | null = null;
    const wpSnap = snapToPlan(w.lat, w.lng);
    if (position) {
      // Prefer distance along the planned line when both the team and the
      // waypoint sit near it (within 2 km); else straight-line × 1.25.
      if (wpSnap && posSnap && wpSnap.offM < 2000 && posSnap.offM < 2000) {
        remainingM = wpSnap.alongM - posSnap.alongM;
      } else {
        remainingM = haversineM(position.lat, position.lng, w.lat, w.lng) * 1.25;
      }
    } else if (wpSnap) {
      // Nothing run yet — measure from the start of the plan.
      remainingM = wpSnap.alongM;
    }
    const passed = remainingM !== null && remainingM <= 0;
    const etaAt =
      !passed && remainingM !== null && teamPaceSecPerKm !== null
        ? new Date(nowMs + (remainingM / 1000) * teamPaceSecPerKm * 1000).toISOString()
        : null;
    return {
      id: w.id,
      name: w.name,
      lat: w.lat,
      lng: w.lng,
      sortOrder: w.sortOrder,
      remainingM,
      etaAt,
      passed,
    };
  });

  const lastUpdatedAt =
    latest?.endedAt ??
    (segmentsRaw.length
      ? segmentsRaw
          .map((s) => s.createdAt.toISOString())
          .sort()
          .pop()!
      : null);

  return {
    ready: true,
    eventId,
    runners,
    segments,
    waypoints,
    totals: {
      distanceM: totalDistanceM,
      gainM: totalGainM,
      movingTimeSec: totalMovingSec,
      paceSecPerKm: teamPaceSecPerKm,
      plannedDistanceM,
      lastUpdatedAt,
    },
    position,
  };
}
