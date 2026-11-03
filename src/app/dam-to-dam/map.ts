/* THE RIVER, AS GEOMETRY — the real Colorado (riverData.ts, USGS NHD)
 * projected two ways (owner, 2026-11-03: "let me select isometric or top
 * down"):
 *
 *   iso — the panorama: rotate the ground plane so the dam-to-dam axis
 *         runs horizontal, tilt the sheet, flatten the vertical so it
 *         reads as a chart lying on a table. Hoover top-left, Davis
 *         bottom-right.
 *   top — straight overhead: the same rotation turned upright, no tilt,
 *         no flatten. The tall chart, Hoover at the top.
 *
 * Both exaggerate the cross-axis by EX — the lake is ~2 km wide against
 * 106 km long and renders as a thread without it. The 3D of the iso view
 * is finished in RouteMap.tsx: each shoreline gets a rim copy lifted off
 * the ground plane with hatching between — high walls in the canyon, low
 * banks on the lake.
 *
 * pointAtMeters maps the row (0 at Hoover, TOTAL_M at Davis) onto the
 * line by REAL ground distance, so it parks the simulated dot today and
 * the satellite pings on race day. The honest line is ~106.4 km; the
 * 100,000 m goal spans it proportionally. */

import type { View } from "./look";
import { CANYON, RIVER, SHORE } from "./riverData";

export const TOTAL_M = 100_000;

const EX = 2.4;
const TILT = (16 * Math.PI) / 180;
const FLATTEN = 0.6;

const H0 = RIVER[0];
const M_LAT = 110_950;
const M_LON = 111_320 * Math.cos((35.6 * Math.PI) / 180);

type Pt = [number, number];

const ground = (p: Pt): Pt => [(p[1] - H0[1]) * M_LON, (H0[0] - p[0]) * M_LAT];

const davisG = ground(RIVER[RIVER.length - 1]);
const a0 = Math.atan2(davisG[1], davisG[0]);
const c0 = Math.cos(-a0);
const s0 = Math.sin(-a0);
const c1 = Math.cos(TILT);
const s1 = Math.sin(TILT);

/* Axis-aligned, cross-exaggerated ground coordinates — the common stem. */
const stem = (p: Pt): Pt => {
  const [gx, gy] = ground(p);
  return [gx * c0 - gy * s0, (gx * s0 + gy * c0) * EX];
};

const post: Record<View, (p: Pt) => Pt> = {
  iso: ([x, y]) => [x * c1 - y * s1, (x * s1 + y * c1) * FLATTEN],
  top: ([x, y]) => [-y, x],
};

/* Cumulative GROUND meters along the centerline. ROUTE_M is the honest
 * length of the line (~106,400 m). */
const groundPts = RIVER.map(ground);
const cum = [0];
for (let i = 1; i < groundPts.length; i++) {
  cum.push(cum[i - 1] + Math.hypot(groundPts[i][0] - groundPts[i - 1][0], groundPts[i][1] - groundPts[i - 1][1]));
}
export const ROUTE_M = cum[cum.length - 1];

export type Chart = {
  vb: { w: number; h: number };
  river: Pt[];
  shore: Pt[];
  canyon: Pt[];
  north: Pt;
  scale10k: number;
  pointAtMeters: (m: number) => Pt;
  damBar: (end: "start" | "finish") => string;
};

function makeChart(view: View): Chart {
  const proj = (p: Pt) => post[view](stem(p));
  const projected = [...RIVER, ...SHORE, ...CANYON].map(proj);
  const minX = Math.min(...projected.map((p) => p[0]));
  const maxX = Math.max(...projected.map((p) => p[0]));
  const minY = Math.min(...projected.map((p) => p[1]));
  const maxY = Math.max(...projected.map((p) => p[1]));

  /* iso fits a fixed drawing width; top fits a fixed drawing height and
   * leaves side gutters for its side-hung labels. */
  const PAD = view === "iso" ? { l: 70, r: 170, t: 100, b: 80 } : { l: 160, r: 210, t: 70, b: 90 };
  const S = view === "iso" ? 840 / (maxX - minX) : 720 / (maxY - minY);

  const screen = (p: Pt): Pt => {
    const q = proj(p);
    return [(q[0] - minX) * S + PAD.l, (q[1] - minY) * S + PAD.t];
  };

  const vb = {
    w: Math.round((maxX - minX) * S + PAD.l + PAD.r),
    h: Math.round((maxY - minY) * S + PAD.t + PAD.b),
  };

  const river = RIVER.map(screen);

  const pointAtMeters = (m: number): Pt => {
    const target = Math.min(1, Math.max(0, m / TOTAL_M)) * ROUTE_M;
    for (let i = 1; i < cum.length; i++) {
      if (cum[i] >= target) {
        const f = (target - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
        return screen([
          RIVER[i - 1][0] + (RIVER[i][0] - RIVER[i - 1][0]) * f,
          RIVER[i - 1][1] + (RIVER[i][1] - RIVER[i - 1][1]) * f,
        ]);
      }
    }
    return river[river.length - 1];
  };

  const damBar = (end: "start" | "finish"): string => {
    const [a, b] = end === "start" ? [river[0], river[1]] : [river[river.length - 2], river[river.length - 1]];
    const at = end === "start" ? river[0] : river[river.length - 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = (-(b[1] - a[1]) / L) * 12;
    const ny = ((b[0] - a[0]) / L) * 12;
    return `M${(at[0] - nx).toFixed(1)} ${(at[1] - ny).toFixed(1)} L${(at[0] + nx).toFixed(1)} ${(at[1] + ny).toFixed(1)}`;
  };

  /* True north on this sheet (ground (0,-1) through the projection),
   * scaled to a 34 px arrow. */
  const n = post[view]([s0, -c0 * EX]);
  const nLen = Math.hypot(n[0], n[1]) || 1;
  const north: Pt = [(n[0] / nLen) * 34, (n[1] / nLen) * 34];

  const hv = river[0];
  const dv = river[river.length - 1];
  const scale10k = Math.hypot(dv[0] - hv[0], dv[1] - hv[1]) / (ROUTE_M / 10_000);

  return { vb, river, shore: SHORE.map(screen), canyon: CANYON.map(screen), north, scale10k, pointAtMeters, damBar };
}

export const CHARTS: Record<View, Chart> = { iso: makeChart("iso"), top: makeChart("top") };

export const linePath = (pts: Pt[], close = false) =>
  "M" + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L ") + (close ? " Z" : "");

/** Vertical cliff hatching: a tick rising h px off every step-th point. */
export const hatchPath = (pts: Pt[], h: number, step: number) => {
  let d = "";
  for (let i = 0; i < pts.length; i += step) d += `M${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} l0 ${-h} `;
  return d;
};

/** The named stops, hung off their real meters — the same scale the live
 * dot reads. dy hangs the label below (+1) or above (-1) in the iso view;
 * dx hangs it right (+1) or left (-1) of the line in the top view. */
export const WAYPOINTS = [
  { name: "WILLOW BEACH", km: 19, m: 19_000, dy: -1, dx: 1 },
  { name: "COTTONWOOD COVE", km: 55, m: 55_000, dy: 1, dx: -1 },
  { name: "KATHERINE LANDING", km: 97, m: 97_000, dy: 1, dx: 1 },
];
