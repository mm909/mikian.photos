import { getEffectiveActor } from "@/lib/permissions";
import { NoPhotographerAccess } from "@/components/photographer/NoPhotographerAccess";
import { FaceLab } from "@/components/photographer/FaceLab";
import { db } from "@/lib/db";

/**
 * Face inspection lab — pick a photo, see Rekognition's face bboxes on top
 * of it, inspect cluster membership, force a re-index, and explore which
 * other photos share each detected face cluster across the event.
 *
 * Mirrors the OCR Lab in shape but skips the tuning knobs — face rec has
 * no live-tunable settings (clustering threshold + MaxFaces are server-
 * side constants by design).
 *
 * URL params:
 *   ?photo=<photoId>   prefill the photo picker
 */
export default async function FaceLabPage({
  searchParams,
}: {
  searchParams?: { photo?: string };
}) {
  const actor = await getEffectiveActor();
  if (!actor) return <NoPhotographerAccess reason="signed-out" />;
  if (!actor.roles.includes("photographer") && !actor.roles.includes("owner")) {
    return <NoPhotographerAccess reason="no-role" name={actor.name} />;
  }

  // Same scope rule as the OCR lab: owner sees everyone's photos, the
  // photographer sees their own. Cap at 24 recent photos so the thumb
  // strip stays light.
  const isAdmin = actor.roles.includes("owner");
  const rows = await db.photo.findMany({
    where: isAdmin ? {} : { photographerId: actor.photographerId },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: {
      id: true,
      eventId: true,
      takenAt: true,
      facesIndexedAt: true,
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
    takenAt: r.takenAt?.toISOString() ?? null,
    facesIndexedAt: r.facesIndexedAt?.toISOString() ?? null,
    faces: r.faces.map((f) => ({
      id: f.id,
      rekognitionFaceId: f.rekognitionFaceId,
      faceClusterId: f.faceClusterId,
      confidence: f.confidence,
      bbox: { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 },
      source: f.source,
    })),
    previewUrl: publicBase
      ? `${publicBase}/previews/${r.id}.jpg`
      : `/api/photos/${r.id}/preview`,
  }));

  return <FaceLab recent={recent} initialPhotoId={searchParams?.photo} />;
}
