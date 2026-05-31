import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { r2Configured } from "@/lib/r2";
import { getEffectivePhotographerId } from "@/lib/photographerLock";
import { runDetection } from "@/lib/detection";

/**
 * Detection pass for an already-uploaded photo: bib OCR + face indexing.
 *
 *   POST /api/photographer/photos/[id]/detect
 *
 * The SECOND half of the upload pipeline, split out from /finalize so uploads
 * complete fast and detection backfills in the background. Bib OCR uses
 * Rekognition primary / Tesseract fallback; both OCR + faces are best-effort.
 * The actual work lives in lib/detection.ts (shared with the dead-photo
 * backfill button + cron).
 */
export const runtime = "nodejs";
export const maxDuration = 60;

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

  try {
    const result = await runDetection({ id: photo.id, eventId: photo.eventId });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: `detection failed: ${e instanceof Error ? e.message : e}` },
      { status: 400 }
    );
  }
}
