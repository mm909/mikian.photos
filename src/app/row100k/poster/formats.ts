/* poster/formats.ts — every preset the studio offers (SPEC.md §2), the
 * per-family type scale (§3), and the arithmetic that turns a preset into
 * pixels, points and columns.
 *
 * The ask (owner, 2026-09-10): "a summary to hang on a 24x36 poster or
 * 18x24 (if we can build a utility for the most common aspect ratios that
 * would be great) ... shareable in an insta story and insta post". So:
 * three wall sizes and the three Instagram frames, every one of them
 * drawn in one of two LOGICAL spaces — printL 1200 wide (the wall sizes,
 * three columns), phone 540 wide — and scaled to its pixels. One logical
 * unit is a fixed share of the sheet inside a family, which is what lets a
 * 24x36 and a 16x20 read from six feet with one type scale.
 *
 * The four hand-out sizes (11x17, A3, letter, A4) and their printS family
 * came off on 2026-09-16 — owner: "remove options for 11x17, A3, letter,
 * and A4" — and the 150 / 300 ppi choice with them (PRINT_PPI below).
 *
 * Print sizes are TRIM sizes; bleed is an engine option that adds cream
 * around the same drawing (engine.ts targetFor) and never re-lays it out. */

import type {
  PosterFamily,
  PosterFormat,
  PosterFormatKey,
  PosterMargins,
  PosterPpi,
  PosterTokens,
} from "./types";

/* ----------------------------------------------------------- the scale */

/* SPEC.md §3, one table per family. Values are logical units; what each
 * becomes in points on every sheet is tabulated there. The phone floor is
 * 9 units (18 px at 1080 wide) — nothing on the phone goes under it. */
export const TOKENS: Record<PosterFamily, PosterTokens> = {
  printL: {
    W: 1200,
    margin: 60,
    gutter: 40,
    cols: 3,
    nameCap: 112,
    headCap: 150,
    datel: 13,
    headLabel: 14,
    statL: 11,
    eye: 12,
    row: 14,
    rowPitch: 27,
    small: 10,
    ledger: 13,
    ledgerPitch: 27,
    axis: 10,
    footer: 13,
    statN: 46,
    recV: 26,
    thick: 4,
    hair: 1.5,
    gap: 30,
  },
  phone: {
    W: 540,
    margin: 36,
    gutter: 24,
    cols: 2,
    nameCap: 60,
    headCap: 92,
    datel: 11,
    headLabel: 11,
    statL: 9,
    eye: 11,
    row: 13,
    rowPitch: 26,
    small: 10,
    ledger: 12,
    ledgerPitch: 25,
    axis: 9,
    footer: 11,
    statN: 34,
    recV: 26,
    thick: 3,
    hair: 1.2,
    gap: 22,
  },
};

/* --------------------------------------------------------- the presets */

/* The story folds Instagram's UI bands into its margins so no plan has to
 * know about them: the profile chip and the reply bar cover roughly the
 * top 250 px and the bottom 270 px of a 1920 story, which is 125 / 135
 * logical at scale 2. THIS IS THE ONE NUMBER TO BUMP if a real device
 * shows the dateline under the profile chip (SPEC.md §14.6). The bands are
 * empty margin: they take whatever the canvas was filled with, which is the
 * STOCK's ground — cream on a cream sheet, #15171A on a black one. (This
 * line used to say "the bands stay paper", which was the behaviour on the
 * one stock that then existed and is the sort of sentence that is still
 * here in six months telling the next reader something false.) */
export const STORY_SAFE = { top: 125, bottom: 135 };

/* THE ONE PRINT RESOLUTION. Every print size renders at 150 ppi; the
 * 150 / 300 chip came off the studio on 2026-09-16 (owner: "unless there
 * is a reason to keep 150ppi and 300ppi just pick the better option by
 * default and remove the other"). 150 is the better option: a 24x36 at
 * 300 ppi is a 7200 by 10800 canvas an iPhone cannot allocate, and 150 ppi
 * (3600 by 5400) is already sharper than a wall poster needs at any
 * viewing distance. */
export const PRINT_PPI: PosterPpi = 150;

const same = (m: number): PosterMargins => ({ top: m, right: m, bottom: m, left: m });

/* H = W × (sheet height / sheet width), rounded to a unit. */
const logicalH = (W: number, inches: { w: number; h: number }): number =>
  Math.round((W * inches.h) / inches.w);

function print(
  key: PosterFormatKey,
  label: string,
  plan: PosterFormat["plan"],
  inches: { w: number; h: number },
  stem: string,
): PosterFormat {
  const tk = TOKENS.printL;
  return {
    key,
    label,
    kind: "print",
    family: "printL",
    plan,
    w: tk.W,
    h: logicalH(tk.W, inches),
    inches,
    margins: same(tk.margin),
    stem,
  };
}

function instagram(
  key: PosterFormatKey,
  label: string,
  plan: PosterFormat["plan"],
  pixels: { w: number; h: number },
  margins: PosterMargins,
): PosterFormat {
  const tk = TOKENS.phone;
  return {
    key,
    label,
    kind: "instagram",
    family: "phone",
    plan,
    w: tk.W,
    h: Math.round((tk.W * pixels.h) / pixels.w),
    pixels,
    margins,
    stem: key,
  };
}

/* The table in SPEC.md §2, trimmed to the three wall sizes (2026-09-16). */
export const FORMATS: Record<PosterFormatKey, PosterFormat> = {
  "24x36": print("24x36", "24 × 36 in", "tall", { w: 24, h: 36 }, "poster-24x36"),
  "18x24": print("18x24", "18 × 24 in", "short", { w: 18, h: 24 }, "poster-18x24"),
  "16x20": print("16x20", "16 × 20 in", "squat", { w: 16, h: 20 }, "poster-16x20"),
  story: instagram(
    "story",
    "Story 9:16",
    "story",
    { w: 1080, h: 1920 },
    { top: STORY_SAFE.top, right: 36, bottom: STORY_SAFE.bottom, left: 36 },
  ),
  post: instagram("post", "Post 4:5", "post", { w: 1080, h: 1350 }, same(36)),
  square: instagram("square", "Square 1:1", "square", { w: 1080, h: 1080 }, same(36)),
};

/* The studio's chip order: PRINT then INSTAGRAM. */
export const PRINT_KEYS: PosterFormatKey[] = ["24x36", "18x24", "16x20"];
export const INSTAGRAM_KEYS: PosterFormatKey[] = ["story", "post", "square"];
export const FORMAT_KEYS: PosterFormatKey[] = [...PRINT_KEYS, ...INSTAGRAM_KEYS];

export function isFormatKey(v: unknown): v is PosterFormatKey {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(FORMATS, v);
}

export function tokensFor(format: PosterFormat): PosterTokens {
  return TOKENS[format.family];
}

/* ------------------------------------------------------------ geometry */

/* Pixels for a print format at a ppi (with `bleedIn` inches of extra cream
 * per edge), or the fixed Instagram frame. Pixels = round(inches × ppi);
 * the engine scales by pxW / W, so the height may land a pixel off
 * H × scale — the paper is painted over the whole canvas first, so the
 * odd pixel is cream. */
export function pixelsFor(
  format: PosterFormat,
  ppi: PosterPpi | null,
  bleedIn = 0,
): { w: number; h: number } {
  if (format.kind === "instagram" || !format.inches) {
    return format.pixels ?? { w: format.w * 2, h: format.h * 2 };
  }
  const p = ppi ?? PRINT_PPI;
  return {
    w: Math.round((format.inches.w + 2 * bleedIn) * p),
    h: Math.round((format.inches.h + 2 * bleedIn) * p),
  };
}

/* The PDF page in points: inches × 72 (A4 = 595.28 × 841.89). */
export function pointsFor(format: PosterFormat, bleedIn = 0): { w: number; h: number } | null {
  if (!format.inches) return null;
  return { w: (format.inches.w + 2 * bleedIn) * 72, h: (format.inches.h + 2 * bleedIn) * 72 };
}

/* The content measure and the column grid of a plan (SPEC.md §8.1): a
 * span-n slot is n columns plus n − 1 gutters. */
export function columnsOf(
  format: PosterFormat,
  cols: 1 | 2 | 3,
): {
  left: number;
  width: number;
  colW: number;
  gutter: number;
  x(i: number): number;
  w(span?: number): number;
} {
  const tk = tokensFor(format);
  const left = format.margins.left;
  const width = format.w - format.margins.left - format.margins.right;
  const gutter = tk.gutter;
  const colW = (width - gutter * (cols - 1)) / cols;
  return {
    left,
    width,
    colW,
    gutter,
    x: (i) => left + i * (colW + gutter),
    w: (span = 1) => span * colW + (span - 1) * gutter,
  };
}
