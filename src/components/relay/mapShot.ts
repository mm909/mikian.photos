"use client";

/**
 * "Map photo" share — the crossing drawn over the REAL basemap (roads, towns,
 * borders): CARTO dark raster tiles composited onto a canvas, the completed
 * legs per-runner-colored on top, the plan dotted amber, plus the DTK
 * wordmark, a compact stats line, and the required basemap attribution.
 *
 * Mercator math: worldPx = 256·2^z; x = (lng+180)/360·worldPx;
 * y = (1 − ln(tan φ + sec φ)/π)/2 · worldPx. We pick the max integer zoom
 * (≤13, ≥4) where the padded lat/lng bbox fits width×height, then drop zoom
 * until the covering tile grid is under ~48 tiles.
 *
 * CORS: tiles load with crossOrigin="anonymous" — CARTO serves
 * Access-Control-Allow-Origin:* so the canvas stays clean and
 * toDataURL/toBlob keep working. If any tile fails to load, or the canvas is
 * tainted anyway (toDataURL throws), this resolves NULL and the caller shows
 * "Map snapshot unavailable — try the poster instead." No blind failures, no
 * throws.
 */

import type {
  RelayPoint,
  RelayRunnerDto,
  RelaySegmentDto,
  RelayWaypointDto,
} from "@/lib/relay";
import { TEAM_NAME, TEAM_TAG, TEAM_HASHTAG } from "@/lib/dtk";
import { text } from "./shareCard";

const BG = "#14120f";
const CREAM = "#f5f2ec";
const AMBER = "#f0b060";
const MI = 1609.34;
const TILE = 256;
const MAX_TILES = 48;
const MAX_Z = 13;
const MIN_Z = 4;
const SUBDOMAINS = ["a", "b", "c", "d"] as const;

export type MapShotOptions = {
  segments: RelaySegmentDto[];
  runners: RelayRunnerDto[];
  waypoints?: RelayWaypointDto[];
  /** Canvas size; defaults to the 1080×1350 IG-portrait share size. */
  width?: number;
  height?: number;
  /** Bbox padding as a fraction of each span, per side. Default 0.12. */
  pad?: number;
};

/** Web-Mercator world-pixel projections at a given world size (256·2^z). */
function mercX(lng: number, worldPx: number): number {
  return ((lng + 180) / 360) * worldPx;
}
function mercY(lat: number, worldPx: number): number {
  const phi = (Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * worldPx;
}

function decimate(pts: RelayPoint[], max: number): RelayPoint[] {
  if (pts.length <= max) return pts;
  const step = Math.ceil(pts.length / max);
  const out: RelayPoint[] = [];
  for (let i = 0; i < pts.length; i += step) out.push(pts[i]);
  if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
  return out;
}

/** One tile as an Image; rejects on error or after a timeout so a dead CDN
 *  can't leave the UI stuck on "Rendering…". */
function loadTile(url: string, timeoutMs = 12_000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = window.setTimeout(() => reject(new Error("tile timeout")), timeoutMs);
    img.crossOrigin = "anonymous"; // CARTO sends CORS headers → canvas stays clean
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("tile failed"));
    };
    img.src = url;
  });
}

export async function renderMapShot(opts: MapShotOptions): Promise<HTMLCanvasElement | null> {
  try {
    const width = Math.round(opts.width ?? 1080);
    const height = Math.round(opts.height ?? 1350);
    const pad = opts.pad ?? 0.12;

    const completed = opts.segments.filter((s) => s.kind === "completed" && s.points.length > 1);
    const planned = opts.segments.filter((s) => s.kind === "planned" && s.points.length > 1);
    const allPts = [...completed, ...planned].flatMap((s) => s.points);
    if (allPts.length < 2) return null;

    // Lat/lng bbox of everything drawn (+ the padding fraction per side; the
    // minimum keeps a near-degenerate bbox from collapsing the zoom pick).
    let minLat = Infinity,
      maxLat = -Infinity,
      minLng = Infinity,
      maxLng = -Infinity;
    for (const p of allPts) {
      if (p[0] < minLat) minLat = p[0];
      if (p[0] > maxLat) maxLat = p[0];
      if (p[1] < minLng) minLng = p[1];
      if (p[1] > maxLng) maxLng = p[1];
    }
    const latPad = Math.max((maxLat - minLat) * pad, 0.01);
    const lngPad = Math.max((maxLng - minLng) * pad, 0.01);
    minLat -= latPad;
    maxLat += latPad;
    minLng -= lngPad;
    maxLng += lngPad;

    // Max integer zoom where the padded bbox fits the canvas (falls through
    // to MIN_Z when nothing fits — content stays centered, edges crop).
    let zoom = MIN_Z;
    for (let z = MAX_Z; z >= MIN_Z; z--) {
      const worldPx = TILE * 2 ** z;
      const wPx = mercX(maxLng, worldPx) - mercX(minLng, worldPx);
      const hPx = mercY(minLat, worldPx) - mercY(maxLat, worldPx); // y grows southward
      if (wPx <= width && hPx <= height) {
        zoom = z;
        break;
      }
    }

    // The tile grid covering a width×height viewport centered on the bbox;
    // drop zoom until it's under the tile cap.
    const gridAt = (z: number) => {
      const worldPx = TILE * 2 ** z;
      const left = (mercX(minLng, worldPx) + mercX(maxLng, worldPx)) / 2 - width / 2;
      const top = (mercY(maxLat, worldPx) + mercY(minLat, worldPx)) / 2 - height / 2;
      const n = 2 ** z;
      const x0 = Math.floor(left / TILE);
      const x1 = Math.floor((left + width - 1) / TILE);
      const y0 = Math.max(0, Math.floor(top / TILE)); // no tiles past the poles
      const y1 = Math.min(n - 1, Math.floor((top + height - 1) / TILE));
      return { worldPx, left, top, n, x0, x1, y0, y1, count: (x1 - x0 + 1) * Math.max(0, y1 - y0 + 1) };
    };
    let grid = gridAt(zoom);
    while (grid.count > MAX_TILES && zoom > MIN_Z) {
      zoom -= 1;
      grid = gridAt(zoom);
    }
    if (grid.count === 0 || grid.count > MAX_TILES) return null;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Dark under-fill for any strip the (pole-clamped) tile rows miss.
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, width, height);

    // Fetch every covering tile (subdomains rotated a/b/c/d), then draw the
    // grid offset so the bbox center lands at the canvas center. One failed
    // tile fails the whole shot — no half-rendered basemaps.
    const jobs: { url: string; dx: number; dy: number }[] = [];
    for (let ty = grid.y0; ty <= grid.y1; ty++) {
      for (let tx = grid.x0; tx <= grid.x1; tx++) {
        const wrapX = ((tx % grid.n) + grid.n) % grid.n; // antimeridian-safe
        const sub = SUBDOMAINS[(((tx + ty) % 4) + 4) % 4];
        jobs.push({
          url: `https://${sub}.basemaps.cartocdn.com/dark_all/${zoom}/${wrapX}/${ty}.png`,
          dx: tx * TILE - grid.left,
          dy: ty * TILE - grid.top,
        });
      }
    }
    const tiles = await Promise.all(jobs.map((j) => loadTile(j.url)));
    tiles.forEach((img, i) => ctx.drawImage(img, Math.round(jobs[i].dx), Math.round(jobs[i].dy)));

    // The SAME mercator transform for the vectors — routes land exactly on
    // their roads.
    const px = (lat: number, lng: number) => ({
      x: mercX(lng, grid.worldPx) - grid.left,
      y: mercY(lat, grid.worldPx) - grid.top,
    });
    const trace = (pts: RelayPoint[]) => {
      ctx.beginPath();
      const p0 = px(pts[0][0], pts[0][1]);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < pts.length; i++) {
        const p = px(pts[i][0], pts[i][1]);
        ctx.lineTo(p.x, p.y);
      }
    };

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Planned line first (under the runs) — dotted amber.
    for (const s of planned) {
      ctx.save();
      ctx.strokeStyle = AMBER;
      ctx.lineWidth = 5;
      ctx.setLineDash([2, 16]);
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 6;
      trace(decimate(s.points, 800));
      ctx.stroke();
      ctx.restore();
    }

    // Completed legs, per-runner colors, slight dark shadow for lift.
    const colorOf = new Map(opts.runners.map((r) => [r.id, r.color]));
    for (const s of completed) {
      ctx.save();
      ctx.strokeStyle = (s.runnerId && colorOf.get(s.runnerId)) || CREAM;
      ctx.lineWidth = 8;
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 7;
      trace(decimate(s.points, 800));
      ctx.stroke();
      ctx.restore();
    }

    // Waypoint dots (on-canvas ones only).
    for (const w of opts.waypoints ?? []) {
      const p = px(w.lat, w.lng);
      if (p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) continue;
      ctx.save();
      ctx.fillStyle = "rgba(20,18,15,0.9)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = CREAM;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Readability scrims behind the wordmark + stats.
    const topScrim = ctx.createLinearGradient(0, 0, 0, 170);
    topScrim.addColorStop(0, "rgba(20,18,15,0.72)");
    topScrim.addColorStop(1, "rgba(20,18,15,0)");
    ctx.fillStyle = topScrim;
    ctx.fillRect(0, 0, width, 170);
    const botScrim = ctx.createLinearGradient(0, height - 210, 0, height);
    botScrim.addColorStop(0, "rgba(20,18,15,0)");
    botScrim.addColorStop(1, "rgba(20,18,15,0.8)");
    ctx.fillStyle = botScrim;
    ctx.fillRect(0, height - 210, width, 210);

    // DTK wordmark — centered letterspaced mono (measure the spaced width
    // first; text()'s letter mode advances from x).
    const mark = `${TEAM_NAME.toUpperCase()} (${TEAM_TAG})`;
    const markSize = 30;
    ctx.font = `400 ${markSize}px "DM Mono", monospace`;
    let markW = 0;
    for (const ch of mark) markW += ctx.measureText(ch).width + markSize * 0.18;
    markW = Math.max(0, markW - markSize * 0.18);
    text(ctx, mark, (width - markW) / 2, 96, {
      size: markSize,
      mono: true,
      letter: true,
      color: CREAM,
    });

    // Compact stats line, bottom-left; hashtag in amber.
    const totalM = completed.reduce((a, s) => a + s.distanceM, 0);
    const statsLine = `${(totalM / MI).toFixed(1)} mi · ${completed.length} ${
      completed.length === 1 ? "leg" : "legs"
    } · `;
    ctx.font = '400 26px "DM Mono", monospace';
    const statsW = ctx.measureText(statsLine).width;
    text(ctx, statsLine, 44, height - 52, {
      size: 26,
      mono: true,
      color: "rgba(245,242,236,0.92)",
    });
    text(ctx, TEAM_HASHTAG, 44 + statsW, height - 52, { size: 26, mono: true, color: AMBER });

    // REQUIRED basemap attribution, bottom-right.
    text(ctx, "© OpenStreetMap © CARTO", width - 18, height - 16, {
      size: 12,
      mono: true,
      align: "right",
      color: "rgba(245,242,236,0.6)",
    });

    // Taint check — toDataURL throws on a tainted canvas; catch → null.
    canvas.toDataURL("image/png");
    return canvas;
  } catch {
    return null;
  }
}
