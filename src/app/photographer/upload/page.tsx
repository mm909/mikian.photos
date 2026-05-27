import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UploadClient } from "@/components/photographer/UploadClient";

export default async function UploadPage() {
  const session = await getServerSession(authOptions);
  if (!session?.photographerId) {
    redirect("/photographer/sign-in");
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
          No event configured yet. Ping the admin to create one.
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
