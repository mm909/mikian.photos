import { createCanvas } from "@napi-rs/canvas";
import { GIFEncoder, applyPalette, quantize } from "gifenc";
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
/* THE PHONE'S FILM RUNS AT 20 FRAMES A SECOND (owner, 2026-11-21: "there's
 * got to be a really smart way for us to reduce the amount of time needed
 * to film ... we don't need it to be ... 60 frames per second"). Figures
 * counting up read the same at 20 as at 30, and a third of the frames are
 * never painted or encoded. */
const FPS_OF: Partial<Record<ReelFormat, number>> = { phone: 20 };

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
  /* The month's timed metres and their seconds before this row, so the
   * running total can carry the month's own average pace. */
  startPaceM?: number;
  startPaceS?: number;
};

function optsOf(a: ReelAsk, series: ReturnType<typeof buildSeries>): PaintOpts {
  return {
    clip: a.clip,
    bg: a.bg,
    unit: a.unit,
    screen: a.screen,
    startTotal: a.startTotal,
    startPaceM: a.startPaceM ?? 0,
    startPaceS: a.startPaceS ?? 0,
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

/* THE CLIP AS A STRIP OF SMALL FRAMES, for a preview that moves (owner,
 * 2026-11-21: "when I go to click on the reel, I want to see a preview of
 * that reel going ... the preview of the reel can be like, you know, one
 * frame every 10th of a second"). The five-second version of the clip at
 * ten frames a second: fifty frames, each painted once and laid side by
 * side on ONE picture, ten to a line. The app shows one cell of it at a
 * time. A picture, so it needs no video player on the phone and is back in
 * about a second, where the film itself takes several. */
export const REEL_STRIP = { frames: 50, cols: 10, rows: 5, fps: 10, w: 216, h: 384 } as const;
export function renderReelStrip(a: ReelAsk): Buffer {
  loadFaces();
  const S = REEL_STRIP;
  /* Painted at twice the cell and drawn down into it, so the small type
   * stays clean. */
  const W = S.w * 2;
  const H = S.h * 2;
  const series = buildSeries(a.doc);
  const lengthS = S.frames / S.fps;
  const ask = { ...a, lengthS };
  const o = optsOf(ask, series);
  const one = createCanvas(W, H);
  const ctx = one.getContext("2d");
  const sheet = createCanvas(S.w * S.cols, S.h * S.rows);
  const out = sheet.getContext("2d");
  for (let i = 0; i < S.frames; i++) {
    /* The last cell is the clip's last moment, as the film ends on it. */
    const clipS = i === S.frames - 1 ? lengthS : i / S.fps;
    ctx.clearRect(0, 0, W, H);
    paintClip(ctx as unknown as Ctx, W, H, series, frameAt(series, rowTimeAt(clipS, lengthS, series.startS, series.totalS)), o);
    out.drawImage(one, (i % S.cols) * S.w, Math.floor(i / S.cols) * S.h, S.w, S.h);
  }
  return sheet.toBuffer("image/jpeg", 78);
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
    const fps = FPS_OF[a.format] ?? FPS;
    enc.frameRate = fps;
    enc.quantizationParameter = 24;
    enc.speed = fps === FPS ? 8 : 10;
    enc.groupOfPictures = fps;
    enc.initialize();
    const frames = Math.round(a.lengthS * fps);
    /* One more than the length, so the clip holds its last figure for a frame. */
    for (let i = 0; i <= frames; i++) {
      const clipS = Math.min(a.lengthS, i / fps);
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

/* THE CLIP WITH NOTHING BEHIND IT, AS A GIF (owner, 2026-11-22, of keying
 * the green out in his editor: "if we can get the same thing, but with the
 * transparent background, that I don't have to do this ... ideally ... we're
 * able to copy these and paste them onto an Instagram story").
 *
 * A video has no alpha; a GIF has one bit of it, a pixel there or not, and
 * that is enough here: the painting on the clear ground is solid colour
 * under a hard ink outline, so the edge a GIF cuts is the outline's.
 *
 * Painted twice. The first pass, at a quarter of the size, only finds the
 * box the drawing ever touches, so the picture is cropped to it: a sticker
 * with no empty sheet around it, and a far smaller file. The second paints
 * each frame at the story's full size and writes that box. Every frame
 * clears the one before it (dispose 2), since nothing is behind them to
 * cover it. 12.5 frames a second, because a GIF counts its frames in
 * hundredths of a second and eight of those is a whole number; the last
 * frame is held two seconds, so the figures the clip ends on can be read
 * before it goes round.
 *
 * THE LOOPS STEP ASIDE EVERY FEW FRAMES. Each frame's pixels are megabytes
 * held outside the JavaScript heap, and they are only let go when the
 * event loop turns: 400 full frames read without a pause stood at 3.5 GB,
 * and at under 500 MB with one (measured 2026-11-22). */
const GIF_DELAY_MS = 80;
const GIF_HOLD_MS = 2000;
const breathe = () => new Promise<void>((r) => setImmediate(r));
export async function renderReelGif(a: ReelAsk): Promise<Buffer> {
  loadFaces();
  const [W, H] = REEL_FORMATS.story;
  const series = buildSeries(a.doc);
  const o = optsOf({ ...a, bg: "clear" }, series);
  const frames = Math.round((a.lengthS * 1000) / GIF_DELAY_MS);
  const rowAt = (i: number) => frameAt(series, rowTimeAt(Math.min(a.lengthS, (i * GIF_DELAY_MS) / 1000), a.lengthS, series.startS, series.totalS));

  /* Pass one: the box, on a sheet a quarter the size. Anything at all in
   * a pixel counts there, so a hairline is not missed. */
  const K = 4;
  const sw = W / K;
  const sh = H / K;
  const small = createCanvas(sw, sh);
  const sctx = small.getContext("2d");
  let x0 = sw, y0 = sh, x1 = -1, y1 = -1;
  for (let i = 0; i <= frames; i++) {
    paintClip(sctx as unknown as Ctx, sw, sh, series, rowAt(i), o);
    const px = sctx.getImageData(0, 0, sw, sh).data;
    for (let y = 0; y < sh; y++) {
      const row = y * sw * 4 + 3;
      const inside = y >= y0 && y <= y1;
      /* In a row the box already has, only what lies outside it can widen it. */
      for (let x = 0; x < (inside ? x0 : sw); x++) {
        if (px[row + x * 4] > 0) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
          break;
        }
      }
      for (let x = sw - 1; x > (inside ? x1 : -1); x--) {
        if (px[row + x * 4] > 0) {
          if (x > x1) x1 = x;
          if (x < x0) x0 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
          break;
        }
      }
    }
    if (i % 8 === 7) await breathe();
  }
  /* Back to full size, with room for what the small sheet rounded away. */
  const M = 8;
  const bx = x1 < 0 ? 0 : Math.max(0, x0 * K - M);
  const by = x1 < 0 ? 0 : Math.max(0, y0 * K - M);
  const w = (x1 < 0 ? W : Math.min(W, (x1 + 1) * K + M)) - bx;
  const h = (x1 < 0 ? H : Math.min(H, (y1 + 1) * K + M)) - by;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  /* A pixel is there or it is not. */
  const cut = (i: number): Uint8ClampedArray => {
    paintClip(ctx as unknown as Ctx, W, H, series, rowAt(i), o);
    const px = ctx.getImageData(bx, by, w, h).data;
    for (let k = 3; k < px.length; k += 4) {
      if (px[k] >= 128) px[k] = 255;
      else px[k - 3] = px[k - 2] = px[k - 1] = px[k] = 0;
    }
    return px;
  };

  /* One palette for the whole clip, from four moments of it, so a colour
   * does not shimmer from frame to frame. */
  const at = [0, Math.round(frames / 3), Math.round((frames * 2) / 3), frames];
  const sample = new Uint8ClampedArray(w * h * 4 * at.length);
  at.forEach((i, k) => sample.set(cut(i), k * w * h * 4));
  const palette = quantize(sample, 256, { format: "rgba4444", oneBitAlpha: true });
  const clear = palette.findIndex((c) => c[3] === 0);

  const gif = GIFEncoder();
  for (let i = 0; i <= frames; i++) {
    const index = applyPalette(cut(i), palette, "rgba4444");
    gif.writeFrame(index, w, h, {
      palette: i === 0 ? palette : undefined,
      delay: i === frames ? GIF_HOLD_MS : GIF_DELAY_MS,
      transparent: clear >= 0,
      transparentIndex: Math.max(0, clear),
      dispose: 2,
      repeat: 0,
    });
    if (i % 2 === 1) await breathe();
  }
  gif.finish();
  return Buffer.from(gif.bytes());
}
