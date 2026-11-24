import { ghostMeters, type Ghost } from "../erg/ghosts";
import { prng } from "./rng";

/* THE BOTS: other rowers' saved rows, replayed, as the pieces a match is
 * played against before there are live rowers to match (owner, 2026-11-24:
 * "one against bots made from replayed rows first (no other live rowers
 * needed)"; the wiki's Ratings page: "run everybody's saved rows through the
 * match against each other as bots"). The ghosts the race uses
 * (erg/ghosts.ts) are the rows.
 *
 * HONEST: a bot is given its OWN median pace, as the rower is given theirs,
 * and its shot lands when ITS row held that pace over the aim. It is not
 * steered to win or lose.
 *
 * WHAT A SAVED ROW KNOWS. A recorded row keeps the second it crossed each
 * 100 m line; a row logged by hand keeps only its time. Inside those, the
 * strokes are not kept, and a row replayed as an even line holds its pace
 * to the tenth every 3 seconds, which no rower does: it would never miss.
 * So the bot's strokes inside the row's own lines are drawn from a seeded
 * spread (about 1.6 s a 500 stroke to stroke, each stroke leaning on the
 * one before, as a rower's do), with the row's own lines under them. The
 * same row and seed is the same bot every time. */

export type Bot = {
  id: string;
  name: string;
  numStr: string;
  /* Whole seconds a 500: the row's own median pace. */
  assigned: number;
  /* Its average over the row, for picking one near the rower. */
  avgPace: number;
  metersAt: (t: number) => number;
};

/* Stroke to stroke, seconds a 500, and how much a stroke leans on the last. */
export const BOT_SPREAD = 1.6;
const LEAN = 0.55;
const STEP_S = 0.5;

const median = (v: number[]): number => (v.length ? [...v].sort((a, b) => a - b)[v.length >> 1] : 0);
const gauss = (rnd: () => number) => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());

/* The row's own median pace: of its 100 m stretches when it was recorded,
 * its average when it was logged by hand. */
export function medianPaceOf(g: Ghost, meters: number): number {
  const avg = (g.seconds / meters) * 500;
  if (g.marks.length < 2) return avg;
  const paces: number[] = [];
  let was = 0;
  g.marks.forEach((at, i) => {
    const m0 = i * 100;
    const m1 = i === g.marks.length - 1 ? meters : (i + 1) * 100;
    if (m1 > m0 && at > was) paces.push(((at - was) / (m1 - m0)) * 500);
    was = at;
  });
  /* The first 100 m is the start, not the rower's pace. */
  return median(paces.length > 3 ? paces.slice(1) : paces) || avg;
}

/* A row as a bot: its own line every half second of the row, the strokes
 * between them drawn from the spread. Past its own finish it rows on at its
 * average, so a match against a quicker rower's row still has an opponent. */
export function botOf(g: Ghost, meters: number, seed: number, upTo = 0): Bot {
  const rnd = prng(seed);
  const avgSpeed = meters / g.seconds;
  const T = Math.max(g.seconds, upTo) + 60;
  const n = Math.ceil(T / STEP_S) + 1;
  const table = new Float64Array(n);
  const spm = g.spm > 10 ? g.spm : 28;
  let noise = 0;
  let nextStroke = 0;
  let m = 0;
  for (let i = 1; i < n; i++) {
    const t0 = (i - 1) * STEP_S;
    const t1 = i * STEP_S;
    if (t0 >= nextStroke) {
      noise = LEAN * noise + Math.sqrt(1 - LEAN * LEAN) * BOT_SPREAD * gauss(rnd);
      nextStroke += 60 / (spm + (rnd() - 0.5) * 2);
    }
    const base = t1 <= g.seconds ? ghostMeters(g, meters, t1) - ghostMeters(g, meters, t0) : avgSpeed * STEP_S;
    const pace = base > 0 ? (500 * STEP_S) / base : 500 / avgSpeed;
    m += (500 * STEP_S) / Math.max(60, pace + noise);
    table[i] = m;
  }
  const metersAt = (t: number): number => {
    if (!(t > 0)) return 0;
    const x = t / STEP_S;
    const i = Math.floor(x);
    if (i >= n - 1) return table[n - 1] + (t - (n - 1) * STEP_S) * avgSpeed;
    return table[i] + (table[i + 1] - table[i]) * (x - i);
  };
  const avgPace = (g.seconds / meters) * 500;
  return { id: `bot:${g.id}`, name: g.name || "A rower", numStr: g.numStr, assigned: Math.round(medianPaceOf(g, meters)), avgPace, metersAt };
}

/* A PACE BOT, when no saved row is to hand (a plain row the field did not
 * load for, or a sandbox with none): an even line at `pace` with the same
 * spread of strokes, named for its pace. */
export function paceBot(pace: number, seed: number, upTo = 3600): Bot {
  const meters = 5000;
  const g: Ghost = { id: `pace:${Math.round(pace)}`, kind: "pace", name: "", numStr: "", day: "", seconds: (pace / 500) * meters, spm: 28, marks: [] };
  const b = botOf(g, meters, seed, upTo);
  const s = Math.round(pace);
  return { ...b, id: `bot:pace:${s}:${seed % 1000}`, name: `Pace bot ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`, numStr: "" };
}

/* WHO TO PLAY: a bot near the rower's level. Another rower's row first (not
 * the rower's own, not a pace boat); of those, the three whose average is
 * nearest the pace the rower was given, a recorded one counted half a
 * second nearer, and one of the three by the seed so the same row does not
 * come up every match. `skip` holds rows already played this row. None
 * within 12 s a 500: a pace bot at the rower's own pace. */
export function pickBot(ghosts: Ghost[], meters: number, assigned: number, seed: number, skip: Set<string> = new Set(), upTo = 0): Bot {
  const rnd = prng(seed);
  const pool = ghosts
    .filter((g) => g.kind !== "me" && g.kind !== "pace" && g.kind !== "live" && g.seconds > 0 && meters > 0 && !skip.has(`bot:${g.id}`))
    .map((g) => ({ g, d: Math.abs((g.seconds / meters) * 500 - assigned) - (g.marks.length >= 2 ? 0.5 : 0) }))
    .filter((x) => x.d <= 12)
    .sort((a, b) => a.d - b.d || a.g.id.localeCompare(b.g.id));
  if (!pool.length) return paceBot(assigned, seed, upTo);
  const pick = pool[Math.floor(rnd() * Math.min(3, pool.length))].g;
  return botOf(pick, meters, seed, upTo);
}
