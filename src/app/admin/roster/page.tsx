import { redirect } from "next/navigation";
import { getEffectiveActor, hasRole } from "@/lib/permissions";
import { RosterClient } from "@/components/admin/RosterClient";
import { currentEvent } from "@/lib/data";

/**
 * Roster screen — owner + race director. Lists every official entrant for the
 * event alongside how many photos + faces we have of them, plus a link out to
 * the third-party results page so you can spot-check times.
 *
 * Race directors get the read-only list. Only owners can drill into a runner's
 * profile (the per-runner curation tools: confirm face, untag, hide, delete),
 * so the per-runner links are owner-gated via `isOwner` below.
 */
export default async function RosterPage() {
  const actor = await getEffectiveActor();
  // Owner + race director (owner implies race_director via hasRole).
  if (!actor || !hasRole(actor, "race_director")) {
    redirect("/");
  }
  const isOwner = hasRole(actor, "owner");
  const eventName = Array.isArray(currentEvent.name)
    ? currentEvent.name.join(" ")
    : (currentEvent.name as unknown as string);
  return (
    <RosterClient
      defaultEventId={currentEvent.id}
      defaultEventName={eventName}
      isOwner={isOwner}
    />
  );
}
