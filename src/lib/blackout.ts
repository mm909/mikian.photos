import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { CHALLENGE, CHALLENGE_DEMO, nowMs } from "@/lib/row100k";

/* Blackout windows — the server half. Which window (if any) is open right
 * now decides whether boardView hides THE ELITE FIFTEEN (blackoutRules.ts).
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
  reason: string;
  createdBy: string;
  createdAt: string;
};

export type BlackoutState = {
  active: boolean;
  startsAt?: string;
  endsAt?: string;
};

const toWindow = (w: {
  id: string;
  startsAt: Date;
  endsAt: Date;
  reason: string;
  createdBy: string;
  createdAt: Date;
}): BlackoutWindow => ({
  id: w.id,
  startsAt: w.startsAt.toISOString(),
  endsAt: w.endsAt.toISOString(),
  reason: w.reason,
  createdBy: w.createdBy,
  createdAt: w.createdAt.toISOString(),
});

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
    return open ? { active: true, startsAt: open.startsAt, endsAt: open.endsAt } : { active: false };
  } catch (err) {
    quietUntil = atMs + QUIET_MS;
    console.error("row100k: blackout lookup failed, treating as none", err);
    return { active: false };
  }
}
