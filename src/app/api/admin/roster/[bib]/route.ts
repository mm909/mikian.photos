/**
 * /api/admin/roster/[bib]?eventId=...
 *
 * Owner + race director. One runner's profile context.
 *
 * GET  — roster entry + photo counts + the face cluster we believe is theirs.
 *        A HUMAN-CONFIRMED face (FaceAssignment table) wins over the geometry
 *        heuristic; when one is confirmed the photo count is the UNION of
 *        bib-tagged ∪ that cluster's photos, with a bib/face breakdown.
 * POST — confirm (or clear) this runner's face. Body: { eventId, faceClusterId }.
 *        faceClusterId=null clears the confirmation (falls back to heuristic).
 *        This is the ONLY place a face is confirmed; once set it becomes
 *        authoritative for the roster, the profile, and the public find-photos
 *        flow (which then skips the "Is this you?" prompt).
 *
 * "One face per runner": at most one confirmed cluster per (event, bib).
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { LIGHTHOUSE_RACERS } from "@/lib/lighthouseRoster";
import {
  computeFaceAssignments,
  getConfirmedCluster,
  sampleFaceForCluster,
} from "@/lib/faceAssignment";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: { bib: string } }
) {
  const actor = await requireRole("owner");
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

  // Distinct photos tagged with this bib.
  const bibRows = await db.photoBib.findMany({
    where: { bib: bibNumber, photo: { eventId, hidden: false } },
    select: { photoId: true },
  });
  const bibPhotoIds = new Set(bibRows.map((r) => r.photoId));

  // A human-confirmed face (if any) is authoritative. Otherwise fall back to
  // the geometry heuristic for the thumbnail only (it does NOT union photos —
  // the owner asked that union apply only to faces they confirmed by hand).
  const confirmedClusterId = await getConfirmedCluster(eventId, bibNumber);

  let assignedFace:
    | {
        faceClusterId: string;
        sample: { photoId: string; faceId: string };
        photoShare: number;
        photoCount: number;
      }
    | null = null;
  let facePhotoIds = new Set<string>();

  if (confirmedClusterId) {
    // Photos containing the confirmed cluster (event-wide).
    const faceRows = await db.photoFace.findMany({
      where: { eventId, faceClusterId: confirmedClusterId, photo: { hidden: false } },
      select: { photoId: true },
    });
    facePhotoIds = new Set(faceRows.map((r) => r.photoId));
    const sample = await sampleFaceForCluster(eventId, confirmedClusterId);
    // Count this cluster among the bib's photos for the share metric.
    const inBib = [...facePhotoIds].filter((id) => bibPhotoIds.has(id)).length;
    assignedFace = sample
      ? {
          faceClusterId: confirmedClusterId,
          sample,
          photoShare: bibPhotoIds.size > 0 ? inBib / bibPhotoIds.size : 0,
          photoCount: facePhotoIds.size,
        }
      : null;
  } else {
    // No confirmation — heuristic thumbnail only (no photo union).
    const assignments = await computeFaceAssignments(eventId);
    const guess = assignments.get(bibNumber) ?? null;
    assignedFace = guess
      ? {
          faceClusterId: guess.faceClusterId,
          sample: guess.sample,
          photoShare: guess.photoShare,
          photoCount: guess.photoCount,
        }
      : null;
  }

  // Union when confirmed: total = bib ∪ face; breakdown splits cleanly into
  // "has the bib" vs "face-only" (face cluster but no bib tag).
  const unionIds = new Set<string>(bibPhotoIds);
  for (const id of facePhotoIds) unionIds.add(id);
  const bibPhotoCount = bibPhotoIds.size;
  const faceOnlyCount = [...facePhotoIds].filter((id) => !bibPhotoIds.has(id)).length;
  const photoCount = unionIds.size;

  return NextResponse.json({
    event,
    runner: runner ?? null,
    photoCount,
    /** Breakdown the profile renders instead of "distinct faces":
     *  total = bibPhotoCount + faceOnlyCount. */
    bibPhotoCount,
    faceOnlyCount,
    /** The confirmed cluster id (null = none confirmed; profile then shows
     *  bib-only photos and the heuristic thumbnail). */
    confirmedFaceClusterId: confirmedClusterId,
    assignedFaceConfirmed: Boolean(confirmedClusterId && assignedFace),
    assignedFace,
  });
}

/**
 * POST — confirm or clear this runner's face.
 *   body: { eventId: string, faceClusterId: string | null }
 * Upserts the (event, bib) → cluster row; null clears it.
 */
export async function POST(
  req: Request,
  { params }: { params: { bib: string } }
) {
  const actor = await requireRole("owner");
  if (!actor) {
    return NextResponse.json(
      { error: "Race director or owner role required" },
      { status: 403 }
    );
  }

  const bibNumber = Number(params.bib);
  if (!Number.isFinite(bibNumber)) {
    return NextResponse.json({ error: "bib must be a number" }, { status: 400 });
  }

  let body: { eventId?: string; faceClusterId?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const eventId = body.eventId;
  if (!eventId) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }
  const faceClusterId = body.faceClusterId ?? null;

  try {
    if (faceClusterId === null) {
      // Clear — fall back to the heuristic guess. deleteMany so clearing a
      // never-set bib is a no-op rather than a 404.
      await db.faceAssignment.deleteMany({ where: { eventId, bib: bibNumber } });
      return NextResponse.json({ ok: true, confirmedFaceClusterId: null });
    }
    const assignedBy = actor.email ?? actor.photographerId;
    await db.faceAssignment.upsert({
      where: { eventId_bib: { eventId, bib: bibNumber } },
      update: { faceClusterId, assignedBy },
      create: {
        eventId,
        bib: bibNumber,
        faceClusterId,
        assignedBy,
      },
    });
    return NextResponse.json({ ok: true, confirmedFaceClusterId: faceClusterId });
  } catch (e) {
    // Most likely the table doesn't exist yet (needs `prisma db push`).
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error:
          "Could not save the face. If this persists, the FaceAssignment table may need a database migration (prisma db push). " +
          msg,
      },
      { status: 500 }
    );
  }
}
