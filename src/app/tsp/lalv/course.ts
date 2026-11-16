import { TSP_ASSETS } from "@/lib/tsp/paths";

/**
 * The TSP LA → Las Vegas course file — public/tsp/lalv-course/course.json
 * (and course-secrets.json, the same through the checkpoints), written by
 * `node scripts/tsp-lalv-course.mjs` from the hand-picked waypoints. Static:
 * the page fetches it from the public folder. Isomorphic and pure — the map,
 * the lists and the legs all compute from here on the client.
 *
 * Distances in the file are METRES along the line; the page speaks miles.
 * A leg (lib/tsp/legs.ts) is stored in hundredths of a mile.
 */

/**
 * THE ROUTES (owner, 2026-11-16: "save a few of these routes as different
 * options. We want to take the powerline route"). Every route is the same
 * road to Baker and its own way from there; a captain picks the team's on
 * the team page (TspTeam.route). The figures are the built files'.
 */
export const ROUTES = [
  { id: "powerline", label: "Powerline", blurb: "306 mi · the fast line: Baker, 45 mi of power-line dirt to Primm, Las Vegas Blvd. No van for about 53 mi." },
  { id: "og", label: "The OG line", blurb: "342 mi · Baker, CA-127, Tecopa, NV-160 over Mountain Springs. Vans follow every mile after Baker." },
  { id: "pahrump", label: "Shoshone & Pahrump", blurb: "About 356 mi · the OG line stretched through Shoshone and Pahrump for services." },
] as const;
export type RouteId = (typeof ROUTES)[number]["id"];
export const DEFAULT_ROUTE: RouteId = "powerline";
export const parseRoute = (v: unknown): RouteId => ROUTES.find((r) => r.id === v)?.id ?? DEFAULT_ROUTE;

export const courseUrl = (route: string, secrets: boolean) => `${TSP_ASSETS}/course-${parseRoute(route)}${secrets ? "-secrets" : ""}.json`;

export const MI = 1609.344;
export const FT = 0.3048;

export type CourseTurn = { name: string; street: string | null; lon: number; lat: number; m: number };
export type CoursePlace = { name: string; note: string | null; services: string | null; lon: number; lat: number; m: number };
export type CourseCheckpoint = { name: string; note: string | null; lon: number; lat: number; m: number; off_m: number };

export type CourseFile = {
  generated_at: string;
  name: string;
  source: string;
  length_m: number;
  climb_m: number;
  descent_m: number;
  dirt_m: number;
  /** [minLon, minLat, maxLon, maxLat] */
  bbox: [number, number, number, number];
  /** GeoJSON order, [lon, lat]. */
  coords: [number, number][];
  /** Metres along the line at each coord. */
  cum_m: number[];
  turns: CourseTurn[];
  /** The named points the route was built through — towns, junctions, the last gas. */
  places: CoursePlace[];
  /** The secrets team's stand-in checkpoints (empty on the plain course). */
  checkpoints: CourseCheckpoint[];
  /** Runs of dirt, [fromM, toM]. */
  dirt: [number, number][];
  /** [m, ele_m] every 250 m. */
  profile: [number, number][];
};

export const miles = (m: number, places = 1): string => (m / MI).toFixed(places);
export const feet = (m: number): string => Math.round(m / FT).toLocaleString("en-US");

/** The last index whose cum_m is <= m. */
function indexAt(cum: number[], m: number): number {
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cum[mid] <= m) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** The point `m` metres along the line. */
export function pointAt(course: CourseFile, m: number): [number, number] {
  const { coords, cum_m } = course;
  const mm = Math.max(0, Math.min(course.length_m, m));
  const i = Math.min(indexAt(cum_m, mm), coords.length - 2);
  const span = cum_m[i + 1] - cum_m[i];
  const t = span > 0 ? Math.min(1, (mm - cum_m[i]) / span) : 0;
  return [coords[i][0] + (coords[i + 1][0] - coords[i][0]) * t, coords[i][1] + (coords[i + 1][1] - coords[i][1]) * t];
}

/** The line between two distances, ends interpolated. */
export function sliceLine(course: CourseFile, fromM: number, toM: number): [number, number][] {
  const a = Math.max(0, Math.min(fromM, toM));
  const b = Math.min(course.length_m, Math.max(fromM, toM));
  const i0 = indexAt(course.cum_m, a);
  const i1 = indexAt(course.cum_m, b);
  const out: [number, number][] = [pointAt(course, a)];
  for (let i = i0 + 1; i <= i1; i++) out.push(course.coords[i]);
  out.push(pointAt(course, b));
  return out;
}

/** Height at `m`, metres, from the 250 m profile. */
export function eleAt(course: CourseFile, m: number): number {
  const p = course.profile;
  if (p.length === 0) return 0;
  let lo = 0;
  let hi = p.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (p[mid][0] <= m) lo = mid;
    else hi = mid - 1;
  }
  const a = p[lo];
  const b = p[Math.min(p.length - 1, lo + 1)];
  const t = b[0] > a[0] ? Math.max(0, Math.min(1, (m - a[0]) / (b[0] - a[0]))) : 0;
  return a[1] + (b[1] - a[1]) * t;
}

/**
 * Up and down between two distances, metres — the same 3 m hysteresis the
 * script sums the whole course with, so the legs add up to its total (give
 * or take what the joints lose).
 */
export function climbBetween(course: CourseFile, fromM: number, toM: number): { up: number; down: number } {
  const a = Math.min(fromM, toM);
  const b = Math.max(fromM, toM);
  let up = 0;
  let down = 0;
  let ref = eleAt(course, a);
  const step = (e: number) => {
    if (e - ref >= 3) {
      up += e - ref;
      ref = e;
    } else if (ref - e >= 3) {
      down += ref - e;
      ref = e;
    }
  };
  for (const [m, e] of course.profile) if (m > a && m < b) step(e);
  step(eleAt(course, b));
  return { up, down };
}

/** How much of [fromM, toM] is dirt, metres. */
export function dirtBetween(course: CourseFile, fromM: number, toM: number): number {
  let d = 0;
  for (const [a, b] of course.dirt) d += Math.max(0, Math.min(b, toM) - Math.max(a, fromM));
  return d;
}

const DEG = Math.PI / 180;

export type Snap = { m: number; offM: number };

/** Where a fix falls on the line: metres along, and how far off. */
export function snapToCourse(course: CourseFile, lat: number, lon: number): Snap {
  const { coords, cum_m } = course;
  const kx = Math.cos(lat * DEG) * 111320;
  const ky = 110540;
  let best = { m: 0, offM: Infinity };
  let ax = (coords[0][0] - lon) * kx;
  let ay = (coords[0][1] - lat) * ky;
  for (let i = 1; i < coords.length; i++) {
    const bx = (coords[i][0] - lon) * kx;
    const by = (coords[i][1] - lat) * ky;
    const vx = bx - ax;
    const vy = by - ay;
    const len2 = vx * vx + vy * vy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, (-ax * vx - ay * vy) / len2)) : 0;
    const d = Math.hypot(ax + vx * t, ay + vy * t);
    if (d < best.offM) best = { m: cum_m[i - 1] + (cum_m[i] - cum_m[i - 1]) * t, offM: d };
    ax = bx;
    ay = by;
  }
  return best;
}

export type MileMarker = { mile: number; lon: number; lat: number; tier: 1 | 5 | 10 | 50 };

/** A numeral at every whole mile; the tier picks which zooms show it. */
export function mileMarkers(course: CourseFile): MileMarker[] {
  const out: MileMarker[] = [];
  const n = Math.floor(course.length_m / MI);
  for (let mile = 1; mile <= n; mile++) {
    const [lon, lat] = pointAt(course, mile * MI);
    out.push({ mile, lon, lat, tier: mile % 50 === 0 ? 50 : mile % 10 === 0 ? 10 : mile % 5 === 0 ? 5 : 1 });
  }
  return out;
}

/** What a tap on a list row asks the map to show. `id` changes on every tap so the same row re-fires. */
export type Focus = { id: number } & ({ kind: "point"; lon: number; lat: number; label: string; mile: number } | { kind: "range"; fromM: number; toM: number });
