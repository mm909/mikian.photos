import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { r2Configured, r2GetStream, r2Keys, r2Put } from "@/lib/r2";
import { processUpload } from "@/lib/imagePipeline";
import { getEffectivePhotographerId } from "@/lib/photographerLock";
import { extractBibsFromImage, type BibDetection } from "@/lib/bibOcr";
import { indexFacesForPhoto, faceRecConfigured } from "@/lib/faceRec";
import { linkFacesToBibsForPhoto } from "@/lib/faceBibMatch";

/**
 * Finalize a presigned upload: the client has PUT the original JPEG to R2,
 * now we pull it back, run EXIF + preview pipeline, write the preview, and
 * patch the Photo row with the real R2 keys + EXIF data.
 *
 * Body: { photoId: string }
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const photographerId = await getEffectivePhotographerId();
  if (!photographerId) {
    return NextResponse.json({ error: "Photographer access required" }, { status: 401 });
  }
  if (!r2Configured()) {
    return NextResponse.json({ error: "Photo storage not configured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { photoId?: string };
  if (!body.photoId) {
    return NextResponse.json({ error: "photoId required" }, { status: 400 });
  }

  const photo = await db.photo.findUnique({
    where: { id: body.photoId },
    select: { id: true, photographerId: true },
  });
  if (!photo) return NextResponse.json({ error: "unknown photoId" }, { status: 404 });
  if (photo.photographerId !== photographerId) {
    return NextResponse.json({ error: "not your photo" }, { status: 403 });
  }

  const originalKey = r2Keys.original(photo.id);

  // Pull the original from R2 — small server-to-server transfer, no Vercel
  // body limit involved.
  let bytes: Buffer;
  try {
    const { body: stream } = await r2GetStream(originalKey);
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(Buffer.from(c));
    bytes = Buffer.concat(chunks);
  } catch (e) {
    // Drop the orphan row — client can re-sign + retry
    await db.photo.delete({ where: { id: photo.id } }).catch(() => undefined);
    return NextResponse.json(
      {
        error: `original missing in R2 (PUT may have failed): ${e instanceof Error ? e.message : e}`,
      },
      { status: 400 }
    );
  }

  let processed;
  try {
    processed = await processUpload(bytes);
  } catch (e) {
    return NextResponse.json(
      { error: `image-processing failed: ${e instanceof Error ? e.message : e}` },
      { status: 500 }
    );
  }

  const previewKey = r2Keys.preview(photo.id);
  try {
    await r2Put(previewKey, processed.previewBytes, "image/jpeg");
  } catch (e) {
    return NextResponse.json(
      { error: `preview upload failed: ${e instanceof Error ? e.message : e}` },
      { status: 500 }
    );
  }

  const updated = await db.photo.update({
    where: { id: photo.id },
    data: {
      r2OriginalKey: originalKey,
      r2PreviewKey: previewKey,
      takenAt: processed.takenAt,
      gpsLat: processed.gpsLat,
      gpsLng: processed.gpsLng,
    },
    select: { id: true, eventId: true, takenAt: true, gpsLat: true, gpsLng: true },
  });

  // Bib OCR and face indexing are independent and both only read the preview
  // bytes, so run them concurrently — roughly halves per-photo detection time
  // vs. the old sequential pass. Both are best-effort; neither blocks (or
  // fails) the upload, and detection results just surface as live progress.
  let detectedBibs: BibDetection[] = [];
  let indexedFaceCount = 0;

  const ocrTask = (async () => {
    try {
      // Run against the resized preview (faster) so Tesseract sees consistent
      // dimensions regardless of source camera.
      detectedBibs = await extractBibsFromImage(processed.previewBytes);
      if (detectedBibs.length > 0) {
        await db.photoBib.createMany({
          data: detectedBibs.map((d) => ({
            photoId: photo.id,
            bib: d.bib,
            confidence: d.confidence,
            source: "ocr-tesseract",
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

  // Skipped silently when Rekognition env isn't configured (e.g. preview
  // deploys without AWS creds).
  const faceTask = (async () => {
    if (!faceRecConfigured()) return;
    try {
      const indexed = await indexFacesForPhoto({
        photoId: photo.id,
        eventId: updated.eventId,
        bytes: processed.previewBytes,
      });
      indexedFaceCount = indexed.length;
    } catch (e) {
      console.warn(`face indexing failed for photo ${photo.id}:`, e);
    }
  })();

  await Promise.all([ocrTask, faceTask]);

  // Link each face to the bib directly below it (face-above-bib geometry).
  // Runs after both detectors so it sees the full set of boxes. Best-effort —
  // a failure here just leaves faces unlinked until the next rerun.
  try {
    await linkFacesToBibsForPhoto(photo.id);
  } catch (e) {
    console.warn(`face↔bib linking failed for photo ${photo.id}:`, e);
  }

  return NextResponse.json({
    photo: {
      ...updated,
      previewUrl: `/api/photos/${updated.id}/preview`,
      detectedBibs: detectedBibs.map((d) => d.bib),
      indexedFaceCount,
    },
  });
}
