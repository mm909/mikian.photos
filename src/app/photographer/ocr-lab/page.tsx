import { getEffectiveActor } from "@/lib/permissions";
import { NoPhotographerAccess } from "@/components/photographer/NoPhotographerAccess";
import { OcrLab } from "@/components/photographer/OcrLab";
import { db } from "@/lib/db";

/**
 * Detection lab — covers both OCR and face inspection.
 *
 * One page, one URL (kept as `/photographer/ocr-lab` for backward compat),
 * with a mode toggle inside that swaps the right-rail content and the
 * image overlay. The OCR side dials Tesseract / Rekognition-DetectText
 * settings live; the Faces side shows Rekognition face bboxes + cluster
 * membership + a force-re-index escape hatch.
 *
 * URL params:
 *   ?photo=<photoId>      prefill the photo picker
 *   ?mode=ocr|faces       start in the given mode (default ocr)
 */
export default async function OcrLabPage({
  searchParams,
}: {
  searchParams?: { photo?: string; mode?: string };
}) {
  const actor = await getEffectiveActor();
  if (!actor) return <NoPhotographerAccess reason="signed-out" />;
  if (!actor.roles.includes("photographer") && !actor.roles.includes("owner")) {
    return <NoPhotographerAccess reason="no-role" name={actor.name} />;
  }

  // Show recent photos in a thumbnail strip so the lab can switch between
  // them without a round-trip through the library. Cap at 24 to keep the
  // page light. We carry each photo's existing PhotoBib rows (bib + source
  // + confidence) AND its PhotoFace rows (bbox + cluster + confidence) so
  // both modes have what they need without a second fetch.
  const isAdmin = actor.roles.includes("owner");
  const rows = await db.photo.findMany({
    where: isAdmin ? {} : { photographerId: actor.photographerId },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: {
      id: true,
      eventId: true,
      takenAt: true,
      gpsLat: true,
      gpsLng: true,
      facesIndexedAt: true,
      bibs: {
        select: { bib: true, confidence: true, source: true },
        orderBy: { confidence: "desc" },
      },
      faces: {
        select: {
          id: true,
          rekognitionFaceId: true,
          faceClusterId: true,
          confidence: true,
          x0: true,
          y0: true,
          x1: true,
          y1: true,
          source: true,
        },
        orderBy: { confidence: "desc" },
      },
    },
  });
  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  const recent = rows.map((r) => ({
    id: r.id,
    eventId: r.eventId,
    bibs: r.bibs.map((b) => b.bib),
    tags: r.bibs.map((b) => ({
      bib: b.bib,
      confidence: b.confidence,
      source: b.source,
    })),
    faces: r.faces.map((f) => ({
      id: f.id,
      rekognitionFaceId: f.rekognitionFaceId,
      faceClusterId: f.faceClusterId,
      confidence: f.confidence,
      bbox: { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 },
      source: f.source,
    })),
    facesIndexedAt: r.facesIndexedAt?.toISOString() ?? null,
    takenAt: r.takenAt?.toISOString() ?? null,
    gps:
      r.gpsLat != null && r.gpsLng != null
        ? ([r.gpsLat, r.gpsLng] as [number, number])
        : null,
    previewUrl: publicBase
      ? `${publicBase}/previews/${r.id}.jpg`
      : `/api/photos/${r.id}/preview`,
  }));

  const initialMode =
    searchParams?.mode === "faces" ? "faces" : ("ocr" as "ocr" | "faces");

  return (
    <OcrLab
      recent={recent}
      initialPhotoId={searchParams?.photo}
      initialMode={initialMode}
    />
  );
}
