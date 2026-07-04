import { redirect, notFound } from "next/navigation";
import { getEffectiveActor, isAdmin } from "@/lib/permissions";
import { getEvent } from "@/lib/events";
import { ROSTER_EVENT_ID } from "@/lib/data";
import { LIGHTHOUSE_RACERS } from "@/lib/lighthouseRoster";
import { RunnerProfileClient } from "@/components/admin/RunnerProfileClient";

/**
 * Per-runner profile — every photo we have of one bib.
 *
 * Server-side: gate on owner/race-director role, look up the runner in the event's
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
  if (!actor || !isAdmin(actor)) {
    redirect("/");
  }

  const bibNumber = Number(params.bib);
  if (!Number.isFinite(bibNumber)) notFound();

  // Roster lookup is currently only Lighthouse; other events would join
  // their own roster table here.
  const runner = LIGHTHOUSE_RACERS.find((r) => r.bib === bibNumber);
  if (!runner) notFound();

  // Bind to the event that actually OWNS this roster (Lighthouse), NOT
  // getDefaultEvent() — that returns the newest published event, so once a
  // newer event goes live this page would render the Lighthouse runner's
  // name/finish over a DIFFERENT event's bib-N photos, and (worse) the
  // "confirm face" action would write a FaceAssignment for the wrong event,
  // which /api/photos then auto-expands into public bib search. Scoping to
  // ROSTER_EVENT_ID keeps every read + write on the roster's own event.
  const ev = await getEvent(ROSTER_EVENT_ID);
  if (!ev) notFound();

  return (
    <RunnerProfileClient
      eventId={ev.id}
      eventName={ev.name}
      runner={runner}
    />
  );
}
