import {
  MONTH,
  TIERS,
  computeBoards,
  daysElapsed,
  divisionRank,
  fmtDay,
  nowMs,
  pacificDay,
  recordPlacements,
  type Boards,
  type TotalRow,
} from "@/lib/row100k";
import { FIRST_MONTH_KEY, inPeriod, prevMonth, type Month } from "@/lib/rowPeriod";
import { boardData, boardDataRaw } from "../boardData";
import { EXAMPLE_ROWER, TOP, type LandingData, type LandingExample } from "../landing/data";
import type { PaceDot, PacePoint } from "../r/[num]/looks/PaceCurve";
import { buildBests, buildShareData, getRower } from "../r/[num]/shareData";

/* LANDING 3, THE PROOF: what the page prints beyond the shared loader
 * (landing/data.ts). The fold is LAST MONTH in three numbers, so this reads
 * the board of prevMonth(MONTH) the way the records page reads any period
 * (boardData(period) — the public board, the blackout already applied) and
 * counts it. If there is no last month (the first month there was) or
 * nobody rowed in it, the proof falls back to this month so far.
 *
 * Two boards per month are read on purpose:
 *   - the PUBLIC one (boardData) for every row that is printed by name: the
 *     top fives and the example rower;
 *   - the raw one (boardDataRaw) for COUNTS only — how many rowed, how many
 *     passed each rung. During a blackout run-up the public rows of the
 *     elite are rounded down and would fall off a rung they really passed;
 *     a count names nobody, and it is the same kind of figure the board
 *     already publishes as community.finished. No raw row leaves this file.
 * Fails open: a board that cannot be read gives an empty proof and the page
 * still renders. */

/* The rungs the ladder always draws; one above them is drawn only once
 * somebody is on it (the site never names a rung nobody has reached). */
const RUNG_TOP = 250_000;

export type ProofRung = { meters: number; label: string; count: number };

export type ProofMonth = {
  key: string;
  /* "September 2026" / "September" / "SEP" */
  label: string;
  word: string;
  short: string;
  days: number;
  firstDow: number;
  /* Rowers with at least one meter in the month. */
  rowers: number;
  meters: number;
  finished: number;
  sessions: number;
  rungs: ProofRung[];
  /* A blackout window is open: the top fives are not printed. */
  hidden: boolean;
  topMen: TotalRow[];
  topWomen: TotalRow[];
};

export type ProofExample = LandingExample & {
  /* The month the calendar draws, and how many of its days to draw. */
  month: { key: string; firstDow: number; days: number };
  monthLabel: string;
  shown: number;
};

export type ProofData = {
  /* The month the three numbers are about. */
  proof: ProofMonth | null;
  /* True when that is last month and its late logs are shut: FINAL. */
  final: boolean;
  /* "OCT 3" — the last day a late log for it is taken, while not final. */
  closesTag: string;
  /* True when the proof IS this month (no last month to show). */
  fallback: boolean;
  /* This month so far; null when the proof already is this month. */
  now: ProofMonth | null;
  /* Day of the month, and the days still to row (today included). */
  day: number;
  left: number;
  /* The number the next rower to opt in is handed. */
  nextNumber: number | null;
  example: ProofExample | null;
};

const kLabel = (m: number) => `${Math.round(m / 1000)}K`;

function countMonth(m: Month, raw: Boards, pub: Boards): ProofMonth {
  const rowed = raw.total.filter((r) => r.meters > 0);
  const hidden = pub.total.some((r) => r.unranked);
  const onBoard = hidden ? [] : pub.total.filter((r) => r.meters > 0 || r.masked);
  return {
    key: m.key,
    label: m.label,
    word: m.label.split(" ")[0],
    short: m.short,
    days: m.days,
    firstDow: m.firstDow,
    rowers: rowed.length,
    meters: raw.community.meters,
    finished: raw.community.finished,
    sessions: raw.community.sessions,
    rungs: TIERS.map((t) => ({
      meters: t.meters,
      label: kLabel(t.meters),
      count: rowed.filter((r) => r.meters >= t.meters).length,
    })).filter((r) => r.meters <= RUNG_TOP || r.count > 0),
    hidden,
    topMen: onBoard.filter((r) => r.division === "M").slice(0, TOP),
    topWomen: onBoard.filter((r) => r.division === "F").slice(0, TOP),
  };
}

/* The example rower's LAST month, built the way landing/data.ts builds this
 * month's: their own rows of that period, real numbers — unless the public
 * board has them hidden or rounded right now, in which case there is no
 * example rather than a hidden rower's truth. */
async function exampleFor(m: Month, pub: Boards): Promise<ProofExample | null> {
  const rower = await getRower(EXAMPLE_ROWER);
  const row = rower ? pub.total.find((r) => r.participantId === rower.participant.id) : undefined;
  if (!rower || !row || row.masked || row.unranked || row.hideLow || !(row.meters > 0)) return null;
  const { participant: p } = rower;
  const entries = rower.entries.filter((e) => inPeriod(e.day, m));
  const b = computeBoards([p], entries, m.lastDay);
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
  const records = recordPlacements(pub, p.id, 10);
  return {
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
      period: m,
      rank: divisionRank(pub, p.id),
      records,
      masked: false,
      shareElite: false,
      race: undefined,
    }),
    month: { key: m.key, firstDow: m.firstDow, days: m.days },
    monthLabel: m.label,
    shown: m.days,
  };
}

export async function loadProof(data: LandingData): Promise<ProofData> {
  const now = nowMs();
  const day = daysElapsed(now);
  const out: ProofData = {
    proof: null,
    final: false,
    closesTag: "",
    fallback: true,
    now: null,
    day,
    left: MONTH.days - day + 1,
    nextNumber: null,
    example: null,
  };
  try {
    const [rawNow, pubNow] = await Promise.all([boardDataRaw(), boardData()]);
    const thisMonth = countMonth(MONTH, rawNow, pubNow);
    // Every board lists every participant, so the highest number handed out
    // is on this one; the join route hands out the next (row100kJoin.ts).
    out.nextNumber = rawNow.total.reduce((mx, r) => Math.max(mx, r.rowerNumber), 0) + 1;

    const prev = prevMonth(MONTH);
    let last: ProofMonth | null = null;
    if (prev.key >= FIRST_MONTH_KEY) {
      const [rawPrev, pubPrev] = await Promise.all([boardDataRaw(prev), boardData(prev)]);
      const counted = countMonth(prev, rawPrev, pubPrev);
      if (counted.rowers > 0) {
        last = counted;
        try {
          out.example = await exampleFor(prev, pubPrev);
        } catch (err) {
          console.error("row100k landing 3: failed to build the example", err);
        }
      }
    }

    if (last) {
      out.proof = last;
      out.fallback = false;
      out.now = thisMonth;
      out.final = now >= prev.logCloseMs;
      out.closesTag = fmtDay(pacificDay(prev.logCloseMs - 1)).toUpperCase();
    } else {
      out.proof = thisMonth;
    }
    // No last-month example (first month, or the rower is hidden): this
    // month's, off the shared loader.
    if (!out.example && data.example) {
      out.example = {
        ...data.example,
        month: { key: MONTH.key, firstDow: MONTH.firstDow, days: MONTH.days },
        monthLabel: MONTH.label,
        shown: data.today,
      };
    }
  } catch (err) {
    console.error("row100k landing 3: failed to load the proof", err);
  }
  return out;
}
