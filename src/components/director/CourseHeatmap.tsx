"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DISTANCE_LABELS,
  loadGpx,
  projectToSvg,
  type DistanceKey,
  type GpxTrack,
} from "@/lib/gpx";
import { PHOTO_STATIONS } from "@/lib/directorStats";

/**
 * CourseHeatmap — the flagship director visual.
 *
 * Loads the real Lighthouse GPX, projects it to an SVG, then overlays the
 * locations of every photo as a soft terracotta heat field. Photographer
 * "stations" sit at fixed fractions along the route; photos scatter around
 * them, hugging the course. Hover (or tap) a hotspot to see how many photos
 * were captured there. Light and editorial — a warm glow, not a loud heatmap.
 */

const TABS: DistanceKey[] = ["5k", "10k", "half"];
const W = 640;
const H = 360;

// Representative photo totals per distance (the Half matches the live event).
const PHOTO_TOTAL: Record<DistanceKey, number> = { "5k": 430, "10k": 560, half: 1248 };

// Deterministic PRNG so the scatter is stable across re-renders.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Rough standard-normal from three uniforms (good enough for visual jitter).
function gauss(rng: () => number) {
  return (rng() + rng() + rng() - 1.5) * 0.9;
}

type Dot = { x: number; y: number; r: number; o: number };
type StationView = {
  i: number;
  x: number;
  y: number;
  label: string;
  weight: number;
  count: number;
  mile: number;
};

export function CourseHeatmap() {
  const [tab, setTab] = useState<DistanceKey>("half");
  const [track, setTrack] = useState<GpxTrack | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setActive(null);
    loadGpx(tab).then((t) => {
      if (!cancelled) {
        setTrack(t);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const points = useMemo(() => (track ? projectToSvg(track, W, H, 30) : []), [track]);

  // Lighter route line — downsample so the DOM stays cheap on long courses.
  const routePath = useMemo(() => {
    if (points.length < 2) return "";
    const step = Math.max(1, Math.ceil(points.length / 420));
    const pts: string[] = [];
    for (let i = 0; i < points.length; i += step) pts.push(`${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)}`);
    const last = points[points.length - 1];
    pts.push(`${last.x.toFixed(1)} ${last.y.toFixed(1)}`);
    return "M " + pts.join(" L ");
  }, [points]);

  const totalPhotos = PHOTO_TOTAL[tab];
  const distanceMi = track ? track.distanceM / 1609.34 : 0;

  const stations: StationView[] = useMemo(() => {
    if (points.length < 2) return [];
    const sumW = PHOTO_STATIONS.reduce((s, st) => s + st.weight, 0);
    return PHOTO_STATIONS.map((st, i) => {
      const idx = Math.min(points.length - 1, Math.round(st.at * (points.length - 1)));
      const p = points[idx];
      return {
        i,
        x: p.x,
        y: p.y,
        label: st.label,
        weight: st.weight,
        count: Math.round((totalPhotos * st.weight) / sumW),
        mile: st.at * distanceMi,
      };
    });
  }, [points, totalPhotos, distanceMi]);

  // Scatter representative photo dots around each station, hugging the route.
  const dots: Dot[] = useMemo(() => {
    if (points.length < 2) return [];
    const out: Dot[] = [];
    const rng = mulberry32(tab === "5k" ? 11 : tab === "10k" ? 22 : 33);
    stations.forEach((st) => {
      const shown = Math.min(46, Math.max(6, Math.round(st.count / 8)));
      const window = Math.round(points.length * 0.05);
      const baseIdx = Math.round(st.weight === 0 ? 0 : (st.mile / Math.max(distanceMi, 0.01)) * (points.length - 1));
      for (let k = 0; k < shown; k++) {
        const along = Math.min(
          points.length - 1,
          Math.max(0, baseIdx + Math.round(gauss(rng) * window))
        );
        const bp = points[along];
        const spread = 7 + st.weight * 8;
        out.push({
          x: bp.x + gauss(rng) * spread,
          y: bp.y + gauss(rng) * spread,
          r: 1.3 + rng() * 1.4,
          o: 0.28 + rng() * 0.34,
        });
      }
    });
    return out;
  }, [points, stations, tab, distanceMi]);

  const activeStation = active != null ? stations[active] : null;

  return (
    <div
      className="card"
      style={{ padding: 0, overflow: "hidden", background: "var(--surface)", border: "1px solid var(--line)" }}
    >
      {/* Header */}
      <div
        style={{
          padding: "13px 20px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid var(--line)",
          background: "var(--green-bg)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: ".12em",
          textTransform: "uppercase",
          color: "var(--green)",
        }}
      >
        <span className="live-dot" />
        Lighthouse Half Marathon · Photo coverage
      </div>

      {/* Distance tabs */}
      <div
        role="tablist"
        style={{ display: "grid", gridTemplateColumns: `repeat(${TABS.length}, 1fr)`, borderBottom: "1px solid var(--line)" }}
      >
        {TABS.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            style={{
              padding: "11px 8px",
              background: tab === k ? "var(--cream)" : "transparent",
              border: 0,
              borderRight: k === TABS[TABS.length - 1] ? 0 : "1px solid var(--line)",
              borderBottom: tab === k ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: tab === k ? "var(--ink)" : "var(--muted)",
              cursor: "pointer",
              fontWeight: tab === k ? 500 : 400,
            }}
          >
            {DISTANCE_LABELS[k]}
          </button>
        ))}
      </div>

      {/* Map */}
      <div style={{ position: "relative", background: "var(--cream)" }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${DISTANCE_LABELS[tab]} photo coverage map`} style={{ display: "block" }}>
          <defs>
            <radialGradient id="heatGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--accent-l)" stopOpacity="0.55" />
              <stop offset="45%" stopColor="var(--accent)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </radialGradient>
            <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
          </defs>

          {!loading && track && (
            <>
              {/* Heat field */}
              <g filter="url(#soft)">
                {stations.map((st) => (
                  <circle
                    key={`g-${st.i}`}
                    cx={st.x}
                    cy={st.y}
                    r={34 + st.weight * 44}
                    fill="url(#heatGlow)"
                    opacity={active == null || active === st.i ? 1 : 0.4}
                  />
                ))}
              </g>

              {/* Route line */}
              <path d={routePath} fill="none" stroke="var(--ink-soft)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.5} />

              {/* Individual photo dots */}
              <g>
                {dots.map((d, i) => (
                  <circle key={`d-${i}`} cx={d.x} cy={d.y} r={d.r} fill="var(--accent-d)" opacity={d.o} />
                ))}
              </g>

              {/* Start / finish */}
              {points.length > 0 && (
                <>
                  <circle cx={points[0].x} cy={points[0].y} r={5} fill="var(--ink)" stroke="var(--paper)" strokeWidth={2} />
                  <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={6} fill="var(--accent)" stroke="var(--paper)" strokeWidth={2} />
                </>
              )}

              {/* Station rings + hover targets */}
              {stations.map((st) => (
                <g key={`s-${st.i}`}>
                  <circle
                    cx={st.x}
                    cy={st.y}
                    r={active === st.i ? 8 : 5}
                    fill="var(--paper)"
                    stroke="var(--accent)"
                    strokeWidth={active === st.i ? 2.5 : 1.5}
                    style={{ transition: "r .12s ease, stroke-width .12s ease" }}
                  />
                  <circle
                    cx={st.x}
                    cy={st.y}
                    r={20}
                    fill="transparent"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setActive(st.i)}
                    onMouseLeave={() => setActive((cur) => (cur === st.i ? null : cur))}
                    onClick={() => setActive((cur) => (cur === st.i ? null : st.i))}
                  />
                </g>
              ))}
            </>
          )}
        </svg>

        {/* Hover callout */}
        {activeStation && (
          <div
            style={{
              position: "absolute",
              left: `${(activeStation.x / W) * 100}%`,
              top: `${(activeStation.y / H) * 100}%`,
              transform: "translate(-50%, calc(-100% - 14px))",
              background: "var(--ink)",
              color: "var(--fg-on-dark)",
              borderRadius: 8,
              padding: "8px 12px",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              boxShadow: "var(--shadow-lg)",
              zIndex: 2,
            }}
          >
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 15, fontWeight: 500 }}>{activeStation.label}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.8, marginTop: 2 }}>
              Mile {activeStation.mile.toFixed(1)} · {activeStation.count.toLocaleString()} photos
            </div>
          </div>
        )}

        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            Loading course…
          </div>
        )}
      </div>

      {/* Legend + stats */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          padding: "14px 20px",
          borderTop: "1px solid var(--line)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>
            Fewer
          </span>
          <span
            style={{
              width: 120,
              height: 8,
              borderRadius: 5,
              background: "linear-gradient(90deg, var(--cream), var(--accent-l), var(--accent-d))",
              display: "inline-block",
            }}
          />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>
            More photos
          </span>
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)" }}>
          {totalPhotos.toLocaleString()} photos · {PHOTO_STATIONS.length} hotspots ·{" "}
          <span style={{ color: "var(--accent)" }}>hover a hotspot</span>
        </div>
      </div>
    </div>
  );
}
