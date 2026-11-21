import { createCanvas } from "@napi-rs/canvas";
import type { TelemetryDoc } from "@/lib/pm5/session";
import { loadFaces } from "@/app/row100k/share/serverCard";
import { paintClip, type BgId, type ClipId, type Fonts, type PaintOpts, type ScreenId, type UnitId } from "./paint";
import { buildSeries, frameAt, rowTimeAt } from "./series";

/* A REEL OVERLAY, FILMED ON THE SERVER (2026-11-20; owner the same day, of
 * the stickers and the reels in the phone app: "I really think we should be
 * able to figure this out. Lets get the stickers working first then the
 * reels").
 *
 * On the site a reel is a canvas animation (paint.ts) that the browser
 * films as it plays (ReelStudio.tsx, MediaRecorder). A phone app has neither
 * the canvas nor the recorder. But the painting is pure: one function draws
 * one frame from the saved row and a moment in it. So the same function is
 * run here, frame after frame, on the server's canvas (@napi-rs/canvas),
 * and the frames are encoded to an H.264 MP4 by an encoder that is plain
 * WebAssembly (h264-mp4-encoder: no ffmpeg, no binary to ship, nothing to
 * pay for). The app gets a video file, as it gets a sticker.
 *
 * Unlike the studio it does not film in real time: a ten second clip is
 * three hundred frames painted as fast as they will go.
 *
 * Video has no transparency, here as on the site: the overlay is filmed on
 * a ground to key out (green, blue) or to blend (black). SERVER ONLY. */

/* `phone` is the story at two thirds the size: four ninths of the pixels
 * to paint and to encode, so a clip asked for from the phone app is done
 * well inside the route's minute (2026-11-22, after one filmed at full
 * size from the app never came back). */
export const REEL_FORMATS = { story: [1080, 1920], post: [1080, 1350], square: [1080, 1080], phone: [720, 1280] } as const;
export type ReelFormat = keyof typeof REEL_FORMATS;
export const REEL_CLIPS: readonly ClipId[] = ["meters", "clock", "pace", "stack", "stroke", "monitor"];
export const REEL_GROUNDS: readonly BgId[] = ["green", "blue", "black", "ink", "cream"];
export const REEL_LENGTHS = [5, 10, 15] as const;
const FPS = 30;

/* THE ENCODER, loaded by Node at the moment a clip is asked for and never
 * by the bundler: it is a megabyte of WebAssembly that one route needs, and
 * a machine that has not installed it yet must still build and serve
 * everything else. next.config.mjs ships the package with the reel route
 * (outputFileTracingIncludes), since the bundler no longer sees it.
 *
 * __non_webpack_require__ is the bundler's own name for Node's plain
 * require. Not createRequire: webpack rewrites that call too, and what it
 * left behind was not a function (found 2026-11-20, the first time the
 * route ran with the package installed). */
declare const __non_webpack_require__: (id: string) => unknown;
type Encoder = {
  width: number;
  height: number;
  frameRate: number;
  quantizationParameter: number;
  speed: number;
  groupOfPictures: number;
  outputFilename: string;
  FS: { readFile(name: string): Uint8Array };
  initialize(): void;
  addFrameRgba(rgba: Uint8Array): void;
  finalize(): void;
  delete(): void;
};
export class NoEncoder extends Error {}
function encoderModule(): { createH264MP4Encoder(): Promise<Encoder> } {
  try {
    return __non_webpack_require__("h264-mp4-encoder") as { createH264MP4Encoder(): Promise<Encoder> };
  } catch (err) {
    console.error("reel: the encoder would not load", err);
    throw new NoEncoder("The video encoder (h264-mp4-encoder) is not installed on this server. Run npm install.");
  }
}

const FONTS: Fonts = { black: '"Archivo Black"', sans: '"Archivo"', mono: '"Space Mono"' };

export type ReelAsk = {
  doc: TelemetryDoc;
  clip: ClipId;
  bg: BgId;
  unit: UnitId;
  screen: ScreenId;
  format: ReelFormat;
  lengthS: number;
  /* The month's metres before this row, where the running total starts. */
  startTotal: number;
  /* The month, in capitals: "NOVEMBER". */
  label: string;
};

function optsOf(a: ReelAsk, series: ReturnType<typeof buildSeries>): PaintOpts {
  return {
    clip: a.clip,
    bg: a.bg,
    unit: a.unit,
    screen: a.screen,
    startTotal: a.startTotal,
    label: a.label,
    fromS: series.startS,
    toS: series.totalS,
    fonts: FONTS,
    numColor: null,
    labColor: null,
    title: "",
    mark: null,
    markRatio: 858 / 188,
  };
}

type Ctx = Parameters<typeof paintClip>[0];

/* The last frame, as a PNG: what the clip ends on, for a preview. */
export function renderReelStill(a: ReelAsk): Buffer {
  loadFaces();
  const [W, H] = REEL_FORMATS[a.format];
  const series = buildSeries(a.doc);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  paintClip(ctx as unknown as Ctx, W, H, series, frameAt(series, rowTimeAt(a.lengthS, a.lengthS, series.startS, series.totalS)), optsOf(a, series));
  return canvas.toBuffer("image/png");
}

/* The clip, as an MP4. */
export async function renderReelMp4(a: ReelAsk): Promise<Buffer> {
  loadFaces();
  const [W, H] = REEL_FORMATS[a.format];
  const series = buildSeries(a.doc);
  const o = optsOf(a, series);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const enc = await encoderModule().createH264MP4Encoder();
  try {
    enc.width = W;
    enc.height = H;
    enc.frameRate = FPS;
    enc.quantizationParameter = 24;
    enc.speed = 8;
    enc.groupOfPictures = FPS;
    enc.initialize();
    const frames = Math.round(a.lengthS * FPS);
    /* One more than the length, so the clip holds its last figure for a frame. */
    for (let i = 0; i <= frames; i++) {
      const clipS = Math.min(a.lengthS, i / FPS);
      ctx.clearRect(0, 0, W, H);
      paintClip(ctx as unknown as Ctx, W, H, series, frameAt(series, rowTimeAt(clipS, a.lengthS, series.startS, series.totalS)), o);
      const px = ctx.getImageData(0, 0, W, H).data;
      enc.addFrameRgba(new Uint8Array(px.buffer, px.byteOffset, px.byteLength));
    }
    enc.finalize();
    return Buffer.from(enc.FS.readFile(enc.outputFilename));
  } finally {
    enc.delete();
  }
}
