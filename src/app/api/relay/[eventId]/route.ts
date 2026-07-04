import { NextResponse } from "next/server";
import { getRelayData } from "@/lib/relay";

/**
 * Public relay-tracker data (TSP France live page).
 *
 *   GET /api/relay/[eventId] → RelayData (runners + stats, segments,
 *                              waypoints with ETAs, team totals)
 *
 * Public by design — the tracker page is a shareable URL for family/sponsors.
 * Contains only route/stat data the team chose to publish; no auth, no cost
 * amplification (a handful of small DB reads).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { eventId: string } }) {
  const data = await getRelayData(params.eventId);
  return NextResponse.json(data, {
    // Small cache so a viral share doesn't hammer the DB, still "live enough"
    // for a tracker that updates once per segment.
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
