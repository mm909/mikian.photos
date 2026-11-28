import { NextResponse } from "next/server";
import { logbookFor } from "@/lib/concept2";
import { concept2Viewer } from "../gate";

/* THE ROWER'S CONCEPT2 LOGBOOK, READ BACK (owner, 2026-11-28: "I just need
 * to see like, oh, hey, look, these are logged here"). GET: the RowErg rows
 * Concept2 holds for the last 60 days, each with its Logbook page, and
 * which ROW sent (lib/concept2.ts logbookFor). `logbook: null` when no
 * Logbook is connected. In development: admin-only in production. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const v = await concept2Viewer();
  if ("error" in v) return NextResponse.json({ ok: false, error: v.error }, { status: v.status });
  try {
    return NextResponse.json({ ok: true, logbook: await logbookFor(v.userId) }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (err) {
    console.error("concept2: logbook unreadable", err);
    return NextResponse.json({ ok: false, error: "Concept2 did not answer just now." }, { status: 502 });
  }
}
