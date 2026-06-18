import { redirect } from "next/navigation";
import { getEffectiveActor, isOwner } from "@/lib/permissions";
import { EventsAdminClient } from "@/components/admin/EventsAdminClient";

/**
 * Events admin — OWNER only (event creation/config is owner-gated for now).
 * Create events, edit per-event config (access mode, pricing, OCR/face toggles),
 * manage the per-event photographer access list, and copy secure links.
 */
export const dynamic = "force-dynamic";

export default async function EventsAdminPage() {
  const actor = await getEffectiveActor();
  if (!actor || !isOwner(actor)) redirect("/");
  return <EventsAdminClient />;
}
