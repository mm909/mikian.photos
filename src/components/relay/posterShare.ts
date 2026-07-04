"use client";

/**
 * "Share the crossing" poster — a DARK 1080×1350 (IG portrait) PNG of the
 * completed legs, rendered on demand for the stats page. Unlike shareCard.ts
 * (transparent story overlays), the #14120f background is BAKED IN so the
 * image posts as-is.
 *
 * Two layouts:
 *   - "map":  every leg in ONE shared projection, as they sit geographically
 *             (the big poster, in canvas form).
 *   - "grid": small multiples — each leg projected into its OWN tile bbox
 *             (the LegGrid math), auto grid up to 8 columns, stroked in the
 *             runner's color. No captions, chronological leg order — at 60+
 *             legs labels overlapped into mush (owner feedback), so the grid
 *             reads as clean texture instead.
 *
 * Options: `transparent` skips the baked-in background (PNG with alpha for
 * overlay use); `focusRunnerId` renders like the on-page filtered poster —
 * that runner full color, everyone else dimmed to ~8% as context, footer
 * recaptioned "N legs by <name> · #DowntownKruz" with THEIR miles.
 *
 * Reuses shareCard.ts's canvas primitives (projectInto / strokePath / text)
 * so the two families of cards stay visually consistent.
 */

import type { RelaySegmentDto, RelayRunnerDto } from "@/lib/relay";
import { TEAM_NAME, TEAM_TAG, TEAM_HASHTAG } from "@/lib/dtk";
import { projectInto, strokePath, text } from "./shareCard";

const W = 1080;
const H = 1350;
const BG = "#14120f";
const CREAM = "#f5f2ec";
const MUTED = "#9a9186";
const AMBER = "#f0b060";
const HAIR = "rgba(245,242,236,0.12)";
const MI = 1609.34;

export type PosterLayout = "map" | "grid";

export type PosterOptions = {
  /** The team's completed legs, in chronological (leg) order. */
  segments: RelaySegmentDto[];
  runners: RelayRunnerDto[];
  layout: PosterLayout;
  /** Skip the baked-in dark bg + radial → transparent PNG (overlay use). */
  transparent?: boolean;
  /** When set, that runner's legs stay full color and everyone else dims to
   *  ~8% opacity (still visible as context) — the on-page filtered poster. */
  focusRunnerId?: string | null;
};

type LegDraw = {
  seg: RelaySegmentDto;
  color: string;
  runnerName: string | null;
  /** Team-wide chronological leg number (1-based; survives grid sorting). */
  legNumber: number;
  /** True when a focus runner is set and this leg isn't theirs. */
  dimmed: boolean;
};
type Box = { x: number; y: number; w: number; h: number };

/** Opacity for non-focused context lines. */
const DIM = 0.08;

function decimate<T>(pts: T[], max: number): T[] {
  if (pts.length <= max) return pts;
  const step = Math.ceil(pts.length / max);
  const out: T[] = [];
  for (let i = 0; i < pts.length; i += step) out.push(pts[i]);
  if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
  return out;
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Truly centered letterspaced mono line (shareCard's `text` letter mode
 *  advances from x, so we measure the spaced width first). */
function centeredLetterText(
  ctx: CanvasRenderingContext2D,
  s: string,
  y: number,
  size: number,
  color: string
) {
  ctx.font = `400 ${size}px "DM Mono", monospace`;
  const spacing = size * 0.18;
  let w = 0;
  for (const ch of s) w += ctx.measureText(ch).width + spacing;
  w = Math.max(0, w - spacing);
  text(ctx, s, (W - w) / 2, y, { size, mono: true, letter: true, align: "left", color });
}


/** All legs in one shared projection — glow pass + crisp pass per leg.
 *  Dimmed (non-focus) legs draw first, faint and glowless, so the focused
 *  runner's lines sit on top. */
function drawMap(ctx: CanvasRenderingContext2D, legs: LegDraw[], box: Box) {
  const per = legs.map((l) => ({ ...l, pts: decimate(l.seg.points, 700) }));
  const all = per.flatMap((p) => p.pts);
  if (all.length < 2) return;
  const projected = projectInto(all, box);
  let cursor = 0;
  const drawn = per.map((p) => {
    const pixels = projected.slice(cursor, cursor + p.pts.length);
    cursor += p.pts.length;
    return { ...p, pixels };
  });
  for (const p of drawn) {
    if (!p.dimmed) continue;
    ctx.globalAlpha = DIM;
    strokePath(ctx, p.pixels, { color: p.color, width: 4 });
    ctx.globalAlpha = 1;
  }
  for (const p of drawn) {
    if (p.dimmed) continue;
    ctx.globalAlpha = 0.22;
    strokePath(ctx, p.pixels, { color: p.color, width: 15 });
    ctx.globalAlpha = 1;
    strokePath(ctx, p.pixels, { color: p.color, width: 5 });
  }
}

/** Small multiples — each leg in its own tile bbox (LegGrid, canvas form).
 *  NO captions and NO custom ordering: the labels overlapped into mush at
 *  60+ legs (owner feedback), so tiles are clean glyphs in chronological
 *  leg order — the poster reads as texture, not a table. */
function drawGrid(ctx: CanvasRenderingContext2D, legs: LegDraw[], box: Box) {
  const n = legs.length;
  if (n === 0) return;
  // Without captions the tiles can be denser: up to 8 columns.
  const cols = Math.min(8, Math.max(1, Math.ceil(Math.sqrt(n))));
  const rows = Math.ceil(n / cols);
  const gap = 16;
  const tile = Math.max(
    24,
    Math.min((box.w - gap * (cols - 1)) / cols, (box.h - gap * (rows - 1)) / rows)
  );
  const gridW = cols * tile + gap * (cols - 1);
  const gridH = rows * tile + gap * (rows - 1);
  const ox = box.x + (box.w - gridW) / 2;
  const oy = box.y + (box.h - gridH) / 2;

  legs.forEach((l, i) => {
    const tx = ox + (i % cols) * (tile + gap);
    const ty = oy + Math.floor(i / cols) * (tile + gap);

    // Tile chrome.
    ctx.save();
    ctx.globalAlpha = l.dimmed ? 0.45 : 1;
    roundedRectPath(ctx, tx, ty, tile, tile, tile * 0.09);
    ctx.fillStyle = "rgba(245,242,236,0.03)";
    ctx.fill();
    ctx.strokeStyle = HAIR;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    if (l.seg.points.length < 2) return; // empty tile, numbering preserved

    const pad = tile * 0.16;
    const pts = projectInto(decimate(l.seg.points, 300), {
      x: tx + pad,
      y: ty + pad,
      w: tile - 2 * pad,
      h: tile - 2 * pad,
    });

    if (l.dimmed) {
      // Context only: faint crisp line, no glow, no start dot.
      ctx.globalAlpha = DIM;
      strokePath(ctx, pts, { color: l.color, width: Math.max(2.5, tile * 0.024) });
      ctx.globalAlpha = 1;
      return;
    }

    ctx.globalAlpha = 0.18;
    strokePath(ctx, pts, { color: l.color, width: Math.max(6, tile * 0.055) });
    ctx.globalAlpha = 1;
    strokePath(ctx, pts, { color: l.color, width: Math.max(2.5, tile * 0.024) });

    // Start dot.
    ctx.save();
    ctx.fillStyle = CREAM;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, Math.max(3, tile * 0.025), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

/** Draw the DTK poster and return the canvas (never throws; if a 2d
 *  context can't be had, the canvas comes back blank). */
export function renderPosterCard(opts: PosterOptions): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // Dark background BAKED IN by default + the same soft rust radial the
  // on-page poster frame uses; `transparent` skips both → PNG with alpha.
  if (!opts.transparent) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    const grad = ctx.createRadialGradient(W / 2, H * 0.16, 0, W / 2, H * 0.16, W * 0.75);
    grad.addColorStop(0, "rgba(232,97,60,0.07)");
    grad.addColorStop(1, "rgba(20,18,15,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  const focusId = opts.focusRunnerId ?? null;
  const colorOf = new Map(opts.runners.map((r) => [r.id, r.color]));
  const nameOf = new Map(opts.runners.map((r) => [r.id, r.name]));
  const legs: LegDraw[] = opts.segments
    .filter((s) => s.kind === "completed")
    .map((s, i) => ({
      seg: s,
      color: (s.runnerId && colorOf.get(s.runnerId)) || CREAM,
      runnerName: (s.runnerId && nameOf.get(s.runnerId)) || null,
      legNumber: i + 1,
      dimmed: focusId !== null && s.runnerId !== focusId,
    }));
  const drawable = legs.filter((l) => l.seg.points.length > 1);

  // Brand, top.
  centeredLetterText(ctx, `${TEAM_NAME.toUpperCase()} (${TEAM_TAG})`, 118, 30, CREAM);

  // The art.
  const box: Box = { x: 90, y: 190, w: W - 180, h: 880 };
  if (drawable.length === 0) {
    text(ctx, "No completed legs yet.", W / 2, box.y + box.h / 2, {
      size: 26,
      mono: true,
      align: "center",
      color: MUTED,
    });
  } else if (opts.layout === "map") {
    drawMap(ctx, drawable, box);
  } else {
    // Chronological (leg-number) order — the legs arrive that way already.
    drawGrid(ctx, drawable, box);
  }

  // Footer: total miles + "N completed legs · #DowntownKruz" — or, with a
  // focus runner, THEIR miles + "N legs by <name> · #DowntownKruz".
  const focusRunner = focusId ? (opts.runners.find((r) => r.id === focusId) ?? null) : null;
  const counted = focusRunner ? legs.filter((l) => l.seg.runnerId === focusRunner.id) : legs;
  const totalM = counted.reduce((a, l) => a + l.seg.distanceM, 0);
  text(ctx, `${(totalM / MI).toFixed(1)} mi`, W / 2, 1205, { size: 104, align: "center" });
  const legLine = focusRunner
    ? `${counted.length} ${counted.length === 1 ? "leg" : "legs"} by ${focusRunner.name} · `
    : `${counted.length} completed ${counted.length === 1 ? "leg" : "legs"} · `;
  ctx.font = '400 27px "DM Mono", monospace';
  const w1 = ctx.measureText(legLine).width;
  const w2 = ctx.measureText(TEAM_HASHTAG).width;
  const startX = (W - (w1 + w2)) / 2;
  text(ctx, legLine, startX, 1268, {
    size: 27,
    mono: true,
    align: "left",
    color: "rgba(245,242,236,.75)",
  });
  text(ctx, TEAM_HASHTAG, startX + w1, 1268, { size: 27, mono: true, align: "left", color: AMBER });

  return canvas;
}

/** PNG → clipboard via ClipboardItem. Resolves false (never throws) when the
 *  browser doesn't support it or the write is refused — callers fall back to
 *  a download. */
export async function canvasToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return false;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return false;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}
