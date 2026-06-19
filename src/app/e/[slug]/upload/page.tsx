import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveActor, ownerEmail } from "@/lib/permissions";
import { UploadClient } from "@/components/photographer/UploadClient";

/**
 * In-event upload page — reached via the event nav's "Upload" link, pinned to
 * THIS event.
 *
 * TEMPORARY lockdown: uploading is restricted to the platform owner's main
 * account (ownerEmail()). This also closes a hole where the legacy
 * photographer-unlock cookie let an apparently-signed-out visitor reach the
 * upload UI. The request/approve photographer flow is paused until we re-open
 * multi-photographer uploads.
 */
export const dynamic = "force-dynamic";

export default async function EventUploadPage({ params }: { params: { slug: string } }) {
  const ev = await db.event.findUnique({
    where: { id: params.slug },
    select: {
      id: true,
      name: true,
      date: true,
      city: true,
      ocrEnabled: true,
      faceRecEnabled: true,
      colorGroupEnabled: true,
    },
  });
  if (!ev) notFound();

  const actor = await getEffectiveActor();
  if (!actor) {
    redirect(`/photographer/sign-in?callbackUrl=${encodeURIComponent(`/e/${params.slug}/upload`)}`);
  }
  // Owner-only for now — anyone else (incl. the unlock-cookie admin) → gallery.
  if (actor.email.toLowerCase().trim() !== ownerEmail()) {
    redirect(`/e/${params.slug}`);
  }

  // Pass the detection flags so the progress panel only shows the pills this
  // event actually runs (a camp with OCR off shouldn't show a Bib OCR pill).
  const eventLite = {
    id: ev.id,
    name: ev.name,
    date: ev.date.toISOString(),
    city: ev.city,
    ocrEnabled: ev.ocrEnabled,
    faceRecEnabled: ev.faceRecEnabled,
    colorGroupEnabled: ev.colorGroupEnabled,
  };
  return <UploadClient events={[eventLite]} defaultEventId={ev.id} />;
}
