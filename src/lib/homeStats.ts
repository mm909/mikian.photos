import { unstable_cache } from "next/cache";
import { boardData, EMPTY_BOARDS } from "@/app/row100k/boardData";
import { db } from "@/lib/db";
import {
  CHALLENGE,
  CHALLENGE_DEMO,
  START_MS,
  END_MS,
  LOG_CLOSE_MS,
  nowMs,
  splitSeconds,
  type Boards,
} from "@/lib/row100k";

/* The landing page counter: how many meters everyone has rowed in
 * Rowtember, plus what the client needs to keep the number moving between
 * server syncs — a rate, the shape of the field's pace, and the wall-clock
 * instant the number was true.
 * Served by the root page (first paint) and GET /api/home/meters (polls). */

export type MeterSnapshot = {
  /* Community totals off the cached board (fresh-on-write, 5 min backstop). */
  meters: number;
  rowers: number;
  sessions: number;
  finished: number;
  /* Meters per second of the whole challenge so far. The wheels no longer
   * advance at this rate (they tick at a drawn split, see useLiveMeters);
   * it still bounds how far the display may run ahead of the board and,
   * at 0 outside Sep 1–30, holds the counter still before the first stroke
   * and after the month is rowed. */
  rate: number;
  /* The field's pace, seconds per 500 m, as mean and population SD over
   * every logged row: the client draws a split from this distribution and
   * ticks one meter every split/500 s, the way a Concept2 monitor counts
   * up (owner's call, 2026-09-05). splitN says how many rows shaped it —
   * under SPLIT_MIN_N the numbers are the SPLIT_FALLBACK defaults. */
  splitMean: number;
  splitSd: number;
  splitN: number;
  /* Date.now() when this snapshot was built — for reading the feed by eye.
   * The client anchors on its own clock (see useLiveMeters), never on this. */
  at: number;
  phase: "before" | "open" | "closed";
  /* September days still to come after today: 30 - day (0 on Sep 30 and
   * after), so it reads consistently next to "day N of 30". */
  daysLeft: number;
  /* Day of September, 1–30 (0 before the start, 30 after). */
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

/* Last community totals this process read successfully. A board failure
 * (the tag was just revalidated and the DB is down, a cold start mid-outage)
 * serves these instead of zeros, so an outage never paints 00,000,000. */
let lastGood: Boards["community"] | null = null;
/* Same idea for the pace: a failed read keeps the last real distribution,
 * and before there is one, the fallback. A pace hiccup never fails the
 * snapshot — the total is still true, only the tick rhythm is a guess. */
let lastGoodSplit: SplitStats = SPLIT_FALLBACK;

export async function meterSnapshot(): Promise<MeterSnapshot> {
  let community = lastGood ?? EMPTY_BOARDS.community;
  let ok = true;
  const [board, split] = await Promise.allSettled([boardData(), splitStats()]);
  if (board.status === "fulfilled") {
    community = board.value.community;
    lastGood = community;
  } else {
    ok = false;
    console.error("home: failed to load board data", board.reason);
  }
  if (split.status === "fulfilled") {
    lastGoodSplit = split.value;
  } else {
    console.error("home: failed to load split stats", split.reason);
  }

  const now = nowMs();
  const phase = now < START_MS ? "before" : now >= LOG_CLOSE_MS ? "closed" : "open";
  const rowing = now >= START_MS && now < END_MS;
  // Floor the elapsed window at an hour so the first minutes of Sep 1 can
  // never produce an absurd pace off a handful of rows.
  const elapsedSec = Math.max(3600, (Math.min(now, END_MS) - START_MS) / 1000);
  const rate = rowing && community.meters > 0 ? community.meters / elapsedSec : 0;

  const day = Math.min(30, Math.max(0, Math.floor((now - START_MS) / DAY_MS) + 1));

  return {
    meters: community.meters,
    rowers: community.people,
    sessions: community.sessions,
    finished: community.finished,
    rate,
    ...lastGoodSplit,
    at: Date.now(),
    phase,
    daysLeft: Math.max(0, 30 - day),
    day,
    ok,
  };
}
