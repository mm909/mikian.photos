import { DMG_LEAST, FILL_S, nearOf } from "./pve";
import { prng } from "./rng";

/* 159, THE MATCH (owner, 2026-11-24, 3 AM: "boats shooting ... until one is
 * out"; 4 AM: "instead of having 3 lives, let's just give us health"). The
 * multiplayer half of the arcade; single player is the island (pve.ts),
 * the default since the same day.
 *
 * THE BAR, NO COOLDOWN (owner, 2026-11-24, after the demo: "Multiplayer
 * gets the same change: the always-filling bar, filling faster near pace,
 * with no cooldown"). Each piece has a bar that is always filling while its
 * rower rows, faster the nearer their pace (the last four seconds of their
 * own meters) is to the pace they were given (the island's `nearOf`, with
 * the given pace as the target). When it is full it throws at the other
 * piece and starts again at once. A throw always lands; its damage is THROW
 * times how near the pace sat while that bar filled (0.4 to 1). Again and
 * again until somebody's health is gone. No time limit: only the show may
 * call a match (the finale is coming, or the row stopped), and then the
 * more health wins.
 *
 * Built for up to four: each piece throws at the next one still standing
 * round the ring, so two is one against one.
 *
 * Pure: told the row's seconds, it answers. How far each piece had rowed by
 * any second is asked of `metersAt` (the rower's own samples, or a bot's
 * replayed row: bots.ts), so the check can row whole matches through it. */

/* A throw at a perfect pace. */
export const THROW = 10;
/* THE HEALTH a 5K match starts with: about forty throws, two minutes and a
 * little of two rowers of a level (scripts/arcade-check.ts). The show
 * scales it for a shorter piece. */
export const HEALTH = 300;
/* The window the pace is read over, seconds. */
export const PACE_S = 4;
/* The ready check (show.ts) still asks whether a pace "holds" the one given:
 * read in whole seconds, 1:59.9 holds 1:59. */
export const HIT_SLACK = 0.9;

export type Side = { id: string; name: string; kind: "me" | "bot"; /* Whole seconds a 500. */ assigned: number; numStr?: string; elo?: number };

export type MShot = {
  n: number;
  /* The row's second it was thrown. */
  at: number;
  from: string;
  to: string;
  /* How near the pace sat while its bar filled, 0 to 1. */
  acc: number;
  /* Always true now (no misses); kept for the screen. */
  hit: boolean;
  lucky: boolean;
  cancelled: boolean;
  damage: number;
};

export type MPlayer = Side & { health: number; max: number; startM: number; /* Rowed in the match so far. */ rowed: number; charge: number; near: number; pace: number };

export type MatchPhase = "on" | "over";

export type MatchView = {
  id: string;
  t0: number;
  t: number;
  phase: MatchPhase;
  players: MPlayer[];
  shots: MShot[];
  /* The id that won, "draw", or null while it is on. */
  winner: string | null;
  /* The show called it (time), rather than somebody running out. */
  called: boolean;
  endAt: number;
};

export type MetersAt = (id: string, t: number) => number;

/* A pace a 500 out of meters in seconds. */
export const paceOf = (meters: number, seconds: number): number => (meters > 0.05 ? (500 * seconds) / meters : Infinity);
/* Read in tenths, as the screen shows it (fmtClock floors the tenth). */
export const tenths = (p: number): number => (Number.isFinite(p) ? Math.floor(p * 10 + 1e-6) / 10 : p);
/* Whether a pace holds a pace given of `assigned` (whole seconds). */
export const holds = (pace: number, assigned: number): boolean => Number.isFinite(pace) && tenths(pace) <= assigned + HIT_SLACK + 1e-9;

export type Match = { step(t: number): MatchView; call(t: number): MatchView; view(): MatchView };

/* `late`: the pieces that failed the ready check (show.ts): their bar
 * starts empty-handed, a throw behind (it starts at minus one). */
export function createMatch({ id, t0, sides, metersAt, health = HEALTH, seed, late = [] }: { id: string; t0: number; sides: Side[]; metersAt: MetersAt; health?: number; seed: number; late?: string[] }): Match {
  const rnd = prng(seed);
  const H = Math.max(1, Math.round(health));
  /* Each bar starts a little apart, so two level rowers do not throw on
   * the same tenth all match. */
  const players: MPlayer[] = sides.map((s) => ({ ...s, health: H, max: H, startM: metersAt(s.id, t0), rowed: 0, charge: late.includes(s.id) ? -1 : rnd() * 0.15, near: 0, pace: Infinity }));
  const acc = new Map<string, { w: number; t: number }>(players.map((p) => [p.id, { w: 0, t: 0 }]));
  let last = t0;
  let v: MatchView = { id, t0, t: t0, phase: "on", players, shots: [], winner: null, called: false, endAt: 0 };

  const targetOf = (i: number): MPlayer | null => {
    const n = players.length;
    for (let k = 1; k < n; k++) {
      const p = players[(i + k) % n];
      if (p.health > 0) return p;
    }
    return null;
  };

  const rowed = (t: number) => {
    for (const p of players) p.rowed = Math.max(0, metersAt(p.id, t) - p.startM);
  };

  /* The match from `last` to `t`, a quarter second at a time. */
  const advance = (t: number) => {
    while (last < t - 1e-9 && v.phase !== "over") {
      const dt = Math.min(0.25, t - last);
      const now = last + dt;
      players.forEach((p, i) => {
        if (p.health <= 0) return;
        p.pace = tenths(paceOf(metersAt(p.id, now) - metersAt(p.id, now - PACE_S), PACE_S));
        p.near = nearOf(p.pace, p.assigned + 0.5);
        const a = acc.get(p.id) as { w: number; t: number };
        p.charge += (p.near / FILL_S) * dt;
        if (p.charge > 0) {
          a.w += p.near * dt;
          a.t += dt;
        }
        if (p.charge >= 1) {
          const to = targetOf(i);
          const q = a.t > 0 ? a.w / a.t : p.near;
          p.charge = 0;
          a.w = 0;
          a.t = 0;
          if (!to) return;
          const damage = Math.max(1, Math.round(THROW * (DMG_LEAST + (1 - DMG_LEAST) * q)));
          to.health = Math.max(0, to.health - damage);
          v.shots = [...v.shots.slice(-120), { n: (v.shots[v.shots.length - 1]?.n ?? 0) + 1, at: now, from: p.id, to: to.id, acc: q, hit: true, lucky: false, cancelled: false, damage }];
        }
      });
      last = now;
      const standing = players.filter((p) => p.health > 0);
      if (standing.length <= 1) {
        v.winner = standing[0]?.id ?? "draw";
        v.phase = "over";
        v.endAt = now;
      }
    }
  };

  return {
    view: () => v,
    step(t) {
      if (v.phase === "over") return v;
      v = { ...v, t };
      advance(t);
      rowed(v.phase === "over" ? v.endAt : t);
      v.players = players.map((p) => ({ ...p }));
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
      return v;
    },
  };
}
