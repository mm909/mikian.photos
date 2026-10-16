/**
 * The LASD26 course from No Shortcuts' Google My Maps KML (owner,
 * 2026-10-16: "I've attached a google maps with the route, embed this route
 * into the site"). The map is the race's OFFICIAL DIRECTIONS; its KML export
 * is the source of truth for the course and the turn list.
 *
 *   NODE_OPTIONS=--dns-result-order=ipv4first npx tsx scripts/lasd26-route-from-kml.ts [path/to/map.kml] [--gpx]
 *
 * (ipv4first because this machine's IPv6 is broken and the drive is routed
 * over the network, below.)
 *
 * Reads the KML's folders:
 *   "Official Directions"   turn-by-turn POINTs, START: Santa Monica Pier …
 *                           FINISH: Milestone Running Shop PB (+ the hotel,
 *                           which sits off the course and is dropped)
 *   "Elevation"             232 LINE placemarks "Segment NNN - … to …" that
 *                           together ARE the course, in name order; their
 *                           descriptions carry the smoothed start/end
 *                           elevation in feet
 * The "Bathrooms every 12mi" and "Half mile checkpoints" folders are left
 * alone (owner, 2026-10-16: "Remove the bathroom stops, and bathroom
 * count"; the checkpoint count only fed the credit line he also removed).
 *
 * and writes
 *   public/lasd26/route/course.json   the course for /lasd26/route (the map,
 *                                     the turn list, the profile)
 *   events/lasd26.gpx                 ONLY with --gpx: the course for the
 *                                     tracker (GPX 1.1, one trk/trkseg, ele
 *                                     in metres). The tracker is paused, so
 *                                     a plain run never touches it.
 *
 * THE DRIVE. The course is not one continuous run: at San Mateo Point
 * everyone, the runner included, gets in the van and drives I-5 through
 * Camp Pendleton to a Chevron in Oceanside, where the runner starts again
 * (the "Drive on 5" direction). The Elevation segments stop at the pickup
 * and resume at the restart, so joining them in order leaves a straight
 * jump of ~17 miles. The organizer's half-mile checkpoints do NOT count
 * it (Checkpoint 162 is before the pickup, 164 right after the restart),
 * so here:
 *   - course.json's cum_m / miles are RUN metres — the drive adds nothing,
 *     and the mile numbers match the organizer's labels and checkpoints;
 *     `drives` lists the jump so the map draws it dashed;
 *   - the drive is ROUTED BY CAR (owner, 2026-10-16: "See if we can make
 *     the dotted line follow the route we are driving instead of cutting
 *     straight to the point"): BRouter's public API first, the way
 *     src/lib/routing.ts asks it (car-fast, one request, geojson), then
 *     OSRM's public demo, and when neither answers the line stays straight
 *     and the report says so. The road goes in `drives[].coords` as
 *     [lon, lat] pairs with `routed_by` and the road length `road_m`;
 *   - the GPX has to be one continuous line for the tracker's route index,
 *     so the drive is in it as a straight jump between two consecutive
 *     points, and GPX miles after San Mateo Point run ~17.5 ahead of the
 *     official ones. events/lasd26.yaml places checkpoints by GPX mile.
 *
 * No dependencies beyond the tracker's own route index (parseGpx-style
 * regex walking of the XML, haversine, snapToRoute) and global fetch.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildRouteIndex, densify, haversineM, snapToRoute } from "../src/lib/tracker/routeIndex";

const DEFAULT_KML =
  "C:/Users/Mikia/AppData/Local/Temp/claude/C--Users-Mikia-Documents-GitHub-mikian-photos/6193a292-d963-4a5c-bf75-970c1eac8e98/scratchpad/lasd26-map.kml";
const ROOT = resolve(__dirname, "..");
const GPX_OUT = resolve(ROOT, "events/lasd26.gpx");
const JSON_OUT = resolve(ROOT, "public/lasd26/route/course.json");

const MI = 1609.344;
const FT = 0.3048;
/** A joint between two segments farther apart than this is a drive, not a run. */
const GAP_M = 1000;
/** A direction point farther off the line than this is not on the course (the hotel). */
const OFF_COURSE_M = 1500;
/** course.json keeps at most this many coordinates. */
const MAX_COORDS = 3000;
/** One routing request may take this long before the next service is tried. */
const ROUTE_TIMEOUT_MS = 30_000;
const USER_AGENT = "mikian.photos lasd26-route-from-kml (https://mikianmusser.com)";

/* ─── The drive, by car ───────────────────────────────────────────────────── */

type LonLatPair = [number, number];
type RoutedDrive = { coords: LonLatPair[]; routed_by: "brouter" | "osrm"; road_m: number };

function polylineM(coords: LonLatPair[]): number {
  let d = 0;
  for (let i = 1; i < coords.length; i++) d += haversineM(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  return d;
}

/** The [lon, lat] pairs of a GeoJSON coordinate list, rounded, or null when it is not one. */
function pairsOf(raw: unknown): LonLatPair[] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const out: LonLatPair[] = [];
  for (const c of raw) {
    if (!Array.isArray(c) || typeof c[0] !== "number" || typeof c[1] !== "number") return null;
    out.push([round(c[0], 5), round(c[1], 5)]);
  }
  return out;
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(ROUTE_TIMEOUT_MS),
    headers: { accept: "application/json", "user-agent": USER_AGENT },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** BRouter, exactly as src/lib/routing.ts asks it, with the car profile. */
async function routeBrouter(from: LonLatPair, to: LonLatPair): Promise<LonLatPair[] | null> {
  const lonlats = `${from[0]},${from[1]}|${to[0]},${to[1]}`;
  const url = `https://brouter.de/brouter?lonlats=${encodeURIComponent(lonlats)}&profile=car-fast&alternativeidx=0&format=geojson`;
  const gj = (await getJson(url)) as { features?: { geometry?: { coordinates?: unknown } }[] };
  return pairsOf(gj?.features?.[0]?.geometry?.coordinates);
}

/** OSRM's public demo server — the second try. */
async function routeOsrm(from: LonLatPair, to: LonLatPair): Promise<LonLatPair[] | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson`;
  const r = (await getJson(url)) as { code?: string; routes?: { geometry?: { coordinates?: unknown } }[] };
  if (r?.code && r.code !== "Ok") throw new Error(`OSRM ${r.code}`);
  return pairsOf(r?.routes?.[0]?.geometry?.coordinates);
}

/**
 * Route the drive by car: BRouter, then OSRM, then nobody. Each failure is
 * printed so the report says which service answered; null means the map
 * keeps the straight line.
 */
async function routeDrive(from: LonLatPair, to: LonLatPair): Promise<RoutedDrive | null> {
  const tries: [RoutedDrive["routed_by"], (a: LonLatPair, b: LonLatPair) => Promise<LonLatPair[] | null>][] = [
    ["brouter", routeBrouter],
    ["osrm", routeOsrm],
  ];
  for (const [name, fn] of tries) {
    try {
      const coords = await fn(from, to);
      if (coords) return { coords, routed_by: name, road_m: Math.round(polylineM(coords)) };
      console.warn(`drive: ${name} answered without a line`);
    } catch (e) {
      console.warn(`drive: ${name} failed — ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return null;
}

/* ─── XML walking ─────────────────────────────────────────────────────────── */

/** CDATA off, <br> to newlines, other tags out, entities decoded, trimmed. */
function decode(s: string): string {
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(s);
  let t = cdata ? cdata[1] : s;
  t = t.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
  t = t
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
  return t.trim();
}

function tagText(xml: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml);
  return m ? decode(m[1]) : null;
}

type LonLat = { lon: number; lat: number };

function coordsOf(xml: string): LonLat[] {
  const m = /<coordinates>([\s\S]*?)<\/coordinates>/.exec(xml);
  if (!m) return [];
  const out: LonLat[] = [];
  for (const tok of m[1].trim().split(/\s+/)) {
    const [lon, lat] = tok.split(",").map(Number);
    if (Number.isFinite(lon) && Number.isFinite(lat)) out.push({ lon, lat });
  }
  return out;
}

type Placemark = { name: string; description: string | null; coords: LonLat[]; isLine: boolean };

function placemarksOf(folderXml: string): Placemark[] {
  const out: Placemark[] = [];
  const re = /<Placemark>([\s\S]*?)<\/Placemark>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(folderXml))) {
    const body = m[1];
    out.push({
      name: tagText(body, "name") ?? "",
      description: tagText(body, "description"),
      coords: coordsOf(body),
      isLine: /<LineString>/.test(body),
    });
  }
  return out;
}

function folders(kml: string): Map<string, Placemark[]> {
  const out = new Map<string, Placemark[]>();
  const re = /<Folder>\s*<name>([^<]*)<\/name>([\s\S]*?)<\/Folder>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(kml))) out.set(decode(m[1]), placemarksOf(m[2]));
  return out;
}

function need(f: Map<string, Placemark[]>, name: string): Placemark[] {
  const p = f.get(name);
  if (!p) throw new Error(`KML: no folder "${name}" (have: ${Array.from(f.keys()).join(", ")})`);
  return p;
}

/* ─── The line ────────────────────────────────────────────────────────────── */

type Segment = {
  n: number;
  name: string;
  coords: LonLat[];
  eleStartM: number;
  eleEndM: number;
  netM: number;
  /** Run metres at the segment's first point, set while the line is built. */
  startRunM: number;
};

function segmentsOf(pms: Placemark[]): Segment[] {
  const segs: Segment[] = [];
  for (const p of pms) {
    const m = /^Segment (\d+) - (.*)$/.exec(p.name);
    if (!m || !p.isLine || p.coords.length < 2) continue;
    const ele = /elevation:\s*(-?[\d.]+)\s*ft to (-?[\d.]+)\s*ft/.exec(p.description ?? "");
    const net = /net gain\/loss:\s*([+-]?[\d.]+)\s*ft/.exec(p.description ?? "");
    segs.push({
      n: Number(m[1]),
      name: p.name,
      coords: p.coords,
      eleStartM: ele ? Number(ele[1]) * FT : 0,
      eleEndM: ele ? Number(ele[2]) * FT : 0,
      netM: net ? Number(net[1]) * FT : 0,
      startRunM: 0,
    });
  }
  segs.sort((a, b) => a.n - b.n);
  for (let i = 1; i < segs.length; i++) {
    if (segs[i].n !== segs[i - 1].n + 1) console.warn(`warning: segment numbering jumps ${segs[i - 1].n} → ${segs[i].n}`);
  }
  return segs;
}

type Pt = { lat: number; lon: number; ele: number; runM: number; gpxM: number };
type Gap = { idx: number; straightM: number };

/**
 * Concatenate the segments in order, dropping duplicate joints, with the
 * elevation interpolated per segment from its start/end figures. A joint
 * wider than GAP_M is a drive: it counts in the GPX measure, not the run.
 */
function buildLine(segs: Segment[]): { pts: Pt[]; gaps: Gap[] } {
  const pts: Pt[] = [];
  const gaps: Gap[] = [];
  let runM = 0;
  let gpxM = 0;
  for (const seg of segs) {
    let segLen = 0;
    for (let i = 1; i < seg.coords.length; i++) {
      segLen += haversineM(seg.coords[i - 1].lat, seg.coords[i - 1].lon, seg.coords[i].lat, seg.coords[i].lon);
    }
    let along = 0;
    for (let i = 0; i < seg.coords.length; i++) {
      const c = seg.coords[i];
      if (i > 0) along += haversineM(seg.coords[i - 1].lat, seg.coords[i - 1].lon, c.lat, c.lon);
      const ele = seg.eleStartM + (seg.eleEndM - seg.eleStartM) * (segLen > 0 ? along / segLen : 0);
      const last = pts[pts.length - 1];
      if (last) {
        const d = haversineM(last.lat, last.lon, c.lat, c.lon);
        if (d < 0.5) {
          if (i === 0) seg.startRunM = last.runM;
          continue;
        }
        if (i === 0 && d > GAP_M) {
          gaps.push({ idx: pts.length - 1, straightM: d });
          gpxM += d;
        } else {
          runM += d;
          gpxM += d;
        }
      }
      pts.push({ lat: c.lat, lon: c.lon, ele, runM, gpxM });
      if (i === 0) seg.startRunM = runM;
    }
  }
  return { pts, gaps };
}

/* ─── Decimation (Douglas–Peucker per leg, tightened until it fits) ───────── */

function perpDistM(p: Pt, a: Pt, b: Pt): number {
  const kx = Math.cos((a.lat * Math.PI) / 180) * 111320;
  const ky = 110540;
  const ax = 0;
  const ay = 0;
  const bx = (b.lon - a.lon) * kx;
  const by = (b.lat - a.lat) * ky;
  const px = (p.lon - a.lon) * kx;
  const py = (p.lat - a.lat) * ky;
  const len2 = bx * bx + by * by;
  if (len2 === 0) return Math.hypot(px, py);
  let t = ((px - ax) * bx + (py - ay) * by) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + bx * t), py - (ay + by * t));
}

function douglasPeucker(pts: Pt[], from: number, to: number, tol: number, keep: Set<number>) {
  const stack: [number, number][] = [[from, to]];
  keep.add(from);
  keep.add(to);
  while (stack.length) {
    const [s, e] = stack.pop()!;
    if (e - s < 2) continue;
    let best = -1;
    let bestD = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDistM(pts[i], pts[s], pts[e]);
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

/** Indices to keep: every leg simplified at the same tolerance, gap ends always kept. */
function decimate(pts: Pt[], gaps: Gap[], max: number): number[] {
  if (pts.length <= max) return pts.map((_, i) => i);
  const legs: [number, number][] = [];
  let start = 0;
  for (const g of gaps) {
    legs.push([start, g.idx]);
    start = g.idx + 1;
  }
  legs.push([start, pts.length - 1]);
  let tol = 1;
  for (;;) {
    const keep = new Set<number>();
    for (const [s, e] of legs) douglasPeucker(pts, s, e, tol, keep);
    if (keep.size <= max) return Array.from(keep).sort((a, b) => a - b);
    tol *= 1.5;
  }
}

/* ─── Main ────────────────────────────────────────────────────────────────── */

function round(n: number, places: number): number {
  const k = 10 ** places;
  return Math.round(n * k) / k;
}

function xmlEsc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function main() {
  const args = process.argv.slice(2);
  // --gpx is opt-in: the tracker is paused and events/lasd26.gpx stays as it is otherwise.
  const writeGpx = args.includes("--gpx");
  const kmlPath = resolve(args.find((a) => !a.startsWith("--")) ?? DEFAULT_KML);
  const kml = readFileSync(kmlPath, "utf8");
  const f = folders(kml);
  const directions = need(f, "Official Directions").filter((p) => !p.isLine && p.coords.length === 1);
  const segs = segmentsOf(need(f, "Elevation"));
  if (segs.length === 0) throw new Error("KML: no Segment NNN lines in the Elevation folder");

  const { pts, gaps } = buildLine(segs);
  const last = pts[pts.length - 1];
  const runM = last.runM;
  const gpxM = last.gpxM;
  const climbM = segs.reduce((s, x) => s + Math.max(0, x.netM), 0);
  const descentM = segs.reduce((s, x) => s + Math.max(0, -x.netM), 0);

  /* The tracker's own index over the GPX line (the straight drive included),
   * so the turns and bathrooms snap exactly as the tracker would snap a
   * runner, then back to run metres for the page. */
  const index = buildRouteIndex(densify(pts.map((p) => ({ lat: p.lat, lon: p.lon, ele: p.ele }))));
  const gpxToRun = (m: number): number => {
    let out = m;
    for (const g of gaps) {
      const startM = pts[g.idx].gpxM;
      if (m > startM) out -= Math.min(m - startM, g.straightM);
    }
    return out;
  };
  const snap = (lat: number, lon: number) => {
    const s = snapToRoute(index, lat, lon, null);
    return { runM: gpxToRun(s.routeM), gpxM: s.routeM, offM: s.offRouteM };
  };

  /* Turns: the Official Directions in file order. A pin far off the line
   * (the hotel after the finish) is not a call; it is only named in the
   * report (owner, 2026-10-16: "Remove after the finish copy"). */
  type Turn = { name: string; kind: string; lat: number; lon: number; mile: number; gpx_mile: number; off_m: number; note: string | null };
  const turns: Turn[] = [];
  const offCourse: string[] = [];
  for (const p of directions) {
    const { lat, lon } = p.coords[0];
    const s = snap(lat, lon);
    const name = p.name.replace(/\s+/g, " ").trim();
    if (!name) continue;
    if (s.offM > OFF_COURSE_M) {
      offCourse.push(name);
      continue;
    }
    const kind = /^START\b/i.test(name)
      ? "start"
      : /^FINISH\b/i.test(name)
        ? "finish"
        : /^Drive\b/i.test(name)
          ? "drive"
          : /starts again/i.test(name)
            ? "restart"
            : "turn";
    turns.push({
      name: name.replace(/^(START|FINISH):\s*/i, (_, w: string) => `${w.toUpperCase()}: `),
      kind,
      lat,
      lon,
      mile: round(s.runM / MI, 1),
      gpx_mile: round(s.gpxM / MI, 1),
      off_m: Math.round(s.offM),
      note: p.description || null,
    });
  }

  /* The map line. */
  const keep = decimate(pts, gaps, MAX_COORDS);
  const keptPos = new Map<number, number>();
  keep.forEach((i, k) => keptPos.set(i, k));
  const coords = keep.map((i) => [round(pts[i].lon, 5), round(pts[i].lat, 5)] as [number, number]);
  const cum_m = keep.map((i) => Math.round(pts[i].runM));

  /* The drive, by car (one request per gap; there is one gap). */
  type Drive = {
    at: number;
    mile: number;
    straight_m: number;
    road_m: number | null;
    from: LonLatPair;
    to: LonLatPair;
    coords: LonLatPair[] | null;
    routed_by: RoutedDrive["routed_by"] | null;
    note: string;
  };
  const drives: Drive[] = [];
  for (const g of gaps) {
    const a = pts[g.idx];
    const b = pts[g.idx + 1];
    const from: LonLatPair = [round(a.lon, 5), round(a.lat, 5)];
    const to: LonLatPair = [round(b.lon, 5), round(b.lat, 5)];
    const routed = await routeDrive(from, to);
    drives.push({
      at: keptPos.get(g.idx) ?? -1,
      mile: round(a.runM / MI, 1),
      straight_m: Math.round(g.straightM),
      road_m: routed ? routed.road_m : null,
      from,
      to,
      coords: routed ? routed.coords : null,
      routed_by: routed ? routed.routed_by : null,
      note: "Everyone rides — the runner too — through Camp Pendleton on I-5; the miles in the van do not count.",
    });
  }
  let minLat = Infinity;
  let minLon = Infinity;
  let maxLat = -Infinity;
  let maxLon = -Infinity;
  for (const p of pts) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  const profile: [number, number][] = segs.map((s) => [Math.round(s.startRunM), round(s.eleStartM, 1)]);
  profile.push([Math.round(runM), round(segs[segs.length - 1].eleEndM, 1)]);

  const course = {
    generated_at: new Date().toISOString(),
    source: "No Shortcuts LA -> SD Course (Google My Maps, mid 1vsgSOGVJdwgvlBo3dPvUKCsPG6CL998)",
    /** Run metres: the drive through Camp Pendleton counts for nothing. */
    length_m: Math.round(runM),
    /** The GPX line's length — the run plus the straight-line drive. */
    gpx_length_m: Math.round(gpxM),
    climb_m: Math.round(climbM),
    descent_m: Math.round(descentM),
    bbox: [round(minLon, 5), round(minLat, 5), round(maxLon, 5), round(maxLat, 5)] as [number, number, number, number],
    coords,
    cum_m,
    drives,
    turns,
    profile,
  };
  mkdirSync(dirname(JSON_OUT), { recursive: true });
  writeFileSync(JSON_OUT, JSON.stringify(course));

  /* The report. */
  console.log(`KML: ${kmlPath}`);
  console.log(`segments: ${segs.length} · points: ${pts.length} (kept ${coords.length})`);
  console.log(`RUN length: ${(runM / MI).toFixed(2)} mi (${(runM / 1000).toFixed(1)} km) · climb +${Math.round(climbM / FT)} ft · descent -${Math.round(descentM / FT)} ft`);
  console.log(`GPX length: ${(gpxM / MI).toFixed(2)} mi — the drive adds ${gaps.map((g) => (g.straightM / MI).toFixed(2)).join(" + ")} mi straight`);
  for (const d of drives) {
    const how = d.coords ? `routed by ${d.routed_by}: ${d.coords.length} coords, ${((d.road_m ?? 0) / MI).toFixed(1)} mi by road` : "NOT routed — straight line kept";
    console.log(`drive at run mile ${d.mile}: ${d.from.join(",")} → ${d.to.join(",")} (${(d.straight_m / MI).toFixed(1)} mi straight) · ${how}`);
  }
  console.log(`turns: ${turns.length} · off the course (dropped): ${offCourse.join(", ") || "—"}`);
  console.log("");
  console.log("run mi | gpx mi | off m | direction");
  for (const t of turns) console.log(`${t.mile.toFixed(1).padStart(6)} | ${t.gpx_mile.toFixed(1).padStart(6)} | ${String(t.off_m).padStart(5)} | ${t.kind === "turn" ? "" : `[${t.kind}] `}${t.name}${t.note ? ` — ${t.note}` : ""}`);
  console.log("");
  console.log(`wrote ${JSON_OUT}`);
  if (!writeGpx) {
    console.log(`GPX not written (pass --gpx to write ${GPX_OUT})`);
    return;
  }

  /* The GPX — opt-in. */
  const started = turns.find((t) => t.kind === "start");
  const finished = turns.find((t) => t.kind === "finish");
  const wpts: string[] = [];
  const wpt = (lat: number, lon: number, name: string, desc: string) =>
    wpts.push(`  <wpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"><name>${xmlEsc(name)}</name><desc>${xmlEsc(desc)}</desc></wpt>`);
  wpt(pts[0].lat, pts[0].lon, started ? started.name : "Start", "mile 0");
  for (const g of gaps) {
    const a = pts[g.idx];
    const b = pts[g.idx + 1];
    wpt(a.lat, a.lon, "Into the van (San Mateo Point)", `run mile ${(a.runM / MI).toFixed(1)} — everyone drives I-5 through Camp Pendleton`);
    wpt(b.lat, b.lon, "Runner restarts (Oceanside Chevron)", `run mile ${(b.runM / MI).toFixed(1)} · GPX mile ${(b.gpxM / MI).toFixed(1)}`);
  }
  wpt(last.lat, last.lon, finished ? finished.name : "Finish", `run mile ${(runM / MI).toFixed(1)} · GPX mile ${(gpxM / MI).toFixed(1)}`);
  const gpxName = "LASD26 official course (No Shortcuts directions)";
  const gpxDesc =
    `Santa Monica Pier to Pacific Beach from the organizer's Google My Maps (${segs.length} elevation segments joined in order). ` +
    `Run length ${(runM / MI).toFixed(1)} mi; this line is ${(gpxM / MI).toFixed(1)} mi because the drive through Camp Pendleton ` +
    `(San Mateo Point to the Oceanside Chevron, ${gaps.map((g) => (g.straightM / MI).toFixed(1)).join("+")} mi straight) is in it as a straight jump ` +
    `so the tracker's route index stays continuous. Elevation is the segments' smoothed start/end figures, interpolated.`;
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="mikian.photos lasd26-route-from-kml" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
    "  <metadata>",
    `    <name>${xmlEsc(gpxName)}</name>`,
    `    <desc>${xmlEsc(gpxDesc)}</desc>`,
    `    <time>${course.generated_at}</time>`,
    "  </metadata>",
    ...wpts,
    "  <trk>",
    `    <name>${xmlEsc(gpxName)}</name>`,
    "    <trkseg>",
  ];
  for (const p of pts) lines.push(`      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><ele>${p.ele.toFixed(1)}</ele></trkpt>`);
  lines.push("    </trkseg>", "  </trk>", "</gpx>", "");
  writeFileSync(GPX_OUT, lines.join("\n"));
  console.log(`wrote ${GPX_OUT}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
