import { NextResponse } from "next/server";
import { r2Configured } from "@/lib/r2";
import { deadPhotoWhere, backfillDeadPhotos } from "@/lib/detection";

/**
 * Automatic dead-photo sweep (Vercel Cron — see vercel.json).
 *
 *   GET /api/cron/backfill-detection
 *
 * Finds finalized photos that never got bib/face detection (across all events)
 * and runs detection on a batch. A safety net so no photo stays "dead" even if
 * an upload tab was closed mid-tagging — the dashboard "Fix dead photos" button
 * is the on-demand version of this.
 *
 * Auth: if CRON_SECRET is set, require it (Vercel sends it as a Bearer token).
 * If it isn't set, the endpoint stays open — but it's harmless: it only does
 * the detection that needs doing, bounded to one batch, and no-ops when there's
 * nothing dead. Set CRON_SECRET to lock it down.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

/** Photos per run — bounded to stay within the function's time budget. */
const BATCH = 12;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  if (!r2Configured()) {
    return NextResponse.json({ error: "Photo storage not configured" }, { status: 503 });
  }
  const { processed, remaining } = await backfillDeadPhotos({
    where: deadPhotoWhere(),
    limit: BATCH,
  });
  return NextResponse.json({ ok: true, processed, remaining });
}
