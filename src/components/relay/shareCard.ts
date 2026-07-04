"use client";

/**
 * DTK share-card generator — draws a TRANSPARENT PNG overlay (1080×1920, IG
 * story size) on a canvas and downloads it. Meant to be layered over the
 * team's own photos/videos: no background, cream strokes/text with soft
 * shadows so it reads on anything.
 *
 * Two cards:
 *   - TEAM: the whole route so far (completed in runner colors + planned as a
 *     dotted line), covered miles, time left + expected finish.
 *   - LEG:  one leg's GPX drawn big, leg number, that run's miles, and the
 *     runner's name + total miles.
 *
 * Both render functions take `dark?: boolean` — when set, the #14120f page
 * background is baked in so the card posts as-is instead of overlaying.
 */
import type { RelayData } from "@/lib/relay";
import { TEAM_NAME, TEAM_TAG, TEAM_HASHTAG } from "@/lib/dtk";

const W = 1080;
const H = 1920;
const BG = "#14120f";
const CREAM = "#f5f2ec";
const AMBER = "#f0b060";

export type Pt = [number, number, number];

/** Project lat/lng points into a pixel box (their own bbox, aspect-correct,
 *  centered, north up). Exported for posterShare.ts, which reuses the same
 *  drawing primitives on a dark-background canvas. */
export function projectInto(
  points: Pt[],
  box: { x: number; y: number; w: number; h: number }
): { x: number; y: number }[] {
  let minLat = Infinity,
    maxLat = -Infinity,
    minLng = Infinity,
    maxLng = -Infinity;
  for (const p of points) {
    if (p[0] < minLat) minLat = p[0];
    if (p[0] > maxLat) maxLat = p[0];
    if (p[1] < minLng) minLng = p[1];
    if (p[1] > maxLng) maxLng = p[1];
  }
  const midLat = (minLat + maxLat) / 2;
  const mPerLat = 111_000;
  const mPerLng = 111_000 * Math.cos((midLat * Math.PI) / 180);
  const wM = Math.max((maxLng - minLng) * mPerLng, 1);
  const hM = Math.max((maxLat - minLat) * mPerLat, 1);
  const scale = Math.min(box.w / wM, box.h / hM);
  const ox = box.x + (box.w - wM * scale) / 2;
  const oy = box.y + (box.h - hM * scale) / 2;
  const out = points.map((p) => ({
    x: ox + (p[1] - minLng) * mPerLng * scale,
    y: oy + (maxLat - p[0]) * mPerLat * scale,
  }));

  // Belt-and-braces recentering: the meter math above should already center
  // the drawing, but rendered cards were visibly sitting off-center — so
  // measure the ACTUAL projected pixel bbox and translate it dead-center in
  // the requested box. A no-op when the math was right; a fix when it wasn't.
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of out) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  if (Number.isFinite(minX) && Number.isFinite(minY)) {
    const dx = box.x + (box.w - (maxX - minX)) / 2 - minX;
    const dy = box.y + (box.h - (maxY - minY)) / 2 - minY;
    if (dx !== 0 || dy !== 0) {
      for (const p of out) {
        p.x += dx;
        p.y += dy;
      }
    }
  }
  return out;
}

export function strokePath(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  opts: { color: string; width: number; dash?: number[] }
) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = opts.color;
  ctx.lineWidth = opts.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash(opts.dash ?? []);
  ctx.shadowColor = "rgba(0,0,0,.55)";
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.restore();
}

export function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  opts: { size: number; color?: string; mono?: boolean; align?: CanvasTextAlign; letter?: boolean }
) {
  ctx.save();
  ctx.fillStyle = opts.color ?? CREAM;
  ctx.textAlign = opts.align ?? "left";
  ctx.shadowColor = "rgba(0,0,0,.6)";
  ctx.shadowBlur = 14;
  const family = opts.mono ? '"DM Mono", monospace' : '"Fraunces", Georgia, serif';
  ctx.font = `${opts.mono ? 400 : 500} ${opts.size}px ${family}`;
  // Cheap letterspacing for the mono eyebrows. The per-character loop draws
  // left-to-right from a start x, so it must HONOR align itself — the naive
  // version started at x with align:center and shoved the whole string half
  // its width to the right (the "wordmark off-center" bug).
  if (opts.letter && opts.mono) {
    const gap = opts.size * 0.18;
    const chars = [...s];
    ctx.textAlign = "left";
    const total =
      chars.reduce((a, ch) => a + ctx.measureText(ch).width, 0) +
      gap * Math.max(0, chars.length - 1);
    let cx = x;
    if ((opts.align ?? "left") === "center") cx = x - total / 2;
    else if (opts.align === "right" || opts.align === "end") cx = x - total;
    for (const ch of chars) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + gap;
    }
  } else {
    ctx.fillText(s, x, y);
  }
  ctx.restore();
}

export function download(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, "image/png");
}

function makeCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  return ctx ? { canvas, ctx } : null;
}

/** Common DTK branding: wordmark top, hashtag bottom. */
function brand(ctx: CanvasRenderingContext2D) {
  text(ctx, `${TEAM_NAME.toUpperCase()} (${TEAM_TAG})`, W / 2, 150, {
    size: 34,
    mono: true,
    align: "center",
    letter: true,
    color: CREAM,
  });
  text(ctx, TEAM_HASHTAG, W / 2, H - 110, {
    size: 34,
    mono: true,
    align: "center",
    color: AMBER,
  });
}

const MI = 1609.34;

/** Whole-crossing card: route so far + covered miles + time left / finish.
 *  Draws onto a TRANSPARENT canvas by default (`dark` bakes the page bg in)
 *  and returns it (null if 2d ctx is unavailable) so callers can
 *  preview/copy it; `downloadTeamShareCard` wraps it with the PNG download. */
export function renderTeamShareCard(
  data: RelayData,
  opts?: { dark?: boolean }
): HTMLCanvasElement | null {
  const made = makeCanvas();
  if (!made) return null;
  const { canvas, ctx } = made;

  if (opts?.dark) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
  }

  brand(ctx);

  // Route: all points (completed + planned) share ONE projection so the shapes
  // line up; completed strokes per-runner color, planned dotted amber.
  const completed = data.segments.filter((s) => s.kind === "completed" && s.points.length > 1);
  const planned = data.segments.filter((s) => s.kind === "planned" && s.points.length > 1);
  const all = [...completed, ...planned].flatMap((s) => s.points);
  if (all.length > 1) {
    const box = { x: 140, y: 300, w: W - 280, h: 1050 };
    // Project once over the union bbox by projecting the concatenated list and
    // slicing it back per segment.
    const projected = projectInto(all, box);
    let cursor = 0;
    const colorByRunner = new Map(data.runners.map((r) => [r.id, r.color]));
    for (const s of completed) {
      const pts = projected.slice(cursor, cursor + s.points.length);
      cursor += s.points.length;
      strokePath(ctx, pts, {
        color: (s.runnerId && colorByRunner.get(s.runnerId)) || "#e8613c",
        width: 10,
      });
    }
    for (const s of planned) {
      const pts = projected.slice(cursor, cursor + s.points.length);
      cursor += s.points.length;
      strokePath(ctx, pts, { color: AMBER, width: 6, dash: [2, 26] });
    }
  }

  // Stats block.
  const t = data.totals;
  const coveredMi = (t.distanceM / MI).toFixed(1);
  text(ctx, `${coveredMi} mi`, W / 2, 1520, { size: 120, align: "center" });
  text(ctx, "ACROSS FRANCE SO FAR", W / 2, 1575, {
    size: 26,
    mono: true,
    align: "center",
    letter: true,
    color: "rgba(245,242,236,.75)",
  });

  const remainingM = t.plannedDistanceM > 0 ? Math.max(0, t.plannedDistanceM - t.distanceM) : null;
  const leftSec =
    remainingM !== null && t.paceSecPerKm !== null ? (remainingM / 1000) * t.paceSecPerKm : null;
  if (leftSec !== null) {
    const h = Math.floor(leftSec / 3600);
    const m = Math.round((leftSec % 3600) / 60);
    const eta = new Date(Date.now() + leftSec * 1000);
    text(ctx, `${h}h ${String(m).padStart(2, "0")}m left`, W / 2, 1690, {
      size: 64,
      align: "center",
      color: AMBER,
    });
    text(
      ctx,
      `finish ~ ${eta.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
      W / 2,
      1745,
      { size: 30, mono: true, align: "center", color: "rgba(245,242,236,.8)" }
    );
  }

  return canvas;
}

export function downloadTeamShareCard(data: RelayData): void {
  const canvas = renderTeamShareCard(data);
  if (!canvas) return;
  download(canvas, `dtk-crossing-${new Date().toISOString().slice(0, 10)}.png`);
}

export type LegCardArgs = {
  legNumber: number;
  legName: string | null;
  points: Pt[];
  distanceM: number;
  runnerName: string | null;
  runnerColor: string | null;
  runnerTotalM: number | null;
  /** Bake the dark page background in (default false → transparent overlay). */
  dark?: boolean;
};

/** Single-leg card: the leg's GPX big + leg #, its miles, runner name + total.
 *  Returns the canvas (null if a 2d ctx is unavailable) so callers can
 *  preview it before anything downloads. */
export function renderLegShareCard(args: LegCardArgs): HTMLCanvasElement | null {
  const made = makeCanvas();
  if (!made) return null;
  const { canvas, ctx } = made;

  if (args.dark) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
  }

  brand(ctx);

  if (args.points.length > 1) {
    const pts = projectInto(args.points, { x: 150, y: 340, w: W - 300, h: 980 });
    strokePath(ctx, pts, { color: args.runnerColor ?? "#e8613c", width: 14 });
    // Start/end dots.
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = 12;
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.arc(pts[pts.length - 1].x, pts[pts.length - 1].y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  text(ctx, `LEG ${args.legNumber}`, W / 2, 1450, {
    size: 30,
    mono: true,
    align: "center",
    letter: true,
    color: "rgba(245,242,236,.75)",
  });
  text(ctx, `${(args.distanceM / MI).toFixed(1)} mi`, W / 2, 1580, { size: 130, align: "center" });
  if (args.runnerName) {
    text(ctx, args.runnerName, W / 2, 1680, {
      size: 52,
      align: "center",
      color: args.runnerColor ?? CREAM,
    });
    if (args.runnerTotalM !== null) {
      text(ctx, `${(args.runnerTotalM / MI).toFixed(1)} mi total this crossing`, W / 2, 1730, {
        size: 28,
        mono: true,
        align: "center",
        color: "rgba(245,242,236,.8)",
      });
    }
  }

  return canvas;
}

/** Canonical filename for a leg card PNG. */
export function legShareFilename(args: {
  legName: string | null;
  legNumber: number;
  dark?: boolean;
}): string {
  const slug = (args.legName ?? `leg-${args.legNumber}`).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `dtk-${slug}${args.dark ? "-dark" : ""}.png`;
}

export function downloadLegShareCard(args: LegCardArgs): void {
  const canvas = renderLegShareCard(args);
  if (!canvas) return;
  download(canvas, legShareFilename(args));
}
