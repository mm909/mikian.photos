import { db } from "@/lib/db";
import { UploadClient } from "@/components/photographer/UploadClient";
import { getEffectivePhotographerId } from "@/lib/photographerLock";

export default async function UploadPage() {
  const photographerId = await getEffectivePhotographerId();
  if (!photographerId) {
    return (
      <main
        className="screen"
        style={{ padding: "96px 24px", textAlign: "center", maxWidth: 540, margin: "0 auto" }}
      >
        <h1
          style={{
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: 28,
            color: "var(--ink)",
          }}
        >
          Photographer access required
        </h1>
        <p style={{ marginTop: 16, color: "var(--muted)", lineHeight: 1.55 }}>
          Sign in with Google at <a href="/photographer/sign-in">/photographer/sign-in</a>, or, if
          you&rsquo;re Mikian, hit <code>/api/photographer/unlock?key=…</code> with your unlock
          key.
        </p>
      </main>
    );
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
