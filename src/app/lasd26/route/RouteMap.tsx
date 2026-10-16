"use client";

import { useEffect, useRef, useState } from "react";
import {
  AttributionControl,
  Map as MlMap,
  Marker,
  Popup,
  setWorkerUrl,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { CourseFile, Focus } from "./course";

/**
 * The course on a MapLibre map in the site's colours (owner, 2026-10-16:
 * "embed this route into the site, make it the same color scheme as the
 * rest of the site"). Same mechanics as the tracker's map
 * (src/app/track/[slug]/TrackerMap.tsx): MapLibre GL 6 is ESM-only, its
 * worker is served as a static file from public/track/, and this module
 * is mounted with next/dynamic({ ssr: false }) so it never runs on the
 * server.
 *
 * Basemap: OpenFreeMap's "positron" — light grey, keyless, no usage cap —
 * which sits on the cream paper without a fight. If it fails to load the
 * map swaps to a washed-out OSM raster fallback and says so in a corner.
 *
 * Drawing: the run legs as a lime line over an ink casing; the drive
 * through Camp Pendleton as a dashed ink line (the runner is in the van
 * there, it is not course); the turns as small ink dots that open a paper
 * popup on tap; the bathroom stops as a deep-green dot layer the parent's
 * chip switches on and off; START and FINISH as DOM tags. A tap on a row
 * of the list below hands a `focus` down and the map flies there.
 */

if (typeof window !== "undefined") {
  setWorkerUrl("/track/maplibre-gl-worker.mjs");
}

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const INK = "#111110";
const LIME = "#D0F858";
const GREEN = "#3C7A0B";
const PAPER = "#F4F3EE";

const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
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
    { id: "bg", type: "background", paint: { "background-color": PAPER } },
    { id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.85, "raster-opacity": 0.75 } },
  ],
};

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const LINE_LAYOUT = { "line-join": "round", "line-cap": "round" } as const;

export type RouteMapProps = {
  course: CourseFile;
  showBaths: boolean;
  focus: Focus | null;
};

/** The run legs — the line split at every drive. */
function legsOf(course: CourseFile): [number, number][][] {
  const out: [number, number][][] = [];
  let start = 0;
  for (const d of [...course.drives].sort((a, b) => a.at - b.at)) {
    if (d.at < start) continue;
    out.push(course.coords.slice(start, d.at + 1));
    start = d.at + 1;
  }
  out.push(course.coords.slice(start));
  return out.filter((l) => l.length >= 2);
}

/** Sources and layers, added once per style (again after a style swap). */
function ensureLayers(map: MlMap) {
  if (!map.getSource("route")) {
    map.addSource("route", { type: "geojson", data: EMPTY });
    map.addLayer({ id: "route-casing", type: "line", source: "route", layout: LINE_LAYOUT, paint: { "line-color": INK, "line-width": 7 } });
    map.addLayer({ id: "route-line", type: "line", source: "route", layout: LINE_LAYOUT, paint: { "line-color": LIME, "line-width": 4 } });
  }
  if (!map.getSource("drive")) {
    map.addSource("drive", { type: "geojson", data: EMPTY });
    map.addLayer({ id: "drive-line", type: "line", source: "drive", layout: { "line-join": "round" }, paint: { "line-color": INK, "line-width": 2, "line-dasharray": [2, 2.5] } });
  }
  if (!map.getSource("baths")) {
    map.addSource("baths", { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "baths-dot",
      type: "circle",
      source: "baths",
      layout: { visibility: "none" },
      paint: { "circle-radius": 5, "circle-color": GREEN, "circle-opacity": 0.85, "circle-stroke-color": PAPER, "circle-stroke-width": 1.5 },
    });
  }
  if (!map.getSource("turns")) {
    map.addSource("turns", { type: "geojson", data: EMPTY });
    map.addLayer({
      id: "turns-dot",
      type: "circle",
      source: "turns",
      paint: { "circle-radius": 4, "circle-color": INK, "circle-stroke-color": PAPER, "circle-stroke-width": 1.5 },
    });
  }
}

function applyData(map: MlMap, course: CourseFile, showBaths: boolean) {
  const src = (id: string) => map.getSource(id) as GeoJSONSource | undefined;
  src("route")?.setData({ type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: legsOf(course) } });
  src("drive")?.setData({
    type: "FeatureCollection",
    features: course.drives.map((d) => ({ type: "Feature", properties: { mile: d.mile }, geometry: { type: "LineString", coordinates: [d.from, d.to] } })),
  });
  src("turns")?.setData({
    type: "FeatureCollection",
    features: course.turns
      .filter((t) => t.kind !== "start" && t.kind !== "finish")
      .map((t) => ({ type: "Feature", properties: { name: t.name, mile: t.mile, note: t.note ?? "" }, geometry: { type: "Point", coordinates: [t.lon, t.lat] } })),
  });
  src("baths")?.setData({
    type: "FeatureCollection",
    features: course.bathrooms.map((b) => ({
      type: "Feature",
      properties: { name: b.name, mile: b.mile, note: [b.kind === "window" ? "the organizer's pick" : null, b.address].filter(Boolean).join(" · ") },
      geometry: { type: "Point", coordinates: [b.lon, b.lat] },
    })),
  });
  if (map.getLayer("baths-dot")) map.setLayoutProperty("baths-dot", "visibility", showBaths ? "visible" : "none");
}

/** The popup body, built as DOM so nothing from the file is parsed as HTML. */
function popupBody(name: string, mile: number, note: string | null): HTMLElement {
  const el = document.createElement("div");
  const m = document.createElement("span");
  m.className = "m";
  m.textContent = `MI ${mile.toFixed(1)}`;
  el.appendChild(m);
  el.appendChild(document.createTextNode(name));
  if (note) {
    const a = document.createElement("span");
    a.className = "a";
    a.textContent = note;
    el.appendChild(a);
  }
  return el;
}

function tag(text: string, cls: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = cls;
  el.textContent = text;
  return el;
}

export default function RouteMap({ course, showBaths, focus }: RouteMapProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const styleReady = useRef(false);
  const fellBack = useRef(false);
  const latest = useRef({ course, showBaths });
  latest.current = { course, showBaths };
  const [note, setNote] = useState<string | null>(null);

  /* Create the map once, framed on the course. */
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const [minLon, minLat, maxLon, maxLat] = latest.current.course.bbox;
    const map = new MlMap({
      container: el,
      style: STYLE_URL,
      attributionControl: false,
      bounds: [
        [minLon, minLat],
        [maxLon, maxLat],
      ],
      fitBoundsOptions: { padding: { top: 36, bottom: 36, left: 28, right: 28 } },
      maxZoom: 18,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      fadeDuration: 0,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new AttributionControl({ compact: true }), "bottom-left");
    mapRef.current = map;
    const popup = new Popup({ closeButton: false, closeOnClick: true, maxWidth: "260px", offset: 10 });
    popupRef.current = popup;

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
      applyData(map, latest.current.course, latest.current.showBaths);
    });
    map.on("error", (e) => {
      if (styleReady.current) return;
      const err = e.error as { status?: number; message?: string } | undefined;
      if (err && (typeof err.status === "number" || /style|fetch|network|load/i.test(err.message ?? ""))) fallback();
    });

    // Tap a dot: the paper popup. Hover: a pointer, so a laptop knows they are live.
    const open = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== "Point") return;
      const p = f.properties as { name?: string; mile?: number; note?: string };
      const [lon, lat] = f.geometry.coordinates as [number, number];
      popup.setLngLat([lon, lat]).setDOMContent(popupBody(String(p.name ?? ""), Number(p.mile ?? 0), p.note ? String(p.note) : null)).addTo(map);
    };
    for (const layer of ["turns-dot", "baths-dot"]) {
      map.on("click", layer, open);
      map.on("mouseenter", layer, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layer, () => {
        map.getCanvas().style.cursor = "";
      });
    }

    // START and FINISH tags.
    const markers: Marker[] = [];
    const c = latest.current.course;
    const start = c.turns.find((t) => t.kind === "start");
    const finish = c.turns.find((t) => t.kind === "finish");
    const first = c.coords[0];
    const last = c.coords[c.coords.length - 1];
    if (first) markers.push(new Marker({ element: tag("START", "rt-mk start"), anchor: "bottom-left", offset: [8, -8] }).setLngLat(start ? [start.lon, start.lat] : first).addTo(map));
    if (last) markers.push(new Marker({ element: tag("FINISH", "rt-mk finish"), anchor: "top-left", offset: [8, 8] }).setLngLat(finish ? [finish.lon, finish.lat] : last).addTo(map));

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(el);
    return () => {
      clearTimeout(styleTimer);
      ro.disconnect();
      markers.forEach((m) => m.remove());
      popup.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      styleReady.current = false;
    };
  }, []);

  /* The data and the bathroom switch. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady.current) return;
    ensureLayers(map);
    applyData(map, course, showBaths);
  }, [course, showBaths]);

  /* A row was tapped below: fly there and say what it is. */
  useEffect(() => {
    const map = mapRef.current;
    const popup = popupRef.current;
    if (!map || !popup || !focus) return;
    map.flyTo({ center: [focus.lon, focus.lat], zoom: Math.max(map.getZoom(), 13.5), duration: 900, essential: true });
    popup.setLngLat([focus.lon, focus.lat]).setDOMContent(popupBody(focus.name, focus.mile, null)).addTo(map);
  }, [focus]);

  return (
    <>
      <div ref={elRef} className="map-el" role="region" aria-label="The course on a map" />
      {note && <div className="rt-note">{note}</div>}
    </>
  );
}
