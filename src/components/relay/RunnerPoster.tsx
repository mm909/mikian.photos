"use client";

import { memo } from "react";
import type { RelayPoint, RelaySegmentDto, RelayRunnerDto } from "@/lib/relay";
import { fmtMiles } from "./format";

/**
 * The keepsake vector art of the crossing, two forms:
 *
 *  - `RunnerPoster` — every COMPLETED segment overlaid as a colored polyline
 *    (each runner's own color) projected into ONE shared bounding box. When
 *    `focusRunnerId` is set (a runner is selected in RelayStats) their lines
 *    stay bright + glowing and everyone else's dim to ~8% opacity.
 *
 *  - `LegGrid` — the "Runs 2017"-style small multiples: a grid of tiles, each
 *    tile ONE leg's polyline projected into its OWN bbox, stroked in the
 *    runner's color, labeled "Leg N · X mi".
 *
 * Projection (both): equirectangular around the bbox mid-latitude —
 * mPerLat = 111000, mPerLng = 111000 * cos(midLat) — scaled aspect-correct to
 * fit the padded viewBox, centered, y flipped (north up).
 *
 * Guards: segments with < 2 points are skipped; a degenerate bbox (all points
 * coincident) is clamped to a tiny span so nothing divides by zero; long
 * polylines are decimated (<= 800 pts in the poster, <= 300 per tile).
 */

const VB_W = 900;
const VB_H = 600;
const PAD = 46;
const CREAM = "#f5f2ec";
const MUTED = "#9a9186";
const HAIR = "rgba(245,242,236,0.10)";

type Pt = { lat: number; lng: number };

type Projection = {
  project: (lat: number, lng: number) => [number, number];
};

/** Aspect-correct equirect projection of a bbox into a padded w×h box. */
function makeProjection(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  w: number,
  h: number,
  pad: number
): Projection {
  const midLat = (minLat + maxLat) / 2;
  const mPerLat = 111000;
  const mPerLng = 111000 * Math.cos((midLat * Math.PI) / 180);

  const latSpan = Math.max(maxLat - minLat, 1e-6);
  const lngSpan = Math.max(maxLng - minLng, 1e-6);
  const widthM = lngSpan * mPerLng;
  const heightM = latSpan * mPerLat;

  const usableW = w - 2 * pad;
  const usableH = h - 2 * pad;
  const scale = Math.min(
    widthM > 0 ? usableW / widthM : usableW,
    heightM > 0 ? usableH / heightM : usableH
  );

  const drawnW = widthM * scale;
  const drawnH = heightM * scale;
  const offsetX = pad + (usableW - drawnW) / 2;
  const offsetY = pad + (usableH - drawnH) / 2;

  return {
    project: (lat: number, lng: number) => [
      offsetX + (lng - minLng) * mPerLng * scale,
      offsetY + (maxLat - lat) * mPerLat * scale, // y flipped: north up
    ],
  };
}

function decimate<T>(pts: T[], max: number): T[] {
  if (pts.length <= max) return pts;
  const step = Math.ceil(pts.length / max);
  const out: T[] = [];
  for (let i = 0; i < pts.length; i += step) out.push(pts[i]);
  if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
  return out;
}

function toPathD(pts: Pt[], project: Projection["project"], max: number): string {
  const src = decimate(pts, max);
  let d = "";
  for (let i = 0; i < src.length; i++) {
    const [x, y] = project(src[i].lat, src[i].lng);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d.trim();
}

/* ------------------------------------------------------------------------ *
 *  The big overlay poster
 * ------------------------------------------------------------------------ */

export const RunnerPoster = memo(function RunnerPoster({
  segments,
  runners,
  focusRunnerId = null,
}: {
  segments: RelaySegmentDto[];
  runners: RelayRunnerDto[];
  /** When set, only this runner's lines stay bright; others dim to ~8%. */
  focusRunnerId?: string | null;
}) {
  const colorOf = new Map(runners.map((r) => [r.id, r.color]));
  const nameOf = new Map(runners.map((r) => [r.id, r.name]));

  const usable = segments.filter(
    (s) => s.kind === "completed" && s.points && s.points.length >= 2
  );

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const s of usable) {
    for (const p of s.points) {
      const [lat, lng] = p;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  }

  const haveBox = Number.isFinite(minLat) && Number.isFinite(minLng);

  if (!haveBox || usable.length === 0) {
    return (
      <div
        style={{
          padding: "40px 24px",
          textAlign: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: MUTED,
        }}
      >
        No completed lines to draw yet.
      </div>
    );
  }

  const { project } = makeProjection(minLat, maxLat, minLng, maxLng, VB_W, VB_H, PAD);

  const drawn = usable.map((s) => {
    const pts: Pt[] = s.points.map((p) => ({ lat: p[0], lng: p[1] }));
    const color = (s.runnerId && colorOf.get(s.runnerId)) || CREAM;
    return { id: s.id, d: toPathD(pts, project, 800), color, runnerId: s.runnerId };
  });

  // With a focus, draw dimmed lines first so the focused runner sits on top.
  const ordered = focusRunnerId
    ? [...drawn].sort(
        (a, b) => Number(a.runnerId === focusRunnerId) - Number(b.runnerId === focusRunnerId)
      )
    : drawn;

  const contributing = runners.filter((r) => usable.some((s) => s.runnerId === r.id));

  const glowId = "posterGlow";

  return (
    <div style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="Every completed line, overlaid as a poster"
      >
        <defs>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Soft glow layer — only for bright (non-dimmed) lines */}
        <g opacity={0.5}>
          {drawn
            .filter((seg) => !focusRunnerId || seg.runnerId === focusRunnerId)
            .map((seg) => (
              <path
                key={`glow-${seg.id}`}
                d={seg.d}
                fill="none"
                stroke={seg.color}
                strokeWidth={4.5}
                strokeOpacity={0.28}
                strokeLinejoin="round"
                strokeLinecap="round"
                filter={`url(#${glowId})`}
              />
            ))}
        </g>

        {/* Crisp thin lines */}
        {ordered.map((seg) => {
          const dimmed = focusRunnerId !== null && seg.runnerId !== focusRunnerId;
          return (
            <path
              key={`line-${seg.id}`}
              d={seg.d}
              fill="none"
              stroke={seg.color}
              strokeWidth={dimmed ? 1.2 : 1.5}
              strokeOpacity={dimmed ? 0.08 : 0.95}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* Legend */}
      {contributing.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px 18px",
            marginTop: 14,
            justifyContent: "center",
          }}
        >
          {contributing.map((r) => {
            const dimmed = focusRunnerId !== null && r.id !== focusRunnerId;
            return (
              <span
                key={r.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.03em",
                  color: dimmed ? "rgba(154,145,134,0.4)" : MUTED,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: r.color,
                    boxShadow: dimmed ? "none" : `0 0 6px ${r.color}`,
                    opacity: dimmed ? 0.3 : 1,
                    display: "inline-block",
                  }}
                />
                {nameOf.get(r.id) ?? r.name}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------------ *
 *  Small multiples — one tile per leg
 * ------------------------------------------------------------------------ */

const TILE = 120;
const TILE_PAD = 16;

function tileGeometry(points: RelayPoint[]): { d: string; start: [number, number] } | null {
  if (!points || points.length < 2) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    if (p[0] < minLat) minLat = p[0];
    if (p[0] > maxLat) maxLat = p[0];
    if (p[1] < minLng) minLng = p[1];
    if (p[1] > maxLng) maxLng = p[1];
  }
  if (!Number.isFinite(minLat) || !Number.isFinite(minLng)) return null;

  const { project } = makeProjection(minLat, maxLat, minLng, maxLng, TILE, TILE, TILE_PAD);
  const pts: Pt[] = points.map((p) => ({ lat: p[0], lng: p[1] }));
  return { d: toPathD(pts, project, 300), start: project(pts[0].lat, pts[0].lng) };
}

/** One runner's legs as a grid of little route glyphs. `segments` must be that
 *  runner's completed legs in leg order — Leg N is the array index + 1, so a
 *  leg skipped for having < 2 points doesn't shift the numbering. */
export const LegGrid = memo(function LegGrid({
  segments,
  color,
}: {
  segments: RelaySegmentDto[];
  color: string;
}) {
  const anyUsable = segments.some((s) => s.points && s.points.length >= 2);
  if (!anyUsable) {
    return (
      <div
        style={{
          padding: "32px 24px",
          textAlign: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: MUTED,
        }}
      >
        No completed legs to draw yet.
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))",
        gap: "20px 14px",
      }}
    >
      {segments.map((s, i) => {
        const geo = tileGeometry(s.points);
        if (!geo) return null;
        return (
          <figure key={s.id} style={{ margin: 0 }}>
            <svg
              viewBox={`0 0 ${TILE} ${TILE}`}
              preserveAspectRatio="xMidYMid meet"
              style={{ width: "100%", height: "auto", display: "block" }}
              role="img"
              aria-label={`Leg ${i + 1} route shape`}
            >
              <rect
                x={0.5}
                y={0.5}
                width={TILE - 1}
                height={TILE - 1}
                rx={10}
                fill="rgba(245,242,236,0.02)"
                stroke={HAIR}
                strokeWidth={1}
              />
              <path
                d={geo.d}
                fill="none"
                stroke={color}
                strokeWidth={4}
                strokeOpacity={0.14}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <path
                d={geo.d}
                fill="none"
                stroke={color}
                strokeWidth={1.8}
                strokeOpacity={0.95}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* Start dot */}
              <circle cx={geo.start[0]} cy={geo.start[1]} r={2.6} fill={CREAM} fillOpacity={0.85} />
            </svg>
            <figcaption
              style={{
                marginTop: 7,
                textAlign: "center",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: ".06em",
                color: MUTED,
              }}
            >
              Leg {i + 1} · {fmtMiles(s.distanceM)}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
});
