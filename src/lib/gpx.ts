export type GpxPoint = { lat: number; lng: number; ele: number };
export type GpxTrack = {
  points: GpxPoint[];
  distanceM: number;
  gainM: number;
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
};

export type DistanceKey = "5k" | "10k" | "half";

export const DISTANCE_LABELS: Record<DistanceKey, string> = {
  "5k": "5K",
  "10k": "10K",
  half: "Half",
};

export const DISTANCE_METERS: Record<DistanceKey, number> = {
  "5k": 5000,
  "10k": 10000,
  half: 21097,
};

// Lions Lighthouse, Long Beach — start/finish for the Lighthouse races.
const LIGHTHOUSE_FINISH: [number, number] = [33.7593, -118.1903];

const R_EARTH = 6371000;
function haversineM(a: [number, number], b: [number, number]) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(x));
}

export function parseGpx(xml: string): GpxTrack | null {
  if (typeof DOMParser === "undefined") return null;
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  // GPX has a default xmlns, so querySelector("trkpt") returns nothing in XML mode.
  // getElementsByTagName works regardless of namespace.
  const trkpts = Array.from(doc.getElementsByTagName("trkpt"));
  if (trkpts.length === 0) return null;
  const points: GpxPoint[] = trkpts.map((el) => {
    const eleEl = el.getElementsByTagName("ele")[0];
    return {
      lat: parseFloat(el.getAttribute("lat") || "0"),
      lng: parseFloat(el.getAttribute("lon") || "0"),
      ele: parseFloat(eleEl?.textContent || "0"),
    };
  });
  return summarize(points);
}

function summarize(points: GpxPoint[]): GpxTrack {
  let distanceM = 0;
  let gainM = 0;
  let minLat = Infinity,
    maxLat = -Infinity,
    minLng = Infinity,
    maxLng = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
    if (i > 0) {
      distanceM += haversineM([points[i - 1].lat, points[i - 1].lng], [p.lat, p.lng]);
      const dEle = p.ele - points[i - 1].ele;
      if (dEle > 0) gainM += dEle;
    }
  }
  return { points, distanceM, gainM, bbox: { minLat, maxLat, minLng, maxLng } };
}

/* ----------------------------------------------------------------
   Synthesized fallback — used until the user attaches real .gpx
   ---------------------------------------------------------------- */
export function synthesizeGpx(distance: DistanceKey): GpxTrack {
  const meters = DISTANCE_METERS[distance];
  const finish = LIGHTHOUSE_FINISH;

  // Pick a start point so straight-line distance roughly matches the race.
  // Real distances are not straight lines but this gives a believable scale.
  const startMap: Record<DistanceKey, [number, number]> = {
    "5k": [finish[0] + 0.018, finish[1] - 0.034],
    "10k": [finish[0] + 0.022, finish[1] - 0.062],
    half: [finish[0] + 0.06, finish[1] - 0.16],
  };
  const start = startMap[distance];

  const N = 240;
  const pts: GpxPoint[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    // Base linear interpolation
    const lat = start[0] + (finish[0] - start[0]) * t;
    const lng = start[1] + (finish[1] - start[1]) * t;
    // Perpendicular wiggle for shape
    const dx = finish[1] - start[1];
    const dy = finish[0] - start[0];
    const norm = Math.hypot(dx, dy) || 1;
    const px = -dy / norm;
    const py = dx / norm;
    const amp = 0.012 * (distance === "5k" ? 0.6 : distance === "10k" ? 0.8 : 1);
    const wig = Math.sin(t * Math.PI * (distance === "5k" ? 4 : 3)) * amp;
    // Elevation profile fallback — gentle rolling
    let ele = 30 + Math.sin(t * Math.PI * 2.5) * 12;
    if (distance === "half" && t > 0.4 && t < 0.65) ele += 22 * Math.sin(((t - 0.4) / 0.25) * Math.PI);
    pts.push({ lat: lat + px * wig, lng: lng + py * wig, ele });
  }

  const tr = summarize(pts);
  // Scale points along the route so summed haversine matches target distance
  const scale = meters / Math.max(tr.distanceM, 1);
  if (Math.abs(scale - 1) > 0.05) {
    for (let i = 1; i < pts.length; i++) {
      pts[i].lat = pts[0].lat + (pts[i].lat - pts[0].lat) * scale;
      pts[i].lng = pts[0].lng + (pts[i].lng - pts[0].lng) * scale;
    }
    return summarize(pts);
  }
  return tr;
}

export async function loadGpx(distance: DistanceKey): Promise<GpxTrack> {
  try {
    // 'default' lets the browser revalidate; 'force-cache' would serve stale on re-deploys.
    const res = await fetch(`/gpx/${distance}.gpx`, { cache: "default" });
    if (res.ok) {
      const txt = await res.text();
      const parsed = parseGpx(txt);
      if (parsed) return parsed;
    }
  } catch {
    /* fall through to synth */
  }
  return synthesizeGpx(distance);
}

/* ----------------------------------------------------------------
   SVG projection helpers
   ---------------------------------------------------------------- */
export function projectToSvg(
  track: GpxTrack,
  w: number,
  h: number,
  pad = 8
): { x: number; y: number }[] {
  const { minLat, maxLat, minLng, maxLng } = track.bbox;
  const latSpan = Math.max(maxLat - minLat, 1e-9);
  const lngSpan = Math.max(maxLng - minLng, 1e-9);
  // Aspect-correct: account for the lat-dependent meters-per-degree-lng
  const midLat = (minLat + maxLat) / 2;
  const mPerLat = 111_000;
  const mPerLng = 111_000 * Math.cos((midLat * Math.PI) / 180);
  const heightM = latSpan * mPerLat;
  const widthM = lngSpan * mPerLng;
  const scale = Math.min((w - pad * 2) / widthM, (h - pad * 2) / heightM);
  const offsetX = (w - widthM * scale) / 2;
  const offsetY = (h - heightM * scale) / 2;
  return track.points.map((p) => ({
    x: offsetX + (p.lng - minLng) * mPerLng * scale,
    y: offsetY + (maxLat - p.lat) * mPerLat * scale,
  }));
}

export function elevationSeries(
  track: GpxTrack
): { distM: number[]; ele: number[]; min: number; max: number } {
  const distM: number[] = [0];
  const ele: number[] = [track.points[0]?.ele ?? 0];
  let min = ele[0];
  let max = ele[0];
  for (let i = 1; i < track.points.length; i++) {
    const p = track.points[i];
    const prev = track.points[i - 1];
    distM.push(distM[i - 1] + haversineM([prev.lat, prev.lng], [p.lat, p.lng]));
    ele.push(p.ele);
    if (p.ele < min) min = p.ele;
    if (p.ele > max) max = p.ele;
  }
  return { distM, ele, min, max };
}
