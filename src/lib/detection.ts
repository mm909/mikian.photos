import "server-only";
import type { Prisma } from "@prisma/client";
import { r2GetStream, r2Keys } from "./r2";
import { db } from "./db";
import { extractBibsFromImage, type BibDetection } from "./bibOcr";
import { extractBibsDebugRekognition, rekognitionConfigured } from "./bibOcrRekognition";
import { DEFAULT_OCR_SETTINGS } from "./bibOcrTypes";
import { indexFacesForPhoto, faceRecConfigured } from "./faceRec";
import { linkFacesToBibsForPhoto } from "./faceBibMatch";

/**
 * Shared detection pass (bib OCR + face indexing + linking) for one uploaded
 * photo. Used by the per-photo /detect route AND the "dead photo" backfill
 * (manual button + cron), so the work is defined in exactly one place.
 *
 * A photo is considered DETECTED once `facesIndexedAt` is set — that's what
 * `indexFacesForPhoto` writes on success, and what the backfill query keys off.
 */

/** Bib OCR: Rekognition DetectText primary, Tesseract only as a fallback. */
async function detectBibs(
  bytes: Buffer
): Promise<{ bibs: BibDetection[]; source: string }> {
  if (rekognitionConfigured()) {
    try {
      const debug = await extractBibsDebugRekognition(bytes, DEFAULT_OCR_SETTINGS);
      if (debug) return { bibs: debug.bibs, source: "ocr-rekognition" };
      console.warn("Rekognition OCR returned null — falling back to Tesseract");
    } catch (e) {
      console.warn(
        "Rekognition OCR threw — falling back to Tesseract:",
        e instanceof Error ? e.message : e
      );
    }
  }
  return { bibs: await extractBibsFromImage(bytes), source: "ocr-tesseract" };
}

/**
 * Run detection against a photo's preview (pulled from R2). Bib OCR and face
 * indexing run concurrently; both are best-effort and never throw. Returns the
 * detected bib numbers + indexed face count. Throws only if the preview can't
 * be read (caller decides what that means).
 */
export async function runDetection(photo: {
  id: string;
  eventId: string;
}): Promise<{ detectedBibs: number[]; indexedFaceCount: number }> {
  const { body: stream } = await r2GetStream(r2Keys.preview(photo.id));
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.from(c));
  const previewBytes = Buffer.concat(chunks);

  let detectedBibs: BibDetection[] = [];
  let indexedFaceCount = 0;

  const ocrTask = (async () => {
    try {
      const { bibs, source } = await detectBibs(previewBytes);
      detectedBibs = bibs;
      if (bibs.length > 0) {
        await db.photoBib.createMany({
          data: bibs.map((d) => ({
            photoId: photo.id,
            bib: d.bib,
            confidence: d.confidence,
            source,
            x0: d.bbox?.x0 ?? null,
            y0: d.bbox?.y0 ?? null,
            x1: d.bbox?.x1 ?? null,
            y1: d.bbox?.y1 ?? null,
          })),
          skipDuplicates: true,
        });
      }
    } catch (e) {
      console.warn(`bib OCR failed for photo ${photo.id}:`, e);
    }
  })();

  const faceTask = (async () => {
    if (!faceRecConfigured()) return;
    try {
      const indexed = await indexFacesForPhoto({
        photoId: photo.id,
        eventId: photo.eventId,
        bytes: previewBytes,
      });
      indexedFaceCount = indexed.length;
    } catch (e) {
      console.warn(`face indexing failed for photo ${photo.id}:`, e);
    }
  })();

  await Promise.all([ocrTask, faceTask]);

  try {
    await linkFacesToBibsForPhoto(photo.id);
  } catch (e) {
    console.warn(`face↔bib linking failed for photo ${photo.id}:`, e);
  }

  return { detectedBibs: detectedBibs.map((d) => d.bib), indexedFaceCount };
}

/**
 * Where-clause for "dead" photos: finalized (preview written) but never
 * face-indexed — i.e. detection never completed (a tab closed mid-tagging, an
 * old failure, etc.). Excludes hidden + still-pending uploads.
 */
export function deadPhotoWhere(eventId?: string): Prisma.PhotoWhereInput {
  return {
    ...(eventId ? { eventId } : {}),
    hidden: false,
    facesIndexedAt: null,
    // Only finalized photos (skip "pending" placeholders from aborted uploads).
    NOT: { r2OriginalKey: "pending" },
  };
}

/**
 * Detect a batch of dead photos matching `where`. Bounded by `limit` so a
 * single serverless invocation stays within its time budget; callers loop
 * until `remaining` is 0. Concurrency keeps it brisk without hammering
 * Rekognition.
 */
export async function backfillDeadPhotos(opts: {
  where: Prisma.PhotoWhereInput;
  limit: number;
  concurrency?: number;
}): Promise<{ processed: number; remaining: number }> {
  const { where, limit, concurrency = 4 } = opts;

  const photos = await db.photo.findMany({
    where,
    select: { id: true, eventId: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let processed = 0;
  // Simple bounded pool over the batch.
  let cursor = 0;
  async function worker() {
    while (cursor < photos.length) {
      const photo = photos[cursor++];
      try {
        await runDetection(photo);
        processed += 1;
      } catch (e) {
        console.warn(`backfill detect failed for ${photo.id}:`, e);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, photos.length) }, () => worker()));

  const remaining = await db.photo.count({ where });
  return { processed, remaining };
}
