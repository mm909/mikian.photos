import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { nowMs, pacificDay } from "@/lib/row100k";
import { resolveViewer } from "@/lib/row100kViewer";

/* THE APP CAME TO THE FRONT (owner, 2026-11-26: "I need to know who's
 * using the app"). POST { platform, version } from the phone each time it
 * opens or comes back to the front; one line per account, day and
 * platform, counted up (RowAppSeen). Signed-in only; a signed-out open is
 * not counted. Never fails the app: an error is logged and answered ok. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function POST(req: Request) {
  const viewer = await resolveViewer();
  if (!viewer.actor) return NextResponse.json({ ok: true, counted: false }, { headers: NO_STORE });
  try {
    const body = (await req.json().catch(() => null)) as { platform?: unknown; version?: unknown } | null;
    const platform = body?.platform === "android" ? "android" : body?.platform === "web" ? "web" : "ios";
    const version = typeof body?.version === "string" ? body.version.slice(0, 40) : "";
    const day = pacificDay(nowMs());
    const userId = viewer.actor.photographerId;
    await db.rowAppSeen.upsert({
      where: { userId_day_platform: { userId, day, platform } },
      create: { userId, day, platform, version },
      update: { opens: { increment: 1 }, version },
    });
  } catch (err) {
    console.error("row app: an open was not counted", err);
  }
  return NextResponse.json({ ok: true, counted: true }, { headers: NO_STORE });
}
