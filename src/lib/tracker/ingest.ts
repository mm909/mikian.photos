/**
 * ingestFix / ingestFixes — the one door every position adapter uses
 * (TRACKER_SPEC.md §8). Traccar's webhook brings one fix at a time; the van
 * page and the REST backfill bring bursts of old fixes, oldest first, and
 * the newest may arrive last — that is the normal case here, not an error.
 *
 *   1. Resolve the device by (source, externalId). The same uniqueId may be
 *      configured for several events over the years; the live one wins
 *      (the non-archived event with the latest start). Unknown → dropped.
 *   2. Junk rules (ingestRules.ts, §8 rule 4) against THAT event's start.
 *   3. Best-effort snap to the entry's route for the map, with the window
 *      centred on the entry's progress from the stored snapshot. The
 *      snapshot build re-snaps on-course fixes in time order, which is
 *      what progress is actually computed from — so a wrong guess here
 *      costs nothing but a dot in the wrong place for a few seconds.
 *   4. Insert with ON CONFLICT DO NOTHING on (device, fixTime): a duplicate
 *      delivery is {ok, stored:false, reason:"duplicate"}, never an error.
 *
 * The caller gets the per-fix outcomes AND the event slugs touched, and is
 * the one to await snapshotAfterIngest(slug) for each — once per event, and
 * awaited: on serverless nothing fired-and-forgotten is guaranteed to run.
 * This module stays free of "server-only" so the simulator and the backfill
 * can import it under plain tsx.
 */

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { buildRouteIndex, snapToRoute, storedPointsFromJson } from "./routeIndex";
import { SNAP_RULES, type IngestOutcome, type NormalizedFix, type RouteIndex, type Snapshot } from "./types";
import { classifyFix, describeOutcomes, fixDedupeKey, fixTimeMs } from "./ingestRules";

export * from "./ingestRules";

export interface IngestResult {
  /** One per input fix, in input order. */
  outcomes: IngestOutcome[];
  /** Event slugs with at least one NEW row — rebuild their snapshots. */
  touched: string[];
  counts: ReturnType<typeof describeOutcomes>;
}

export interface IngestOptions {
  /** Only accept devices of this event (the crew-keyed web route: one event's key must not reach another event's device). */
  eventId?: string;
  /** The server clock, injectable for tests/replays. */
  now?: Date;
}

/* ─── Route index cache ──────────────────────────────────────────────────── */

const ROUTE_HASH_REVALIDATE_MS = 60_000;

type RouteCacheEntry = { index: RouteIndex; sourceHash: string; checkedAt: number };
const routeCache = new Map<string, RouteCacheEntry>();

/**
 * The densified route for a TrackerRoute id, kept in module memory. The 400 KB
 * points blob is only re-read when sourceHash changed, and the hash itself is
 * only re-checked once a minute — a webhook burst never pays for the blob.
 */
export async function routeIndexFor(routeId: string, now = Date.now()): Promise<RouteIndex | null> {
  const hit = routeCache.get(routeId);
  if (hit && now - hit.checkedAt < ROUTE_HASH_REVALIDATE_MS) return hit.index;
  if (hit) {
    const h = await db.trackerRoute.findUnique({ where: { id: routeId }, select: { sourceHash: true } });
    if (!h) {
      routeCache.delete(routeId);
      return null;
    }
    if (h.sourceHash === hit.sourceHash) {
      hit.checkedAt = now;
      return hit.index;
    }
  }
  const row = await db.trackerRoute.findUnique({ where: { id: routeId }, select: { points: true, sourceHash: true } });
  if (!row) return null;
  let index: RouteIndex;
  try {
    index = buildRouteIndex(storedPointsFromJson(row.points));
  } catch (err) {
    console.error(`tracker ingest: route ${routeId} has unreadable points`, err);
    return null;
  }
  routeCache.set(routeId, { index, sourceHash: row.sourceHash, checkedAt: now });
  return index;
}

/** For tests and the sync script after a route rewrite. */
export function forgetRouteIndex(routeId?: string): void {
  if (routeId) routeCache.delete(routeId);
  else routeCache.clear();
}

/* ─── Progress cache (snap window centre) ────────────────────────────────── */

const PROGRESS_REVALIDATE_MS = 10_000;

type ProgressCacheEntry = { byEntry: Map<string, number>; at: number };
const progressCache = new Map<string, ProgressCacheEntry>();

/** entry id → progress_m from the stored snapshot, ~10 s stale at most. Empty when there is no snapshot yet. */
export async function entryProgressFor(eventId: string, now = Date.now()): Promise<Map<string, number>> {
  const hit = progressCache.get(eventId);
  if (hit && now - hit.at < PROGRESS_REVALIDATE_MS) return hit.byEntry;
  const byEntry = new Map<string, number>();
  try {
    const snap = await db.trackerSnapshot.findUnique({ where: { eventId }, select: { json: true } });
    const entries = (snap?.json as Partial<Snapshot> | null)?.entries;
    if (Array.isArray(entries)) {
      for (const e of entries) {
        if (e && typeof e.id === "string" && typeof e.progress_m === "number" && Number.isFinite(e.progress_m)) {
          byEntry.set(e.id, e.progress_m);
        }
      }
    }
  } catch (err) {
    console.error(`tracker ingest: snapshot read failed for ${eventId}`, err);
  }
  progressCache.set(eventId, { byEntry, at: now });
  return byEntry;
}

/* ─── Device resolution ──────────────────────────────────────────────────── */

type ResolvedDevice = {
  id: string;
  eventId: string;
  entryId: string | null;
  routeId: string | null;
  startTime: Date;
};

type Unresolved = { reason: "unknown_device" | "archived_event" };

async function resolveDevice(source: string, externalId: string, eventId?: string): Promise<ResolvedDevice | Unresolved> {
  const rows = await db.trackerDevice.findMany({
    where: { source, externalId, ...(eventId ? { eventId } : {}) },
    select: {
      id: true,
      eventId: true,
      entryId: true,
      entry: { select: { routeId: true } },
      event: { select: { startTime: true, status: true, defaultRouteId: true } },
    },
  });
  if (rows.length === 0) return { reason: "unknown_device" };
  const live = rows.filter((r) => r.event.status !== "archived");
  if (live.length === 0) return { reason: "archived_event" };
  // The same phone id across several events: the one that started most
  // recently is the one being run now.
  live.sort((a, b) => b.event.startTime.getTime() - a.event.startTime.getTime());
  const d = live[0];
  return {
    id: d.id,
    eventId: d.eventId,
    entryId: d.entryId,
    routeId: d.entry?.routeId ?? d.event.defaultRouteId,
    startTime: d.event.startTime,
  };
}

/* ─── The batch ──────────────────────────────────────────────────────────── */

/**
 * Store a batch of fixes from any number of devices. Grouped by device so a
 * van flush costs one device lookup and one INSERT, not one per fix.
 */
export async function ingestFixes(fixes: readonly NormalizedFix[], opts: IngestOptions = {}): Promise<IngestResult> {
  const now = opts.now ?? new Date();
  const outcomes: IngestOutcome[] = new Array(fixes.length);
  const touched = new Set<string>();

  const groups = new Map<string, number[]>();
  fixes.forEach((f, i) => {
    const key = `${f.source}\u0000${f.externalId}`;
    const g = groups.get(key);
    if (g) g.push(i);
    else groups.set(key, [i]);
  });

  for (const idxs of groups.values()) {
    const first = fixes[idxs[0]];
    const device = await resolveDevice(first.source, first.externalId, opts.eventId);
    if ("reason" in device) {
      for (const i of idxs) outcomes[i] = { ok: false, reason: device.reason };
      continue;
    }

    // Junk rules, then dedupe inside the batch (ON CONFLICT would swallow
    // the second copy silently; we want to SAY it was a duplicate).
    const keep: number[] = [];
    const seen = new Set<string>();
    for (const i of idxs) {
      const reject = classifyFix(fixes[i], device.startTime, now);
      if (reject) {
        outcomes[i] = { ok: false, reason: reject };
        continue;
      }
      const k = fixDedupeKey(device.id, fixes[i]);
      if (seen.has(k)) {
        outcomes[i] = { ok: true, stored: false, reason: "duplicate", deviceId: device.id };
        continue;
      }
      seen.add(k);
      keep.push(i);
    }
    if (keep.length === 0) continue;

    // Best-effort snap for the map. Oldest first so the window can follow
    // a burst of buffered fixes along the route instead of staying parked
    // at the snapshot's last known progress.
    let aroundM: number | null = null;
    let index: RouteIndex | null = null;
    if (device.routeId) {
      index = await routeIndexFor(device.routeId, now.getTime());
      if (index && device.entryId) {
        aroundM = (await entryProgressFor(device.eventId, now.getTime())).get(device.entryId) ?? null;
      }
    }
    keep.sort((a, b) => fixTimeMs(fixes[a]) - fixTimeMs(fixes[b]));

    const data: Prisma.TrackerPositionCreateManyInput[] = [];
    for (const i of keep) {
      const f = fixes[i];
      let routeM: number | null = null;
      let offRouteM: number | null = null;
      if (index) {
        const s = snapToRoute(index, f.lat, f.lon, aroundM);
        routeM = s.routeM;
        offRouteM = s.offRouteM;
        // Only an on-route fix moves the window (§9 step 3); progress never decreases.
        if (s.offRouteM <= SNAP_RULES.offRouteMaxM && (aroundM === null || s.routeM > aroundM)) aroundM = s.routeM;
      }
      data.push({
        deviceId: device.id,
        fixTime: new Date(fixTimeMs(f)),
        lat: f.lat,
        lon: f.lon,
        accuracyM: f.accuracyM ?? null,
        speedMps: f.speedMps ?? null,
        batteryPct: f.batteryPct ?? null,
        altitudeM: f.altitudeM ?? null,
        routeM,
        offRouteM,
      });
    }

    // One INSERT … ON CONFLICT DO NOTHING RETURNING id, fixTime: the rows
    // that come back were new; the rest already existed.
    const inserted = await db.trackerPosition.createManyAndReturn({
      data,
      skipDuplicates: true,
      select: { id: true, fixTime: true },
    });
    const idByTime = new Map<number, number>();
    for (const r of inserted) idByTime.set(r.fixTime.getTime(), r.id);
    for (const i of keep) {
      const id = idByTime.get(fixTimeMs(fixes[i]));
      outcomes[i] =
        id !== undefined
          ? { ok: true, stored: true, deviceId: device.id, positionId: id }
          : { ok: true, stored: false, reason: "duplicate", deviceId: device.id };
    }
    if (inserted.length > 0) touched.add(device.eventId);
  }

  return { outcomes, touched: [...touched], counts: describeOutcomes(outcomes) };
}

/** The single-fix path (Traccar's webhook): the outcome plus the event to rebuild, if any. */
export async function ingestFix(
  fix: NormalizedFix,
  opts: IngestOptions = {},
): Promise<{ outcome: IngestOutcome; slug: string | null }> {
  const r = await ingestFixes([fix], opts);
  return { outcome: r.outcomes[0], slug: r.touched[0] ?? null };
}
