import { MONTH, computeBoards, divisionRank, fmtDay, recordPlacements } from "@/lib/row100k";
import { FIRST_MONTH_KEY, inPeriod, prevMonth, type Month } from "@/lib/rowPeriod";
import { boardData } from "../boardData";
import { EXAMPLE_ROWER, type LandingExample } from "../landing/data";
import type { PaceDot, PacePoint } from "../r/[num]/looks/PaceCurve";
import { buildBests, buildShareData, getRower } from "../r/[num]/shareData";

/* LANDING 2, THE MATH — the one extra read. The landing loader
 * (landing/data.ts) hands every landing the example rower's month SO FAR,
 * which on the 2nd of a month is one row and no curve. What the site keeps
 * is better shown by a month that is finished: the same rower, the month
 * before this one, read the way data.ts reads this one. Null when there is
 * no month before (September 2026 is the first), when the rower logged
 * nothing in it, or when the public board has them hidden — the page then
 * falls back to the month so far, or prints nothing. Read-only. */

export type KeptMonth = LandingExample & {
  /* Which month this is: the calendar key, the label for the line. */
  month: Month;
  /* How many of its days had a row on them. */
  daysRowed: number;
};

export async function loadKeptMonth(): Promise<KeptMonth | null> {
  const prev = prevMonth(MONTH);
  if (prev.key < FIRST_MONTH_KEY) return null;
  try {
    const [board, rower] = await Promise.all([boardData(prev), getRower(EXAMPLE_ROWER)]);
    if (!rower) return null;
    const { participant: p } = rower;
    // The PUBLIC board of that month says whether the rower may be printed:
    // a masked or unranked row stays off the page (data.ts, the same guard).
    const pub = board.total.find((r) => r.participantId === p.id);
    if (!pub || pub.masked || pub.unranked || !(pub.meters > 0)) return null;

    const entries = rower.entries.filter((e) => inPeriod(e.day, prev));
    const b = computeBoards([p], entries, prev.lastDay);
    const byDay: Record<string, number> = {};
    for (const e of entries) byDay[e.day] = (byDay[e.day] ?? 0) + e.meters;

    const paceCurve: PacePoint[] = [];
    const paceDots: PaceDot[] = [];
    let cm = 0;
    let cs = 0;
    for (const e of entries) {
      if (!(e.meters > 0) || !(e.seconds > 0)) continue;
      cm += e.meters;
      cs += e.seconds;
      paceCurve.push({ m: cm, s: cs / (cm / 500), dayStr: fmtDay(e.day) });
      paceDots.push({ m: cm, s: e.seconds / (e.meters / 500), rowM: e.meters, dayStr: fmtDay(e.day) });
    }

    const records = recordPlacements(board, p.id, 10);
    return {
      month: prev,
      daysRowed: Object.values(byDay).filter((m) => m > 0).length,
      name: p.displayName,
      rowerNumber: p.rowerNumber,
      meters: b.total[0]?.meters ?? 0,
      sessions: b.total[0]?.sessions ?? 0,
      byDay,
      paceCurve,
      paceDots,
      bests: buildBests({ p, boards: b, records, masked: false }),
      share: buildShareData({
        p,
        boards: b,
        byDay,
        period: prev,
        rank: divisionRank(board, p.id),
        records,
        masked: false,
        shareElite: false,
        race: undefined,
      }),
    };
  } catch (err) {
    console.error("row100k landing 2: failed to load the kept month", err);
    return null;
  }
}
