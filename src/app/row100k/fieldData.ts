import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { CHALLENGE, CHALLENGE_DEMO } from "@/lib/row100k";
import type { FieldEntry } from "./stats/field";

/* Every session in the challenge as the three numbers THE FIELD needs —
 * who, meters, seconds — for the pages that draw a rower against everyone
 * (the profile's field block, owner ask 2026-09-08). The stats page pulls
 * the same rows itself because it needs more of each (day, createdAt);
 * this is the narrow read, cached under the board's own tag so a logged
 * row refreshes it the same way it refreshes the board. Orphan rows (a
 * participant since removed) are dropped the way computeBoards drops them.
 *
 * The demo namespace skips the cache for the reason boardData does:
 * reseeding happens outside the app and nothing revalidates the tag. */
async function loadFieldEntries(): Promise<FieldEntry[]> {
  const [participants, entries] = await Promise.all([
    db.rowParticipant.findMany({ where: { challenge: CHALLENGE }, select: { id: true } }),
    db.rowEntry.findMany({
      where: { challenge: CHALLENGE },
      select: { participantId: true, meters: true, seconds: true },
    }),
  ]);
  const known = new Set(participants.map((p) => p.id));
  return entries
    .filter((e) => known.has(e.participantId))
    .map((e) => ({ participantId: e.participantId, meters: e.meters, seconds: e.seconds }));
}

const getFieldEntries = unstable_cache(loadFieldEntries, ["row100k-field"], {
  revalidate: 300,
  tags: ["row100k-boards"],
});

export const fieldEntries = (): Promise<FieldEntry[]> =>
  CHALLENGE === CHALLENGE_DEMO ? loadFieldEntries() : getFieldEntries();
