/**
 * POST /api/admin/roster-import/clear  { eventId }
 *
 * Delete every RosterEntry for an event. Event manager only (platform owner OR
 * the event's owner). Fail-open: a missing table returns a 503 push hint rather
 * than a 500.
 */
import { NextResponse } from "next/server";
import { requireEventManager } from "@/lib/permissions";
import { clearRoster } from "@/lib/rosterImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUSH_HINT =
  "The roster table isn't in the database yet. Run `npm run prisma:push` to create it.";

export async function POST(req: Request) {
  let body: { eventId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  const actor = await requireEventManager(eventId);
  if (!actor) {
    return NextResponse.json(
      { error: "You don't have permission to manage this event." },
      { status: 403 }
    );
  }

  const result = await clearRoster(eventId);
  if (result.tableMissing) {
    return NextResponse.json({ error: PUSH_HINT, needsPush: true }, { status: 503 });
  }
  return NextResponse.json({ ok: result.ok, deleted: result.deleted });
}
