import { NextResponse } from "next/server";
import { HandoffError, voidHandoff } from "@/lib/tracker/handoffs";
import { bad, readJson, requireCrew } from "../../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/track/[slug]/handoffs/void?k=<crew key> — undo a tap. Body
 * { client_event_id } or { id }. Sets voided=true (never deletes: the crew
 * page shows the undone tap greyed) and answers the updated HandoffDto.
 */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const body = await readJson(req);
  if (body === null) return bad("Send JSON.");
  const crew = await requireCrew(req, params.slug, body);
  if ("res" in crew) return crew.res;
  const b = (typeof body === "object" && body !== null ? body : {}) as { client_event_id?: unknown; id?: unknown };
  try {
    const handoff = await voidHandoff(params.slug, {
      client_event_id: typeof b.client_event_id === "string" ? b.client_event_id : undefined,
      id: typeof b.id === "string" ? b.id : undefined,
    });
    return NextResponse.json({ ok: true, handoff });
  } catch (err) {
    if (err instanceof HandoffError) return bad(err.message, err.status);
    console.error(`track handoffs ${params.slug}: void failed`, err);
    return bad("Couldn't undo that tap — try again.", 503);
  }
}
