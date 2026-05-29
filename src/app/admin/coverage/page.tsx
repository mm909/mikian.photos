import { redirect } from "next/navigation";
import { getEffectiveActor } from "@/lib/permissions";
import { CoverageClient } from "@/components/admin/CoverageClient";
import { currentEvent } from "@/lib/data";

/**
 * Owner-only coverage / insights screen.
 *
 * Server gate first — non-owners bounce to "/" rather than seeing a 403
 * page (this is an internal tool, not something we want to advertise).
 *
 * We pass the default eventId to the client so the first render skips a
 * "pick an event" step. Multi-event picker can come later.
 */
export default async function CoveragePage() {
  const actor = await getEffectiveActor();
  if (!actor || !actor.roles.includes("owner")) {
    redirect("/");
  }
  // currentEvent.name is stored as a word array for the runner-screen
  // headline layout — join for the coverage header.
  const eventName = Array.isArray(currentEvent.name)
    ? currentEvent.name.join(" ")
    : (currentEvent.name as unknown as string);
  return <CoverageClient defaultEventId={currentEvent.id} defaultEventName={eventName} />;
}
