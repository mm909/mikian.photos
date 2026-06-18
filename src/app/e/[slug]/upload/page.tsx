import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveActor, canManageEvent, isAdmin } from "@/lib/permissions";
import { canUploadToEvent } from "@/lib/events";
import { UploadClient } from "@/components/photographer/UploadClient";
import { RequestUploadAccess } from "@/components/photographer/RequestUploadAccess";

/**
 * In-event upload page (v2.1) — contextual: you reach it via the event nav's
 * "Upload" link, and it's pinned to THIS event. Gated by upload access (event
 * owner, platform owner, or an EventPhotographer membership).
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
      ownerId: true,
      ocrEnabled: true,
      faceRecEnabled: true,
      colorGroupEnabled: true,
    },
  });
  if (!ev) notFound();

  const actor = await getEffectiveActor();
  if (!actor) redirect(`/photographer/sign-in?callbackUrl=${encodeURIComponent(`/e/${params.slug}/upload`)}`);

  const manage = canManageEvent(actor, ev);
  const allowed = await canUploadToEvent({
    photographerId: actor.photographerId,
    isAdmin: manage || isAdmin(actor),
    eventId: ev.id,
  });
  if (!allowed) {
    // Not an approved uploader → offer to request access (the owner approves)
    // rather than bouncing them away. Surface whether they've already requested.
    const membership = await db.eventPhotographer.findUnique({
      where: { eventId_photographerId: { eventId: ev.id, photographerId: actor.photographerId } },
      select: { status: true },
    });
    return (
      <RequestUploadAccess
        slug={ev.id}
        eventName={ev.name}
        pending={membership?.status === "pending"}
      />
    );
  }

  // UploadClient takes a list + default; here it's a single pinned event. Pass
  // the detection flags so the progress panel only shows the pills this event
  // actually runs (a camp with OCR off shouldn't show a Bib OCR pill).
  const eventLite = {
    id: ev.id,
    name: ev.name,
    date: ev.date.toISOString(),
    city: ev.city,
    ocrEnabled: ev.ocrEnabled,
    faceRecEnabled: ev.faceRecEnabled,
    colorGroupEnabled: ev.colorGroupEnabled,
  };
  return (
    <UploadClient
      events={[eventLite]}
      defaultEventId={ev.id}
      canManagePhotographers={manage}
    />
  );
}
