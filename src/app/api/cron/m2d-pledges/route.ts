import { NextResponse } from "next/server";
import { sweepPledges } from "@/app/row100k/m2dPledgeActions";

/* THE M2D PLEDGE SWEEP (Vercel Cron, vercel.json, daily): the givers'
 * emails that are due (row100k/m2dPledgeActions.ts sweepPledges): a
 * welcome that failed, the total and split for a pledge whose cap filled,
 * and at the close the same for every pledge. Each is sent once.
 *
 * Auth: REQUIRES CRON_SECRET as a Bearer token, fails closed, like the
 * backup next door. Nothing is due until the owner approves a pledge. */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const r = await sweepPledges();
    console.info(`[m2d-pledges] ${r.welcomed} welcomed, ${r.done} told their total`);
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    console.error("[m2d-pledges] failed", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
