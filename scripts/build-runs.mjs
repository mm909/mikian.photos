/**
 * build-runs.mjs
 * Run with: node scripts/build-runs.mjs
 *
 * Parses all GPX files, simplifies paths using Ramer-Douglas-Peucker,
 * and outputs a single compact JSON file for the client.
 */

import { readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { XMLParser } from "fast-xml-parser";

const BASE = new URL("../public/downtownkruz", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const GPX_DIR = join(BASE, "gpx");
const OUT_PATH = join(BASE, "runs.json");

// RDP tolerance in degrees (~2m at equator)
const EPSILON = 0.00002;

// --- Ramer-Douglas-Peucker simplification ---

function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd[0] - lineStart[0];
  const dy = lineEnd[1] - lineStart[1];

  if (dx === 0 && dy === 0) {
    const ex = point[0] - lineStart[0];
    const ey = point[1] - lineStart[1];
    return Math.sqrt(ex * ex + ey * ey);
  }

  const t = ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / (dx * dx + dy * dy);
  const clampedT = Math.max(0, Math.min(1, t));
  const nearX = lineStart[0] + clampedT * dx;
  const nearY = lineStart[1] + clampedT * dy;
  const ex = point[0] - nearX;
  const ey = point[1] - nearY;
  return Math.sqrt(ex * ex + ey * ey);
}

function rdpSimplify(points, epsilon) {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = rdpSimplify(points.slice(0, maxIdx + 1), epsilon);
    const right = rdpSimplify(points.slice(maxIdx), epsilon);
    return left.slice(0, -1).concat(right);
  }

  return [first, last];
}

// --- Haversine distance ---

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeDistanceKm(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
  }
  return Math.round(total * 100) / 100;
}

// --- Parse GPX ---

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => name === "trkpt",
});

const gpxFiles = (await readdir(GPX_DIR)).filter((f) => f.endsWith(".gpx")).sort();
console.log(`Found ${gpxFiles.length} GPX files\n`);

const runs = [];
let totalOriginal = 0;
let totalSimplified = 0;

for (const filename of gpxFiles) {
  const text = await readFile(join(GPX_DIR, filename), "utf8");
  const doc = parser.parse(text);
  const trk = doc?.gpx?.trk;

  if (!trk) {
    console.warn(`  SKIP (no <trk>): ${filename}`);
    continue;
  }

  const name = typeof trk.name === "string" ? trk.name : filename.replace(/\.gpx$/i, "");
  const rawPts = trk?.trkseg?.trkpt ?? [];

  // Extract [lat, lon] and time
  const points = rawPts.map((pt) => {
    const lat = parseFloat(String(pt["@_lat"]));
    const lon = parseFloat(String(pt["@_lon"]));
    return [lat, lon];
  });

  // Get start time from first point
  const firstTime = rawPts[0]?.time ? new Date(String(rawPts[0].time)).toISOString() : null;
  const lastTime = rawPts[rawPts.length - 1]?.time
    ? new Date(String(rawPts[rawPts.length - 1].time)).toISOString()
    : null;

  // Sort by time if available
  if (rawPts[0]?.time) {
    const timed = rawPts.map((pt) => ({
      lat: parseFloat(String(pt["@_lat"])),
      lon: parseFloat(String(pt["@_lon"])),
      time: new Date(String(pt.time)).getTime(),
    }));
    timed.sort((a, b) => a.time - b.time);
    points.length = 0;
    timed.forEach((p) => points.push([p.lat, p.lon]));
  }

  const simplified = rdpSimplify(points, EPSILON);
  const distKm = computeDistanceKm(points);

  // Round coordinates to 5 decimal places (~1m precision)
  const coords = simplified.map(([lat, lon]) => [
    Math.round(lat * 100000) / 100000,
    Math.round(lon * 100000) / 100000,
  ]);

  totalOriginal += points.length;
  totalSimplified += coords.length;

  const ratio = ((1 - coords.length / points.length) * 100).toFixed(0);
  console.log(
    `  ${filename}: ${points.length} → ${coords.length} pts (${ratio}% reduction), ${distKm} km`
  );

  runs.push({
    id: filename.replace(/\.gpx$/i, ""),
    name,
    startTime: firstTime,
    endTime: lastTime,
    distanceKm: distKm,
    points: coords,
  });
}

// Sort runs by startTime
runs.sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

await writeFile(OUT_PATH, JSON.stringify({ runs }));

const fileSizeKB = Math.round((await readFile(OUT_PATH)).length / 1024);
const totalRatio = ((1 - totalSimplified / totalOriginal) * 100).toFixed(0);

console.log(`\n--- Summary ---`);
console.log(`Runs: ${runs.length}`);
console.log(`Points: ${totalOriginal} → ${totalSimplified} (${totalRatio}% reduction)`);
console.log(`Output: ${OUT_PATH} (${fileSizeKB} KB)`);
