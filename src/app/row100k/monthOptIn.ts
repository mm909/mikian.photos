import { db } from "@/lib/db";
import { CHALLENGE, MONTH } from "@/lib/row100k";

/* THE MONTH'S 100K OPT-IN (owner, 2026-10-01, the board redesign): who is
 * on this month's board. The 100K board (dev/board/page.tsx) lists only the
 * rowers with a live RowMonthOptIn row for the month; everyone else's rows
 * still count everywhere else (the stats, the records, the profile) — the
 * opt-in is about the board, not the meters. SERVER ONLY.
 *
 * In is in (owner, 2026-10-01: "there's no opt out. Once you opt in,
 * you're opted in"): nothing stamps cancelledAt any more. The filter stays
 * for the rows let go under the first version, which had a way out — they
 * are off the board until their rower opts in again. */

/* The participant ids opted into `month`, live rows only. Throws on a db
 * failure (the table not pushed yet) so the page can fail soft itself. */
export async function monthOptIns(month: string = MONTH.key): Promise<Set<string>> {
  const rows = await db.rowMonthOptIn.findMany({
    where: { challenge: CHALLENGE, month, cancelledAt: null },
    select: { participantId: true },
  });
  return new Set(rows.map((r) => r.participantId));
}
