import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";

/* EVERY METER ANYBODY HAS LOGGED, for the phone app's stats tab, where the
 * mark in the top bar rolls over into it (owner, 2026-11-21: "Row turns
 * into the total meter number on the stats page. And we should have it be
 * the all-time meter number"). One sum; a total is nobody's own number, so
 * lights out hides nothing of it (the feed's day totals follow the same
 * rule). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sum = await db.rowEntry.aggregate({ where: { challenge: CHALLENGE }, _sum: { meters: true } });
    return NextResponse.json({ ok: true, meters: sum._sum.meters ?? 0 }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (err) {
    console.error("row app: failed to sum every meter", err);
    return NextResponse.json({ ok: false, error: "The total could not be read just now." }, { status: 500 });
  }
}
