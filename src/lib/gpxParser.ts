import { XMLParser } from "fast-xml-parser";
import type { Run, TrackPoint } from "./types";

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
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

function computeDistance(points: TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(
      points[i - 1].lat,
      points[i - 1].lon,
      points[i].lat,
      points[i].lon
    );
  }
  return total;
}

export function parseGpxText(text: string, filename: string): Run {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) => name === "trkpt",
  });
  const doc = parser.parse(text);

  const trk = doc?.gpx?.trk;
  if (!trk) throw new Error(`No <trk> element found in ${filename}`);

  const trackName: string =
    typeof trk.name === "string" ? trk.name : filename.replace(/\.gpx$/i, "");

  const rawPts = trk?.trkseg?.trkpt ?? [];
  const pts: TrackPoint[] = rawPts.map(
    (pt: Record<string, unknown>) => {
      const lat = parseFloat(String(pt["@_lat"]));
      const lon = parseFloat(String(pt["@_lon"]));
      const ele = parseFloat(String(pt.ele ?? "0")) || 0;
      const timeUtc = new Date(String(pt.time));
      return { lat, lon, ele, timeUtc, timeMs: timeUtc.getTime() };
    }
  );

  pts.sort((a, b) => a.timeMs - b.timeMs);

  const id = filename.replace(/\.gpx$/i, "");

  return {
    id,
    filename,
    name: trackName,
    points: pts,
    startTime: pts[0].timeUtc,
    endTime: pts[pts.length - 1].timeUtc,
    totalDistanceKm: computeDistance(pts),
  };
}

export async function readGpxFile(file: File): Promise<Run> {
  const text = await file.text();
  return parseGpxText(text, file.name);
}
