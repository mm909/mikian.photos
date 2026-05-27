import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEffectivePhotographerId } from "@/lib/photographerLock";

/**
 * Admin photo catalog with full metadata — used by /photographer/photos.
 *
 * Returns every Photo (visible or hidden) for the photographer (or every
 * photographer if the caller is using the admin unlock cookie), with EXIF
 * + every PhotoBib row (bib, confidence, source) attached. The runner-facing
 * /api/photos endpoint is for buyers; this one is for the admin's
 * "see and re-run detection" surface.
 */
export const runtime = "nodejs";

export async function GET(req: Request) {
  const photographerId = await getEffectivePhotographerId();
  if (!photographerId) {
    return NextResponse.json({ error: "Photographer access required" }, { status: 401 });
  }

  // If the caller authenticated via the unlock cookie, getEffectivePhotographerId
  // returned the admin row — give them every photo. Otherwise scope to their own.
  // Quick admin check: pull the row and look at isAdmin.
  const pg = await db.photographer.findUnique({
    where: { id: photographerId },
    select: { isAdmin: true },
  });
  const isAdmin = pg?.isAdmin ?? false;

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 500) || 500, 1000);

  const rows = await db.photo.findMany({
    where: isAdmin ? {} : { photographerId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      eventId: true,
      mile: true,
      gpsLat: true,
      gpsLng: true,
      takenAt: true,
      r2OriginalKey: true,
      r2PreviewKey: true,
      hidden: true,
      createdAt: true,
      photographer: { select: { id: true, name: true, email: true } },
      bibs: {
        select: { id: true, bib: true, confidence: true, source: true, createdAt: true },
        orderBy: { confidence: "desc" },
      },
    },
  });

  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

  return NextResponse.json({
    isAdmin,
    photos: rows.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      mile: r.mile,
      gps: r.gpsLat != null && r.gpsLng != null ? [r.gpsLat, r.gpsLng] : null,
      takenAt: r.takenAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      hidden: r.hidden,
      photographer: r.photographer,
      bibs: r.bibs,
      previewUrl: publicBase
        ? `${publicBase}/previews/${r.id}.jpg`
        : `/api/photos/${r.id}/preview`,
      r2OriginalKey: r.r2OriginalKey,
      r2PreviewKey: r.r2PreviewKey,
    })),
  });
}
