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
  // Cursor pagination. `pageSize` caps how many we return per page;
  // `cursor` is the createdAt ISO string of the last row from the previous
  // page (we send rows back DESC by createdAt). Omit cursor → first page.
  const pageSize = Math.min(
    Math.max(Number(url.searchParams.get("pageSize") ?? 48) || 48, 1),
    200
  );
  const cursor = url.searchParams.get("cursor"); // ISO datetime of last seen row
  // ?mine=1 forces "only show photos I uploaded", overriding admin's
  // see-all behaviour. The photographer dashboard sends this so the owner
  // sees their own gallery instead of every photographer's work mixed in.
  const onlyMine = url.searchParams.get("mine") === "1";
  const scopeToMe = !isAdmin || onlyMine;

  const where = {
    ...(scopeToMe ? { photographerId } : {}),
    ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
  };

  // Fetch pageSize + 1 to know if there's another page without a count query.
  const rows = await db.photo.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: pageSize + 1,
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

  // If we fetched pageSize+1 successfully, there's at least one more row
  // beyond this page. Slice off the peek row before returning.
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const nextCursor = hasMore ? page[page.length - 1].createdAt.toISOString() : null;

  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

  return NextResponse.json({
    isAdmin,
    pageSize,
    hasMore,
    nextCursor,
    photos: page.map((r) => ({
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
