"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";
import type { RelayData } from "@/lib/relay";

type Props = {
  data: RelayData;
  /** Map height (px or CSS size). */
  height?: number | string;
  /** Manage page: clicking the map reports coordinates (waypoint placement). */
  onMapClick?: (lat: number, lng: number) => void;
  /** Live page: hovering a completed segment reports its id (null on leave) so
   *  the overlay can swap to that leg's stats. */
  onSegmentHover?: (segmentId: string | null) => void;
  /** Full-bleed map (no border/radius) — for the map-forward live view. */
  bare?: boolean;
  /** Highlight one runner's segments (legend hover): theirs brighten/thicken,
   *  everyone else's dim. null/undefined = no highlight. */
  highlightRunnerId?: string | null;
  /** Extra overlay lines (route-planner candidate previews, unplanned section
   *  hints). Redrawn whenever the array identity changes. */
  extras?: ExtraLine[];
  /** Basemap style. "dark" = CARTO dark matter (the immersive tracker look);
   *  "voyager" = CARTO Voyager — a rich, light, Google-Maps-like map with
   *  street names, terrain tints, and POIs, for PLANNING work where you need
   *  to actually read the roads. Default: voyager when bare=false, dark when
   *  bare=true (the historical behavior). */
  tiles?: "dark" | "voyager";
};

export type ExtraLine = {
  id: string;
  points: [number, number, number][] | [number, number][];
  color: string;
  weight?: number;
  opacity?: number;
  dash?: string;
  /** Popup/tooltip label. */
  label?: string;
};

/**
 * The relay tracker map — planned route as a faint dashed line, completed
 * segments as bold per-runner-colored lines, waypoints as labeled markers
 * (name + ETA), and a pulsing dot at the team's current position.
 *
 * Leaflet + OpenStreetMap tiles: free, no API key, street-level detail across
 * France. Leaflet touches `window` at import time, so it's loaded dynamically
 * inside the mount effect (this file's static imports are types + CSS only —
 * both SSR-safe). Vector markers (circleMarker/divIcon) only, so none of
 * Leaflet's bundler-hostile marker PNGs are needed.
 */
export function RelayMap({
  data,
  height = 520,
  onMapClick,
  onSegmentHover,
  bare = false,
  highlightRunnerId = null,
  extras,
  tiles,
}: Props) {
  const tileStyle: "dark" | "voyager" = tiles ?? (bare ? "dark" : "voyager");
  const holderRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layersRef = useRef<Leaflet.LayerGroup | null>(null);
  const didFitRef = useRef(false);
  const drawnRef = useRef(false); // draw-on animation runs once
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  // Completed polylines keyed by runnerId ("" = unassigned) so the legend-hover
  // highlight can restyle without a full redraw.
  const linesByRunnerRef = useRef<Map<string, { line: Leaflet.Polyline; weight: number }[]>>(
    new Map()
  );
  // Keep the latest handlers without re-initializing the map / re-rendering.
  const clickRef = useRef<Props["onMapClick"]>(onMapClick);
  clickRef.current = onMapClick;
  const hoverRef = useRef<Props["onSegmentHover"]>(onSegmentHover);
  hoverRef.current = onSegmentHover;

  // Init once.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !holderRef.current || mapRef.current) return;
      const map = L.map(holderRef.current, {
        center: [46.6, 2.4], // France
        zoom: 6,
        scrollWheelZoom: true,
        zoomControl: !bare, // hide the +/- control on the immersive full-screen view
      });
      // Basemap — free CARTO tiles, no key. "dark" (dark matter) for the
      // immersive tracker; "voyager" — rich/light with readable street names,
      // terrain tints and POIs — for planning work.
      const tileUrl =
        tileStyle === "dark"
          ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
      L.tileLayer(tileUrl, {
        maxZoom: 20,
        subdomains: "abcd",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);
      map.on("click", (e: Leaflet.LeafletMouseEvent) => {
        clickRef.current?.(e.latlng.lat, e.latlng.lng);
      });
      mapRef.current = map;
      layersRef.current = L.layerGroup().addTo(map);
      renderData(L, map, layersRef.current, data, didFitRef, hoverRef, bare, drawnRef, linesByRunnerRef, tileStyle);

      // Leaflet caches the container size at init; if the container hadn't
      // reached its final (full-screen) height yet, only the top strip of tiles
      // loads. Re-measure a few times + on resize so the map always fills.
      const fix = () => map.invalidateSize();
      requestAnimationFrame(fix);
      const t1 = window.setTimeout(fix, 250);
      const t2 = window.setTimeout(fix, 800);
      const ro =
        typeof ResizeObserver !== "undefined" && holderRef.current
          ? new ResizeObserver(fix)
          : null;
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
      resizeCleanupRef.current?.();
      mapRef.current?.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw on data change (cheap: clear the layer group, re-add).
  useEffect(() => {
    void (async () => {
      const map = mapRef.current;
      const layers = layersRef.current;
      if (!map || !layers) return;
      const L = await import("leaflet");
      layers.clearLayers();
      renderData(L, map, layers, data, didFitRef, hoverRef, bare, drawnRef, linesByRunnerRef, tileStyle);
    })();
  }, [data]);

  // Extra overlay lines (planner candidates / unplanned hints) live in their
  // own layer group so they redraw independently of the data layers.
  const extrasLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  useEffect(() => {
    void (async () => {
      const map = mapRef.current;
      if (!map) return;
      const L = await import("leaflet");
      if (!extrasLayerRef.current) extrasLayerRef.current = L.layerGroup().addTo(map);
      const layer = extrasLayerRef.current;
      layer.clearLayers();
      for (const e of extras ?? []) {
        if (e.points.length < 2) continue;
        const latlngs = e.points.map((p) => [p[0], p[1]] as [number, number]);
        const line = L.polyline(latlngs, {
          color: e.color,
          weight: e.weight ?? 5,
          opacity: e.opacity ?? 0.9,
          dashArray: e.dash,
        }).addTo(layer);
        if (e.label) line.bindTooltip(e.label, { sticky: true });
        line.bringToFront();
      }
    })();
  }, [extras]);

  // Legend-hover highlight: brighten the hovered runner's legs, dim the rest.
  // Pure setStyle — no redraw, no animation restart.
  useEffect(() => {
    for (const [runnerId, lines] of linesByRunnerRef.current) {
      for (const { line, weight } of lines) {
        if (!highlightRunnerId) {
          line.setStyle({ opacity: 0.95, weight });
        } else if (runnerId === highlightRunnerId) {
          line.setStyle({ opacity: 1, weight: weight + 3 });
          line.bringToFront();
        } else {
          line.setStyle({ opacity: 0.18, weight });
        }
      }
    }
  }, [highlightRunnerId, data]);

  return (
    <div
      ref={holderRef}
      style={{
        height,
        width: "100%",
        borderRadius: bare ? 0 : 12,
        overflow: "hidden",
        border: bare ? "none" : "1px solid var(--line)",
        background: bare ? "#14120f" : "var(--cream)",
        // Leaflet panes stack their own z-indexes up to ~700; contain them so
        // the site nav / viewer overlays always sit above the map.
        position: "relative",
        zIndex: 0,
      }}
    />
  );
}

function renderData(
  L: typeof Leaflet,
  map: Leaflet.Map,
  layers: Leaflet.LayerGroup,
  data: RelayData,
  didFitRef: { current: boolean },
  hoverRef: { current: ((id: string | null) => void) | undefined },
  bare: boolean,
  drawnRef: { current: boolean },
  linesByRunnerRef: {
    current: Map<string, { line: Leaflet.Polyline; weight: number }[]>;
  },
  tileStyle: "dark" | "voyager"
) {
  linesByRunnerRef.current = new Map();
  const allLatLngs: Leaflet.LatLngExpression[] = [];

  // Planned = the route LEFT, drawn clearly as "the way ahead": glow underlay
  // + dotted line. Colors flip with the basemap — pale amber pops on the dark
  // tiles but disappears on Voyager, where the deep accent red reads instead.
  const plannedColor = tileStyle === "dark" ? "#ffcf8f" : "#c8401a";
  for (const s of data.segments) {
    if (s.kind !== "planned" || s.points.length < 2) continue;
    const latlngs = s.points.map((p) => [p[0], p[1]] as [number, number]);
    allLatLngs.push(...latlngs);
    L.polyline(latlngs, { color: plannedColor, weight: 9, opacity: tileStyle === "dark" ? 0.14 : 0.1 }).addTo(layers); // glow
    L.polyline(latlngs, {
      color: plannedColor,
      weight: 3,
      opacity: 0.95,
      dashArray: "1 11",
      lineCap: "round",
    }).addTo(layers);
  }

  // Completed — bold, colored per runner. Collect for the draw-on animation.
  const colorByRunner = new Map(data.runners.map((r) => [r.id, r.color]));
  const completedLines: Leaflet.Polyline[] = [];
  for (const s of data.segments) {
    if (s.kind !== "completed" || s.points.length < 2) continue;
    const latlngs = s.points.map((p) => [p[0], p[1]] as [number, number]);
    allLatLngs.push(...latlngs);
    const color = (s.runnerId && colorByRunner.get(s.runnerId)) || "#c8401a";
    const runner = data.runners.find((r) => r.id === s.runnerId);
    const line = L.polyline(latlngs, { color, weight: bare ? 5 : 4, opacity: 0.95 }).addTo(layers);
    completedLines.push(line);
    const key = s.runnerId ?? "";
    const bucket = linesByRunnerRef.current.get(key) ?? [];
    bucket.push({ line, weight: bare ? 5 : 4 });
    linesByRunnerRef.current.set(key, bucket);
    const mi = (s.distanceM / 1609.34).toFixed(1);
    line.bindPopup(
      `<strong>${escapeHtml(s.name ?? "Segment")}</strong><br/>` +
        `${runner ? escapeHtml(runner.name) + " · " : ""}${mi} mi`
    );
    // Hover → thicken + report the segment so the overlay swaps to its stats.
    const baseWeight = bare ? 5 : 4;
    line.on("mouseover", () => {
      line.setStyle({ weight: baseWeight + 3, opacity: 1 });
      line.bringToFront();
      hoverRef.current?.(s.id);
    });
    line.on("mouseout", () => {
      line.setStyle({ weight: baseWeight, opacity: 0.95 });
      hoverRef.current?.(null);
    });
  }

  // Draw-on animation (once): reveal each completed leg in order via an SVG
  // stroke-dashoffset transition. Progressive enhancement — wrapped in try/catch
  // (getTotalLength is SVG-only; Leaflet may use canvas) so it never breaks the
  // map. Runs only on the first render (drawnRef) so a data refresh doesn't
  // re-animate.
  if (!drawnRef.current && completedLines.length > 0) {
    drawnRef.current = true;
    completedLines.forEach((line, i) => {
      try {
        const el = line.getElement() as SVGPathElement | null;
        if (!el || typeof el.getTotalLength !== "function") return;
        const len = el.getTotalLength();
        if (!Number.isFinite(len) || len <= 0) return;
        el.style.transition = "none";
        el.style.strokeDasharray = String(len);
        el.style.strokeDashoffset = String(len);
        el.getBoundingClientRect(); // force reflow so the transition takes
        const delay = Math.min(i * 160, 2400);
        el.style.transition = `stroke-dashoffset 680ms ease ${delay}ms`;
        el.style.strokeDashoffset = "0";
      } catch {
        /* canvas renderer or detached — leave the line drawn */
      }
    });
  }

  // Waypoints — small labeled markers with name + ETA.
  for (const w of data.waypoints) {
    allLatLngs.push([w.lat, w.lng]);
    const marker = L.circleMarker([w.lat, w.lng], {
      radius: 7,
      color: "#2a2521",
      weight: 2,
      fillColor: w.passed ? "#3a6b40" : "#f5f2ec",
      fillOpacity: 1,
    }).addTo(layers);
    const eta = w.passed
      ? "Passed ✓"
      : w.etaAt
        ? `ETA ~ ${new Date(w.etaAt).toLocaleString(undefined, {
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}`
        : "ETA —";
    const remain =
      !w.passed && w.remainingM !== null
        ? ` · ${(w.remainingM / 1609.34).toFixed(0)} mi to go`
        : "";
    // Directions deep link (Google Maps universal URL — opens the app on
    // phones). Coordinates only, so nothing user-controlled needs escaping.
    const dir = `https://www.google.com/maps/dir/?api=1&destination=${w.lat},${w.lng}`;
    marker.bindPopup(
      `<strong>${escapeHtml(w.name)}</strong><br/>${eta}${remain}<br/>` +
        `<a href="${dir}" target="_blank" rel="noopener noreferrer">Directions ↗</a>`
    );
    marker.bindTooltip(w.name, { direction: "top", offset: [0, -8] });
  }

  // Current position — pulsing dot.
  if (data.position) {
    allLatLngs.push([data.position.lat, data.position.lng]);
    L.circleMarker([data.position.lat, data.position.lng], {
      radius: 8,
      color: "#ffffff",
      weight: 2,
      fillColor: "#c8401a",
      fillOpacity: 1,
    })
      .addTo(layers)
      .bindTooltip("The team is here", { direction: "top", offset: [0, -8] });
  }

  // Fit ONCE when real data first shows up, then respect the user's zoom.
  if (!didFitRef.current && allLatLngs.length > 1) {
    map.fitBounds(L.latLngBounds(allLatLngs), { padding: [32, 32] });
    didFitRef.current = true;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
