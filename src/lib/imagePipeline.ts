import sharp from "sharp";
import exifr from "exifr";

/**
 * Two-version model:
 *   - `originalBytes` is what the photographer uploaded — untouched, full-fidelity
 *   - `previewBytes` is a 1600px JPEG (no watermark, per product policy —
 *     anti-theft is handled by smaller resolution + server-gated originals)
 * Plus best-effort EXIF: takenAt, GPS (preserved on the original; the preview
 * is re-encoded by sharp and EXIF is dropped by default — that's what we want
 * for the public preview).
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

/**
 * Run the upload pipeline against raw bytes. Sharp instance is reused — fast
 * after the first call; cold-start is ~700ms on Vercel-style serverless.
 */
export async function processUpload(input: Buffer): Promise<ProcessedUpload> {
  // EXIF first (exifr is tolerant of non-EXIF inputs and returns undefined).
  // We read GPS + DateTimeOriginal so the row carries the data even though
  // the *preview* JPEG strips EXIF on re-encode.
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

  // Preview pipeline: resize to long-edge cap, JPEG-encode. No watermark.
  const base = sharp(input, { failOn: "none" }).rotate(); // auto-orient via EXIF
  const meta = await base.metadata();
  const targetW = Math.min(meta.width ?? PREVIEW_MAX_PX, PREVIEW_MAX_PX);
  const targetH = Math.min(meta.height ?? PREVIEW_MAX_PX, PREVIEW_MAX_PX);

  const previewBytes = await base
    .resize({
      width: targetW,
      height: targetH,
      fit: "inside",
      withoutEnlargement: true,
    })
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
