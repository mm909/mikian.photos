import { unstable_cache } from "next/cache";
import { boardData, EMPTY_BOARDS } from "@/app/row100k/boardData";
import { db } from "@/lib/db";
import {
  CHALLENGE,
  CHALLENGE_DEMO,
  GOAL_METERS,
  START_MS,
  END_MS,
  LOG_CLOSE_MS,
  FIRST_DAY,
  nowMs,
  splitSeconds,
  type Boards,
  MONTH_DAYS,
} from "@/lib/row100k";
import { allTime } from "@/lib/rowPeriod";

/* The landing page counter: how many meters everyone has rowed, EVER,
 * plus what the client needs to keep the number moving between server
 * syncs — a rate, the shape of the field's pace, and the wall-clock
 * instant the number was true.
 *
 * ALL TIME since 2026-09-25 (owner: "I want the counter on the
 * mikianmusser.com page to be the CUMULATIVE count of meters for everyone
 * (all time, every month), still incrementing live"). Until then the
 * snapshot was the month the clock was in; the Rowtember front page has
 * its own month counter now and nothing else reads this, so the meaning
 * could change under the same shape. The four figures under the wheels
 * changed with it: rowers in, rows, time rowed, 100K finishers.
 *
 * Served by the root page (first paint) and GET /api/home/meters (polls). */

export type MeterSnapshot = {
  /* Every meter ever logged, off the cached all-time board (fresh-on-write,
   * 5 min backstop). */
  meters: number;
  /* Distinct rowers with at least one row, ever — not everyone who opted
   * in. A name on the list with no meters is not a rower in yet. */
  rowers: number;
  /* Every row ever logged. */
  sessions: number;
  /* Every logged second, all rowers, all months. Optional only so a still
   * snapshot built elsewhere (row100k/page.tsx) need not carry it; the
   * client reads it as 0 when absent. */
  seconds?: number;
  /* 100K FINISHES, counted PER MONTH: the number of rower-months at or
   * over 100,000 m. A rower who did it in three months counts three times
   * (owner, 2026-09-25: "the 100K finisher number should count finishers
   * PER MONTH: if the same rower does it in two months, that counts
   * twice"); 100K spread over two months does not count — the month is the
   * unit the site keeps score in. */
  finished: number;
  /* Meters per second RECENTLY: this month's meters over the seconds the
   * month has run, so the tempo model keeps the feel it had when the
   * counter was monthly (the lead cap in useLiveMeters is an hour of it,
   * clamped). Until the month's first row lands it is the all-time
   * average, so the wheels never freeze at a month boundary; 0 only when
   * nothing has ever been rowed. The wheels do not advance at this rate
   * (they tick at a fixed split, see useLiveMeters); it bounds how far the
   * display may run ahead of the board, and at 0 holds it still. */
  rate: number;
  /* The field's pace, seconds per 500 m, as mean and population SD over
   * every logged row. The client used to draw its split from this
   * (2026-09-05); since 2026-09-16 the wheels tick at a fixed 1:59.9
   * (FIXED_SPLIT_S in useLiveMeters) and these no longer touch the tempo —
   * still served for the feed and anyone reading it by eye. splitN says
   * how many rows shaped it — under SPLIT_MIN_N the numbers are the
   * SPLIT_FALLBACK defaults. */
  splitMean: number;
  splitSd: number;
  splitN: number;
  /* Date.now() when this snapshot was built — for reading the feed by eye.
   * The client anchors on its own clock (see useLiveMeters), never on this. */
  at: number;
  /* Where the month the clock is in stands. Under a month-based clock
   * (MONTH is the month of nowMs()) this is "open" for the life of the
   * process; "before" and "closed" survive for a process that lived across
   * a month boundary and for the old fixed-September readers. */
  phase: "before" | "open" | "closed";
  /* No longer computed or shown (owner, 2026-09-25: the counter is all
   * time, "no days left needed"). Optional so a still snapshot built
   * elsewhere may carry it. */
  daysLeft?: number;
  /* Day of the month the clock is in, 1..MONTH_DAYS — the dateline. */
  day: number;
  /* False when the board could not be read: the totals are the last ones
   * this process served (zeros on a cold start), NOT a real zero. The feed
   * answers 503 on it and the client keeps rolling on what it already has;
   * the page still renders rather than erroring. */
  ok: boolean;
};

export type SplitStats = Pick<MeterSnapshot, "splitMean" | "splitSd" | "splitN">;

const DAY_MS = 86_400_000;

/* A 2:10 /500 m field with a modest spread — what the wheels tick at until
 * enough real rows have landed to say otherwise. */
const SPLIT_FALLBACK: SplitStats = { splitMean: 130, splitSd: 12, splitN: 0 };
const SPLIT_MIN_N = 5;
/* Rows outside this split band are not a pace anyone rows a counter at:
 * a 1:00 split is a typo or a sprint fragment, a 10:00 split is a paddle
 * with the clock left running. Same floor as the write-time validation
 * (SPLIT_MIN), a tighter ceiling than its 15:00 so one walk-pace row cannot
 * drag the wheels. */
const SPLIT_LO = 60;
const SPLIT_HI = 600;
/* Under 500 m there is not a whole split to measure. */
const SPLIT_MIN_METERS = 500;

const loadSplitStats = async (): Promise<SplitStats> => {
  const rows = await db.rowEntry.findMany({
    where: { challenge: CHALLENGE, meters: { gte: SPLIT_MIN_METERS } },
    select: { meters: true, seconds: true },
  });
  const splits: number[] = [];
  for (const r of rows) {
    const s = splitSeconds(r.meters, r.seconds);
    if (s >= SPLIT_LO && s <= SPLIT_HI) splits.push(s);
  }
  const n = splits.length;
  if (n < SPLIT_MIN_N) return { ...SPLIT_FALLBACK, splitN: n };
  const mean = splits.reduce((a, s) => a + s, 0) / n;
  // Population SD: these are all the rows there are, not a sample of them.
  const sd = Math.sqrt(splits.reduce((a, s) => a + (s - mean) * (s - mean), 0) / n);
  return { splitMean: mean, splitSd: sd, splitN: n };
};

/* Same tag as the board so a logged row refreshes the pace along with the
 * total; a longer backstop because the distribution barely moves per row. */
const getSplitStats = unstable_cache(loadSplitStats, ["row100k-split-stats"], {
  revalidate: 600,
  tags: ["row100k-boards"],
});

/* The demo namespace skips the cache for the same reason boardData does:
 * reseeding happens outside the app, so nothing would revalidate it. */
const splitStats = () => (CHALLENGE === CHALLENGE_DEMO ? loadSplitStats() : getSplitStats());

/* 100K FINISHERS, all time, PER MONTH: how many rower-months closed at
 * 100,000 m or more. One pass over every row — participant and month (the
 * day key's YYYY-MM) sum to a per-month total, and every month over the
 * line counts, so a rower who did it twice is two finishes (owner,
 * 2026-09-25; until then a rower counted once however many months). Cheaper
 * than a board per month (monthsThrough × computeBoards) and it never grows
 * with the calendar. Only rows of rowers still on the list count, like the
 * board. */
const loadFinishers = async (): Promise<number> => {
  const [participants, entries] = await Promise.all([
    db.rowParticipant.findMany({ where: { challenge: CHALLENGE }, select: { id: true } }),
    db.rowEntry.findMany({
      where: { challenge: CHALLENGE },
      select: { participantId: true, day: true, meters: true },
    }),
  ]);
  const known = new Set(participants.map((p) => p.id));
  const perMonth = new Map<string, number>();
  for (const e of entries) {
    if (!known.has(e.participantId)) continue;
    const k = `${e.participantId}|${e.day.slice(0, 7)}`;
    perMonth.set(k, (perMonth.get(k) ?? 0) + e.meters);
  }
  let done = 0;
  for (const m of perMonth.values()) if (m >= GOAL_METERS) done += 1;
  return done;
};

/* Same tag as the board: a logged row that tips a month over 100K shows
 * up with the total. Same five-minute backstop. */
const getFinishers = unstable_cache(loadFinishers, ["row100k-finishers"], {
  revalidate: 300,
  tags: ["row100k-boards"],
});

const finishers = () => (CHALLENGE === CHALLENGE_DEMO ? loadFinishers() : getFinishers());

/* Last community totals this process read successfully. A board failure
 * (the tag was just revalidated and the DB is down, a cold start mid-outage)
 * serves these instead of zeros, so an outage never paints 00,000,000. */
type Totals = {
  community: Boards["community"];
  rowers: number;
  /* This month's meters, for the recent rate. */
  monthMeters: number;
};
let lastGood: Totals | null = null;
/* Same idea for the pace: a failed read keeps the last real distribution,
 * and before there is one, the fallback. A pace hiccup never fails the
 * snapshot — the total is still true, only the tick rhythm is a guess. */
let lastGoodSplit: SplitStats = SPLIT_FALLBACK;
/* And for the finishers: a count that could not be read keeps the last
 * one; the total is what the page is for. */
let lastGoodFinished = 0;

/* What the all-time board says: the community sums, how many of its rows
 * have rowed at all, and this month's share of the meters (the board's
 * daily curve is cumulative, so the month is the total less the cumulative
 * total on the last day before the 1st). A masked row (blackout) keeps its
 * session count, so counting rowers by sessions is safe under a window. */
const totalsOf = (board: Boards): Totals => {
  const community = board.community;
  const rowers = board.total.filter((r) => r.sessions > 0).length;
  let before = 0;
  for (const d of board.daily) {
    if (d.day >= FIRST_DAY) break;
    before = d.cum;
  }
  return { community, rowers, monthMeters: Math.max(0, community.meters - before) };
};

export async function meterSnapshot(): Promise<MeterSnapshot> {
  const now = nowMs();
  let totals = lastGood ?? { community: EMPTY_BOARDS.community, rowers: 0, monthMeters: 0 };
  let ok = true;
  const [board, split, done] = await Promise.allSettled([
    boardData(allTime(now)),
    splitStats(),
    finishers(),
  ]);
  if (board.status === "fulfilled") {
    totals = totalsOf(board.value);
    lastGood = totals;
  } else {
    ok = false;
    console.error("home: failed to load board data", board.reason);
  }
  if (split.status === "fulfilled") {
    lastGoodSplit = split.value;
  } else {
    console.error("home: failed to load split stats", split.reason);
  }
  if (done.status === "fulfilled") {
    lastGoodFinished = done.value;
  } else {
    console.error("home: failed to load finishers", done.reason);
  }
  const { community, rowers, monthMeters } = totals;

  const phase = now < START_MS ? "before" : now >= LOG_CLOSE_MS ? "closed" : "open";
  // Floor the elapsed window at an hour so the first minutes of a month
  // can never produce an absurd pace off a handful of rows. The all-time
  // fallback runs from the first month there was (allTime's firstDay is
  // the 1st of it, on the challenge clock) for the same reason.
  const monthSec = Math.max(3600, (Math.min(Math.max(now, START_MS), END_MS) - START_MS) / 1000);
  const firstMs = Date.parse(`${allTime(now).firstDay}T07:00:00Z`);
  const allSec = Math.max(3600, (now - firstMs) / 1000);
  const rate =
    monthMeters > 0 ? monthMeters / monthSec : community.meters > 0 ? community.meters / allSec : 0;

  const day = Math.min(MONTH_DAYS, Math.max(0, Math.floor((now - START_MS) / DAY_MS) + 1));

  return {
    meters: community.meters,
    rowers,
    sessions: community.sessions,
    seconds: community.seconds,
    finished: lastGoodFinished,
    rate,
    ...lastGoodSplit,
    at: Date.now(),
    phase,
    day,
    ok,
  };
}
