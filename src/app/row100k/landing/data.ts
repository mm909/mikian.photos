import { ELITE_LABEL } from "@/lib/blackoutRules";
import {
  FIRST_DAY,
  LAST_DAY,
  MONTH,
  computeBoards,
  daysElapsed,
  divisionRank,
  fmtDay,
  nowMs,
  recordPlacements,
  type RecordRow,
  type TotalRow,
} from "@/lib/row100k";
import { allTime } from "@/lib/rowPeriod";
import { boardData } from "../boardData";
import type { PaceDot, PacePoint } from "../r/[num]/looks/PaceCurve";
import type { ProfileBest } from "../r/[num]/looks/view";
import { buildBests, buildShareData, getRower } from "../r/[num]/shareData";
import type { ShareData } from "../share/cards";

/* ONE LOADER for the three signed-out landings (owner, 2026-09-25: "three
 * different landing pages designed at getting user sign ups — lean into
 * the stats we collect, the long-term logging and progress, some of the
 * leaderboards, the shareables"). Everything a stranger may see: the
 * PUBLIC board (boardData — the blackout already applied), this month and
 * all time, and one real rower's month as the example of what a profile
 * holds. Fails open to EMPTY_LANDING so the page always renders. */

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
  rowers: number;
  finished: number;
  sessions: number;
};

export type LandingExample = {
  name: string;
  rowerNumber: number;
  meters: number;
  sessions: number;
  /* Meters per day this month — the calendar. */
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
  example: LandingExample | null;
};

const EMPTY_TOTALS: LandingTotals = { meters: 0, seconds: 0, rowers: 0, finished: 0, sessions: 0 };

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
  example: null,
};

function totalsOf(c: { meters: number; seconds: number; people: number; finished: number; sessions: number }): LandingTotals {
  return { meters: c.meters, seconds: c.seconds, rowers: c.people, finished: c.finished, sessions: c.sessions };
}

export async function loadLanding(): Promise<LandingData> {
  const now = nowMs();
  let out: LandingData = { ...EMPTY_LANDING, today: daysElapsed(now) };
  try {
    const [month, all] = await Promise.all([boardData(), boardData(allTime(now))]);
    const hidden = month.total.some((r) => r.unranked);
    const onBoard = hidden ? [] : month.total.filter((r) => r.meters > 0 || r.masked);
    out = {
      ...out,
      month: totalsOf(month.community),
      all: totalsOf(all.community),
      hidden,
      topMen: onBoard.filter((r) => r.division === "M").slice(0, TOP),
      topWomen: onBoard.filter((r) => r.division === "F").slice(0, TOP),
      fastest5k: month.fastest[5000].slice(0, FAST),
      fastest10k: month.fastest[10000].slice(0, FAST),
    };

    // The example: rower 001's month, real numbers — unless the public
    // board has them masked or unranked right now, in which case the strip
    // stays off the page rather than print a hidden rower's truth.
    const rower = await getRower(EXAMPLE_ROWER);
    const pub = rower ? month.total.find((r) => r.participantId === rower.participant.id) : undefined;
    if (rower && pub && !pub.masked && !pub.unranked && pub.meters > 0) {
      const { participant: p } = rower;
      const entries = rower.entries.filter((e) => e.day >= FIRST_DAY && e.day <= LAST_DAY);
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
      const records = recordPlacements(month, p.id, 10);
      out.example = {
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
          period: MONTH,
          rank: divisionRank(month, p.id),
          records,
          masked: false,
          shareElite: false,
          race: undefined,
        }),
      };
    }
  } catch (err) {
    console.error("row100k landing: failed to load", err);
  }
  return out;
}
