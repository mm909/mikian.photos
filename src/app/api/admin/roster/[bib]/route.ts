/**
 * GET /api/admin/roster/[bib]?eventId=...
 *
 * Owner-only. Returns one runner's full profile context: their roster
 * entry + photo + face counts + the SINGLE face cluster we think is
 * theirs (with a sample face for thumbnail rendering).
 *
 * "One face per runner" rule: a runner has at most one assigned face
 * cluster. The assignment is computed in computeFaceAssignments() from the
 * per-photo face-above-bib links (PhotoFace.bib), and guarantees that no two
 * runners share a face cluster. This route just looks up this bib's entry so
 * it always agrees with the roster list.
 *
 * If no face has been linked to this runner's bib, `assignedFace` is null and
 * the UI shows "no face assigned yet".
 *
 * Future: an explicit confirm/override flow ("this isn't me, that is")
 * will write the assignment to a new column on Photographer/Runner. For
 * now the geometry above is the source of truth.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { LIGHTHOUSE_RACERS } from "@/lib/lighthouseRoster";
import { computeFaceAssignments } from "@/lib/faceAssignment";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: { bib: string } }
) {
  const actor = await requireRole("owner");
  if (!actor) {
    return NextResponse.json({ error: "Owner role required" }, { status: 403 });
  }

  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }
  const bibNumber = Number(params.bib);
  if (!Number.isFinite(bibNumber)) {
    return NextResponse.json({ error: "bib must be a number" }, { status: 400 });
  }

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Unknown eventId" }, { status: 404 });
  }

  // Roster lookup — currently only Lighthouse is wired.
  const runner =
    eventId === "lighthouse-half-2026"
      ? LIGHTHOUSE_RACERS.find((r) => r.bib === bibNumber)
      : null;

  // Total distinct photos tagged with this bib (for the count + share).
  const bibRows = await db.photoBib.findMany({
    where: { bib: bibNumber, photo: { eventId, hidden: false } },
    select: { photoId: true },
  });
  const photoCount = new Set(bibRows.map((r) => r.photoId)).size;

  // The assigned face comes from the same event-wide assignment the roster
  // list uses, so the two never disagree. It applies the face-above-bib
  // geometry (PhotoFace.bib) plus the one-face-per-runner rule — a face
  // cluster claimed by another runner can't show up here.
  const assignments = await computeFaceAssignments(eventId);
  const assigned = assignments.get(bibNumber) ?? null;

  return NextResponse.json({
    event,
    runner: runner ?? null,
    photoCount,
    /** Distinct face clusters geometrically linked to this bib. >1 means the
     *  assignment had to pick one; the others could be mis-links worth a look. */
    clusterCount: assigned?.clusterCount ?? 0,
    assignedFace: assigned
      ? {
          faceClusterId: assigned.faceClusterId,
          sample: assigned.sample,
          /** Fraction of this runner's photos that contain this cluster.
           *  Closer to 1.0 = high confidence in the assignment. */
          photoShare: assigned.photoShare,
          photoCount: assigned.photoCount,
        }
      : null,
  });
}
