import { ELITE_LABEL } from "@/lib/blackoutRules";
import {
  MONTH,
  computeBoards,
  daysElapsed,
  divisionRank,
  fmtDay,
  nowMs,
  recordPlacements,
  type Boards,
  type RecordRow,
  type TotalRow,
} from "@/lib/row100k";
import { allTime, monthsThrough, type Month } from "@/lib/rowPeriod";
import { boardData } from "../boardData";
import type { PaceDot, PacePoint } from "../r/[num]/looks/PaceCurve";
import type { ProfileBest } from "../r/[num]/looks/view";
import { buildBests, buildShareData, getRower } from "../r/[num]/shareData";
import type { ShareData } from "../share/cards";

/* ONE LOADER for the signed-out landing (owner, 2026-09-25: "lean into the
 * stats we collect, the long-term logging and progress, some of the
 * leaderboards, the shareables"; since 2026-09-30 THE DARE, landings/L1.tsx,
 * is the front for every stranger). Everything a stranger may see: the
 * PUBLIC board (boardData — the blackout already applied), this month and
 * all time, the number the next rower gets, one real rower's month as the
 * example of what a profile holds, and — since 2026-10-01 — everyone's
 * meters on every day of every month so far, for the month calendar and
 * its month word. Fails open to EMPTY_LANDING so the page always renders. */

/* The example rower: number 001 (the demo seed's first rower; in the live
 * namespace the first person who opted in). */
export const EXAMPLE_ROWER = 1;
/* Board depth, the same five the front page prints. */
export const TOP = 5;
/* How many of the fastest 5K and 10K rows the board landing names. */
export const FAST = 3;

export type LandingTotals = {
  meters: number;
  seconds: number;
  /* Everyone on the roster — the board's own `people`, rowed or not. */
  rowers: number;
  /* Rowers with a meter on the board in the period (a masked row counts:
   * the blackout hides the number, not the rower). The ROWERS figure on
   * the fold. */
  active: number;
  finished: number;
  sessions: number;
};

/* ONE MONTH OF EVERYONE'S METERS, a number a day (owner, 2026-10-01: "the
 * month diagram — how many meters have been logged every day of the month
 * … and then allow users to see the previous months with a selector").
 * Every month so far rides to the browser with the page — it is one number
 * per day — so the month word swaps the calendar with no fetch. The
 * figures are the PUBLIC board's (boardData): community sums, which the
 * blackout never hides, and a rower count that counts a masked rower as a
 * rower. */
export type LandingMonth = {
  /* "2026-10" */
  key: string;
  /* "October 2026" */
  label: string;
  /* Weekday of the 1st, 0 = Sunday. */
  firstDow: number;
  days: number;
  /* Days of it that have happened: today's day number in the month the
   * clock is in, every day of a past one. */
  elapsed: number;
  /* Everyone's meters on day d at index d-1; a day still to come is 0. */
  byDay: number[];
  meters: number;
  /* Rowers with a meter in it. */
  rowers: number;
};

export type LandingExample = {
  name: string;
  rowerNumber: number;
  meters: number;
  sessions: number;
  /* THE MONTH THE CARDS ARE OF: this one once the example rower has a row
   * in it, else the last month they rowed (owner, 2026-10-01: "right now
   * we're only showing one card for some reason" — on the 1st the example
   * had no October meter yet, so the section fell back to the bare mark,
   * one tile). `monthWord` is "September"; `thisMonth` says whether the
   * page needs to print it. */
  monthKey: string;
  monthWord: string;
  thisMonth: boolean;
  /* Meters per day that month — the calendar. */
  byDay: Record<string, number>;
  /* The running average split after each timed row — the pace line and
   * the dots, built the way the profile builds them. */
  paceCurve: PacePoint[];
  paceDots: PaceDot[];
  /* The four bests with their division placement chips. */
  bests: ProfileBest[];
  /* What the share dialog would draw for them — the cards on the page. */
  share: ShareData;
};

export type LandingData = {
  month: LandingTotals;
  all: LandingTotals;
  /* Days of the month gone, for the calendar. */
  today: number;
  /* A blackout window is open: the elite are unranked and the top fives
   * are not printed at all (blackoutRules.ts, the PLACES half). */
  hidden: boolean;
  hiddenLabel: string;
  topMen: TotalRow[];
  topWomen: TotalRow[];
  fastest5k: RecordRow[];
  fastest10k: RecordRow[];
  /* The number the next rower to opt in is handed (the join route hands
   * out the highest there is, plus one). Null until somebody has one. */
  nextNumber: number | null;
  example: LandingExample | null;
  /* Every month so far, oldest first — THE MONTH calendar. */
  months: LandingMonth[];
};

const EMPTY_TOTALS: LandingTotals = { meters: 0, seconds: 0, rowers: 0, active: 0, finished: 0, sessions: 0 };

export const EMPTY_LANDING: LandingData = {
  month: EMPTY_TOTALS,
  all: EMPTY_TOTALS,
  today: 1,
  hidden: false,
  hiddenLabel: ELITE_LABEL,
  topMen: [],
  topWomen: [],
  fastest5k: [],
  fastest10k: [],
  nextNumber: null,
  example: null,
  months: [],
};

const activeOf = (rows: { meters: number; masked?: boolean }[]): number =>
  rows.filter((r) => r.meters > 0 || r.masked).length;

function totalsOf(b: {
  total: { meters: number; masked?: boolean }[];
  community: { meters: number; seconds: number; people: number; finished: number; sessions: number };
}): LandingTotals {
  const c = b.community;
  return { meters: c.meters, seconds: c.seconds, rowers: c.people, active: activeOf(b.total), finished: c.finished, sessions: c.sessions };
}

/* A month of the public board as the calendar wants it. The board carries
 * the community curve (cumulative, one point per day with a row); the
 * calendar wants each day's own total. A day past today stays 0 whatever
 * the rows say: only a seeded demo month has rows dated ahead of the clock. */
function monthOfBoard(m: Month, b: Boards, elapsed: number): LandingMonth {
  const byDay: number[] = Array.from({ length: m.days }, () => 0);
  let prev = 0;
  for (const d of b.daily) {
    const day = d.day.slice(0, 7) === m.key ? Number(d.day.slice(8, 10)) : 0;
    if (day >= 1 && day <= elapsed) byDay[day - 1] = Math.max(0, d.cum - prev);
    prev = d.cum;
  }
  return {
    key: m.key,
    label: m.label,
    firstDow: m.firstDow,
    days: m.days,
    elapsed,
    byDay,
    meters: b.community.meters,
    rowers: activeOf(b.total),
  };
}

export async function loadLanding(): Promise<LandingData> {
  const now = nowMs();
  let out: LandingData = { ...EMPTY_LANDING, today: daysElapsed(now) };
  try {
    /* Every month so far, oldest first; the last is the one the clock is
     * in. Each is the public board for that month — the read the stats
     * page makes for a stranger — so a month before this one costs one
     * more filter over the cached rows. */
    const calendar = monthsThrough(now);
    const past = calendar.filter((m) => m.key !== MONTH.key);
    const [month, all, ...pastBoards] = await Promise.all([
      boardData(),
      boardData(allTime(now)),
      ...past.map((m) => boardData(m)),
    ]);
    const boardOf = new Map<string, Boards>(past.map((m, i) => [m.key, pastBoards[i]]));
    boardOf.set(MONTH.key, month);
    const hidden = month.total.some((r) => r.unranked);
    const onBoard = hidden ? [] : month.total.filter((r) => r.meters > 0 || r.masked);
    const top = all.total.reduce((n, r) => Math.max(n, r.rowerNumber), 0);
    out = {
      ...out,
      month: totalsOf(month),
      all: totalsOf(all),
      nextNumber: top > 0 ? top + 1 : null,
      hidden,
      topMen: onBoard.filter((r) => r.division === "M").slice(0, TOP),
      topWomen: onBoard.filter((r) => r.division === "F").slice(0, TOP),
      fastest5k: month.fastest[5000].slice(0, FAST),
      fastest10k: month.fastest[10000].slice(0, FAST),
      months: calendar.flatMap((m) => {
        const b = boardOf.get(m.key);
        return b ? [monthOfBoard(m, b, m.key === MONTH.key ? daysElapsed(now) : m.days)] : [];
      }),
    };

    // The example: rower 001's month, real numbers — unless the public
    // board has them masked or unranked right now, in which case the strip
    // stays off the page rather than print a hidden rower's truth.
    //
    // WHICH MONTH (2026-10-01): this one once they have a meter in it, else
    // the newest month before it that they rowed and are in plain sight
    // on. On the 1st nobody has an October row yet — the example had none,
    // and the section drew the bare mark, one tile, where the cards go.
    // September's cards are real cards.
    const rower = await getRower(EXAMPLE_ROWER);
    const shown = rower
      ? [...calendar].reverse().find((m) => {
          const r = boardOf.get(m.key)?.total.find((t) => t.participantId === rower.participant.id);
          return !!r && !r.masked && !r.unranked && r.meters > 0;
        })
      : undefined;
    const board = shown ? boardOf.get(shown.key) : undefined;
    if (rower && shown && board) {
      const { participant: p } = rower;
      const entries = rower.entries.filter((e) => e.day >= shown.firstDay && e.day <= shown.lastDay);
      const b = computeBoards([p], entries);
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
      /* THIS ROW, the card a rower posts straight after one: their newest
       * timed row of the month (cards.ts rowtember-row). Real numbers — the
       * rower is in plain sight on this board, and the row is on their
       * profile and in the feed. */
      const last = [...entries].reverse().find((e) => e.meters > 0 && e.seconds > 0);
      out.example = {
        name: p.displayName,
        rowerNumber: p.rowerNumber,
        meters: b.total[0]?.meters ?? 0,
        sessions: b.total[0]?.sessions ?? 0,
        monthKey: shown.key,
        monthWord: shown.label.split(" ")[0],
        thisMonth: shown.key === MONTH.key,
        byDay,
        paceCurve,
        paceDots,
        bests: buildBests({ p, boards: b, records, masked: false }),
        share: {
          ...buildShareData({
            p,
            boards: b,
            byDay,
            period: shown,
            rank: divisionRank(board, p.id),
            records,
            masked: false,
            shareElite: false,
            race: undefined,
          }),
          row: last ? { day: last.day, meters: last.meters, seconds: last.seconds, title: last.title || undefined } : null,
        },
      };
    }
  } catch (err) {
    console.error("row100k landing: failed to load", err);
  }
  return out;
}
