import sharp from "sharp";
import exifr from "exifr";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Two-version model:
 *   - `originalBytes` is what the photographer uploaded — untouched, full-fidelity
 *   - `previewBytes` is a 1600px JPEG with the brand watermark composited on
 *     (server-side, can't be tampered with client-side)
 * Plus best-effort EXIF: takenAt, GPS.
 */
export type ProcessedUpload = {
  originalBytes: Buffer;
  previewBytes: Buffer;
  takenAt: Date | null;
  gpsLat: number | null;
  gpsLng: number | null;
};

const PREVIEW_MAX_PX = 1600;
const PREVIEW_JPEG_QUALITY = 75;
const WATERMARK_TILE_PATH = join(process.cwd(), "public", "assets", "watermark-tile.svg");

let _watermarkSvg: Buffer | null = null;
function watermarkSvg(): Buffer {
  if (_watermarkSvg) return _watermarkSvg;
  _watermarkSvg = readFileSync(WATERMARK_TILE_PATH);
  return _watermarkSvg;
}

/**
 * Run the upload pipeline against raw bytes. Sharp instance is reused — fast
 * after the first call; cold-start is ~700ms on Vercel-style serverless.
 */
export async function processUpload(input: Buffer): Promise<ProcessedUpload> {
  // EXIF first (exifr is tolerant of non-EXIF inputs and returns undefined)
  let takenAt: Date | null = null;
  let gpsLat: number | null = null;
  let gpsLng: number | null = null;
  try {
    const exif = await exifr.parse(input, { gps: true });
    if (exif?.DateTimeOriginal instanceof Date) takenAt = exif.DateTimeOriginal;
    else if (typeof exif?.DateTimeOriginal === "string") takenAt = new Date(exif.DateTimeOriginal);
    if (typeof exif?.latitude === "number") gpsLat = exif.latitude;
    if (typeof exif?.longitude === "number") gpsLng = exif.longitude;
  } catch {
    // EXIF parse failures are non-fatal — proceed with nulls.
  }

  // Preview pipeline: resize, watermark, encode JPEG
  const base = sharp(input, { failOn: "none" }).rotate(); // auto-orient via EXIF
  const meta = await base.metadata();
  const targetW = Math.min(meta.width ?? PREVIEW_MAX_PX, PREVIEW_MAX_PX);
  const targetH = Math.min(meta.height ?? PREVIEW_MAX_PX, PREVIEW_MAX_PX);

  // Resize first to a target box (long-edge cap)
  const resized = await base.resize({
    width: targetW,
    height: targetH,
    fit: "inside",
    withoutEnlargement: true,
  }).toBuffer();
  const resizedMeta = await sharp(resized).metadata();
  const finalW = resizedMeta.width ?? targetW;
  const finalH = resizedMeta.height ?? targetH;

  // Build a watermark tile sized for this image:
  //  - the SVG is rotated -22° in CSS in the demo; we bake the rotation into
  //    a Sharp-rendered tile and composite at 22% opacity
  //  - the SVG is rasterized at the image's width so tile density scales
  const tileWidth = Math.round(finalW * 0.9);
  const tile = await sharp(watermarkSvg(), { density: 288 })
    .resize({ width: tileWidth, fit: "inside" })
    .rotate(-22, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha(0.22)
    .png()
    .toBuffer();

  const previewBytes = await sharp(resized)
    .composite([{ input: tile, gravity: "center", blend: "over" }])
    .jpeg({ quality: PREVIEW_JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  return {
    originalBytes: input,
    previewBytes,
    takenAt,
    gpsLat,
    gpsLng,
  };
}
