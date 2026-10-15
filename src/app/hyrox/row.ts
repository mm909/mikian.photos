import "server-only";
import { db } from "@/lib/db";
import { partnersFromColumns, readCategory, type Category, type HyroxEvent } from "./events";
import { lookUp } from "./record";

/* ONE ROW OF THE BOARD, server side: the columns the pages read, the
 * lookup that writes hyresult's record onto a row, and the shape a row
 * is handed to the client in. Shared by the entry route (every save),
 * the refresh route (the owner's REFRESH) and the pages. */

export const ROW = {
  id: true,
  userId: true,
  name: true,
  instagram: true,
  format: true,
  division: true,
  gender: true,
  day: true,
  partners: true,
  partnerIgs: true,
  startTime: true,
  priorRaces: true,
  pr: true,
  finishTime: true,
  resultIdp: true,
  hyresultSlug: true,
  recordAt: true,
  email: true,
} as const;

export type Row = {
  id: string;
  userId: string;
  name: string;
  instagram: string;
  format: string;
  division: string;
  gender: string;
  day: string;
  partners: string[];
  partnerIgs: string[];
  startTime: string;
  priorRaces: number | null;
  pr: string;
  finishTime: string;
  resultIdp: string;
  hyresultSlug: string;
  recordAt: Date | null;
  email: string;
};

/* Looks the row's name up on hyresult (record.ts) and writes what it
 * says — the record, the published wave and its day, the finish — onto
 * the row. Null when hyresult could not be reached; the row is untouched. */
export async function refreshRecord(ev: HyroxEvent, row: Row, timeoutMs?: number): Promise<Row | null> {
  try {
    const rec = await lookUp(ev, { name: row.name, format: row.format, division: row.division, gender: row.gender, partners: partnersFromColumns(row.partners, row.partnerIgs) }, timeoutMs);
    if (!rec) return null;
    return await db.hyroxEntry.update({
      where: { id: row.id },
      data: {
        priorRaces: rec.priorRaces,
        pr: rec.pr,
        finishTime: rec.finishTime,
        resultIdp: rec.resultIdp,
        hyresultSlug: rec.slug,
        recordAt: new Date(),
        ...(rec.startTime ? { startTime: rec.startTime } : {}),
        ...(rec.day ? { day: rec.day } : {}),
      },
      select: ROW,
    });
  } catch (err) {
    console.warn("[hyrox] record lookup failed", err instanceof Error ? err.message : err);
    return null;
  }
}

/* ON VIEW, THE STALEST ROWS ARE READ AGAIN (owner, 2026-10-15: "that
 * should just be automatic"; "later on, it should update with their
 * time"): a few per page view — never looked up first, then the oldest —
 * once a day before the weekend, every half hour during it, and for a
 * week after, so the waves and the finishes arrive without anyone
 * pressing anything. A handful at a time keeps a page view quick; a
 * name hyresult cannot be reached for is simply tried again next view. */
export async function refreshStale(ev: HyroxEvent, rows: Row[], weekend: "before" | "live" | "after", max = 3): Promise<Row[]> {
  const now = Date.now();
  if (weekend === "after" && now > ev.closeMs + 7 * 86_400_000) return rows;
  const maxAge = weekend === "live" ? 30 * 60_000 : 24 * 3_600_000;
  const stale = rows
    .filter((r) => !r.recordAt || now - r.recordAt.getTime() > maxAge)
    .sort((a, b) => (a.recordAt?.getTime() ?? 0) - (b.recordAt?.getTime() ?? 0))
    .slice(0, max);
  if (stale.length === 0) return rows;
  /* A short leash: a page view must not wait long on hyresult. */
  const done = await Promise.all(stale.map((r) => refreshRecord(ev, r, 3500)));
  const byId = new Map<string, Row>();
  for (const d of done) if (d) byId.set(d.id, d);
  if (byId.size === 0) return rows;
  return rows.map((r) => byId.get(r.id) ?? r);
}

/* A row's category never fails to read (the route validates it), but the
 * type asks for a fallback. */
export const UNKNOWN_CATEGORY: Category = { format: "singles", division: "open", gender: "men" };

/* The row for a page or a response: the category as a Category, the
 * partners as pairs, the record, no email. `fallback` supplies a
 * category should the stored one not read (it always does). */
export function rowOut(r: Row, fallback: Category = UNKNOWN_CATEGORY) {
  return {
    id: r.id,
    name: r.name,
    instagram: r.instagram,
    ...(readCategory(r.format, r.division, r.gender) ?? fallback),
    day: r.day,
    partners: partnersFromColumns(r.partners, r.partnerIgs),
    startTime: r.startTime,
    priorRaces: r.priorRaces,
    pr: r.pr,
    finishTime: r.finishTime,
    resultIdp: r.resultIdp,
    hyresultSlug: r.hyresultSlug,
    recordAt: r.recordAt ? r.recordAt.toISOString() : null,
  };
}
