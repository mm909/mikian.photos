import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { activeBlackout, type BlackoutState } from "@/lib/blackout";
import { maskBoards } from "@/lib/blackoutRules";
import {
  CHALLENGE,
  CHALLENGE_DEMO,
  computeBoards,
  type Boards as BoardData,
} from "@/lib/row100k";

/* Board data, shared by /row100k and /row100k/stats. The public board is
 * identical for every visitor, so it's computed once and cached; every write
 * route revalidates the tag, so it's fresh-on-write with a time backstop. */

const loadBoardData = async (): Promise<BoardData> => {
  const [participants, entries] = await Promise.all([
    db.rowParticipant.findMany({
      where: { challenge: CHALLENGE },
      select: {
        id: true,
        displayName: true,
        instagram: true,
        division: true,
        rowerNumber: true,
      },
      orderBy: { rowerNumber: "asc" },
    }),
    db.rowEntry.findMany({
      where: { challenge: CHALLENGE },
      select: { participantId: true, day: true, meters: true, seconds: true },
      orderBy: [{ day: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  return computeBoards(participants, entries);
};

const getBoardData = unstable_cache(loadBoardData, ["row100k-boards"], {
  revalidate: 300,
  tags: ["row100k-boards"],
});

/* The board with every real number — the cached truth. Only boardView and
 * admin-only surfaces should read this directly; everything public goes
 * through boardData() below. The seeded demo board skips the cache:
 * reseeding happens outside the app, so nothing revalidates the tag and a
 * stale board survives even a dev-server restart (unstable_cache persists
 * to .next/cache). */
export const boardDataRaw = () =>
  CHALLENGE === CHALLENGE_DEMO ? loadBoardData() : getBoardData();

/* The board as the PUBLIC sees it: during a blackout the top fifteen are
 * already masked (blackoutRules.ts). This is the default on purpose — a
 * page that forgets to think about the blackout gets the safe board, not
 * the leak (review, 2026-09-05: stats, records, partners and the profile
 * page all read the board without a viewer in mind). Pages that know who
 * is looking use boardView and get the self/admin exemptions; nobody else
 * needs them. Identical to boardDataRaw while no window is open. */
export async function boardData(): Promise<BoardData> {
  const [boards, blackout] = await Promise.all([boardDataRaw(), activeBlackout()]);
  return maskBoards(boards, { active: blackout.active, admin: false });
}

/* The board as ONE viewer should see it: the cached board with the blackout
 * applied on the way out (blackoutRules.ts). The mask depends on who is
 * looking — admins and a rower reading their own row keep the numbers — so
 * it can never live inside the cache. Throws only when the board itself
 * fails (callers already fall back to EMPTY_BOARDS); a blackout lookup that
 * fails just means no blackout. */
export async function boardView(opts: {
  viewerParticipantId?: string | null;
  admin?: boolean;
}): Promise<{ boards: BoardData; blackout: BlackoutState }> {
  const [boards, blackout] = await Promise.all([boardDataRaw(), activeBlackout()]);
  return {
    boards: maskBoards(boards, {
      active: blackout.active,
      viewerParticipantId: opts.viewerParticipantId,
      admin: opts.admin,
    }),
    blackout,
  };
}

export const EMPTY_BOARDS: BoardData = {
  total: [],
  fastest: { 5000: [], 10000: [] },
  longest: [],
  bigDay: [],
  daily: [],
  community: {
    meters: 0,
    people: 0,
    sessions: 0,
    finished: 0,
    divisions: {
      M: { meters: 0, people: 0, sessions: 0, finished: 0 },
      F: { meters: 0, people: 0, sessions: 0, finished: 0 },
    },
  },
};

/* ------------------------------------------------------------ front page */

/* What the front page prints that the board itself does not carry: the
 * time everyone has spent rowing, who logged the latest row, and who led
 * the board at the end of each September day (the leader headline counts
 * how many of those days in a row belong to today's leader). Same cache
 * tag as the board, so every write keeps it fresh; same five-minute
 * backstop. Nothing time-dependent goes IN: the leader is computed for all
 * thirty days and the page picks the elapsed ones against daysElapsed(),
 * so the cache key never has to carry a clock. Names and numbers are not
 * here on purpose — the page resolves participant ids against the board
 * it already holds, which is the one that knows who is blacked out. */
export type FrontExtras = {
  /* Every logged second, all rowers. */
  seconds: number;
  /* The newest row by createdAt, flattened to ms (unstable_cache round-trips
   * through JSON, so a Date would come back as a string on a hit). */
  latest: { participantId: string; meters: number; createdAtMs: number } | null;
  /* Index d-1 = the participant leading on total meters after day d's rows
   * (Sep 1 .. Sep 30), null on a day nobody had a meter yet. Ties break by
   * name, the same order computeBoards uses, so day thirty agrees with the
   * board. */
  leaderByDay: (string | null)[];
};

const loadFrontExtras = async (): Promise<FrontExtras> => {
  const [participants, entries] = await Promise.all([
    db.rowParticipant.findMany({
      where: { challenge: CHALLENGE },
      select: { id: true, displayName: true },
    }),
    db.rowEntry.findMany({
      where: { challenge: CHALLENGE },
      select: { participantId: true, day: true, meters: true, seconds: true, createdAt: true },
      orderBy: [{ day: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  const names = new Map(participants.map((p) => [p.id, p.displayName]));
  const known = entries.filter((e) => names.has(e.participantId));

  let seconds = 0;
  let newest: (typeof known)[number] | null = null;
  for (const e of known) {
    seconds += e.seconds;
    if (!newest || e.createdAt > newest.createdAt) newest = e;
  }

  // One pass per day over the entries is thirty passes at most — fine for
  // a board this size, and it stays inside the cache.
  const leaderByDay: (string | null)[] = [];
  for (let d = 1; d <= 30; d++) {
    const cutoff = `2026-09-${String(d).padStart(2, "0")}`;
    const cum = new Map<string, number>();
    for (const e of known) {
      if (e.day > cutoff) continue;
      cum.set(e.participantId, (cum.get(e.participantId) ?? 0) + e.meters);
    }
    let lead: { id: string; meters: number; name: string } | null = null;
    for (const [id, m] of cum) {
      if (m <= 0) continue;
      const name = names.get(id) ?? "";
      if (!lead || m > lead.meters || (m === lead.meters && name.localeCompare(lead.name) < 0)) {
        lead = { id, meters: m, name };
      }
    }
    leaderByDay.push(lead ? lead.id : null);
  }

  return {
    seconds,
    latest: newest
      ? { participantId: newest.participantId, meters: newest.meters, createdAtMs: newest.createdAt.getTime() }
      : null,
    leaderByDay,
  };
};

const getFrontExtras = unstable_cache(loadFrontExtras, ["row100k-front"], {
  revalidate: 300,
  tags: ["row100k-boards"],
});

/* Demo namespace skips the cache for the same reason boardDataRaw does. */
export const frontExtras = () =>
  CHALLENGE === CHALLENGE_DEMO ? loadFrontExtras() : getFrontExtras();

export const EMPTY_FRONT: FrontExtras = { seconds: 0, latest: null, leaderByDay: [] };

/* How many September days in a row, ending on day `today` (1..30), the
 * given rower has closed the day on top. 0 when they did not lead at the
 * end of today — the page then says NEW LEADER, which is what a mid-day
 * overtake is. */
export function leaderStreak(extras: FrontExtras, participantId: string, today: number): number {
  let n = 0;
  for (let d = Math.min(30, today); d >= 1; d--) {
    if (extras.leaderByDay[d - 1] !== participantId) break;
    n++;
  }
  return n;
}
