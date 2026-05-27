import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { r2Configured, r2Keys, r2PresignPut } from "@/lib/r2";
import { getEffectivePhotographerId } from "@/lib/photographerLock";

/**
 * Mint a presigned PUT URL so the browser can upload the original JPEG straight
 * to R2 (no 4.5MB Vercel body limit).
 *
 * Body: { eventId: string, contentType?: string }
 * Returns: { photoId, uploadUrl }
 *
 * Creates a placeholder Photo row so we have a stable ID for the R2 key.
 * Once the client PUTs the bytes, it calls /api/photographer/photos/finalize
 * with the same photoId to kick off EXIF + preview processing.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  const photographerId = await getEffectivePhotographerId();
  if (!photographerId) {
    return NextResponse.json(
      { error: "Photographer access required — sign in or unlock first" },
      { status: 401 }
    );
  }
  if (!r2Configured()) {
    return NextResponse.json({ error: "Photo storage not configured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    eventId?: string;
    contentType?: string;
  };
  if (!body.eventId) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }

  const event = await db.event.findUnique({ where: { id: body.eventId } });
  if (!event) {
    return NextResponse.json({ error: "unknown eventId" }, { status: 404 });
  }

  const placeholder = await db.photo.create({
    data: {
      eventId: body.eventId,
      photographerId,
      r2OriginalKey: "pending",
      r2PreviewKey: "pending",
    },
    select: { id: true },
  });

  const originalKey = r2Keys.original(placeholder.id);
  const uploadUrl = await r2PresignPut(originalKey, body.contentType ?? "image/jpeg", 900);

  return NextResponse.json({
    photoId: placeholder.id,
    uploadUrl,
  });
}
