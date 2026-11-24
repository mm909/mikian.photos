import { prng } from "./rng";

/* 159, SINGLE PLAYER: THE ISLAND (owner, 2026-11-24, after the demo: "a PvE
 * auto-battler as single player, pace-driven like an idle clicker"). The
 * default arcade mode from that day; the match against bots (match.ts)
 * stays in the code.
 *
 * THE LOOP. The rower's piece goes round the island board; a monster sits
 * on the island in the middle. A BAR IS ALWAYS FILLING while they row, and
 * it fills faster the nearer their pace is to the target (1:59 a 500 for
 * now, "159"). When it is full they throw at the monster, and it starts
 * filling again at once: no cooldown, so they are always either getting
 * ready to throw or throwing. The throw's damage is the power they have
 * and how near the pace sat while that bar filled (ACC), so nearer 1:59 is
 * more damage, quicker kills and more XP.
 *
 * NEAR, one number from 0 to 1 (`nearOf`): 1 within PLATEAU seconds of the
 * target either way, falling away by e for every FALL seconds past that,
 * and never under FLOOR while the boat is moving: a rower well off the pace
 * still throws, only slowly. Stopped, nothing fills.
 *
 * THE CLICKER. Each monster has more health than the last (HP_GROW), each
 * kill makes the rower's throws harder (DMG_GROW), and at set kills a boat
 * is recruited (CREW): a DECKHAND goes round the board with them and throws
 * by itself every few seconds whatever the pace (the auto-clicker), and a
 * TWIN launcher throws two at a time. Nothing is tapped: a rower's hands
 * are on the handle.
 *
 * TUNED (scripts/arcade-check.ts) so a rower holding 1:59 gets through
 * about three monsters in a 1K, and a 5K runs through many.
 *
 * Pure, as the rest of the arcade is: told the row's seconds and the pace,
 * it answers. The show (show.ts) runs it between the intro and the finale;
 * the screen is screens/Show.tsx (Battle). */

export const TARGET = 119;
/* Seconds the bar takes to fill at the target pace. */
export const FILL_S = 3;
export const PLATEAU = 1.5;
export const FALL = 8;
export const FLOOR = 0.2;
/* Health of the first monster; each after it has HP_GROW times as much. */
export const HP0 = 150;
export const HP_GROW = 1.25;
/* The rower's first throw at a perfect pace, and how much each kill adds. */
export const DMG0 = 10;
export const DMG_GROW = 1.1;
/* Of a throw's power, the share it does at the worst pace (and all of it
 * at the best). */
export const DMG_LEAST = 0.4;
/* The row's seconds between a kill and the next monster on the island. */
export const RESPAWN_S = 2.5;
/* A deckhand's throw: every DECK_S seconds, this share of the rower's
 * power. */
export const DECK_S = 5;
export const DECK_SHARE = 0.4;
/* XP: a throw's (more the nearer the pace), and a kill's. */
export const throwXp = (acc: number): number => Math.round(2 + 4 * Math.max(0, Math.min(1, acc)));
export const killXp = (n: number): number => 25 + 5 * n;

/* What is recruited, and at which kill. */
export type Crew = { at: number; kind: "deck" | "twin" | "quick"; name: string; line: string };
export const CREW: Crew[] = [
  { at: 2, kind: "deck", name: "DECKHAND", line: "A BOAT THAT THROWS BY ITSELF" },
  { at: 4, kind: "twin", name: "TWIN LAUNCHER", line: "YOU THROW TWO AT A TIME" },
  { at: 7, kind: "deck", name: "SECOND DECKHAND", line: "ANOTHER BOAT THROWING" },
  { at: 10, kind: "quick", name: "QUICK HANDS", line: "THE DECKHANDS THROW FASTER" },
  { at: 14, kind: "deck", name: "THIRD DECKHAND", line: "A FLEET" },
];

const NAMES = ["PUDDLE", "BILGE CRAB", "REEF GNASHER", "SEAWEED SAM", "THE BARNACLE", "SALT TOAD", "GULPER", "OLD ROPE", "THE SQUALL", "KELP KING", "BRINE BEAR", "THE TIDE", "STORM EEL", "IRON SHELL", "THE DEEP"];
/* Every fifth monster is a boss: it looks it (the screen gives it a crown),
 * and it is a little tougher again. */
export const BOSS_EVERY = 5;
const BOSS_HP = 1.25;

export type Monster = { n: number; name: string; boss: boolean; hp: number; max: number; born: number; seed: number };
export type PShot = { n: number; at: number; from: string; dmg: number; acc: number; kill: boolean; monster: number };
export type Ko = { n: number; name: string; boss: boolean; seed: number; at: number; xp: number };

export type PveView = {
  t: number;
  /* The bar, 0 to 1, and how near the pace is now. */
  charge: number;
  near: number;
  pace: number;
  target: number;
  /* What the rower's throw is worth now, at a perfect pace. */
  power: number;
  monster: Monster | null;
  /* The row's second the next monster comes. */
  nextAt: number;
  kills: number;
  shots: PShot[];
  kos: Ko[];
  xp: number;
  decks: number;
  twin: boolean;
  quick: boolean;
  /* The last thing recruited, and when. */
  crew: { crew: Crew; at: number } | null;
  /* Throws by the rower, and their average accuracy. */
  throws: number;
  accSum: number;
};

export const nearOf = (pace: number, target = TARGET): number => {
  if (!Number.isFinite(pace) || pace <= 40 || pace >= 600) return 0;
  const x = Math.max(0, Math.abs(pace - target) - PLATEAU);
  return Math.max(FLOOR, Math.exp(-x / FALL));
};

export const hpOf = (n: number): number => Math.round(HP0 * HP_GROW ** n * ((n + 1) % BOSS_EVERY === 0 ? BOSS_HP : 1));
export const powerOf = (kills: number): number => DMG0 * DMG_GROW ** kills;

export type Pve = { step(t: number, pace: number): PveView; view(): PveView };

export function createPve({ t0, seed, target = TARGET }: { t0: number; seed: number; target?: number }): Pve {
  const rnd = prng(seed);
  const spawn = (n: number, at: number): Monster => {
    const hp = hpOf(n);
    return { n, name: NAMES[n % NAMES.length] + (n >= NAMES.length ? ` ${Math.floor(n / NAMES.length) + 1}` : ""), boss: (n + 1) % BOSS_EVERY === 0, hp, max: hp, born: at, seed: Math.floor(rnd() * 1e6) };
  };
  let last = t0;
  let accW = 0;
  let accT = 0;
  let deckClock: number[] = [];
  let v: PveView = { t: t0, charge: 0, near: 0, pace: 0, target, power: powerOf(0), monster: spawn(0, t0), nextAt: 0, kills: 0, shots: [], kos: [], xp: 0, decks: 0, twin: false, quick: false, crew: null, throws: 0, accSum: 0 };

  const hit = (at: number, from: string, dmg: number, acc: number) => {
    const m = v.monster;
    if (!m) return;
    const d = Math.max(1, Math.round(dmg));
    m.hp = Math.max(0, m.hp - d);
    const kill = m.hp <= 0;
    v.shots.push({ n: (v.shots[v.shots.length - 1]?.n ?? 0) + 1, at, from, dmg: d, acc, kill, monster: m.n });
    if (v.shots.length > 40) v.shots = v.shots.slice(-30);
    if (kill) {
      const xp = killXp(m.n);
      v.xp += xp;
      v.kos = [...v.kos.slice(-20), { n: m.n, name: m.name, boss: m.boss, seed: m.seed, at, xp }];
      v.kills++;
      v.power = powerOf(v.kills);
      v.monster = null;
      v.nextAt = at + RESPAWN_S;
      for (const c of CREW) {
        if (c.at !== v.kills) continue;
        if (c.kind === "deck") {
          v.decks++;
          deckClock.push(at + DECK_S * 0.5);
        } else if (c.kind === "twin") v.twin = true;
        else v.quick = true;
        v.crew = { crew: c, at };
      }
    }
  };

  return {
    view: () => v,
    step(t, pace) {
      v = { ...v, monster: v.monster ? { ...v.monster } : null, shots: [...v.shots] };
      /* A pause in the row's clock, or a jump, is not filled: a tick is
       * never more than eight seconds of the row (a demo at forty times a
       * clock is four a tick). */
      let dt = Math.max(0, Math.min(8, t - last));
      last = Math.max(last, t);
      const near = nearOf(pace, target);
      v.near = near;
      v.pace = pace;
      v.t = t;
      /* A tick at forty times a clock can hold more than one throw: the
       * bar is filled a throw at a time. */
      let now = t - dt;
      while (dt > 1e-9) {
        if (!v.monster && now >= v.nextAt) v.monster = spawn(v.kills, v.nextAt);
        const rate = near / FILL_S;
        const need = rate > 0 && !(v.charge >= 1 - 1e-9 && !v.monster) ? (1 - v.charge) / rate : Infinity;
        const step = Math.min(dt, need, !v.monster ? Math.max(1e-6, v.nextAt - now) : Infinity);
        v.charge = Math.min(1, v.charge + rate * step);
        accW += near * step;
        accT += step;
        now += step;
        dt -= step;
        if (v.charge >= 1 - 1e-9 && v.monster) {
          const acc = accT > 0 ? accW / accT : near;
          const dmg = v.power * (DMG_LEAST + (1 - DMG_LEAST) * acc);
          v.xp += throwXp(acc);
          v.throws++;
          v.accSum += acc;
          hit(now, "me", dmg, acc);
          if (v.twin && v.monster) hit(now, "me2", dmg, acc);
          v.charge = 0;
          accW = 0;
          accT = 0;
        } else if (v.charge >= 1 - 1e-9) {
          /* Full with nothing to throw at: it holds until the next one. */
          v.charge = 1;
        }
      }
      /* The deckhands, by the row's clock, whatever the pace. */
      const every = v.quick ? DECK_S * 0.7 : DECK_S;
      deckClock = deckClock.map((at, i) => {
        let a = at;
        while (a <= t) {
          if (v.monster) hit(a, `deck${i + 1}`, v.power * DECK_SHARE, 1);
          else if (a < v.nextAt) {
            a = v.nextAt;
            continue;
          }
          a += every;
        }
        return a;
      });
      if (!v.monster && t >= v.nextAt) v.monster = spawn(v.kills, v.nextAt);
      return v;
    },
  };
}
