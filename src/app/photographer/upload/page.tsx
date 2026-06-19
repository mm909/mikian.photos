import { db } from "@/lib/db";
import { UploadClient } from "@/components/photographer/UploadClient";
import { getEffectiveActor, ownerEmail } from "@/lib/permissions";
import { listEvents } from "@/lib/events";
import { NoPhotographerAccess } from "@/components/photographer/NoPhotographerAccess";

/**
 * TEMPORARY lockdown: uploading is restricted to the platform owner's main
 * account (ownerEmail()) — see the per-event upload page for context. Re-open
 * per-event photographer uploads later.
 */
export default async function UploadPage() {
  const actor = await getEffectiveActor();
  if (!actor) {
    return <NoPhotographerAccess reason="signed-out" />;
  }
  if (actor.email.toLowerCase().trim() !== ownerEmail()) {
    return <NoPhotographerAccess reason="no-role" name={actor.name} />;
  }

  // Owner uploads to any non-archived event.
  const events = await listEvents();

  if (events.length === 0) {
    return (
      <main className="screen" style={{ padding: "96px 24px", textAlign: "center" }}>
        <p style={{ color: "var(--muted)" }}>
          You don&rsquo;t have upload access to any event yet. Ask the owner to add you to an
          event under <code>/admin/events</code>.
        </p>
      </main>
    );
  }

  // Pre-select the photographer's primary event when they can upload to it.
  const me = await db.photographer.findUnique({
    where: { id: actor.photographerId },
    select: { primaryEventId: true },
  });
  const defaultEventId =
    me?.primaryEventId && events.some((e) => e.id === me.primaryEventId)
      ? me.primaryEventId
      : events[0].id;

  return (
    <UploadClient
      events={events.map((e) => ({
        id: e.id,
        name: e.name,
        date: e.date.toISOString(),
        city: e.city,
        ocrEnabled: e.ocrEnabled,
        faceRecEnabled: e.faceRecEnabled,
        colorGroupEnabled: e.colorGroupEnabled,
      }))}
      defaultEventId={defaultEventId}
      // Multi-photographer invite/manage is paused while uploads are owner-only
      // (no share link on the upload page). Re-enable when we re-open uploads.
    />
  );
}
