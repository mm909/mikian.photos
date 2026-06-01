import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { r2Configured } from "@/lib/r2";
import { getEffectiveActor, hasRole, isAdmin } from "@/lib/permissions";
import { deadPhotoWhere, backfillDeadPhotos } from "@/lib/detection";

/**
 * "Fix dead photos" backfill for one event.
 *
 *   GET  → { remaining }            how many photos still need detection
 *   POST → { processed, remaining } detect one batch (caller loops to finish)
 *
 * A "dead photo" is a finalized upload that never got bib OCR / face detection
 * (e.g. the upload tab closed mid-tagging). The dashboard button calls POST in
 * a loop until `remaining` hits 0. Owner can fix any event; a non-owner
 * photographer is scoped to their own uploads.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

/** Photos detected per POST — bounded so one invocation stays under maxDuration
 *  (≈4 concurrent × a few rounds of Rekognition). The button loops POSTs. */
const BATCH = 16;

async function scopedWhere(eventId: string): Promise<Prisma.PhotoWhereInput | null> {
  const actor = await getEffectiveActor();
  if (!actor || !hasRole(actor, "photographer")) return null;
  return {
    ...deadPhotoWhere(eventId),
    ...(isAdmin(actor) ? {} : { photographerId: actor.photographerId }),
  };
}

export async function GET(_req: Request, { params }: { params: { eventId: string } }) {
  const where = await scopedWhere(params.eventId);
  if (!where) {
    return NextResponse.json({ error: "Photographer access required" }, { status: 401 });
  }
  const remaining = await db.photo.count({ where });
  return NextResponse.json({ remaining });
}

export async function POST(_req: Request, { params }: { params: { eventId: string } }) {
  const where = await scopedWhere(params.eventId);
  if (!where) {
    return NextResponse.json({ error: "Photographer access required" }, { status: 401 });
  }
  if (!r2Configured()) {
    return NextResponse.json({ error: "Photo storage not configured" }, { status: 503 });
  }
  const { processed, remaining } = await backfillDeadPhotos({ where, limit: BATCH });
  return NextResponse.json({ processed, remaining });
}
