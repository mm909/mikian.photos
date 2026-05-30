import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEffectiveActor, hasRole, isOwner } from "@/lib/permissions";

/**
 * Per-event rollup for the photographer dashboard.
 *
 *   GET /api/photographer/events
 *
 * Returns one row per event the signed-in user has uploaded to:
 *
 *   [{ eventId, eventName, eventDate, photoCount, lastUploadAt }]
 *
 * Owner sees every event in the system (so the dashboard can act as a
 * cross-photographer overview without duplicating the Library admin view).
 * Non-owner is scoped to their own uploads.
 *
 * One pass through Prisma's groupBy keeps this cheap even when there are
 * thousands of photos: count + max-createdAt per (eventId).
 */
export const runtime = "nodejs";

export async function GET() {
  const actor = await getEffectiveActor();
  if (!actor || !hasRole(actor, "photographer")) {
    return NextResponse.json({ error: "Photographer access required" }, { status: 401 });
  }

  const admin = isOwner(actor);

  const where = admin ? {} : { photographerId: actor.photographerId };

  const grouped = await db.photo.groupBy({
    by: ["eventId"],
    where,
    _count: { id: true },
    _max: { createdAt: true },
  });

  // Hydrate event names/dates in one query.
  const eventIds = grouped.map((g) => g.eventId);
  const events =
    eventIds.length > 0
      ? await db.event.findMany({
          where: { id: { in: eventIds } },
          select: { id: true, name: true, date: true, city: true },
        })
      : [];
  const eventById = new Map(events.map((e) => [e.id, e]));

  // Revenue per event from captured orders. Owner-only — a non-owner
  // photographer's split isn't modeled yet, so we leave Earned blank for them
  // rather than crediting them with the whole event's take.
  const earnedByEvent = new Map<string, number>();
  if (admin && eventIds.length > 0) {
    const orderAgg = await db.order.groupBy({
      by: ["eventIdCovered"],
      where: { eventIdCovered: { in: eventIds } },
      _sum: { amount: true },
    });
    for (const o of orderAgg) {
      if (o.eventIdCovered) earnedByEvent.set(o.eventIdCovered, o._sum.amount ?? 0);
    }
  }

  const rows = grouped
    .map((g) => {
      const ev = eventById.get(g.eventId);
      return {
        eventId: g.eventId,
        eventName: ev?.name ?? g.eventId,
        eventDate: ev?.date?.toISOString() ?? null,
        eventCity: ev?.city ?? null,
        photoCount: g._count.id,
        lastUploadAt: g._max.createdAt?.toISOString() ?? null,
        earnedUsd: admin ? earnedByEvent.get(g.eventId) ?? 0 : undefined,
      };
    })
    // Most recently active event first — that's almost always what the
    // photographer wants to click into.
    .sort((a, b) => {
      const at = a.lastUploadAt ?? "";
      const bt = b.lastUploadAt ?? "";
      return bt.localeCompare(at);
    });

  return NextResponse.json({
    isAdmin: admin,
    events: rows,
    totalPhotos: rows.reduce((s, r) => s + r.photoCount, 0),
  });
}
