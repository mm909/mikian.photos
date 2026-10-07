import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gateTrackerApi } from "@/lib/tracker/gate";
import { buildRouteIndex, decimateForMap, pointAtRouteM, storedPointsFromJson } from "@/lib/tracker/routeIndex";
import type { CheckpointKind, RouteFile } from "@/lib/tracker/types";
import { bad, cacheControl, slugOk } from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/track/[slug]/route[?route_id=] — the polyline the map draws once
 * (spec §10: "a separate static file fetched once"): the event's default
 * route, or a per-entry route by id, decimated to ≤ 2500 points with the
 * cumulative distance per point so the client can split the completed part,
 * plus the checkpoints placed on the line.
 *
 * Built once per (route id, sourceHash) and kept in module memory; the
 * sourceHash is re-read on every request (one tiny query) so a re-synced
 * GPX shows up without a redeploy.
 */

type Cached = { sourceHash: string; file: RouteFile };
const cache = new Map<string, Cached>();

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const gate = await gateTrackerApi();
  if (gate) return gate;
  if (!slugOk(params.slug)) return new NextResponse(null, { status: 404 });

  const wanted = new URL(req.url).searchParams.get("route_id")?.trim() || null;
  const event = await db.trackerEvent.findUnique({ where: { id: params.slug }, select: { defaultRouteId: true } });
  if (!event) return new NextResponse(null, { status: 404 });
  const routeId = wanted ?? event.defaultRouteId;
  if (!routeId) return bad("This event has no route yet — run the sync.", 404);

  const head = await db.trackerRoute.findFirst({ where: { id: routeId, eventId: params.slug }, select: { id: true, sourceHash: true } });
  if (!head) return new NextResponse(null, { status: 404 });

  let hit = cache.get(routeId);
  if (!hit || hit.sourceHash !== head.sourceHash) {
    const row = await db.trackerRoute.findUnique({
      where: { id: routeId },
      select: {
        lengthM: true,
        points: true,
        sourceHash: true,
        checkpoints: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, kind: true, routeM: true } },
      },
    });
    if (!row) return new NextResponse(null, { status: 404 });
    let file: RouteFile;
    try {
      const index = buildRouteIndex(storedPointsFromJson(row.points));
      const { coords, cumM } = decimateForMap(index);
      file = {
        route_id: routeId,
        length_m: index.lengthM,
        coords,
        cum_m: cumM,
        bbox: index.bbox,
        checkpoints: row.checkpoints.map((cp) => {
          const p = pointAtRouteM(index, cp.routeM);
          return { id: cp.id, name: cp.name, kind: cp.kind as CheckpointKind, route_m: cp.routeM, lat: p.lat, lon: p.lon };
        }),
      };
    } catch (err) {
      console.error(`track route ${routeId}: unreadable points`, err);
      return bad("The route could not be read.", 500);
    }
    hit = { sourceHash: row.sourceHash, file };
    cache.set(routeId, hit);
  }

  return NextResponse.json(hit.file, { headers: { "Cache-Control": cacheControl(300) } });
}
