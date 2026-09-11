/* poster/raceGround.ts — race day's render pipeline: the ONE place the
 * ground is decided, and the one place the engine's generics are widened.
 *
 * engine.ts render() paints cream over the whole canvas before it composes
 * ("the PDF's JPEG has no alpha — an unpainted canvas encodes as black"),
 * which is right for the two paper subjects and wrong for all three of race
 * day's: the ad is ink, the overlay is nothing at all, and the third is ink
 * with the owner's own photograph drawn into it. engine.ts belongs
 * to another stream, so race day brings its own six lines of pipeline
 * instead and calls the same compose() — the flow engine, the drop list,
 * the shrink order and the cascade are all still the engine's.
 *
 * TWO DEPARTURES from the paper sheets, both deliberate: the composition
 * runs at ZERO margins (a module's box is a full-bleed slice of the frame,
 * which is what lets the overlay's window cut edge to edge) and at GAP 0
 * (the rows butt, so the bill is one slab and not a ladder). Every race day
 * module carries its own air and insets its own type by the format's real
 * margins — see poster/raceday.ts. */

import { compose } from "./engine";
import { tokensFor } from "./formats";
import { makePaint } from "./paint";
import { RACE_INK, raceLayoutFor } from "./raceday";
import type {
  CommunityPoster,
  PosterAssets,
  PosterFonts,
  PosterGround,
  PosterLayout,
  PosterLayoutLog,
  PosterMargins,
  PosterPpi,
  PosterRenderTarget,
  RaceDayPoster,
} from "./types";

export const RACE_GROUNDS: { key: PosterGround; label: string }[] = [
  { key: "ink", label: "Solid ad" },
  { key: "photo", label: "On the photo" },
  { key: "overlay", label: "Overlay" },
];

export const isGround = (v: unknown): v is PosterGround =>
  v === "ink" || v === "overlay" || v === "photo";

const FULL_BLEED: PosterMargins = { top: 0, right: 0, bottom: 0, left: 0 };

export type RaceRenderInput = {
  target: PosterRenderTarget;
  data: RaceDayPoster;
  fonts: PosterFonts;
  assets: PosterAssets;
  ground: PosterGround;
};

export function renderRaceDay(input: RaceRenderInput): { canvas: HTMLCanvasElement; log: PosterLayoutLog } {
  const { target, data, fonts, assets, ground } = input;
  const canvas = document.createElement("canvas");
  canvas.width = target.pxW;
  canvas.height = target.pxH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("poster: no 2d context");

  // THE GROUND. Ink over everything, for ALL THREE grounds: the window row
  // the other two carry either cuts its own box back out with
  // destination-out (overlay) or draws the photograph over it (photo), so
  // the transparency — or the picture — is one clean box rather than a
  // mosaic of bands with antialiased seams between them. (A transparent PDF
  // is refused upstream: the JPEG a PDF carries would encode that alpha as
  // black. The photo ground is opaque, so it keeps its PDF.)
  ctx.fillStyle = RACE_INK;
  ctx.fillRect(0, 0, target.pxW, target.pxH);

  // A PHOTO GROUND WITH NO PHOTOGRAPH IS A BLACK BAND, never a frame worth
  // downloading: the picture that did not load (a bucket that refused the
  // CORS fetch, a key that has been deleted) drops the frame back to the
  // solid ad rather than printing a hole. The studio only offers the chip
  // when the race HAS a photograph, and says so when the load fails, so
  // this is the belt and not the braces.
  const drawn: PosterGround = ground === "photo" && !assets.photo ? "ink" : ground;

  // Full bleed, no gaps: the modules tile the frame. The format's REAL
  // margins are still what the type is inset by — poster/raceday.ts reads
  // them back off FORMATS by key; this clone only changes where the engine
  // puts the boxes.
  const format = { ...target.format, margins: FULL_BLEED };
  const tk = { ...tokensFor(target.format), gap: 0 };
  const paint = makePaint({ tk, format, fonts, assets });

  ctx.save();
  ctx.translate(target.offset.x, target.offset.y);
  ctx.scale(target.scale, target.scale);
  let log: PosterLayoutLog;
  try {
    // THE ONE CAST. compose() is generic over `D extends PosterData`, and
    // PosterData is engine.ts's union of the two paper subjects (its
    // fileName() reads data.rower on anything that is not "community", so a
    // third member would not compile there). The engine never reads a field
    // off the payload — it measures modules and stacks heights — so this is
    // a type-level widening only, and it is contained here on purpose.
    log = compose({
      ctx,
      layout: raceLayoutFor(drawn) as unknown as PosterLayout<CommunityPoster>,
      format,
      data: data as unknown as CommunityPoster,
      paint,
      scale: target.scale,
    });
  } finally {
    ctx.restore();
  }
  return { canvas, log };
}

/* raceday-2026-09-27-story.png · raceday-2026-09-27-story-overlay.png ·
 * raceday-2026-09-27-story-photo.png · raceday-2026-09-27-poster-11x17.pdf —
 * the race's own slug is the subject, the way engine.ts fileName() stems the
 * other two. The ground is in the name because all three are the same ad and
 * only the name says which one is on the desktop. */
export function raceFileName(
  data: RaceDayPoster,
  format: { stem: string; kind: "print" | "instagram"; ppi?: { default: PosterPpi } },
  ext: "png" | "pdf",
  opts: { ground: PosterGround; ppi?: PosterPpi | null; bleed?: boolean },
): string {
  let suffix = opts.ground === "overlay" ? "-overlay" : opts.ground === "photo" ? "-photo" : "";
  if (format.kind === "print" && opts.ppi && format.ppi && opts.ppi !== format.ppi.default)
    suffix += `-${opts.ppi}ppi`;
  if (format.kind === "print" && opts.bleed) suffix += "-bleed";
  return `${data.race.slug}-${format.stem}${suffix}.${ext}`;
}
