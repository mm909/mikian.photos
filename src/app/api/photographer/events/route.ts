import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEffectiveActor, hasRole, isAdmin } from "@/lib/permissions";

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

  const admin = isAdmin(actor);

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

  // Orders per event (count for everyone; revenue $ owner-only — a non-owner
  // photographer's split isn't modeled yet, so we leave Earned blank for them
  // rather than crediting them with the whole event's take).
  const orderCountByEvent = new Map<string, number>();
  const earnedByEvent = new Map<string, number>();
  if (eventIds.length > 0) {
    const orderAgg = await db.order.groupBy({
      by: ["eventIdCovered"],
      where: { eventIdCovered: { in: eventIds } },
      _sum: { amount: true },
      _count: { _all: true },
    });
    for (const o of orderAgg) {
      if (o.eventIdCovered) {
        orderCountByEvent.set(o.eventIdCovered, o._count._all);
        earnedByEvent.set(o.eventIdCovered, o._sum.amount ?? 0);
      }
    }
  }

  // "Dead" photos per event — finalized but never face-indexed (detection never
  // completed, e.g. an upload tab closed mid-tagging). Drives the dashboard's
  // "Fix dead photos" affordance. Scoped the same way as the photo rollup.
  const deadByEvent = new Map<string, number>();
  if (eventIds.length > 0) {
    const deadAgg = await db.photo.groupBy({
      by: ["eventId"],
      where: {
        ...where,
        hidden: false,
        facesIndexedAt: null,
        NOT: { r2OriginalKey: "pending" },
      },
      _count: { id: true },
    });
    for (const d of deadAgg) deadByEvent.set(d.eventId, d._count.id);
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
        orderCount: orderCountByEvent.get(g.eventId) ?? 0,
        undetectedCount: deadByEvent.get(g.eventId) ?? 0,
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
