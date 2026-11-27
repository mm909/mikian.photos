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

/* EVERY PHONE (owner, 2026-11-26: "Let's make sure we know about all
 * phones"): a phone that has not signed in is counted by the id it keeps
 * for itself, as "device:<id>". */
const DEVICE = /^[a-z0-9]{8,40}$/;

export async function POST(req: Request) {
  const viewer = await resolveViewer();
  const body = (await req.json().catch(() => null)) as { platform?: unknown; version?: unknown; device?: unknown } | null;
  const device = typeof body?.device === "string" && DEVICE.test(body.device) ? body.device : null;
  if (!viewer.actor && !device) return NextResponse.json({ ok: true, counted: false }, { headers: NO_STORE });
  try {
    const platform = body?.platform === "android" ? "android" : body?.platform === "web" ? "web" : "ios";
    const version = typeof body?.version === "string" ? body.version.slice(0, 40) : "";
    const day = pacificDay(nowMs());
    const userId = viewer.actor ? viewer.actor.photographerId : `device:${device}`;
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
