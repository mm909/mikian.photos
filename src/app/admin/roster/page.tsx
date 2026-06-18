import { redirect } from "next/navigation";
import { getEffectiveActor, hasRole, isAdmin } from "@/lib/permissions";
import { RosterClient } from "@/components/admin/RosterClient";
import { getDefaultEvent, getEvent } from "@/lib/events";

/**
 * Roster screen — owner + race director. Lists every official entrant for the
 * event alongside how many photos + faces we have of them, plus a link out to
 * the third-party results page so you can spot-check times.
 *
 * Race directors get the read-only list. Only owners can drill into a runner's
 * profile (the per-runner curation tools: confirm face, untag, hide, delete),
 * so the per-runner links are owner-gated via `isOwner` below.
 */
export default async function RosterPage({
  searchParams,
}: {
  searchParams: { eventId?: string };
}) {
  const actor = await getEffectiveActor();
  // Platform admin (owner) only. (Per-event roster is race-only; event-owner
  // scoping comes with the event settings work.)
  if (!actor || !isAdmin(actor)) {
    redirect("/");
  }
  const isOwner = hasRole(actor, "owner");
  // Honor ?eventId (the nav's Roster link carries it) so the page matches the
  // event the nav is scoped to; fall back to the default event otherwise.
  const requested =
    typeof searchParams.eventId === "string" && searchParams.eventId
      ? await getEvent(searchParams.eventId)
      : null;
  const ev = requested ?? (await getDefaultEvent());
  if (!ev) redirect("/");
  return (
    <RosterClient
      defaultEventId={ev.id}
      defaultEventName={ev.name}
      isOwner={isOwner}
    />
  );
}
