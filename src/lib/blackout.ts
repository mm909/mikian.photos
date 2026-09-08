import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { CHALLENGE, CHALLENGE_DEMO, nowMs } from "@/lib/row100k";
import { PACIFIC_SHIFT_MS } from "@/lib/blackoutRules";

/* Blackout windows — the server half. Which window (if any) is open right
 * now decides whether boardView hides THE ELITE (blackoutRules.ts).
 *
 * The windows are read through their own cache tag, separate from the
 * board's: the board does not change when a blackout is set, and the
 * public page is force-dynamic anyway, so a save on /row100k/blackout
 * revalidates this tag and the very next request masks (or unmasks). The
 * 60s backstop covers a window's edge crossing on its own.
 *
 * Everything here fails OPEN to "no blackout": the table may not have been
 * pushed yet (the owner runs prisma db push on their own say-so), and a db
 * hiccup must never 500 the board. */

export const BLACKOUT_TAG = "row100k-blackout";

export type BlackoutWindow = {
  id: string;
  /* UTC instants as ISO strings — plain JSON, safe for client props. */
  startsAt: string;
  endsAt: string;
  /* The run-up: for this many days before startsAt the elite lose one
   * more digit of their total a day, from the ones up. 0 = no run-up. */
  rampDays: number;
  reason: string;
  createdBy: string;
  createdAt: string;
};

export type BlackoutState = {
  active: boolean;
  startsAt?: string;
  endsAt?: string;
  /* The run-up (owner, 2026-09-06): how many low digits of the elite's
   * totals are covered right now. Only ever set while `active` is false —
   * once the window opens the whole number goes. */
  hideLow?: number;
  /* How many days of run-up are left, for the copy ("1 DIGIT A DAY UNTIL
   * SEP 12"). Set alongside hideLow. */
  rampDaysLeft?: number;
};

const toWindow = (w: {
  id: string;
  startsAt: Date;
  endsAt: Date;
  rampDays?: number | null;
  reason: string;
  createdBy: string;
  createdAt: Date;
}): BlackoutWindow => ({
  id: w.id,
  startsAt: w.startsAt.toISOString(),
  endsAt: w.endsAt.toISOString(),
  rampDays: Math.max(0, Math.floor(w.rampDays ?? 0)),
  reason: w.reason,
  createdBy: w.createdBy,
  createdAt: w.createdAt.toISOString(),
});

/* Which Pacific day an instant falls on, as a plain counter — the same
 * fixed UTC-7 the rest of the challenge uses (daysElapsed, fmtPacificDay),
 * never a real time zone. Only differences of these are used. */
const DAY_MS = 86_400_000;
function pacificDayIndex(ms: number): number {
  return Math.floor((ms - PACIFIC_SHIFT_MS) / DAY_MS);
}

/* The run-up, in digits, for one window at one instant. With rampDays = 4
 * and the window opening Sep 12: Sep 8 covers the ones, Sep 9 the tens,
 * Sep 10 the hundreds, Sep 11 the thousands, and Sep 12 opens the window
 * and covers the rest. Returns 0 when the day is outside the run-up. */
export function rampDigitsAt(startsAtMs: number, rampDays: number, atMs: number): number {
  if (!(rampDays > 0) || !Number.isFinite(startsAtMs) || atMs >= startsAtMs) return 0;
  const daysUntil = pacificDayIndex(startsAtMs) - pacificDayIndex(atMs);
  if (daysUntil <= 0 || daysUntil > rampDays) return 0;
  return rampDays - daysUntil + 1;
}

/* Every window for the namespace, newest start first. The admin page reads
 * this uncached (it is force-dynamic and wants the truth right after a
 * write); errors propagate so the page can say the table is missing. */
export async function listBlackouts(): Promise<BlackoutWindow[]> {
  const rows = await db.rowBlackout.findMany({
    where: { challenge: CHALLENGE },
    orderBy: { startsAt: "desc" },
  });
  return rows.map(toWindow);
}

/* The cached read keeps the WHOLE list rather than "active at time t" — a
 * time argument would be a new cache key every millisecond — and the
 * active check happens in-process against nowMs(). The list is a handful
 * of rows at most. */
const loadWindows = (): Promise<BlackoutWindow[]> => listBlackouts();

const getWindows = unstable_cache(loadWindows, [BLACKOUT_TAG], {
  revalidate: 60,
  tags: [BLACKOUT_TAG],
});

/* After a failed lookup, stop asking for a minute. unstable_cache does not
 * cache a throw, and boardData() (which the landing page's meters endpoint
 * polls) now reads the windows on every call — before the table is pushed
 * that would be a failing query and a logged error per poll. */
const QUIET_MS = 60_000;
let quietUntil = 0;

/* Is a blackout open at `atMs`? Never throws. Demo namespace skips the cache
 * for the same reason boardData does (nothing external revalidates it). */
export async function activeBlackout(atMs = nowMs()): Promise<BlackoutState> {
  if (atMs < quietUntil) return { active: false };
  try {
    const windows = await (CHALLENGE === CHALLENGE_DEMO ? loadWindows() : getWindows());
    const open = windows.find((w) => {
      const s = Date.parse(w.startsAt);
      const e = Date.parse(w.endsAt);
      return Number.isFinite(s) && Number.isFinite(e) && s <= atMs && atMs < e;
    });
    if (open) return { active: true, startsAt: open.startsAt, endsAt: open.endsAt };
    // No window open: the deepest run-up any coming window asks for wins,
    // so two overlapping run-ups can only ever cover more, never less.
    let best: { hideLow: number; startsAt: string; endsAt: string; daysLeft: number } | null = null;
    for (const w of windows) {
      const s = Date.parse(w.startsAt);
      const hide = rampDigitsAt(s, w.rampDays, atMs);
      if (hide > 0 && (!best || hide > best.hideLow)) {
        best = {
          hideLow: hide,
          startsAt: w.startsAt,
          endsAt: w.endsAt,
          daysLeft: pacificDayIndex(s) - pacificDayIndex(atMs),
        };
      }
    }
    return best
      ? {
          active: false,
          startsAt: best.startsAt,
          endsAt: best.endsAt,
          hideLow: best.hideLow,
          rampDaysLeft: best.daysLeft,
        }
      : { active: false };
  } catch (err) {
    quietUntil = atMs + QUIET_MS;
    console.error("row100k: blackout lookup failed, treating as none", err);
    return { active: false };
  }
}
