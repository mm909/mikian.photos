import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import { ergApiDenial, ergViewer } from "@/app/erg/gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* THE ROSTER for the monitors page (owner, 2026-09-23: "let me assign a
 * rower to an erg"): every rower in the challenge by number and name,
 * and nothing else — no metres, no board. Behind the erg door like the
 * sessions. */
export async function GET() {
  const v = await ergViewer();
  const denied = ergApiDenial(v);
  if (denied) return NextResponse.json({ ok: false, error: denied.error }, { status: denied.status });
  try {
    const rows = await db.rowParticipant.findMany({
      where: { challenge: CHALLENGE },
      select: { rowerNumber: true, displayName: true },
      orderBy: { rowerNumber: "asc" },
    });
    return NextResponse.json(
      { ok: true, rowers: rows.map((r) => ({ rowerNumber: r.rowerNumber, name: r.displayName })) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("erg rowers: read failed", err);
    return NextResponse.json({ ok: false, error: "Couldn't read the roster." }, { status: 503 });
  }
}
