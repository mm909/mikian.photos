import type { RaceDef } from "./raceday";
import type { Racer } from "./racedayData";

/* THE AUTO RULE — pure, no db, so the route can run it and a script can
 * check it. Two modes:
 *
 * BALANCED (the default; owner, 2026-09-16: "try to assign an equal number
 * of men's and women's rowers per wave; try to prio faster rowers at the
 * end of the night"). W = ceil(field / waveSize) waves. The men are spread
 * as evenly as possible over the W waves, then the women, then anybody in
 * neither bracket — each pool's per-wave counts differ by at most one, and
 * a pool's odd rowers land in whichever waves are emptiest so the totals
 * even out too. No wave goes over waveSize: if the quotas would, the
 * overflow moves to the emptiest wave with room. FASTER LATER: inside each
 * pool the slowest go to wave 1 and the fastest to the last wave, with a
 * rower who has no 5k yet treated as slowest (first waves).
 *
 * APART (the rule as it stood 2026-09-10): the brackets race each other,
 * men then women then the rest in the order raceday.ts lists them, each
 * bracket seeded fastest first and filled waveSize at a time, a new
 * bracket always starting a new wave.
 *
 * Both are deterministic — the rower number breaks every tie — so a dry
 * run and the write that follows it lay out the same evening. Withdrawals
 * and spectators are never in a plan. */

export type PlanMode = "balanced" | "apart";

export function parsePlanMode(v: unknown): PlanMode | null {
  return v === "balanced" || v === "apart" ? v : null;
}

export type PlanRow = {
  id: string;
  rowerNumber: number;
  name: string;
  division: string;
  /* Their seed, as the console prints it. */
  best5k: string;
  from: number | null;
  to: number;
};

/* Fastest first, no time last, rower number to break a tie. */
export function bySeed(a: Racer, b: Racer): number {
  const at = a.best5k ? a.best5k.seconds : Number.POSITIVE_INFINITY;
  const bt = b.best5k ? b.best5k.seconds : Number.POSITIVE_INFINITY;
  if (at !== bt) return at - bt;
  return a.rowerNumber - b.rowerNumber;
}

/* Slowest first, no time first of all, rower number to break a tie. */
function bySeedReversed(a: Racer, b: Racer): number {
  const at = a.best5k ? a.best5k.seconds : Number.POSITIVE_INFINITY;
  const bt = b.best5k ? b.best5k.seconds : Number.POSITIVE_INFINITY;
  if (at !== bt) return bt - at;
  return a.rowerNumber - b.rowerNumber;
}

function row(r: Racer, to: number): PlanRow {
  return {
    id: r.id,
    rowerNumber: r.rowerNumber,
    name: r.name,
    division: r.division,
    best5k: r.best5k ? r.best5k.text : "",
    from: r.wave,
    to,
  };
}

/* Only people who are actually pulling: a withdrawal is out, and so is
 * anybody who signed up to watch. */
function liveRacers(racers: Racer[]): Racer[] {
  return racers.filter((r) => !r.withdrewAt && r.role === "racer");
}

/* The pools in the order they are dealt: each bracket as the race lists
 * them, then everybody in neither. */
function pools(race: RaceDef, live: Racer[]): Racer[][] {
  const keys = race.brackets.map((b) => b.key as string);
  return [
    ...race.brackets.map((b) => live.filter((r) => r.division === b.key)),
    live.filter((r) => !keys.includes(r.division)),
  ];
}

/* The wave with the fewest in it that still has room; the lower number on
 * a tie. -1 when every wave is full (cannot happen while the field fits). */
function emptiest(counts: number[], size: number): number {
  let best = -1;
  for (let w = 0; w < counts.length; w++) {
    if (counts[w] >= size) continue;
    if (best < 0 || counts[w] < counts[best]) best = w;
  }
  return best;
}

function planBalanced(race: RaceDef, live: Racer[]): PlanRow[] {
  if (live.length === 0) return [];
  const size = Math.max(1, race.waveSize);
  const waves = Math.max(1, Math.ceil(live.length / size));
  /* How many are in each wave so far, every pool counted. */
  const counts: number[] = Array.from({ length: waves }, () => 0);
  const out: PlanRow[] = [];

  for (const pool of pools(race, live)) {
    if (pool.length === 0) continue;
    /* This pool's share of each wave: the floor everywhere, and the odd
     * ones into the emptiest waves so the totals level out. */
    const base = Math.floor(pool.length / waves);
    const quota: number[] = Array.from({ length: waves }, () => base);
    const running = counts.map((c, w) => c + quota[w]);
    for (let extra = pool.length - base * waves; extra > 0; extra--) {
      const open = emptiest(running, size);
      /* Every wave full cannot happen while the field fits W waves; if it
       * ever did, the rower still gets a wave and the guard below levels it. */
      const w = open < 0 ? emptiest(running, Number.POSITIVE_INFINITY) : open;
      quota[w] += 1;
      running[w] += 1;
    }
    /* Nothing over waveSize: shift any overflow to the emptiest wave with
     * room. The field fits in W waves by construction, so there is one. */
    for (let w = 0; w < waves; w++) {
      while (running[w] > size) {
        const to = emptiest(running, size);
        if (to < 0) break;
        quota[w] -= 1;
        running[w] -= 1;
        quota[to] += 1;
        running[to] += 1;
      }
    }
    /* Slowest into wave 1, fastest into the last wave. */
    const seeded = [...pool].sort(bySeedReversed);
    let i = 0;
    for (let w = 0; w < waves; w++) {
      for (let k = 0; k < quota[w]; k++) out.push(row(seeded[i++], w + 1));
      counts[w] += quota[w];
    }
  }

  /* Printed as a start list: by wave, then quickest first inside it. */
  const by = new Map(live.map((r) => [r.id, r]));
  return out.sort((a, b) => a.to - b.to || bySeed(by.get(a.id) as Racer, by.get(b.id) as Racer));
}

function planApart(race: RaceDef, live: Racer[]): PlanRow[] {
  const size = Math.max(1, race.waveSize);
  const out: PlanRow[] = [];
  let wave = 1;
  for (const group of pools(race, live)) {
    if (group.length === 0) continue;
    const seeded = [...group].sort(bySeed);
    for (let i = 0; i < seeded.length; i++) {
      /* A new bracket always starts a new wave, so nobody races a bracket
       * they are not scored in. */
      if (i > 0 && i % size === 0) wave += 1;
      out.push(row(seeded[i], wave));
    }
    wave += 1;
  }
  return out;
}

export function planWaves(race: RaceDef, racers: Racer[], opts: { mode: PlanMode }): PlanRow[] {
  const live = liveRacers(racers);
  return opts.mode === "apart" ? planApart(race, live) : planBalanced(race, live);
}
