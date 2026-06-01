/**
 * GET /api/admin/roster?eventId=lighthouse-half-2026
 *
 * Owner + race director. Joins the static event roster (LIGHTHOUSE_RACERS for the
 * Lighthouse Half) with per-bib photo + face counts so the roster screen
 * can show "we have N photos for runner X".
 *
 * Roster source is currently a hand-curated TS file. When more events come
 * in, we'd swap this for a per-event roster lookup; the response shape
 * stays the same.
 *
 * Response:
 *   {
 *     event: { id, name },
 *     runners: [{
 *       bib, name, gender, age, city, state, chipTime, chipMinutes,
 *       photoCount, face: { photoId, faceId } | null
 *     }],
 *     officialResultsUrl: string | null   // null when unknown for this event
 *   }
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { LIGHTHOUSE_RACERS } from "@/lib/lighthouseRoster";
import { computeFaceAssignments, getConfirmedClusters } from "@/lib/faceAssignment";

export const runtime = "nodejs";

// Per-event official results URLs. Edit when new events land — keeping this
// here (vs. on the Event row) lets us point at an external URL without
// needing a schema change. null means "unknown" → UI renders no link.
const OFFICIAL_RESULTS_URLS: Record<string, string> = {
  // Race Roster's per-race result page. `filter_search=` left empty so it
  // lands on the full leaderboard; the user can type a bib/name there. This
  // points at the half marathon; the roster itself now spans all three races
  // (10K = race 283501, 5K = race 283502 under the same event).
  "lighthouse-half-2026":
    "https://results.raceroster.com/v3/events/tmf7z96gjcpjtuet/race/283500?filter_search=",
};

export async function GET(req: Request) {
  // Owner + race director (owner implies race_director, so requireRole
  // admits both). Read-only roster view — no curation actions live here.
  const actor = await requireRole("race_director");
  if (!actor) {
    return NextResponse.json(
      { error: "Race director or owner role required" },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Unknown eventId" }, { status: 404 });
  }

  // Per-bib distinct-photo count for THIS event. groupBy on PhotoBib joined
  // back to Photo via the eventId filter.
  const bibPhotoRows = await db.photoBib.findMany({
    where: { photo: { eventId, hidden: false } },
    select: { bib: true, photoId: true },
  });
  const photosByBib = new Map<number, Set<string>>();
  for (const r of bibPhotoRows) {
    const set = photosByBib.get(r.bib) ?? new Set<string>();
    set.add(r.photoId);
    photosByBib.set(r.bib, set);
  }

  // Human-confirmed faces (bib → clusterId) override the heuristic. For a
  // confirmed runner the photo count is the UNION of their bib-tagged photos
  // and every photo carrying their confirmed face cluster — so the roster
  // count matches what the runner profile + find-photos flow actually show.
  const confirmedByBib = await getConfirmedClusters(eventId);
  const confirmedClusterIds = [...new Set(confirmedByBib.values())];
  const photosByCluster = new Map<string, Set<string>>();
  if (confirmedClusterIds.length > 0) {
    const faceRows = await db.photoFace.findMany({
      where: {
        eventId,
        faceClusterId: { in: confirmedClusterIds },
        photo: { hidden: false },
      },
      select: { faceClusterId: true, photoId: true },
    });
    for (const r of faceRows) {
      if (!r.faceClusterId) continue;
      const set = photosByCluster.get(r.faceClusterId) ?? new Set<string>();
      set.add(r.photoId);
      photosByCluster.set(r.faceClusterId, set);
    }
  }

  /** Distinct photos for a bib: bib-tagged ∪ confirmed-face-cluster photos. */
  function photoCountForBib(bib: number): number {
    const bibSet = photosByBib.get(bib);
    const clusterId = confirmedByBib.get(bib);
    const faceSet = clusterId ? photosByCluster.get(clusterId) : undefined;
    if (!faceSet || faceSet.size === 0) return bibSet?.size ?? 0;
    const union = new Set<string>(bibSet ?? []);
    for (const id of faceSet) union.add(id);
    return union.size;
  }

  // The single face we've identified for each runner, via the face-above-bib
  // geometry + one-face-per-runner assignment. Drives the row thumbnail and
  // the "face identified" marker.
  const faceByBib = await computeFaceAssignments(eventId);

  // Pick the roster for this event. Only Lighthouse is wired today.
  const roster =
    eventId === "lighthouse-half-2026" ? LIGHTHOUSE_RACERS : [];

  const runners = roster.map((r) => {
    const face = faceByBib.get(r.bib);
    return {
      bib: r.bib,
      name: r.name,
      gender: r.gender,
      age: r.age,
      city: r.city,
      state: r.state,
      chipTime: r.chipTime,
      chipMinutes: r.chipMinutes,
      distance: r.distance,
      photoCount: photoCountForBib(r.bib),
      // The runner's identified face, or null if we haven't matched one. The
      // sample points the row thumbnail at /api/photos/[photoId]/face/[faceId].
      face: face
        ? { photoId: face.sample.photoId, faceId: face.sample.faceId }
        : null,
    };
  });

  return NextResponse.json({
    event,
    runners,
    officialResultsUrl: OFFICIAL_RESULTS_URLS[eventId] ?? null,
  });
}
