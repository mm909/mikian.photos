import { redirect } from "next/navigation";
import { hasRole, requireEventManager } from "@/lib/permissions";
import { OrdersClient } from "@/components/admin/OrdersClient";
import { getDefaultEvent, getEvent } from "@/lib/events";

/**
 * Orders admin — scoped to one event (?eventId=, else the default). Gated by
 * canManageEvent: the platform owner OR the event's own owner. Owners get
 * refund / resend per row; the action routes are owner-gated regardless.
 */
export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { eventId?: string };
}) {
  const eventId = searchParams.eventId || (await getDefaultEvent())?.id;
  if (!eventId) redirect("/");

  const actor = await requireEventManager(eventId);
  if (!actor) redirect("/");

  const ev = await getEvent(eventId);
  const isOwner = hasRole(actor, "owner");
  return <OrdersClient isOwner={isOwner} eventId={eventId} eventName={ev?.name ?? "Orders"} />;
}
