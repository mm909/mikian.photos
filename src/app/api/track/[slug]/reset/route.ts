import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { forgetRouteIndex } from "@/lib/tracker/ingest";
import { snapshotAfterIngest } from "@/lib/tracker/snapshot";
import { bad, readJson, requireCrew } from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/track/[slug]/reset?k=<crew key> — DEV ONLY, for the simulator
 * (spec §12): wipes the event's positions, handoffs and snapshot so a replay
 * starts clean. Config rows (event, route, entries, participants, devices)
 * stay. 404 in production, always: nothing on the live site deletes a race.
 */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  const body = await readJson(req);
  if (body === null) return bad("Send JSON.");
  const crew = await requireCrew(req, params.slug, body);
  if ("res" in crew) return crew.res;

  const [positions, handoffs, snapshots] = await db.$transaction([
    db.trackerPosition.deleteMany({ where: { device: { eventId: params.slug } } }),
    db.trackerHandoff.deleteMany({ where: { entry: { eventId: params.slug } } }),
    db.trackerSnapshot.deleteMany({ where: { eventId: params.slug } }),
  ]);
  forgetRouteIndex();
  try {
    await snapshotAfterIngest(params.slug);
  } catch (err) {
    console.error(`track reset ${params.slug}: snapshot rebuild failed (fine before compute lands)`, err);
  }
  console.log(`track reset ${params.slug}: ${positions.count} positions, ${handoffs.count} handoffs, ${snapshots.count} snapshot`);
  return NextResponse.json({ ok: true, deleted: { positions: positions.count, handoffs: handoffs.count, snapshot: snapshots.count } });
}
