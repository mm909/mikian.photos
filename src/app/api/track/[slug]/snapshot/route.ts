import { NextResponse } from "next/server";
import { gateTrackerApi } from "@/lib/tracker/gate";
import { ensureFreshSnapshot } from "@/lib/tracker/snapshot";
import { bad, cacheControl, slugOk } from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The build is awaited here (compute over every on-course fix since start).
export const maxDuration = 30;

/**
 * GET /api/track/[slug]/snapshot — the one file spectators read (spec §10).
 * Served from TrackerSnapshot, rebuilt first when older than 15 s. Short
 * cache: private while the tracker is admin-only, public + s-maxage once
 * live, so a hundred phones polling every 15 s cost one build.
 */
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const gate = await gateTrackerApi();
  if (gate) return gate;
  if (!slugOk(params.slug)) return new NextResponse(null, { status: 404 });
  try {
    const stored = await ensureFreshSnapshot(params.slug);
    if (!stored) return new NextResponse(null, { status: 404 });
    return NextResponse.json(stored.snapshot, {
      headers: {
        "Cache-Control": cacheControl(5),
        "X-Snapshot-Generated-At": stored.generatedAt.toISOString(),
        "X-Snapshot-Build-Ms": String(stored.buildMs),
      },
    });
  } catch (err) {
    console.error(`track snapshot ${params.slug}: build failed`, err);
    return bad("The snapshot could not be built just now.", 503);
  }
}
