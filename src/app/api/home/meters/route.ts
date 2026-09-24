import { NextResponse } from "next/server";
import { meterSnapshot } from "@/lib/homeStats";

/* GET /api/home/meters — the landing counter's resync feed. Public, cheap
 * (reads the cached all-time board, the cached split distribution and the
 * cached finisher count — the whole MeterSnapshot, splitMean/splitSd/splitN
 * included, goes out as-is), never cached at the edge. All time since
 * 2026-09-25 (homeStats.ts). A snapshot whose board read failed goes out as 503
 * (body still attached for debugging) so a poll can never mistake an
 * outage for a real zero. */
export const dynamic = "force-dynamic";

export async function GET() {
  const snap = await meterSnapshot();
  return NextResponse.json(snap, {
    status: snap.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
