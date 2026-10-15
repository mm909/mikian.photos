import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { buildRouteIndex, storedPointsFromJson } from "./routeIndex";
import { INGEST_RULES } from "./types";
import type { CheckpointKind, EventKind, RouteIndex, Snapshot, Units } from "./types";
import { computeSnapshot, onCourseTimeline } from "./compute";
import type { ComputeCheckpoint, ComputeEntry, ComputeHandoff, ComputeInput, ComputeParticipant, Fix } from "./compute";

/**
 * The snapshot builder (TRACKER_SPEC.md §10): loads an event's positions,
 * handoffs, routes and checkpoints, runs compute.ts, and stores the result
 * in TrackerSnapshot. The read API serves what is stored and rebuilds when
 * it is older than SNAPSHOT_MAX_AGE_S; ingest rebuilds after a write, but
 * never more than once per SNAPSHOT_DEBOUNCE_S.
 *
 * A full recompute on every build is the chosen design. What keeps it
 * bounded — review 2026-10-06: loading every row of every bound device since
 * start − 1 h was "vans at ~1 Hz, off-course phones all day → 100k+ rows by
 * hour 12", of which compute reads only on-course runner fixes, baton fixes
 * and the newest fix per device:
 *  - the densified route (~10k points, ~400 KB of JSON) is parsed once per
 *    process and cached by route id + sourceHash, so a build only re-reads
 *    the points when sync.ts stored a new GPX;
 *  - handoffs are loaded first and give each participant's on-course
 *    windows; runner fixes are loaded ONLY inside their own participant's
 *    windows (one query, one clause per device × window), plus the baton
 *    devices' whole history — exactly the fixes that can move progress. For
 *    a 16 h relay that is ~6 fixes/min, a few thousand rows, in fixTime
 *    order with only the six columns compute.ts reads;
 *  - the newest fix of every bound device (runner, baton, vehicle) comes
 *    from one DISTINCT ON query over the (deviceId, fixTime desc) index, so
 *    the dot's fallback chain and the device checks still see a van or an
 *    idle phone without its history;
 *  - concurrent callers in one process share one in-flight build.
 *
 * Errors never reach the API routes as exceptions: a failed load or store is
 * logged and the caller gets null (or the last stored snapshot, when the
 * read path has one — a stale picture beats a blank page).
 */

export const SNAPSHOT_MAX_AGE_S = 15;
export const SNAPSHOT_DEBOUNCE_S = 5;

export type StoredSnapshot = { snapshot: Snapshot; generatedAt: Date; buildMs: number };

/* ─── Route index cache ───────────────────────────────────────────────────── */

type RouteMeta = { id: string; sourceHash: string; pointCount: number };
const routeCache = new Map<string, { sourceHash: string; pointCount: number; index: RouteIndex }>();

async function loadRouteIndexes(routes: RouteMeta[]): Promise<Map<string, RouteIndex>> {
  const out = new Map<string, RouteIndex>();
  const missing: string[] = [];
  for (const r of routes) {
    const hit = routeCache.get(r.id);
    if (hit && hit.sourceHash === r.sourceHash && hit.pointCount === r.pointCount) out.set(r.id, hit.index);
    else missing.push(r.id);
  }
  if (missing.length) {
    const rows = await db.trackerRoute.findMany({
      where: { id: { in: missing } },
      select: { id: true, sourceHash: true, pointCount: true, points: true },
    });
    for (const row of rows) {
      const index = buildRouteIndex(storedPointsFromJson(row.points));
      routeCache.set(row.id, { sourceHash: row.sourceHash, pointCount: row.pointCount, index });
      out.set(row.id, index);
    }
  }
  return out;
}

/** For tests/dev tooling that swap a GPX under a running process. */
export function clearRouteIndexCache(): void {
  routeCache.clear();
}

/* ─── Loading ─────────────────────────────────────────────────────────────── */

type PositionRow = { deviceId: string; fixTime: Date; lat: number; lon: number; accuracyM: number | null; batteryPct: number | null };
const POSITION_SELECT = { deviceId: true, fixTime: true, lat: true, lon: true, accuracyM: true, batteryPct: true } as const;

const toFix = (r: PositionRow): Fix => ({ fixTime: r.fixTime, lat: r.lat, lon: r.lon, accuracyM: r.accuracyM, batteryPct: r.batteryPct });

/**
 * Everything compute.ts needs for one event, as of `generatedAt` minus the
 * event's public delay. Null when the event does not exist. Exported so the
 * dev stats and the simulator can inspect what a build saw. `fixCount` is
 * the history rows loaded (on-course runner + baton fixes); `latestCount`
 * the devices that have ever reported.
 */
export async function loadComputeInput(slug: string, generatedAt: Date): Promise<{ input: ComputeInput; fixCount: number; latestCount: number } | null> {
  const event = await db.trackerEvent.findUnique({
    where: { id: slug },
    include: {
      routes: {
        select: {
          id: true,
          sourceHash: true,
          pointCount: true,
          checkpoints: {
            select: { id: true, name: true, kind: true, routeM: true, sortOrder: true },
            orderBy: [{ sortOrder: "asc" }, { routeM: "asc" }],
          },
        },
      },
      entries: {
        orderBy: { sortOrder: "asc" },
        include: { participants: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, initials: true, sortOrder: true } } },
      },
      devices: { select: { id: true, role: true, participantId: true, entryId: true } },
    },
  });
  if (!event) return null;

  const asOf = new Date(generatedAt.getTime() - Math.max(0, event.publicDelayS) * 1000);
  const routes = await loadRouteIndexes(event.routes);
  const defaultRouteId = event.defaultRouteId ?? event.routes[0]?.id ?? "";

  /* Entries, participants and their devices. A runner device hangs off its
   * participant; vehicle and baton devices off their entry. A device bound
   * to nothing (or to a role it should not have) cannot move anything, so
   * it is left out of the input and its fixes are not loaded; the devices
   * API reads TrackerPosition itself for the join page's check. */
  const entries: ComputeEntry[] = event.entries.map((e) => ({
    id: e.id,
    name: e.name,
    shortName: e.shortName,
    color: e.color,
    routeId: e.routeId,
    sortOrder: e.sortOrder,
    participants: e.participants.map((p): ComputeParticipant => ({ ...p, deviceIds: [] })),
    vehicleDeviceIds: [],
    batonDeviceIds: [],
    // Pairs (owner, 2026-10-15): how many runners hold the course at once and
    // what the slots are called; compute.ts labels unnamed slots "1", "2", …
    slots: e.slots,
    slotNames: e.slotNames,
  }));
  const byEntry = new Map(entries.map((e) => [e.id, e] as const));
  const byParticipant = new Map<string, ComputeParticipant>();
  for (const e of entries) for (const p of e.participants) byParticipant.set(p.id, p);
  for (const d of event.devices) {
    if (d.role === "runner" && d.participantId) byParticipant.get(d.participantId)?.deviceIds.push(d.id);
    else if (d.role === "vehicle" && d.entryId) byEntry.get(d.entryId)?.vehicleDeviceIds.push(d.id);
    else if (d.role === "baton" && d.entryId) byEntry.get(d.entryId)?.batonDeviceIds.push(d.id);
  }

  /* Handoffs first: they say when each participant was on course (and in
   * which slot), which is the only time that participant's fixes can move
   * progress. */
  const handoffs: ComputeHandoff[] = await db.trackerHandoff.findMany({
    where: { entryId: { in: entries.map((e) => e.id) }, time: { lte: asOf } },
    select: { id: true, entryId: true, participantId: true, time: true, voided: true, slot: true },
  });

  /* The on-course windows come from the same timeline compute.ts uses, so
   * the two agree on voided and duplicate taps: relay → per slot, each
   * non-voided handoff to that slot's next, the last to as-of; solo → start
   * to as-of. A participant may hold several, in any slot (the timeline is
   * flat, one segment per span). One clause per (runner device, window);
   * the baton devices' whole history, since a baton fix moves progress
   * whoever is carrying it. The lower bound matches the ingest rule (start −
   * 1 h); the upper bound is the as-of instant, so a public delay hides
   * newer fixes at the source. */
  const since = new Date(event.startTime.getTime() - INGEST_RULES.beforeStartS * 1000);
  const historyOr: Prisma.TrackerPositionWhereInput[] = [];
  const batonIds: string[] = [];
  const allDeviceIds: string[] = [];
  for (const e of entries) {
    const segments = onCourseTimeline(event.kind as EventKind, e, handoffs, event.startTime, asOf);
    for (const p of e.participants) {
      allDeviceIds.push(...p.deviceIds);
      for (const s of segments) {
        if (s.participantId !== p.id) continue;
        const fixTime = { gte: new Date(Math.max(s.fromMs, since.getTime())), lte: new Date(s.toMs ?? asOf.getTime()) };
        for (const d of p.deviceIds) historyOr.push({ deviceId: d, fixTime });
      }
    }
    batonIds.push(...e.batonDeviceIds);
    allDeviceIds.push(...e.vehicleDeviceIds, ...e.batonDeviceIds);
  }
  if (batonIds.length) historyOr.push({ deviceId: { in: batonIds }, fixTime: { gte: since, lte: asOf } });

  const historyQ: Promise<PositionRow[]> = historyOr.length
    ? db.trackerPosition.findMany({ where: { OR: historyOr }, select: POSITION_SELECT, orderBy: { fixTime: "asc" } })
    : Promise.resolve([]);
  /* The newest fix per device, for every bound device: the dot falls back
   * to the van, and the join page reads device_last_seen, with no history
   * loaded. Raw DISTINCT ON rather than Prisma's `distinct`: without the
   * nativeDistinct preview feature Prisma 5 fetches every matching row and
   * de-duplicates in the query engine, which is the very load this avoids.
   * DISTINCT ON walks the (deviceId, fixTime desc) index, one row per device. */
  const latestQ: Promise<PositionRow[]> = allDeviceIds.length
    ? db.$queryRaw<PositionRow[]>(Prisma.sql`
        SELECT DISTINCT ON ("deviceId") "deviceId", "fixTime", "lat", "lon", "accuracyM", "batteryPct"
        FROM "TrackerPosition"
        WHERE "deviceId" IN (${Prisma.join(allDeviceIds)}) AND "fixTime" <= ${asOf}
        ORDER BY "deviceId", "fixTime" DESC
      `)
    : Promise.resolve([]);
  const [rows, latestRows] = await Promise.all([historyQ, latestQ]);

  const positions = new Map<string, Fix[]>();
  for (const r of rows) {
    let list = positions.get(r.deviceId);
    if (!list) positions.set(r.deviceId, (list = []));
    list.push(toFix(r));
  }
  const latestFix = new Map<string, Fix>();
  for (const r of latestRows) latestFix.set(r.deviceId, toFix(r));

  const checkpoints = new Map<string, ComputeCheckpoint[]>();
  for (const r of event.routes) {
    checkpoints.set(
      r.id,
      r.checkpoints.map((c) => ({ id: c.id, name: c.name, kind: c.kind as CheckpointKind, routeM: c.routeM, sortOrder: c.sortOrder })),
    );
  }

  return {
    input: {
      event: {
        id: event.id,
        name: event.name,
        kind: event.kind as EventKind,
        units: event.units as Units,
        timezone: event.timezone,
        startTime: event.startTime,
        publicDelayS: event.publicDelayS,
        status: event.status,
      },
      routes,
      defaultRouteId,
      entries,
      checkpoints,
      positions,
      latestFix,
      handoffs,
      asOf,
      generatedAt,
    },
    fixCount: rows.length,
    latestCount: latestRows.length,
  };
}

/* ─── Building ────────────────────────────────────────────────────────────── */

const inflight = new Map<string, Promise<StoredSnapshot | null>>();

/** Build now (as of now minus the event's public delay), store, return. */
export async function rebuildSnapshot(slug: string): Promise<StoredSnapshot | null> {
  const running = inflight.get(slug);
  if (running) return running;
  const p = buildAndStore(slug).finally(() => inflight.delete(slug));
  inflight.set(slug, p);
  return p;
}

async function buildAndStore(slug: string): Promise<StoredSnapshot | null> {
  const t0 = Date.now();
  const generatedAt = new Date(t0);
  let built: { snapshot: Snapshot; asOf: Date; fixCount: number; latestCount: number; handoffCount: number };
  try {
    const loaded = await loadComputeInput(slug, generatedAt);
    if (!loaded) return null;
    built = {
      snapshot: computeSnapshot(loaded.input),
      asOf: loaded.input.asOf,
      fixCount: loaded.fixCount,
      latestCount: loaded.latestCount,
      handoffCount: loaded.input.handoffs.length,
    };
  } catch (err) {
    console.error(`[tracker] snapshot ${slug}: build failed`, err);
    return null;
  }
  const buildMs = Date.now() - t0;
  const json = built.snapshot as unknown as Prisma.InputJsonValue;
  try {
    await db.trackerSnapshot.upsert({
      where: { eventId: slug },
      create: { eventId: slug, generatedAt, asOf: built.asOf, json, buildMs },
      update: { generatedAt, asOf: built.asOf, json, buildMs },
    });
  } catch (err) {
    // The snapshot is still good; the next poll will try to store again.
    console.error(`[tracker] snapshot ${slug}: store failed`, err);
  }
  console.log(
    `[tracker] snapshot ${slug}: ${built.fixCount} on-course fixes, ${built.latestCount} devices seen, ${built.handoffCount} handoffs, ${built.snapshot.entries.length} entries → ${buildMs} ms`,
  );
  return { snapshot: built.snapshot, generatedAt, buildMs };
}

/* ─── Reading ─────────────────────────────────────────────────────────────── */

function isSnapshotJson(v: unknown): v is Snapshot {
  return typeof v === "object" && v !== null && Array.isArray((v as { entries?: unknown }).entries) && typeof (v as { event?: unknown }).event === "object";
}

async function readStored(slug: string): Promise<StoredSnapshot | null> {
  try {
    const row = await db.trackerSnapshot.findUnique({ where: { eventId: slug } });
    if (!row || !isSnapshotJson(row.json)) return null;
    return { snapshot: row.json, generatedAt: row.generatedAt, buildMs: row.buildMs };
  } catch (err) {
    console.error(`[tracker] snapshot ${slug}: read failed`, err);
    return null;
  }
}

/**
 * Return the stored snapshot, rebuilding first when it is missing or older
 * than `maxAgeS` (default SNAPSHOT_MAX_AGE_S). Null for an unknown event.
 * When a rebuild fails but an older snapshot exists, that one is returned:
 * its generated_at tells the page how old it is.
 */
export async function ensureFreshSnapshot(slug: string, maxAgeS: number = SNAPSHOT_MAX_AGE_S): Promise<StoredSnapshot | null> {
  const stored = await readStored(slug);
  if (stored && Date.now() - stored.generatedAt.getTime() <= maxAgeS * 1000) return stored;
  const fresh = await rebuildSnapshot(slug);
  return fresh ?? stored;
}

/** After an ingest: rebuild unless a snapshot younger than the debounce exists. */
export async function snapshotAfterIngest(slug: string): Promise<void> {
  try {
    const row = await db.trackerSnapshot.findUnique({ where: { eventId: slug }, select: { generatedAt: true } });
    if (row && Date.now() - row.generatedAt.getTime() < SNAPSHOT_DEBOUNCE_S * 1000) return;
  } catch (err) {
    console.error(`[tracker] snapshot ${slug}: debounce read failed`, err);
  }
  await rebuildSnapshot(slug);
}
