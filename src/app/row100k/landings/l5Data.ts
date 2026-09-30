import { db } from "@/lib/db";
import { CHALLENGE, MONTH } from "@/lib/row100k";
import { FIRST_MONTH_KEY, prevMonth } from "@/lib/rowPeriod";
import { boardData } from "../boardData";

/* WHAT LANDING 5 (THE CLOCK) READS beyond landing/data.ts. Read-only, and
 * everything a stranger may see:
 *   - how many rowers have a meter on this month's PUBLIC board (boardData,
 *     the blackout already applied);
 *   - the month before this one, as three totals, so an empty board on
 *     the 1st still has a fact under it;
 *   - the number the next person to opt in would be handed
 *     (row100kJoin.ts: the highest number there is, plus one).
 * The latest-rows list went with the review of 2026-09-30 (five names a
 * stranger does not know), and its query with it.
 * Fails open to EMPTY_L5 so the page always renders. */

export type L5Extra = {
  /* Rowers with a meter on this month's board — the board's own `people`
   * counts everyone who ever opted in, rowed this month or not. Null when
   * the board could not be read. */
  rowersIn: number | null;
  prev: { label: string; meters: number; rowers: number; finished: number } | null;
  nextNumber: number | null;
};

export const EMPTY_L5: L5Extra = { rowersIn: null, prev: null, nextNumber: null };

export async function loadL5(): Promise<L5Extra> {
  const out: L5Extra = { ...EMPTY_L5 };

  try {
    const board = await boardData();
    out.rowersIn = board.total.filter((r) => r.meters > 0 || r.masked).length;
  } catch (err) {
    console.error("row100k landing 5: failed to count the rowers in", err);
  }

  try {
    const last = prevMonth(MONTH);
    if (last.key >= FIRST_MONTH_KEY) {
      const b = await boardData(last);
      if (b.community.meters > 0) {
        out.prev = {
          label: last.label,
          meters: b.community.meters,
          rowers: b.total.filter((r) => r.meters > 0 || r.masked).length,
          finished: b.community.finished,
        };
      }
    }
  } catch (err) {
    console.error("row100k landing 5: failed to load last month", err);
  }

  try {
    const max = await db.rowParticipant.aggregate({
      where: { challenge: CHALLENGE },
      _max: { rowerNumber: true },
    });
    out.nextNumber = (max._max.rowerNumber ?? 0) + 1;
  } catch (err) {
    console.error("row100k landing 5: failed to read the next number", err);
  }

  return out;
}
