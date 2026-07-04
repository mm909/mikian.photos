"use client";

import { useMemo, useRef } from "react";
import type { RelayWaypointDto } from "@/lib/relay";
import { fmtMiles, fmtFeet } from "./format";

/**
 * Elevation profile of the crossing, drawn in pure SVG and HOVER-SYNCED with
 * the stats map (both directions):
 *
 *  - mousemove over the chart → nearest profile point → `onHover` reports a
 *    {lat,lng,alongM} sync point; the map shows a dot there.
 *  - hovering the planned line on the map sets the same shared `sync` state in
 *    RelayStats; this chart renders a vertical line + dot at sync.alongM.
 *
 * The profile itself (concatenated planned — or completed as a fallback —
 * segments, cumulative haversine distance vs elevation, decimated to <= 800
 * points) is built once in RelayStats and passed in, so the chart and the map
 * snap against the exact same series.
 *
 * The team's CURRENT position (snapped to the profile → alongM) is marked with
 * an accent line + "NOW" dot so you can see how much climb is left; the footer
 * shows the remaining climb (sum of positive elevation deltas past that point).
 *
 * Guards: < 2 profile points renders a flat baseline + note; zero-span
 * elevation/distance domains are clamped to 1 so nothing divides by zero;
 * mousemove is rAF-throttled.
 */

export type ProfilePoint = { lat: number; lng: number; ele: number; alongM: number };
export type SyncPoint = { lat: number; lng: number; alongM: number };

const R_EARTH = 6371000;
function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(x));
}

const ACCENT = "#e8613c";
const CREAM = "#f5f2ec";
const MUTED = "#9a9186";
const BG = "#14120f";

// SVG canvas (viewBox units). Scaled to 100% width by CSS; width:100% +
// height:auto keeps the rendered aspect identical to the viewBox, so the
// mouse-x → viewBox-x mapping below is a plain linear scale.
const VB_W = 900;
const VB_H = 320;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 26;
const PAD_B = 44;
const PLOT_W = VB_W - PAD_L - PAD_R;
const PLOT_H = VB_H - PAD_T - PAD_B;

/** Binary search the (alongM-sorted) profile for the point nearest `alongM`. */
function nearestByAlong(profile: ProfilePoint[], alongM: number): ProfilePoint | null {
  const n = profile.length;
  if (n === 0) return null;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (profile[mid].alongM < alongM) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(profile[lo - 1].alongM - alongM) <= Math.abs(profile[lo].alongM - alongM)) {
    return profile[lo - 1];
  }
  return profile[lo];
}

export function ElevationChart({
  profile,
  sourceLabel,
  waypoints,
  sync,
  onHover,
  positionAlongM,
}: {
  /** Concatenated route profile (already decimated to <= 800 pts, alongM asc). */
  profile: ProfilePoint[];
  /** "planned line" | "completed line" — footer caption. */
  sourceLabel: string;
  waypoints: RelayWaypointDto[];
  /** Shared hover point (from this chart OR the map's planned line). */
  sync: SyncPoint | null;
  onHover: (s: SyncPoint | null) => void;
  /** Team's current position snapped to the profile; null when unknown. */
  positionAlongM: number | null;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rafRef = useRef<number | null>(null);
  const pendingXRef = useRef(0);

  // All static geometry memoized so per-frame hover re-renders stay cheap.
  const geom = useMemo(() => {
    const totalDistM = profile.length ? profile[profile.length - 1].alongM : 0;

    let minEle = Infinity;
    let maxEle = -Infinity;
    for (const p of profile) {
      if (p.ele < minEle) minEle = p.ele;
      if (p.ele > maxEle) maxEle = p.ele;
    }
    if (!Number.isFinite(minEle)) minEle = 0;
    if (!Number.isFinite(maxEle)) maxEle = 0;
    const eleSpan = maxEle - minEle > 1 ? maxEle - minEle : 1;
    const distSpan = totalDistM > 1 ? totalDistM : 1;

    const xOf = (distM: number) => PAD_L + (distM / distSpan) * PLOT_W;
    const yOf = (ele: number) =>
      totalDistM > 1 ? PAD_T + (1 - (ele - minEle) / eleSpan) * PLOT_H : PAD_T + PLOT_H / 2;

    let linePath = "";
    let areaPath = "";
    if (profile.length >= 2) {
      const parts = profile.map(
        (p, i) => `${i === 0 ? "M" : "L"}${xOf(p.alongM).toFixed(2)} ${yOf(p.ele).toFixed(2)}`
      );
      linePath = parts.join(" ");
      const baseY = VB_H - PAD_B;
      const firstX = xOf(profile[0].alongM);
      const lastX = xOf(profile[profile.length - 1].alongM);
      areaPath = `${linePath} L${lastX.toFixed(2)} ${baseY} L${firstX.toFixed(2)} ${baseY} Z`;
    } else {
      const midY = PAD_T + PLOT_H / 2;
      linePath = `M${PAD_L} ${midY} L${VB_W - PAD_R} ${midY}`;
    }

    // Snap each waypoint to its nearest profile point → cumulative distance.
    const wpMarks = waypoints
      .map((w) => {
        if (profile.length === 0) return null;
        let bestD = Infinity;
        let bestDist = 0;
        let bestEle = minEle;
        for (const p of profile) {
          const d = haversineM(w.lat, w.lng, p.lat, p.lng);
          if (d < bestD) {
            bestD = d;
            bestDist = p.alongM;
            bestEle = p.ele;
          }
        }
        return { name: w.name, passed: w.passed, distM: bestDist, ele: bestEle };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => a.distM - b.distM);

    // Team position marker + remaining climb past it.
    let posMark: { x: number; y: number } | null = null;
    let remainingGainM: number | null = null;
    if (positionAlongM !== null && profile.length >= 2) {
      const p = nearestByAlong(profile, positionAlongM);
      if (p) {
        posMark = { x: xOf(p.alongM), y: yOf(p.ele) };
        let g = 0;
        let started = false;
        for (let i = 1; i < profile.length; i++) {
          if (!started && profile[i].alongM >= p.alongM) started = true;
          if (started) {
            const d = profile[i].ele - profile[i - 1].ele;
            if (d > 0) g += d;
          }
        }
        remainingGainM = g;
      }
    }

    return { totalDistM, minEle, maxEle, distSpan, xOf, yOf, linePath, areaPath, wpMarks, posMark, remainingGainM };
  }, [profile, waypoints, positionAlongM]);

  const hoverable = profile.length >= 2;

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!hoverable) return;
    pendingXRef.current = e.clientX;
    if (rafRef.current !== null) return; // rAF throttle
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (rect.width < 1) return;
      const xVb = ((pendingXRef.current - rect.left) / rect.width) * VB_W;
      const frac = Math.min(1, Math.max(0, (xVb - PAD_L) / PLOT_W));
      const p = nearestByAlong(profile, frac * geom.distSpan);
      if (p) onHover({ lat: p.lat, lng: p.lng, alongM: p.alongM });
    });
  };

  const handleLeave = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    onHover(null);
  };

  // Resolve the shared sync point against this profile for the marker's y.
  const syncMark = useMemo(() => {
    if (!sync || !hoverable) return null;
    const p = nearestByAlong(profile, sync.alongM);
    if (!p) return null;
    return { x: geom.xOf(p.alongM), y: geom.yOf(p.ele), alongM: p.alongM, ele: p.ele };
  }, [sync, hoverable, profile, geom]);

  const gradId = "elevGrad";
  const labelStroke: React.CSSProperties = {
    paintOrder: "stroke",
    stroke: BG,
    strokeWidth: 4,
    strokeLinejoin: "round",
  };

  return (
    <div style={{ width: "100%" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "auto", display: "block", cursor: hoverable ? "crosshair" : "default", touchAction: "pan-y" }}
        role="img"
        aria-label="Elevation profile of the route"
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity="0.34" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area fill under the line */}
        {geom.areaPath && <path d={geom.areaPath} fill={`url(#${gradId})`} stroke="none" />}

        {/* Waypoint ticks (under the line) */}
        {geom.wpMarks.map((m, i) => {
          const x = geom.xOf(m.distM);
          return (
            <g key={i}>
              <line
                x1={x}
                y1={PAD_T - 6}
                x2={x}
                y2={VB_H - PAD_B}
                stroke={m.passed ? "rgba(232,97,60,0.5)" : "rgba(154,145,134,0.32)"}
                strokeWidth={1}
                strokeDasharray="3 4"
              />
              <circle cx={x} cy={geom.yOf(m.ele)} r={2.6} fill={m.passed ? ACCENT : MUTED} />
            </g>
          );
        })}

        {/* Elevation line */}
        <path
          d={geom.linePath}
          fill="none"
          stroke={ACCENT}
          strokeWidth={2.2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Team position — solid accent line + ringed dot ("NOW"). */}
        {geom.posMark && (
          <g>
            <line
              x1={geom.posMark.x}
              y1={PAD_T - 2}
              x2={geom.posMark.x}
              y2={VB_H - PAD_B}
              stroke={ACCENT}
              strokeWidth={1.4}
              strokeOpacity={0.85}
            />
            <circle cx={geom.posMark.x} cy={geom.posMark.y} r={4.4} fill={ACCENT} stroke={CREAM} strokeWidth={1.4} />
            <text
              x={geom.posMark.x + (geom.posMark.x > VB_W - 60 ? -6 : 6)}
              y={PAD_T + 10}
              textAnchor={geom.posMark.x > VB_W - 60 ? "end" : "start"}
              fill={CREAM}
              style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: ".1em", ...labelStroke }}
            >
              NOW
            </text>
          </g>
        )}

        {/* Shared hover sync — vertical hairline + dot + readout. */}
        {syncMark && (
          <g pointerEvents="none">
            <line
              x1={syncMark.x}
              y1={PAD_T - 6}
              x2={syncMark.x}
              y2={VB_H - PAD_B}
              stroke={CREAM}
              strokeWidth={1}
              strokeOpacity={0.75}
            />
            <circle cx={syncMark.x} cy={syncMark.y} r={4} fill={CREAM} stroke={BG} strokeWidth={1.4} />
            <text
              x={syncMark.x + (syncMark.x > VB_W - 130 ? -8 : 8)}
              y={PAD_T - 12}
              textAnchor={syncMark.x > VB_W - 130 ? "end" : "start"}
              fill={CREAM}
              style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, ...labelStroke }}
            >
              {fmtMiles(syncMark.alongM)} · {fmtFeet(syncMark.ele)}
            </text>
          </g>
        )}

        {/* No waypoint name labels — with 17 checkpoints they overlapped into
            an unreadable smear along the axis (owner feedback). The ticks
            above still mark positions; names live in the splits/plan lists. */}

        {/* Max / min elevation labels */}
        {geom.totalDistM > 1 && (
          <>
            <text
              x={PAD_L + 2}
              y={PAD_T - 10}
              textAnchor="start"
              fill={MUTED}
              style={{ fontFamily: "var(--font-mono)", fontSize: 10, ...labelStroke }}
            >
              {fmtFeet(geom.maxEle)}
            </text>
            <text
              x={PAD_L + 2}
              y={VB_H - PAD_B - 4}
              textAnchor="start"
              fill={MUTED}
              style={{ fontFamily: "var(--font-mono)", fontSize: 10, ...labelStroke }}
            >
              {fmtFeet(geom.minEle)}
            </text>
          </>
        )}

        {/* Empty-data note over the flat baseline */}
        {!hoverable && (
          <text
            x={VB_W / 2}
            y={PAD_T + PLOT_H / 2 - 12}
            textAnchor="middle"
            fill={MUTED}
            style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
          >
            No elevation data yet
          </text>
        )}
      </svg>

      {/* Footer scale row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          marginTop: 6,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: MUTED,
          letterSpacing: "0.03em",
        }}
      >
        <span>0 mi</span>
        <span style={{ textAlign: "center" }}>
          {sourceLabel}
          {geom.remainingGainM !== null
            ? ` · ${fmtFeet(geom.remainingGainM)} of climb left`
            : geom.totalDistM > 1
              ? ` · ${fmtFeet(geom.maxEle - geom.minEle)} range`
              : " · flat"}
        </span>
        <span>{fmtMiles(geom.totalDistM)}</span>
      </div>
    </div>
  );
}
