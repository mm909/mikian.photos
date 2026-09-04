import { db } from "@/lib/db";
import { CHALLENGE, GOAL_METERS } from "@/lib/row100k";

/* The first rower to GOAL_METERS — the Grizzly Health prize claim.
 *
 * Per rower, rows are walked in (day, logged) order; the crossing is the row
 * that carries their running total over the line. Earliest crossing wins —
 * by the day it was ROWED, then by when that row was logged — so a backdated
 * row still counts for the day it happened.
 *
 * Lives here rather than on the partners page because two surfaces need the
 * same answer: the public partners page and the admin post pack
 * (/row100k/post), whose congrats slide headlines the same rower.
 */

export type GoalClaim = {
  name: string;
  rowerNumber: number;
  instagram: string;
  /** "2026-09-02" — the day the crossing row was rowed. */
  day: string;
  /** Their total meters now, not at the crossing. */
  total: number;
};

export async function firstToGoal(): Promise<GoalClaim | null> {
  const [participants, entries] = await Promise.all([
    db.rowParticipant.findMany({
      where: { challenge: CHALLENGE },
      select: { id: true, displayName: true, rowerNumber: true, instagram: true },
    }),
    db.rowEntry.findMany({
      where: { challenge: CHALLENGE },
      select: { participantId: true, day: true, meters: true, createdAt: true },
      orderBy: [{ day: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  const byId = new Map(participants.map((p) => [p.id, p]));
  const cum = new Map<string, number>();
  let best: { id: string; day: string; at: number } | null = null;
  for (const e of entries) {
    if (!byId.has(e.participantId)) continue;
    const before = cum.get(e.participantId) ?? 0;
    const after = before + e.meters;
    cum.set(e.participantId, after);
    if (before < GOAL_METERS && after >= GOAL_METERS) {
      const at = e.createdAt.getTime();
      if (!best || e.day < best.day || (e.day === best.day && at < best.at)) {
        best = { id: e.participantId, day: e.day, at };
      }
    }
  }
  if (!best) return null;
  const p = byId.get(best.id);
  if (!p) return null;
  return {
    name: p.displayName,
    rowerNumber: p.rowerNumber,
    instagram: p.instagram,
    day: best.day,
    total: cum.get(best.id) ?? 0,
  };
}
