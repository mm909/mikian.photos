import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { CHALLENGE, CHALLENGE_DEMO } from "@/lib/row100k";

/* Raw rows for the numbers page. boardData() only hands back the aggregated
 * boards and the stats page's own query drops `seconds`, so the pace maths
 * needs its own load. Same cache tag as the boards — every write route
 * already revalidates it — with the same five-minute backstop. createdAt is
 * flattened to a millisecond number before it enters the cache: unstable_cache
 * round-trips through JSON, so a Date would come back as a string on a hit
 * and as a Date on a miss. */

export type RawParticipant = { id: string; rowerNumber: number; division: string };
export type RawEntry = {
  id: string;
  participantId: string;
  day: string;
  meters: number;
  seconds: number;
  createdAtMs: number;
};
export type RawData = { participants: RawParticipant[]; entries: RawEntry[] };

const load = async (): Promise<RawData> => {
  const [participants, entries] = await Promise.all([
    db.rowParticipant.findMany({
      where: { challenge: CHALLENGE },
      select: { id: true, rowerNumber: true, division: true },
      orderBy: { rowerNumber: "asc" },
    }),
    db.rowEntry.findMany({
      where: { challenge: CHALLENGE },
      select: { id: true, participantId: true, day: true, meters: true, seconds: true, createdAt: true },
      orderBy: [{ day: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  return {
    participants,
    entries: entries.map((e) => ({
      id: e.id,
      participantId: e.participantId,
      day: e.day,
      meters: e.meters,
      seconds: e.seconds,
      createdAtMs: e.createdAt.getTime(),
    })),
  };
};

const cached = unstable_cache(load, ["row100k-analysis"], {
  revalidate: 300,
  tags: ["row100k-boards"],
});

/* The seeded demo board skips the cache for the same reason boardData does:
 * reseeding happens outside the app, so nothing would ever revalidate it. */
export const analysisData = () => (CHALLENGE === CHALLENGE_DEMO ? load() : cached());

export const EMPTY_DATA: RawData = { participants: [], entries: [] };
