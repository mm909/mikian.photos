import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireEventManager } from "@/lib/permissions";
import { colorGroupLabel, DEFAULT_CAMP_PALETTE, rgbToHex } from "@/lib/colorGroups";

const ANCHOR_HEX = new Map(DEFAULT_CAMP_PALETTE.map((c) => [c.key, rgbToHex(c.rgb)]));

/**
 * Owner-only rollup of the color groups detection has IDENTIFIED for an event —
 * so the owner can judge how good the auto-detection is before relying on it
 * (the runner-facing color expansion is off until the approach is solid).
 *
 *   GET /api/admin/events/[id]/color-groups
 *     → { groups: [{ key, label, photoCount, peopleCount }],
 *         photosWithGroups, totalPhotos }
 *
 * `photoCount` = photos containing the group; `peopleCount` = total people of
 * that group detected across the event (sum of the per-photo counts).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const actor = await requireEventManager(params.id);
  if (!actor) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const ev = await db.event.findUnique({
    where: { id: params.id },
    select: { colorGroupLabels: true },
  });
  if (!ev) return NextResponse.json({ error: "Unknown event" }, { status: 404 });
  const labels =
    ev.colorGroupLabels && typeof ev.colorGroupLabels === "object" && !Array.isArray(ev.colorGroupLabels)
      ? (ev.colorGroupLabels as Record<string, string>)
      : null;

  const [grouped, photosWithGroups, totalPhotos] = await Promise.all([
    db.photoColorGroup.groupBy({
      by: ["colorGroup"],
      where: { eventId: params.id },
      _count: { photoId: true },
      _sum: { count: true },
    }),
    db.photo.count({
      where: { eventId: params.id, hidden: false, colorGroups: { some: {} } },
    }),
    db.photo.count({ where: { eventId: params.id, hidden: false } }),
  ]);

  const groups = grouped
    .map((g) => ({
      key: g.colorGroup,
      label: colorGroupLabel(g.colorGroup, labels),
      hex: ANCHOR_HEX.get(g.colorGroup) ?? "#cccccc",
      photoCount: g._count.photoId,
      peopleCount: g._sum.count ?? 0,
    }))
    .sort((a, b) => b.photoCount - a.photoCount);

  return NextResponse.json({ groups, photosWithGroups, totalPhotos });
}
