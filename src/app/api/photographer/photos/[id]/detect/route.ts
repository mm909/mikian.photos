import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { r2Configured, r2GetStream, r2Keys } from "@/lib/r2";
import { getEffectivePhotographerId } from "@/lib/photographerLock";
import { extractBibsFromImage, type BibDetection } from "@/lib/bibOcr";
import {
  extractBibsDebugRekognition,
  rekognitionConfigured,
} from "@/lib/bibOcrRekognition";
import { DEFAULT_OCR_SETTINGS } from "@/lib/bibOcrTypes";
import { indexFacesForPhoto, faceRecConfigured } from "@/lib/faceRec";
import { linkFacesToBibsForPhoto } from "@/lib/faceBibMatch";

/**
 * Detection pass for an already-uploaded photo: bib OCR + face indexing.
 *
 *   POST /api/photographer/photos/[id]/detect
 *
 * This is the SECOND half of the upload pipeline, split out from /finalize so
 * uploads can complete fast (preview + DB only) and detection backfills in the
 * background — the client runs this against each uploaded photo after it lands.
 *
 * Bib OCR uses AWS Rekognition DetectText as the primary engine; Tesseract is
 * only used as a fallback when Rekognition isn't configured or errors. Both bib
 * OCR and face indexing are best-effort and never fail the request.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Bib OCR: Rekognition first (fast + accurate), Tesseract only as a fallback.
 */
async function detectBibs(
  bytes: Buffer
): Promise<{ bibs: BibDetection[]; source: string }> {
  if (rekognitionConfigured()) {
    try {
      const debug = await extractBibsDebugRekognition(bytes, DEFAULT_OCR_SETTINGS);
      // extractBibsDebugRekognition resolves null on any failure, so a non-null
      // result means Rekognition ran — trust it and don't touch Tesseract.
      if (debug) return { bibs: debug.bibs, source: "ocr-rekognition" };
      console.warn("Rekognition OCR returned null — falling back to Tesseract");
    } catch (e) {
      console.warn(
        "Rekognition OCR threw — falling back to Tesseract:",
        e instanceof Error ? e.message : e
      );
    }
  }
  const bibs = await extractBibsFromImage(bytes);
  return { bibs, source: "ocr-tesseract" };
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const photographerId = await getEffectivePhotographerId();
  if (!photographerId) {
    return NextResponse.json({ error: "Photographer access required" }, { status: 401 });
  }
  if (!r2Configured()) {
    return NextResponse.json({ error: "Photo storage not configured" }, { status: 503 });
  }

  const photo = await db.photo.findUnique({
    where: { id: params.id },
    select: { id: true, photographerId: true, eventId: true },
  });
  if (!photo) return NextResponse.json({ error: "unknown photoId" }, { status: 404 });
  if (photo.photographerId !== photographerId) {
    return NextResponse.json({ error: "not your photo" }, { status: 403 });
  }

  // Detection runs against the resized preview (faster + consistent dimensions).
  let previewBytes: Buffer;
  try {
    const { body: stream } = await r2GetStream(r2Keys.preview(photo.id));
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(Buffer.from(c));
    previewBytes = Buffer.concat(chunks);
  } catch (e) {
    return NextResponse.json(
      { error: `preview missing in R2: ${e instanceof Error ? e.message : e}` },
      { status: 400 }
    );
  }

  // Bib OCR + face indexing are independent — run them concurrently. Both are
  // best-effort; a failure in either just leaves that signal empty.
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

  // Link each face to the bib directly below it — after both detectors so it
  // sees the full set of boxes. Best-effort.
  try {
    await linkFacesToBibsForPhoto(photo.id);
  } catch (e) {
    console.warn(`face↔bib linking failed for photo ${photo.id}:`, e);
  }

  return NextResponse.json({
    detectedBibs: detectedBibs.map((d) => d.bib),
    indexedFaceCount,
  });
}
