import { NextResponse } from "next/server";
import { HandoffError, listHandoffs, parseHandoffBody, recordHandoffs } from "@/lib/tracker/handoffs";
import { bad, readJson, requireCrew } from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// recordHandoffs awaits the snapshot rebuild.
export const maxDuration = 30;

/**
 * /api/track/[slug]/handoffs?k=<crew key> — the crew page's taps (spec §8
 * rules 5–6, §11).
 *
 *   GET   → { handoffs: HandoffDto[] } newest first, last 50, voided
 *           included and flagged (the page greys them).
 *   POST  body = HandoffRequest | { handoffs: HandoffRequest[] } → the DTOs
 *           for what was sent, in order. Idempotent on client_event_id, so
 *           the offline queue may retry freely; the tap time is corrected
 *           when the client clock is more than 5 s off the server's.
 */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const crew = await requireCrew(req, params.slug);
  if ("res" in crew) return crew.res;
  const limitRaw = Number(new URL(req.url).searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 50;
  const handoffs = await listHandoffs(params.slug, limit);
  return NextResponse.json({ handoffs }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const body = await readJson(req);
  if (body === null) return bad("Send JSON.");
  const crew = await requireCrew(req, params.slug, body);
  if ("res" in crew) return crew.res;
  if (crew.event.status === "archived") return bad("This event is archived.", 409);
  try {
    const reqs = parseHandoffBody(body);
    const handoffs = await recordHandoffs(params.slug, reqs, { serverNow: new Date() });
    return NextResponse.json({ ok: true, handoffs });
  } catch (err) {
    if (err instanceof HandoffError) return bad(err.message, err.status);
    console.error(`track handoffs ${params.slug}: record failed`, err);
    return bad("Couldn't record that tap — it will be retried.", 503);
  }
}
