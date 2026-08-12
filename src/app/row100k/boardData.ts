import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
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

/* The seeded demo board skips the cache: reseeding happens outside the app,
 * so nothing revalidates the tag and a stale board survives even a dev-server
 * restart (unstable_cache persists to .next/cache). */
export const boardData = () => (CHALLENGE === CHALLENGE_DEMO ? loadBoardData() : getBoardData());

export const EMPTY_BOARDS: BoardData = {
  total: [],
  fastest: { 1000: [], 5000: [], 10000: [] },
  longest: [],
  bigDay: [],
  daily: [],
  community: { meters: 0, people: 0, sessions: 0, finished: 0 },
};
