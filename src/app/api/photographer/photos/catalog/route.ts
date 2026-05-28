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
  // Pagination: pages-based when `page` is set, cursor-based otherwise.
  // Page-based gives the client real totals and "jump to last page" but
  // does a COUNT() — cursor avoids that cost. Both share `pageSize`.
  const pageSize = Math.min(
    Math.max(Number(url.searchParams.get("pageSize") ?? 48) || 48, 1),
    200
  );
  const pageParam = url.searchParams.get("page");
  const page = pageParam ? Math.max(Number(pageParam) || 1, 1) : null;
  const cursor = url.searchParams.get("cursor"); // ISO datetime of last seen row
  // ?mine=1 forces "only show photos I uploaded", overriding admin's
  // see-all behaviour. The photographer dashboard sends this so the owner
  // sees their own gallery instead of every photographer's work mixed in.
  const onlyMine = url.searchParams.get("mine") === "1";
  const scopeToMe = !isAdmin || onlyMine;

  // Library filters. Both are admin-only — non-admin's scope is already
  // forced to themselves above, so a photographerId filter is meaningless
  // and an eventId filter, while harmless, gets honored anyway so deep
  // links from the dashboard work for both.
  const filterEventId = url.searchParams.get("eventId") || null;
  const filterPhotographerId = isAdmin
    ? url.searchParams.get("photographerId") || null
    : null;

  const baseWhere = {
    ...(scopeToMe ? { photographerId } : {}),
    ...(filterEventId ? { eventId: filterEventId } : {}),
    ...(filterPhotographerId ? { photographerId: filterPhotographerId } : {}),
  };
  const where = {
    ...baseWhere,
    // Cursor only applies when explicit page isn't requested.
    ...(page === null && cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
  };

  // For pages mode we also need the total to compute pageCount.
  const total =
    page !== null ? await db.photo.count({ where: baseWhere }) : null;

  // Fetch pageSize + 1 to know if there's another page without a count query
  // (cursor mode). Pages mode uses skip/take + total.
  const rows = await db.photo.findMany({
    where,
    orderBy: { createdAt: "desc" },
    ...(page !== null
      ? { skip: (page - 1) * pageSize, take: pageSize }
      : { take: pageSize + 1 }),
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
      faces: {
        select: {
          id: true,
          rekognitionFaceId: true,
          faceClusterId: true,
          confidence: true,
          x0: true,
          y0: true,
          x1: true,
          y1: true,
          source: true,
          createdAt: true,
        },
        orderBy: { confidence: "desc" },
      },
    },
  });

  // Two response shapes — pages mode (total + pageCount) and cursor mode
  // (hasMore + nextCursor). Both return the photos in DESC createdAt order
  // sliced to pageSize.
  let pageRows = rows;
  let hasMore = false;
  let nextCursor: string | null = null;
  let pageCount: number | null = null;

  if (page !== null && total !== null) {
    pageCount = Math.max(Math.ceil(total / pageSize), 1);
    // Pages mode: rows is already exactly `pageSize` (or fewer on the last).
    // No peek row to trim. hasMore is derived from page < pageCount.
    hasMore = page < pageCount;
    if (pageRows.length > 0) {
      nextCursor = pageRows[pageRows.length - 1].createdAt.toISOString();
    }
  } else {
    // Cursor mode: slice off the peek row, advertise hasMore + nextCursor.
    hasMore = rows.length > pageSize;
    pageRows = hasMore ? rows.slice(0, pageSize) : rows;
    if (hasMore && pageRows.length > 0) {
      nextCursor = pageRows[pageRows.length - 1].createdAt.toISOString();
    }
  }

  const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

  return NextResponse.json({
    isAdmin,
    pageSize,
    hasMore,
    nextCursor,
    // Pages-mode fields. Null when caller used cursor mode.
    total,
    page,
    pageCount,
    photos: pageRows.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      mile: r.mile,
      gps: r.gpsLat != null && r.gpsLng != null ? [r.gpsLat, r.gpsLng] : null,
      takenAt: r.takenAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      hidden: r.hidden,
      photographer: r.photographer,
      bibs: r.bibs,
      faces: r.faces.map((f) => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
      })),
      previewUrl: publicBase
        ? `${publicBase}/previews/${r.id}.jpg`
        : `/api/photos/${r.id}/preview`,
      r2OriginalKey: r.r2OriginalKey,
      r2PreviewKey: r.r2PreviewKey,
    })),
  });
}
