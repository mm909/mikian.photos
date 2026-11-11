/* THE GROUND UNDER SEA TO PDX — what the strip chart on /sea-to-pdx draws
 * beneath the route so the line reads as Seattle to Portland and not as a
 * squiggle: Puget Sound and the lakes, the Columbia and the rivers that
 * feed it, and Interstate 5, the road everyone already knows the way by.
 *
 *   node scripts/food-relays/build-northwest.mjs
 *
 * Writes src/app/sea-to-pdx/baseData.ts. Sources:
 *   land, lakes, rivers   Natural Earth 1:10m (public domain), the GeoJSON
 *                         copies in github.com/nvkelso/natural-earth-vector
 *   Interstate 5          OpenStreetMap through Overpass, southbound
 *                         carriageway only
 * Every download is kept beside this script (cache-*.json, not committed):
 * the files are large and Overpass is moody.
 *
 * Natural Earth is drawn for a map of a continent. At this scale the
 * shoreline is a sketch of itself: right for a chart nobody navigates by,
 * wrong for anything else. The street map lower on the page is the real
 * one. */
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const UA = { "user-agent": "food-relay-course-builder/0.1" };

/* A little wider than the chart's window (StripMap.tsx works its window
 * out from the route; this only has to cover it). */
const BOX = { w: -123.3, e: -121.6, s: 45.3, n: 47.85 };
const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/";

async function cached(name, load) {
  const file = resolve(HERE, `cache-${name}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const data = await load();
  /* An empty answer is a failed download, not a result worth keeping. */
  if (data.length) writeFileSync(file, JSON.stringify(data));
  else console.error(`nothing came back for ${name}: the chart draws without it this run`);
  return data;
}
async function getJson(url, init) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(120000), ...init });
      if (res.ok) return await res.json();
      last = new Error(`${res.status} ${url.slice(0, 90)}`);
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, 2500 * (i + 1)));
  }
  throw last;
}

const inBox = ([x, y]) => x >= BOX.w && x <= BOX.e && y >= BOX.s && y <= BOX.n;
const touches = (ring) => {
  let w = Infinity, e = -Infinity, s = Infinity, n = -Infinity;
  for (const [x, y] of ring) {
    if (x < w) w = x;
    if (x > e) e = x;
    if (y < s) s = y;
    if (y > n) n = y;
  }
  return w <= BOX.e && e >= BOX.w && s <= BOX.n && n >= BOX.s;
};

/* Sutherland-Hodgman: a ring cut down to the box. */
function clipRing(ring) {
  const edges = [
    [(p) => p[0] >= BOX.w, (a, b) => [BOX.w, a[1] + ((b[1] - a[1]) * (BOX.w - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= BOX.e, (a, b) => [BOX.e, a[1] + ((b[1] - a[1]) * (BOX.e - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= BOX.s, (a, b) => [a[0] + ((b[0] - a[0]) * (BOX.s - a[1])) / (b[1] - a[1]), BOX.s]],
    [(p) => p[1] <= BOX.n, (a, b) => [a[0] + ((b[0] - a[0]) * (BOX.n - a[1])) / (b[1] - a[1]), BOX.n]],
  ];
  let out = ring;
  for (const [inside, cut] of edges) {
    const src = out;
    out = [];
    for (let i = 0; i < src.length; i++) {
      const a = src[i];
      const b = src[(i + 1) % src.length];
      const ai = inside(a);
      const bi = inside(b);
      if (ai && bi) out.push(b);
      else if (ai && !bi) out.push(cut(a, b));
      else if (!ai && bi) out.push(cut(a, b), b);
    }
    if (!out.length) return [];
  }
  return out;
}
/* A line cut into the pieces that lie inside the box. */
function clipLine(line) {
  const pieces = [];
  let cur = [];
  for (const p of line) {
    if (inBox(p)) cur.push(p);
    else if (cur.length) {
      if (cur.length > 1) pieces.push(cur);
      cur = [];
    }
  }
  if (cur.length > 1) pieces.push(cur);
  return pieces;
}

/* Douglas-Peucker, tolerance in meters. */
const K = Math.cos((46.57 * Math.PI) / 180) * 111320;
const KY = 110540;
function simplify(line, tol) {
  if (line.length < 3) return line;
  const P = line.map(([lon, lat]) => [lon * K, lat * KY]);
  const keep = new Uint8Array(line.length);
  keep[0] = keep[line.length - 1] = 1;
  const stack = [[0, line.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const dx = P[b][0] - P[a][0];
    const dy = P[b][1] - P[a][1];
    const L = Math.hypot(dx, dy);
    let far = -1;
    let fd = tol;
    for (let i = a + 1; i < b; i++) {
      const d = L < 1e-6 ? Math.hypot(P[i][0] - P[a][0], P[i][1] - P[a][1]) : Math.abs((P[i][0] - P[a][0]) * dy - (P[i][1] - P[a][1]) * dx) / L;
      if (d > fd) {
        fd = d;
        far = i;
      }
    }
    if (far > 0) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  return line.filter((_, i) => keep[i]);
}
const r4 = (n) => Math.round(n * 1e4) / 1e4;
const round = (line) => line.map(([x, y]) => [r4(x), r4(y)]);

const polysOf = (g) => (!g ? [] : g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []);
const linesOf = (g) => (!g ? [] : g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : []);

/* ---- land: the outer rings that reach the box, cut to it */
const land = await cached("ne-land", async () => {
  const j = await getJson(`${NE}ne_10m_land.geojson`);
  const rings = [];
  for (const f of j.features) for (const poly of polysOf(f.geometry)) for (const ring of poly) if (touches(ring)) rings.push(ring);
  return rings;
});
const LAND = land
  .map((ring) => clipRing(ring))
  .filter((r) => r.length > 3)
  .map(round);

/* ---- lakes: both Natural Earth lake files, whatever falls in the box */
const lakes = await cached("ne-lakes", async () => {
  const out = [];
  for (const file of ["ne_10m_lakes.geojson", "ne_10m_lakes_north_america.geojson"]) {
    const j = await getJson(`${NE}${file}`);
    for (const f of j.features)
      for (const poly of polysOf(f.geometry)) if (touches(poly[0])) out.push({ name: f.properties.name || "", ring: poly[0] });
  }
  return out;
});
const LAKES = lakes
  .map((l) => ({ name: l.name, ring: round(clipRing(l.ring)) }))
  .filter((l) => l.ring.length > 3);

/* ---- rivers */
const rivers = await cached("ne-rivers", async () => {
  const out = [];
  for (const file of ["ne_10m_rivers_lake_centerlines.geojson", "ne_10m_rivers_north_america.geojson"]) {
    const j = await getJson(`${NE}${file}`);
    for (const f of j.features)
      for (const line of linesOf(f.geometry)) if (line.some(inBox)) out.push({ name: f.properties.name || "", line });
  }
  return out;
});
const RIVERS = [];
for (const r of rivers) for (const piece of clipLine(r.line)) RIVERS.push({ name: r.name, line: round(piece) });

/* ---- Interstate 5, southbound side */
const i5 = await cached("i5", async () => {
  const q = `[out:json][timeout:120];way["highway"="motorway"]["ref"~"(^|;)I 5($|;)"](${BOX.s},${BOX.w},${BOX.n},${BOX.e});out geom;`;
  for (const ep of ["https://overpass.kumi.systems/api/interpreter", "https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"]) {
    try {
      const j = await getJson(ep, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { ...UA, "content-type": "application/x-www-form-urlencoded" } });
      return j.elements.filter((w) => w.geometry && w.geometry.length > 1).map((w) => w.geometry.map((g) => [g.lon, g.lat]));
    } catch (e) {
      console.error("overpass", ep, e.message);
    }
  }
  return [];
});
/* Ways are drawn the way traffic runs: the southbound ones end south of
 * where they begin. Joined end to end where they meet, then thinned. */
const south = i5.filter((w) => w[w.length - 1][1] < w[0][1]);
const key = (p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
const byStart = new Map(south.map((w) => [key(w[0]), w]));
const hasPrev = new Set(south.map((w) => key(w[w.length - 1])));
const I5 = [];
const used = new Set();
for (const w of south) {
  if (hasPrev.has(key(w[0])) || used.has(w)) continue;
  let chain = [...w];
  used.add(w);
  let next = byStart.get(key(chain[chain.length - 1]));
  while (next && !used.has(next)) {
    used.add(next);
    chain = chain.concat(next.slice(1));
    next = byStart.get(key(chain[chain.length - 1]));
  }
  for (const piece of clipLine(chain)) I5.push(round(simplify(piece, 120)));
}

writeFileSync(
  resolve(ROOT, "src", "app", "sea-to-pdx", "baseData.ts"),
  `/* GENERATED by scripts/food-relays/build-northwest.mjs. The ground under
 * the SEA to PDX strip chart: [lon, lat]. Land, lakes and rivers are
 * Natural Earth 1:10m (public domain); Interstate 5 is OpenStreetMap,
 * (c) OpenStreetMap contributors. */
export const LAND: number[][][] = ${JSON.stringify(LAND)};

export const LAKES: { name: string; ring: number[][] }[] = ${JSON.stringify(LAKES)};

export const RIVERS: { name: string; line: number[][] }[] = ${JSON.stringify(RIVERS)};

export const I5: number[][][] = ${JSON.stringify(I5)};
`
);
const n = (a) => a.reduce((s, l) => s + l.length, 0);
console.log(`land ${LAND.length} rings ${n(LAND)} pts`);
console.log(`lakes ${LAKES.length}: ${LAKES.map((l) => `${l.name || "?"} (${l.ring.length})`).join(", ")}`);
console.log(`rivers ${RIVERS.length}: ${RIVERS.map((r) => `${r.name || "?"} (${r.line.length})`).join(", ")}`);
console.log(`I-5 ${i5.length} ways, ${south.length} southbound -> ${I5.length} pieces ${n(I5)} pts`);
