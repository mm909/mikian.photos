/* poster/paint.ts — THE PAINT HELPER (types.ts PosterPaint), built once per
 * render and handed to every module.
 *
 * Nothing here is new drawing: the text engine is post/slides.ts's
 * (boxFor, metricsOf, baselineOf, hasLetterSpacing, measure, drawText,
 * drawCentered, drawRight, ellipsize, rule, dottedRule) and the blackout
 * blocks are share/cards.ts's (drawBlockShape geometry, blockDigitsWidth,
 * kLabel, the September calendar constants), copied with the source named
 * at each function so a fix there can be carried here. Both sources are
 * left untouched — the slides are the DARK photo idiom and the cards are
 * stickers; the posters are the PAPER idiom of the site itself, so every
 * colour is re-parameterised and there is no shadow anywhere (shadowBlur
 * ignores the CTM and would smear at 300 ppi anyway).
 *
 * TWO STOCKS since 2026-09-12: the module constants below are the CREAM
 * table's values and nothing else reads them. Everything that draws reaches
 * colour through `paint.c` (types.ts PosterPalette), resolved once per
 * render from PaintInput.stock, because a module-level constant cannot be
 * two things at once. The colour names are no longer imported by the
 * drawing files ON PURPOSE — a missed conversion site has to be a compile
 * error, since ink-on-ink is invisible and cream-on-ink is a glaring band
 * and neither is something a type checker would otherwise catch.
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
  PosterChipPaint,
  PosterFace,
  PosterFonts,
  PosterFormat,
  PosterMetrics,
  PosterPaint,
  PosterPalette,
  PosterStock,
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

/* ------------------------------------------------------- the two stocks */

/* THE BLACK STOCK (owner, 2026-09-12: "we also need black and white
 * shareable versions of all the posters to match the race day aesthetic").
 * The constants above are still the only place a cream colour is written
 * down; CREAM below just names them by the palette's fields, so the cream
 * sheet is byte-identical to the one that shipped.
 *
 * THE ONE STRUCTURAL MOVE, and the whole design in a sentence. On cream,
 * ink is 16.16:1 against paper and water is 4.38:1 — the accent is the
 * LOWER-contrast mark and wins by HUE. Take the hue away and contrast is
 * the only thing left to carry it, so on bw `water` goes to the TOP of the
 * ladder as pure white and `ink` steps down one rung to .74. That is race
 * day's own arrangement (raceday.ts: WHITE for the OPT IN slab, the thick
 * rules and the wave cell; BONE .74 for body copy). A palette that maps
 * ink → white 1:1 has nothing left for the accent and is the cream poster
 * with its colours swapped, which is not what he asked for. */

/* THE BW GROUND is race day's own ink, so the two subjects hang together. */
const BW_INK = "#15171A";
/* Every bw tone is WHITE AT AN ALPHA — race day's grey ladder, rung for
 * rung, and every ratio below is WCAG relative luminance alpha-composited
 * over #15171A first, computed and not estimated:
 *
 *   white           17.96:1   the ACCENT
 *   .74             10.15:1   body, names, strip numbers, rules, blocks
 *   .62              7.44:1   datelines, ledger keys, log times
 *   .5               5.26:1   descriptors, places, axes, meta, the #4+ chip
 *   .3               2.70:1   rules
 *   .18              1.75:1   rules
 *
 * NOTHING UNDER .5 EVER CARRIES A LETTER, with ONE documented exception so
 * that it is a decision and not a slip: the date inside an EMPTY FUTURE DAY
 * draws in `line` at .30 / 2.70:1. It is a placeholder on an empty cell, and
 * the cream sheet draws that same glyph at 1.51:1 — the black sheet is the
 * more legible of the two.
 *
 * The bw greys read louder than the cream ones (5.26 against 3.12 for the
 * same role). Deliberate: 3.12:1 is a print-on-matte-cream value read at six
 * feet, and the ask was for SHAREABLE versions read on a phone. */
const BW_W = (a: number): string => `rgba(255,255,255,${a})`;

/* The washes need no invented number: each is a PERCENTAGE OF THE ACCENT,
 * and the accent is what changed. 32 % of it for an hour bar, 100 % for the
 * peak bar, on both stocks. */

export const CREAM: PosterPalette = {
  paper: PAPER,
  ink: INK,
  inkSoft: INK_SOFT,
  gray: GRAY,
  line: LINE,
  grid: GRID,
  water: WATER,
  waterArea: WATER_AREA,
  waterBar: WATER_BAR,
  waterBand: WATER_BAND,
  waterBandSoft: WATER_BAND_SOFT,
  /* The shipped ramp, with the label colour it always had: ink on the
   * three blues, white on water. Steps 1.35 / 1.75 / 1.65 apart. */
  ramp: [
    { fill: HEAT[0], on: INK },
    { fill: HEAT[1], on: INK },
    { fill: HEAT[2], on: INK },
    { fill: HEAT[3], on: WHITE },
  ],
  /* A 1-unit line outline so the first bucket survives matte stock. */
  cellEdge: LINE,
  gold: MEDAL_GOLD,
  silver: MEDAL_SILVER,
  bronze: MEDAL_BRONZE,
  chipInk: INK,
  /* Filled in the TYPE colour with GROUND-coloured text. On cream that can
   * never be read as a medal, because a medal is a hue. */
  paceChip: { fill: INK, edge: INK, text: PAPER },
  plateEdge: GZ_EDGE,
  gzGreen: GZ_GREEN,
  gzDark: GZ_EDGE,
  gzCream: GZ_CREAM,
  gzSage: GZ_SAGE,
  gzGold: GZ_GOLD,
};

export const BW: PosterPalette = {
  paper: BW_INK,
  ink: BW_W(0.74),
  inkSoft: BW_W(0.62),
  gray: BW_W(0.5),
  line: BW_W(0.3),
  grid: BW_W(0.18),
  water: WHITE,
  waterArea: BW_W(0.08),
  waterBar: BW_W(0.32),
  waterBand: BW_W(0.1),
  waterBandSoft: BW_W(0.06),
  /* THE RAMP INVERTS. On cream a big day is DARKER than the sheet; on ink
   * it is BRIGHTER. "More ink on paper" becomes "more light on ink", which
   * is the translation no desaturation filter could make — and it is a
   * better ramp than the one it replaces:
   *
   *   bucket  fill vs ground   its label        step over the one below
   *   0       1.88:1           white  9.55:1    —
   *   1       3.58:1           white  5.02:1    1.90:1
   *   2       7.86:1           ink    7.86:1    2.20:1
   *   3      17.96:1           ink   17.96:1    2.29:1
   *
   * The bw ramp's WEAKEST step (1.90) beats the cream ramp's strongest
   * (1.75), and all four labels clear AA where cream's top bucket lands at
   * 4.87:1. That is structural rather than luck: cream starts at luminance
   * .909 and can only fall to .166, a 5x run; ink starts at .0085 and can
   * rise to 1.0, a 118x run.
   *
   * The payoff in the room: the busiest days of September become solid
   * white slabs with black numerals — the same gesture as race day's OPT IN
   * slab. Cream's rule "white only on the top bucket" inverts into "the only
   * black letters on a black poster sit on the biggest days". */
  ramp: [
    { fill: BW_W(0.2), on: WHITE },
    { fill: BW_W(0.38), on: WHITE },
    { fill: BW_W(0.64), on: BW_INK },
    { fill: WHITE, on: BW_INK },
  ],
  /* NO KEYLINE ON BLACK, and the number is the reason. On ink bucket 0 is
   * already 1.88:1 LIGHTER than its ground, and the `line` rule cream draws
   * around it is 2.70:1 — BRIGHTER than the fill it is meant to hold. A
   * bucket-0 cell would read as an empty outlined box, which is exactly what
   * a rest day already reads as. The three cell states stay three things by
   * KIND on both stocks: rest is a dashed outline, future a solid faint
   * outline, rowed is a FILL. */
  cellEdge: null,
  /* WEIGHT, NOT METAL — and arithmetic decided it, not taste. Greyscale the
   * three metals with the Rec.709 matrix the site already uses (raceday.ts
   * greyOf): #D4AF37 → luma 174.20, #C0C0C0 → 192.00, #CD7F32 → 138.02.
   * SILVER COMES OUT BRIGHTER THAN GOLD. Any filter-based answer literally
   * reverses first and second place on every poster, and a hue that fails in
   * greyscale fails a colour-blind reader for the same reason. That single
   * number is the strongest argument in this whole job against desaturating
   * the canvas at the end.
   *
   * So the chips are a monotone ladder plus a fill/hollow distinction — two
   * signals, neither of them hue:
   *
   *   01  filled white   17.96:1   ink text 17.96:1
   *   02  filled .74     10.15:1   ink text 10.15:1
   *   03  filled .52      5.59:1   ink text  5.59:1
   *   04+ hollow .5       5.26:1   .5 text
   *
   * Gold→silver 1.77:1 / dL* 21.3; silver→bronze 1.81:1 / dL* 19.1 — evenly
   * stepped and monotone, so "brighter is better" needs no legend. (.62 for
   * bronze was the first draft and is 1.36:1 / dL* 10.3 off silver, thin for
   * two chips on adjacent rows of a top ten.) The chip already PRINTS its
   * place as type — "01" "02" "03" on the board, "#1" "#2" "#3" on the
   * rower's bests — so hue was decoration; it never named the place. */
  gold: WHITE,
  silver: BW_W(0.74),
  bronze: BW_W(0.52),
  chipInk: BW_INK,
  /* THE COLLISION, and it is real: `pace` is a filled chip in the TYPE
   * colour with GROUND-coloured text, which on a monochrome sheet is
   * exactly a medal chip. The two can meet — assemble.ts toStanding
   * attaches paceTag to UNMASKED rows, and charts.ts drawBoard draws the
   * medal at the left of the row and the pace chip after the name in the
   * same loop, so a ranked top-three row really can wear both. On bw the
   * pace chip is therefore the one BRIGHT OUTLINE, 10.15:1. It never meets
   * the other hollow chip: the community board uses gold/silver/bronze/pace
   * only (4th and past is plain gray text), the rower sheet uses
   * gold/silver/bronze/outline only. Three chip idioms stay three things. */
  paceChip: { fill: null, edge: BW_W(0.74), text: BW_W(0.74) },
  /* GRIZZLY'S GREEN against #15171A is 1.05:1 and their own #06130c edge is
   * 1.06:1 — both invisible. The panel would read not as a plate laid on the
   * sheet but as a HOLE punched in it, with a gold word floating in it and
   * the bear sitting on nothing. So OUR rule draws OUR boundary where their
   * edge goes: .3 white, 2.70:1, the same value and weight as every other
   * rule on the sheet. Their five colours below do not move. */
  plateEdge: BW_W(0.3),
  gzGreen: GZ_GREEN,
  gzDark: GZ_EDGE,
  gzCream: GZ_CREAM,
  gzSage: GZ_SAGE,
  gzGold: GZ_GOLD,
};

/* The studio's chip row, in the owner's own words. */
export const POSTER_STOCKS: { key: PosterStock; label: string }[] = [
  { key: "cream", label: "Cream" },
  { key: "bw", label: "Black and white" },
];

export const isStock = (v: unknown): v is PosterStock => v === "cream" || v === "bw";

export const paletteOf = (stock: PosterStock | undefined): PosterPalette =>
  stock === "bw" ? BW : CREAM;

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
  /* Which stock this sheet is printed on; cream when nothing says, so
   * every caller that existed before the switch keeps drawing the sheet it
   * drew. */
  stock?: PosterStock;
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

/* The chip: the site's .dtag — a filled medal with chip-ink text, the gray
 * outline chip for #4+, and the pace chip an elite row wears. Sized off the
 * mono row × .86 so it sits on a table row. Every colour comes off the
 * palette: the pace chip is handed back WHOLE because it is the one chip
 * whose idiom, and not just its colour, depends on the stock. */
function chipColors(c: PosterPalette, kind: PosterChipKind): PosterChipPaint {
  switch (kind) {
    case "gold":
      return { fill: c.gold, edge: c.gold, text: c.chipInk };
    case "silver":
      return { fill: c.silver, edge: c.silver, text: c.chipInk };
    case "bronze":
      return { fill: c.bronze, edge: c.bronze, text: c.chipInk };
    case "outline":
      return { fill: null, edge: c.gray, text: c.gray };
    case "pace":
      return c.paceChip;
  }
}

export function makePaint(input: PaintInput): PosterPaint {
  const { tk, format, fonts, assets } = input;
  const c = paletteOf(input.stock);
  const font = (face: PosterFace, size: number) => fontFor(fonts, face, size);

  const paint: PosterPaint = {
    tk,
    c,
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

    /* THE HELPER DEFAULTS ARE THE HALF THAT WOULD OTHERWISE LEAK CREAM.
     * These three used to be assigned as bare function references, so their
     * default colours resolved against the MODULE constants INK / LINE /
     * GRAY — right on cream, invisible on black. One-line closures instead:
     * the signature does not change, so the ~10 calls in charts.ts that
     * pass no colour keep working, now in the new key. */
    rule: (ctx, x, y, w, h, color) => rule(ctx, x, y, w, h, color ?? c.ink),
    dashedRule: (ctx, x, y, w, color, weight) => dashedRule(ctx, x, y, w, color ?? c.line, weight),
    dottedRule: (ctx, x1, x2, y, color) => dottedRule(ctx, x1, x2, y, color ?? c.gray),

    /* Same leak, one layer down: drawBlockShape defaults `opts.fill ?? INK`
     * and share/cards.ts drawBlockDigits defaults to its OWN private
     * near-black. charts.ts and rowerCharts.ts call paint.figure with no
     * fill for a masked figure, so on a black sheet every blackout block
     * would paint #15171A on #15171A and vanish. All four resolve here. */
    blocks: (ctx, x, baseline, shape, size, opts) =>
      drawBlockShape(ctx, x, baseline, shape, size, fonts, { ...opts, fill: opts?.fill ?? c.ink }),

    /* share/cards.ts drawBlockDigits (imported): one block per digit with
     * real commas. cards.ts aligns left or right; centre is done here by
     * measuring first. */
    blockDigits: (ctx, x, baseline, digits, size, opts = {}) => {
      const w = blockDigitsWidth(ctx, digits, size, fonts);
      if (opts.paint === false) return w;
      const left = opts.align === "right" ? x - w : opts.align === "center" ? x - w / 2 : x;
      drawBlockDigits(ctx, left, baseline, digits, size, fonts, { fill: opts.fill ?? c.ink });
      return w;
    },

    /* share/cards.ts drawBlockClock (imported) for seconds; a ready clock
     * shape ("#:##:##") goes through the shape drawer. */
    blockClock: (ctx, x, baseline, secondsOrShape, size, opts = {}) => {
      if (typeof secondsOrShape === "string") {
        return drawBlockShape(ctx, x, baseline, secondsOrShape, size, fonts, {
          ...opts,
          fill: opts.fill ?? c.ink,
        });
      }
      if (opts.paint === false) {
        return drawBlockShape(ctx, x, baseline, clockShape(secondsOrShape), size, fonts, { paint: false });
      }
      return drawBlockClock(ctx, x, baseline, secondsOrShape, size, fonts, {
        align: opts.align,
        fill: opts.fill ?? c.ink,
      });
    },

    /* A Figure in one call: text in the font and colour asked for, or its
     * shape as blocks at `size` — matte ink whatever the text's colour
     * would have been (blocks are never water). */
    figure: (ctx, fig, x, baseline, f, size, color, opts = {}) => {
      if (fig.shape !== undefined) {
        return drawBlockShape(ctx, x, baseline, fig.shape, size, fonts, {
          align: opts.align,
          fill: opts.fill ?? c.ink,
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
      const lw = drawText(ctx, L, x, base, bold, c.ink, 0.16 * eye);
      if (right) {
        const maxW = w - lw - eye * 2.4;
        const tr = 0.12 * eye;
        let R = right.toUpperCase();
        if (measure(ctx, R, plain, tr) > maxW && rightShort) R = rightShort.toUpperCase();
        R = ellipsize(ctx, R, maxW, plain, tr);
        if (maxW > eye * 2) drawRight(ctx, R, x + w, base, plain, c.gray, tr);
      }
      const ry = base + eye * 0.7;
      rule(ctx, x, ry, w, tk.hair, c.ink);
      return ry + tk.hair + eye * 1.1;
    },

    chip: (ctx, x, baseline, text, kind) => {
      const size = tk.row * 0.86;
      const f = font("monoBold", size);
      const paints = chipColors(c, kind);
      const padX = size * 0.5;
      const tw = measure(ctx, text, f, 0.06 * size);
      const w = tw + padX * 2;
      const h = size * 1.5;
      const top = baseline - size * 0.78 - (h - size) / 2;
      ctx.save();
      if (paints.fill) {
        ctx.fillStyle = paints.fill;
        ctx.fillRect(x, top, w, h);
      } else {
        ctx.strokeStyle = paints.edge;
        ctx.lineWidth = Math.max(1, tk.hair);
        ctx.strokeRect(x + 0.5, top + 0.5, w - 1, h - 1);
      }
      ctx.restore();
      drawText(ctx, text, x + padX, baseline, f, paints.text, 0.06 * size);
      return w;
    },

    image: (ctx, img, x, y, w, h) => {
      if (!img || !img.naturalWidth) return;
      ctx.drawImage(img, x, y, w, h);
    },
  };
  return paint;
}
