import { redirect } from "next/navigation";
import { isOwnerActor } from "@/lib/permissions";
import { RelayPlanClient } from "@/components/relay/RelayPlanClient";

/**
 * /tsp/plan — the owner's route-planning board for the DTK France relay.
 * RideWithGPS-style: a big dark map you click to lay waypoints ahead of the
 * team, with live planned mileage/elevation and one-button rerouting through
 * the waypoint chain. Owner-only (server-gated), like /tsp/manage.
 */
export const dynamic = "force-dynamic";

const TSP_EVENT_ID = "tsp-france-2026";

export default async function TspPlanPage() {
  if (!(await isOwnerActor())) redirect("/tsp");
  return <RelayPlanClient eventId={TSP_EVENT_ID} />;
}
