import { MI, eleAt, pointAt, type CourseCheckpoint, type CourseFile, type CoursePlace, type CourseTurn } from "@/app/tsp/lalv/course";

/**
 * FIX A STRETCH OF THE COURSE (owner, 2026-11-16, of the line zig-zagging
 * through Lenwood: "allow me to clean up/edit a map").
 *
 * A captain marks where the bad part starts and ends on the line, optionally
 * taps the roads it should follow, and this cuts the old stretch out and
 * splices a new one in:
 *
 *   "road"      one request to the FOSSGIS Valhalla server, on foot, from the
 *               start through the tapped points to the end — the same router
 *               and costing the stock courses were built with
 *               (scripts/tsp-lalv-course.mjs), so the turn list comes along.
 *   "straight"  the line exactly as tapped, for desert where the map has no
 *               path to route on. No turns; counted as dirt.
 *
 * Everything after the stretch shifts by the difference in length — the
 * distances, the turns, the places, the dirt, the elevation profile — so the
 * file stays one honest course. The caller (the API route) moves the team's
 * legs by the same rule (remapCm).
 *
 * No "server-only" here on purpose: the function is pure but for two fetches
 * and a script can exercise it.
 */

const VALHALLA = "https://valhalla1.openstreetmap.de";
const TOPO = "https://api.opentopodata.org/v1/srtm30m";
const UA = "tsp-course-builder";

export const MAX_OLD_M = 30 * MI;
export const MAX_NEW_M = 40 * MI;
export const MAX_VIAS = 12;
const MIN_OLD_M = 20;

export type FixMode = "road" | "straight";
export type FixArgs = { fromM: number; toM: number; vias: [number, number][]; mode: FixMode };
export type FixResult = {
  course: CourseFile;
  /** The new stretch, [lon, lat], from the start mark to the end mark. */
  stretch: [number, number][];
  /** How long the stretch was and is, metres. */
  oldM: number;
  newM: number;
};

/** A problem the captain can do something about; `status` is the HTTP answer. */
export class FixError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const round = (n: number, p: number) => Math.round(n * 10 ** p) / 10 ** p;

function hav(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const d = Math.PI / 180;
  const x = Math.sin(((bLat - aLat) * d) / 2) ** 2 + Math.cos(aLat * d) * Math.cos(bLat * d) * Math.sin(((bLon - aLon) * d) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const dist = (a: [number, number], b: [number, number]) => hav(a[1], a[0], b[1], b[0]);

/** Valhalla's polyline, six decimals → [lon, lat]. */
function decode6(str: string): [number, number][] {
  const out: [number, number][] = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  while (i < str.length) {
    for (const which of [0, 1]) {
      let shift = 0;
      let result = 0;
      let b: number;
      do {
        b = str.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += d;
      else lon += d;
    }
    out.push([lon / 1e6, lat / 1e6]);
  }
  return out;
}

function encode6(coords: [number, number][]): string {
  let out = "";
  let pLat = 0;
  let pLon = 0;
  const enc = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    let s = "";
    while (n >= 0x20) {
      s += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    return s + String.fromCharCode(n + 63);
  };
  for (const [lon, lat] of coords) {
    const la = Math.round(lat * 1e6);
    const lo = Math.round(lon * 1e6);
    out += enc(la - pLat) + enc(lo - pLon);
    pLat = la;
    pLon = lo;
  }
  return out;
}

/** Douglas–Peucker over [lon, lat], metres. Returns the kept indices (the script's). */
function simplify(coords: [number, number][], tol: number, must: number[]): number[] {
  const keep = new Set<number>([0, coords.length - 1, ...must.filter((i) => i >= 0 && i < coords.length)]);
  const anchors = Array.from(keep).sort((a, b) => a - b);
  const perp = (p: [number, number], a: [number, number], b: [number, number]) => {
    const kx = Math.cos((a[1] * Math.PI) / 180) * 111320;
    const ky = 110540;
    const bx = (b[0] - a[0]) * kx;
    const by = (b[1] - a[1]) * ky;
    const px = (p[0] - a[0]) * kx;
    const py = (p[1] - a[1]) * ky;
    const len2 = bx * bx + by * by;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / len2));
    return Math.hypot(px - bx * t, py - by * t);
  };
  for (let k = 1; k < anchors.length; k++) {
    const stack: [number, number][] = [[anchors[k - 1], anchors[k]]];
    while (stack.length) {
      const [s, e] = stack.pop() as [number, number];
      if (e - s < 2) continue;
      let best = -1;
      let bestD = -1;
      for (let i = s + 1; i < e; i++) {
        const d = perp(coords[i], coords[s], coords[e]);
        if (d > bestD) {
          bestD = d;
          best = i;
        }
      }
      if (bestD > tol) {
        keep.add(best);
        stack.push([s, best], [best, e]);
      }
    }
  }
  return Array.from(keep).sort((a, b) => a - b);
}

/** Manoeuvre types that are a place to turn (the script's list). */
const TURN_TYPES = new Set([9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24, 26, 27]);
const COSTING = { pedestrian: { use_tracks: 0.6, max_hiking_difficulty: 3, walkway_factor: 1.2, alley_factor: 3, step_penalty: 60, use_ferry: 0 } };

type Maneuver = { type: number; instruction?: string; street_names?: string[]; begin_shape_index: number };
type RawTurn = { idx: number; name: string; street: string | null };

async function postJson(url: string, body: unknown, timeoutMs: number): Promise<{ ok: boolean; status: number; json: unknown }> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "user-agent": UA }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

/** One request on foot, start → vias → end: the line and where it turns. */
async function routeOnFoot(points: [number, number][]): Promise<{ coords: [number, number][]; turns: RawTurn[] }> {
  const body = {
    locations: points.map(([lon, lat], i) => ({ lat, lon, radius: 30, type: i === 0 || i === points.length - 1 ? "break" : "through" })),
    costing: "pedestrian",
    costing_options: COSTING,
    directions_options: { units: "miles" },
  };
  let ans: Awaited<ReturnType<typeof postJson>>;
  try {
    ans = await postJson(`${VALHALLA}/route`, body, 20_000);
  } catch {
    throw new FixError("The router did not answer — try again in a minute.", 502);
  }
  if (!ans.ok) {
    // A 400 is the request's fault (a point off any road, no way through): no retry fixes it.
    if (ans.status === 400) throw new FixError("The router could not find a way on foot between those points. Move a point onto a road, or use straight lines.", 422);
    throw new FixError("The router is busy — try again in a minute.", 502);
  }
  const legs = ((ans.json as { trip?: { legs?: { shape: string; maneuvers?: Maneuver[] }[] } } | null)?.trip?.legs ?? []) as { shape: string; maneuvers?: Maneuver[] }[];
  const coords: [number, number][] = [];
  const turns: RawTurn[] = [];
  for (const leg of legs) {
    const pts = decode6(leg.shape);
    const base = coords.length === 0 ? 0 : coords.length - 1;
    for (const p of coords.length === 0 ? pts : pts.slice(1)) coords.push(p);
    for (const m of leg.maneuvers ?? []) {
      if (!TURN_TYPES.has(m.type)) continue;
      turns.push({ idx: base + m.begin_shape_index, name: String(m.instruction ?? "Turn").replace(/\.$/, ""), street: (m.street_names ?? [])[0] ?? null });
    }
  }
  if (coords.length < 2) throw new FixError("The router could not find a way on foot between those points.", 422);
  return { coords, turns };
}

/** paved / dirt along a line, as runs of [fromM, toM] measured from its first point. Best effort: [] on any failure. */
async function dirtOf(coords: [number, number][], cum: number[]): Promise<[number, number][]> {
  try {
    const body = {
      encoded_polyline: encode6(coords),
      costing: "pedestrian",
      shape_match: "map_snap",
      filters: { attributes: ["edge.surface", "edge.unpaved", "edge.begin_shape_index", "edge.end_shape_index"], action: "include" },
    };
    const ans = await postJson(`${VALHALLA}/trace_attributes`, body, 8_000);
    if (!ans.ok) return [];
    const edges = ((ans.json as { edges?: { begin_shape_index: number; end_shape_index: number; unpaved?: boolean; surface?: string }[] } | null)?.edges ?? []);
    const out: [number, number][] = [];
    for (const e of edges) {
      const isDirt = e.unpaved === true || /dirt|gravel|compacted|path|impassable/.test(String(e.surface ?? ""));
      if (!isDirt) continue;
      const from = cum[Math.min(cum.length - 1, e.begin_shape_index)];
      const to = cum[Math.min(cum.length - 1, e.end_shape_index)];
      const prev = out[out.length - 1];
      if (prev && from - prev[1] < 120) prev[1] = Math.max(prev[1], to);
      else out.push([from, to]);
    }
    return out.filter(([a, b]) => b - a >= 150);
  } catch {
    return [];
  }
}

/** SRTM heights for up to 100 points in one request; null on any failure. */
async function heights(points: [number, number][]): Promise<number[] | null> {
  if (points.length === 0) return [];
  try {
    const q = points.map(([lon, lat]) => `${lat.toFixed(5)},${lon.toFixed(5)}`).join("|");
    const res = await fetch(`${TOPO}?locations=${q}`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(8_000), cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as { results?: { elevation: number | null }[] };
    const out = (j.results ?? []).map((r) => (typeof r.elevation === "number" ? r.elevation : NaN));
    if (out.length !== points.length) return null;
    for (let i = 0; i < out.length; i++) if (Number.isNaN(out[i])) out[i] = out[i - 1] ?? out.find((v) => !Number.isNaN(v)) ?? NaN;
    return out.some((v) => Number.isNaN(v)) ? null : out;
  } catch {
    return null;
  }
}

/** The point `m` metres along a line with running distances. */
function along(coords: [number, number][], cum: number[], m: number): [number, number] {
  let i = 0;
  while (i < cum.length - 2 && cum[i + 1] < m) i++;
  const span = cum[i + 1] - cum[i];
  const t = span > 0 ? Math.max(0, Math.min(1, (m - cum[i]) / span)) : 0;
  return [coords[i][0] + (coords[i + 1][0] - coords[i][0]) * t, coords[i][1] + (coords[i + 1][1] - coords[i][1]) * t];
}

/** Where a point falls on a line: metres along, the point there, and how far off. */
function snap(coords: [number, number][], cum: number[], lon: number, lat: number): { m: number; p: [number, number]; off: number } {
  const kx = Math.cos((lat * Math.PI) / 180) * 111320;
  const ky = 110540;
  let best = { m: 0, p: coords[0], off: Infinity };
  for (let i = 1; i < coords.length; i++) {
    const ax = (coords[i - 1][0] - lon) * kx;
    const ay = (coords[i - 1][1] - lat) * ky;
    const vx = (coords[i][0] - coords[i - 1][0]) * kx;
    const vy = (coords[i][1] - coords[i - 1][1]) * ky;
    const len2 = vx * vx + vy * vy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, (-ax * vx - ay * vy) / len2)) : 0;
    const d = Math.hypot(ax + vx * t, ay + vy * t);
    if (d < best.off) best = { m: cum[i - 1] + (cum[i] - cum[i - 1]) * t, p: [coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t, coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t], off: d };
  }
  return best;
}

/** The climb and the descent over a profile, 3 m hysteresis (the script's). */
export function climbOf(profile: [number, number][]): { up: number; down: number } {
  let up = 0;
  let down = 0;
  let ref = profile.length ? profile[0][1] : 0;
  for (const [, e] of profile) {
    if (e - ref >= 3) {
      up += e - ref;
      ref = e;
    } else if (ref - e >= 3) {
      down += ref - e;
      ref = e;
    }
  }
  return { up, down };
}

const okPoint = (p: unknown): p is [number, number] =>
  Array.isArray(p) && p.length === 2 && typeof p[0] === "number" && typeof p[1] === "number" && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;

/** Read the request's body into FixArgs, or say what is wrong with it. */
export function parseFixArgs(body: Record<string, unknown>): FixArgs | string {
  const { fromM, toM, vias, mode } = body;
  if (typeof fromM !== "number" || typeof toM !== "number" || !Number.isFinite(fromM) || !Number.isFinite(toM)) return "Mark where the stretch starts and ends.";
  if (mode !== "road" && mode !== "straight") return "Pick roads or straight lines.";
  const list = vias === undefined || vias === null ? [] : vias;
  if (!Array.isArray(list) || !list.every(okPoint)) return "A tapped point is not a place on the map.";
  if (list.length > MAX_VIAS) return `Use at most ${MAX_VIAS} points between the two marks.`;
  return { fromM, toM, vias: list as [number, number][], mode };
}

/**
 * Cut [fromM, toM] out of the course and splice the new stretch in. Throws
 * FixError with words for the captain; never changes `course`.
 */
export async function fixStretch(course: CourseFile, args: FixArgs): Promise<FixResult> {
  const fromM = Math.max(0, args.fromM);
  const toM = Math.min(course.length_m, args.toM);
  if (!(fromM < toM) || toM - fromM < MIN_OLD_M) throw new FixError("The end mark has to be further along the course than the start mark.");
  if (toM - fromM > MAX_OLD_M) throw new FixError("Pick a stretch shorter than 30 miles.");
  if (args.vias.length > MAX_VIAS) throw new FixError(`Use at most ${MAX_VIAS} points between the two marks.`);
  const oldM = toM - fromM;
  const a = pointAt(course, fromM);
  const b = pointAt(course, toM);

  // The new line, start mark to end mark, and its raw turns.
  let line: [number, number][];
  let rawTurns: RawTurn[] = [];
  if (args.mode === "road") {
    const r = await routeOnFoot([a, ...args.vias, b]);
    // The router starts on the nearest road edge; the line must start on the marks themselves.
    const pre = dist(a, r.coords[0]) > 1 ? 1 : 0;
    const full: [number, number][] = [...(pre ? [a] : []), ...r.coords, ...(dist(b, r.coords[r.coords.length - 1]) > 1 ? [b] : [])];
    const turns = r.turns.map((t) => ({ ...t, idx: t.idx + pre }));
    const keep = simplify(full, 4, turns.map((t) => t.idx));
    const at = new Map(keep.map((orig, k) => [orig, k] as const));
    line = keep.map((i) => full[i]);
    rawTurns = turns.map((t) => ({ ...t, idx: at.get(t.idx) ?? 0 }));
  } else {
    line = [a, ...args.vias, b];
  }
  line = line.map(([lon, lat]) => [round(lon, 5), round(lat, 5)] as [number, number]);

  const lineCum = [0];
  for (let i = 1; i < line.length; i++) lineCum.push(lineCum[i - 1] + dist(line[i - 1], line[i]));
  const newM = lineCum[lineCum.length - 1];
  if (newM < 1) throw new FixError("Those two marks are the same place.");
  if (newM > MAX_NEW_M) throw new FixError("The new stretch comes out longer than 40 miles — fix it in shorter pieces.");
  const delta = newM - oldM;
  const shift = (m: number) => m + delta;

  // Heights: one request, at most 95 points, never finer than 250 m; the ends keep the old heights.
  const eleFrom = eleAt(course, fromM);
  const eleTo = eleAt(course, toM);
  const step = Math.max(250, newM / 95);
  const sampleM: number[] = [];
  for (let m = step; m < newM - step / 2; m += step) sampleM.push(m);
  const got = await heights(sampleM.map((m) => along(line, lineCum, m)));
  const raw = [eleFrom, ...(got ?? sampleM.map((m) => eleFrom + ((eleTo - eleFrom) * m) / newM)), eleTo];
  // Smooth as the script does (5 samples), the two ends pinned.
  const sm = raw.map((v, i) => {
    if (i === 0 || i === raw.length - 1 || !got) return v;
    let s = 0;
    let n = 0;
    for (let k = Math.max(0, i - 2); k <= Math.min(raw.length - 1, i + 2); k++) {
      s += raw[k];
      n++;
    }
    return s / n;
  });
  const profile: [number, number][] = [
    ...course.profile.filter(([m]) => m < fromM - 1),
    [Math.round(fromM), Math.round(sm[0])],
    ...sampleM.map((m, i) => [Math.round(fromM + m), Math.round(sm[i + 1])] as [number, number]),
    [Math.round(fromM + newM), Math.round(sm[sm.length - 1])],
    ...course.profile.filter(([m]) => m > toM + 1).map(([m, e]) => [Math.round(shift(m)), e] as [number, number]),
  ];

  // Dirt: the old runs clipped off the stretch, the new stretch's own, the rest shifted.
  const newDirt: [number, number][] = args.mode === "straight" ? [[0, newM]] : await dirtOf(line, lineCum);
  const dirtAll: [number, number][] = [];
  for (const [d0, d1] of course.dirt) {
    if (d0 < fromM) dirtAll.push([d0, Math.min(d1, fromM)]);
  }
  for (const [d0, d1] of newDirt) dirtAll.push([fromM + d0, fromM + d1]);
  for (const [d0, d1] of course.dirt) {
    if (d1 > toM) dirtAll.push([shift(Math.max(d0, toM)), shift(d1)]);
  }
  const dirt: [number, number][] = [];
  for (const [d0, d1] of dirtAll.sort((x, y) => x[0] - y[0])) {
    if (d1 - d0 < 1) continue;
    const prev = dirt[dirt.length - 1];
    if (prev && d0 - prev[1] < 120) prev[1] = Math.max(prev[1], d1);
    else dirt.push([Math.round(d0), Math.round(d1)]);
  }
  for (const d of dirt) d[1] = Math.round(d[1]);

  // Turns: the old ones outside the stretch, the router's inside it; closer than 60 m reads as one.
  const turnsAll: CourseTurn[] = [
    ...course.turns.filter((t) => t.m < fromM),
    ...rawTurns
      .sort((x, y) => x.idx - y.idx)
      .map((t) => ({ name: t.name, street: t.street, lon: round(line[t.idx][0], 6), lat: round(line[t.idx][1], 6), m: Math.round(fromM + lineCum[t.idx]) })),
    ...course.turns.filter((t) => t.m > toM).map((t) => ({ ...t, m: Math.round(shift(t.m)) })),
  ];
  const turns: CourseTurn[] = [];
  for (const t of turnsAll) {
    const prev = turns[turns.length - 1];
    if (prev && t.m - prev.m < 60) continue;
    turns.push(t);
  }

  // Places and checkpoints inside the old stretch land on the new one.
  const places: CoursePlace[] = course.places.map((p) => {
    if (p.m <= fromM) return p;
    if (p.m >= toM) return { ...p, m: Math.round(shift(p.m)) };
    const s = snap(line, lineCum, p.lon, p.lat);
    return { ...p, lon: round(s.p[0], 6), lat: round(s.p[1], 6), m: Math.round(fromM + s.m) };
  });
  const checkpoints: CourseCheckpoint[] = course.checkpoints.map((c) => {
    if (c.m <= fromM) return c;
    if (c.m >= toM) return { ...c, m: Math.round(shift(c.m)) };
    const s = snap(line, lineCum, c.lon, c.lat);
    return { ...c, m: Math.round(fromM + s.m), off_m: Math.round(s.off) };
  });

  // The line itself.
  const coords: [number, number][] = [];
  const cum: number[] = [];
  const push = (p: [number, number], m: number) => {
    const last = coords[coords.length - 1];
    const mm = Math.max(Math.round(m), cum.length ? cum[cum.length - 1] : 0);
    if (last && last[0] === p[0] && last[1] === p[1]) return;
    coords.push(p);
    cum.push(mm);
  };
  for (let i = 0; i < course.coords.length && course.cum_m[i] < fromM; i++) push(course.coords[i], course.cum_m[i]);
  for (let i = 0; i < line.length; i++) push(line[i], fromM + lineCum[i]);
  for (let i = 0; i < course.coords.length; i++) if (course.cum_m[i] > toM) push(course.coords[i], shift(course.cum_m[i]));
  const lengthM = Math.round(course.length_m + delta);
  // The last vertex is the finish: its distance is the course's length.
  if (toM >= course.length_m) cum[cum.length - 1] = lengthM;

  let minLon = 180;
  let minLat = 90;
  let maxLon = -180;
  let maxLat = -90;
  for (const [lon, lat] of coords) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  const { up, down } = climbOf(profile);
  const base = course.source.replace(/; edited by the team.*$/, "");

  const next: CourseFile = {
    ...course,
    generated_at: new Date().toISOString(),
    source: `${base}; edited by the team (a stretch around mile ${(fromM / MI).toFixed(1)} ${args.mode === "road" ? "re-routed on foot by Valhalla" : "drawn by hand"})`,
    length_m: lengthM,
    climb_m: Math.round(up),
    descent_m: Math.round(down),
    dirt_m: Math.round(dirt.reduce((s, [d0, d1]) => s + (d1 - d0), 0)),
    bbox: [round(minLon, 5), round(minLat, 5), round(maxLon, 5), round(maxLat, 5)],
    coords,
    cum_m: cum,
    turns,
    places,
    checkpoints,
    dirt,
    profile,
  };
  return { course: next, stretch: line, oldM, newM };
}

/**
 * Where a leg's end (hundredths of a mile) lands after a fix: before the
 * stretch it stays, after it moves by the whole difference, inside it keeps
 * its share of the way along.
 */
export function remapCm(cm: number, fix: { fromM: number; oldM: number; newM: number }): number {
  const x = (cm / 100) * MI;
  const toM = fix.fromM + fix.oldM;
  if (x <= fix.fromM) return cm;
  if (x >= toM) return cm + Math.round(((fix.newM - fix.oldM) / MI) * 100);
  return Math.round(((fix.fromM + ((x - fix.fromM) * fix.newM) / fix.oldM) / MI) * 100);
}

/** A team's legs after a fix: remapped, kept in order and inside the new course; a leg squeezed to nothing is dropped. */
export function remapLegs<T extends { startCm: number; endCm: number }>(legs: T[], fix: { fromM: number; oldM: number; newM: number }, lengthM: number): T[] {
  const maxCm = Math.floor((lengthM / MI) * 100);
  const out: T[] = [];
  let floor = 0;
  for (const l of [...legs].sort((x, y) => x.startCm - y.startCm)) {
    const startCm = Math.max(floor, Math.min(maxCm, remapCm(l.startCm, fix)));
    const endCm = Math.min(maxCm, remapCm(l.endCm, fix));
    if (endCm <= startCm) continue;
    out.push({ ...l, startCm, endCm });
    floor = endCm;
  }
  return out;
}
