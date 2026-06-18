import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { r2Configured, r2GetStream, r2Keys } from "@/lib/r2";
import { faceRecConfigured, indexFacesForPhoto } from "@/lib/faceRec";
import { linkFacesToBibsForPhoto } from "@/lib/faceBibMatch";
import { detectColorGroupsForPhoto } from "@/lib/colorGroups";
import { getEffectiveActor, hasRole, isAdmin } from "@/lib/permissions";

/**
 * Re-run face indexing for a single photo.
 *
 *   POST /api/photographer/photos/[id]/rerun-faces
 *
 * Mirrors rerun-ocr: pulls the preview from R2, drops the photo's existing
 * Rekognition entries (both PhotoFace rows AND the FaceIds in the
 * collection), then re-indexes from scratch. Forced — the underlying
 * indexFacesForPhoto({ force: true }) skips the facesIndexedAt short-circuit.
 *
 * Returns: { indexed: number, faces: [{rekognitionFaceId, confidence, bbox}] }
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
  if (!faceRecConfigured()) {
    return NextResponse.json(
      { error: "Face recognition is not configured on this deploy" },
      { status: 503 }
    );
  }

  const photo = await db.photo.findUnique({
    where: { id: params.id },
    select: { id: true, eventId: true, photographerId: true },
  });
  if (!photo) return NextResponse.json({ error: "unknown photo" }, { status: 404 });

  if (photo.photographerId !== actor.photographerId && !isAdmin(actor)) {
    return NextResponse.json({ error: "not your photo" }, { status: 403 });
  }

  // Respect the per-event toggle — don't re-populate faces the owner turned off.
  const ev = await db.event.findUnique({
    where: { id: photo.eventId },
    select: { faceRecEnabled: true, colorGroupEnabled: true },
  });
  if (ev && ev.faceRecEnabled === false) {
    return NextResponse.json(
      { error: "Face recognition is disabled for this event" },
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

  try {
    const indexed = await indexFacesForPhoto({
      photoId: photo.id,
      eventId: photo.eventId,
      bytes,
      force: true,
    });
    // New face boxes — recompute the face↔bib links for this photo.
    await linkFacesToBibsForPhoto(photo.id);
    // Re-detect camp color groups off the fresh face boxes when enabled.
    let colorGroups: string[] = [];
    if (ev?.colorGroupEnabled) {
      try {
        const res = await detectColorGroupsForPhoto({
          photoId: photo.id,
          eventId: photo.eventId,
          previewBytes: bytes,
        });
        colorGroups = res.groups;
      } catch (e) {
        console.warn(`color-group detection failed for photo ${photo.id}:`, e);
      }
    }
    return NextResponse.json({
      indexed: indexed.length,
      faces: indexed,
      colorGroups,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `face indexing failed: ${msg}` },
      { status: 500 }
    );
  }
}
