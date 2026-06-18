import "server-only";
import type { Prisma } from "@prisma/client";
import { r2GetStream, r2Keys } from "./r2";
import { db } from "./db";
import { extractBibsFromImage, type BibDetection } from "./bibOcr";
import { extractBibsDebugRekognition, rekognitionConfigured } from "./bibOcrRekognition";
import { DEFAULT_OCR_SETTINGS, type OcrSettings } from "./bibOcrTypes";
import { indexFacesForPhoto, faceRecConfigured } from "./faceRec";
import { linkFacesToBibsForPhoto } from "./faceBibMatch";
import { detectColorGroupsForPhoto } from "./colorGroups";

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
  bytes: Buffer,
  settings: OcrSettings = DEFAULT_OCR_SETTINGS
): Promise<{ bibs: BibDetection[]; source: string }> {
  if (rekognitionConfigured()) {
    try {
      const debug = await extractBibsDebugRekognition(bytes, settings);
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
}): Promise<{ detectedBibs: number[]; indexedFaceCount: number; colorGroups: string[] }> {
  // Per-event detection config. Gates the env-level *Configured() checks: a
  // feature runs only when BOTH the event flag is on AND the env is configured.
  // Default-on if the event row is missing.
  const ev = await db.event.findUnique({
    where: { id: photo.eventId },
    select: { ocrEnabled: true, faceRecEnabled: true, ocrSettings: true, colorGroupEnabled: true },
  });
  const ocrOn = ev?.ocrEnabled ?? true;
  const faceOn = ev?.faceRecEnabled ?? true;
  const ocrSettings = (ev?.ocrSettings as OcrSettings | null) ?? DEFAULT_OCR_SETTINGS;
  const faceWillRun = faceOn && faceRecConfigured();
  // Color sampling reads the torso below each face box, so it's only meaningful
  // when faces are actually indexed — gate on faceWillRun, not colorGroupEnabled
  // alone (mirrors eventCapabilities' `face && colorGroupEnabled`).
  const colorOn = (ev?.colorGroupEnabled ?? false) && faceWillRun;

  const { body: stream } = await r2GetStream(r2Keys.preview(photo.id));
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.from(c));
  const previewBytes = Buffer.concat(chunks);

  let detectedBibs: BibDetection[] = [];
  let indexedFaceCount = 0;

  const ocrTask = (async () => {
    if (!ocrOn) return;
    try {
      const { bibs, source } = await detectBibs(previewBytes, ocrSettings);
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
    if (!faceWillRun) return;
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

  // Camp color groups: sample each detected person's shirt color and roll the
  // distinct groups up onto the photo. Runs after face indexing (it needs the
  // face boxes) and only when the event opted in. Best-effort.
  let colorGroups: string[] = [];
  if (colorOn) {
    try {
      const res = await detectColorGroupsForPhoto({
        photoId: photo.id,
        eventId: photo.eventId,
        previewBytes,
      });
      colorGroups = res.groups;
    } catch (e) {
      console.warn(`color-group detection failed for photo ${photo.id}:`, e);
    }
  }

  // "Detected" ≡ facesIndexedAt is set (see deadPhotoWhere). indexFacesForPhoto
  // stamps it on success; when face indexing never runs (face-rec disabled for
  // the event, or unconfigured), stamp it here so the dead-photo backfill /
  // "undetected" rollups don't treat the photo as perpetually dead and loop
  // re-detecting it forever.
  if (!faceWillRun) {
    await db.photo
      .update({ where: { id: photo.id }, data: { facesIndexedAt: new Date() } })
      .catch(() => {});
  }

  return { detectedBibs: detectedBibs.map((d) => d.bib), indexedFaceCount, colorGroups };
}

/* --- Forced bulk re-detection (owner "re-run" from Event Settings) --------
 *
 * Unlike the dead-photo backfill below, this re-runs a chosen detection stage
 * over ALL of an event's photos, including ones already processed (a forced
 * re-run after enabling color groups, tuning OCR, etc.). Because a forced re-run
 * does NOT change facesIndexedAt, the "remaining" set never shrinks — so callers
 * page with an id CURSOR rather than re-counting a where-clause.
 */

export type RedetectStage = "ocr" | "faces" | "colors" | "all";

/** All finalized, visible photos for an event (the forced re-run population —
 *  no facesIndexedAt filter, unlike deadPhotoWhere). */
export function eventPhotoWhere(eventId: string): Prisma.PhotoWhereInput {
  return { eventId, hidden: false, NOT: { r2OriginalKey: "pending" } };
}

type EventDetectionFlags = {
  ocrEnabled: boolean;
  faceRecEnabled: boolean;
  colorGroupEnabled: boolean;
  ocrSettings: OcrSettings;
};

/** Re-run one stage for a single photo. Honors the event's per-stage toggles
 *  (won't repopulate data the owner disabled). Best-effort per sub-step. */
async function redetectPhoto(
  photo: { id: string; eventId: string },
  stage: RedetectStage,
  flags: EventDetectionFlags
): Promise<void> {
  const doOcr = (stage === "ocr" || stage === "all") && flags.ocrEnabled;
  const doFaces =
    (stage === "faces" || stage === "all") && flags.faceRecEnabled && faceRecConfigured();
  // Colors run on their own, and implicitly after a face re-index (boxes moved).
  const doColors =
    (stage === "colors" || stage === "faces" || stage === "all") && flags.colorGroupEnabled;

  const { body: stream } = await r2GetStream(r2Keys.preview(photo.id));
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.from(c));
  const previewBytes = Buffer.concat(chunks);

  if (doOcr) {
    // Replace prior OCR detections; preserve manual/user-tag rows.
    await db.photoBib.deleteMany({
      where: { photoId: photo.id, source: { startsWith: "ocr-" } },
    });
    try {
      const { bibs, source } = await detectBibs(previewBytes, flags.ocrSettings);
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
      console.warn(`re-run OCR failed for photo ${photo.id}:`, e);
    }
  }

  if (doFaces) {
    try {
      await indexFacesForPhoto({
        photoId: photo.id,
        eventId: photo.eventId,
        bytes: previewBytes,
        force: true,
      });
    } catch (e) {
      console.warn(`re-run face indexing failed for photo ${photo.id}:`, e);
    }
  }

  // Bib and/or face boxes may have changed — recompute the links.
  if (doOcr || doFaces) {
    try {
      await linkFacesToBibsForPhoto(photo.id);
    } catch (e) {
      console.warn(`re-run face↔bib linking failed for photo ${photo.id}:`, e);
    }
  }

  if (doColors) {
    try {
      await detectColorGroupsForPhoto({
        photoId: photo.id,
        eventId: photo.eventId,
        previewBytes,
      });
    } catch (e) {
      console.warn(`re-run color-group detection failed for photo ${photo.id}:`, e);
    }
  }
}

/**
 * Re-run a detection stage over one CURSOR-paged batch of an event's photos.
 * Returns how many were processed and the next cursor (null when the batch was
 * the last page). Callers loop, passing back `nextCursor`, until it's null.
 */
export async function rerunStageForEvent(opts: {
  eventId: string;
  stage: RedetectStage;
  limit: number;
  cursor?: string | null;
  concurrency?: number;
}): Promise<{ processed: number; nextCursor: string | null }> {
  const { eventId, stage, limit, cursor, concurrency = 4 } = opts;

  const ev = await db.event.findUnique({
    where: { id: eventId },
    select: { ocrEnabled: true, faceRecEnabled: true, colorGroupEnabled: true, ocrSettings: true },
  });
  const flags: EventDetectionFlags = {
    ocrEnabled: ev?.ocrEnabled ?? true,
    faceRecEnabled: ev?.faceRecEnabled ?? true,
    colorGroupEnabled: ev?.colorGroupEnabled ?? false,
    ocrSettings: (ev?.ocrSettings as OcrSettings | null) ?? DEFAULT_OCR_SETTINGS,
  };

  const photos = await db.photo.findMany({
    where: eventPhotoWhere(eventId),
    orderBy: { id: "asc" },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: limit,
    select: { id: true, eventId: true },
  });

  let processed = 0;
  let pos = 0;
  async function worker() {
    while (pos < photos.length) {
      const photo = photos[pos++];
      try {
        await redetectPhoto(photo, stage, flags);
        processed += 1;
      } catch (e) {
        console.warn(`re-run detect failed for ${photo.id}:`, e);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, photos.length) }, () => worker()));

  // A full page means there may be more; a short page is the last one.
  const nextCursor = photos.length === limit ? photos[photos.length - 1].id : null;
  return { processed, nextCursor };
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
