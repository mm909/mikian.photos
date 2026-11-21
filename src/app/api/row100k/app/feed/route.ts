import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveViewer } from "@/lib/row100kViewer";
import { buildFeed } from "@/app/row100k/feed/feedData";

/* THE FEED for the phone app (2026-11-20; owner the same day: "a
 * chronological list of all rows so far. No month cutoff. It should include
 * the photos as well as the other info like name, meters, time, stats (if
 * hooked up to the erg)"). The rows are the /feed page's own (feedData.ts),
 * masked for whoever is asking by the same function; ?before= is the same
 * cursor. Beside each row that came off a connected erg ride the monitor's
 * averages, read off the piece saved against it; never for a hidden row. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

type Erg = { id: string; watts: number | null; spm: number | null; hr: number | null; drag: number | null };

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const before = q.get("before") ?? "";
    const viewer = await resolveViewer();
    /* ?following=1: only the rowers the viewer follows (and their own). */
    const feed = await buildFeed(viewer, before, { following: q.get("following") === "1" });
    const open = feed.items.filter((it) => !it.masked).map((it) => it.id);
    const erg: Record<string, Erg> = {};
    if (open.length) {
      try {
        const rows = await db.rowTelemetry.findMany({
          where: { entryId: { in: open } },
          select: { id: true, entryId: true, avgWatts: true, avgSpm: true, avgHr: true, dragFactor: true },
        });
        for (const r of rows) if (r.entryId) erg[r.entryId] = { id: r.id, watts: r.avgWatts, spm: r.avgSpm, hr: r.avgHr, drag: r.dragFactor };
      } catch (err) {
        console.error("row app: failed to read the erg figures for the feed", err);
      }
    }
    const mine = viewer.me?.rowerNumber ?? null;
    return NextResponse.json(
      { ok: true, items: feed.items.map((it) => ({ ...it, erg: erg[it.id] ?? null, mine: it.rowerNumber === mine })), days: feed.days, older: feed.olderCursor },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error("row app: failed to build the feed", err);
    return NextResponse.json({ ok: false, error: "The feed could not be read just now." }, { status: 500, headers: NO_STORE });
  }
}
