import { db } from "@/lib/db";
import { UploadClient } from "@/components/photographer/UploadClient";
import { getEffectiveActor, hasRole, isAdmin } from "@/lib/permissions";
import { listUploadableEvents } from "@/lib/events";
import { NoPhotographerAccess } from "@/components/photographer/NoPhotographerAccess";

export default async function UploadPage() {
  const actor = await getEffectiveActor();
  if (!actor) {
    return <NoPhotographerAccess reason="signed-out" />;
  }
  if (!hasRole(actor, "photographer")) {
    return <NoPhotographerAccess reason="no-role" name={actor.name} />;
  }

  // Multi-event: the events this photographer may upload to (owner/RD = all;
  // a plain photographer = their EventPhotographer memberships).
  const events = await listUploadableEvents({
    photographerId: actor.photographerId,
    isAdmin: isAdmin(actor),
  });

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
      // The platform owner can manage who else may upload, right from here.
      // (Per-event owners + the real enforcement live in the photographers API.)
      canManagePhotographers={isAdmin(actor)}
    />
  );
}
