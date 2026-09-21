import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";

/* THE ROWER NUMBER, handed out in join order and never changed. This is the
 * one place a RowParticipant row is CREATED, so the two doors into the
 * challenge — the Rowtember opt-in (/api/row100k/join) and race day
 * (/api/row100k/raceday, owner 2026-09-21: somebody who "does not want to
 * do Rowtember but does want to race" must not be sent away to opt in
 * first) — cannot hand out the same number twice or disagree about what a
 * participant is.
 *
 * Retry loop: two concurrent first-joins can race on the next rower number
 * (or on challenge_userId itself) — the @@unique constraints turn either
 * race into a P2002, and the next lap resolves it. An existing row is
 * returned untouched: whoever called us decides whether to update it. */
export type ParticipantKey = { id: string; rowerNumber: number; division: string; created: boolean };

export async function ensureParticipant(o: {
  userId: string;
  displayName: string;
  /* Empty is allowed here: a race-day entry does not ask for a handle. */
  instagram: string;
  division: string;
}): Promise<ParticipantKey> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await db.rowParticipant.findUnique({
      where: { challenge_userId: { challenge: CHALLENGE, userId: o.userId } },
      select: { id: true, rowerNumber: true, division: true },
    });
    if (existing) return { ...existing, created: false };

    const max = await db.rowParticipant.aggregate({
      where: { challenge: CHALLENGE },
      _max: { rowerNumber: true },
    });
    try {
      const created = await db.rowParticipant.create({
        data: {
          challenge: CHALLENGE,
          userId: o.userId,
          rowerNumber: (max._max.rowerNumber ?? 0) + 1,
          displayName: o.displayName,
          instagram: o.instagram,
          division: o.division,
        },
        select: { id: true, rowerNumber: true, division: true },
      });
      revalidateTag("row100k-boards");
      return { ...created, created: true };
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== "P2002") throw err;
    }
  }
  throw new Error("row100k: could not assign a rower number after three tries");
}
