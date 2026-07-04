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
 * Auth: REQUIRES CRON_SECRET (Vercel sends it as a Bearer token). Fails CLOSED
 * — if CRON_SECRET isn't set, the endpoint is disabled (503) so an attacker
 * can't trigger expensive Rekognition runs on an unconfigured deploy. Set
 * CRON_SECRET in the Vercel env for the cron to run.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

/** Photos per run — bounded to stay within the function's time budget. */
const BATCH = 12;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
