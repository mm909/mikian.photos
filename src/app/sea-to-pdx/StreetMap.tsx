"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type * as Leaflet from "leaflet";

/* THE STREET MAP — the route on real streets, for the reader who wants to
 * know which side of the river, which trail, which corner. The strip
 * chart above it is a sketch; this is the one to zoom into.
 *
 * It can show the whole line or one leg at a time: the bar steps through
 * the legs, and any link on the page marked data-leg="7" (the leg list
 * has one per row) brings the map into view on that leg.
 *
 * Nothing loads until the map is nearly on screen or a leg is asked for:
 * Leaflet, the tiles and the line (public/sea-to-pdx/line.json, written by
 * scripts/food-relays/build-courses.mjs with the index where each town
 * sits) are a few hundred kilobytes the top of the page does not need.
 *
 * Leaflet touches window when it is imported, so it is imported inside
 * the effect (the repo's habit: src/components/relay/RelayMap.tsx). The
 * tiles are OpenStreetMap's own, the keyless fallback the lasd26 and
 * tracker maps already name: the CARTO Voyager tiles RelayMap uses answer
 * every request with an "API KEY REQUIRED" placard now (seen 2026-11-10,
 * the same 2 KB image for any tile from any site). look.ts turns the
 * colour down so the route is the loudest thing on them. The wheel zooms only after a
 * click on the map, and on a touch screen one finger scrolls the page and
 * two move the map: a map this tall in the middle of a page should not
 * trap the scroll. */

type Town = { n: number; name: string; place: string; mi: number; legMi: number; lat: number; lon: number; i: number };
type Data = { line: [number, number][]; stops: Town[] };

const EMERALD = "#0b7a53";
const ROSE = "#b4245d";
const PAPER = "#fffdf8";
const INK = "#1c1a17";

export function StreetMap({ src }: { src: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const legLineRef = useRef<Leaflet.Polyline | null>(null);
  const [want, setWant] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  /* 0 is the whole line; k is the leg from town k to town k + 1. */
  const [leg, setLeg] = useState(0);

  /* Wake up when the map nears the screen, or when a leg link is used. */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[data-leg]");
      if (!a) return;
      e.preventDefault();
      setWant(true);
      setLeg(Number(a.getAttribute("data-leg")) || 0);
      boxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    document.addEventListener("click", onClick);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((en) => en.isIntersecting)) {
          setWant(true);
          io.disconnect();
        }
      },
      { rootMargin: "700px 0px" }
    );
    if (boxRef.current) io.observe(boxRef.current);
    return () => {
      document.removeEventListener("click", onClick);
      io.disconnect();
    };
  }, []);

  /* Build the map once. */
  useEffect(() => {
    if (!want || mapRef.current) return;
    let cancelled = false;
    void (async () => {
      try {
        const [L, res] = await Promise.all([import("leaflet"), fetch(src)]);
        if (!res.ok) throw new Error(String(res.status));
        const d = (await res.json()) as Data;
        if (cancelled || !holderRef.current || mapRef.current) return;
        const touch = window.matchMedia("(pointer: coarse)").matches;
        const map = L.map(holderRef.current, { scrollWheelZoom: false, dragging: !touch, zoomSnap: 0.25 });
        map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
        L.polyline(d.line, { color: PAPER, weight: 9, opacity: 0.95, interactive: false }).addTo(map);
        L.polyline(d.line, { color: EMERALD, weight: 4.5, interactive: false }).addTo(map);
        legLineRef.current = L.polyline([], { color: ROSE, weight: 6.5, interactive: false }).addTo(map);
        const lastN = d.stops.length;
        for (const s of d.stops) {
          const end = s.n === 1 || s.n === lastN;
          L.circleMarker([s.lat, s.lon], {
            radius: end ? 9 : 6,
            color: INK,
            weight: 2.5,
            fillColor: s.n === 1 ? EMERALD : s.n === lastN ? "#ff9eb8" : PAPER,
            fillOpacity: 1,
          })
            .bindTooltip(`${s.name} · mile ${s.mi.toFixed(1)}`, { direction: "top", offset: [0, -6] })
            /* A town opens the leg that leaves it; the finish, the leg that reaches it. */
            .on("click", () => setLeg(Math.min(s.n, lastN - 1)))
            .addTo(map);
        }
        map.on("click", () => map.scrollWheelZoom.enable());
        map.fitBounds(L.latLngBounds(d.line), { padding: [18, 18] });
        leafletRef.current = L;
        mapRef.current = map;
        setData(d);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [want, src]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
    },
    []
  );

  /* Show one leg, or the whole line. */
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    const hi = legLineRef.current;
    if (!map || !L || !hi || !data) return;
    if (leg < 1 || leg >= data.stops.length) {
      hi.setLatLngs([]);
      map.fitBounds(L.latLngBounds(data.line), { padding: [18, 18] });
      return;
    }
    const piece = data.line.slice(data.stops[leg - 1].i, data.stops[leg].i + 1);
    hi.setLatLngs(piece);
    map.fitBounds(L.latLngBounds(piece), { padding: [40, 40] });
  }, [leg, data]);

  const legs = data ? data.stops.length - 1 : 0;
  const from = data && leg >= 1 && leg <= legs ? data.stops[leg - 1] : null;
  const to = data && from ? data.stops[leg] : null;
  const total = data ? data.stops[data.stops.length - 1].mi : 0;

  return (
    <div className="sp-street" id="street" ref={boxRef}>
      <div className="sp-street-bar">
        <div className="what" aria-live="polite">
          {from && to ? (
            <>
              Leg {leg} · {from.name} to {to.name}
              <small>
                {to.legMi.toFixed(1)} miles · mile {from.mi.toFixed(1)} to {to.mi.toFixed(1)} · hand off at {to.place}
              </small>
            </>
          ) : (
            <>
              The whole line
              <small>{data ? `${total.toFixed(1)} miles · ${legs} legs · pick a town or step through` : "Seattle to Portland"}</small>
            </>
          )}
        </div>
        <button type="button" disabled={!data || leg <= 1} onClick={() => setLeg((k) => Math.max(1, k - 1))}>
          ← Back
        </button>
        <button type="button" disabled={!data || leg >= legs} onClick={() => setLeg((k) => Math.min(legs, k + 1))}>
          {leg === 0 ? "Leg 1 →" : "Next →"}
        </button>
        <button type="button" className={leg === 0 ? "on" : undefined} disabled={!data} onClick={() => setLeg(0)}>
          Whole route
        </button>
      </div>
      <div className="sp-street-map">
        <div ref={holderRef} style={{ position: "absolute", inset: 0 }} />
        {!data && <div className="wait">{failed ? "The map did not load. The GPX has the whole line." : "Loading the map"}</div>}
      </div>
    </div>
  );
}
