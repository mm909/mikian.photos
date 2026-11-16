"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AttributionControl, Map as MlMap, Marker, Popup, setWorkerUrl, type GeoJSONSource, type MapLayerMouseEvent, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MI, mileMarkers, pointAt, sliceLine, type CourseFile, type Focus } from "./course";

/**
 * The TSP course on a MapLibre map — the LASD26 route map's mechanics
 * (src/app/lasd26/route/RouteMap.tsx: OpenFreeMap's positron, the worker
 * from public/track/, mounted with next/dynamic ssr:false; LOCATE that
 * follows until a drag, RECENTER, FULL SCREEN with the iPhone fallback,
 * NORTH while the map is turned) with what this crossing asks for (owner,
 * 2026-11-16):
 *
 *   "the little dots on every turn, that was good" — the turn dots, with the
 *     wide invisible hit ring, from zoom 8.5 (340 miles of them would bury
 *     the whole-course view).
 *   "the mile markers … when we zoom in, could be a little bit bigger, a
 *     little easier to see … a primary function of the map is us zooming in
 *     to look for these mile markers" — every 50 from the whole-course view,
 *     every 10, every 5, then EVERY MILE from zoom 10.5 as a white-ringed
 *     ink dot ON the line with a bold numeral that grows as you zoom (15 px
 *     at street level, 22 px close in).
 *   "see where the runners and the vans are for our team" — `people`: a tag
 *     per teammate sharing (RUNNER filled, a van on paper, crew small),
 *     greyed when the phone has gone quiet; other teams' shared vans dashed.
 *   "assign sections to runners … see the map of it" — `highlight`: the
 *     stretches of the picked runner (or the one leg) in ink over the blue,
 *     and a `focus` of kind "range" fits the map to a leg.
 *   The dirt is drawn as a dashed sand line over the route; the secrets
 *     team's checkpoints are CP tags.
 *
 * The watch behind LOCATE is also what the page shares: every fix goes up
 * through `onFix`, and `autoLocate` starts the watch on mount (dot only, no
 * jump) when this phone was sharing last time (owner: "sharing my location
 * with my team whenever I open up the app").
 */

if (typeof window !== "undefined") {
  setWorkerUrl("/track/maplibre-gl-worker.mjs");
}

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const INK = "#111110";
const BLUE = "#0077B6";
const SKY = "#4FB3EA";
const SAND = "#C98A2B";
const PAPER = "#F4F3EE";
const GLYPHS_URL = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const LABEL_FONT = ["Noto Sans Bold"];

const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  glyphs: GLYPHS_URL,
  sources: {
    osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": PAPER } },
    { id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.85, "raster-opacity": 0.75 } },
  ],
};

const C = { ink: INK, line: SKY, paper: PAPER, blue: BLUE, sand: SAND, halo: "#fff" };
const FIX = "#E4572E";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const LINE_LAYOUT = { "line-join": "round", "line-cap": "round" } as const;
const LOCATE_ZOOM = 14;

export type Fix = { lon: number; lat: number; accuracyM: number };
export type Person = { id: string; label: string; kind: "runner" | "van" | "crew" | "other"; lon: number; lat: number; stale: boolean; sub: string };

export type TspMapProps = {
  course: CourseFile;
  focus: Focus | null;
  /** Stretches to draw in ink over the route, metres along the line. */
  highlight: [number, number][];
  people: Person[];
  onFix?: (fix: Fix) => void;
  /** Start the location watch on mount (this phone was sharing last time). */
  autoLocate?: boolean;
  /** The watch went on or off (LOCATE tapped, permission denied). */
  onLocating?: (on: boolean) => void;
  /** THE PLAN ON THE LINE: each leg in its runner's colour (owner: "see the route assigned to each runner"). */
  legs?: MapLeg[];
  /** Where one shift hands to the next: a tag on the line. */
  handoffs?: MapHandoff[];
  /** What the options menu has switched on. */
  show?: { miles: boolean; turns: boolean; people: boolean };
  /** FIXING THE ROUTE: while set, a tap on the map is handed here and opens nothing. */
  onPick?: ((lon: number, lat: number) => void) | null;
  /** The fix being drawn: the stretch being replaced, the picked points, the new line once previewed. */
  draft?: MapDraft | null;
};

export type MapLeg = { fromM: number; toM: number; color: string; title: string; sub: string };
export type MapHandoff = { m: number; tag: string; title: string; sub: string };
export type MapDraft = { old: [number, number] | null; points: { lon: number; lat: number; label: string }[]; line: [number, number][] | null };

type Geo = "off" | "watch" | "follow";
type Fs = "off" | "api" | "css";

function circleOf(fix: Fix, radiusM: number): GeoJSON.Polygon {
  const kLat = 110540;
  const kLon = 111320 * Math.cos((fix.lat * Math.PI) / 180) || 1;
  const ring: [number, number][] = [];
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    ring.push([fix.lon + (radiusM * Math.sin(a)) / kLon, fix.lat + (radiusM * Math.cos(a)) / kLat]);
  }
  return { type: "Polygon", coordinates: [ring] };
}

function ensureLayers(map: MlMap) {
  if (map.getSource("route")) return;
  map.addSource("route", { type: "geojson", data: EMPTY });
  map.addLayer({ id: "route-casing", type: "line", source: "route", layout: LINE_LAYOUT, paint: { "line-color": C.ink, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 5, 12, 8, 16, 11] } });
  map.addLayer({ id: "route-line", type: "line", source: "route", layout: LINE_LAYOUT, paint: { "line-color": C.line, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 2.5, 12, 5, 16, 7] } });
  map.addSource("legs", { type: "geojson", data: EMPTY });
  map.addLayer({ id: "legs-line", type: "line", source: "legs", layout: { "line-join": "round", "line-cap": "butt" }, paint: { "line-color": ["get", "color"], "line-width": ["interpolate", ["linear"], ["zoom"], 6, 2.5, 12, 5, 16, 7] } });
  map.addSource("dirt", { type: "geojson", data: EMPTY });
  map.addLayer({ id: "dirt-line", type: "line", source: "dirt", layout: { "line-join": "round" }, paint: { "line-color": C.sand, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 2.5, 12, 5, 16, 7], "line-dasharray": [1.2, 1.2] } });
  map.addSource("hl", { type: "geojson", data: EMPTY });
  map.addLayer({ id: "hl-line", type: "line", source: "hl", layout: LINE_LAYOUT, paint: { "line-color": C.ink, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 3.5, 12, 6, 16, 8] } });
  map.addLayer({ id: "hl-core", type: "line", source: "hl", layout: LINE_LAYOUT, paint: { "line-color": C.paper, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1, 12, 1.6, 16, 2] } });

  map.addSource("turns", { type: "geojson", data: EMPTY });
  map.addLayer({ id: "turns-hit", type: "circle", source: "turns", minzoom: 8.5, paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 14, 14, 18], "circle-opacity": 0 } });
  map.addLayer({ id: "turns-dot", type: "circle", source: "turns", minzoom: 8.5, paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 3, 14, 5], "circle-color": C.paper, "circle-stroke-color": C.ink, "circle-stroke-width": 2 } });

  map.addSource("miles", { type: "geojson", data: EMPTY });
  // The dot on the line under each whole mile, once every mile shows.
  map.addLayer({ id: "miles-dot", type: "circle", source: "miles", minzoom: 10.5, filter: ["==", ["get", "tier"], 1], paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10.5, 3.5, 15, 6], "circle-color": C.ink, "circle-stroke-color": C.halo, "circle-stroke-width": 2 } });
  // One layer per tier, each handing over to the next as you zoom in.
  const tiers: [string, number, number, number, unknown][] = [
    ["miles-50", 50, 0, 6.8, 13],
    ["miles-10", 10, 6.8, 9, 14],
    ["miles-5", 5, 9, 10.5, 15],
    // EVERY MILE: big, and bigger the closer you look.
    ["miles-1", 1, 10.5, 24, ["interpolate", ["linear"], ["zoom"], 10.5, 13, 13, 16, 16, 22]],
  ];
  for (const [id, tier, minzoom, maxzoom, size] of tiers) {
    map.addLayer({
      id,
      type: "symbol",
      source: "miles",
      minzoom,
      maxzoom,
      filter: ["==", ["get", "tier"], tier],
      layout: {
        "text-field": ["to-string", ["get", "mile"]],
        "text-font": LABEL_FONT,
        "text-size": size as number,
        "text-variable-anchor": ["left", "right", "top", "bottom"],
        "text-radial-offset": 0.7,
        "text-justify": "auto",
        // A mile numeral beats a street name: it is what we zoomed in for.
        "text-allow-overlap": id === "miles-1",
        "symbol-sort-key": 0,
      },
      paint: { "text-color": C.ink, "text-halo-color": C.halo, "text-halo-width": 2.4 },
    });
  }

  map.addSource("me", { type: "geojson", data: EMPTY });
  map.addLayer({ id: "me-acc", type: "fill", source: "me", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": C.line, "fill-opacity": 0.18, "fill-outline-color": C.blue } });
  map.addLayer({ id: "me-dot", type: "circle", source: "me", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 7, "circle-color": C.line, "circle-stroke-color": C.ink, "circle-stroke-width": 2.5 } });

  // THE FIX being drawn: the stretch going away, the picked points, the new line.
  map.addSource("draft-old", { type: "geojson", data: EMPTY });
  map.addLayer({ id: "draft-old", type: "line", source: "draft-old", layout: LINE_LAYOUT, paint: { "line-color": "#fff", "line-opacity": 0.8, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 3, 12, 6, 16, 8], "line-dasharray": [0.6, 1.4] } });
  map.addSource("draft-line", { type: "geojson", data: EMPTY });
  map.addLayer({ id: "draft-line", type: "line", source: "draft-line", layout: LINE_LAYOUT, paint: { "line-color": FIX, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 3, 12, 6, 16, 8] } });
  map.addSource("draft-pts", { type: "geojson", data: EMPTY });
  map.addLayer({ id: "draft-pts", type: "circle", source: "draft-pts", paint: { "circle-radius": 9, "circle-color": FIX, "circle-stroke-color": "#fff", "circle-stroke-width": 2.5 } });
  map.addLayer({ id: "draft-lbl", type: "symbol", source: "draft-pts", layout: { "text-field": ["get", "label"], "text-font": LABEL_FONT, "text-size": 11, "text-allow-overlap": true }, paint: { "text-color": "#fff" } });
}

function applyLegs(map: MlMap, course: CourseFile, legs: MapLeg[]) {
  (map.getSource("legs") as GeoJSONSource | undefined)?.setData({
    type: "FeatureCollection",
    features: legs.map((l) => ({ type: "Feature", properties: { color: l.color, title: l.title, sub: l.sub, mile: l.fromM / MI }, geometry: { type: "LineString", coordinates: sliceLine(course, l.fromM, l.toM) } })),
  });
}

function applyDraft(map: MlMap, course: CourseFile, draft: MapDraft | null) {
  const src = (id: string) => map.getSource(id) as GeoJSONSource | undefined;
  src("draft-old")?.setData(draft?.old ? { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: sliceLine(course, draft.old[0], draft.old[1]) } } : EMPTY);
  src("draft-line")?.setData(draft?.line ? { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: draft.line } } : EMPTY);
  src("draft-pts")?.setData({ type: "FeatureCollection", features: (draft?.points ?? []).map((p) => ({ type: "Feature", properties: { label: p.label }, geometry: { type: "Point", coordinates: [p.lon, p.lat] } })) });
}

const MILE_LAYERS = ["miles-dot", "miles-50", "miles-10", "miles-5", "miles-1"];
const TURN_LAYERS = ["turns-hit", "turns-dot"];
function applyShow(map: MlMap, show: { miles: boolean; turns: boolean }) {
  for (const id of MILE_LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", show.miles ? "visible" : "none");
  for (const id of TURN_LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", show.turns ? "visible" : "none");
}

function applyCourse(map: MlMap, course: CourseFile) {
  const src = (id: string) => map.getSource(id) as GeoJSONSource | undefined;
  src("route")?.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: course.coords } });
  src("dirt")?.setData({ type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: course.dirt.map(([a, b]) => sliceLine(course, a, b)) } });
  src("miles")?.setData({
    type: "FeatureCollection",
    // The 50s show on every layer above theirs too: a tier is "this multiple and up".
    features: mileMarkers(course).flatMap((m) => {
      const tiers = m.tier === 50 ? [50, 10, 5, 1] : m.tier === 10 ? [10, 5, 1] : m.tier === 5 ? [5, 1] : [1];
      return tiers.map((tier) => ({ type: "Feature" as const, properties: { mile: m.mile, tier }, geometry: { type: "Point" as const, coordinates: [m.lon, m.lat] } }));
    }),
  });
  src("turns")?.setData({
    type: "FeatureCollection",
    features: course.turns.map((t) => ({ type: "Feature", properties: { name: t.name, mile: t.m / MI }, geometry: { type: "Point", coordinates: [t.lon, t.lat] } })),
  });
}

function applyHighlight(map: MlMap, course: CourseFile, ranges: [number, number][]) {
  (map.getSource("hl") as GeoJSONSource | undefined)?.setData({ type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: ranges.map(([a, b]) => sliceLine(course, a, b)) } });
}

function applyFix(map: MlMap, fix: Fix | null) {
  const src = map.getSource("me") as GeoJSONSource | undefined;
  if (!src) return;
  src.setData(
    fix
      ? {
          type: "FeatureCollection",
          features: [
            { type: "Feature", properties: {}, geometry: circleOf(fix, fix.accuracyM) },
            { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [fix.lon, fix.lat] } },
          ],
        }
      : EMPTY,
  );
}

/** The popup body, built as DOM so nothing from the data is parsed as HTML. */
function popupBody(head: string, text: string, sub: string | null): HTMLElement {
  const el = document.createElement("div");
  const m = document.createElement("span");
  m.className = "m";
  m.textContent = head;
  el.appendChild(m);
  el.appendChild(document.createTextNode(text));
  if (sub) {
    const a = document.createElement("span");
    a.className = "a";
    a.textContent = sub;
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

function geoMessage(code: number): string {
  if (code === 1) return "Location is off for this site · allow it in the browser's settings";
  if (code === 2) return "No fix yet · the phone cannot see where it is";
  if (code === 3) return "No fix yet · still trying";
  return "Location unavailable";
}

const NO_LEGS: MapLeg[] = [];
const NO_HANDOFFS: MapHandoff[] = [];
const SHOW_ALL = { miles: true, turns: true, people: true };

export default function TspMap({ course, focus, highlight, people, onFix, autoLocate = false, onLocating, legs = NO_LEGS, handoffs = NO_HANDOFFS, show: shown = SHOW_ALL, onPick = null, draft = null }: TspMapProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const styleReady = useRef(false);
  const fellBack = useRef(false);
  const latest = useRef({ course, highlight, onFix, onLocating, legs, shown, onPick, draft });
  latest.current = { course, highlight, onFix, onLocating, legs, shown, onPick, draft };
  const [note, setNote] = useState<string | null>(null);

  /** One fresh popup per tap (RouteMap explains why not one re-used). */
  const show = useCallback((lon: number, lat: number, body: HTMLElement) => {
    const map = mapRef.current;
    if (!map) return;
    popupRef.current?.remove();
    popupRef.current = new Popup({ closeButton: false, closeOnClick: true, maxWidth: "260px", offset: 10 }).setLngLat([lon, lat]).setDOMContent(body).addTo(map);
  }, []);

  const needleRef = useRef<SVGGElement | null>(null);
  const turnedRef = useRef(false);
  const [turned, setTurned] = useState(false);

  const watchId = useRef<number | null>(null);
  const fixRef = useRef<Fix | null>(null);
  const geoRef = useRef<Geo>("off");
  const [geo, setGeoState] = useState<Geo>("off");
  const [geoNote, setGeoNote] = useState<string | null>(null);
  const setGeo = useCallback((g: Geo) => {
    geoRef.current = g;
    setGeoState(g);
  }, []);

  const fsRef = useRef<Fs>("off");
  const [fs, setFsState] = useState<Fs>("off");
  const setFs = useCallback((f: Fs) => {
    fsRef.current = f;
    setFsState(f);
  }, []);

  /* Create the map once, framed on the course. */
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const c = latest.current.course;
    const [minLon, minLat, maxLon, maxLat] = c.bbox;
    const map = new MlMap({
      container: el,
      style: STYLE_URL,
      attributionControl: false,
      bounds: [
        [minLon, minLat],
        [maxLon, maxLat],
      ],
      fitBoundsOptions: { padding: { top: 40, bottom: 40, left: 30, right: 30 } },
      maxZoom: 18,
      pitchWithRotate: false,
      touchPitch: false,
      fadeDuration: 0,
    });
    map.addControl(new AttributionControl({ compact: true }), "bottom-left");

    const syncNorth = () => {
      const b = map.getBearing();
      if (needleRef.current) needleRef.current.style.transform = `rotate(${-b}deg)`;
      const off = Math.abs(b) >= 0.5;
      if (off !== turnedRef.current) {
        turnedRef.current = off;
        setTurned(off);
      }
    };
    // From far out the hand-off tags shrink to dots' worth, so twelve of them do not bury the line.
    const syncFar = () => stageRef.current?.classList.toggle("z-far", map.getZoom() < 8.2);
    map.on("zoom", syncFar);
    syncFar();
    map.on("rotate", syncNorth);
    map.on("rotateend", syncNorth);
    map.on("moveend", syncNorth);
    mapRef.current = map;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __tspMap?: MlMap }).__tspMap = map;

    const fallback = () => {
      if (fellBack.current) return;
      fellBack.current = true;
      styleReady.current = false;
      setNote("Basemap unavailable · plain map");
      map.setStyle(FALLBACK_STYLE);
    };
    const styleTimer = setTimeout(() => {
      if (!styleReady.current) fallback();
    }, 8000);

    map.on("style.load", () => {
      styleReady.current = true;
      clearTimeout(styleTimer);
      ensureLayers(map);
      applyCourse(map, latest.current.course);
      applyLegs(map, latest.current.course, latest.current.legs);
      applyHighlight(map, latest.current.course, latest.current.highlight);
      applyDraft(map, latest.current.course, latest.current.draft);
      applyShow(map, latest.current.shown);
      applyFix(map, fixRef.current);
    });
    // FIXING THE ROUTE: every tap is a pick.
    map.on("click", (e) => {
      const pick = latest.current.onPick;
      if (pick) pick(e.lngLat.lng, e.lngLat.lat);
    });
    map.on("click", "legs-line", (e) => {
      if (latest.current.onPick) return;
      const f = e.features?.[0];
      if (!f) return;
      const p = f.properties as { title?: string; sub?: string };
      show(e.lngLat.lng, e.lngLat.lat, popupBody(String(p.title ?? ""), "", String(p.sub ?? "")));
    });
    map.on("error", (e) => {
      if (styleReady.current) return;
      const err = e.error as { status?: number; message?: string } | undefined;
      if (err && (typeof err.status === "number" || /style|fetch|network|load/i.test(err.message ?? ""))) fallback();
    });

    const open = (e: MapLayerMouseEvent) => {
      if (latest.current.onPick) return;
      const f = e.features?.[0];
      if (!f || f.geometry.type !== "Point") return;
      const p = f.properties as { name?: string; mile?: number };
      const [lon, lat] = f.geometry.coordinates as [number, number];
      show(lon, lat, popupBody(`MI ${Number(p.mile ?? 0).toFixed(1)}`, String(p.name ?? ""), null));
    };
    map.on("click", "turns-hit", open);
    map.on("mouseenter", "turns-hit", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "turns-hit", () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("dragstart", () => {
      if (geoRef.current === "follow") setGeo("watch");
    });

    // START, FINISH and the checkpoints. The course runs south-west →
    // north-east, so START hangs right and up, FINISH left and down.
    const markers: Marker[] = [];
    const first = c.coords[0];
    const last = c.coords[c.coords.length - 1];
    if (first) markers.push(new Marker({ element: tag("START", "rt-mk start"), anchor: "top-left", offset: [8, 8] }).setLngLat(first).addTo(map));
    if (last) markers.push(new Marker({ element: tag("FINISH", "rt-mk finish"), anchor: "bottom-right", offset: [-8, -8] }).setLngLat(last).addTo(map));
    c.checkpoints.forEach((cp, i) => {
      const el2 = tag(`CP${i + 1}`, "rt-mk van");
      el2.addEventListener("click", (ev) => {
        ev.stopPropagation();
        show(cp.lon, cp.lat, popupBody(`MI ${(cp.m / MI).toFixed(1)}`, `Checkpoint ${i + 1}: ${cp.name}`, cp.note));
      });
      markers.push(new Marker({ element: el2, anchor: "bottom", offset: [0, -8] }).setLngLat([cp.lon, cp.lat]).addTo(map));
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(el);
    return () => {
      clearTimeout(styleTimer);
      ro.disconnect();
      markers.forEach((m) => m.remove());
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      styleReady.current = false;
    };
  }, [setGeo, show]);

  /* The course changed under the map (a stretch was fixed): redraw the line and what hangs off it. */
  const firstCourse = useRef(course);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady.current || firstCourse.current === course) return;
    firstCourse.current = course;
    applyCourse(map, course);
  }, [course]);

  /* The picked stretches, the plan, the fix being drawn, what is switched on. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady.current) return;
    applyHighlight(map, course, highlight);
  }, [course, highlight]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady.current) return;
    applyLegs(map, course, legs);
  }, [course, legs]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady.current) return;
    applyDraft(map, course, draft);
  }, [course, draft]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady.current) return;
    applyShow(map, shown);
  }, [shown]);
  useEffect(() => {
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = onPick ? "crosshair" : "";
  }, [onPick]);

  /* THE HAND-OFFS: a tag where one shift gives the course to the next. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = handoffs.map((h) => {
      const [lon, lat] = pointAt(course, h.m);
      const el = tag(h.tag, "rt-mk tsp-ho");
      el.setAttribute("role", "button");
      el.tabIndex = 0;
      el.addEventListener("click", (e) => {
        if (latest.current.onPick) return;
        e.stopPropagation();
        show(lon, lat, popupBody(`MI ${(h.m / MI).toFixed(1)}`, h.title, h.sub));
      });
      return new Marker({ element: el, anchor: "top", offset: [0, 8] }).setLngLat([lon, lat]).addTo(map);
    });
    return () => markers.forEach((m) => m.remove());
  }, [handoffs, course, show]);

  /* THE PEOPLE: a tag per teammate sharing, redrawn when the poll moves them. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers = (shown.people ? people : []).map((p) => {
      const el = tag(p.label, `rt-mk tsp-p ${p.kind}${p.stale ? " stale" : ""}`);
      el.setAttribute("role", "button");
      el.tabIndex = 0;
      const openIt = () => show(p.lon, p.lat, popupBody(p.kind === "other" ? "VAN" : p.kind.toUpperCase(), p.label, p.sub));
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        openIt();
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openIt();
        }
      });
      return new Marker({ element: el, anchor: "bottom", offset: [0, -6] }).setLngLat([p.lon, p.lat]).addTo(map);
    });
    return () => markers.forEach((m) => m.remove());
  }, [people, show, shown.people]);

  /* A row was tapped below: fly to the point, or fit the leg. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    if (geoRef.current === "follow") setGeo("watch");
    if (focus.kind === "point") {
      map.flyTo({ center: [focus.lon, focus.lat], zoom: Math.max(map.getZoom(), 13.5), duration: 900, essential: true });
      show(focus.lon, focus.lat, popupBody(`MI ${focus.mile.toFixed(1)}`, focus.label, null));
      return;
    }
    const line = sliceLine(latest.current.course, focus.fromM, focus.toM);
    let minLon = 180;
    let minLat = 90;
    let maxLon = -180;
    let maxLat = -90;
    for (const [lon, lat] of line) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    map.fitBounds(
      [
        [minLon, minLat],
        [maxLon, maxLat],
      ],
      { padding: 56, maxZoom: 15.5, duration: 900, essential: true },
    );
  }, [focus, show, setGeo]);

  /* ─── LOCATE ───────────────────────────────────────────────────────────── */

  const stopWatch = useCallback(() => {
    if (watchId.current !== null && typeof navigator !== "undefined" && "geolocation" in navigator) navigator.geolocation.clearWatch(watchId.current);
    const was = watchId.current !== null;
    watchId.current = null;
    fixRef.current = null;
    const map = mapRef.current;
    if (map && styleReady.current) applyFix(map, null);
    setGeo("off");
    if (was) latest.current.onLocating?.(false);
  }, [setGeo]);

  const startWatch = useCallback(
    (follow: boolean) => {
      if (watchId.current !== null) return;
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) return setGeoNote("No location on this browser");
      if (typeof window !== "undefined" && !window.isSecureContext) return setGeoNote("Location needs https");
      setGeoNote(null);
      setGeo(follow ? "follow" : "watch");
      latest.current.onLocating?.(true);
      let first = true;
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const fix: Fix = { lon: pos.coords.longitude, lat: pos.coords.latitude, accuracyM: Math.max(0, pos.coords.accuracy || 0) };
          fixRef.current = fix;
          setGeoNote(null);
          latest.current.onFix?.(fix);
          const map = mapRef.current;
          if (!map) return;
          if (styleReady.current) {
            ensureLayers(map);
            applyFix(map, fix);
          }
          if (geoRef.current === "follow") map.easeTo({ center: [fix.lon, fix.lat], zoom: first ? Math.max(map.getZoom(), LOCATE_ZOOM) : map.getZoom(), duration: 700, essential: true });
          first = false;
        },
        (err) => {
          setGeoNote(geoMessage(err.code));
          if (err.code === 1) stopWatch();
        },
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
      );
    },
    [setGeo, stopWatch],
  );

  const onRecenter = useCallback(() => {
    setGeo("follow");
    const map = mapRef.current;
    const fix = fixRef.current;
    if (map && fix) map.easeTo({ center: [fix.lon, fix.lat], zoom: Math.max(map.getZoom(), LOCATE_ZOOM), duration: 700, essential: true });
  }, [setGeo]);

  const onLocate = useCallback(() => {
    if (geoRef.current === "off") return startWatch(true);
    setGeoNote(null);
    stopWatch();
  }, [startWatch, stopWatch]);

  /* Sharing from last time: the watch starts with the page; turning sharing on starts it too. */
  useEffect(() => {
    if (autoLocate) startWatch(false);
  }, [autoLocate, startWatch]);
  useEffect(() => () => stopWatch(), [stopWatch]);

  /* ─── FULL SCREEN ──────────────────────────────────────────────────────── */

  const resizeSoon = useCallback(() => {
    requestAnimationFrame(() => mapRef.current?.resize());
    window.setTimeout(() => mapRef.current?.resize(), 400);
  }, []);

  const exitFs = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    document.documentElement.style.overflow = "";
    setFs("off");
    resizeSoon();
  }, [setFs, resizeSoon]);

  const enterFs = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const pin = () => {
      document.documentElement.style.overflow = "hidden";
      setFs("css");
      resizeSoon();
    };
    if (typeof stage.requestFullscreen !== "function") return pin();
    let settled = false;
    stage
      .requestFullscreen()
      .then(() => {
        if (settled) return;
        settled = true;
        setFs("api");
        resizeSoon();
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        pin();
      });
    window.setTimeout(() => {
      if (settled || document.fullscreenElement) return;
      settled = true;
      pin();
    }, 800);
  }, [setFs, resizeSoon]);

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement && fsRef.current !== "off") exitFs();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fsRef.current === "css") exitFs();
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("keydown", onKey);
      if (fsRef.current === "css") document.documentElement.style.overflow = "";
    };
  }, [exitFs]);

  const inFs = fs !== "off";

  return (
    <div ref={stageRef} className={`rt-stage${fs === "css" ? " is-fs" : ""}`}>
      <div ref={elRef} className="map-el" role="region" aria-label="The course on a map" />
      <div className="rt-ctl">
        <button type="button" className={`rt-btn fs${inFs ? " is-on" : ""}`} onClick={() => (fsRef.current === "off" ? enterFs() : exitFs())} aria-pressed={inFs} aria-label={inFs ? "Close full screen" : "Full screen"} title={inFs ? "Close full screen" : "Full screen"}>
          {inFs ? (
            <>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <span>CLOSE</span>
            </>
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <button type="button" className="rt-btn locate" data-state={geo} onClick={onLocate} aria-pressed={geo !== "off"} aria-label={geo === "off" ? "Show my location" : "Stop showing my location"} title={geo === "off" ? "Show my location" : "Stop showing my location"}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="12" cy="12" r="1.8" fill="currentColor" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
        {geo === "watch" && (
          <button type="button" className="rt-btn recenter" onClick={onRecenter} aria-label="Put the map back on my location" title="Put the map back on my location">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M12 3l7 18-7-4-7 4z" fill="currentColor" />
            </svg>
            <span>RECENTER</span>
          </button>
        )}
        <button type="button" className="rt-btn compass" onClick={() => mapRef.current?.resetNorth({ duration: 500 })} hidden={!turned} aria-label="Point the map north" title="Point the map north">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <g ref={needleRef} style={{ transformOrigin: "12px 12px", transformBox: "view-box" }}>
              <path d="M12 2.5 L16 12 L8 12 Z" fill="currentColor" />
              <path d="M12 21.5 L16 12 L8 12 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </g>
          </svg>
        </button>
      </div>
      {(note || geoNote) && (
        <div className="rt-notes">
          {note && <div className="rt-note">{note}</div>}
          {geoNote && (
            <div className="rt-note" role="status">
              {geoNote}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
