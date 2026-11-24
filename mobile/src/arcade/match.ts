import { prng } from "./rng";

/* 159, THE MATCH (owner, 2026-11-24, 3 AM: "boats shooting every 6 seconds,
 * until one is out"; and at 4 AM: "instead of having 3 lives, let's just
 * give us health ... and then have the damage be the number of meters that
 * we rode during that section"). The single-player 159 against rocks is
 * game159.ts and stays in the code; the show plays this one.
 *
 * THE ROUNDS, by the ROW'S OWN SECONDS (live.elapsedS), so a demo at ten
 * times a clock plays it ten times as fast:
 *   COOL   3 s: every gun cools.
 *   AIM    3 s: hold the pace you were given.
 *   FIRE   at the end of the aim, every gun at once, always at the other
 *          piece. HELD (the aim's average pace reads the pace given, or
 *          faster) hits. Off it, the shot wobbles and MAY still land, LUCKY,
 *          less likely the further off. A shot that lands does as much
 *          damage as the meters its shooter rowed in those 3 seconds.
 *          Both land at once: they cancel, nobody is hurt. Neither: nothing.
 * Again and again until somebody's health is gone. No time limit: only the
 * show may call a match (the finale is coming, or the row stopped), and
 * then the more health wins.
 *
 * Built for up to four: each piece shoots the next one still standing round
 * the ring, so two is one against one; a pair who land on each other in
 * the same round cancel.
 *
 * Pure: told the row's seconds, it answers. How far each piece had rowed by
 * any second is asked of `metersAt` (the rower's own samples, or a bot's
 * replayed row: bots.ts), so the check can row whole matches through it. */

export const COOL_S = 3;
export const AIM_S = 3;
export const CYCLE_S = COOL_S + AIM_S;
/* THE HIT RULE, one number (owner's first idea, 2026-11-24: "the 3-second
 * average, rounded down, must read your pace or faster. 1:59.9 and 1:59.1
 * both count as 1:59"). The pace given is a whole second, the aim is read
 * in tenths, and it holds while it reads no slower than the pace given and
 * this much: 0.9 is "its whole-second reading is the pace or faster". To be
 * confirmed with the owner (his later idea was half a second either side). */
export const HIT_SLACK = 0.9;
/* A shot off the pace lands now and then: this often just past the line,
 * falling away by e for every LUCK_FALL seconds slower. */
export const LUCK_AT_LINE = 0.4;
export const LUCK_FALL = 1.2;
/* THE HEALTH a 5K match starts with, in meters: five shots that land clean
 * at 1:59 (12.6 m each, 13 rounded). Two rowers of a level both hold most
 * rounds, and those cancel, so a clean landing comes about one round in
 * four: rowed through scripts/arcade-check.ts a 1:59 rower's match against
 * a bot of their level lasts 2:00 in the middle (1:18 to 3:12), a 2:30
 * rower's 2:54 (10 m a shot). The show scales it for a shorter piece. */
export const HEALTH = 65;

export type Side = { id: string; name: string; kind: "me" | "bot"; /* Whole seconds a 500. */ assigned: number; numStr?: string; elo?: number };

export type MShot = {
  n: number;
  /* The row's second it fired. */
  at: number;
  from: string;
  to: string;
  /* The aim's average pace, tenths kept; Infinity when it rowed nothing. */
  pace: number;
  /* Meters its shooter rowed in the aim. */
  meters: number;
  held: boolean;
  lucky: boolean;
  /* Landed: held or lucky. */
  hit: boolean;
  cancelled: boolean;
  damage: number;
};

export type MPlayer = Side & { health: number; max: number; startM: number; /* Rowed in the match so far. */ rowed: number };

export type MatchPhase = "cool" | "aim" | "over";

export type MatchView = {
  id: string;
  t0: number;
  t: number;
  phase: MatchPhase;
  /* Seconds into this cool or aim. */
  into: number;
  round: number;
  players: MPlayer[];
  shots: MShot[];
  /* The id that won, "draw", or null while it is on. */
  winner: string | null;
  /* The show called it (time), rather than somebody running out. */
  called: boolean;
  endAt: number;
  /* The pace of the aim so far for each piece, while it aims. */
  aimPace: Record<string, number>;
};

export type MetersAt = (id: string, t: number) => number;

/* A pace a 500 out of meters in seconds. */
export const paceOf = (meters: number, seconds: number): number => (meters > 0.05 ? (500 * seconds) / meters : Infinity);
/* Read in tenths, as the screen shows it (fmtClock floors the tenth). */
export const tenths = (p: number): number => (Number.isFinite(p) ? Math.floor(p * 10 + 1e-6) / 10 : p);
/* Whether an aim of `pace` holds a pace given of `assigned`. */
export const holds = (pace: number, assigned: number): boolean => Number.isFinite(pace) && tenths(pace) <= assigned + HIT_SLACK + 1e-9;
/* The chance an off-pace shot lands anyway. */
export const luckOf = (pace: number, assigned: number): number => {
  if (!Number.isFinite(pace)) return 0;
  const x = Math.max(0, pace - (assigned + HIT_SLACK));
  return LUCK_AT_LINE * Math.exp(-x / LUCK_FALL);
};

export type Match = { step(t: number): MatchView; call(t: number): MatchView; view(): MatchView };

/* `late`: the pieces that failed the ready check (show.ts): their gun is
 * not ready for the first round, and only that one. */
export function createMatch({ id, t0, sides, metersAt, health = HEALTH, seed, late = [] }: { id: string; t0: number; sides: Side[]; metersAt: MetersAt; health?: number; seed: number; late?: string[] }): Match {
  const rnd = prng(seed);
  const H = Math.max(1, Math.round(health));
  const players: MPlayer[] = sides.map((s) => ({ ...s, health: H, max: H, startM: metersAt(s.id, t0), rowed: 0 }));
  let fired = 0;
  let v: MatchView = { id, t0, t: t0, phase: "cool", into: 0, round: 1, players, shots: [], winner: null, called: false, endAt: 0, aimPace: {} };

  /* Who each piece shoots: the next one still standing round the ring. */
  const targetOf = (i: number, alive: MPlayer[]): MPlayer | null => {
    const n = players.length;
    for (let k = 1; k < n; k++) {
      const p = players[(i + k) % n];
      if (alive.includes(p)) return p;
    }
    return null;
  };

  const fire = (tf: number) => {
    fired++;
    const alive = players.filter((p) => p.health > 0);
    const round: MShot[] = [];
    players.forEach((p, i) => {
      if (!alive.includes(p) || (fired === 1 && late.includes(p.id))) return;
      const to = targetOf(i, alive);
      if (!to) return;
      const meters = Math.max(0, metersAt(p.id, tf) - metersAt(p.id, tf - AIM_S));
      const pace = tenths(paceOf(meters, AIM_S));
      const held = holds(pace, p.assigned);
      const lucky = !held && rnd() < luckOf(pace, p.assigned);
      round.push({ n: v.shots.length + round.length + 1, at: tf, from: p.id, to: to.id, pace, meters, held, lucky, hit: held || lucky, cancelled: false, damage: 0 });
    });
    /* Two who land on each other in one round cancel out. */
    for (const s of round) {
      if (!s.hit) continue;
      const back = round.find((o) => o.from === s.to && o.to === s.from && o.hit);
      if (back) s.cancelled = true;
    }
    for (const s of round) {
      if (!s.hit || s.cancelled) continue;
      s.damage = Math.max(1, Math.round(s.meters));
      const to = players.find((p) => p.id === s.to);
      if (to) to.health = Math.max(0, to.health - s.damage);
    }
    v.shots = [...v.shots, ...round];
    const standing = players.filter((p) => p.health > 0);
    if (standing.length <= 1) {
      v.winner = standing[0]?.id ?? "draw";
      v.phase = "over";
      v.endAt = tf;
    }
  };

  const rowed = (t: number) => {
    for (const p of players) p.rowed = Math.max(0, metersAt(p.id, t) - p.startM);
  };

  return {
    view: () => v,
    step(t) {
      if (v.phase === "over") return v;
      v = { ...v, t };
      /* Every round whose gun has gone by now, in order: one tick of a fast
       * demo can pass more than one. */
      while (v.phase !== "over" && t >= t0 + (fired + 1) * CYCLE_S - 1e-9) fire(t0 + (fired + 1) * CYCLE_S);
      rowed(v.phase === "over" ? v.endAt : t);
      v.players = players.map((p) => ({ ...p }));
      if (v.phase === "over") return v;
      const into = t - t0 - fired * CYCLE_S;
      v.round = fired + 1;
      v.phase = into < COOL_S ? "cool" : "aim";
      v.into = v.phase === "cool" ? into : into - COOL_S;
      const aim: Record<string, number> = {};
      if (v.phase === "aim" && v.into > 0.25) for (const p of players) aim[p.id] = tenths(paceOf(metersAt(p.id, t) - metersAt(p.id, t - v.into), v.into));
      v.aimPace = aim;
      return v;
    },
    call(t) {
      if (v.phase === "over") return v;
      v = { ...v, t };
      rowed(t);
      const best = Math.max(...players.map((p) => p.health));
      const top = players.filter((p) => p.health === best);
      v.players = players.map((p) => ({ ...p }));
      v.winner = top.length === 1 ? top[0].id : "draw";
      v.called = true;
      v.phase = "over";
      v.endAt = t;
      v.aimPace = {};
      return v;
    },
  };
}
