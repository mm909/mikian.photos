/* WHEN A GAME IS DUE (owner, 2026-11-24: the director becomes a game
 * director, "Mario Party mini games", dropped into a row; "nothing shorter
 * than 250 m"). Pure: told the piece's distance and where the row is, it
 * says which game mark is up. No React, no clock.
 *
 * WHERE THE GAMES GO:
 *   a 5K        about 1,000, 2,000, 3,000 and 4,000 m;
 *   a 2K        one, at about 1,000 m;
 *   a 1K        one, at about 250 m;
 *   any other   every 1,000 m from 1,000 m (3K and up), one at half way
 *   set piece   (2K to 3K), one between 250 m and the last 500 (1K to 2K),
 *               none under 1K;
 *   a plain row (no distance set, or a set time) one every 1,000 m after
 *               the first 500.
 * NEVER in the first 500 m of a 2K or more (the research's rule: "a scored
 * game unlocks after 500 m ... of easy rowing", ARCADE-RESEARCH.md E), and
 * never in the last 500 m of any piece: a game is GAME_M of water, and it
 * starts only where all of it fits before the last 500. A 1K is too short
 * to keep the first 500 clear as well; it was named at 250 m. */

/* The water one game takes: the title card, the four 50 m shots, and the
 * chest, at about 1:59 a 500 (owner: "250 m is about 1 minute at 1:59"). */
export const GAME_M = 250;
/* Not in the last 500 m. */
export const CLEAR_END_M = 500;
/* How far past its mark a game may still start: a rower who swipes in late,
 * or a demo that jumped, still gets it; past this the moment has gone. */
export const LATE_M = 120;

/* The marks a game starts at, for a piece of `target` meters (0: a plain
 * row, given how far it has gone so the list can run on). */
export function gameMarks(target: number, upTo = 0): number[] {
  if (!(target > 0)) {
    const out: number[] = [];
    for (let m = 1000; m <= Math.max(1000, upTo + 1000); m += 1000) out.push(m);
    return out;
  }
  const room = target - CLEAR_END_M - GAME_M;
  if (target < 1000 || room < 250) return [];
  if (target < 2000) {
    /* One, in the middle of the room between 250 m and the last stretch,
     * to the nearest 50: a 1K's is at 250. */
    return [250 + Math.floor((room - 250) / 2 / 50) * 50];
  }
  if (target < 3000) return [Math.round(target / 2 / 50) * 50].filter((m) => m >= 500 && m <= room);
  const out: number[] = [];
  for (let m = 1000; m <= room; m += 1000) out.push(m);
  return out;
}

/* The game due at `m`, or null: the first mark passed, not yet played, and
 * not so far behind that it has gone. */
export function dueAt(target: number, m: number, played: ReadonlySet<number>): number | null {
  for (const at of gameMarks(target, m)) {
    if (played.has(at)) continue;
    if (m >= at && m < at + LATE_M) return at;
  }
  return null;
}
