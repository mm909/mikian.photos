import { NextResponse } from "next/server";
import { meterSnapshot } from "@/lib/homeStats";

/* GET /api/home/meters — the landing counter's resync feed. Public, cheap
 * (reads the cached board and the cached split distribution — the whole
 * MeterSnapshot, splitMean/splitSd/splitN included, goes out as-is), never
 * cached at the edge. A snapshot whose board read failed goes out as 503
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
