import { redirect } from "next/navigation";
import { requireRole } from "@/lib/permissions";
import { OrdersClient } from "@/components/admin/OrdersClient";

/**
 * All-events orders — every order across every event. Platform-owner only.
 * Its own route (not /admin/orders?all=1) so the contextual nav can tell, from
 * the pathname alone, that this is NOT a single-event surface and shouldn't
 * inherit a stale event context.
 */
export const dynamic = "force-dynamic";

export default async function AllOrdersPage() {
  const actor = await requireRole("owner");
  if (!actor) redirect("/");
  return <OrdersClient isOwner allEvents eventId={null} eventName="All events" />;
}
