import {
  MONTH,
  computeBoards,
  divisionRank,
  fmtDay,
  recordPlacements,
  visibleTiers,
  type Boards,
} from "@/lib/row100k";
import { FIRST_MONTH_KEY, inPeriod, prevMonth, type Month } from "@/lib/rowPeriod";
import { boardData } from "../boardData";
import { EXAMPLE_ROWER, type LandingData, type LandingExample } from "../landing/data";
import type { PaceDot, PacePoint } from "../r/[num]/looks/PaceCurve";
import { buildBests, buildShareData, getRower } from "../r/[num]/shareData";

/* LANDING 4, THE CARD: what it reads beyond the shared loader.
 *
 * The card in the fold is a FINISHED month when there is one: the thing a
 * stranger saw in a story is somebody's whole month, and on the 6th the
 * month being rowed is two rows of squares. So the example rower's LAST
 * month is loaded the way landing/data.ts loads this one (same rower, same
 * builders, the public board for the placements), and everything on the
 * page that says "behind the card" is that same month. No last month (the
 * first month there was, or the rower did not row it, or the board has them
 * hidden): this month stands in, straight off the shared loader.
 *
 * Read-only, fails open to this month. */

export type L4Rung = {
  meters: number;
  /* Rowers who reached it in the month the card is from. */
  reached: number;
};

export type L4Data = {
  /* The month the card and the page behind it are from. */
  label: string;
  short: string;
  year: number;
  grid: { key: string; firstDow: number; days: number };
  /* Days of it to draw on the calendar. */
  days: number;
  /* A finished month (last month) rather than this one so far. */
  finished: boolean;
  example: LandingExample | null;
  /* Days with a meter on them. */
  rowedDays: number;
  /* Rowers with a meter in that month, and how many reached each rung. */
  rowers: number;
  rungs: L4Rung[];
};

/* The ladder as the board shows it (row100k.ts visibleTiers): every rung
 * somebody reached that month plus the next one up, which nobody is told
 * the name of ahead of time (owner, 2026-09-05) — `reached` 0 is that one,
 * and the page draws blocks for it. */
function rungsOf(board: Boards | null): L4Rung[] {
  const max = board ? Math.max(0, ...board.total.map((r) => r.meters)) : 0;
  return visibleTiers(max).map((t) => ({
    meters: t.meters,
    // A masked row carries its tier floor (blackoutRules.ts), so the count
    // per rung holds through a blackout.
    reached: board ? board.total.filter((r) => r.meters >= t.meters).length : 0,
  }));
}

function rowedDays(byDay: Record<string, number>): number {
  return Object.values(byDay).filter((m) => m > 0).length;
}

/* One rower's month as the landing example: landing/data.ts's build, over
 * any month. Null when the public board hides them or they did not row. */
async function exampleFor(month: Month, board: Boards): Promise<LandingExample | null> {
  const rower = await getRower(EXAMPLE_ROWER);
  if (!rower) return null;
  const { participant: p } = rower;
  const pub = board.total.find((r) => r.participantId === p.id);
  if (!pub || pub.masked || pub.unranked || !(pub.meters > 0)) return null;
  const entries = rower.entries.filter((e) => inPeriod(e.day, month));
  const b = computeBoards([p], entries, month.lastDay);
  if (!b.total[0] || !(b.total[0].meters > 0)) return null;
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
    name: p.displayName,
    rowerNumber: p.rowerNumber,
    meters: b.total[0].meters,
    sessions: b.total[0].sessions,
    byDay,
    paceCurve,
    paceDots,
    bests: buildBests({ p, boards: b, records, masked: false }),
    share: buildShareData({
      p,
      boards: b,
      byDay,
      period: month,
      rank: divisionRank(board, p.id),
      records,
      masked: false,
      shareElite: false,
      race: undefined,
    }),
  };
}

export async function loadL4(data: LandingData): Promise<L4Data> {
  const gridOf = (m: Month) => ({ key: m.key, firstDow: m.firstDow, days: m.days });

  // This month, off the shared loader — the fallback.
  let out: L4Data = {
    label: MONTH.label,
    short: MONTH.short,
    year: MONTH.year,
    grid: gridOf(MONTH),
    days: data.today,
    finished: false,
    example: data.example,
    rowedDays: data.example ? rowedDays(data.example.byDay) : 0,
    rowers: data.month.rowers,
    rungs: rungsOf(null),
  };

  try {
    out.rungs = rungsOf(await boardData());
  } catch (err) {
    console.error("row100k landing 4: failed to load this month's board", err);
  }

  try {
    const last = prevMonth(MONTH);
    if (last.key >= FIRST_MONTH_KEY) {
      const board = await boardData(last);
      const example = await exampleFor(last, board);
      if (example) {
        out = {
          label: last.label,
          short: last.short,
          year: last.year,
          grid: gridOf(last),
          days: last.days,
          finished: true,
          example,
          rowedDays: rowedDays(example.byDay),
          rowers: board.community.people,
          rungs: rungsOf(board),
        };
      }
    }
  } catch (err) {
    console.error("row100k landing 4: failed to load last month", err);
  }
  return out;
}
