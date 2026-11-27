import { NextResponse } from "next/server";
import { syncUser } from "@/lib/concept2";
import { rateLimit } from "@/lib/rateLimit";
import { concept2Viewer } from "../gate";

/* SEND THE ROWS. POST { tz } from the app: right after Connect (which is
 * the backfill: every row off the monitor since M2D began), after each row
 * it logs, and as it opens. Sends what is due, skips what the Logbook
 * already has, and answers where the link stands (lib/concept2.ts
 * syncUser). Nothing here is the phone's to say: which rows, their meters
 * and their times all come off the recordings the site already keeps. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const v = await concept2Viewer();
  if ("error" in v) return NextResponse.json({ ok: false, error: v.error }, { status: v.status });
  const rl = await rateLimit({ key: `concept2-sync:${v.userId}`, limit: 60, windowSec: 3600 }).catch(() => null);
  if (rl && !rl.ok) return NextResponse.json({ ok: false, error: "Too many at once. It goes on its own later." }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { tz?: unknown } | null;
  const concept2 = await syncUser(v.userId, { tz: typeof body?.tz === "string" ? body.tz : undefined, budgetMs: 40_000 });
  return NextResponse.json({ ok: true, concept2 }, { headers: { "Cache-Control": "no-store" } });
}
