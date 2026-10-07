/**
 * Backfill from Traccar's REST API (TRACKER_SPEC.md §8: "on startup, also
 * pull each device's positions since event start from the Traccar REST API
 * to fill any webhook gap"). There is no startup on serverless, so this runs
 * from POST /api/track/[slug]/backfill (admin) — before the start, after a
 * webhook outage, or whenever the numbers look thin.
 *
 * Verified against Traccar 6.x (scratchpad/research/traccar.md):
 *   GET /api/devices                                   → [{ id, uniqueId, … }]
 *   GET /api/positions?deviceId=<numeric>&from=<ISO>&to=<ISO>  (from/to required)
 * with `Authorization: Bearer <TRACKER_TRACCAR_TOKEN>`. Position objects are
 * the same shape the forward webhook sends, so each is wrapped as
 * `{ position, device: { uniqueId } }` and run through the ordinary adapter
 * and ingestFixes — the junk rules and the dedupe are the same door.
 */

import { db } from "@/lib/db";
import { normalizeTraccar, isTraccarError } from "./adapters/traccar";
import { ingestFixes } from "./ingest";
import type { NormalizedFix } from "./types";

export class TraccarRestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface BackfillResult {
  slug: string;
  /** Traccar devices of the event that were found on the Traccar server. */
  devices: number;
  fetched: number;
  stored: number;
  duplicates: number;
  rejected: number;
  errors: string[];
  from: string;
  to: string;
  /** True when at least one new row was stored — rebuild the snapshot. */
  touched: boolean;
}

const WINDOW_MS = 6 * 3600 * 1000;
const FETCH_TIMEOUT_MS = 20_000;
const INGEST_CHUNK = 500;

function env(): { url: string; token: string } {
  const url = (process.env.TRACKER_TRACCAR_URL ?? "").trim().replace(/\/+$/, "");
  const token = (process.env.TRACKER_TRACCAR_TOKEN ?? "").trim();
  if (!url || !token) throw new TraccarRestError(503, "TRACKER_TRACCAR_URL / TRACKER_TRACCAR_TOKEN are not set");
  return { url, token };
}

async function getJson(url: string, token: string): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: ctl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new TraccarRestError(502, `Traccar answered ${res.status} for ${new URL(url).pathname}`);
    return await res.json();
  } catch (err) {
    if (err instanceof TraccarRestError) throw err;
    const why = (err as Error)?.name === "AbortError" ? "timed out" : (err as Error)?.message ?? String(err);
    throw new TraccarRestError(502, `Traccar request failed (${why}) for ${new URL(url).pathname}`);
  } finally {
    clearTimeout(timer);
  }
}

/** uniqueId → numeric Traccar id, from GET /api/devices. */
export async function traccarDeviceMap(): Promise<Map<string, number>> {
  const { url, token } = env();
  const list = await getJson(`${url}/api/devices`, token);
  const map = new Map<string, number>();
  if (Array.isArray(list)) {
    for (const d of list) {
      if (d && typeof d === "object" && typeof (d as { uniqueId?: unknown }).uniqueId === "string" && typeof (d as { id?: unknown }).id === "number") {
        map.set((d as { uniqueId: string }).uniqueId, (d as { id: number }).id);
      }
    }
  }
  return map;
}

/**
 * Pull every traccar device of the event from `since` (default: event start
 * minus one hour, the earliest a fix would pass the junk rules) to now, in
 * windows of at most six hours, and ingest the lot.
 */
export async function backfillFromTraccar(slug: string, opts: { since?: Date; until?: Date } = {}): Promise<BackfillResult> {
  const { url, token } = env();
  const event = await db.trackerEvent.findUnique({
    where: { id: slug },
    select: { startTime: true, status: true, devices: { where: { source: "traccar" }, select: { externalId: true } } },
  });
  if (!event) throw new TraccarRestError(404, `unknown event ${slug}`);
  if (event.status === "archived") throw new TraccarRestError(409, `event ${slug} is archived`);

  const to = opts.until ?? new Date();
  const from = opts.since ?? new Date(event.startTime.getTime() - 3600 * 1000);
  const result: BackfillResult = {
    slug,
    devices: 0,
    fetched: 0,
    stored: 0,
    duplicates: 0,
    rejected: 0,
    errors: [],
    from: from.toISOString(),
    to: to.toISOString(),
    touched: false,
  };
  if (event.devices.length === 0) {
    result.errors.push("the event has no traccar devices");
    return result;
  }
  if (from >= to) return result;

  const idByUnique = await traccarDeviceMap();
  const pending: NormalizedFix[] = [];

  const flush = async () => {
    if (pending.length === 0) return;
    const r = await ingestFixes(pending.splice(0, pending.length), { eventId: slug });
    result.stored += r.counts.stored;
    result.duplicates += r.counts.duplicates;
    result.rejected += r.counts.rejected;
    if (r.touched.length) result.touched = true;
  };

  for (const { externalId } of event.devices) {
    const traccarId = idByUnique.get(externalId);
    if (traccarId === undefined) {
      result.errors.push(`${externalId}: not registered on the Traccar server`);
      continue;
    }
    result.devices++;
    for (let a = from.getTime(); a < to.getTime(); a += WINDOW_MS) {
      const b = Math.min(a + WINDOW_MS, to.getTime());
      const q = new URLSearchParams({ deviceId: String(traccarId), from: new Date(a).toISOString(), to: new Date(b).toISOString() });
      let rows: unknown;
      try {
        rows = await getJson(`${url}/api/positions?${q}`, token);
      } catch (err) {
        result.errors.push(`${externalId}: ${(err as Error).message}`);
        continue;
      }
      if (!Array.isArray(rows)) continue;
      for (const position of rows) {
        result.fetched++;
        const fix = normalizeTraccar({ position, device: { uniqueId: externalId } });
        if (isTraccarError(fix)) {
          result.rejected++;
          continue;
        }
        pending.push(fix);
        if (pending.length >= INGEST_CHUNK) await flush();
      }
    }
  }
  await flush();
  return result;
}
