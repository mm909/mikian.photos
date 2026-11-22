import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import { resolveViewer } from "@/lib/row100kViewer";
import { buildBoardPage } from "@/app/row100k/board/boardPageData";

/* THE 100K BOARD for the phone app (2026-11-20): the same rows, tiers and
 * own row the /board page prints, masked for whoever is asking by the same
 * function (boardPageData.ts). Never cached. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  try {
    const viewer = await resolveViewer();
    const data = await buildBoardPage(viewer);
    /* THE LAST EIGHT DAYS, DAY BY DAY, for the look of the board the app
     * is trying (owner, 2026-11-22: "like an attendance sheet ... boxes ...
     * where inside of them is the meters that were rowed that day"): for
     * every listed rower whose meters the board prints, their meters on
     * each of the seven days before today and today. A rower the board
     * hides is left out, so a day's box gives nothing away. A failed read
     * is no week, and the board is the board without it. */
    let week: { days: string[]; meters: Record<number, number[]> } | null = null;
    try {
      const today = `${data.month.key}-${String(data.month.day).padStart(2, "0")}`;
      const base = Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)));
      if (Number.isFinite(base)) {
        const days = Array.from({ length: 8 }, (_, i) => new Date(base - (7 - i) * 86_400_000).toISOString().slice(0, 10));
        const open = data.rows.filter((r) => r.blocks === undefined).map((r) => r.rowerNumber);
        const who = open.length ? await db.rowParticipant.findMany({ where: { challenge: CHALLENGE, rowerNumber: { in: open } }, select: { id: true, rowerNumber: true } }) : [];
        const numOf = new Map(who.map((p) => [p.id, p.rowerNumber]));
        const sums = who.length ? await db.rowEntry.groupBy({ by: ["participantId", "day"], where: { challenge: CHALLENGE, participantId: { in: who.map((p) => p.id) }, day: { in: days } }, _sum: { meters: true } }) : [];
        const meters: Record<number, number[]> = {};
        for (const s of sums) {
          const n = numOf.get(s.participantId);
          const at = days.indexOf(s.day);
          if (n === undefined || at < 0) continue;
          (meters[n] ??= days.map(() => 0))[at] = s._sum.meters ?? 0;
        }
        week = { days, meters };
      }
    } catch (err) {
      console.error("row app: failed to read the board's week", err);
    }
    return NextResponse.json({ ok: true, signedIn: viewer.actor !== null, ...data, week }, { headers: NO_STORE });
  } catch (err) {
    console.error("row app: failed to build the board", err);
    return NextResponse.json({ ok: false, error: "The board could not be read just now." }, { status: 500, headers: NO_STORE });
  }
}
