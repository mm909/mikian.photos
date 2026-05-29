/**
 * GET /api/admin/roster/[bib]?eventId=...
 *
 * Owner-only. Returns one runner's full profile context: their roster
 * entry + photo + face counts + the SINGLE face cluster we think is
 * theirs (with a sample face for thumbnail rendering).
 *
 * "One face per runner" rule: a runner has at most one assigned face
 * cluster. We compute it as the face cluster that appears most often
 * across photos tagged with this bib. Ties broken by total face
 * confidence within the cluster (so a low-confidence single appearance
 * doesn't beat a high-confidence single appearance).
 *
 * If face detection hasn't produced any clusters for this runner's
 * photos, `assignedFace` is null and the UI shows "no face assigned yet".
 *
 * Future: an explicit confirm/override flow ("this isn't me, that is")
 * will write the assignment to a new column on Photographer/Runner. For
 * now the heuristic above is the source of truth.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { LIGHTHOUSE_RACERS } from "@/lib/lighthouseRoster";

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

  // Photo + face data for this bib. One round-trip — we pull every
  // PhotoBib row for the bib in this event, then for each photo grab
  // its faces. Lighthouse Half ≈ ~10 photos per runner so this is
  // trivial; if we ever shoot 500 photos per runner we'd push the
  // groupBy into SQL.
  const bibRows = await db.photoBib.findMany({
    where: { bib: bibNumber, photo: { eventId, hidden: false } },
    select: {
      photoId: true,
      photo: {
        select: {
          faces: {
            select: {
              id: true,
              faceClusterId: true,
              confidence: true,
            },
          },
        },
      },
    },
  });

  const photoCount = bibRows.length;

  // Aggregate: per cluster, how many photos it appears in + total
  // confidence (tiebreaker) + a sample (highest-conf) face.
  type Agg = {
    photoIds: Set<string>;
    confSum: number;
    sampleFaceId: string;
    samplePhotoId: string;
    sampleConfidence: number;
  };
  const clusters = new Map<string, Agg>();
  for (const r of bibRows) {
    const photoId = r.photoId;
    // A photo can have several faces. We count the cluster once per
    // photo (using a per-photo Set) so a multi-runner shot doesn't
    // inflate a single cluster's count from one photo.
    const seenInThisPhoto = new Set<string>();
    for (const f of r.photo.faces) {
      if (!f.faceClusterId) continue;
      const cid = f.faceClusterId;
      const existing = clusters.get(cid);
      const slot: Agg = existing ?? {
        photoIds: new Set<string>(),
        confSum: 0,
        sampleFaceId: f.id,
        samplePhotoId: photoId,
        sampleConfidence: f.confidence,
      };
      if (!seenInThisPhoto.has(cid)) {
        slot.photoIds.add(photoId);
        seenInThisPhoto.add(cid);
      }
      slot.confSum += f.confidence;
      if (existing && f.confidence > slot.sampleConfidence) {
        slot.sampleFaceId = f.id;
        slot.samplePhotoId = photoId;
        slot.sampleConfidence = f.confidence;
      }
      clusters.set(cid, slot);
    }
  }

  // Pick the assigned cluster: most photos, then highest confSum.
  let assignedClusterId: string | null = null;
  let assignedSample: { photoId: string; faceId: string } | null = null;
  let assignedPhotoShare = 0;
  let bestPhotoCount = 0;
  let bestConfSum = 0;
  for (const [cid, slot] of clusters) {
    const c = slot.photoIds.size;
    if (c > bestPhotoCount || (c === bestPhotoCount && slot.confSum > bestConfSum)) {
      assignedClusterId = cid;
      assignedSample = { photoId: slot.samplePhotoId, faceId: slot.sampleFaceId };
      assignedPhotoShare = photoCount > 0 ? c / photoCount : 0;
      bestPhotoCount = c;
      bestConfSum = slot.confSum;
    }
  }

  return NextResponse.json({
    event,
    runner: runner ?? null,
    photoCount,
    /** Number of distinct face clusters seen across this runner's photos.
     *  >1 means the assignment heuristic had to pick one; the others
     *  could be other runners visible in the same frames. */
    clusterCount: clusters.size,
    assignedFace: assignedClusterId
      ? {
          faceClusterId: assignedClusterId,
          sample: assignedSample!,
          /** Fraction of this runner's photos that contain this cluster.
           *  Closer to 1.0 = high confidence in the assignment. */
          photoShare: assignedPhotoShare,
          photoCount: bestPhotoCount,
        }
      : null,
  });
}
