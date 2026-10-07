/**
 * Live tracker — the shared contract (TRACKER_SPEC.md, 2026-10-06).
 *
 * Every module under src/lib/tracker, every /api/track route, the simulator
 * and the /track pages import their shapes from here. Isomorphic: no
 * server-only imports, so the client bundle can type the snapshot it polls.
 *
 * Units: metres and seconds everywhere; UTC ISO strings for instants.
 * Convert for display only (format.ts). Keys in the snapshot are snake_case,
 * exactly as section 10 of the spec prints them.
 */

export type EventKind = "relay" | "solo";
export type Units = "imperial" | "metric";
export type DeviceSource = "traccar" | "web" | "satellite" | "manual";
export type DeviceRole = "runner" | "vehicle" | "baton";
export type HandoffSource = "crew" | "runner" | "admin" | "simulator";
export type CheckpointKind = "start" | "town" | "exchange" | "aid" | "finish";

export const DEVICE_SOURCES: readonly DeviceSource[] = ["traccar", "web", "satellite", "manual"];
export const DEVICE_ROLES: readonly DeviceRole[] = ["runner", "vehicle", "baton"];
export const CHECKPOINT_KINDS: readonly CheckpointKind[] = ["start", "town", "exchange", "aid", "finish"];

/* ─── Ingest ──────────────────────────────────────────────────────────────── */

/** What every position adapter produces; the one shape `ingestFix()` takes. */
export interface NormalizedFix {
  source: DeviceSource;
  /** Maps to TrackerDevice.externalId (e.g. the Traccar uniqueId). */
  externalId: string;
  /** UTC ISO, from the DEVICE clock — never the arrival time. */
  fixTime: string;
  lat: number;
  lon: number;
  accuracyM?: number;
  speedMps?: number;
  batteryPct?: number;
  altitudeM?: number;
}

/** Section 8 rule 4 thresholds, in one place so tests and ingest agree. */
export const INGEST_RULES = {
  /** Drop fixes with a worse horizontal accuracy than this (metres). */
  maxAccuracyM: 100,
  /** Drop fixes stamped more than this far in the future (seconds). */
  maxFutureS: 5 * 60,
  /** Drop fixes stamped before event start minus this (seconds). */
  beforeStartS: 60 * 60,
} as const;

export type IngestOutcome =
  | { ok: true; stored: true; deviceId: string; positionId: number }
  | { ok: true; stored: false; reason: "duplicate"; deviceId: string }
  | { ok: false; reason: "unknown_device" | "archived_event" | "bad_accuracy" | "future" | "before_start" | "invalid" };

/* ─── Route index ─────────────────────────────────────────────────────────── */

/**
 * The densified route, in memory. Parallel typed arrays keep 10k points
 * cheap to scan. `cumM[i]` is the distance along the route to point i.
 */
export interface RouteIndex {
  lengthM: number;
  lat: Float64Array;
  lon: Float64Array;
  cumM: Float64Array;
  eleM: Float64Array;
  /** [minLat, minLon, maxLat, maxLon] */
  bbox: [number, number, number, number];
}

/** How TrackerRoute.points is stored: [lat, lon, cumM, eleM] per point. */
export type StoredRoutePoint = [number, number, number, number];

/** Section 9 snapping parameters. */
export const SNAP_RULES = {
  /** Max spacing after densifying (metres). */
  densifyM: 25,
  /** Window around the entry's current progress: this far behind… */
  windowBehindM: 500,
  /** …to this far ahead. */
  windowAheadM: 5000,
  /** Within the window, accept a point this close; else search the whole route. */
  windowAcceptM: 150,
  /** Beyond this off the route, keep the fix for the map but do not advance progress. */
  offRouteMaxM: 300,
} as const;

export interface SnapResult {
  /** Distance along the route of the nearest route point (metres). */
  routeM: number;
  /** Straight-line distance from the fix to that point (metres). */
  offRouteM: number;
  /** Index of the nearest route point. */
  idx: number;
  /** True when the window rule found it; false when the whole route was searched. */
  inWindow: boolean;
}

/* ─── Event config (events/<slug>.yaml) ───────────────────────────────────── */

export interface DeviceRef {
  source: DeviceSource;
  external_id: string;
}

export interface ParticipantConfig {
  name: string;
  initials: string;
  device?: DeviceRef;
}

export interface EntryConfig {
  name: string;
  short_name: string;
  color: string;
  /** Per-entry route override (phase 6); null/absent = the event route. */
  route?: string;
  participants: ParticipantConfig[];
  vehicle_device?: DeviceRef;
  baton_device?: DeviceRef;
}

export interface CheckpointConfig {
  name: string;
  kind: CheckpointKind;
  /** Exactly one of mile / km / route_m is given in the file. */
  mile?: number;
  km?: number;
  route_m?: number;
}

export interface EventConfig {
  slug: string;
  name: string;
  kind: EventKind;
  /** ISO with offset, as written in the file. */
  start_time: string;
  timezone: string;
  units: Units;
  /** GPX file name next to the YAML. */
  route: string;
  public_delay_s: number;
  /** Resolved value (the file may name an env var: "$TRACKER_CREW_KEY_LASD26"). */
  crew_key: string;
  /** False when the env var the file names is unset (dev gets a fallback key). */
  crew_key_from_env: boolean;
  entries: EntryConfig[];
  checkpoints: CheckpointConfig[];
  /** sha256 of the normalized file, to skip no-op re-syncs. */
  hash: string;
}

/* ─── Snapshot (section 10) ───────────────────────────────────────────────── */

export type PositionSourceLabel = "runner" | "baton" | "vehicle";
export type EventStatus = "upcoming" | "live" | "finished" | "archived";

export interface SnapshotPosition {
  lat: number;
  lon: number;
  fix_time: string;
  /** Seconds between the fix and the snapshot's as-of instant. */
  age_s: number;
  source: PositionSourceLabel;
  /** Which participant's device, when source is "runner". */
  participant_id: string | null;
  /** True when no device in the chain had a fix newer than 3 minutes. */
  stale: boolean;
  /** True when the fix is > 300 m from the route. */
  off_route: boolean;
  /** Snapped distance along the route of THIS fix (metres), when on route. */
  route_m: number | null;
  battery_pct: number | null;
}

export interface SnapshotOnCourse {
  participant_id: string;
  name: string;
  initials: string;
  leg_no: number;
  leg_started: string;
  leg_distance_m: number;
  leg_time_s: number;
  leg_pace_s_per_km: number | null;
}

export interface SnapshotNextUp {
  participant_id: string;
  name: string;
  initials: string;
}

export interface SnapshotEta {
  finish: string | null;
  earliest: string | null;
  latest: string | null;
  /** The pace the estimate used (s/km), null before there is enough progress. */
  pace_s_per_km: number | null;
}

export interface SnapshotCheckpoint {
  id: string;
  name: string;
  kind: CheckpointKind;
  route_m: number;
  /** Interpolated passing time, or null if not yet reached. */
  passed_at: string | null;
  eta: string | null;
  eta_earliest: string | null;
  eta_latest: string | null;
}

export interface SnapshotParticipant {
  id: string;
  name: string;
  initials: string;
  legs: number;
  distance_m: number;
  time_s: number;
  avg_pace_s_per_km: number | null;
  /** True while this participant is the one on course. */
  on_course: boolean;
  /** Last fix from THIS participant's own device, for the join page check. */
  device_last_seen: string | null;
  device_battery_pct: number | null;
}

export interface SnapshotLeg {
  no: number;
  participant_id: string;
  start: string;
  /** Null while live. */
  end: string | null;
  distance_m: number;
  time_s: number;
  pace_s_per_km: number | null;
  live: boolean;
  /** For checkpoint-split (solo) legs: which checkpoint ended it. */
  checkpoint_id?: string | null;
}

export interface SnapshotBests {
  fastest_leg: { leg_no: number; participant_id: string; pace_s_per_km: number } | null;
  longest_leg: { leg_no: number; participant_id: string; distance_m: number } | null;
}

export interface SnapshotEntry {
  id: string;
  name: string;
  short_name: string;
  color: string;
  route_id: string;
  position: SnapshotPosition | null;
  progress_m: number;
  remaining_m: number;
  percent: number;
  /** Seconds since event start (0 before the start). */
  elapsed_s: number;
  avg_pace_s_per_km: number | null;
  /** True once progress reaches the route end. */
  finished: boolean;
  finished_at: string | null;
  on_course: SnapshotOnCourse | null;
  next_up: SnapshotNextUp | null;
  eta: SnapshotEta;
  checkpoints: SnapshotCheckpoint[];
  participants: SnapshotParticipant[];
  /** Newest first. */
  legs: SnapshotLeg[];
  bests: SnapshotBests;
}

export interface SnapshotGap {
  ahead: string;
  behind: string;
  distance_m: number;
  /** How long ago the leader was where the trailer is now; null when unknown. */
  time_s: number | null;
}

export interface Snapshot {
  event: {
    slug: string;
    name: string;
    kind: EventKind;
    units: Units;
    timezone: string;
    start_time: string;
    length_m: number;
    status: EventStatus;
    public_delay_s: number;
  };
  generated_at: string;
  /** The instant described: generated_at minus the public delay. */
  as_of: string;
  entries: SnapshotEntry[];
  gaps: SnapshotGap[];
}

/* ─── Route file (/api/track/[slug]/route) ────────────────────────────────── */

export interface RouteFile {
  route_id: string;
  length_m: number;
  /** [lon, lat] pairs (GeoJSON order), decimated for the map. */
  coords: [number, number][];
  /** cumM for each coord, so the client can split the completed part. */
  cum_m: number[];
  bbox: [number, number, number, number];
  checkpoints: { id: string; name: string; kind: CheckpointKind; route_m: number; lat: number; lon: number }[];
}

/* ─── Crew API ────────────────────────────────────────────────────────────── */

export interface HandoffRequest {
  client_event_id: string;
  entry_id: string;
  participant_id: string;
  /** UTC ISO, when the tap happened on the client. */
  time: string;
  /** UTC ISO, the client's clock at send time, for skew correction. */
  client_now: string;
  source?: HandoffSource;
}

export interface HandoffDto {
  id: string;
  entry_id: string;
  participant_id: string;
  participant_name: string;
  time: string;
  received_time: string;
  source: HandoffSource;
  voided: boolean;
  client_event_id: string;
}

/** Freshness threshold for "where the dot is" (section 9). */
export const FRESH_FIX_S = 3 * 60;
