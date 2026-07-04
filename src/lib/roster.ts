/**
 * Per-event roster read helpers (public-facing lookups).
 *
 * These are the clean, fail-open reads over the RosterEntry table that other
 * surfaces (e.g. /api/photos, to label a photo with the runner's name/time)
 * will consume. They deliberately live apart from the import machinery in
 * src/lib/rosterImport so callers pull in only a tiny read surface.
 *
 * FAIL-OPEN: RosterEntry may not be pushed to the DB yet (owner runs
 * `npm run prisma:push` later). Every call is wrapped so a missing table / any
 * read error returns null / 0 instead of throwing — mirrors src/lib/featured.ts
 * and src/lib/relay.ts. Callers should treat a null/0 as "no roster wired yet."
 */
import "server-only";
import { db } from "./db";

export type RosterLookup = {
  bib: number;
  name: string;
  distance: string | null;
  finishTime: string | null;
};

/**
 * The roster entry for one bib in an event, or null when there's no match (or
 * the table isn't migrated yet). Only the fields a public label needs are
 * returned.
 */
export async function getRosterEntry(
  eventId: string,
  bib: number
): Promise<RosterLookup | null> {
  if (!eventId || !Number.isFinite(bib)) return null;
  try {
    const row = await db.rosterEntry.findUnique({
      where: { eventId_bib: { eventId, bib } },
      select: { bib: true, name: true, distance: true, finishTime: true },
    });
    if (!row) return null;
    return {
      bib: row.bib,
      name: row.name,
      distance: row.distance ?? null,
      finishTime: row.finishTime ?? null,
    };
  } catch {
    // Table not migrated yet / read error → behave as "no roster."
    return null;
  }
}

/** How many roster rows are stored for an event (0 when none or unmigrated). */
export async function getRosterCount(eventId: string): Promise<number> {
  if (!eventId) return 0;
  try {
    return await db.rosterEntry.count({ where: { eventId } });
  } catch {
    return 0;
  }
}

/**
 * A bib→entry map for an event (handy for bulk-labeling many photos without N
 * queries). Empty map when none / unmigrated. Bounded to a sane cap so a huge
 * roster can't balloon memory unexpectedly.
 */
export async function getRosterMap(
  eventId: string,
  limit = 20000
): Promise<Map<number, RosterLookup>> {
  const out = new Map<number, RosterLookup>();
  if (!eventId) return out;
  try {
    const rows = await db.rosterEntry.findMany({
      where: { eventId },
      select: { bib: true, name: true, distance: true, finishTime: true },
      take: limit,
    });
    for (const r of rows) {
      out.set(r.bib, {
        bib: r.bib,
        name: r.name,
        distance: r.distance ?? null,
        finishTime: r.finishTime ?? null,
      });
    }
  } catch {
    /* unmigrated / read error → empty map */
  }
  return out;
}
