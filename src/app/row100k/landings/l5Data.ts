import { db } from "@/lib/db";
import { digitCount } from "@/lib/blackoutRules";
import { CHALLENGE, FIRST_DAY, LAST_DAY, MONTH, fmtSplit } from "@/lib/row100k";
import { FIRST_MONTH_KEY, prevMonth } from "@/lib/rowPeriod";
import { boardData } from "../boardData";

/* WHAT LANDING 5 (THE CLOCK) READS beyond landing/data.ts. Read-only, and
 * everything a stranger may see:
 *   - the latest rows of the month, newest first, each resolved against
 *     the PUBLIC board (boardData, the blackout already applied) — a
 *     masked rower keeps their name and loses the meters and the split,
 *     the rule the front page applies to its one latest row;
 *   - the month before this one, as three totals, so an empty board on
 *     the 1st still has a fact under it;
 *   - the number the next person to opt in would be handed
 *     (row100kJoin.ts: the highest number there is, plus one).
 * Fails open to EMPTY_L5 so the page always renders. */

/* How many latest rows the page prints. */
export const LATEST = 5;

export type L5Row = {
  id: string;
  name: string;
  rowerNumber: number;
  /* The row's own meters — 0 when masked, with `digits` for the blocks. */
  meters: number;
  masked: boolean;
  digits: number;
  /* "2:04.3", or null for an untimed or a masked row. */
  split: string | null;
  createdAtMs: number;
};

export type L5Extra = {
  latest: L5Row[];
  /* Rowers with a meter on this month's board — the board's own `people`
   * counts everyone who ever opted in, rowed this month or not. Null when
   * the board could not be read. */
  rowersIn: number | null;
  prev: { label: string; meters: number; rowers: number; finished: number } | null;
  nextNumber: number | null;
};

export const EMPTY_L5: L5Extra = { latest: [], rowersIn: null, prev: null, nextNumber: null };

export async function loadL5(): Promise<L5Extra> {
  const out: L5Extra = { ...EMPTY_L5 };

  try {
    const [board, rows] = await Promise.all([
      boardData(),
      db.rowEntry.findMany({
        where: { challenge: CHALLENGE, day: { gte: FIRST_DAY, lte: LAST_DAY } },
        select: { id: true, participantId: true, meters: true, seconds: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        // A few spare: a row whose rower is no longer on the board is dropped.
        take: LATEST * 3,
      }),
    ]);
    out.rowersIn = board.total.filter((r) => r.meters > 0 || r.masked).length;
    const byId = new Map(board.total.map((r) => [r.participantId, r]));
    const latest: L5Row[] = [];
    for (const e of rows) {
      const who = byId.get(e.participantId);
      if (!who || !(e.meters > 0)) continue;
      const masked = who.masked === true;
      latest.push({
        id: e.id,
        name: who.name,
        rowerNumber: who.rowerNumber,
        meters: masked ? 0 : e.meters,
        masked,
        digits: digitCount(e.meters),
        split: !masked && e.seconds > 0 ? fmtSplit(e.meters, e.seconds) : null,
        createdAtMs: e.createdAt.getTime(),
      });
      if (latest.length === LATEST) break;
    }
    out.latest = latest;
  } catch (err) {
    console.error("row100k landing 5: failed to load the latest rows", err);
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
