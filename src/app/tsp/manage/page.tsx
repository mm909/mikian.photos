import { redirect } from "next/navigation";
import { isOwnerActor } from "@/lib/permissions";
import { RelayManageClient } from "@/components/relay/RelayManageClient";

/**
 * /tsp/manage — the road console for the TSP France tracker. Owner-only
 * (server-gated). Built phone-first: end a leg → export the GPX from
 * Strava/watch → upload here → pick the runner → done; the public /tsp page
 * updates immediately. Also manages runners and waypoints.
 */
export const dynamic = "force-dynamic";

const TSP_EVENT_ID = "tsp-france-2026";

export default async function TspManagePage() {
  if (!(await isOwnerActor())) redirect("/tsp");
  return <RelayManageClient eventId={TSP_EVENT_ID} />;
}
