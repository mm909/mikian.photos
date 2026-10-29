"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { MI, type CourseFile, type Focus } from "./course";
import { formatAgo, mileMarkers, snapToCourse, type Snap, type VanPin } from "./eta";

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
 * through Camp Pendleton as a dashed ink line ALONG THE ROAD the script
 * routed (owner, 2026-10-16: "make the dotted line follow the route we are
 * driving instead of cutting straight to the point"; straight only when
 * course.json has no coords for it); the turns as small ink dots with a
 * wide invisible hit layer under them (owner: "Make the dots a little
 * easier to tap on while on the phone") that open a paper popup on tap and
 * close on a tap anywhere else; START and FINISH as DOM tags. A tap on a
 * row of the list below hands a `focus` down and the map flies there.
 *
 * The map TURNS but never tilts (owner, 2026-10-16: "Let me rotate it") —
 * two fingers on a phone, right-drag or Ctrl-drag on a laptop.
 *
 * Buttons on the map, top right (owner, 2026-10-16, on his phone):
 *   LOCATE — "Show the user's location on the map":
 *     navigator.geolocation.watchPosition → a lime dot in an ink ring over
 *     an accuracy circle. The map eases to the first fix and FOLLOWS the
 *     fixes after it; a drag by hand stops the following but keeps the dot
 *     (owner, 2026-10-23: "keep it centered unless the user moves it and
 *     give a button to recenter"), and a RECENTER button shows under LOCATE
 *     until a tap puts the map back on the dot and following again. LOCATE
 *     itself only switches the location on and off. Permission denied (or
 *     no https, or no fix) → a small note. Client only — this module never
 *     runs on the server.
 *   FULL SCREEN — "Give a button to full screen the map":
 *     element.requestFullscreen() on the stage where the browser has it
 *     (map.resize() after); where it does not — iPhone Safari — a CSS
 *     fallback pins the stage to the viewport above the bar, and the same
 *     button, now CLOSE, takes it down (Escape too).
 *   NORTH — shows only once the map is turned: a needle that points north
 *     as the map spins, and a tap eases it back to north-up.
 *
 * 2026-10-21 (owner): MILE MARKERS — "they should be subtle": a small grey
 * numeral beside the line at every whole run mile (eta.ts mileMarkers), as
 * a symbol layer so the tiles' own collision keeps them from piling up:
 * every ten miles when the whole course is in view, every five closer in,
 * every mile from street zoom. No dots, no ticks. The VAN — "a 'van
 * location' button … only clickable/visible by team members … take the
 * location of the user who is clicking the button as the van's location":
 * a fourth button, for the team only (`canPin`), asks "Pin the van here?",
 * reads this phone's position once (the LOCATE fix when there is a fresh
 * one) and hands it up (`onPin`); the pin comes back down as `pin` and is
 * drawn as an ink dot with a VAN tag that opens a popup saying who set it,
 * when, and at what mile (the pin snapped to the course, eta.ts). CLEAR
 * takes it down. One pin for the team (owner: "One van pin").
 */

if (typeof window !== "undefined") {
  setWorkerUrl("/track/maplibre-gl-worker.mjs");
}

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const INK = "#111110";
const LIME = "#D0F858";
const GREEN = "#3C7A0B";
const PAPER = "#F4F3EE";
/** The mile numerals: the soft ink, bold (owner, 2026-10-21: "the mile markers are a little hard to see"). */
const INK_SOFT = "#3d3d3a";
/** The basemap's own glyphs, so the mile numerals have a face to set in. */
const GLYPHS_URL = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
const LABEL_FONT = ["Noto Sans Bold"];

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
    { id: "bg", type: "background", paint: { "background-color": PAPER } },
    { id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.85, "raster-opacity": 0.75 } },
  ],
};

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const LINE_LAYOUT = { "line-join": "round", "line-cap": "round" } as const;

/** The map eases in to at least this zoom on the first fix — a street, not a county. */
const LOCATE_ZOOM = 14;

export type RouteMapProps = {
  course: CourseFile;
  focus: Focus | null;
  /** On the team: the VAN button shows. */
  canPin: boolean;
  /** The team's van pin, drawn when there is one. */
  pin: VanPin | null;
  /** Saves this phone's position as the pin; resolves to an error to show, or null. */
  onPin: (fix: Fix) => Promise<string | null>;
  onClearPin: () => Promise<string | null>;
};

type Fix = { lon: number; lat: number; accuracyM: number };
/** off: no watch. watch: the dot is drawn, the map stays put. follow: the map moves with the fixes. */
type Geo = "off" | "watch" | "follow";
/** off: in the page. api: the Fullscreen API. css: the fixed-position fallback. */
type Fs = "off" | "api" | "css";

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

/** A circle of `radiusM` round a fix as a polygon, for the accuracy ring. */
function circleOf(fix: Fix, radiusM: number): GeoJSON.Polygon {
  const steps = 48;
  const kLat = 110540;
  const kLon = 111320 * Math.cos((fix.lat * Math.PI) / 180) || 1;
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ring.push([fix.lon + (radiusM * Math.sin(a)) / kLon, fix.lat + (radiusM * Math.cos(a)) / kLat]);
  }
  return { type: "Polygon", coordinates: [ring] };
}

/** Sources and layers, added once per style (again after a style swap). Order = draw order. */
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
  if (!map.getSource("miles")) {
    map.addSource("miles", { type: "geojson", data: EMPTY });
    // Three layers, one per tier, so the whole-course view says 10, 20, 30…
    // and the street view says every mile. The numeral sits beside the
    // line (a variable anchor, half an em out) in the soft ink, bold, with
    // a paper halo — subtle but legible (owner, 2026-10-21: "they should be
    // subtle", then "the mile markers are a little hard to see"). The
    // basemap's collision drops any that would overlap.
    const tiers: [string, number, number, number][] = [
      ["miles-10", 10, 0, 13],
      ["miles-5", 5, 9, 12.5],
      ["miles-1", 1, 11, 12],
    ];
    for (const [id, tier, minzoom, size] of tiers) {
      map.addLayer({
        id,
        type: "symbol",
        source: "miles",
        minzoom,
        filter: ["==", ["get", "tier"], tier],
        layout: {
          "text-field": ["to-string", ["get", "mile"]],
          "text-font": LABEL_FONT,
          "text-size": size,
          "text-variable-anchor": ["left", "right", "top", "bottom"],
          "text-radial-offset": 0.55,
          "text-justify": "auto",
          "text-allow-overlap": false,
          "text-ignore-placement": false,
        },
        paint: { "text-color": INK_SOFT, "text-halo-color": PAPER, "text-halo-width": 1.8 },
      });
    }
  }
  if (!map.getSource("turns")) {
    map.addSource("turns", { type: "geojson", data: EMPTY });
    // The hit layer first: a wide, fully transparent circle that still answers
    // queryRenderedFeatures, so a thumb lands on the call without covering the
    // map with big dots. ~16 px at a phone's zooms, a touch wider zoomed in.
    map.addLayer({
      id: "turns-hit",
      type: "circle",
      source: "turns",
      paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 14, 14, 18], "circle-opacity": 0, "circle-stroke-width": 0 },
    });
    map.addLayer({
      id: "turns-dot",
      type: "circle",
      source: "turns",
      paint: { "circle-radius": 4, "circle-color": INK, "circle-stroke-color": PAPER, "circle-stroke-width": 1.5 },
    });
  }
  if (!map.getSource("me")) {
    map.addSource("me", { type: "geojson", data: EMPTY });
    map.addLayer({ id: "me-acc", type: "fill", source: "me", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": LIME, "fill-opacity": 0.18, "fill-outline-color": GREEN } });
    map.addLayer({
      id: "me-dot",
      type: "circle",
      source: "me",
      filter: ["==", ["geometry-type"], "Point"],
      paint: { "circle-radius": 7, "circle-color": LIME, "circle-stroke-color": INK, "circle-stroke-width": 2.5 },
    });
  }
  if (!map.getSource("van")) {
    map.addSource("van", { type: "geojson", data: EMPTY });
    // The van's spot: an ink dot in a lime ring, under its VAN tag (a DOM marker).
    map.addLayer({
      id: "van-dot",
      type: "circle",
      source: "van",
      paint: { "circle-radius": 6, "circle-color": INK, "circle-stroke-color": LIME, "circle-stroke-width": 3 },
    });
  }
}

function applyData(map: MlMap, course: CourseFile) {
  const src = (id: string) => map.getSource(id) as GeoJSONSource | undefined;
  src("route")?.setData({ type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: legsOf(course) } });
  src("miles")?.setData({
    type: "FeatureCollection",
    features: mileMarkers(course).map((m) => ({ type: "Feature", properties: { mile: m.mile, tier: m.tier }, geometry: { type: "Point", coordinates: [m.lon, m.lat] } })),
  });
  src("drive")?.setData({
    type: "FeatureCollection",
    features: course.drives.map((d) => ({
      type: "Feature",
      properties: { mile: d.mile, routed_by: d.routed_by ?? "" },
      // The road where the script routed it; pickup → restart straight when it could not.
      geometry: { type: "LineString", coordinates: d.coords && d.coords.length >= 2 ? d.coords : [d.from, d.to] },
    })),
  });
  src("turns")?.setData({
    type: "FeatureCollection",
    features: course.turns
      .filter((t) => t.kind !== "start" && t.kind !== "finish")
      .map((t) => ({ type: "Feature", properties: { name: t.name, mile: t.mile, note: t.note ?? "" }, geometry: { type: "Point", coordinates: [t.lon, t.lat] } })),
  });
}

function applyFix(map: MlMap, fix: Fix | null) {
  const src = map.getSource("me") as GeoJSONSource | undefined;
  if (!src) return;
  if (!fix) {
    src.setData(EMPTY);
    return;
  }
  src.setData({
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: {}, geometry: circleOf(fix, fix.accuracyM) },
      { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [fix.lon, fix.lat] } },
    ],
  });
}

function applyVan(map: MlMap, pin: VanPin | null) {
  const src = map.getSource("van") as GeoJSONSource | undefined;
  if (!src) return;
  src.setData(pin ? { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [pin.lon, pin.lat] } } : EMPTY);
}

/** "mi 42.3", "on I-5 through Camp Pendleton", or "0.8 mi off the course". */
function whereIs(snap: Snap, course: CourseFile): string {
  if (snap.onDrive) return "on I-5 through Camp Pendleton";
  if (snap.offM > MI) return `${(snap.offM / MI).toFixed(1)} mi off the course`;
  const mile = snap.routeM / MI;
  return `mi ${mile.toFixed(1)}${snap.afterDrives > 0 && Math.abs(mile - (course.drives[0]?.mile ?? -1)) < 0.3 ? " · past the restart" : ""}`;
}

/** The van's popup: where it is, who set it, how long ago. */
function vanBody(pin: VanPin, snap: Snap, course: CourseFile): HTMLElement {
  const el = document.createElement("div");
  const m = document.createElement("span");
  m.className = "m";
  m.textContent = "VAN";
  el.appendChild(m);
  el.appendChild(document.createTextNode(whereIs(snap, course)));
  const a = document.createElement("span");
  a.className = "a";
  a.textContent = `${pin.byName ? `set by ${pin.byName} · ` : ""}${formatAgo(new Date(pin.at), new Date())}`;
  el.appendChild(a);
  return el;
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

/** What the location note says for a geolocation error. */
function geoMessage(code: number): string {
  if (code === 1) return "Location is off for this site · allow it in the browser's settings";
  if (code === 2) return "No fix yet · the phone cannot see where it is";
  if (code === 3) return "No fix yet · still trying";
  return "Location unavailable";
}

export default function RouteMap({ course, focus, canPin, pin, onPin, onClearPin }: RouteMapProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const styleReady = useRef(false);
  const fellBack = useRef(false);
  const latest = useRef({ course, pin });
  latest.current = { course, pin };
  const [note, setNote] = useState<string | null>(null);

  /* THE VAN: the pin snapped to the course, the ask before a tap pins, and
   * the one-line answer after. */
  const pinSnap = useMemo(() => (pin ? snapToCourse(course, pin.lat, pin.lon) : null), [course, pin]);
  const [ask, setAsk] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [vanNote, setVanNote] = useState<string | null>(null);
  const vanNoteTimer = useRef<number | null>(null);

  /**
   * One FRESH popup per tap, the last one removed by hand. Not one popup
   * re-used: MapLibre snapshots a map event's listeners before it runs them,
   * so a tap on a second dot while the first popup is open would re-add the
   * same popup and then run its own, already-snapshotted close-on-click and
   * take it straight down again. A new popup's listener is not in that
   * snapshot, so it stays; the old one's close finds nothing to remove.
   */
  const show = useCallback((lon: number, lat: number, body: HTMLElement) => {
    const map = mapRef.current;
    if (!map) return;
    popupRef.current?.remove();
    popupRef.current = new Popup({ closeButton: false, closeOnClick: true, maxWidth: "260px", offset: 10 }).setLngLat([lon, lat]).setDOMContent(body).addTo(map);
  }, []);

  /* NORTH: the compass needle (turned straight from the map's rotate events,
   * no re-render per frame) and whether the map is off north at all — the
   * button only shows while it is. */
  const needleRef = useRef<SVGGElement | null>(null);
  const turnedRef = useRef(false);
  const [turned, setTurned] = useState(false);

  /* LOCATE: the watch, the latest fix, and whether the map follows it. */
  const watchId = useRef<number | null>(null);
  const fixRef = useRef<Fix | null>(null);
  const geoRef = useRef<Geo>("off");
  const [geo, setGeoState] = useState<Geo>("off");
  const [geoNote, setGeoNote] = useState<string | null>(null);
  const setGeo = useCallback((g: Geo) => {
    geoRef.current = g;
    setGeoState(g);
  }, []);

  /* FULL SCREEN: which way it went, so CLOSE undoes the same thing. */
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
      // The map TURNS (owner, 2026-10-16: "Let me rotate it") — two fingers
      // on a phone, a right-drag or Ctrl-drag on a laptop, Shift+arrows on a
      // keyboard. It never TILTS: the line stays flat and the calls stay
      // readable (pitchWithRotate / touchPitch off).
      pitchWithRotate: false,
      touchPitch: false,
      fadeDuration: 0,
    });
    map.addControl(new AttributionControl({ compact: true }), "bottom-left");

    // The compass follows every turn, the button shows only while the map
    // is off north (a hair under half a degree counts as north).
    const syncNorth = () => {
      const b = map.getBearing();
      if (needleRef.current) needleRef.current.style.transform = `rotate(${-b}deg)`;
      const off = Math.abs(b) >= 0.5;
      if (off !== turnedRef.current) {
        turnedRef.current = off;
        setTurned(off);
      }
    };
    map.on("rotate", syncNorth);
    map.on("rotateend", syncNorth);
    map.on("moveend", syncNorth);
    mapRef.current = map;
    // On a laptop the map is reachable from the console for a look at its layers.
    if (process.env.NODE_ENV !== "production") (window as unknown as { __rtMap?: MlMap }).__rtMap = map;

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
      applyData(map, latest.current.course);
      applyFix(map, fixRef.current);
      applyVan(map, latest.current.pin);
    });
    map.on("error", (e) => {
      if (styleReady.current) return;
      const err = e.error as { status?: number; message?: string } | undefined;
      if (err && (typeof err.status === "number" || /style|fetch|network|load/i.test(err.message ?? ""))) fallback();
    });

    // Tap a dot (or the wide ring round it): the paper popup with the call
    // and its mile. The popup closes itself on the next tap on the map.
    // Hover: a pointer, so a laptop knows they are live.
    const open = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== "Point") return;
      const p = f.properties as { name?: string; mile?: number; note?: string };
      const [lon, lat] = f.geometry.coordinates as [number, number];
      show(lon, lat, popupBody(String(p.name ?? ""), Number(p.mile ?? 0), p.note ? String(p.note) : null));
    };
    map.on("click", "turns-hit", open);
    map.on("mouseenter", "turns-hit", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "turns-hit", () => {
      map.getCanvas().style.cursor = "";
    });

    // A drag by hand while following: the dot stays, the map stops chasing it.
    map.on("dragstart", () => {
      if (geoRef.current === "follow") setGeo("watch");
    });

    // START and FINISH tags.
    const markers: Marker[] = [];
    const c = latest.current.course;
    const start = c.turns.find((t) => t.kind === "start");
    const finish = c.turns.find((t) => t.kind === "finish");
    const first = c.coords[0];
    const last = c.coords[c.coords.length - 1];
    // The course runs north-west → south-east, so START sits at the top-left
    // of the fitted bounds and FINISH at the bottom-right: each tag hangs
    // INWARD (START to the right, FINISH to the left) or a phone clips it at
    // the map's edge (seen on a 375 px viewport: "FI…").
    if (first) markers.push(new Marker({ element: tag("START", "rt-mk start"), anchor: "bottom-left", offset: [8, -8] }).setLngLat(start ? [start.lon, start.lat] : first).addTo(map));
    if (last) markers.push(new Marker({ element: tag("FINISH", "rt-mk finish"), anchor: "top-right", offset: [-8, 8] }).setLngLat(finish ? [finish.lon, finish.lat] : last).addTo(map));

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

  /* The data. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady.current) return;
    ensureLayers(map);
    applyData(map, course);
  }, [course]);

  /* THE VAN on the map: the dot in its layer and a VAN tag over it that
   * opens the popup. Redrawn whenever the pin moves (another phone's tap
   * arrives through the poll). */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (styleReady.current) applyVan(map, pin);
    if (!pin || !pinSnap) return;
    const el = tag("VAN", "rt-mk van");
    el.setAttribute("role", "button");
    el.tabIndex = 0;
    const openIt = () => show(pin.lon, pin.lat, vanBody(pin, pinSnap, latest.current.course));
    // The tag sits inside the map's canvas container, so its click would
    // bubble up as a map click and the popup's close-on-click (registered
    // during this same click) would take the popup straight down again.
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
    const marker = new Marker({ element: el, anchor: "bottom", offset: [0, -10] }).setLngLat([pin.lon, pin.lat]).addTo(map);
    return () => {
      marker.remove();
    };
  }, [pin, pinSnap, show]);

  /* A row was tapped below: fly there and say what it is. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    // A row tap is navigation, like a drag: while LOCATE is following, the
    // next fix would ease the map straight back to the dot and undo the
    // tap (review, 2026-10-16). Drop to "watch" — the dot stays, the button
    // re-follows on tap.
    if (geoRef.current === "follow") setGeo("watch");
    map.flyTo({ center: [focus.lon, focus.lat], zoom: Math.max(map.getZoom(), 13.5), duration: 900, essential: true });
    show(focus.lon, focus.lat, popupBody(focus.name, focus.mile, null));
  }, [focus, show, setGeo]);

  /* ─── LOCATE ───────────────────────────────────────────────────────────── */

  const stopWatch = useCallback(() => {
    if (watchId.current !== null && typeof navigator !== "undefined" && "geolocation" in navigator) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    fixRef.current = null;
    const map = mapRef.current;
    if (map && styleReady.current) applyFix(map, null);
    setGeo("off");
  }, [setGeo]);

  const startWatch = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoNote("No location on this browser");
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setGeoNote("Location needs https");
      return;
    }
    setGeoNote(null);
    setGeo("follow");
    let first = true;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const fix: Fix = { lon: pos.coords.longitude, lat: pos.coords.latitude, accuracyM: Math.max(0, pos.coords.accuracy || 0) };
        fixRef.current = fix;
        setGeoNote(null);
        const map = mapRef.current;
        if (!map) return;
        if (styleReady.current) {
          ensureLayers(map);
          applyFix(map, fix);
        }
        if (geoRef.current === "follow") {
          // The first fix pulls the map in to a street; after that it only pans.
          map.easeTo({ center: [fix.lon, fix.lat], zoom: first ? Math.max(map.getZoom(), LOCATE_ZOOM) : map.getZoom(), duration: 700, essential: true });
        }
        first = false;
      },
      (err) => {
        setGeoNote(geoMessage(err.code));
        // Denied is final: the watch is dead, so the button goes back to off.
        if (err.code === 1) stopWatch();
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
  }, [setGeo, stopWatch]);

  /** Back to following: ease to the last fix now rather than wait for the next. */
  const onRecenter = useCallback(() => {
    setGeo("follow");
    const map = mapRef.current;
    const fix = fixRef.current;
    if (map && fix) map.easeTo({ center: [fix.lon, fix.lat], zoom: Math.max(map.getZoom(), LOCATE_ZOOM), duration: 700, essential: true });
  }, [setGeo]);

  /** On / off. Getting back on the dot is RECENTER's job. */
  const onLocate = useCallback(() => {
    if (geoRef.current === "off") {
      startWatch();
      return;
    }
    // Switched off by hand: a "still trying" note goes with it (a denial's
    // note comes through the error path and stays).
    setGeoNote(null);
    stopWatch();
  }, [startWatch, stopWatch]);

  /* The watch dies with the map. */
  useEffect(() => () => stopWatch(), [stopWatch]);

  /* ─── THE VAN BUTTON ───────────────────────────────────────────────────── */

  const sayVan = useCallback((msg: string | null, holdMs = 6000) => {
    if (vanNoteTimer.current) window.clearTimeout(vanNoteTimer.current);
    setVanNote(msg);
    if (msg) vanNoteTimer.current = window.setTimeout(() => setVanNote(null), holdMs);
  }, []);
  useEffect(
    () => () => {
      if (vanNoteTimer.current) window.clearTimeout(vanNoteTimer.current);
    },
    [],
  );

  /** This phone's position: the LOCATE fix when the watch is live, a fresh one otherwise. */
  const myFix = useCallback((): Promise<Fix> => {
    if (geoRef.current !== "off" && fixRef.current) return Promise.resolve(fixRef.current);
    return new Promise<Fix>((resolve, reject) => {
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) return reject(new Error("No location on this browser"));
      if (typeof window !== "undefined" && !window.isSecureContext) return reject(new Error("Location needs https"));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lon: pos.coords.longitude, lat: pos.coords.latitude, accuracyM: Math.max(0, pos.coords.accuracy || 0) }),
        (err) => reject(new Error(geoMessage(err.code))),
        { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
      );
    });
  }, []);

  const doPin = useCallback(async () => {
    if (pinning) return;
    setPinning(true);
    sayVan("Finding this phone…", 20_000);
    try {
      const fix = await myFix();
      const err = await onPin(fix);
      if (err) sayVan(err);
      else {
        const s = snapToCourse(latest.current.course, fix.lat, fix.lon);
        sayVan(`Van pinned · ${whereIs(s, latest.current.course)}`);
        setAsk(false);
        mapRef.current?.easeTo({ center: [fix.lon, fix.lat], zoom: Math.max(mapRef.current.getZoom(), 13), duration: 700, essential: true });
      }
    } catch (e) {
      sayVan(e instanceof Error ? e.message : "Could not find this phone");
    }
    setPinning(false);
  }, [pinning, myFix, onPin, sayVan]);

  const doClear = useCallback(async () => {
    if (pinning) return;
    setPinning(true);
    const err = await onClearPin();
    sayVan(err ?? "Van pin cleared");
    if (!err) setAsk(false);
    setPinning(false);
  }, [pinning, onClearPin, sayVan]);

  /* ─── FULL SCREEN ──────────────────────────────────────────────────────── */

  const resizeSoon = useCallback(() => {
    // After the box changes: next frame, when the layout has settled, and
    // once more a beat later — a browser that is slow to paint (an embedded
    // pane, a phone mid-transition) left the canvas at the old size.
    requestAnimationFrame(() => mapRef.current?.resize());
    window.setTimeout(() => mapRef.current?.resize(), 400);
  }, []);

  const exitFs = useCallback(() => {
    // Both ways out, whatever got us in: a request that settled late may
    // have put the browser into fullscreen on top of the CSS pin.
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    document.documentElement.style.overflow = "";
    setFs("off");
    resizeSoon();
  }, [setFs, resizeSoon]);

  const enterFs = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    // The CSS way: pin the stage to the viewport (iPhone Safari has no
    // requestFullscreen on a div; other browsers fall back to it too).
    const pin = () => {
      document.documentElement.style.overflow = "hidden";
      setFs("css");
      resizeSoon();
    };
    if (typeof stage.requestFullscreen !== "function") {
      pin();
      return;
    }
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
        // Refused (a permission policy, an iframe): the CSS way instead.
        if (settled) return;
        settled = true;
        pin();
      });
    // A request that never settles (seen in an embedded browser pane,
    // 2026-10-16; some webviews do the same): after a beat, the CSS way.
    window.setTimeout(() => {
      if (settled || document.fullscreenElement) return;
      settled = true;
      pin();
    }, 800);
  }, [setFs, resizeSoon]);

  const onFullScreen = useCallback(() => {
    if (fsRef.current === "off") enterFs();
    else exitFs();
  }, [enterFs, exitFs]);

  /* The browser's own exit (Escape, the system gesture) and the keyboard's for the fallback. */
  useEffect(() => {
    const onChange = () => {
      // The browser left full screen (Escape, the system gesture): unwind
      // whatever state we were in — a request that settled late can have
      // put the browser into full screen on top of the CSS pin.
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
      // Unmounting mid-fallback must not leave the page unscrollable.
      if (fsRef.current === "css") document.documentElement.style.overflow = "";
    };
  }, [setFs, resizeSoon, exitFs]);

  /* NORTH: the compass button puts the map back the right way up. */
  const onNorth = useCallback(() => {
    mapRef.current?.resetNorth({ duration: 500 });
  }, []);

  const inFs = fs !== "off";

  return (
    <div ref={stageRef} className={`rt-stage${fs === "css" ? " is-fs" : ""}`}>
      <div ref={elRef} className="map-el" role="region" aria-label="The course on a map" />
      <div className="rt-ctl">
        <button
          type="button"
          className={`rt-btn fs${inFs ? " is-on" : ""}`}
          onClick={onFullScreen}
          aria-pressed={inFs}
          aria-label={inFs ? "Close full screen" : "Full screen"}
          title={inFs ? "Close full screen" : "Full screen"}
        >
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
        <button
          type="button"
          className="rt-btn locate"
          data-state={geo}
          onClick={onLocate}
          aria-pressed={geo !== "off"}
          aria-label={geo === "off" ? "Show my location" : "Stop showing my location"}
          title={geo === "off" ? "Show my location" : "Stop showing my location"}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="12" cy="12" r="1.8" fill="currentColor" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
        {/* RECENTER (owner, 2026-10-23): only once the map has been moved
         * off the dot while the location is on. Ink with the lime arrow, a
         * word beside it, like CLOSE. */}
        {geo === "watch" && (
          <button type="button" className="rt-btn recenter" onClick={onRecenter} aria-label="Put the map back on my location" title="Put the map back on my location">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M12 3l7 18-7-4-7 4z" fill="currentColor" />
            </svg>
            <span>RECENTER</span>
          </button>
        )}
        {/* THE VAN (owner, 2026-10-21): team only. Ink with the lime van
         * once a pin is down. */}
        {canPin && (
          <button
            type="button"
            className="rt-btn van"
            data-state={pin ? "set" : "none"}
            onClick={() => setAsk((v) => !v)}
            aria-expanded={ask}
            aria-label={pin ? "The van: move or clear its pin" : "Pin the van here"}
            title={pin ? "The van: move or clear its pin" : "Pin the van here"}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M3 7h11l4 4h3v6h-2M3 7v10h2M9 17h6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
              <circle cx="7" cy="17.5" r="2" fill="none" stroke="currentColor" strokeWidth="2.2" />
              <circle cx="17" cy="17.5" r="2" fill="none" stroke="currentColor" strokeWidth="2.2" />
            </svg>
          </button>
        )}
        {/* Always rendered (so the needle's ref is there to turn), hidden
         * while the map points north. */}
        <button
          type="button"
          className="rt-btn compass"
          onClick={onNorth}
          hidden={!turned}
          aria-label="Point the map north"
          title="Point the map north"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <g ref={needleRef} style={{ transformOrigin: "12px 12px", transformBox: "view-box" }}>
              <path d="M12 2.5 L16 12 L8 12 Z" fill="currentColor" />
              <path d="M12 21.5 L16 12 L8 12 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </g>
          </svg>
        </button>
      </div>
      {(note || geoNote || vanNote || (ask && canPin)) && (
        <div className="rt-notes">
          {ask && canPin && (
            <div className="rt-ask" role="dialog" aria-label="Pin the van">
              <div className="q">{pin ? "Move the van to this phone?" : "Pin the van at this phone?"}</div>
              <div className="acts">
                <button type="button" className="rt-mini fill" onClick={() => void doPin()} disabled={pinning}>
                  {pinning ? "Pinning…" : pin ? "Move it here" : "Pin it here"}
                </button>
                {pin && (
                  <button type="button" className="rt-mini" onClick={() => void doClear()} disabled={pinning}>
                    Clear
                  </button>
                )}
                <button type="button" className="rt-mini" onClick={() => setAsk(false)} disabled={pinning}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {note && <div className="rt-note">{note}</div>}
          {geoNote && (
            <div className="rt-note" role="status">
              {geoNote}
            </div>
          )}
          {vanNote && (
            <div className="rt-note" role="status">
              {vanNote}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
