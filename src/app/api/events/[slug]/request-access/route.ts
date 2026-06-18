import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";

/**
 * POST /api/events/[slug]/request-access — a signed-in user requests upload
 * access to an event (the shared upload link flow). Creates a PENDING
 * EventPhotographer row; the owner approves it (which flips status→approved and
 * grants the photographer role) before the requester can actually upload.
 *
 * Idempotent: re-requesting returns the current status without duplicating.
 */
export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { slug: string } }) {
  const actor = await getEffectiveActor();
  if (!actor) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const ev = await db.event.findUnique({ where: { id: params.slug }, select: { id: true } });
  if (!ev) return NextResponse.json({ error: "Unknown event" }, { status: 404 });

  const existing = await db.eventPhotographer.findUnique({
    where: { eventId_photographerId: { eventId: ev.id, photographerId: actor.photographerId } },
    select: { status: true },
  });
  if (existing) {
    // Already a member or already requested — report state, don't duplicate.
    return NextResponse.json({ ok: true, status: existing.status });
  }

  await db.eventPhotographer.create({
    data: {
      eventId: ev.id,
      photographerId: actor.photographerId,
      status: "pending",
      addedBy: actor.email,
    },
  });
  return NextResponse.json({ ok: true, status: "pending" });
}
