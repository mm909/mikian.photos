import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { gateTrackerApi } from "@/lib/tracker/gate";
import { slugOk } from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/track/[slug]/devices — "we last heard from your phone N s ago"
 * for the join page (spec §11), and a quick health table for the owner.
 * One row per device with its newest fix (by fix time, never arrival) and
 * the age against the server clock. Never cached: the whole point is now.
 */
export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const gate = await gateTrackerApi();
  if (gate) return gate;
  if (!slugOk(params.slug)) return new NextResponse(null, { status: 404 });

  const event = await db.trackerEvent.findUnique({ where: { id: params.slug }, select: { id: true } });
  if (!event) return new NextResponse(null, { status: 404 });

  const devices = await db.trackerDevice.findMany({
    where: { eventId: params.slug },
    select: {
      id: true,
      externalId: true,
      source: true,
      role: true,
      participantId: true,
      entryId: true,
      participant: { select: { name: true, sortOrder: true } },
      entry: { select: { shortName: true, sortOrder: true } },
    },
  });
  const now = Date.now();
  const latest = await Promise.all(
    devices.map((d) =>
      db.trackerPosition.findFirst({
        where: { deviceId: d.id },
        orderBy: { fixTime: "desc" },
        select: { fixTime: true, batteryPct: true, accuracyM: true },
      }),
    ),
  );
  const rows = devices
    .map((d, i) => {
      const p = latest[i];
      return {
        id: d.id,
        external_id: d.externalId,
        source: d.source,
        role: d.role,
        participant_id: d.participantId,
        participant_name: d.participant?.name ?? null,
        entry_id: d.entryId,
        entry_short_name: d.entry?.shortName ?? null,
        last_fix_time: p ? p.fixTime.toISOString() : null,
        age_s: p ? Math.max(0, Math.round((now - p.fixTime.getTime()) / 1000)) : null,
        battery_pct: p?.batteryPct ?? null,
        accuracy_m: p?.accuracyM ?? null,
        _sort: [d.entry?.sortOrder ?? 99, d.role === "runner" ? 0 : 1, d.participant?.sortOrder ?? 99] as const,
      };
    })
    .sort((a, b) => a._sort[0] - b._sort[0] || a._sort[1] - b._sort[1] || a._sort[2] - b._sort[2])
    .map(({ _sort, ...row }) => row);

  return NextResponse.json({ devices: rows, now: new Date(now).toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
