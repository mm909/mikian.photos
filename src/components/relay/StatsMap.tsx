"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import type { RelayData } from "@/lib/relay";
import type { ProfilePoint, SyncPoint } from "./ElevationChart";

/**
 * "Where are we right now" map for /tsp/stats (dark CARTO tiles).
 *
 * Draws ALL completed segments (per-runner colors), the planned line (bright
 * amber dotted over a soft glow underlay), and the current-position dot — but
 * the INITIAL view is fit tight to "right now": the last 3 completed segments
 * (by endedAt, upload order as tiebreak) plus the next ~10 miles of the
 * planned line past the current position (nearest-profile-point index → walk
 * forward until alongM grows by 10 mi). Pan/zoom out freely to see the whole
 * crossing.
 *
 * Hover sync with the elevation chart, both directions:
 *  - mousemove on the planned polylines → nearest profile point (rAF
 *    throttled, cheap equirectangular metric) → `onPlannedHover({lat,lng,
 *    alongM})`; the chart draws its vertical marker there.
 *  - the shared `sync` prop (set by either side) is rendered as a single
 *    reusable circleMarker — moved with setLatLng, never redrawn.
 *
 * SSR-safe Leaflet pattern (same as RelayMap): static imports are types + CSS
 * only; `import("leaflet")` happens inside the mount effect. Vector layers
 * only. The container keeps position:relative + zIndex:0 so Leaflet's panes
 * stay under the site nav, and invalidateSize is re-run via rAF + timeouts +
 * ResizeObserver because Leaflet caches a stale container size at init
 * (otherwise only the top strip of tiles loads).
 */

type Props = {
  data: RelayData;
  /** Shared route profile (decimated, alongM ascending) from RelayStats. */
  profile: ProfilePoint[];
  /** What the profile was built from — bounds logic only trusts "planned". */
  profileSource: "planned" | "completed" | null;
  /** Shared hover point to render as a dot (from the chart or this map). */
  sync: SyncPoint | null;
  /** Report planned-line hover (null on leave). */
  onPlannedHover: (s: SyncPoint | null) => void;
  height?: number | string;
};

const PLAN = "#ffcf8f";
const ACCENT = "#e8613c";
const CREAM = "#f5f2ec";
const BG = "#14120f";
const NEXT_WINDOW_M = 16093; // ~10 miles of planned route ahead

/** Nearest profile point to (lat,lng) — cheap equirectangular metric (the
 *  profile is <= 800 pts, so a linear scan per rAF tick is fine). */
function nearestProfilePoint(profile: ProfilePoint[], lat: number, lng: number): ProfilePoint | null {
  if (profile.length === 0) return null;
  const cos = Math.cos((lat * Math.PI) / 180);
  let best: ProfilePoint | null = null;
  let bestD = Infinity;
  for (const p of profile) {
    const dLat = p.lat - lat;
    const dLng = (p.lng - lng) * cos;
    const d = dLat * dLat + dLng * dLng;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/** Initial "right now" bounds: last 3 completed legs + next ~10 mi of plan.
 *  Falls back to the whole planned line when nothing is completed; null when
 *  there's nothing to fit at all (caller keeps the default France view). */
function initialBounds(
  L: typeof Leaflet,
  data: RelayData,
  profile: ProfilePoint[],
  profileSource: "planned" | "completed" | null
): Leaflet.LatLngBounds | null {
  const pts: [number, number][] = [];
  const completed = data.segments.filter((s) => s.kind === "completed" && s.points.length >= 2);

  if (completed.length > 0) {
    // Last 3 by endedAt; missing timestamps parse identically so the stable
    // sort preserves upload order (sortOrder) as the tiebreak.
    const byEnd = [...completed].sort(
      (a, b) => Date.parse(a.endedAt ?? "1970-01-01T00:00:00Z") - Date.parse(b.endedAt ?? "1970-01-01T00:00:00Z")
    );
    for (const s of byEnd.slice(-3)) {
      for (const p of s.points) pts.push([p[0], p[1]]);
    }
    if (data.position) {
      pts.push([data.position.lat, data.position.lng]);
      // Next ~10 mi of the planned line past the current position.
      if (profileSource === "planned" && profile.length > 0) {
        let near = 0;
        let bestD = Infinity;
        const cos = Math.cos((data.position.lat * Math.PI) / 180);
        for (let i = 0; i < profile.length; i++) {
          const dLat = profile[i].lat - data.position.lat;
          const dLng = (profile[i].lng - data.position.lng) * cos;
          const d = dLat * dLat + dLng * dLng;
          if (d < bestD) {
            bestD = d;
            near = i;
          }
        }
        const limit = profile[near].alongM + NEXT_WINDOW_M;
        for (let i = near; i < profile.length && profile[i].alongM <= limit; i++) {
          pts.push([profile[i].lat, profile[i].lng]);
        }
      }
    }
  } else {
    // Nothing run yet — fit the whole planned route.
    for (const s of data.segments) {
      if (s.kind !== "planned" || s.points.length < 2) continue;
      for (const p of s.points) pts.push([p[0], p[1]]);
    }
  }

  return pts.length > 1 ? L.latLngBounds(pts) : null;
}

function drawAll(
  L: typeof Leaflet,
  layers: Leaflet.LayerGroup,
  data: RelayData,
  attachPlannedHover: (line: Leaflet.Polyline) => void
) {
  // Planned — soft glow underlay + bright dotted line. Hover handlers go on
  // BOTH (the 9px glow doubles as a fat hit area).
  for (const s of data.segments) {
    if (s.kind !== "planned" || s.points.length < 2) continue;
    const latlngs = s.points.map((p) => [p[0], p[1]] as [number, number]);
    const glow = L.polyline(latlngs, { color: PLAN, weight: 9, opacity: 0.14 }).addTo(layers);
    const dots = L.polyline(latlngs, {
      color: PLAN,
      weight: 3,
      opacity: 0.95,
      dashArray: "1 11",
      lineCap: "round",
    }).addTo(layers);
    attachPlannedHover(glow);
    attachPlannedHover(dots);
  }

  // Completed — per-runner colors, drawn on top of the plan. Non-interactive
  // so hovering the overlap still reaches the planned line underneath.
  const colorByRunner = new Map(data.runners.map((r) => [r.id, r.color]));
  for (const s of data.segments) {
    if (s.kind !== "completed" || s.points.length < 2) continue;
    const latlngs = s.points.map((p) => [p[0], p[1]] as [number, number]);
    const color = (s.runnerId && colorByRunner.get(s.runnerId)) || "#c8401a";
    L.polyline(latlngs, { color, weight: 4, opacity: 0.92, interactive: false }).addTo(layers);
  }

  // Current position — halo + ringed dot.
  if (data.position) {
    const ll: [number, number] = [data.position.lat, data.position.lng];
    L.circleMarker(ll, {
      radius: 16,
      stroke: false,
      fillColor: ACCENT,
      fillOpacity: 0.18,
      interactive: false,
    }).addTo(layers);
    L.circleMarker(ll, {
      radius: 8,
      color: "#ffffff",
      weight: 2,
      fillColor: ACCENT,
      fillOpacity: 1,
    })
      .addTo(layers)
      .bindTooltip("The team is here", { direction: "top", offset: [0, -8] });
  }
}

export function StatsMap({
  data,
  profile,
  profileSource,
  sync,
  onPlannedHover,
  height = "clamp(380px, 58vh, 640px)",
}: Props) {
  const holderRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const syncMarkerRef = useRef<Leaflet.CircleMarker | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const hoverRafRef = useRef<number | null>(null);
  const pendingLatLngRef = useRef<{ lat: number; lng: number } | null>(null);
  // Latest props via refs so map handlers never go stale (map inits once).
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const hoverCbRef = useRef(onPlannedHover);
  hoverCbRef.current = onPlannedHover;

  // Init once. The stats page fetches data server-side per load, so `data`
  // never changes under a live map instance — draw + fit happen here only
  // (fitting at init also keeps StrictMode's double-mount correct: each
  // fresh map instance fits itself).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !holderRef.current || mapRef.current) return;
      const map = L.map(holderRef.current, {
        center: [46.6, 2.4], // France — fallback when there's nothing to fit
        zoom: 6,
        scrollWheelZoom: true,
        zoomControl: true,
      });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 20,
        subdomains: "abcd",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);
      mapRef.current = map;
      leafletRef.current = L;

      // Planned-line hover → nearest profile point, rAF-throttled.
      const report = (latlng: { lat: number; lng: number } | null) => {
        if (!latlng) {
          if (hoverRafRef.current !== null) {
            cancelAnimationFrame(hoverRafRef.current);
            hoverRafRef.current = null;
          }
          pendingLatLngRef.current = null;
          hoverCbRef.current(null);
          return;
        }
        pendingLatLngRef.current = latlng;
        if (hoverRafRef.current !== null) return;
        hoverRafRef.current = requestAnimationFrame(() => {
          hoverRafRef.current = null;
          const ll = pendingLatLngRef.current;
          if (!ll) return;
          const p = nearestProfilePoint(profileRef.current, ll.lat, ll.lng);
          if (p) hoverCbRef.current({ lat: p.lat, lng: p.lng, alongM: p.alongM });
        });
      };
      const attachPlannedHover = (line: Leaflet.Polyline) => {
        line.on("mousemove", (e: Leaflet.LeafletMouseEvent) => report(e.latlng));
        line.on("mouseout", () => report(null));
      };

      const layers = L.layerGroup().addTo(map);
      drawAll(L, layers, data, attachPlannedHover);

      const bounds = initialBounds(L, data, profileRef.current, profileSource);
      if (bounds) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });

      // Leaflet caches the container size at init; if it hadn't reached its
      // final height yet, only the top strip of tiles loads. Re-measure.
      const fix = () => map.invalidateSize();
      requestAnimationFrame(fix);
      const t1 = window.setTimeout(fix, 250);
      const t2 = window.setTimeout(fix, 800);
      const ro =
        typeof ResizeObserver !== "undefined" && holderRef.current ? new ResizeObserver(fix) : null;
      if (ro && holderRef.current) ro.observe(holderRef.current);
      window.addEventListener("resize", fix);
      resizeCleanupRef.current = () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        ro?.disconnect();
        window.removeEventListener("resize", fix);
      };
    })();
    return () => {
      cancelled = true;
      if (hoverRafRef.current !== null) {
        cancelAnimationFrame(hoverRafRef.current);
        hoverRafRef.current = null;
      }
      resizeCleanupRef.current?.();
      resizeCleanupRef.current = null;
      syncMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shared hover dot — ONE reusable marker moved via setLatLng (no redraw).
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;
    if (sync) {
      if (syncMarkerRef.current) {
        syncMarkerRef.current.setLatLng([sync.lat, sync.lng]);
      } else {
        syncMarkerRef.current = L.circleMarker([sync.lat, sync.lng], {
          radius: 6,
          color: BG,
          weight: 2,
          fillColor: CREAM,
          fillOpacity: 1,
          interactive: false,
        }).addTo(map);
      }
    } else if (syncMarkerRef.current) {
      syncMarkerRef.current.remove();
      syncMarkerRef.current = null;
    }
  }, [sync]);

  return (
    <div
      ref={holderRef}
      style={{
        height,
        width: "100%",
        background: BG,
        borderTop: "1px solid rgba(245,242,236,0.10)",
        borderBottom: "1px solid rgba(245,242,236,0.10)",
        // Leaflet panes stack z-indexes up to ~700; contain them so the site
        // nav / overlays always sit above the map.
        position: "relative",
        zIndex: 0,
      }}
    />
  );
}
