/**
 * Route index: GPX → densified polyline with cumulative distance, kept in
 * memory, and the snapping rules of section 9 of the spec.
 *
 * Isomorphic and dependency-free (plain math, a regex GPX parser) so the
 * same code runs in the API routes, the snapshot build, the simulator
 * (Node) and the unit tests. Nothing here touches the database.
 */

import { SNAP_RULES, type RouteIndex, type SnapResult, type StoredRoutePoint } from "./types";

const R_EARTH = 6371000;
const DEG = Math.PI / 180;

export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * DEG;
  const dLon = (lon2 - lon1) * DEG;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
}

export type RawPoint = { lat: number; lon: number; ele: number };

/* ─── GPX ─────────────────────────────────────────────────────────────────── */

/**
 * Parse the track points of a GPX 1.0/1.1 document, every <trkseg> in file
 * order (falls back to <rtept> for a route-only file). Regex-based so it
 * runs without a DOM, in Node and in the browser alike. Elevation defaults
 * to 0 when a point has no <ele>.
 */
export function parseGpx(xml: string): RawPoint[] {
  const out: RawPoint[] = [];
  const re = /<(trkpt|rtept|wpt)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g;
  let m: RegExpExecArray | null;
  let sawTrk = false;
  const pending: RawPoint[] = [];
  while ((m = re.exec(xml))) {
    const tag = m[1];
    if (tag === "wpt") continue;
    const attrs = m[2];
    const lat = Number(/\blat\s*=\s*["']([^"']+)["']/.exec(attrs)?.[1]);
    const lon = Number(/\blon\s*=\s*["']([^"']+)["']/.exec(attrs)?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const eleRaw = m[3] ? /<ele>\s*([-\d.eE+]+)\s*<\/ele>/.exec(m[3])?.[1] : undefined;
    const ele = eleRaw !== undefined && Number.isFinite(Number(eleRaw)) ? Number(eleRaw) : 0;
    const p = { lat, lon, ele };
    if (tag === "trkpt") {
      sawTrk = true;
      out.push(p);
    } else {
      pending.push(p);
    }
  }
  return sawTrk ? out : pending;
}

/* ─── Densify ─────────────────────────────────────────────────────────────── */

/**
 * Drop consecutive near-duplicates (< 0.5 m), then insert interpolated
 * points so no two neighbours are more than `maxSpacingM` apart, with the
 * cumulative distance on every point. Returns the storable form.
 */
export function densify(points: RawPoint[], maxSpacingM: number = SNAP_RULES.densifyM): StoredRoutePoint[] {
  const clean: RawPoint[] = [];
  for (const p of points) {
    const last = clean[clean.length - 1];
    if (last && haversineM(last.lat, last.lon, p.lat, p.lon) < 0.5) continue;
    clean.push(p);
  }
  if (clean.length === 0) return [];
  const out: StoredRoutePoint[] = [[clean[0].lat, clean[0].lon, 0, clean[0].ele]];
  let cum = 0;
  for (let i = 1; i < clean.length; i++) {
    const a = clean[i - 1];
    const b = clean[i];
    const seg = haversineM(a.lat, a.lon, b.lat, b.lon);
    const steps = Math.max(1, Math.ceil(seg / maxSpacingM));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const lat = a.lat + (b.lat - a.lat) * t;
      const lon = a.lon + (b.lon - a.lon) * t;
      const ele = a.ele + (b.ele - a.ele) * t;
      cum += seg / steps;
      out.push([lat, lon, cum, ele]);
    }
  }
  return out;
}

/* ─── Index ───────────────────────────────────────────────────────────────── */

export function buildRouteIndex(points: StoredRoutePoint[]): RouteIndex {
  const n = points.length;
  const lat = new Float64Array(n);
  const lon = new Float64Array(n);
  const cumM = new Float64Array(n);
  const eleM = new Float64Array(n);
  let minLat = Infinity;
  let minLon = Infinity;
  let maxLat = -Infinity;
  let maxLon = -Infinity;
  for (let i = 0; i < n; i++) {
    const [la, lo, c, e] = points[i];
    lat[i] = la;
    lon[i] = lo;
    cumM[i] = c;
    eleM[i] = e;
    if (la < minLat) minLat = la;
    if (la > maxLat) maxLat = la;
    if (lo < minLon) minLon = lo;
    if (lo > maxLon) maxLon = lo;
  }
  return {
    lengthM: n ? cumM[n - 1] : 0,
    lat,
    lon,
    cumM,
    eleM,
    bbox: n ? [minLat, minLon, maxLat, maxLon] : [0, 0, 0, 0],
  };
}

/** GPX text → the stored points and the in-memory index, in one go. */
export function routeIndexFromGpx(xml: string): { stored: StoredRoutePoint[]; index: RouteIndex } {
  const stored = densify(parseGpx(xml));
  return { stored, index: buildRouteIndex(stored) };
}

/** Validate what came back from TrackerRoute.points (a JSON column). */
export function storedPointsFromJson(json: unknown): StoredRoutePoint[] {
  if (!Array.isArray(json)) throw new Error("route points: not an array");
  const out: StoredRoutePoint[] = new Array(json.length);
  for (let i = 0; i < json.length; i++) {
    const p = json[i];
    if (!Array.isArray(p) || p.length < 3) throw new Error(`route points: bad point at ${i}`);
    const lat = Number(p[0]);
    const lon = Number(p[1]);
    const cum = Number(p[2]);
    const ele = Number(p[3] ?? 0);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(cum)) {
      throw new Error(`route points: non-finite at ${i}`);
    }
    out[i] = [lat, lon, cum, Number.isFinite(ele) ? ele : 0];
  }
  return out;
}

/* ─── Lookups ─────────────────────────────────────────────────────────────── */

/** First index whose cumM is >= m (clamped into [0, n-1]). */
export function indexAtRouteM(index: RouteIndex, m: number): number {
  const { cumM } = index;
  const n = cumM.length;
  if (n === 0) return 0;
  if (m <= 0) return 0;
  if (m >= cumM[n - 1]) return n - 1;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cumM[mid] < m) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The point `m` metres along the route, interpolated between neighbours. */
export function pointAtRouteM(index: RouteIndex, m: number): { lat: number; lon: number; ele: number } {
  const n = index.cumM.length;
  if (n === 0) return { lat: 0, lon: 0, ele: 0 };
  const clamped = Math.max(0, Math.min(index.lengthM, m));
  const i = indexAtRouteM(index, clamped);
  if (i === 0) return { lat: index.lat[0], lon: index.lon[0], ele: index.eleM[0] };
  const a = i - 1;
  const span = index.cumM[i] - index.cumM[a];
  const t = span > 0 ? (clamped - index.cumM[a]) / span : 0;
  return {
    lat: index.lat[a] + (index.lat[i] - index.lat[a]) * t,
    lon: index.lon[a] + (index.lon[i] - index.lon[a]) * t,
    ele: index.eleM[a] + (index.eleM[i] - index.eleM[a]) * t,
  };
}

/* ─── Snapping (section 9) ────────────────────────────────────────────────── */

/**
 * Local flat projection around (lat0, lon0): metres east and north. Good to
 * well under 1% for the few kilometres we ever compare.
 */
function localXY(lat0: number, lon0: number, lat: number, lon: number): [number, number] {
  const kx = Math.cos(lat0 * DEG) * R_EARTH * DEG;
  const ky = R_EARTH * DEG;
  return [(lon - lon0) * kx, (lat - lat0) * ky];
}

/** Nearest route point in [from, to] (inclusive) — index and squared distance. */
function nearestIn(index: RouteIndex, lat: number, lon: number, from: number, to: number): { idx: number; d2: number } {
  const kx = Math.cos(lat * DEG) * R_EARTH * DEG;
  const ky = R_EARTH * DEG;
  let best = -1;
  let bestD2 = Infinity;
  const { lat: la, lon: lo } = index;
  for (let i = from; i <= to; i++) {
    const dx = (lo[i] - lon) * kx;
    const dy = (la[i] - lat) * ky;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }
  return { idx: best, d2: bestD2 };
}

/**
 * Refine around the nearest point: project onto the segments on either side
 * of it and take the closer projection. Gives a continuous route_m instead
 * of one quantized to the 25 m grid, and a true perpendicular off_route_m.
 */
function refine(index: RouteIndex, lat: number, lon: number, idx: number): { routeM: number; offRouteM: number } {
  const n = index.cumM.length;
  let bestM = index.cumM[idx];
  let bestD = haversineM(lat, lon, index.lat[idx], index.lon[idx]);
  const [px, py] = [0, 0];
  for (const j of [idx - 1, idx + 1]) {
    if (j < 0 || j >= n) continue;
    const a = Math.min(idx, j);
    const b = Math.max(idx, j);
    const [ax, ay] = localXY(lat, lon, index.lat[a], index.lon[a]);
    const [bx, by] = localXY(lat, lon, index.lat[b], index.lon[b]);
    const vx = bx - ax;
    const vy = by - ay;
    const len2 = vx * vx + vy * vy;
    if (len2 === 0) continue;
    let t = ((px - ax) * vx + (py - ay) * vy) / len2;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + vx * t;
    const qy = ay + vy * t;
    const d = Math.hypot(qx - px, qy - py);
    if (d < bestD) {
      bestD = d;
      bestM = index.cumM[a] + (index.cumM[b] - index.cumM[a]) * t;
    }
  }
  return { routeM: bestM, offRouteM: bestD };
}

/**
 * Snap a fix to the route.
 *
 * 1. With `aroundM` (the entry's current progress), search the window from
 *    500 m behind to 5 km ahead of it; accept the nearest point there when
 *    it is within 150 m. This keeps out-and-back or overlapping sections
 *    from snapping to the wrong pass.
 * 2. Otherwise search the whole route.
 *
 * The caller decides what to do with `offRouteM` (> 300 m: keep the fix for
 * the map, do not advance progress — SNAP_RULES.offRouteMaxM).
 */
export function snapToRoute(index: RouteIndex, lat: number, lon: number, aroundM: number | null): SnapResult {
  const n = index.cumM.length;
  if (n === 0) return { routeM: 0, offRouteM: Infinity, idx: 0, inWindow: false };
  if (aroundM !== null && Number.isFinite(aroundM)) {
    const from = indexAtRouteM(index, aroundM - SNAP_RULES.windowBehindM);
    const to = indexAtRouteM(index, aroundM + SNAP_RULES.windowAheadM);
    const w = nearestIn(index, lat, lon, from, to);
    if (w.idx >= 0 && Math.sqrt(w.d2) <= SNAP_RULES.windowAcceptM) {
      const r = refine(index, lat, lon, w.idx);
      return { ...r, idx: w.idx, inWindow: true };
    }
  }
  const g = nearestIn(index, lat, lon, 0, n - 1);
  const r = refine(index, lat, lon, g.idx);
  return { ...r, idx: g.idx, inWindow: false };
}

/* ─── For the map ─────────────────────────────────────────────────────────── */

/**
 * A uniformly decimated copy of the line for the route file: GeoJSON
 * [lon, lat] order plus the cumulative distance of each kept point, so the
 * client can split the completed part at any progress value.
 */
export function decimateForMap(index: RouteIndex, maxPoints = 2500): { coords: [number, number][]; cumM: number[] } {
  const n = index.cumM.length;
  const coords: [number, number][] = [];
  const cumM: number[] = [];
  if (n === 0) return { coords, cumM };
  const step = n <= maxPoints ? 1 : (n - 1) / (maxPoints - 1);
  for (let k = 0; ; k++) {
    const i = Math.min(n - 1, Math.round(k * step));
    coords.push([index.lon[i], index.lat[i]]);
    cumM.push(index.cumM[i]);
    if (i >= n - 1) break;
  }
  return { coords, cumM };
}
