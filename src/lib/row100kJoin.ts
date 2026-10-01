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
  /* Empty is allowed: since 2026-09-24 neither door asks for a handle. */
  instagram: string;
  division: string;
  /* Date-only, UTC midnight (parseBirthday). The join form asks for it;
   * race day does not, so a walk-in is created without one and can add it
   * on the settings page later. */
  birthday?: Date | null;
  /* Height, weight and home gym, in the column's own units — the sign-up
   * page's third tier (owner, 2026-10-01: "their height and their weight
   * and their home gym — all of those should be there, not as important").
   * Written into the create only when given, so the two doors that never
   * ask (the JoinPanel, race day) make the same row they always made. The
   * shirt size is NOT here: its column is the one that may not be in the
   * database yet, and a create that named it would spend no rower number
   * and take no join — the join route writes it on its own, after. */
  about?: { heightCm?: number | null; weightKg?: number | null; homeGym?: string | null };
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
          /* Only written when given, so a door that never asks (race day)
           * keeps working on a database the column has not reached yet. */
          ...(o.birthday ? { birthday: o.birthday } : {}),
          ...(o.about?.heightCm != null ? { heightCm: o.about.heightCm } : {}),
          ...(o.about?.weightKg != null ? { weightKg: o.about.weightKg } : {}),
          ...(o.about?.homeGym ? { homeGym: o.about.homeGym } : {}),
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
