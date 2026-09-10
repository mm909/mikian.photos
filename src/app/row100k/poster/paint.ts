/* poster/paint.ts — THE PAINT HELPER (types.ts PosterPaint), built once per
 * render and handed to every module.
 *
 * Nothing here is new drawing: the text engine is post/slides.ts's
 * (boxFor, metricsOf, baselineOf, hasLetterSpacing, measure, drawText,
 * drawCentered, drawRight, ellipsize, rule, dottedRule) and the blackout
 * blocks are share/cards.ts's (drawBlockShape geometry, blockDigitsWidth,
 * kLabel, medalColor, the September calendar constants), copied with the
 * source named at each function so a fix there can be carried here. Both
 * sources are left untouched — the slides are the DARK photo idiom and the
 * cards are stickers; the posters are the PAPER idiom of the site itself,
 * so every colour is re-parameterised for cream and there is no shadow
 * anywhere (shadowBlur ignores the CTM and would smear at 300 ppi anyway).
 *
 * Fonts are the hashed next/font families read off the studio's DOM
 * probes; never a literal family name. Text is positioned by the DOM
 * line-box ratios (metricsOf / baselineOf), tracked through
 * ctx.letterSpacing with the per-glyph fallback, and NEVER through
 * fillText's maxWidth — it condenses glyphs, which shows on a 24x36. */

import { clockShape } from "@/lib/blackoutRules";
import { drawBlockClock, drawBlockDigits } from "../share/cards";
import type {
  Figure,
  FontBox,
  PosterAssets,
  PosterBlockOpts,
  PosterChipKind,
  PosterFace,
  PosterFonts,
  PosterFormat,
  PosterMetrics,
  PosterPaint,
  PosterTokens,
} from "./types";

type Ctx = CanvasRenderingContext2D;

/* ------------------------------------------------------------- palette */

/* theme.ts on paper (SPEC.md §4). Exported so the module streams draw
 * from one palette; nothing on the sheet is a colour outside this list
 * except the Grizzly plate. */
export const PAPER = "#F4F3EE";
export const INK = "#15171A";
export const INK_SOFT = "#3b3e42";
export const GRAY = "#8a8a85";
export const LINE = "#c9c8c0";
export const GRID = "#dddbd2";
export const WATER = "#0077B6";
export const WATER_PALE = "#e3eef5";
export const WATER_AREA = "rgba(0,119,182,.08)";
export const WATER_BAR = "rgba(0,119,182,.32)";
export const WATER_BAND = "rgba(0,119,182,.10)";
export const WATER_BAND_SOFT = "rgba(0,119,182,.06)";
/* The calendar ramp, lightest first; the top bucket is water and its day
 * number is the ONE white glyph on paper (theme.ts .hm-num). */
export const HEAT = ["#d9e8f2", "#a5cde3", "#4d9fc9", WATER] as const;
export const MEDAL_GOLD = "#D4AF37";
export const MEDAL_SILVER = "#C0C0C0";
export const MEDAL_BRONZE = "#CD7F32";
/* The partner plate — the only dark surface on the sheet. */
export const GZ_GREEN = "#0c2015";
export const GZ_EDGE = "#06130c";
export const GZ_CREAM = "#f2ead7";
export const GZ_SAGE = "#a9bba6";
export const GZ_GOLD = "#d3ab5d";
export const WHITE = "#ffffff";

/* share/cards.ts medalColor: a place's chip colour, or null past bronze. */
export const medalColor = (place: number): string | null =>
  place === 1 ? MEDAL_GOLD : place === 2 ? MEDAL_SILVER : place === 3 ? MEDAL_BRONZE : null;

/* share/cards.ts kLabel: "561k" for a day, rolling to "1.2M" past a
 * million combined meters. */
export const kLabel = (m: number): string =>
  m >= 999_500 ? `${(m / 1_000_000).toFixed(1)}M` : `${Math.max(1, Math.round(m / 1000))}k`;

/* share/cards.ts: Sep 1, 2026 is a Tuesday; grids run Sunday-first. */
export const SEP_FIRST_DOW = 2;
export const DOW_LETTERS = ["S", "M", "T", "W", "T", "F", "S"] as const;

/* ------------------------------------------------------------ type box */

/* post/slides.ts boxFor — which family a font shorthand names. Black is
 * checked first: its family name contains the plain Archivo one. */
export function boxFor(fonts: PosterFonts, font: string): FontBox | undefined {
  const box = fonts.box;
  if (!box) return undefined;
  if (font.includes(fonts.black)) return box.black;
  if (font.includes(fonts.mono)) return box.mono;
  if (font.includes(fonts.archivo)) return box.archivo;
  return undefined;
}

/* post/slides.ts metricsOf — the font's own line box at this size, from
 * the DOM-measured ratios; canvas fontBoundingBox* as the fallback (it is
 * the ink box, a touch tall), then rough mono-ish ratios. */
export function metricsOf(ctx: Ctx, fonts: PosterFonts, font: string, size: number): PosterMetrics {
  const ratio = boxFor(fonts, font);
  if (ratio) {
    const asc = ratio.baseline * size;
    const lh = ratio.lh * size;
    return { asc, desc: lh - asc, lh };
  }
  ctx.font = font;
  const m = ctx.measureText("Hxdgp");
  const rawAsc = m.fontBoundingBoxAscent;
  const rawDesc = m.fontBoundingBoxDescent;
  const asc = Number.isFinite(rawAsc) && rawAsc > 0 ? rawAsc : size * 1.05;
  const desc = Number.isFinite(rawDesc) && rawDesc > 0 ? rawDesc : size * 0.32;
  return { asc, desc, lh: asc + desc };
}

/* post/slides.ts baselineOf — half-leading: the glyph box centred in the
 * line box, which is how a heading with line-height under 1 still sits
 * where CSS put it. */
export function baselineOf(top: number, lh: number, m: PosterMetrics): number {
  return top + (lh - (m.asc + m.desc)) / 2 + m.asc;
}

/* post/slides.ts hasLetterSpacing. */
export function hasLetterSpacing(ctx: Ctx): boolean {
  return typeof ctx.letterSpacing === "string";
}

/* post/slides.ts measure — the width WITH its tracking (the trailing
 * space after the last glyph included, exactly like CSS). */
export function measure(ctx: Ctx, text: string, font: string, tracking = 0): number {
  ctx.font = font;
  if (!tracking) return ctx.measureText(text).width;
  if (hasLetterSpacing(ctx)) {
    ctx.letterSpacing = `${tracking}px`;
    const w = ctx.measureText(text).width;
    ctx.letterSpacing = "0px";
    return w;
  }
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + tracking;
  return w;
}

/* post/slides.ts drawText — returns the width so a run can advance. */
export function drawText(
  ctx: Ctx,
  text: string,
  x: number,
  baseline: number,
  font: string,
  color: string,
  tracking = 0,
): number {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  if (!tracking) {
    ctx.fillText(text, x, baseline);
    return ctx.measureText(text).width;
  }
  if (hasLetterSpacing(ctx)) {
    ctx.letterSpacing = `${tracking}px`;
    ctx.fillText(text, x, baseline);
    const w = ctx.measureText(text).width;
    ctx.letterSpacing = "0px";
    return w;
  }
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, baseline);
    cx += ctx.measureText(ch).width + tracking;
  }
  return cx - x;
}

/* post/slides.ts drawCentered / drawRight. */
export function drawCentered(
  ctx: Ctx,
  text: string,
  cx: number,
  baseline: number,
  font: string,
  color: string,
  tracking = 0,
): number {
  const w = measure(ctx, text, font, tracking);
  drawText(ctx, text, cx - w / 2, baseline, font, color, tracking);
  return w;
}

export function drawRight(
  ctx: Ctx,
  text: string,
  right: number,
  baseline: number,
  font: string,
  color: string,
  tracking = 0,
): number {
  const w = measure(ctx, text, font, tracking);
  drawText(ctx, text, right - w, baseline, font, color, tracking);
  return w;
}

/* post/slides.ts Run / runsWidth / drawRuns — one baseline, mixed colour
 * or face (the label line with its one bold ink run). Exported for the
 * module streams; not part of the PosterPaint interface. */
export type Run = { text: string; color: string; font?: string; tracking?: number };

export function runsWidth(ctx: Ctx, runs: Run[], font: string, tracking = 0): number {
  return runs.reduce((w, r) => w + measure(ctx, r.text, r.font ?? font, r.tracking ?? tracking), 0);
}

export function drawRuns(
  ctx: Ctx,
  runs: Run[],
  x: number,
  baseline: number,
  font: string,
  tracking = 0,
): number {
  let cx = x;
  for (const r of runs) {
    const f = r.font ?? font;
    const t = r.tracking ?? tracking;
    drawText(ctx, r.text, cx, baseline, f, r.color, t);
    cx += measure(ctx, r.text, f, t);
  }
  return cx - x;
}

/* post/slides.ts ellipsize, made tracking-aware: measured with the same
 * tracking it will be drawn with, so a tracked eyebrow descriptor never
 * runs into its neighbour (ledger-design graft, SPEC.md §0). */
export function ellipsize(ctx: Ctx, text: string, maxW: number, font: string, tracking = 0): string {
  if (measure(ctx, text, font, tracking) <= maxW) return text;
  let t = text;
  while (t.length > 1 && measure(ctx, `${t.trimEnd()}…`, font, tracking) > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/* post/slides.ts rule — a solid rule; ink unless told otherwise. */
export function rule(ctx: Ctx, x: number, y: number, w: number, h: number, color: string = INK): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/* The 1-unit dashed hairline in --line, [3,3] — table rows and rest days. */
export function dashedRule(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  color: string = LINE,
  weight = 1,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = weight;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(x, y + weight / 2);
  ctx.lineTo(x + w, y + weight / 2);
  ctx.stroke();
  ctx.restore();
}

/* post/slides.ts dottedRule, as the 2-unit dotted leader of the .bl
 * ledger (gray, [2, 3.2]). */
export function dottedRule(ctx: Ctx, x1: number, x2: number, y: number, color: string = GRAY): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([2, 3.2]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

/* share/cards.ts drawBlockShape — a block in every `#` cell (0.6 × size
 * cell, block 0.54 wide and 0.92 tall on the baseline), every other glyph
 * — a colon, a point, a comma, a unit — as the real mono glyph; matte ink,
 * no shadow. `paint: false` only measures. Returns the width. */
export function drawBlockShape(
  ctx: Ctx,
  x: number,
  y: number,
  shape: string,
  size: number,
  fonts: PosterFonts,
  opts: PosterBlockOpts = {},
): number {
  const cell = size * 0.6;
  const gap = size * 0.06;
  const block = cell - gap;
  const chars = [...(shape || "#")];
  ctx.save();
  ctx.font = `${size}px ${fonts.mono}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const width = chars.reduce((w, ch) => w + (ch === "#" ? cell : ctx.measureText(ch).width), 0);
  if (opts.paint !== false) {
    const start = opts.align === "right" ? x - width : opts.align === "center" ? x - width / 2 : x;
    ctx.fillStyle = opts.fill ?? INK;
    let cx = start;
    for (const ch of chars) {
      if (ch === "#") {
        ctx.fillRect(cx + gap / 2, y - size * 0.88, block, size * 0.92);
        cx += cell;
      } else {
        ctx.fillText(ch, cx, y);
        cx += ctx.measureText(ch).width;
      }
    }
  }
  ctx.restore();
  return width;
}

/* share/cards.ts blockDigitsWidth — what drawBlockDigits will take. */
export function blockDigitsWidth(ctx: Ctx, digits: number, size: number, fonts: PosterFonts): number {
  const n = Math.max(1, Math.floor(digits));
  ctx.save();
  ctx.font = `${size}px ${fonts.mono}`;
  const commaW = ctx.measureText(",").width;
  ctx.restore();
  return n * size * 0.6 + Math.floor((n - 1) / 3) * commaW;
}

/* ------------------------------------------------------------ the paint */

export type PaintInput = {
  tk: PosterTokens;
  format: PosterFormat;
  fonts: PosterFonts;
  assets: PosterAssets;
};

/* Face → ctx.font shorthand, the hashed family LAST so boxFor matches it
 * by substring. Weight first, the way the CSS shorthand wants it. */
export function fontFor(fonts: PosterFonts, face: PosterFace, size: number): string {
  switch (face) {
    case "black":
      return `${size}px ${fonts.black}`;
    case "mono":
      return `400 ${size}px ${fonts.mono}`;
    case "monoBold":
      return `700 ${size}px ${fonts.mono}`;
    case "archivo":
      return `400 ${size}px ${fonts.archivo}`;
    case "archivoSemi":
      return `600 ${size}px ${fonts.archivo}`;
    case "archivoBold":
      return `700 ${size}px ${fonts.archivo}`;
  }
}

/* The chip: the site's .dtag — a filled medal with ink text, the gray
 * outline chip for #4+, and the ink pace chip with paper text an elite
 * row wears. Sized off the mono row × .86 so it sits on a table row. */
function chipColors(kind: PosterChipKind): { fill: string | null; edge: string; text: string } {
  switch (kind) {
    case "gold":
      return { fill: MEDAL_GOLD, edge: MEDAL_GOLD, text: INK };
    case "silver":
      return { fill: MEDAL_SILVER, edge: MEDAL_SILVER, text: INK };
    case "bronze":
      return { fill: MEDAL_BRONZE, edge: MEDAL_BRONZE, text: INK };
    case "outline":
      return { fill: null, edge: GRAY, text: GRAY };
    case "pace":
      return { fill: INK, edge: INK, text: PAPER };
  }
}

export function makePaint(input: PaintInput): PosterPaint {
  const { tk, format, fonts, assets } = input;
  const font = (face: PosterFace, size: number) => fontFor(fonts, face, size);

  const paint: PosterPaint = {
    tk,
    format,
    fonts,
    assets,
    font,
    metricsOf: (ctx, f, size) => metricsOf(ctx, fonts, f, size),
    baselineOf,
    measure,
    drawText,
    drawCentered,
    drawRight,
    ellipsize,

    /* Shrink-to-fit: the largest integer size in [minSize, maxSize] at
     * which `text` fits `maxW`. `tracking` is an EM FRACTION here (−0.02
     * for the nameplate), not px: the fit re-measures at every size and
     * the tracking must scale with it. Measured once at 100 px and
     * scaled — text width is linear in size. */
    fitSize: (ctx, text, face, maxSize, minSize, maxW, tracking = 0) => {
      const w = measure(ctx, text, font(face, 100), tracking * 100);
      const fit = Math.floor((100 * maxW) / Math.max(1, w));
      return Math.max(minSize, Math.min(maxSize, fit));
    },

    /* Greedy word wrap at the font; a word wider than the measure stands
     * alone on its line rather than breaking mid-word. */
    wrap: (ctx, text, maxW, f, tracking = 0) => {
      const words = text.split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      let line = "";
      for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (line && measure(ctx, next, f, tracking) > maxW) {
          lines.push(line);
          line = w;
        } else {
          line = next;
        }
      }
      if (line) lines.push(line);
      return lines;
    },

    rule,
    dashedRule,
    dottedRule,

    blocks: (ctx, x, baseline, shape, size, opts) =>
      drawBlockShape(ctx, x, baseline, shape, size, fonts, opts),

    /* share/cards.ts drawBlockDigits (imported): one block per digit with
     * real commas. cards.ts aligns left or right; centre is done here by
     * measuring first. */
    blockDigits: (ctx, x, baseline, digits, size, opts = {}) => {
      const w = blockDigitsWidth(ctx, digits, size, fonts);
      if (opts.paint === false) return w;
      const left = opts.align === "right" ? x - w : opts.align === "center" ? x - w / 2 : x;
      drawBlockDigits(ctx, left, baseline, digits, size, fonts, { fill: opts.fill });
      return w;
    },

    /* share/cards.ts drawBlockClock (imported) for seconds; a ready clock
     * shape ("#:##:##") goes through the shape drawer. */
    blockClock: (ctx, x, baseline, secondsOrShape, size, opts = {}) => {
      if (typeof secondsOrShape === "string") {
        return drawBlockShape(ctx, x, baseline, secondsOrShape, size, fonts, opts);
      }
      if (opts.paint === false) {
        return drawBlockShape(ctx, x, baseline, clockShape(secondsOrShape), size, fonts, { paint: false });
      }
      return drawBlockClock(ctx, x, baseline, secondsOrShape, size, fonts, {
        align: opts.align,
        fill: opts.fill,
      });
    },

    /* A Figure in one call: text in the font and colour asked for, or its
     * shape as blocks at `size` — matte ink whatever the text's colour
     * would have been (blocks are never water). */
    figure: (ctx, fig, x, baseline, f, size, color, opts = {}) => {
      if (fig.shape !== undefined) {
        return drawBlockShape(ctx, x, baseline, fig.shape, size, fonts, {
          align: opts.align,
          fill: opts.fill,
          paint: opts.paint,
        });
      }
      const text = fig.text;
      const tracking = opts.tracking ?? 0;
      const w = measure(ctx, text, f, tracking);
      if (opts.paint === false) return w;
      const left = opts.align === "right" ? x - w : opts.align === "center" ? x - w / 2 : x;
      drawText(ctx, text, left, baseline, f, color, tracking);
      return w;
    },

    /* The .pf-eye line: bold mono uppercase ink left, gray descriptor
     * right (ellipsized with its tracking after trying `rightShort`),
     * hairline under at eye × 0.7, 1.1 × eye of air. Returns the y under
     * it. The owner's block title — "the stats page spent too much room on
     * titles"; no h2s, no boxes. */
    eyebrow: (ctx, x, y, w, left, right, rightShort) => {
      const eye = tk.eye;
      const bold = font("monoBold", eye);
      const plain = font("mono", eye);
      const m = metricsOf(ctx, fonts, bold, eye);
      const base = y + m.asc;
      const L = left.toUpperCase();
      const lw = drawText(ctx, L, x, base, bold, INK, 0.16 * eye);
      if (right) {
        const maxW = w - lw - eye * 2.4;
        const tr = 0.12 * eye;
        let R = right.toUpperCase();
        if (measure(ctx, R, plain, tr) > maxW && rightShort) R = rightShort.toUpperCase();
        R = ellipsize(ctx, R, maxW, plain, tr);
        if (maxW > eye * 2) drawRight(ctx, R, x + w, base, plain, GRAY, tr);
      }
      const ry = base + eye * 0.7;
      rule(ctx, x, ry, w, tk.hair);
      return ry + tk.hair + eye * 1.1;
    },

    chip: (ctx, x, baseline, text, kind) => {
      const size = tk.row * 0.86;
      const f = font("monoBold", size);
      const c = chipColors(kind);
      const padX = size * 0.5;
      const tw = measure(ctx, text, f, 0.06 * size);
      const w = tw + padX * 2;
      const h = size * 1.5;
      const top = baseline - size * 0.78 - (h - size) / 2;
      ctx.save();
      if (c.fill) {
        ctx.fillStyle = c.fill;
        ctx.fillRect(x, top, w, h);
      } else {
        ctx.strokeStyle = c.edge;
        ctx.lineWidth = Math.max(1, tk.hair);
        ctx.strokeRect(x + 0.5, top + 0.5, w - 1, h - 1);
      }
      ctx.restore();
      drawText(ctx, text, x + padX, baseline, f, c.text, 0.06 * size);
      return w;
    },

    image: (ctx, img, x, y, w, h) => {
      if (!img || !img.naturalWidth) return;
      ctx.drawImage(img, x, y, w, h);
    },
  };
  return paint;
}
