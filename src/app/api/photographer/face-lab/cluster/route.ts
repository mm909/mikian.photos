import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEffectiveActor, hasRole } from "@/lib/permissions";

/**
 * Face Lab cluster inspector.
 *
 *   GET /api/photographer/face-lab/cluster?eventId=X&cluster=Y
 *
 * Returns every PhotoFace row in the given event sharing the given
 * faceClusterId, so the lab can render thumbnails of all photos that
 * Rekognition believes contain the same runner.
 *
 *   { members: [{ photoId, faceId, confidence }] }
 *
 * Photographer-or-owner gate. Doesn't write anything; safe to call
 * freely from the lab UI when navigating between faces.
 */
export const runtime = "nodejs";

export async function GET(req: Request) {
  const actor = await getEffectiveActor();
  if (!actor || !hasRole(actor, "photographer")) {
    return NextResponse.json({ error: "Photographer access required" }, { status: 401 });
  }

  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId");
  const cluster = url.searchParams.get("cluster");
  if (!eventId || !cluster) {
    return NextResponse.json(
      { error: "eventId and cluster required" },
      { status: 400 }
    );
  }

  const rows = await db.photoFace.findMany({
    where: {
      eventId,
      faceClusterId: cluster,
      // Don't surface hidden photos in the cluster view — even though the
      // lab is for admins, mirroring the runner-facing behaviour keeps
      // the data model consistent.
      photo: { hidden: false },
    },
    select: {
      photoId: true,
      id: true,
      confidence: true,
    },
    orderBy: { confidence: "desc" },
    take: 200,
  });

  return NextResponse.json({
    members: rows.map((r) => ({
      photoId: r.photoId,
      faceId: r.id,
      confidence: r.confidence,
    })),
  });
}
