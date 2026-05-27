import { getEffectiveActor } from "@/lib/permissions";
import { NoPhotographerAccess } from "@/components/photographer/NoPhotographerAccess";
import { OcrLab } from "@/components/photographer/OcrLab";
import { db } from "@/lib/db";

/**
 * OCR tuning lab — pick a photo, dial Tesseract knobs (PSM, prep width,
 * contrast, threshold, per-length confidence floors, …), hit Run, see the
 * preprocessed image with bbox overlays. Iterate live without touching code.
 *
 * URL params:
 *   ?photo=<photoId>   prefill the photo picker with this id
 */
export default async function OcrLabPage({
  searchParams,
}: {
  searchParams?: { photo?: string };
}) {
  const actor = await getEffectiveActor();
  if (!actor) return <NoPhotographerAccess reason="signed-out" />;
  if (!actor.roles.includes("photographer") && !actor.roles.includes("owner")) {
    return <NoPhotographerAccess reason="no-role" name={actor.name} />;
  }

  // Show recent photos in a thumbnail strip so the lab can switch between
  // them without a round-trip through the library. Cap at 24 to keep the
  // page light.
  const isAdmin = actor.roles.includes("owner");
  const rows = await db.photo.findMany({
    where: isAdmin ? {} : { photographerId: actor.photographerId },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: { id: true, bibs: { select: { bib: true } } },
  });
  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  const recent = rows.map((r) => ({
    id: r.id,
    bibs: r.bibs.map((b) => b.bib),
    previewUrl: publicBase
      ? `${publicBase}/previews/${r.id}.jpg`
      : `/api/photos/${r.id}/preview`,
  }));

  return <OcrLab recent={recent} initialPhotoId={searchParams?.photo} />;
}
