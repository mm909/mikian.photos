/* ============================================================================
 * THE FOLLOWING SET — A STAND-IN.
 *
 * Following does not exist yet: there is no follow table, no follow button
 * and no API. The five landing looks (owner, 2026-09-25: "the main real
 * estate is the status updates from the friends I follow … people I chose
 * to follow") need a set of followed rowers to draw, so THIS is it, in one
 * place, and every look reads off it and nothing else. For the demo it is
 * the twelve rowers with the most recent rows this month, the viewer
 * excluded. When follows land, this function is replaced by a read of the
 * follow table and nothing in looks/ has to move.
 * ========================================================================== */

export const FOLLOWING_N = 12;

/* The stand-in: the `n` rowers whose latest row landed most recently,
 * newest first, never the viewer. `entries` may be in any order. */
export function pickFollowing(
  entries: { participantId: string; createdAt: Date }[],
  viewerId: string,
  n: number = FOLLOWING_N,
): string[] {
  const latest = new Map<string, number>();
  for (const e of entries) {
    if (e.participantId === viewerId) continue;
    const t = e.createdAt.getTime();
    const cur = latest.get(e.participantId);
    if (cur == null || t > cur) latest.set(e.participantId, t);
  }
  return [...latest.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([id]) => id);
}
