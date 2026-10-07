/**
 * Browser adapter (TRACKER_SPEC.md §8, "web (v1)"): the van page posts
 * `navigator.geolocation` fixes, batched because it queues them while the
 * van is out of service and flushes oldest first (§8).
 *
 *   { external_id: "lasd26-van-a",
 *     fixes: [{ fix_time, lat, lon, accuracy_m?, speed_mps?, battery_pct?, altitude_m? }, ...] }
 *
 * Both snake_case (what the van page sends, mirroring the snapshot) and
 * camelCase keys are accepted. Validation is strict per fix — a bad lat is
 * a bad fix, not a bad batch — and the result stays ALIGNED with the input
 * so the route can answer one outcome per fix and the client can drop
 * exactly the entries the server has dealt with.
 *
 * Pure: no database, no server-only import.
 */

import type { DeviceSource, NormalizedFix } from "../types";
import { DEVICE_SOURCES } from "../types";
import { isValidLat, isValidLon, optBatteryPct, optNumber, toIsoTime } from "../ingestRules";

/** The most fixes one POST may carry; the van page flushes in smaller chunks anyway. */
export const WEB_BATCH_MAX = 1000;

export type WebFixResult = NormalizedFix | { error: string };

export interface WebBatch {
  externalId: string;
  /** One entry per input fix, in input order. */
  fixes: WebFixResult[];
}

type Rec = Record<string, unknown>;

function rec(v: unknown): Rec | null {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Rec) : null;
}

function pick(r: Rec, ...keys: string[]): unknown {
  for (const k of keys) if (r[k] !== undefined && r[k] !== null) return r[k];
  return undefined;
}

export function normalizeWebFix(raw: unknown, externalId: string, source: DeviceSource): WebFixResult {
  const r = rec(raw);
  if (!r) return { error: "fix is not an object" };
  const fixTime = toIsoTime(pick(r, "fix_time", "fixTime", "time", "timestamp"));
  if (!fixTime) return { error: "bad fix_time" };
  const lat = optNumber(pick(r, "lat", "latitude"));
  const lon = optNumber(pick(r, "lon", "lng", "longitude"));
  if (!isValidLat(lat)) return { error: "bad lat" };
  if (!isValidLon(lon)) return { error: "bad lon" };
  const fix: NormalizedFix = { source, externalId, fixTime, lat, lon };
  const accuracyM = optNumber(pick(r, "accuracy_m", "accuracyM", "accuracy"));
  if (accuracyM !== undefined) {
    if (accuracyM < 0) return { error: "bad accuracy_m" };
    fix.accuracyM = accuracyM;
  }
  const speedMps = optNumber(pick(r, "speed_mps", "speedMps", "speed"));
  if (speedMps !== undefined && speedMps >= 0) fix.speedMps = speedMps;
  const batteryPct = optBatteryPct(pick(r, "battery_pct", "batteryPct", "battery"));
  if (batteryPct !== undefined) fix.batteryPct = batteryPct;
  const altitudeM = optNumber(pick(r, "altitude_m", "altitudeM", "altitude"));
  if (altitudeM !== undefined) fix.altitudeM = altitudeM;
  return fix;
}

/**
 * The whole POST body → the device id and one result per fix. A batch-level
 * `{ error }` only when the body itself is unusable (no device id, no
 * array, too many fixes); individual bad fixes are errors inside `fixes`.
 */
export function normalizeWebBatch(body: unknown, source: DeviceSource = "web"): WebBatch | { error: string } {
  const root = rec(body);
  if (!root) return { error: "body is not an object" };
  if (!DEVICE_SOURCES.includes(source)) return { error: "bad source" };
  const idRaw = pick(root, "external_id", "externalId", "device_id", "deviceId");
  const externalId = typeof idRaw === "string" ? idRaw.trim() : typeof idRaw === "number" ? String(idRaw) : "";
  if (!externalId) return { error: "missing external_id" };
  if (externalId.length > 64) return { error: "external_id too long" };
  // A single fix at the top level is accepted too, so a quick manual test
  // with curl does not need the array.
  const fixesRaw = Array.isArray(root.fixes) ? root.fixes : root.fix !== undefined ? [root.fix] : null;
  if (!fixesRaw) return { error: "missing fixes[]" };
  if (fixesRaw.length > WEB_BATCH_MAX) return { error: `too many fixes (max ${WEB_BATCH_MAX})` };
  return { externalId, fixes: fixesRaw.map((f) => normalizeWebFix(f, externalId, source)) };
}

export function isWebFixError(r: WebFixResult): r is { error: string } {
  return "error" in r;
}

/** Just the good ones, for ingest (the route merges outcomes back by index). */
export function goodFixes(batch: WebBatch): { fixes: NormalizedFix[]; indexes: number[] } {
  const fixes: NormalizedFix[] = [];
  const indexes: number[] = [];
  batch.fixes.forEach((f, i) => {
    if (!isWebFixError(f)) {
      fixes.push(f);
      indexes.push(i);
    }
  });
  return { fixes, indexes };
}
