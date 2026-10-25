import { LASD_ASSETS } from "@/lib/lasd26/paths";

/**
 * The course file for /lasd26/route — public/lasd26/route/course.json,
 * written by `npx tsx scripts/lasd26-route-from-kml.ts` from No Shortcuts'
 * Google My Maps KML (owner, 2026-10-16: "embed this route into the site").
 * Static: the page fetches it from the public folder, nothing hits the
 * database. Isomorphic (no "server-only") — the map and the list are client
 * components.
 *
 * Miles are RUN miles: the drive through Camp Pendleton (San Mateo Point →
 * the Oceanside Chevron) adds nothing, so they match the organizer's
 * half-mile checkpoints. The tracker's GPX miles run ~17.5 ahead after the
 * drive (`gpx_mile`).
 *
 * The file carries no bathroom stops and nothing past the finish (owner,
 * 2026-10-16: "Remove the bathroom stops, and bathroom count", "Remove
 * after the finish copy").
 */

export const COURSE_URL = `${LASD_ASSETS}/route/course.json`;

/** The organizer's map — the directions, for the van's navigation. */
export const GOOGLE_MAP_URL = "https://www.google.com/maps/d/viewer?mid=1vsgSOGVJdwgvlBo3dPvUKCsPG6CL998";

export const MI = 1609.344;
export const FT = 0.3048;

export type TurnKind = "start" | "turn" | "drive" | "restart" | "finish";

export type CourseTurn = {
  name: string;
  kind: TurnKind;
  lat: number;
  lon: number;
  /** Run miles from the start. */
  mile: number;
  /** Miles along the tracker's GPX (the straight drive included). */
  gpx_mile: number;
  /** How far the organizer's pin sits off the line, metres. */
  off_m: number;
  note: string | null;
};

export type CourseDrive = {
  /** Index into coords of the last run point before the drive; coords[at + 1] is where the run resumes. */
  at: number;
  mile: number;
  /** Pickup to restart as the crow flies, metres. */
  straight_m: number;
  /** The road from pickup to restart, metres — null when the drive was not routed. */
  road_m: number | null;
  from: [number, number];
  to: [number, number];
  /**
   * The drive by car along the road, [lon, lat] pairs (owner, 2026-10-16:
   * "make the dotted line follow the route we are driving instead of
   * cutting straight to the point"). null when neither router answered —
   * the map then draws from → to straight.
   */
  coords: [number, number][] | null;
  routed_by: "brouter" | "osrm" | null;
  note: string;
};

export type CourseFile = {
  generated_at: string;
  source: string;
  length_m: number;
  gpx_length_m: number;
  climb_m: number;
  descent_m: number;
  /** [minLon, minLat, maxLon, maxLat] */
  bbox: [number, number, number, number];
  /** GeoJSON order, [lon, lat]. */
  coords: [number, number][];
  /** Run metres at each coord. */
  cum_m: number[];
  drives: CourseDrive[];
  turns: CourseTurn[];
  /** [run_m, ele_m] at each elevation segment's start, plus the end. */
  profile: [number, number][];
};

/**
 * THE BASEMAP for the route stickers (owner, 2026-10-25: "2 different map
 * views of the route. One with cities or the coast line drawn. And another
 * with the major roads drawn") — public/lasd26/route/basemap.json, written
 * by scripts/lasd26-basemap.ts from OpenStreetMap: the coastline, the
 * motorways / trunks / CA 1, and a curated list of places. [lon, lat].
 */
export const BASEMAP_URL = `${LASD_ASSETS}/route/basemap.json`;

export type BasemapCity = { name: string; lon: number; lat: number; place: string };
export type BasemapFile = {
  generated_at: string;
  source: string;
  bbox: [number, number, number, number];
  coast: [number, number][][];
  /** The motorways, the trunks, and CA 1 / the Pacific Coast Highway ("coast"), each chained into long lines. */
  roads: { motorway: [number, number][][]; trunk: [number, number][][]; coast: [number, number][][] };
  cities: BasemapCity[];
};

/** What a tap on a list row asks the map to show. `id` changes on every tap so the same row re-fires. */
export type Focus = { lon: number; lat: number; name: string; mile: number; key: string; id: number };

export const miles = (m: number): string => (m / MI).toFixed(1);
export const feet = (m: number): string => Math.round(m / FT).toLocaleString("en-US");
