import { redirect } from "next/navigation";
import { getEffectiveActor, hasRole } from "@/lib/permissions";
import { OrdersClient } from "@/components/admin/OrdersClient";
import { currentEvent } from "@/lib/data";

/**
 * Orders admin — owner + race_director. Lists every order for the current run
 * with sum stats + search; clicking a row opens that order's page. Owners also
 * get refund / resend-receipt actions (race directors see the list read-only).
 */
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const actor = await getEffectiveActor();
  // Owner implies race_director, so hasRole admits both; everyone else bounces.
  if (!actor || !hasRole(actor, "race_director")) {
    redirect("/");
  }
  const isOwner = hasRole(actor, "owner");
  const eventName = Array.isArray(currentEvent.name)
    ? currentEvent.name.join(" ")
    : String(currentEvent.name);
  return <OrdersClient isOwner={isOwner} eventName={eventName} />;
}
