/**
 * THE TSP LA → LAS VEGAS COURSE (owner, 2026-11-16: "the route is a big deal
 * … there's no set route for us to follow. So we just need to pick the
 * fastest route … include a version of this route that has those 3
 * checkpoints").
 *
 *   NODE_OPTIONS=--dns-result-order=ipv4first node scripts/tsp-lalv-course.mjs [--only powerline|og|pahrump] [--no-surface]
 *
 * (ipv4first because this machine's IPv6 is broken and everything here is
 * fetched over the network.)
 *
 * Reads scripts/tsp-lalv/waypoints.json — the ROUTES (owner, 2026-11-16:
 * "save a few of these routes as different options. We want to take the
 * powerline route"): the road every route shares to Baker, then each
 * route's own way to the sign, as ordered points on the roads we mean to
 * run, picked by hand from the research (scripts/tsp-lalv/ROUTE.md), plus
 * each route's stand-in checkpoints — and writes, per route id,
 *   public/tsp/lalv-course/course-<id>.json           the course
 *   public/tsp/lalv-course/course-<id>-secrets.json   the same through the checkpoints
 *
 * HOW. Each pair of consecutive waypoints is routed ON FOOT by the FOSSGIS
 * Valhalla server (OpenStreetMap data; a pedestrian never gets a freeway),
 * which hands back the line and the manoeuvres with their street names: the
 * turn list. The elevation is SRTM 30 m from opentopodata, sampled along the
 * line; the climb is summed with a 3 m hysteresis so radar noise on a flat
 * desert road does not count as hills. The surface (paved / dirt) comes from
 * Valhalla's trace_attributes over the same line. The line is thinned
 * (Douglas–Peucker) for the page; the mile figures come from the full line.
 *
 * Polite: one request at a time, a pause between, every answer cached in
 * scripts/tsp-lalv/.cache so a re-run after a waypoint edit only fetches
 * what changed.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = resolve(ROOT, "scripts/tsp-lalv");
const CACHE = resolve(DIR, ".cache");
const OUT = resolve(ROOT, "public/tsp/lalv-course");
const VALHALLA = "https://valhalla1.openstreetmap.de";
const TOPO = "https://api.opentopodata.org/v1/srtm30m";
const UA = "tsp-course-builder";
const MI = 1609.344;
const MAX_COORDS = 14000;
const ELE_STEP_M = 250;

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const noSurface = args.includes("--no-surface");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (n, p) => Math.round(n * 10 ** p) / 10 ** p;

function hav(aLat, aLon, bLat, bLon) {
  const R = 6371000;
  const d = Math.PI / 180;
  const x = Math.sin(((bLat - aLat) * d) / 2) ** 2 + Math.cos(aLat * d) * Math.cos(bLat * d) * Math.sin(((bLon - aLon) * d) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Valhalla's polyline, six decimals → [lon, lat]. */
function decode6(str) {
  const out = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  while (i < str.length) {
    for (const which of [0, 1]) {
      let shift = 0;
      let result = 0;
      let b;
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

function encode6(coords) {
  let out = "";
  let pLat = 0;
  let pLon = 0;
  const enc = (v) => {
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

async function cached(kind, key, fn) {
  mkdirSync(CACHE, { recursive: true });
  const file = resolve(CACHE, `${kind}-${createHash("sha1").update(key).digest("hex").slice(0, 16)}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const val = await fn();
  writeFileSync(file, JSON.stringify(val));
  await sleep(1100);
  return val;
}

async function post(url, body, tries = 4) {
  for (let t = 1; ; t++) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "user-agent": UA }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) });
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
        // A 400 is the request's fault (two waypoints over 100 km apart, a point off any road): no retry fixes it.
        err.fatal = res.status === 400;
        throw err;
      }
      return await res.json();
    } catch (e) {
      if (t >= tries || e.fatal) throw e;
      console.warn(`  retry ${t}: ${e.message}`);
      await sleep(2500 * t);
    }
  }
}

/** One pair of waypoints on foot: the line and the manoeuvres. */
async function routeLeg(a, b) {
  const body = {
    locations: [
      { lat: a.lat, lon: a.lon, radius: 30 },
      { lat: b.lat, lon: b.lon, radius: 30 },
    ],
    costing: "pedestrian",
    // A relay runner on a road shoulder: tracks and dirt are fine, stairs and alleys are not worth a second.
    costing_options: { pedestrian: { use_tracks: 0.6, max_hiking_difficulty: 3, walkway_factor: 1.2, alley_factor: 3, step_penalty: 60, use_ferry: 0 } },
    directions_options: { units: "miles" },
  };
  const j = await cached("route", JSON.stringify(body), () => post(`${VALHALLA}/route`, body));
  const leg = j.trip.legs[0];
  return { coords: decode6(leg.shape), maneuvers: leg.maneuvers };
}

/** paved / dirt along a line, from the edges Valhalla walked. */
async function surfaceOf(coords) {
  const body = {
    encoded_polyline: encode6(coords),
    costing: "pedestrian",
    shape_match: "map_snap",
    filters: { attributes: ["edge.surface", "edge.unpaved", "edge.use", "edge.road_class", "edge.begin_shape_index", "edge.end_shape_index"], action: "include" },
  };
  const j = await cached("attr", body.encoded_polyline, () => post(`${VALHALLA}/trace_attributes`, body, 2));
  return (j.edges ?? []).map((e) => ({ from: e.begin_shape_index, to: e.end_shape_index, dirt: e.unpaved === true || /dirt|gravel|compacted|path|impassable/.test(String(e.surface ?? "")) }));
}

async function elevations(points) {
  const out = [];
  for (let i = 0; i < points.length; i += 100) {
    const chunk = points.slice(i, i + 100);
    const q = chunk.map(([lon, lat]) => `${lat.toFixed(5)},${lon.toFixed(5)}`).join("|");
    const j = await cached("ele", q, async () => {
      for (let t = 1; ; t++) {
        const res = await fetch(`${TOPO}?locations=${q}`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(60_000) });
        if (res.ok) return res.json();
        if (t >= 4) throw new Error(`elevation HTTP ${res.status}`);
        await sleep(3000 * t);
      }
    });
    for (const r of j.results) out.push(typeof r.elevation === "number" ? r.elevation : null);
    process.stdout.write(`\r  elevation ${Math.min(points.length, i + 100)}/${points.length}`);
  }
  process.stdout.write("\n");
  // A hole in the data takes its neighbour's height.
  for (let i = 0; i < out.length; i++) if (out[i] === null) out[i] = out[i - 1] ?? out.find((v) => v !== null) ?? 0;
  return out;
}

/** Douglas–Peucker over [lon, lat], metres. Returns the kept indices. */
function simplify(coords, tol, must) {
  const keep = new Set([0, coords.length - 1, ...must]);
  const anchors = [...keep].sort((a, b) => a - b);
  const perp = (p, a, b) => {
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
    const stack = [[anchors[k - 1], anchors[k]]];
    while (stack.length) {
      const [s, e] = stack.pop();
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
  return [...keep].sort((a, b) => a - b);
}

/** Manoeuvre types that are a place to turn (not "start", "continue", "arrive"). */
const TURN_TYPES = new Set([9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24, 26, 27]);

async function build(name, label, waypoints, checkpoints) {
  console.log(`\n${label}: ${waypoints.length} waypoints`);
  const coords = [];
  const turns = [];
  const places = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    process.stdout.write(`  ${String(i + 1).padStart(2)} ${a.name} → ${b.name} … `);
    const leg = await routeLeg(a, b);
    const base = coords.length === 0 ? 0 : coords.length - 1;
    const pts = coords.length === 0 ? leg.coords : leg.coords.slice(1);
    for (const p of pts) coords.push(p);
    let legM = 0;
    for (let k = 1; k < leg.coords.length; k++) legM += hav(leg.coords[k - 1][1], leg.coords[k - 1][0], leg.coords[k][1], leg.coords[k][0]);
    console.log(`${(legM / MI).toFixed(1)} mi`);
    if (!a.via) places.push({ name: a.name, idx: base, note: a.note ?? null, services: a.services ?? null });
    for (const m of leg.maneuvers) {
      if (!TURN_TYPES.has(m.type)) continue;
      turns.push({ idx: base + m.begin_shape_index, name: String(m.instruction).replace(/\.$/, ""), street: (m.street_names ?? [])[0] ?? null });
    }
  }
  const last = waypoints[waypoints.length - 1];
  places.push({ name: last.name, idx: coords.length - 1, note: last.note ?? null, services: last.services ?? null });

  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + hav(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]));
  const lengthM = cum[cum.length - 1];
  console.log(`  line: ${coords.length} points, ${(lengthM / MI).toFixed(1)} mi`);

  // Elevation every ELE_STEP_M along the line.
  const samples = [];
  let j = 0;
  for (let m = 0; m <= lengthM; m += ELE_STEP_M) {
    while (j < cum.length - 2 && cum[j + 1] < m) j++;
    const t = cum[j + 1] > cum[j] ? (m - cum[j]) / (cum[j + 1] - cum[j]) : 0;
    samples.push({ m, p: [coords[j][0] + (coords[j + 1][0] - coords[j][0]) * t, coords[j][1] + (coords[j + 1][1] - coords[j][1]) * t] });
  }
  samples.push({ m: lengthM, p: coords[coords.length - 1] });
  const eles = await elevations(samples.map((s) => s.p));
  // Smooth over ~1 km, then sum the climb with a 3 m hysteresis.
  const sm = eles.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let k = Math.max(0, i - 2); k <= Math.min(eles.length - 1, i + 2); k++) {
      s += eles[k];
      n++;
    }
    return s / n;
  });
  let climb = 0;
  let descent = 0;
  let ref = sm[0];
  for (const e of sm) {
    if (e - ref >= 3) {
      climb += e - ref;
      ref = e;
    } else if (ref - e >= 3) {
      descent += ref - e;
      ref = e;
    }
  }
  const profile = samples.map((s, i) => [Math.round(s.m), Math.round(sm[i])]);

  // Surface: runs of dirt as [fromM, toM].
  const dirt = [];
  if (!noSurface) {
    try {
      // Valhalla walks at most 200 km of trace per request: 60 km pieces.
      for (let s = 0, e = 0; s < coords.length - 1; s = e) {
        e = s + 1;
        while (e < coords.length - 1 && cum[e] - cum[s] < 60_000) e++;
        const part = coords.slice(s, e + 1);
        const edges = await surfaceOf(part);
        for (const e of edges) {
          if (!e.dirt) continue;
          const from = cum[Math.min(coords.length - 1, s + e.from)];
          const to = cum[Math.min(coords.length - 1, s + e.to)];
          const prev = dirt[dirt.length - 1];
          if (prev && from - prev[1] < 120) prev[1] = Math.max(prev[1], to);
          else dirt.push([from, to]);
        }
        process.stdout.write(`\r  surface ${e + 1}/${coords.length}`);
      }
      process.stdout.write("\n");
    } catch (e) {
      console.warn(`\n  surface: skipped (${e.message})`);
      dirt.length = 0;
    }
  }
  const dirtRuns = dirt.filter(([a, b]) => b - a >= 150).map(([a, b]) => [Math.round(a), Math.round(b)]);
  const dirtM = dirtRuns.reduce((s, [a, b]) => s + (b - a), 0);

  // Thin the line for the page; the turns and places keep their vertices.
  const must = [...turns.map((t) => t.idx), ...places.map((p) => p.idx)];
  let tol = 4;
  let keep = simplify(coords, tol, must);
  while (keep.length > MAX_COORDS) {
    tol *= 1.4;
    keep = simplify(coords, tol, must);
  }
  console.log(`  thinned to ${keep.length} points (tolerance ${tol.toFixed(1)} m), climb ${Math.round(climb / 0.3048)} ft, dirt ${(dirtM / MI).toFixed(1)} mi`);

  // Turns closer together than 60 m read as one; a turn at a place is the place's.
  const outTurns = [];
  for (const t of turns.sort((a, b) => a.idx - b.idx)) {
    const m = cum[t.idx];
    const prev = outTurns[outTurns.length - 1];
    if (prev && m - prev.m < 60) continue;
    outTurns.push({ name: t.name, street: t.street, lon: round(coords[t.idx][0], 6), lat: round(coords[t.idx][1], 6), m: Math.round(m) });
  }

  const cps = (checkpoints ?? []).map((c) => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < coords.length; i += 3) {
      const d = hav(c.lat, c.lon, coords[i][1], coords[i][0]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return { name: c.name, note: c.note ?? null, lon: c.lon, lat: c.lat, m: Math.round(cum[best]), off_m: Math.round(bestD) };
  });

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

  const file = {
    generated_at: new Date().toISOString(),
    name: label,
    source: "Waypoints by hand (scripts/tsp-lalv/waypoints.json), routed on foot by Valhalla over OpenStreetMap; elevation SRTM 30 m",
    length_m: Math.round(lengthM),
    climb_m: Math.round(climb),
    descent_m: Math.round(descent),
    dirt_m: Math.round(dirtM),
    bbox: [round(minLon, 5), round(minLat, 5), round(maxLon, 5), round(maxLat, 5)],
    coords: keep.map((i) => [round(coords[i][0], 5), round(coords[i][1], 5)]),
    cum_m: keep.map((i) => Math.round(cum[i])),
    turns: outTurns,
    places: places.map((p) => ({ name: p.name, note: p.note, services: p.services, lon: round(coords[p.idx][0], 6), lat: round(coords[p.idx][1], 6), m: Math.round(cum[p.idx]) })),
    checkpoints: cps,
    dirt: dirtRuns,
    profile,
  };
  mkdirSync(OUT, { recursive: true });
  const path = resolve(OUT, `${name}.json`);
  writeFileSync(path, JSON.stringify(file));
  console.log(`  wrote ${path} (${(JSON.stringify(file).length / 1024).toFixed(0)} KB): ${(lengthM / MI).toFixed(1)} mi, ${outTurns.length} turns, ${places.length} places`);
  return file;
}

const wp = JSON.parse(readFileSync(resolve(DIR, "waypoints.json"), "utf8"));
// Every route shares the road to Baker (`common`) and has its own way from there (`tail`).
for (const [id, r] of Object.entries(wp.routes)) {
  if (only && only !== id) continue;
  const pts = [...wp.common, ...r.tail];
  await build(`course-${id}`, `TSP LA → Las Vegas · ${r.name}`, pts, []);
  // The secrets course: each checkpoint dropped in after the waypoint it names.
  const withCps = [];
  for (const w of pts) {
    withCps.push(w);
    for (const c of r.checkpoints.filter((c) => c.after === w.name)) withCps.push({ ...c, name: `Checkpoint: ${c.name}`, via: true });
  }
  await build(`course-${id}-secrets`, `TSP LA → Las Vegas · ${r.name} · secrets`, withCps, r.checkpoints);
}
