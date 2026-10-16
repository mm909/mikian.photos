"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
 * through Camp Pendleton as a dashed ink line ALONG THE ROAD the script
 * routed (owner, 2026-10-16: "make the dotted line follow the route we are
 * driving instead of cutting straight to the point"; straight only when
 * course.json has no coords for it); the turns as small ink dots with a
 * wide invisible hit layer under them (owner: "Make the dots a little
 * easier to tap on while on the phone") that open a paper popup on tap and
 * close on a tap anywhere else; START and FINISH as DOM tags. A tap on a
 * row of the list below hands a `focus` down and the map flies there.
 *
 * Two buttons sit on the map, top right (owner, 2026-10-16, on his phone):
 *   LOCATE — "Show the user's location on the map":
 *     navigator.geolocation.watchPosition → a lime dot in an ink ring over
 *     an accuracy circle. The map eases to the first fix and FOLLOWS the
 *     fixes after it; a drag by hand stops the following but keeps the dot;
 *     the button then re-follows, and from following it switches the whole
 *     thing off. Permission denied (or no https, or no fix) → a small note.
 *     Client only — this module never runs on the server.
 *   FULL SCREEN — "Give a button to full screen the map":
 *     element.requestFullscreen() on the stage where the browser has it
 *     (map.resize() after); where it does not — iPhone Safari — a CSS
 *     fallback pins the stage to the viewport above the bar, and the same
 *     button, now CLOSE, takes it down (Escape too).
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

/** The map eases in to at least this zoom on the first fix — a street, not a county. */
const LOCATE_ZOOM = 14;

export type RouteMapProps = {
  course: CourseFile;
  focus: Focus | null;
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
}

function applyData(map: MlMap, course: CourseFile) {
  const src = (id: string) => map.getSource(id) as GeoJSONSource | undefined;
  src("route")?.setData({ type: "Feature", properties: {}, geometry: { type: "MultiLineString", coordinates: legsOf(course) } });
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

export default function RouteMap({ course, focus }: RouteMapProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const styleReady = useRef(false);
  const fellBack = useRef(false);
  const latest = useRef({ course });
  latest.current = { course };
  const [note, setNote] = useState<string | null>(null);

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
      applyData(map, latest.current.course);
      applyFix(map, fixRef.current);
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

  const onLocate = useCallback(() => {
    const g = geoRef.current;
    if (g === "off") {
      startWatch();
      return;
    }
    if (g === "watch") {
      // Back to following: ease to the last fix now rather than wait for the next.
      setGeo("follow");
      const map = mapRef.current;
      const fix = fixRef.current;
      if (map && fix) map.easeTo({ center: [fix.lon, fix.lat], zoom: Math.max(map.getZoom(), LOCATE_ZOOM), duration: 700, essential: true });
      return;
    }
    // Switched off by hand: a "still trying" note goes with it (a denial's
    // note comes through the error path and stays).
    setGeoNote(null);
    stopWatch();
  }, [startWatch, stopWatch, setGeo]);

  /* The watch dies with the map. */
  useEffect(() => () => stopWatch(), [stopWatch]);

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
          aria-pressed={geo === "follow"}
          aria-label={geo === "off" ? "Show my location" : geo === "watch" ? "Follow my location" : "Stop showing my location"}
          title={geo === "off" ? "Show my location" : geo === "watch" ? "Follow my location" : "Stop showing my location"}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="12" cy="12" r="1.8" fill="currentColor" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
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
