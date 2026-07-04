import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";

/**
 * The photos that headline an event's search landing (the portfolio hero).
 *
 * Owner-curated `featured` photos come first (newest curation first), and the
 * remainder is topped up with a RANDOM sample so the collage always looks full
 * — "pin a few favorites, we fill the rest," and pure-random when nothing is
 * pinned (the requested fallback).
 *
 * Fails open twice over: if the `featured` column isn't migrated yet
 * (`prisma db push` pending) the featured query throws and we treat it as "none
 * featured"; if the raw random sample errors we fall back to a plain recent
 * take. So the landing always renders something, even before the migration.
 */
const DEFAULT_TARGET = 9;

/** `ids` = the hero list (pinned first, then random fill). `pinnedIds` = the
 *  subset that is genuinely owner-featured (so a curation UI can show the
 *  correct ★ state without treating random fills as pinned). */
export type LandingPhotos = { ids: string[]; pinnedIds: string[] };

export async function featuredLandingPhotoIds(
  eventId: string,
  target = DEFAULT_TARGET
): Promise<LandingPhotos> {
  let featured: string[] = [];
  try {
    const rows = await db.photo.findMany({
      where: { eventId, hidden: false, featured: true },
      orderBy: { featuredAt: "desc" },
      take: target,
      select: { id: true },
    });
    featured = rows.map((r) => r.id);
  } catch {
    // Column not migrated yet → no featured; the random fill below carries it.
    featured = [];
  }
  if (featured.length >= target) {
    const ids = featured.slice(0, target);
    return { ids, pinnedIds: ids };
  }

  const need = target - featured.length;
  const featuredSet = new Set(featured);
  let fill: string[] = [];
  try {
    // Postgres random sample. Over-fetch a little so removing any overlap with
    // the featured set still leaves enough.
    const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM "Photo"
      WHERE "eventId" = ${eventId} AND "hidden" = false
      ORDER BY random()
      LIMIT ${target + featured.length}
    `);
    fill = rows.map((r) => r.id).filter((id) => !featuredSet.has(id)).slice(0, need);
  } catch {
    // Raw sample failed — settle for a plain recent take (still event-scoped).
    try {
      const rows = await db.photo.findMany({
        where: { eventId, hidden: false },
        orderBy: { createdAt: "desc" },
        take: target + featured.length,
        select: { id: true },
      });
      fill = rows.map((r) => r.id).filter((id) => !featuredSet.has(id)).slice(0, need);
    } catch {
      fill = [];
    }
  }
  return { ids: [...featured, ...fill], pinnedIds: featured };
}
