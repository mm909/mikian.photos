import { createGame159, type GTick, type View159 } from "./game159";
import { seedOf } from "./rng";
import { CLEAR_END_M, dueAt } from "./schedule";

/* THE ARCADE OVER A ROW: the game director (owner, 2026-11-24: "the
 * director becomes a game director, running an arcade of mini games"). It
 * watches the whole row, keeps the pace of the last strokes (for the band
 * the next game is played in), asks the schedule (schedule.ts) when a game
 * is due, and runs it (game159.ts) until its chest is open. Between games
 * it answers null and the monitor is the monitor.
 *
 * Pure, as the director is: told where the row is, it answers. The monitor
 * holds one beside the director (useArcade.ts); the check rows whole pieces
 * through it (scripts/arcade-check.ts). */

export type ATick = GTick & { target: number };

export type Arcade = {
  step(t: ATick): View159 | null;
  /* Every game it ran, for the check. */
  log: { at: number; won: boolean | null; phase: string }[];
};

/* The strokes before a game that the band is read off are the ones after
 * the start: the first pulls off the line are not the rower's pace. */
const SETTLE_M = 100;

export function createArcade(seed = 1): Arcade {
  let target = -1;
  let lastM = 0;
  let lastStrokes = -1;
  const paces: number[] = [];
  let played = new Set<number>();
  let game: ReturnType<typeof createGame159> | null = null;
  const log: Arcade["log"] = [];

  const reset = (t: ATick) => {
    target = t.target;
    lastStrokes = -1;
    paces.length = 0;
    played = new Set();
    game = null;
  };

  return {
    log,
    step(t) {
      if (t.target !== target || t.m + 5 < lastM) reset(t);
      lastM = t.m;
      if (t.strokes !== lastStrokes) {
        if (lastStrokes >= 0 && t.strokes > lastStrokes && t.pace > 40 && t.pace < 600 && t.m >= SETTLE_M) {
          paces.push(t.pace);
          if (paces.length > 60) paces.shift();
        }
        lastStrokes = t.strokes;
      }

      if (game) {
        const v = game.step(t);
        if (v.phase === "done" || v.phase === "gone") {
          const entry = log[log.length - 1];
          if (entry) {
            entry.won = v.phase === "done" ? v.won : null;
            entry.phase = v.phase;
          }
          game = null;
          return null;
        }
        return v;
      }

      if (t.ended) return null;
      if (t.target > 0 && t.m >= t.target - CLEAR_END_M) return null;
      const at = dueAt(t.target, t.m, played);
      if (at === null) return null;
      played.add(at);
      game = createGame159({ id: `159@${at}`, startM: t.m, now: t.now, recent: [...paces], seed: seedOf(`${seed}/${t.target}/${at}`) });
      log.push({ at, won: null, phase: "title" });
      return game.step(t);
    },
  };
}
