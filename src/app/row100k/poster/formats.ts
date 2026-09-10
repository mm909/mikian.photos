/* poster/formats.ts — every preset the studio offers (SPEC.md §2), the
 * per-family type scale (§3), and the arithmetic that turns a preset into
 * pixels, points and columns.
 *
 * The ask (owner, 2026-09-10): "a summary to hang on a 24x36 poster or
 * 18x24 (if we can build a utility for the most common aspect ratios that
 * would be great) ... shareable in an insta story and insta post". So:
 * seven print sizes and the three Instagram frames, every one of them
 * drawn in one of three LOGICAL spaces — printL 1200 wide (the wall
 * sizes, three columns), printS 720 wide (the hand-outs, two columns),
 * phone 540 wide — and scaled to its pixels. One logical unit is a fixed
 * share of the sheet inside a family, which is what lets a 24x36 read from
 * six feet and a letter sheet read in the hand with one type scale each.
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
  printS: {
    W: 720,
    margin: 44,
    gutter: 28,
    cols: 2,
    nameCap: 84,
    headCap: 125,
    datel: 13,
    headLabel: 13,
    statL: 11,
    eye: 13,
    row: 15,
    rowPitch: 30,
    small: 12,
    ledger: 14,
    ledgerPitch: 29,
    axis: 11,
    footer: 13,
    statN: 41,
    recV: 31,
    thick: 3.6,
    hair: 1.4,
    gap: 26,
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
 * shows the dateline under the profile chip (SPEC.md §14.6). The bands
 * stay paper. */
export const STORY_SAFE = { top: 125, bottom: 135 };

const A4_IN = { w: 210 / 25.4, h: 297 / 25.4 };
const A3_IN = { w: 297 / 25.4, h: 420 / 25.4 };

const same = (m: number): PosterMargins => ({ top: m, right: m, bottom: m, left: m });

/* H = W × (sheet height / sheet width), rounded to a unit. */
const logicalH = (W: number, inches: { w: number; h: number }): number =>
  Math.round((W * inches.h) / inches.w);

function print(
  key: PosterFormatKey,
  label: string,
  family: "printL" | "printS",
  plan: PosterFormat["plan"],
  inches: { w: number; h: number },
  ppiDefault: PosterPpi,
  stem: string,
): PosterFormat {
  const tk = TOKENS[family];
  return {
    key,
    label,
    kind: "print",
    family,
    plan,
    w: tk.W,
    h: logicalH(tk.W, inches),
    inches,
    ppi: { default: ppiDefault, options: [150, 300] },
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

/* The table in SPEC.md §2. The wall sizes default to 150 ppi (plenty at
 * six feet, and 24x36 @150 is the one big canvas an iPhone can hold);
 * letter and A4 default to 300 (cheap, read in the hand). 11x17 and A3
 * draw in the HAND family — in the wall family they came out at 8-pt
 * eyebrows (§0), and the design decided that, not this file. */
export const FORMATS: Record<PosterFormatKey, PosterFormat> = {
  "24x36": print("24x36", "24 × 36 in", "printL", "tall", { w: 24, h: 36 }, 150, "poster-24x36"),
  "18x24": print("18x24", "18 × 24 in", "printL", "short", { w: 18, h: 24 }, 150, "poster-18x24"),
  "16x20": print("16x20", "16 × 20 in", "printL", "squat", { w: 16, h: 20 }, 150, "poster-16x20"),
  "11x17": print("11x17", "11 × 17 in", "printS", "hand", { w: 11, h: 17 }, 150, "poster-11x17"),
  a3: print("a3", "A3", "printS", "hand", A3_IN, 150, "poster-a3"),
  letter: print("letter", "Letter", "printS", "hand", { w: 8.5, h: 11 }, 300, "poster-letter"),
  a4: print("a4", "A4", "printS", "hand", A4_IN, 300, "poster-a4"),
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
export const PRINT_KEYS: PosterFormatKey[] = ["24x36", "18x24", "16x20", "11x17", "a3", "letter", "a4"];
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
  const p = ppi ?? format.ppi?.default ?? 150;
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
