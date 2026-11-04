/* THE RIVER, AS GEOMETRY — the real Colorado (riverData.ts coarse for the
 * overview, riverDataFine.ts for the centerline and the leg details),
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
 * is finished in RouteMap.tsx; the per-leg detail charts (owner,
 * 2026-11-03: "break down the route/plan on a map … show the sections in
 * more detail") are built by legChart() below and drawn by LegMap.tsx,
 * each leg rotated to its own best-fit horizontal.
 *
 * pointAtMeters maps the row (0 at Hoover, TOTAL_M at Davis) onto the
 * line by REAL ground distance, so it parks the simulated dot today and
 * the satellite pings on race day. The honest line is ~106.8 km; the
 * 100,000 m goal spans it proportionally. */

import type { View } from "./look";
import { CANYON, SHORE } from "./riverData";
import { CANYON_F, RIVER_F, SHORE_F } from "./riverDataFine";

export const TOTAL_M = 100_000;

const EX = 2.4;
const TILT = (16 * Math.PI) / 180;
const FLATTEN = 0.6;

const H0 = RIVER_F[0];
const M_LAT = 110_950;
const M_LON = 111_320 * Math.cos((35.6 * Math.PI) / 180);

type Pt = [number, number];

const ground = (p: Pt): Pt => [(p[1] - H0[1]) * M_LON, (H0[0] - p[0]) * M_LAT];

const davisG = ground(RIVER_F[RIVER_F.length - 1]);
const a0 = Math.atan2(davisG[1], davisG[0]);
const c0 = Math.cos(-a0);
const s0 = Math.sin(-a0);
const c1 = Math.cos(TILT);
const s1 = Math.sin(TILT);

/* Axis-aligned, cross-exaggerated ground coordinates — the common stem of
 * both overview projections. */
const stem = (p: Pt): Pt => {
  const [gx, gy] = ground(p);
  return [gx * c0 - gy * s0, (gx * s0 + gy * c0) * EX];
};

const post: Record<View, (p: Pt) => Pt> = {
  iso: ([x, y]) => [x * c1 - y * s1, (x * s1 + y * c1) * FLATTEN],
  top: ([x, y]) => [-y, x],
};

/* Cumulative GROUND meters along the fine centerline. ROUTE_M is the
 * honest length of the line (~106,800 m). */
const groundPts = RIVER_F.map(ground);
const cum = [0];
for (let i = 1; i < groundPts.length; i++) {
  cum.push(cum[i - 1] + Math.hypot(groundPts[i][0] - groundPts[i - 1][0], groundPts[i][1] - groundPts[i - 1][1]));
}
export const ROUTE_M = cum[cum.length - 1];

/** The lat/lon m meters down the row (0 → Hoover, TOTAL_M → Davis). */
function latlonAtMeters(m: number): Pt {
  const target = Math.min(1, Math.max(0, m / TOTAL_M)) * ROUTE_M;
  for (let i = 1; i < cum.length; i++) {
    if (cum[i] >= target) {
      const f = (target - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      return [
        RIVER_F[i - 1][0] + (RIVER_F[i][0] - RIVER_F[i - 1][0]) * f,
        RIVER_F[i - 1][1] + (RIVER_F[i][1] - RIVER_F[i - 1][1]) * f,
      ];
    }
  }
  return RIVER_F[RIVER_F.length - 1];
}

/* The fine centerline indices inside [m0, m1], for slicing out a leg. */
function idxRange(m0: number, m1: number): [number, number] {
  const t0 = (m0 / TOTAL_M) * ROUTE_M;
  const t1 = (m1 / TOTAL_M) * ROUTE_M;
  let a = 0;
  let b = cum.length - 1;
  for (let i = 0; i < cum.length; i++) {
    if (cum[i] < t0) a = i;
    if (cum[i] <= t1) b = i;
  }
  return [a + 1, b];
}

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
  const projected = [...RIVER_F, ...SHORE, ...CANYON].map(proj);
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

  const river = RIVER_F.map(screen);
  const pointAtMeters = (m: number): Pt => screen(latlonAtMeters(m));

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

/* ---- THE LEG CHARTS (LegMap.tsx) ------------------------------------- */

export type LegChart = {
  vb: { w: number; h: number };
  /** The leg of the route, screen coords, start → end. */
  leg: Pt[];
  /** Shoreline polylines clipped to the window around the leg. */
  segs: Pt[][];
};

/** One leg of the row, rotated to its own horizontal, fine shorelines
 * clipped to a corridor around it. ex is the leg's own cross-axis
 * exaggeration: the canyon needs much more than the lake or the walls
 * hide under the route line. */
export function legChart(m0: number, m1: number, ex: number, width = 440): LegChart {
  const A = ground(latlonAtMeters(m0));
  const B = ground(latlonAtMeters(m1));
  const ang = Math.atan2(B[1] - A[1], B[0] - A[0]);
  const c = Math.cos(-ang);
  const s = Math.sin(-ang);
  const pr = (p: Pt): Pt => {
    const g = ground(p);
    const x = (g[0] - A[0]) * c - (g[1] - A[1]) * s;
    const y = ((g[0] - A[0]) * s + (g[1] - A[1]) * c) * ex;
    return [x, y];
  };

  const [ia, ib] = idxRange(m0, m1);
  const legP = [latlonAtMeters(m0), ...RIVER_F.slice(ia, ib + 1), latlonAtMeters(m1)].map(pr);
  const lx0 = Math.min(...legP.map((p) => p[0]));
  const lx1 = Math.max(...legP.map((p) => p[0]));
  const ly0 = Math.min(...legP.map((p) => p[1]));
  const ly1 = Math.max(...legP.map((p) => p[1]));
  const CX = 2200;
  const CY = 1600 * ex;

  const clip = (src: Pt[]): Pt[][] => {
    const out: Pt[][] = [];
    let cur: Pt[] = [];
    for (const p of src) {
      const q = pr(p);
      if (q[0] > lx0 - CX && q[0] < lx1 + CX && q[1] > ly0 - CY && q[1] < ly1 + CY) cur.push(q);
      else if (cur.length) {
        out.push(cur);
        cur = [];
      }
    }
    if (cur.length) out.push(cur);
    return out.filter((seg) => seg.length > 3);
  };

  const segs = clip([...SHORE_F, SHORE_F[0]]).concat(clip([...CANYON_F, CANYON_F[0]]));

  const allPts = legP.concat(...segs);
  let bx0 = Math.min(...allPts.map((p) => p[0]));
  let bx1 = Math.max(...allPts.map((p) => p[0]));
  let by0 = Math.min(...allPts.map((p) => p[1]));
  let by1 = Math.max(...allPts.map((p) => p[1]));
  const padX = (bx1 - bx0) * 0.07 + 300;
  const padY = (by1 - by0) * 0.1 + 400;
  bx0 -= padX;
  bx1 += padX;
  by0 -= padY;
  by1 += padY;

  const S = (width - 20) / (bx1 - bx0);
  const h = Math.max(150, Math.min(330, Math.round((by1 - by0) * S + 40)));
  const off = (h - (by1 - by0) * S) / 2;
  const sc = (p: Pt): Pt => [(p[0] - bx0) * S + 10, (p[1] - by0) * S + off];

  return { vb: { w: width, h }, leg: legP.map(sc), segs: segs.map((seg) => seg.map(sc)) };
}

/** The named stops, hung off their real meters — the same scale the live
 * dot reads. dy hangs the label below (+1) or above (-1) in the iso view;
 * dx hangs it right (+1) or left (-1) of the line in the top view. */
export const WAYPOINTS = [
  { name: "WILLOW BEACH", km: 19, m: 19_000, dy: -1, dx: 1 },
  { name: "COTTONWOOD COVE", km: 55, m: 55_000, dy: 1, dx: -1 },
  { name: "KATHERINE LANDING", km: 97, m: 97_000, dy: 1, dx: 1 },
];

/** The plan, as four legs (owner, 2026-11-03: "show not tell"). */
export const LEGS = [
  {
    m0: 0,
    m1: 19_000,
    start: "0 m",
    end: "19 K",
    title: "Black Canyon",
    range: "0 – 19 k",
    ex: 4.5,
    routeW: 1.8,
    blurb: "Permit launch below the dam at first light; nineteen kilometers of canyon walls to Willow Beach.",
  },
  {
    m0: 19_000,
    m1: 55_000,
    start: "19 K",
    end: "55 K",
    title: "Upper Mohave",
    range: "19 – 55 k",
    ex: 1.5,
    routeW: 2.6,
    blurb: "The canyon opens into slack water — past halfway at Cottonwood Cove.",
  },
  {
    m0: 55_000,
    m1: 97_000,
    start: "55 K",
    end: "97 K",
    title: "Lower Mohave",
    range: "55 – 97 k",
    ex: 1.5,
    routeW: 2.6,
    blurb: "The widest water and the wind, down to Katherine Landing.",
  },
  {
    m0: 97_000,
    m1: 100_000,
    start: "97 K",
    end: "FINISH",
    title: "The Davis line",
    range: "97 – 100 k",
    ex: 1.5,
    routeW: 2.6,
    blurb: "The last 3,000 meters into the dam — under lights.",
  },
];
