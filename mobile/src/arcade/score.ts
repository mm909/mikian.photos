/* THE SCORE A MATCH LEAVES: experience, the level it makes, and the rating
 * (owner, 2026-11-24: the celebration is "XP and the bar going up ... A
 * level, if you made one ... Your rating moving"; and the Ratings page: "Elo
 * as in chess"). Pure arithmetic; rating.ts and progress.ts keep the numbers
 * on the phone.
 *
 * XP. A match gives the meters rowed in it, and a bonus for a win (half of
 * it for a draw): the work counts, and winning counts on top. A 5K at 1:59
 * holds about three matches of two minutes, so it is worth about 1,300 to
 * 1,900 XP (scripts/arcade-check.ts).
 *
 * LEVELS. Level 1 to 2 takes 1,500 XP, and each level 250 more than the one
 * before (2 to 3 is 1,750, 3 to 4 is 2,000): about a level a 5K at first,
 * one every two or three 5Ks by level 10.
 *
 * ELO, chess's: everybody starts at 1200, K is 32. A bot is rated off its
 * pace against the rower's: 40 points for each second a 500 it is given
 * quicker than the rower is (a bot 2 s quicker is the rower's rating plus
 * 80), so beating a quicker row moves the rating more. */

export const WIN_XP = 100;
export const DRAW_XP = 50;
export const LEVEL_BASE = 1500;
export const LEVEL_STEP = 250;
export const ELO_START = 1200;
export const ELO_K = 32;
export const ELO_PER_S = 40;

export const matchXp = (rowed: number, result: "win" | "draw" | "loss"): number => Math.max(0, Math.round(rowed)) + (result === "win" ? WIN_XP : result === "draw" ? DRAW_XP : 0);

/* The XP from level `level` to the next. */
export const needFor = (level: number): number => LEVEL_BASE + LEVEL_STEP * (Math.max(1, level) - 1);

/* Where `xp` in all puts the rower: the level, the XP into it, and the XP
 * the level takes. */
export function levelOf(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let left = Math.max(0, Math.floor(xp));
  while (left >= needFor(level)) {
    left -= needFor(level);
    level++;
  }
  return { level, into: left, need: needFor(level) };
}

export const expected = (a: number, b: number): number => 1 / (1 + 10 ** ((b - a) / 400));

/* The rating after a game against `b`: score 1 a win, 0.5 a draw, 0 a loss. */
export const eloAfter = (a: number, b: number, score: number, k = ELO_K): number => Math.round(a + k * (score - expected(a, b)));

/* A bot's rating: the rower's, moved by how much quicker it is given. */
export const botElo = (myElo: number, myAssigned: number, botAssigned: number): number => Math.round(myElo + ELO_PER_S * (myAssigned - botAssigned));
