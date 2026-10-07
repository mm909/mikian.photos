/**
 * The pure half of ingest (TRACKER_SPEC.md §8): what makes a fix junk, and
 * the small helpers the adapters and the batch path share. No database, no
 * server-only import, so the unit tests load this without a Prisma client
 * and the simulator can reuse it under plain tsx.
 *
 * ingest.ts re-exports everything here; import from there in server code.
 */

import { INGEST_RULES, type IngestOutcome, type NormalizedFix } from "./types";

/** The reasons a fix is dropped before it reaches the database (§8 rule 4). */
export type FixReject = "bad_accuracy" | "future" | "before_start" | "invalid";

/** Epoch ms of the fix, or NaN when the device stamp is unparseable. */
export function fixTimeMs(fix: Pick<NormalizedFix, "fixTime">): number {
  return Date.parse(fix.fixTime);
}

export function isValidLat(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= -90 && v <= 90;
}

export function isValidLon(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= -180 && v <= 180;
}

/**
 * Section 8 rule 4, in the order the spec lists it: junk accuracy, a stamp
 * more than five minutes in the future, a stamp from before the event start
 * minus an hour. "invalid" covers a fix that cannot be placed at all (bad
 * coordinates, an unparseable time) — those never reach the database
 * either. Returns null for a fix worth storing.
 *
 * `startTime` is the event the device belongs to; `now` is the server clock
 * (passed in so the tests are deterministic).
 */
export function classifyFix(fix: NormalizedFix, startTime: Date, now: Date): FixReject | null {
  if (!isValidLat(fix.lat) || !isValidLon(fix.lon)) return "invalid";
  const t = fixTimeMs(fix);
  if (!Number.isFinite(t)) return "invalid";
  if (fix.accuracyM !== undefined) {
    if (!Number.isFinite(fix.accuracyM) || fix.accuracyM < 0) return "invalid";
    if (fix.accuracyM > INGEST_RULES.maxAccuracyM) return "bad_accuracy";
  }
  if (t - now.getTime() > INGEST_RULES.maxFutureS * 1000) return "future";
  if (t < startTime.getTime() - INGEST_RULES.beforeStartS * 1000) return "before_start";
  return null;
}

/** The idempotency key the database enforces: UNIQUE(device, fix_time) at millisecond precision. */
export function fixDedupeKey(deviceId: string, fix: Pick<NormalizedFix, "fixTime">): string {
  return `${deviceId}@${fixTimeMs(fix)}`;
}

/** A finite number or undefined — the optional metrics never become NaN in a row. */
export function optNumber(v: unknown): number | undefined {
  if (typeof v === "string" && v.trim() !== "") v = Number(v);
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Battery as a percentage 0..100, or undefined when the device sent something else (a voltage, junk). */
export function optBatteryPct(v: unknown): number | undefined {
  const n = optNumber(v);
  if (n === undefined || n < 0 || n > 100) return undefined;
  return n;
}

/**
 * Device stamps arrive as ISO strings (Traccar's forward, the van page) or
 * as epoch numbers (OsmAnd-style payloads; seconds when small, else ms).
 * Returns a UTC ISO string, or null when nothing parses.
 */
export function toIsoTime(v: unknown): string | null {
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.toISOString() : null;
  if (typeof v === "number") {
    if (!Number.isFinite(v) || v <= 0) return null;
    const ms = v < 1e11 ? v * 1000 : v;
    return new Date(ms).toISOString();
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    if (/^\d+(\.\d+)?$/.test(s)) return toIsoTime(Number(s));
    const t = Date.parse(s);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
  }
  return null;
}

/** Counts for a log line: "stored 12, duplicate 3, rejected 1 (bad_accuracy 1)". */
export function describeOutcomes(outcomes: readonly IngestOutcome[]): {
  total: number;
  stored: number;
  duplicates: number;
  rejected: number;
  reasons: Record<string, number>;
  line: string;
} {
  let stored = 0;
  let duplicates = 0;
  let rejected = 0;
  const reasons: Record<string, number> = {};
  for (const o of outcomes) {
    if (o.ok && o.stored) stored++;
    else if (o.ok) duplicates++;
    else {
      rejected++;
      reasons[o.reason] = (reasons[o.reason] ?? 0) + 1;
    }
  }
  const why = Object.entries(reasons)
    .map(([k, v]) => `${k} ${v}`)
    .join(", ");
  const line = `stored ${stored}, duplicate ${duplicates}, rejected ${rejected}${why ? ` (${why})` : ""}`;
  return { total: outcomes.length, stored, duplicates, rejected, reasons, line };
}
