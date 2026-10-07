/**
 * Traccar adapter (TRACKER_SPEC.md §8, "traccar (v1)").
 *
 * Traccar 6.x position forwarding (forward.url + forward.type=json) POSTs
 * ONE position per request as `{ position, device }`, nulls omitted. The
 * same Position shape comes back from GET /api/positions, so the REST
 * backfill wraps each row as `{ position, device: { uniqueId } }` and reuses
 * this. Verified 2026-10-06 against the openapi.yaml and the Java source
 * (scratchpad/research/traccar.md):
 *
 *   - speed is in KNOTS   → × 0.514444 for m/s
 *   - altitude, accuracy  → metres (accuracy may be absent)
 *   - fixTime / deviceTime / serverTime → ISO 8601 strings; prefer fixTime
 *   - attributes.batteryLevel → percent (Traccar Client); OsmAnd `batt`
 *   - valid=false → no fix (treated as junk, dropped)
 *   - device.uniqueId → what the runner typed into the app = our externalId
 *
 * Pure: no database, no server-only import. The webhook route and the REST
 * backfill both hand the result to ingestFix / ingestFixes.
 */

import type { NormalizedFix } from "../types";
import { isValidLat, isValidLon, optBatteryPct, optNumber, toIsoTime } from "../ingestRules";

export const KNOTS_TO_MPS = 0.514444;

type Rec = Record<string, unknown>;

function rec(v: unknown): Rec | null {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Rec) : null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}

export type TraccarNormalizeResult = NormalizedFix | { error: string };

/**
 * `{ position, device }` → NormalizedFix, or `{ error }` naming what was
 * missing. The caller answers 200 to Traccar either way (a 4xx/5xx makes
 * Traccar retry the same junk up to ten times).
 */
export function normalizeTraccar(body: unknown): TraccarNormalizeResult {
  const root = rec(body);
  if (!root) return { error: "body is not an object" };
  const position = rec(root.position);
  if (!position) return { error: "missing position" };
  const device = rec(root.device);
  const attrs = rec(position.attributes) ?? {};

  // The device identity: the uniqueId the runner typed into Traccar Client.
  // The forward body carries it on `device`; some protocol payloads tuck it
  // into position.attributes.uniqueId instead.
  const uniqueId = str(device?.uniqueId) || str(attrs.uniqueId);
  if (!uniqueId) return { error: "missing device.uniqueId" };

  if (position.valid === false) return { error: "invalid" };

  // Device time is the truth (§3 principle 2): fixTime first, deviceTime
  // when the protocol has no separate GPS stamp, serverTime as a last resort.
  const fixTime = toIsoTime(position.fixTime) ?? toIsoTime(position.deviceTime) ?? toIsoTime(position.serverTime);
  if (!fixTime) return { error: "missing fixTime" };

  const lat = optNumber(position.latitude);
  const lon = optNumber(position.longitude);
  if (!isValidLat(lat) || !isValidLon(lon)) return { error: "bad coordinates" };

  const knots = optNumber(position.speed);
  const speedMps = knots === undefined ? undefined : Math.max(0, knots) * KNOTS_TO_MPS;
  const accuracyM = optNumber(position.accuracy);
  const altitudeM = optNumber(position.altitude);
  const batteryPct = optBatteryPct(attrs.batteryLevel) ?? optBatteryPct(attrs.batt) ?? optBatteryPct(attrs.battery);

  const fix: NormalizedFix = { source: "traccar", externalId: uniqueId, fixTime, lat, lon };
  if (accuracyM !== undefined) fix.accuracyM = accuracyM;
  if (speedMps !== undefined) fix.speedMps = speedMps;
  if (batteryPct !== undefined) fix.batteryPct = batteryPct;
  if (altitudeM !== undefined) fix.altitudeM = altitudeM;
  return fix;
}

export function isTraccarError(r: TraccarNormalizeResult): r is { error: string } {
  return "error" in r;
}
