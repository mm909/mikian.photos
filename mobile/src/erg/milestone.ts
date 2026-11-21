import type { Live } from "./model";

/* WHAT IT TAKES TO HIT THE NEXT MARK (owner, 2026-11-20: "we know the
 * distance and your current pace so if you will need to row x faster to hit
 * this milestone"; "I'm thinking more like 2:01, -2.0s for 20:00"; "we can
 * use milestones of 10 seconds always"; no target is chosen by the rower).
 *
 * The monitor is set to a distance, the rower has an average split so far,
 * and that pair projects a finish time. The next mark is the nearest finish
 * time on a 10-second line that is FASTER than the projection. To reach it
 * the remaining metres must be rowed at
 *
 *     need = (mark - elapsed) / metresLeft * 500        seconds per 500 m
 *
 * and the line the screen prints is need minus the average so far: how
 * many seconds a 500 the rower has to find.
 *
 * His example: 2,500 m into a 5k on a 2:01.0 average. Elapsed 10:05, the
 * projection is 20:10, the next mark is 20:00, the 2,500 m left must go at
 * 1:59.0, so the line reads "-2.0 s FOR 20:00". */

export type Milestone = {
  /* The finish the average so far lands on, seconds. */
  projected: number;
  /* The next 10 s mark faster than that, seconds. */
  mark: number;
  /* Seconds per 500 m to find (negative: faster than the average so far). */
  delta: number;
  metersLeft: number;
};

const STEP = 10;

export function milestone(live: Pick<Live, "targetM" | "meters" | "elapsedS" | "avgPace" | "ended">): Milestone | null {
  const left = live.targetM - live.meters;
  /* Nothing to say before the average means anything, or once it is over. */
  if (!(live.targetM > 0) || live.ended || left <= 0 || live.meters < 100 || !(live.avgPace > 0)) return null;
  const projected = live.elapsedS + (left * live.avgPace) / 500;
  let mark = Math.floor(projected / STEP) * STEP;
  /* A projection sitting on a mark already has it: aim at the one before. */
  if (projected - mark < 0.05) mark -= STEP;
  if (mark <= live.elapsedS) return null;
  const need = ((mark - live.elapsedS) / left) * 500;
  return { projected, mark, delta: need - live.avgPace, metersLeft: left };
}

/* A TIMED PIECE has no finish time to chase; what the average projects is
 * the distance it will cover. */
export function projectedMeters(live: Pick<Live, "targetS" | "meters" | "elapsedS" | "avgPace" | "ended">): number | null {
  const left = live.targetS - live.elapsedS;
  if (!(live.targetS > 0) || live.ended || left <= 0 || live.meters < 100 || !(live.avgPace > 0)) return null;
  return live.meters + (left / live.avgPace) * 500;
}
