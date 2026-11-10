/* THE FOOD RELAY COURSES: the Vegas Glizzy Gauntlet (five Costco food
 * courts, north to south), Ring Every Bell (the Taco Bell 100K: a one-day
 * loop of 24 Taco Bells from the Strip Cantina) and Animal Style (all 19
 * In-N-Outs; its note sits on its stop list below). Owner, 2026-11-10:
 * "Make a site like this [ggg.lmarx.com] but for running it and in Las
 * Vegas", then "I also want
 * the same thing but if we did it to all the taco bells", then "both races
 * would be relays".
 *
 *   node scripts/food-relays/build-courses.mjs
 *
 * Routes each course ON FOOT through its stops (the public OSRM foot
 * router at routing.openstreetmap.de), samples the ground height along the
 * line (Open-Meteo elevation, a 90 m model: good for the shape of the
 * day, not for a climb total), pulls the valley freeways for the chart
 * (Overpass; cached next to this script because that server is moody) and
 * writes, per course:
 *   src/app/<slug>/courseData.ts   stops, mile marks, the line, the profile
 *   public/<slug>/course.gpx       the full-resolution track for a watch
 * and once: src/components/foodrelay/vegasRoads.ts
 *
 * THE STOPS ARE FACTS WITH A DATE. Costco: costco.com warehouse pages,
 * read 2026-11-10 (the Business Center on MLK lists no food court and is
 * not on the course). Taco Bell: locations.tacobell.com store pages, same
 * day: 60 listings in Las Vegas, Henderson and North Las Vegas, 58 of
 * them walk-up restaurants (a ghost kitchen and the stadium stand are
 * not). The loop is THE TACO BELL 100K (owner, same day: "the taco bell
 * route could be the taco bell 100k"): the most bells a 65-mile budget
 * buys from the Cantina was 25 at 103.4 km (insertion and 2-opt over the
 * on-foot distance table); dropping the easternmost store, 401 N Nellis
 * Blvd, lands the loop on 100 km with 24 bells. It runs clockwise so the
 * two late openers (Cheyenne 9 AM, Bonanza 10 AM on a Saturday) come in
 * the afternoon. Re-read the store pages before race
 * week: a store opens, closes or changes its hours and this list is wrong. */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..");
const UA = { "user-agent": "food-relay-course-builder/0.1" };
const M_PER_MI = 1609.344;
const FT_PER_M = 3.28084;

const GLIZZY = {
  slug: "glizzy-gauntlet",
  title: "Vegas Glizzy Gauntlet",
  brand: "Costco",
  loop: false,
  stops: [
    { name: "Centennial", address: "6555 N Decatur Blvd", city: "Las Vegas", lat: 36.2791654, lon: -115.2099919 },
    { name: "Summerlin", address: "801 S Pavilion Center Dr", city: "Las Vegas", lat: 36.1634431, lon: -115.3329368 },
    { name: "Spring Valley", address: "6880 S Buffalo Dr", city: "Las Vegas", lat: 36.0636981, lon: -115.2579853 },
    { name: "SW Henderson", address: "3411 St Rose Pkwy", city: "Henderson", lat: 35.986998, lon: -115.1376452 },
    { name: "Henderson", address: "791 Marks St", city: "Henderson", lat: 36.0684379, lon: -115.0385492 },
  ],
};

/* opens = the Saturday opening on the store page; "24" is a 24-hour store. */
const BELLS = {
  slug: "ring-every-bell",
  title: "Ring Every Bell",
  brand: "Taco Bell",
  loop: true,
  stops: [
    { name: "The Cantina", address: "3717 S Las Vegas Blvd", city: "Las Vegas", lat: 36.10878627, lon: -115.17213997, opens: "24" },
    { name: "Flamingo", address: "4870 W Flamingo Rd", city: "Las Vegas", lat: 36.11581801, lon: -115.20724744, opens: "24" },
    { name: "West Tropicana", address: "6010 W Tropicana Ave", city: "Las Vegas", lat: 36.10044551, lon: -115.22302687, opens: "24" },
    { name: "South Rainbow", address: "5645 S Rainbow Blvd", city: "Las Vegas", lat: 36.08612558, lon: -115.24329766, opens: "8" },
    { name: "South Fort Apache", address: "4835 S Fort Apache Rd", city: "Las Vegas", lat: 36.10139076, lon: -115.29776551, opens: "8" },
    { name: "South Durango", address: "3595 S Durango Dr", city: "Las Vegas", lat: 36.12455197, lon: -115.27937298, opens: "8" },
    { name: "Fort Apache", address: "2351 S Fort Apache Rd", city: "Las Vegas", lat: 36.14635283, lon: -115.29815013, opens: "7" },
    { name: "Sahara", address: "7715 W Sahara Ave", city: "Las Vegas", lat: 36.14317721, lon: -115.25935469, opens: "8" },
    { name: "Rainbow", address: "103 S Rainbow Blvd", city: "Las Vegas", lat: 36.17256713, lon: -115.2437931, opens: "7" },
    { name: "Buffalo", address: "2025 N Buffalo Dr", city: "Las Vegas", lat: 36.19711415, lon: -115.26086037, opens: "7" },
    { name: "North Durango", address: "3260 N Durango Dr", city: "Las Vegas", lat: 36.22055257, lon: -115.27835736, opens: "8" },
    { name: "Rancho North", address: "4441 N Rancho Dr", city: "Las Vegas", lat: 36.24094393, lon: -115.23462743, opens: "7" },
    { name: "Rancho", address: "3221 N Rancho Dr", city: "Las Vegas", lat: 36.2179564, lon: -115.21345393, opens: "8" },
    { name: "West Lake Mead", address: "6200 W Lake Mead Blvd", city: "Las Vegas", lat: 36.19618355, lon: -115.2269078, opens: "8" },
    { name: "Decatur", address: "401 S Decatur Blvd", city: "Las Vegas", lat: 36.16810127, lon: -115.20555252, opens: "24" },
    { name: "Rancho South", address: "825 N Rancho Dr", city: "Las Vegas", lat: 36.17972182, lon: -115.17859928, opens: "8" },
    { name: "Lake Mead", address: "1370 W Lake Mead Blvd", city: "Las Vegas", lat: 36.19615397, lon: -115.15991449, opens: "7" },
    { name: "Cheyenne", address: "2175 E Cheyenne Ave", city: "North Las Vegas", lat: 36.21737363, lon: -115.1195903, opens: "9" },
    { name: "East Lake Mead", address: "2409 E Lake Mead Blvd", city: "North Las Vegas", lat: 36.19546776, lon: -115.11671104, opens: "8" },
    { name: "Bonanza", address: "3661 E Bonanza Rd", city: "Las Vegas", lat: 36.17312743, lon: -115.09578019, opens: "10" },
    { name: "Lamb", address: "1275 S Lamb Blvd", city: "Las Vegas", lat: 36.15756525, lon: -115.08081273, opens: "8" },
    { name: "Charleston", address: "2033 E Charleston Blvd", city: "Las Vegas", lat: 36.15926481, lon: -115.12003824, opens: "8" },
    { name: "Maryland", address: "2670 S Maryland Pkwy", city: "Las Vegas", lat: 36.14169771, lon: -115.13645843, opens: "24" },
    { name: "Twain", address: "1109 E Twain Ave", city: "Las Vegas", lat: 36.1218546, lon: -115.13938849, opens: "24" },
  ],
};

/* ANIMAL STYLE (owner, 2026-11-10: "do a version of this but for In and
 * Outs"): every In-N-Out in the valley, in one business day. The store
 * list is In-N-Out's own locator feed (locations.in-n-out.com/api/finder/
 * search, read 2026-11-10): 19 stores between Henderson and North Las
 * Vegas, all open 10:30 AM to 1:00 AM (1:30 AM Friday and Saturday
 * nights, the chain's standard). The order is the shortest on-foot line
 * through all 19 that finishes at the LINQ on the Strip (owner's pick over
 * the 3.5-mile-shorter line that ends on Craig Road), by 2-opt over the
 * on-foot distance table. `store` is In-N-Out's store number. */
const ANIMAL = {
  slug: "animal-style",
  title: "Animal Style",
  brand: "In-N-Out",
  loop: false,
  stops: [
    { name: "St. Rose", address: "3551 St Rose Pkwy", city: "Henderson", lat: 35.98619, lon: -115.14228, store: 364 },
    { name: "Eastern", address: "9240 S Eastern Ave", city: "Las Vegas", lat: 36.02139, lon: -115.11813, store: 165 },
    { name: "Sunset", address: "1051 W Sunset Rd", city: "Henderson", lat: 36.06331, lon: -115.03392, store: 150 },
    { name: "East Flamingo", address: "3804 E Flamingo Rd", city: "Las Vegas", lat: 36.11578, lon: -115.09154, store: 334 },
    { name: "Nellis", address: "51 N Nellis Blvd", city: "Las Vegas", lat: 36.16083, lon: -115.06266, store: 81 },
    { name: "Craig", address: "2765 E Craig Rd", city: "North Las Vegas", lat: 36.23968, lon: -115.11141, store: 243 },
    { name: "North 5th", address: "6880 N 5th St", city: "North Las Vegas", lat: 36.28523, lon: -115.1344, store: 234 },
    { name: "Centennial", address: "5690 Centennial Center Blvd", city: "Las Vegas", lat: 36.2652, lon: -115.25707, store: 204 },
    { name: "Lake Mead", address: "1960 Rock Springs Dr", city: "Las Vegas", lat: 36.19564, lon: -115.24654, store: 104 },
    { name: "West Sahara", address: "10040 W Sahara Ave", city: "Las Vegas", lat: 36.14482, lon: -115.31351, store: 331 },
    { name: "West Tropicana", address: "9610 W Tropicana Ave", city: "Las Vegas", lat: 36.10069, lon: -115.30211, store: 226 },
    { name: "Rainbow", address: "6530 S Rainbow Blvd", city: "Las Vegas", lat: 36.06968, lon: -115.2417, store: 352 },
    { name: "Blue Diamond", address: "3882 Blue Diamond Rd", city: "Las Vegas", lat: 36.04056, lon: -115.19118, store: 221 },
    { name: "Russell", address: "3397 W Russell Rd", city: "Las Vegas", lat: 36.08588, lon: -115.18521, store: 393 },
    { name: "Dean Martin", address: "4888 Dean Martin Dr", city: "Las Vegas", lat: 36.10132, lon: -115.18219, store: 86 },
    { name: "The Strip", address: "3747 S Las Vegas Blvd", city: "Las Vegas", lat: 36.10637, lon: -115.17248, store: 437 },
    { name: "Maryland", address: "4705 S Maryland Pkwy", city: "Las Vegas", lat: 36.10417, lon: -115.13758, store: 88 },
    { name: "Sahara", address: "2900 W Sahara Ave", city: "Las Vegas", lat: 36.14486, lon: -115.18057, store: 80 },
    { name: "The LINQ", address: "3545 S Las Vegas Blvd", city: "Las Vegas", lat: 36.11744, lon: -115.1699, store: 320 },
  ],
};

const rad = (d) => (d * Math.PI) / 180;
function hav(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(x));
}

/* Douglas-Peucker on a local flat projection, tolerance in meters. */
function simplify(line, tol) {
  if (line.length < 3) return line;
  const k = Math.cos(rad(36.15)) * 111320;
  const ky = 110540;
  const P = line.map(([lon, lat]) => [lon * k, lat * ky]);
  const keep = new Uint8Array(line.length);
  keep[0] = keep[line.length - 1] = 1;
  const stack = [[0, line.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = P[a];
    const [bx, by] = P[b];
    const dx = bx - ax;
    const dy = by - ay;
    const L = Math.hypot(dx, dy);
    let far = -1;
    let fd = tol;
    for (let i = a + 1; i < b; i++) {
      /* A loop ends where it starts: with no baseline to measure from,
       * the distance is the distance from that one point. */
      const d = L < 1e-6 ? Math.hypot(P[i][0] - ax, P[i][1] - ay) : Math.abs((P[i][0] - ax) * dy - (P[i][1] - ay) * dx) / L;
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
const r5 = (n) => Math.round(n * 1e5) / 1e5;
const r4 = (n) => Math.round(n * 1e4) / 1e4;

async function getJson(url, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(90000) });
      if (res.ok) return await res.json();
      last = new Error(`${res.status} ${url.slice(0, 80)}`);
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  throw last;
}

async function routeFoot(course) {
  const pts = course.stops.map((s) => [s.lon, s.lat]);
  if (course.loop) pts.push(pts[0]);
  const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${pts.map((p) => p.join(",")).join(";")}?overview=full&geometries=geojson&steps=false`;
  const j = await getJson(url);
  const rt = j.routes[0];
  return { line: rt.geometry.coordinates, legsM: rt.legs.map((l) => l.distance), totalM: rt.distance };
}

/* [mi, ft] every `stepMi` along the line. */
async function profile(line, totalM, stepMi = 0.2) {
  const cum = [0];
  for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + hav(line[i - 1], line[i]));
  const scale = totalM / cum[cum.length - 1];
  const n = Math.ceil(totalM / M_PER_MI / stepMi);
  const samples = [];
  let j = 0;
  for (let s = 0; s <= n; s++) {
    const target = Math.min(cum[cum.length - 1], (s * stepMi * M_PER_MI) / scale);
    while (j < cum.length - 2 && cum[j + 1] < target) j++;
    const span = cum[j + 1] - cum[j] || 1;
    const t = Math.max(0, Math.min(1, (target - cum[j]) / span));
    samples.push({
      mi: Math.min(totalM / M_PER_MI, s * stepMi),
      lon: line[j][0] + (line[j + 1][0] - line[j][0]) * t,
      lat: line[j][1] + (line[j + 1][1] - line[j][1]) * t,
    });
  }
  const out = [];
  for (let i = 0; i < samples.length; i += 100) {
    const chunk = samples.slice(i, i + 100);
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${chunk.map((c) => c.lat.toFixed(5)).join(",")}&longitude=${chunk.map((c) => c.lon.toFixed(5)).join(",")}`;
    const j2 = await getJson(url);
    chunk.forEach((c, k) => out.push([Math.round(c.mi * 100) / 100, Math.round(j2.elevation[k] * FT_PER_M)]));
  }
  return out;
}

function gpx(course, line, stops) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<gpx version="1.1" creator="food-relay-course-builder" xmlns="http://www.topografix.com/GPX/1/1">`,
    `<metadata><name>${esc(course.title)}</name><desc>Course v1, routed on foot by machine. Scout it before you trust it.</desc></metadata>`,
    ...stops.map(
      (s) =>
        `<wpt lat="${s.lat}" lon="${s.lon}"><name>${s.n}. ${esc(course.brand + " " + s.name)}</name><desc>${esc(s.address + ", " + s.city)} (mile ${s.mi.toFixed(1)})</desc></wpt>`
    ),
    `<trk><name>${esc(course.title)}</name><trkseg>`,
    ...line.map(([lon, lat]) => `<trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"/>`),
    `</trkseg></trk></gpx>`,
    ``,
  ].join("\n");
}

async function build(course) {
  const { line, legsM, totalM } = await routeFoot(course);
  let cumM = 0;
  const stops = course.stops.map((s, i) => {
    const legM = i === 0 ? 0 : legsM[i - 1];
    cumM += legM;
    return { n: i + 1, ...s, mi: Math.round((cumM / M_PER_MI) * 10) / 10, legMi: Math.round((legM / M_PER_MI) * 10) / 10 };
  });
  const closeMi = course.loop ? Math.round((legsM[legsM.length - 1] / M_PER_MI) * 10) / 10 : 0;
  const prof = await profile(line, totalM);
  const slim = simplify(line, 9).map(([lon, lat]) => [r5(lon), r5(lat)]);
  const fts = prof.map((p) => p[1]);
  const data = {
    totalMi: Math.round((totalM / M_PER_MI) * 10) / 10,
    totalKm: Math.round(totalM / 100) / 10,
    loop: course.loop,
    closeMi,
    stops,
    line: slim,
    profile: prof,
    highFt: Math.max(...fts),
    lowFt: Math.min(...fts),
    generated: new Date().toISOString().slice(0, 10),
  };
  const dir = resolve(ROOT, "src", "app", course.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    resolve(dir, "courseData.ts"),
    `/* GENERATED by scripts/food-relays/build-courses.mjs on ${data.generated}. Do not\n * edit by hand: change the stop list in that script and run it again. */\nimport type { Course } from "@/components/foodrelay/types";\n\nexport const COURSE: Course = ${JSON.stringify(data)};\n`
  );
  const pub = resolve(ROOT, "public", course.slug);
  mkdirSync(pub, { recursive: true });
  writeFileSync(resolve(pub, "course.gpx"), gpx(course, line, stops));
  console.log(
    `${course.title}: ${data.totalMi} mi, ${stops.length} stops, line ${line.length} -> ${slim.length} pts, profile ${prof.length}, ${data.lowFt}-${data.highFt} ft, start ${fts[0]} ft, finish ${fts[fts.length - 1]} ft`
  );
  console.log("  legs mi:", stops.slice(1).map((s) => s.legMi).join(", "), course.loop ? `| close ${closeMi}` : "");
  return data;
}

/* The freeways, for the chart under the route: I-15, US-95 / I-11 and the
 * 215 beltway are how anyone in the valley finds themselves on a map. */
async function roads() {
  const cache = resolve(HERE, "cache-motorways.json");
  let j;
  if (existsSync(cache)) j = JSON.parse(readFileSync(cache, "utf8"));
  else {
    const q = `[out:json][timeout:60];way["highway"="motorway"](35.90,-115.42,36.36,-114.90);out geom;`;
    for (const ep of [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
      "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    ]) {
      try {
        j = await getJson(`${ep}?data=${encodeURIComponent(q)}`, 2);
        break;
      } catch (e) {
        console.error("overpass", ep, e.message);
      }
    }
    if (!j) {
      console.error("no freeways this run; the chart draws without them");
      return null;
    }
    writeFileSync(cache, JSON.stringify(j));
  }
  const byRef = {};
  for (const w of j.elements) {
    if (!w.geometry || w.geometry.length < 2) continue;
    const ref = (w.tags?.ref || "").split(";")[0].trim() || "other";
    const line = simplify(
      w.geometry.map((g) => [g.lon, g.lat]),
      35
    ).map(([lon, lat]) => [r4(lon), r4(lat)]);
    (byRef[ref] ||= []).push(line);
  }
  /* Both carriageways are kept: at this scale the pair draws as one
   * line, and thinning them by proximity left holes in the freeways. */
  const kept = [];
  const k = Math.cos(rad(36.15)) * 111320;
  const ky = 110540;
  for (const lines of Object.values(byRef)) for (const line of lines) kept.push(line);
  /* Route shields: each hint is snapped to the nearest mapped vertex of a
   * freeway carrying one of those refs, so the badge sits on its road. */
  const hints = [
    { name: "15", refs: ["I 15"], lat: 36.02, lon: -115.18 },
    { name: "15", refs: ["I 15"], lat: 36.245, lon: -115.1 },
    { name: "95", refs: ["US 95"], lat: 36.245, lon: -115.26 },
    { name: "11", refs: ["I 11", "US 95", "US 93"], lat: 36.115, lon: -115.075 },
    { name: "215", refs: ["I 215", "CC 215"], lat: 36.06, lon: -115.21 },
    { name: "215", refs: ["CC 215", "I 215"], lat: 36.29, lon: -115.25 },
    { name: "215", refs: ["CC 215", "I 215"], lat: 36.12, lon: -115.31 },
  ];
  const shields = [];
  for (const h of hints) {
    let best = null;
    let bd = Infinity;
    for (const w of j.elements) {
      const refs = (w.tags?.ref || "").split(";").map((r) => r.trim());
      if (!w.geometry || !h.refs.some((r) => refs.includes(r))) continue;
      for (const g of w.geometry) {
        const d = Math.hypot((g.lon - h.lon) * k, (g.lat - h.lat) * ky);
        if (d < bd) {
          bd = d;
          best = g;
        }
      }
    }
    if (best && bd < 6000) shields.push({ name: h.name, lat: r4(best.lat), lon: r4(best.lon) });
    else console.error("no road found for shield", h.name, Math.round(bd));
  }
  const pts = kept.reduce((a, l) => a + l.length, 0);
  const dir = resolve(ROOT, "src", "components", "foodrelay");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    resolve(dir, "vegasRoads.ts"),
    `/* GENERATED by scripts/food-relays/build-courses.mjs. The Las Vegas valley\n * freeways (OpenStreetMap, highway=motorway), both carriageways,\n * simplified for a chart: [lon, lat][] per piece. Map data (c) OpenStreetMap\n * contributors. */\nexport const VEGAS_ROADS: [number, number][][] = ${JSON.stringify(kept)};\n\n/* A badge per freeway, sitting on its road. */\nexport const VEGAS_SHIELDS: { name: string; lat: number; lon: number }[] = ${JSON.stringify(shields)};\n`
  );
  console.log(`freeways: ${j.elements.length} ways -> ${kept.length} pieces, ${pts} pts; refs ${Object.keys(byRef).join(", ")}`);
  return kept;
}

/* `--roads` redraws only the freeways (no routing calls);
 * `--only=<slug>` rebuilds one course and leaves the others as they are. */
const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7);
if (!process.argv.includes("--roads")) {
  for (const course of [GLIZZY, BELLS, ANIMAL]) if (!only || only === course.slug) await build(course);
}
if (!only) await roads();
