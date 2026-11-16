import { redirect } from "next/navigation";
import { TSP_BASE } from "@/lib/tsp/paths";

/**
 * /tsp — the TSP team sites (owner, 2026-11-16: "lets retire the france
 * tracker"). The DowntownKruz France tracker that lived here (the map, the
 * stats, the plan, the manage console, /api/relay) is retired; its Relay*
 * tables and every row in them stay in the database, untouched. The address
 * now hands on to the team sites' hub.
 */
export default function TspPage() {
  redirect(TSP_BASE);
}
