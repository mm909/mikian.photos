/**
 * THE BASEMAP for the route stickers (owner, 2026-10-25: "I'd also like 2
 * different map views of the route. One with cities or the coast line
 * drawn. And another with the major roads drawn."). Pulls, once, from
 * OpenStreetMap through the Overpass API:
 *   - the coastline (natural=coastline) of the Santa Monica → San Diego box
 *   - the major roads: every motorway and trunk, plus CA 1 / the Pacific
 *     Coast Highway, which the course runs on
 *   - a curated list of places, by name, with their coordinates
 * CHAINS the ways end to end (OSM cuts a freeway into thousands of short
 * ways; a chain simplifies, a stub does not), simplifies the lines
 * (Douglas–Peucker, 120 m), rounds to four decimals and writes
 *   public/lasd26/route/basemap.json
 *   { coast: [[lon,lat]…][], roads: { motorway, trunk, coast: the same },
 *     cities: [{ name, lon, lat, place }], bbox }
 * in GeoJSON order, [lon, lat] — the first cut was 1.6 MB of unchained
 * segments, this one is a few hundred KB. The stickers draw it with the
 * same flat projection as the course (src/app/lasd26/stickers/paint.ts).
 *
 *   NODE_OPTIONS=--dns-result-order=ipv4first npx tsx scripts/lasd26-basemap.ts
 *
 * (ipv4first: this machine's IPv6 is broken.) The raw Overpass answers
 * are cached next to the output (public/lasd26/route/.overpass-cache,
 * gitignored by name below) so a second run only re-chains; delete the
 * cache to refresh the data.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const OUT = resolve(__dirname, "../public/lasd26/route/basemap.json");
/** south, west, north, east — the course's box with room around it. */
const BBOX = [32.55, -118.75, 34.25, -116.95] as const;
const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
const SIMPLIFY_M = 120;
const CACHE_DIR = resolve(__dirname, "../public/lasd26/route/.overpass-cache");
const PLACES = [
  "Santa Monica",
  "Los Angeles",
  "Inglewood",
  "Long Beach",
  "Anaheim",
  "Santa Ana",
  "Huntington Beach",
  "Newport Beach",
  "Irvine",
  "Laguna Beach",
  "Dana Point",
  "San Clemente",
  "Oceanside",
  "Carlsbad",
  "Encinitas",
  "Del Mar",
  "La Jolla",
  "Pacific Beach",
  "San Diego",
  "Escondido",
  "Riverside",
  "Mission Viejo",
  "Torrance",
  "Downey",
  "Seal Beach",
];

type LonLat = [number, number];
type OverpassWay = { type: "way"; id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] };
type OverpassNode = { type: "node"; id: number; lat: number; lon: number; tags?: Record<string, string> };

async function overpass(query: string, timeoutMs = 240_000): Promise<(OverpassWay | OverpassNode)[]> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = resolve(CACHE_DIR, createHash("sha1").update(query).digest("hex").slice(0, 16) + ".json");
  if (existsSync(cacheFile)) {
    const cached = JSON.parse(readFileSync(cacheFile, "utf8")) as (OverpassWay | OverpassNode)[];
    console.log(`  cache: ${cached.length} elements`);
    return cached;
  }
  let lastErr: unknown = null;
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "mikian.photos lasd26-basemap (https://mikianmusser.com)" },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
      const json = (await res.json()) as { elements: (OverpassWay | OverpassNode)[] };
      console.log(`  ${url}: ${json.elements.length} elements`);
      writeFileSync(cacheFile, JSON.stringify(json.elements));
      return json.elements;
    } catch (err) {
      lastErr = err;
      console.warn(`  ${url} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("every Overpass endpoint failed");
}

const bboxClause = `[bbox:${BBOX.join(",")}]`;

/* ─── Simplify ───────────────────────────────────────────────────────────── */

const DEG = Math.PI / 180;
function xy(p: LonLat, lat0: number): [number, number] {
  return [p[0] * 111320 * Math.cos(lat0 * DEG), p[1] * 110540];
}
function dp(points: LonLat[], tolM: number): LonLat[] {
  if (points.length <= 2) return points;
  const lat0 = points[0][1];
  const P = points.map((p) => xy(p, lat0));
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let worst = -1;
    let worstD = 0;
    const [ax, ay] = P[a];
    const [bx, by] = P[b];
    const vx = bx - ax;
    const vy = by - ay;
    const len2 = vx * vx + vy * vy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = P[i];
      let d: number;
      if (len2 === 0) d = Math.hypot(px - ax, py - ay);
      else {
        const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / len2));
        d = Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
      }
      if (d > worstD) {
        worstD = d;
        worst = i;
      }
    }
    if (worst >= 0 && worstD > tolM) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;
const rawLine = (w: OverpassWay): LonLat[] => (w.geometry ?? []).map((g) => [g.lon, g.lat] as LonLat);
const finish = (l: LonLat[]): LonLat[] => {
  const out = dp(l, SIMPLIFY_M).map(([lon, lat]) => [r4(lon), r4(lat)] as LonLat);
  // Rounding can fold neighbours together.
  return out.filter((p, i) => i === 0 || p[0] !== out[i - 1][0] || p[1] !== out[i - 1][1]);
};

/* ─── Chain ──────────────────────────────────────────────────────────────── */

/**
 * Join lines end to end wherever an endpoint meets exactly one other
 * line's endpoint. OSM cuts a freeway into thousands of short ways; the
 * joined chain simplifies to a few points where the stubs could not.
 */
function chain(lines: LonLat[][]): LonLat[][] {
  const key = (p: LonLat) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
  const ends = new Map<string, number[]>();
  lines.forEach((l, i) => {
    for (const k of [key(l[0]), key(l[l.length - 1])]) ends.set(k, [...(ends.get(k) ?? []), i]);
  });
  const used = new Uint8Array(lines.length);
  const out: LonLat[][] = [];
  // The one other line that ends at `p`, `from` (the line that brought us
  // here) not counted; null at a junction or a dead end, or when it is taken.
  const next = (p: LonLat, from: number): number | null => {
    const others = (ends.get(key(p)) ?? []).filter((j) => j !== from);
    return others.length === 1 && !used[others[0]] ? others[0] : null;
  };
  for (let i = 0; i < lines.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    let pts = [...lines[i]];
    // Forward.
    let last = i;
    for (let guard = 0; guard < 100_000; guard++) {
      const j = next(pts[pts.length - 1], last);
      if (j === null) break;
      used[j] = 1;
      const l = lines[j];
      const forward = key(l[0]) === key(pts[pts.length - 1]);
      pts = pts.concat((forward ? l : [...l].reverse()).slice(1));
      last = j;
    }
    // Backward.
    let first = i;
    for (let guard = 0; guard < 100_000; guard++) {
      const j = next(pts[0], first);
      if (j === null) break;
      used[j] = 1;
      const l = lines[j];
      const forward = key(l[l.length - 1]) === key(pts[0]);
      pts = (forward ? l : [...l].reverse()).slice(0, -1).concat(pts);
      first = j;
    }
    out.push(pts);
  }
  return out;
}

/* ─── Main ───────────────────────────────────────────────────────────────── */

async function main() {
  console.log("coastline…");
  const coastWays = (await overpass(`[out:json][timeout:180]${bboxClause};way["natural"="coastline"];out geom;`)).filter((e): e is OverpassWay => e.type === "way");
  const coast = chain(coastWays.map(rawLine).filter((l) => l.length >= 2)).map(finish).filter((l) => l.length >= 2);

  console.log("major roads…");
  const roadQuery =
    `[out:json][timeout:240]${bboxClause};(` +
    `way["highway"~"^(motorway|trunk)$"];` +
    `way["highway"~"^(primary|secondary|trunk)$"]["ref"~"(^|;)(CA|SR) ?1($|;)"];` +
    `way["highway"]["name"~"Pacific Coast H(igh)?w(a)?y"];` +
    `);out geom;`;
  const roadWays = (await overpass(roadQuery)).filter((e): e is OverpassWay => e.type === "way");
  const kindOf = (w: OverpassWay): "motorway" | "trunk" | "coast" => (w.tags?.highway === "motorway" ? "motorway" : w.tags?.highway === "trunk" ? "trunk" : "coast");
  const roads: Record<"motorway" | "trunk" | "coast", LonLat[][]> = { motorway: [], trunk: [], coast: [] };
  for (const kind of ["motorway", "trunk", "coast"] as const) {
    const raw = roadWays.filter((w) => kindOf(w) === kind).map(rawLine).filter((l) => l.length >= 2);
    roads[kind] = chain(raw).map(finish).filter((l) => l.length >= 2);
    console.log(`  ${kind}: ${raw.length} ways → ${roads[kind].length} chains`);
  }

  console.log("places…");
  const nameRe = `^(${PLACES.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})$`;
  let placeNodes: OverpassNode[] = [];
  try {
    placeNodes = (await overpass(`[out:json][timeout:60]${bboxClause};node["place"~"^(city|town|suburb|neighbourhood|village)$"]["name"~"${nameRe}"];out;`, 60_000)).filter(
      (e): e is OverpassNode => e.type === "node",
    );
  } catch (err) {
    // Overpass rate-limits after the big road query now and then: the
    // places the previous basemap.json carries are as good as new.
    console.warn(`  places: Overpass would not answer (${err instanceof Error ? err.message : String(err)}); keeping the previous file's`);
    if (existsSync(OUT)) {
      const prev = JSON.parse(readFileSync(OUT, "utf8")) as { cities?: { name: string; lon: number; lat: number; place: string }[] };
      placeNodes = (prev.cities ?? []).map((c, i) => ({ type: "node" as const, id: i, lat: c.lat, lon: c.lon, tags: { name: c.name, place: c.place } }));
    }
  }
  // One per name: the biggest place class first, then the largest population.
  const rank: Record<string, number> = { city: 0, town: 1, suburb: 2, neighbourhood: 3, village: 4 };
  const byName = new Map<string, OverpassNode>();
  for (const n of placeNodes) {
    const name = n.tags?.name ?? "";
    const cur = byName.get(name);
    const better =
      !cur ||
      (rank[n.tags?.place ?? ""] ?? 9) < (rank[cur.tags?.place ?? ""] ?? 9) ||
      ((rank[n.tags?.place ?? ""] ?? 9) === (rank[cur.tags?.place ?? ""] ?? 9) && Number(n.tags?.population ?? 0) > Number(cur.tags?.population ?? 0));
    if (better) byName.set(name, n);
  }
  const cities = PLACES.filter((p) => byName.has(p)).map((p) => {
    const n = byName.get(p)!;
    return { name: p, lon: r4(n.lon), lat: r4(n.lat), place: n.tags?.place ?? "" };
  });
  const missing = PLACES.filter((p) => !byName.has(p));
  if (missing.length) console.warn("  not found:", missing.join(", "));

  const out = {
    generated_at: new Date().toISOString(),
    source: "OpenStreetMap via Overpass (ODbL)",
    bbox: [BBOX[1], BBOX[0], BBOX[3], BBOX[2]],
    simplify_m: SIMPLIFY_M,
    coast,
    roads,
    cities,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  const json = JSON.stringify(out);
  writeFileSync(OUT, json);
  const pts = (ls: LonLat[][]) => ls.reduce((n, l) => n + l.length, 0);
  const roadLines = [...roads.motorway, ...roads.trunk, ...roads.coast];
  console.log(`wrote ${OUT}: coast ${coast.length} lines / ${pts(coast)} pts, roads ${roadLines.length} / ${pts(roadLines)} pts, cities ${cities.length}, ${(json.length / 1024).toFixed(0)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
