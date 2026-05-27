import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { r2Configured, r2GetStream, r2Keys, r2Put } from "@/lib/r2";
import { processUpload } from "@/lib/imagePipeline";
import { getEffectivePhotographerId } from "@/lib/photographerLock";

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

  return NextResponse.json({
    photo: { ...updated, previewUrl: `/api/photos/${updated.id}/preview` },
  });
}
