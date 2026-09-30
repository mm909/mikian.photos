import { db } from "@/lib/db";
import { digitCount } from "@/lib/blackoutRules";
import { CHALLENGE } from "@/lib/row100k";
import { monthOf } from "@/lib/rowPeriod";
import { boardData } from "./boardData";
import { dailyInput, dayNoonMs, type DailyInput } from "./dailyMail";

/* THE DAILY SUMMARY'S READ — one function the cron (api/cron/row100k-daily)
 * and the emails page (row100k/emails) share, so the mail the owner
 * previews is built from the same rows as the one he gets. Straight from
 * the db, no cache: it runs once a morning and once per preview, and a
 * five-minute-old board is the wrong thing to summarise a day with.
 *
 * Throws on a bad read — the cron answers 503, the page says so — and
 * hands the pure fold (dailyMail.ts) the rows with createdAt flattened
 * to ms.
 *
 * THE BLACKOUT rides along: the owner's inbox is a surface like any other
 * (rowMail.ts), so the day's top three are read against the PUBLIC board
 * of the day's month, and a rower it hides has their meters printed the
 * way the row-logged note prints them — blocks while a window is open,
 * the run-up shape before it. Nothing else in the mail is one rower's
 * number. boardData fails open to no blackout, as it does everywhere. */
export async function loadDailyInput(day: string): Promise<DailyInput> {
  const [participants, entries, board] = await Promise.all([
    db.rowParticipant.findMany({
      where: { challenge: CHALLENGE },
      select: { id: true, rowerNumber: true, displayName: true, createdAt: true },
      orderBy: { rowerNumber: "asc" },
    }),
    db.rowEntry.findMany({
      where: { challenge: CHALLENGE },
      select: { id: true, participantId: true, day: true, meters: true, seconds: true, createdAt: true },
      orderBy: [{ day: "asc" }, { createdAt: "asc" }],
    }),
    boardData(monthOf(dayNoonMs(day))),
  ]);

  const input = dailyInput(
    {
      participants: participants.map((p) => ({ id: p.id, rowerNumber: p.rowerNumber, displayName: p.displayName, createdAtMs: p.createdAt.getTime() })),
      entries: entries.map((e) => ({
        id: e.id,
        participantId: e.participantId,
        day: e.day,
        meters: e.meters,
        seconds: e.seconds,
        createdAtMs: e.createdAt.getTime(),
      })),
    },
    day,
  );

  const rows = new Map(board.total.map((r) => [r.participantId, r]));
  for (const t of input.top) {
    const r = rows.get(t.participantId);
    if (!r) continue;
    if (r.masked) t.censor = { kind: "full", digits: digitCount(t.meters), why: "elite" };
    else if ((r.hideLow ?? 0) > 0) t.censor = { kind: "partial", hideLow: r.hideLow as number };
  }
  return input;
}
