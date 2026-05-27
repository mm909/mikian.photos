import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { r2Configured, r2GetStream, r2Keys } from "@/lib/r2";
import { extractBibsFromImage } from "@/lib/bibOcr";
import { getEffectivePhotographerId, isPhotographerUnlocked } from "@/lib/photographerLock";

/**
 * Re-run bib OCR on a single photo. Drops the photo's existing `ocr-tesseract`
 * PhotoBib rows, re-runs the detector against the preview bytes in R2, and
 * inserts fresh rows. Manual + user-tag rows are preserved.
 *
 * POST /api/photographer/photos/[id]/rerun-ocr
 * Returns: { detected: [{bib, confidence}], total: N }
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
    select: { id: true, photographerId: true },
  });
  if (!photo) return NextResponse.json({ error: "unknown photo" }, { status: 404 });

  // Owner-or-admin (unlock cookie counts as admin)
  if (photo.photographerId !== photographerId && !isPhotographerUnlocked()) {
    return NextResponse.json({ error: "not your photo" }, { status: 403 });
  }

  const previewKey = r2Keys.preview(photo.id);

  let bytes: Buffer;
  try {
    const { body } = await r2GetStream(previewKey);
    const chunks: Buffer[] = [];
    for await (const c of body) chunks.push(Buffer.from(c));
    bytes = Buffer.concat(chunks);
  } catch (e) {
    return NextResponse.json(
      { error: `preview missing in R2: ${e instanceof Error ? e.message : e}` },
      { status: 400 }
    );
  }

  const detected = await extractBibsFromImage(bytes);

  // Replace OCR detections, leave manual/user-tag intact.
  await db.photoBib.deleteMany({
    where: { photoId: photo.id, source: { startsWith: "ocr-" } },
  });
  if (detected.length > 0) {
    await db.photoBib.createMany({
      data: detected.map((d) => ({
        photoId: photo.id,
        bib: d.bib,
        confidence: d.confidence,
        source: "ocr-tesseract",
      })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({
    detected,
    total: detected.length,
  });
}
