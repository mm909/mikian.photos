import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveActor, canManageEvent, isAdmin } from "@/lib/permissions";
import { canUploadToEvent } from "@/lib/events";
import { UploadClient } from "@/components/photographer/UploadClient";

/**
 * In-event upload page (v2.1) — contextual: you reach it via the event nav's
 * "Upload" link, and it's pinned to THIS event. Gated by upload access (event
 * owner, platform owner, or an EventPhotographer membership).
 */
export const dynamic = "force-dynamic";

export default async function EventUploadPage({ params }: { params: { slug: string } }) {
  const ev = await db.event.findUnique({
    where: { id: params.slug },
    select: { id: true, name: true, date: true, city: true, ownerId: true },
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
  if (!allowed) redirect(`/e/${params.slug}`);

  // UploadClient takes a list + default; here it's a single pinned event.
  const eventLite = {
    id: ev.id,
    name: ev.name,
    date: ev.date.toISOString(),
    city: ev.city,
  };
  return <UploadClient events={[eventLite]} defaultEventId={ev.id} />;
}
