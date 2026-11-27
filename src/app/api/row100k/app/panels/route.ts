import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { nowMs, pacificDay } from "@/lib/row100k";
import { resolveViewer } from "@/lib/row100kViewer";

/* THE LIVE ERG VIEW'S PANELS, LOOKED AT (owner, 2026-11-26: "which panel
 * users are spending their time on"). POST { panels: { name: seconds } }
 * from the phone (mobile/src/panelTime.ts); added to one line per account,
 * day and panel (RowPanelTime). Signed-in only. Never fails the app. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const NAME = /^[a-z0-9-]{1,24}$/;

export async function POST(req: Request) {
  const viewer = await resolveViewer();
  if (!viewer.actor) return NextResponse.json({ ok: true, counted: false }, { headers: NO_STORE });
  try {
    const body = (await req.json().catch(() => null)) as { panels?: Record<string, unknown> } | null;
    const day = pacificDay(nowMs());
    const userId = viewer.actor.photographerId;
    const entries = Object.entries(body?.panels ?? {})
      .filter(([k, v]) => NAME.test(k) && typeof v === "number" && Number.isFinite(v) && v > 0)
      .slice(0, 20)
      .map(([panel, v]) => [panel, Math.min(6 * 3600, Math.round(v as number))] as const);
    for (const [panel, seconds] of entries) {
      await db.rowPanelTime.upsert({
        where: { userId_day_panel: { userId, day, panel } },
        create: { userId, day, panel, seconds },
        update: { seconds: { increment: seconds } },
      });
    }
  } catch (err) {
    console.error("row app: panel time not counted", err);
  }
  return NextResponse.json({ ok: true, counted: true }, { headers: NO_STORE });
}
