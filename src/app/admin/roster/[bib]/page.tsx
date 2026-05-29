import { redirect, notFound } from "next/navigation";
import { getEffectiveActor } from "@/lib/permissions";
import { currentEvent } from "@/lib/data";
import { LIGHTHOUSE_RACERS } from "@/lib/lighthouseRoster";
import { RunnerProfileClient } from "@/components/admin/RunnerProfileClient";

/**
 * Per-runner profile — every photo we have of one bib.
 *
 * Server-side: gate on owner role, look up the runner in the event's
 * roster, hand off to the client which paginates photos via the existing
 * /api/admin/coverage/photos endpoint (?bib=N). Reuses PhotoDetailModal
 * so arrow-key nav + face/OCR view + all library actions work the same
 * way they do on the coverage screen.
 *
 * 404 when the bib isn't in our roster — we still might have photos
 * tagged with that bib (phantom OCR detections), but a profile page only
 * makes sense for a known entrant. Use /admin/coverage if you want to
 * see orphan bib taggings.
 */
export default async function RunnerProfilePage({
  params,
}: {
  params: { bib: string };
}) {
  const actor = await getEffectiveActor();
  if (!actor || !actor.roles.includes("owner")) {
    redirect("/");
  }

  const bibNumber = Number(params.bib);
  if (!Number.isFinite(bibNumber)) notFound();

  // Roster lookup is currently only Lighthouse; other events would join
  // their own roster table here.
  const runner = LIGHTHOUSE_RACERS.find((r) => r.bib === bibNumber);
  if (!runner) notFound();

  const eventName = Array.isArray(currentEvent.name)
    ? currentEvent.name.join(" ")
    : (currentEvent.name as unknown as string);

  return (
    <RunnerProfileClient
      eventId={currentEvent.id}
      eventName={eventName}
      runner={runner}
    />
  );
}
