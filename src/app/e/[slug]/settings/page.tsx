import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getEffectiveActor, canManageEvent } from "@/lib/permissions";
import { EventSettingsClient } from "@/components/admin/EventSettingsClient";

/**
 * Per-event settings page. Gated by canManageEvent (platform owner OR the
 * event's own owner). v2.1: replaces the global /admin/users settings for
 * everything event-scoped (pricing, access, detection, photographers).
 */
export const dynamic = "force-dynamic";

export default async function EventSettingsPage({ params }: { params: { slug: string } }) {
  const ev = await db.event.findUnique({
    where: { id: params.slug },
    select: { id: true, ownerId: true },
  });
  if (!ev) notFound();
  const actor = await getEffectiveActor();
  if (!canManageEvent(actor, ev)) redirect(`/e/${params.slug}`);
  return <EventSettingsClient slug={params.slug} />;
}
