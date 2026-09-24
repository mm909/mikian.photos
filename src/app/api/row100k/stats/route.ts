import { NextResponse } from "next/server";
import { nowMs } from "@/lib/row100k";
import { resolveViewer } from "@/lib/row100kViewer";
import { parsePeriod } from "@/lib/rowPeriod";
import { buildStatsPayload } from "@/app/row100k/stats/statsData";

/* THE STATS PAGE FOR ONE PERIOD, as JSON (owner, 2026-09-25: the month
 * word, the stat word, the day and the week must swap in place, with no
 * loading page and no scroll reset). GET ?m=YYYY-MM | all — the same ?m=
 * the page reads — answers everything the page prints for that period,
 * masked for the requesting viewer exactly as the page would mask it: the
 * same resolveViewer, the same buildStatsPayload the server render uses,
 * so a month fetched in place can never show a row the page itself would
 * have hidden. Never cached: who is looking decides what is in it. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const period = parsePeriod(url.searchParams.get("m") ?? undefined, nowMs());
    const viewer = await resolveViewer();
    const data = await buildStatsPayload(viewer, period);
    return NextResponse.json({ ok: true, data }, { headers: NO_STORE });
  } catch (err) {
    console.error("row100k/stats api: failed to build the period", err);
    return NextResponse.json(
      { ok: false, error: "The stats could not be read just now — reload in a moment." },
      { status: 500, headers: NO_STORE },
    );
  }
}
