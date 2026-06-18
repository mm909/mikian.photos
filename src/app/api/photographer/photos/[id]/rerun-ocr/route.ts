import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { r2Configured, r2GetStream, r2Keys } from "@/lib/r2";
import { extractBibsFromImage } from "@/lib/bibOcr";
import { linkFacesToBibsForPhoto } from "@/lib/faceBibMatch";
import { getEffectiveActor, hasRole, isAdmin } from "@/lib/permissions";

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
  const actor = await getEffectiveActor();
  if (!actor || !hasRole(actor, "photographer")) {
    return NextResponse.json({ error: "Photographer access required" }, { status: 401 });
  }
  if (!r2Configured()) {
    return NextResponse.json({ error: "Photo storage not configured" }, { status: 503 });
  }

  const photo = await db.photo.findUnique({
    where: { id: params.id },
    select: { id: true, eventId: true, photographerId: true },
  });
  if (!photo) return NextResponse.json({ error: "unknown photo" }, { status: 404 });

  // Admin (owner OR race director) OR the photo's photographer. Roles come from
  // the user's roles[] column (set on the Google account at sign-in OR on the
  // unlock-cookie admin row) so admins don't need the legacy cookie to act.
  if (photo.photographerId !== actor.photographerId && !isAdmin(actor)) {
    return NextResponse.json({ error: "not your photo" }, { status: 403 });
  }

  // Respect the per-event toggle — don't re-populate bibs the owner turned off.
  const ev = await db.event.findUnique({
    where: { id: photo.eventId },
    select: { ocrEnabled: true },
  });
  if (ev && ev.ocrEnabled === false) {
    return NextResponse.json(
      { error: "Bib OCR is disabled for this event" },
      { status: 409 }
    );
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
        x0: d.bbox?.x0 ?? null,
        y0: d.bbox?.y0 ?? null,
        x1: d.bbox?.x1 ?? null,
        y1: d.bbox?.y1 ?? null,
      })),
      skipDuplicates: true,
    });
  }

  // Bib boxes changed — recompute the face↔bib links for this photo.
  try {
    await linkFacesToBibsForPhoto(photo.id);
  } catch (e) {
    console.warn(`face↔bib linking failed for photo ${photo.id}:`, e);
  }

  return NextResponse.json({
    detected,
    total: detected.length,
  });
}
