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
 * bathroom labels and half-mile checkpoints. The tracker's GPX miles run
 * ~17.5 ahead after the drive (`gpx_mile`).
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

export type CourseBath = {
  name: string;
  /** The organizer's word: "window" is their pick for the 12-mile window, "option" an alternative. */
  kind: "window" | "option";
  target_mi: number;
  mile: number;
  lat: number;
  lon: number;
  address: string | null;
  eta: string | null;
};

export type CourseDrive = {
  /** Index into coords of the last run point before the drive; coords[at + 1] is where the run resumes. */
  at: number;
  mile: number;
  straight_m: number;
  from: [number, number];
  to: [number, number];
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
  /** Pins past the finish (the hotel). */
  after: { name: string; lat: number; lon: number }[];
  bathrooms: CourseBath[];
  halfmiles: number;
  /** [run_m, ele_m] at each elevation segment's start, plus the end. */
  profile: [number, number][];
};

/** What a tap on a list row asks the map to show. `id` changes on every tap so the same row re-fires. */
export type Focus = { lon: number; lat: number; name: string; mile: number; key: string; id: number };

export const miles = (m: number): string => (m / MI).toFixed(1);
export const feet = (m: number): string => Math.round(m / FT).toLocaleString("en-US");
