import { db } from "@/lib/db";
import { UploadClient } from "@/components/photographer/UploadClient";
import { getEffectiveActor } from "@/lib/permissions";
import { NoPhotographerAccess } from "@/components/photographer/NoPhotographerAccess";

export default async function UploadPage() {
  const actor = await getEffectiveActor();
  if (!actor) {
    return <NoPhotographerAccess reason="signed-out" />;
  }
  if (!actor.roles.includes("photographer") && !actor.roles.includes("owner")) {
    return <NoPhotographerAccess reason="no-role" name={actor.name} />;
  }

  // Single-event MVP — load the one active event so the dropzone knows where
  // to attach uploads. If multiple events get added later, swap to a picker.
  const event = await db.event.findFirst({
    orderBy: { date: "desc" },
    select: { id: true, name: true, date: true, city: true },
  });

  if (!event) {
    return (
      <main className="screen" style={{ padding: "96px 24px", textAlign: "center" }}>
        <p style={{ color: "var(--muted)" }}>
          No event configured yet. Visit <code>/api/photographer/unlock?key=…</code> to bootstrap
          the Lighthouse event row, or seed the DB manually.
        </p>
      </main>
    );
  }

  return (
    <UploadClient
      event={{
        id: event.id,
        name: event.name,
        date: event.date.toISOString(),
        city: event.city,
      }}
    />
  );
}
