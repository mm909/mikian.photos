/* poster/serverPoster.ts — A POSTER, DRAWN ON THE SERVER (owner,
 * 2026-11-26: "need to bring over the poster utility into the app ... the
 * poster for the individual rower ... the poster for Rowtember in general
 * ... select time frames ... change the color ... different aspect
 * ratios"). The phone app has no browser canvas, so the studio's own
 * engine (engine.ts compose, paint.ts, the layouts) runs here on a canvas
 * of the server's — @napi-rs/canvas, the Skia the stickers are drawn with
 * (share/serverCard.ts) — and the answer is a PNG. Nothing is drawn twice:
 * the sheet the site's studio paints is the sheet the app shares.
 *
 * THE SHIMS, and they are the only ones. engine.ts render() makes its
 * canvas with document.createElement; here createCanvas makes it and the
 * same four steps follow (paper over everything, translate, one scale,
 * compose). The faces are the site's, registered off the font files beside
 * the share cards (loadFaces), named by family instead of the hashed
 * next/font names, and with no DOM line boxes: paint.ts metricsOf falls
 * back to the canvas font box, which is what it is written to do. The
 * partner marks are on no plan, so the assets are empty.
 *
 * No race day and no top ten (owner: "We don't need race day or top 10 at
 * the moment"). SERVER ONLY. */

import { createCanvas } from "@napi-rs/canvas";
import { accentOn, paletteOf as sitePaletteOf } from "@/lib/rowPalette";
import { siteSettings } from "@/lib/rowSettings";
import { loadFaces } from "../share/serverCard";
import { compose, previewTarget, targetFor } from "./engine";
import { FORMATS, FORMAT_KEYS, PRINT_PPI, tokensFor } from "./formats";
import { communityLayout, rowerLayout } from "./layouts";
import { m2dLayout } from "./m2dPoster";
import { makePaint, paletteOf } from "./paint";
import type { CommunityPoster, M2dPoster, PosterData, PosterFonts, PosterFormatKey, PosterLayout, PosterStock, RowerPoster } from "./types";

export const POSTER_FONTS: PosterFonts = { black: '"Archivo Black"', mono: '"Space Mono"', archivo: '"Archivo"' };

/* THE COLOURS (owner: "We want to be able to change the color"): the cream
 * sheet in the site's own accent first, then in the other paper cuts the
 * site's palettes carry (rowPalette.ts — each checked at 4.5:1 on paper),
 * then the black stock (paint.ts BW). A cut equal to the site's is not
 * offered twice. */
const CUTS: { key: string; label: string; hex: string }[] = [
  { key: "blue", label: "Rowtember blue", hex: "#0077B6" },
  { key: "brown", label: "Fall brown", hex: "#6F4A2F" },
  { key: "red", label: "Red", hex: "#C8321F" },
  { key: "orange", label: "Orange", hex: "#B04506" },
  { key: "green", label: "Green", hex: "#256E45" },
];

export type PosterColor = { key: string; label: string; stock: PosterStock; accent?: string; swatch: string; ground: string };

export async function posterColors(): Promise<PosterColor[]> {
  const settings = await siteSettings();
  const site = accentOn(sitePaletteOf(settings.palette), "paper").accent;
  const paper = paletteOf("cream", site).paper;
  return [
    { key: "cream", label: "Cream", stock: "cream", accent: site, swatch: site, ground: paper },
    ...CUTS.filter((c) => c.hex.toLowerCase() !== site.toLowerCase()).map((c) => ({ key: c.key, label: c.label, stock: "cream" as const, accent: c.hex, swatch: c.hex, ground: paper })),
    { key: "bw", label: "Black", stock: "bw", swatch: "#ffffff", ground: paletteOf("bw").paper },
  ];
}

/* The formats in the studio's order: the three phone frames first here,
 * since a phone is where they are shared from, then the wall sizes. */
export const APP_FORMAT_KEYS: PosterFormatKey[] = ["story", "post", "square", ...FORMAT_KEYS.filter((k) => FORMATS[k].kind === "print")];

export type PosterSubjectData =
  | { layout: PosterLayout<CommunityPoster>; data: CommunityPoster }
  | { layout: PosterLayout<RowerPoster>; data: RowerPoster }
  | { layout: PosterLayout<M2dPoster>; data: M2dPoster };

export function sheetOf(data: PosterData | M2dPoster): PosterSubjectData {
  if (data.kind === "community") return { layout: communityLayout, data };
  if (data.kind === "rower") return { layout: rowerLayout, data };
  return { layout: m2dLayout, data };
}

/* The pixels a request gets. A phone frame is its own 1080 px wide frame
 * either way. A wall size is drawn 1080 wide for the preview and at the
 * studio's one print resolution (PRINT_PPI, a 24x36 is 3600 by 5400) when
 * `full` — the file to take to a printer. */
export async function renderPosterPng(
  sheet: PosterSubjectData,
  formatKey: PosterFormatKey,
  color: PosterColor,
  full: boolean,
): Promise<{ png: Buffer; width: number; height: number }> {
  loadFaces();
  const format = FORMATS[formatKey];
  const target = format.kind === "print" ? (full ? targetFor(format, PRINT_PPI, 0) : previewTarget(format, 1080, 1)) : targetFor(format, null, 0);
  const canvas = createCanvas(target.pxW, target.pxH);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  const stock = color.stock;
  const accent = stock === "cream" ? color.accent : undefined;
  ctx.fillStyle = paletteOf(stock, accent).paper;
  ctx.fillRect(0, 0, target.pxW, target.pxH);
  const paint = makePaint({ tk: tokensFor(format), format, fonts: POSTER_FONTS, assets: { bear: null, wordmark: null }, stock, accent });
  ctx.save();
  ctx.translate(target.offset.x, target.offset.y);
  ctx.scale(target.scale, target.scale);
  try {
    /* THE ONE CAST, raceGround.ts's: compose() is generic over PosterData,
     * and the M2D sheet is a PosterSubject beside it (types.ts M2dPoster). */
    compose({
      ctx,
      layout: sheet.layout as unknown as PosterLayout<CommunityPoster>,
      format,
      data: sheet.data as unknown as CommunityPoster,
      paint,
      scale: target.scale,
    });
  } finally {
    ctx.restore();
  }
  return { png: canvas.toBuffer("image/png"), width: target.pxW, height: target.pxH };
}
