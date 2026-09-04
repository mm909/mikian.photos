import { boardData, EMPTY_BOARDS } from "@/app/row100k/boardData";
import { START_MS, END_MS, LOG_CLOSE_MS, nowMs, type Boards } from "@/lib/row100k";

/* The landing page counter: how many meters everyone has rowed in
 * Rowtember, plus what the client needs to keep the number moving between
 * server syncs — a rate, and the wall-clock instant the number was true.
 * Served by the root page (first paint) and GET /api/home/meters (polls). */

export type MeterSnapshot = {
  /* Community totals off the cached board (fresh-on-write, 5 min backstop). */
  meters: number;
  rowers: number;
  sessions: number;
  finished: number;
  /* Meters per second the display advances between syncs — the average pace
   * of the whole challenge so far. 0 outside Sep 1–30, so the counter holds
   * still before the first stroke and after the month is rowed. */
  rate: number;
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

const DAY_MS = 86_400_000;

/* Last community totals this process read successfully. A board failure
 * (the tag was just revalidated and the DB is down, a cold start mid-outage)
 * serves these instead of zeros, so an outage never paints 00,000,000. */
let lastGood: Boards["community"] | null = null;

export async function meterSnapshot(): Promise<MeterSnapshot> {
  let community = lastGood ?? EMPTY_BOARDS.community;
  let ok = true;
  try {
    community = (await boardData()).community;
    lastGood = community;
  } catch (err) {
    ok = false;
    console.error("home: failed to load board data", err);
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
    at: Date.now(),
    phase,
    daysLeft: Math.max(0, 30 - day),
    day,
    ok,
  };
}
