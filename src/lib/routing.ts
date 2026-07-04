import "server-only";

/**
 * Foot routing for the relay planned route (TSP France).
 *
 * Uses BRouter's free public web API (brouter.de) — no API key, has walking/
 * hiking profiles, returns GeoJSON. We route on foot ("hiking-mountain") so the
 * planned line follows paths/roads a runner would take, not motorways. For a
 * long crossing BRouter can be slow or refuse, and "a best guess even if
 * suboptimal is fine" (owner) — so any failure falls back to a straight-line
 * interpolation between the given waypoints. Server-only (no browser CORS/CSP).
 */

export type RoutedPath = {
  /** [lat, lng, ele] triples. */
  points: [number, number, number][];
  distanceM: number;
  gainM: number;
  source: "brouter" | "straight";
};

const R_EARTH = 6371000;
function havM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(x));
}

function polyDistance(points: [number, number, number][]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    d += havM(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
  }
  return d;
}

/** Interpolate a line through the waypoints (~1 point / km) — the fallback. */
function straightLine(waypoints: [number, number][]): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const [aLat, aLng] = waypoints[i];
    const [bLat, bLng] = waypoints[i + 1];
    const legM = havM(aLat, aLng, bLat, bLng);
    const steps = Math.max(8, Math.min(600, Math.round(legM / 1000)));
    for (let j = 0; j <= steps; j++) {
      if (i > 0 && j === 0) continue; // don't duplicate the shared vertex
      const t = j / steps;
      pts.push([aLat + (bLat - aLat) * t, aLng + (bLng - aLng) * t, 0]);
    }
  }
  return pts;
}

/**
 * Route on foot through `waypoints` ([lat,lng][], ≥2). Tries BRouter (the
 * requested alternative index, 0-3 — BRouter's built-in route variants), falls
 * back to a straight-line interpolation. Never throws.
 */
export async function routeFoot(
  waypoints: [number, number][],
  alternativeIdx = 0
): Promise<RoutedPath> {
  if (waypoints.length >= 2) {
    try {
      // BRouter wants lon,lat pairs joined by '|'.
      const lonlats = waypoints.map(([lat, lng]) => `${lng},${lat}`).join("|");
      const url =
        `https://brouter.de/brouter?lonlats=${encodeURIComponent(lonlats)}` +
        `&profile=hiking-mountain&alternativeidx=${Math.min(3, Math.max(0, alternativeIdx))}&format=geojson`;
      const res = await fetch(url, {
        // A long crossing can take a while; cap it and fall back rather than hang.
        signal: AbortSignal.timeout(20000),
        headers: { accept: "application/json" },
      });
      if (res.ok) {
        const gj = (await res.json()) as {
          features?: { geometry?: { coordinates?: number[][] } }[];
        };
        const coords = gj?.features?.[0]?.geometry?.coordinates;
        if (Array.isArray(coords) && coords.length > 1) {
          // BRouter geojson coords are [lon, lat, ele?].
          const points: [number, number, number][] = coords.map((c) => [
            c[1],
            c[0],
            typeof c[2] === "number" ? c[2] : 0,
          ]);
          let gain = 0;
          for (let i = 1; i < points.length; i++) {
            const de = points[i][2] - points[i - 1][2];
            if (de > 0) gain += de;
          }
          return { points, distanceM: polyDistance(points), gainM: gain, source: "brouter" };
        }
      }
    } catch {
      /* fall through to straight line */
    }
  }
  const points = straightLine(waypoints);
  return { points, distanceM: polyDistance(points), gainM: 0, source: "straight" };
}

export type RouteCandidate = RoutedPath & { alt: number };

/**
 * Up to 3 distinct foot-route candidates between two points (BRouter
 * alternative indexes 0–2, fetched in parallel), deduped by geometry (BRouter
 * often returns the same line for several indexes) and sorted with a
 * RECOMMENDED first: lowest (distance + gain×8) — mild climb penalty, so a
 * slightly longer flat road beats a shorter mountain wall for tired runners.
 * Falls back to a single straight-line candidate when BRouter is down.
 */
export async function routeSectionCandidates(
  from: [number, number],
  to: [number, number]
): Promise<RouteCandidate[]> {
  const tries = await Promise.all(
    [0, 1, 2].map(async (alt) => ({ alt, r: await routeFoot([from, to], alt) }))
  );
  const out: RouteCandidate[] = [];
  const seen = new Set<string>();
  for (const { alt, r } of tries) {
    // Straight-line fallbacks are identical across alts — keep at most one,
    // and only if no real route came back.
    const sig =
      r.source === "straight"
        ? "straight"
        : `${Math.round(r.distanceM / 50)}:${Math.round(r.gainM / 20)}:${r.points.length}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ ...r, alt });
  }
  const real = out.filter((c) => c.source === "brouter");
  const pool = real.length > 0 ? real : out;
  pool.sort((a, b) => a.distanceM + a.gainM * 8 - (b.distanceM + b.gainM * 8));
  return pool.slice(0, 3);
}
