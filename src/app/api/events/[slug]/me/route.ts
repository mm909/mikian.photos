import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEffectiveActor, canManageEvent } from "@/lib/permissions";
import { canUploadToEvent } from "@/lib/events";
import { ROSTER_EVENT_ID } from "@/lib/data";

/**
 * GET /api/events/[slug]/me — the current viewer's per-event capabilities.
 * Powers the contextual nav (which event-scoped links to show). Cheap; safe to
 * call on every event page.
 *
 *   → { type, canManage, canUpload }
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const ev = await db.event.findUnique({
    where: { id: params.slug },
    select: { id: true, name: true, type: true, ownerId: true },
  });
  if (!ev) return NextResponse.json({ error: "not found" }, { status: 404 });

  const actor = await getEffectiveActor();
  const canManage = canManageEvent(actor, ev);
  // An event owner can upload to their own event; otherwise it's membership-based.
  const canUpload = actor
    ? await canUploadToEvent({
        photographerId: actor.photographerId,
        isAdmin: canManage,
        eventId: ev.id,
      })
    : false;

  // Whether this event has roster data (Lighthouse only, for now) — drives the
  // nav's Roster link.
  const hasRoster = ev.id === ROSTER_EVENT_ID;

  return NextResponse.json({ name: ev.name, type: ev.type, canManage, canUpload, hasRoster });
}
