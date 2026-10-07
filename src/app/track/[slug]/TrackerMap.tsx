"use client";

import { useEffect, useRef, useState } from "react";
import { AttributionControl, Map as MlMap, Marker, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { PositionSourceLabel, RouteFile } from "@/lib/tracker/types";

/**
 * The Live tab's map (TRACKER_SPEC.md §11 "Live": the route, the completed
 * part highlighted, one dot per entry). MapLibre GL 6 is ESM-only with no
 * default export, and its worker is a separate ES-module file. It is served
 * as a plain static file from public/track/ (copied from node_modules by
 * scripts/copy-maplibre-worker.mjs on install and build): bundling it via
 * new URL(..., import.meta.url) made Next's production minifier choke on
 * the worker's own import/export. Mounted with next/dynamic({ ssr: false }),
 * so this module never runs on the server.
 *
 * Basemap: OpenFreeMap's dark style (keyless, no usage cap, attribution
 * through its TileJSON). If that style fails to load, the map swaps to a
 * dimmed OSM raster fallback — still keyless — and says so in a corner.
 *
 * Drawing: two GeoJSON sources, the whole route dim and the COMPLETED part
 * per entry bright in the entry colour, clipped at progress_m using the
 * route file's cum_m. With several entries on one route the completed
 * lines would cover one another, so each gets a small side offset. Dots are
 * DOM markers — a circle in the entry colour with the SHORT NAME inside
 * (never colour alone); the van shows as a rounded square, stale fixes get
 * a warn ring, off-route fixes a red one.
 */

if (typeof window !== "undefined") {
  setWorkerUrl("/track/maplibre-gl-worker.mjs");
}

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const GLYPHS_URL = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  glyphs: GLYPHS_URL,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#101214" } },
    { id: "osm", type: "raster", source: "osm", paint: { "raster-brightness-max": 0.35, "raster-saturation": -0.6 } },
  ],
};

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const LINE_LAYOUT = { "line-join": "round", "line-cap": "round" } as const;

export type MapEntry = {
  id: string;
  name: string;
  short_name: string;
  color: string;
  progress_m: number;
  position: { lat: number; lon: number; stale: boolean; off_route: boolean; source: PositionSourceLabel } | null;
};

export type TrackerMapProps = {
  route: RouteFile | null;
  entries: MapEntry[];
  /** Keep the leader in view on every update. */
  follow: boolean;
  leaderId: string | null;
  /** The viewer dragged or pinched: the parent turns follow off. */
  onUserInteract?: () => void;
};

/** The route up to `progressM`, interpolated inside the last segment. */
function clipRoute(route: RouteFile, progressM: number): [number, number][] | null {
  const { coords, cum_m } = route;
  if (coords.length < 2 || progressM <= 0) return null;
  if (progressM >= route.length_m) return coords;
  let lo = 0;
  let hi = cum_m.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cum_m[mid] <= progressM) lo = mid;
    else hi = mid - 1;
  }
  const out = coords.slice(0, lo + 1);
  if (lo < coords.length - 1) {
    const a = coords[lo];
    const b = coords[lo + 1];
    const span = cum_m[lo + 1] - cum_m[lo];
    const t = span > 0 ? Math.min(1, (progressM - cum_m[lo]) / span) : 0;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out.length >= 2 ? out : null;
}

/** Sources and layers, added once per style (again after a style swap). */
function ensureLayers(map: MlMap) {
  if (!map.getSource("route")) {
    map.addSource("route", { type: "geojson", data: EMPTY });
    map.addLayer({ id: "route-casing", type: "line", source: "route", layout: LINE_LAYOUT, paint: { "line-color": "#000", "line-width": 7, "line-opacity": 0.45 } });
    map.addLayer({ id: "route-line", type: "line", source: "route", layout: LINE_LAYOUT, paint: { "line-color": "#F1F1EC", "line-width": 4, "line-opacity": 0.25 } });
  }
  if (!map.getSource("done")) {
    map.addSource("done", { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "done-line",
      type: "line",
      source: "done",
      layout: LINE_LAYOUT,
      paint: { "line-color": ["get", "color"], "line-width": 4, "line-opacity": 0.95, "line-offset": ["get", "offset"] },
    });
  }
  if (!map.getSource("cps")) {
    map.addSource("cps", { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "cp-tick",
      type: "circle",
      source: "cps",
      paint: { "circle-radius": 3.5, "circle-color": "#101214", "circle-stroke-color": "#A4A9AF", "circle-stroke-width": 1.5 },
    });
    map.addLayer({
      id: "cp-label",
      type: "symbol",
      source: "cps",
      minzoom: 9,
      layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-anchor": "top", "text-offset": [0, 0.8], "text-optional": true },
      paint: { "text-color": "#A4A9AF", "text-halo-color": "#101214", "text-halo-width": 1.2 },
    });
  }
}

function applyData(map: MlMap, route: RouteFile | null, entries: MapEntry[]) {
  if (!route) return;
  const src = (id: string) => map.getSource(id) as GeoJSONSource | undefined;
  src("route")?.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route.coords } });
  const n = entries.length;
  const done: GeoJSON.Feature[] = [];
  entries.forEach((e, i) => {
    const coords = clipRoute(route, e.progress_m);
    if (!coords) return;
    done.push({ type: "Feature", properties: { color: e.color, offset: (i - (n - 1) / 2) * 5 }, geometry: { type: "LineString", coordinates: coords } });
  });
  src("done")?.setData({ type: "FeatureCollection", features: done });
  src("cps")?.setData({
    type: "FeatureCollection",
    features: route.checkpoints.map((cp) => ({ type: "Feature", properties: { name: cp.name, kind: cp.kind }, geometry: { type: "Point", coordinates: [cp.lon, cp.lat] } })),
  });
}

export default function TrackerMap({ route, entries, follow, leaderId, onUserInteract }: TrackerMapProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLDivElement }>());
  const styleReady = useRef(false);
  const fellBack = useRef(false);
  const fitted = useRef(false);
  const latest = useRef({ route, entries });
  latest.current = { route, entries };
  const interactRef = useRef(onUserInteract);
  interactRef.current = onUserInteract;
  const [note, setNote] = useState<string | null>(null);

  /* Create the map once. */
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const map = new MlMap({
      container: el,
      style: STYLE_URL,
      attributionControl: false,
      center: [-118.5, 33.8],
      zoom: 7,
      maxZoom: 17,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      fadeDuration: 0,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new AttributionControl({ compact: true }), "bottom-left");
    mapRef.current = map;

    const fallback = () => {
      if (fellBack.current) return;
      fellBack.current = true;
      styleReady.current = false;
      setNote("Basemap unavailable · plain map");
      map.setStyle(FALLBACK_STYLE);
    };
    // No style after 8 s (slow or blocked host) counts as a failure too.
    const styleTimer = setTimeout(() => {
      if (!styleReady.current) fallback();
    }, 8000);

    map.on("style.load", () => {
      styleReady.current = true;
      clearTimeout(styleTimer);
      ensureLayers(map);
      applyData(map, latest.current.route, latest.current.entries);
    });
    map.on("error", (e) => {
      // Before the style is up, a failed request is the style itself (or its
      // tile host): swap to the raster fallback. Later tile 404s are noise.
      if (styleReady.current) return;
      const err = e.error as { status?: number; message?: string } | undefined;
      if (err && (typeof err.status === "number" || /style|fetch|network|load/i.test(err.message ?? ""))) fallback();
    });
    const interact = (ev: { originalEvent?: unknown }) => {
      if (ev.originalEvent) interactRef.current?.();
    };
    map.on("dragstart", interact);
    map.on("zoomstart", interact);

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(el);
    const mk = markers.current;
    return () => {
      clearTimeout(styleTimer);
      ro.disconnect();
      mk.forEach((m) => m.marker.remove());
      mk.clear();
      map.remove();
      mapRef.current = null;
      styleReady.current = false;
    };
  }, []);

  /* Fit the route's bbox once it is known. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !route || fitted.current) return;
    fitted.current = true;
    const [minLat, minLon, maxLat, maxLon] = route.bbox;
    map.fitBounds(
      [
        [minLon, minLat],
        [maxLon, maxLat],
      ],
      { padding: { top: 40, bottom: 64, left: 32, right: 32 }, duration: 0 },
    );
  }, [route]);

  /* Route + completed parts + checkpoints. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady.current) return;
    ensureLayers(map);
    applyData(map, route, entries);
  }, [route, entries]);

  /* The dots. classList, not className: MapLibre owns `maplibregl-marker`. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    for (const e of entries) {
      const p = e.position;
      if (!p) continue;
      seen.add(e.id);
      let m = markers.current.get(e.id);
      if (!m) {
        const el = document.createElement("div");
        el.className = "mk";
        m = { marker: new Marker({ element: el, anchor: "center" }).setLngLat([p.lon, p.lat]).addTo(map), el };
        markers.current.set(e.id, m);
      } else {
        m.marker.setLngLat([p.lon, p.lat]);
      }
      m.el.classList.toggle("is-vehicle", p.source === "vehicle");
      m.el.classList.toggle("is-stale", p.stale);
      m.el.classList.toggle("is-off", p.off_route);
      m.el.classList.toggle("is-leader", e.id === leaderId && entries.length > 1);
      m.el.style.background = e.color;
      m.el.textContent = e.short_name;
      m.el.title = e.name;
      m.el.setAttribute("aria-label", e.name);
    }
    for (const [id, m] of Array.from(markers.current)) {
      if (seen.has(id)) continue;
      m.marker.remove();
      markers.current.delete(id);
    }
  }, [entries, leaderId]);

  /* Follow the leader. easeTo fires no originalEvent, so it does not count as user interaction. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !follow) return;
    const p = entries.find((e) => e.id === leaderId)?.position;
    if (!p) return;
    map.easeTo({ center: [p.lon, p.lat], zoom: Math.max(map.getZoom(), 12), duration: 700 });
  }, [follow, entries, leaderId]);

  return (
    <>
      <div ref={elRef} className="map-el" role="region" aria-label="Map" />
      {note && <div className="map-note">{note}</div>}
    </>
  );
}
