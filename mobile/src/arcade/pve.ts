import { prng } from "./rng";

/* 159, SINGLE PLAYER: THE COURSE (owner, 2026-11-24, first version that
 * afternoon; this one from his notes after it the same day).
 *
 *   "I should have to go through like 3 monsters worth of battles with my
 *   1 HP bar, and then maybe the 4th one is a boss ... after I beat this
 *   section of the course, my HP gets restored ... if I die, I just restart
 *   back to the beginning."
 *
 * THE COURSE is stages of four: three of one kind of monster, each in a
 * skin of its own, then that kind's boss, which has more health and hits
 * harder. Beat the boss and the hull is mended to full. The monsters HIT
 * BACK, on a clock, whatever the rower does: the hull is the rower's one
 * health bar for the stage. Out of hull is WRECKED: back to the first
 * monster with a full hull, keeping the coins and XP the run made (for now
 * "we can just let them replay").
 *
 * SKILLS, three charging at once (his word for the weapons): a quick one
 * (fills in a second), a middle one (three) and a heavy one (eight or
 * more), each "fill[s] up in 1 second if you're rowing at the pace that
 * you're rowing at", so the target is THE ROWER'S OWN PACE (their median
 * 5K, `own`), and slower than that is harder. A skill can carry a
 * DIFFICULTY INDEX, a z: its target is `own - z * SIGMA`, faster than the
 * rower's pace, and it hits harder for it. Which skills a row gets is rolled
 * (one of two in each slot).
 *
 * EVERYTHING IS IN METERS ("how many meters ... a person is supposed to
 * take to beat"). At the rower's own pace the three skills together do one
 * point of damage for every meter rowed, so a monster's health IS the
 * meters it takes, and the COINS a monster gives are the damage done to it
 * ("coins for defeating a monster is the amount of damage that you did to
 * it, which is the amount of meters rowed"). Coins buy the boat's upgrades
 * between rows (boat.ts).
 *
 * INFINITE, a clicker's curve: each monster has HP_GROW more health than the
 * last, and each kill in a run makes the rower's skills DMG_GROW harder, so
 * the meters each monster takes go up by about 4.7% a monster
 * (HP_GROW / DMG_GROW), a stage by about a fifth. The hull's damage is by
 * the clock, so a stage that takes longer costs more hull: at their own
 * pace and with no upgrades a rower gets through three stages and is
 * wrecked in the fourth. Upgrades push that on.
 *
 * NO HANDS: "The user gets no input on the screen while they're rowing."
 * The pace is the only input (the last four seconds of the row's own
 * meters); stroke rate and the force curve are for later.
 *
 * Pure, as the rest of the arcade is: told the row's seconds and the pace,
 * it answers. The show (show.ts) runs it between the intro and the finale;
 * the screen is screens/Show.tsx (Battle); scripts/pve-check.ts rows whole
 * pieces through it. */

/* The pace of a row with no 5Ks to judge by (the owner's "159"). */
export const TARGET = 119;
/* Seconds of pace one step of the difficulty index is worth, for a rower
 * with no spread of their own to go by. */
export const SIGMA = 3;
/* How a skill's fill falls off below its target: full within PLATEAU
 * seconds, then down by e every FALL seconds; never under FLOOR while the
 * boat moves. Faster than the target fills faster, up to FAST_MAX. */
export const PLATEAU = 1.5;
export const FALL = 7;
export const FLOOR = 0.15;
const FAST_MAX = 1.3;
const FAST_S = 15;

/* ---- the course, in meters ---- */
/* The first monster's health: the meters it takes at the rower's pace. */
export const M0 = 250;
export const HP_GROW = 1.12;
export const DMG_GROW = 1.07;
/* A boss has this much more health than a monster in its place would. */
export const BOSS_HP = 2.2;
export const PER_STAGE = 4;
/* The hull, and the monsters' hits: one every ATK_S seconds of the row, at
 * ATK hull a second (more for a boss), for a rower at V_REF m/s, scaled to
 * the rower's own speed so a slower rower's longer fight is fair. */
export const HULL0 = 500;
export const ATK_S = 3;
export const ATK = 0.8;
export const BOSS_ATK = 1.5;
const V_REF = 500 / 119;
/* The row's seconds between a kill and the next monster; after a wreck. */
export const RESPAWN_S = 2.5;
export const WRECK_S = 6;

/* XP: a kill's, and a stage's. */
export const killXp = (i: number, boss: boolean): number => (boss ? 80 : 25) + 5 * i;
export const clearXp = (stage: number): number => 100 + 50 * stage;

/* ---- the skills ---- */
export type SkillDef = {
  id: string;
  name: string;
  /* 0 quick, 1 middle, 2 heavy. */
  slot: 0 | 1 | 2;
  /* Seconds to fill at its target. */
  fill: number;
  /* The difficulty index. */
  z: number;
  line: string;
};
/* Of the damage a meter does, each slot's share. */
const SHARE = [0.25, 0.35, 0.4];
/* What a step of the index adds to a skill's hits. */
const Z_BONUS = 0.5;
export const SKILLS: SkillDef[] = [
  { id: "jab", name: "JAB", slot: 0, fill: 1, z: 0, line: "FILLS IN A SECOND AT YOUR PACE" },
  { id: "flick", name: "FLICK", slot: 0, fill: 1, z: 1, line: "A SECOND, A LITTLE FASTER THAN YOUR PACE" },
  { id: "throw", name: "THROW", slot: 1, fill: 3, z: 0, line: "THREE SECONDS AT YOUR PACE" },
  { id: "spear", name: "SPEAR", slot: 1, fill: 3, z: 1, line: "THREE SECONDS, FASTER THAN YOUR PACE" },
  { id: "cannon", name: "CANNON", slot: 2, fill: 8, z: 0, line: "EIGHT SECONDS, A BIG HIT" },
  { id: "anchor", name: "ANCHOR", slot: 2, fill: 10, z: 1.5, line: "TEN SECONDS WELL UNDER YOUR PACE, THE BIGGEST HIT" },
];
export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

/* Three skills, one a slot, rolled. */
export function rollSkills(rnd: () => number): SkillDef[] {
  return [0, 1, 2].map((slot) => {
    const c = SKILLS.filter((s) => s.slot === slot);
    return c[Math.floor(rnd() * c.length) % c.length];
  });
}

/* The boat's upgrades (boat.ts), as levels. */
export type BoatLv = { dmg: number; hull: number; quick: number };
export const NO_UPGRADES: BoatLv = { dmg: 0, hull: 0, quick: 0 };
export const dmgMul = (lv: number): number => 1 + 0.12 * lv;
export const hullOf = (lv: number): number => Math.round(HULL0 * (1 + 0.15 * lv));
export const quickMul = (lv: number): number => Math.max(0.5, 1 - 0.06 * lv);

/* ---- the monsters ---- */
type Kind = { skins: string[]; boss: string };
const KINDS: Kind[] = [
  { skins: ["BILGE CRAB", "REEF CRAB", "SALT CRAB"], boss: "KING CRAB" },
  { skins: ["MUD GULPER", "MOSS GULPER", "PINK GULPER"], boss: "THE BIG GULP" },
  { skins: ["EEL", "STORM EEL", "SPARK EEL"], boss: "EEL QUEEN" },
  { skins: ["SEA TOAD", "BRINE TOAD", "SAND TOAD"], boss: "TOAD BARON" },
  { skins: ["KELP KNOT", "OLD ROPE", "NET GHOST"], boss: "THE TANGLE" },
];
export const stageOf = (i: number): number => Math.floor(i / PER_STAGE);
export const isBoss = (i: number): boolean => i % PER_STAGE === PER_STAGE - 1;
export const nameOf = (i: number): string => {
  const s = stageOf(i);
  const k = KINDS[s % KINDS.length];
  const lap = s >= KINDS.length ? ` ${Math.floor(s / KINDS.length) + 1}` : "";
  return (isBoss(i) ? k.boss : k.skins[i % PER_STAGE]) + lap;
};
/* The art (Monster.tsx): its shape is `n % 3` and its colour `n % 8`, so a
 * stage keeps one shape and each skin is a colour. */
export const artOf = (i: number): number => {
  const s = stageOf(i);
  return 9 * s + 3 * (i % PER_STAGE) + (s % 3);
};
/* A monster's health, in meters at the rower's pace (before the run's
 * growth). */
export const hpOf = (i: number): number => Math.round(M0 * HP_GROW ** i * (isBoss(i) ? BOSS_HP : 1));
export const powerOf = (kills: number): number => DMG_GROW ** kills;

/* How fast a skill fills against its target pace: 1 on it. */
export const nearOf = (pace: number, target = TARGET): number => {
  if (!Number.isFinite(pace) || pace <= 40 || pace >= 600) return 0;
  if (pace <= target) return Math.min(FAST_MAX, 1 + (target - pace) / FAST_S);
  const x = Math.max(0, pace - target - PLATEAU);
  return Math.max(FLOOR, Math.exp(-x / FALL));
};

export type Monster = { i: number; n: number; name: string; boss: boolean; stage: number; hp: number; max: number; born: number; seed: number; atkAt: number };
export type PShot = { n: number; at: number; from: string; slot: number; dmg: number; q: number; kill: boolean; monster: number };
/* A monster's hit on the hull. */
export type PHit = { n: number; at: number; dmg: number; boss: boolean };
export type Ko = { i: number; n: number; name: string; boss: boolean; seed: number; at: number; xp: number; coins: number };
export type PEvent = { kind: "clear" | "wreck"; at: number; stage: number };
export type SkillView = { def: SkillDef; charge: number; q: number; target: number; hit: number };

export type PveView = {
  t: number;
  pace: number;
  own: number;
  skills: SkillView[];
  /* The best of the skills' nearness now (for the colour of the pace). */
  near: number;
  hull: number;
  hullMax: number;
  monster: Monster | null;
  nextAt: number;
  /* The monster the run is on (0: the first), and its stage. */
  at: number;
  stage: number;
  /* The run's power (its kills' growth times the damage upgrade). */
  power: number;
  kills: number;
  bosses: number;
  /* The furthest stage reached, 1 for the first. */
  best: number;
  wrecks: number;
  coins: number;
  xp: number;
  shots: PShot[];
  hits: PHit[];
  kos: Ko[];
  event: PEvent | null;
};

export type Pve = { step(t: number, pace: number): PveView; view(): PveView };

/* `sigma`: the rower's own spread, one standard deviation of their 5K
 * paces (the profile's "Spread"), the step of the difficulty index; SIGMA
 * without one. */
export function createPve({ t0, seed, own = TARGET, sigma = SIGMA, boat = NO_UPGRADES, skills }: { t0: number; seed: number; own?: number; sigma?: number; boat?: BoatLv; skills?: SkillDef[] }): Pve {
  const rnd = prng(seed);
  const kit = skills ?? rollSkills(rnd);
  const vOwn = 500 / own;
  const atkScale = vOwn / V_REF;
  const up = dmgMul(boat.dmg);
  const fillMul = quickMul(boat.quick);
  const hullMax = hullOf(boat.hull);
  /* What one hit of a skill does at full power: its share of the meters
   * its fill takes at the rower's pace, and more for its index. */
  const hitOf = (d: SkillDef) => SHARE[d.slot] * d.fill * vOwn * (1 + Z_BONUS * d.z);
  const spawn = (i: number, at: number): Monster => {
    const hp = hpOf(i);
    return { i, n: artOf(i), name: nameOf(i), boss: isBoss(i), stage: stageOf(i), hp, max: hp, born: at, seed: Math.floor(rnd() * 1e6), atkAt: at + ATK_S };
  };
  let last = t0;
  let v: PveView = {
    t: t0,
    pace: 0,
    own,
    skills: kit.map((def) => ({ def, charge: 0, q: 0, target: own - def.z * sigma, hit: hitOf(def) })),
    near: 0,
    hull: hullMax,
    hullMax,
    monster: spawn(0, t0),
    nextAt: 0,
    at: 0,
    stage: 0,
    power: up,
    kills: 0,
    bosses: 0,
    best: 1,
    wrecks: 0,
    coins: 0,
    xp: 0,
    shots: [],
    hits: [],
    kos: [],
    event: null,
  };
  let runKills = 0;

  const shoot = (at: number, sv: SkillView) => {
    const m = v.monster;
    if (!m) return;
    const want = sv.hit * v.power;
    const d = Math.min(m.hp, want);
    m.hp = Math.max(0, m.hp - want);
    v.coins += d;
    const kill = m.hp <= 1e-6;
    v.shots.push({ n: (v.shots[v.shots.length - 1]?.n ?? 0) + 1, at, from: "me", slot: sv.def.slot, dmg: Math.max(1, Math.round(want)), q: sv.q, kill, monster: m.i });
    if (v.shots.length > 60) v.shots = v.shots.slice(-40);
    if (!kill) return;
    const xp = killXp(m.i, m.boss);
    v.xp += xp;
    v.kos = [...v.kos.slice(-20), { i: m.i, n: m.n, name: m.name, boss: m.boss, seed: m.seed, at, xp, coins: Math.round(m.max) }];
    v.kills++;
    runKills++;
    v.power = up * powerOf(runKills);
    v.monster = null;
    v.nextAt = at + RESPAWN_S;
    v.at = m.i + 1;
    if (m.boss) {
      /* The stage is beaten: the hull mended. */
      v.bosses++;
      v.xp += clearXp(m.stage);
      v.hull = v.hullMax;
      v.event = { kind: "clear", at, stage: m.stage };
    }
    v.stage = stageOf(v.at);
    v.best = Math.max(v.best, v.stage + 1);
  };

  const wreck = (at: number) => {
    v.wrecks++;
    v.event = { kind: "wreck", at, stage: v.stage };
    v.monster = null;
    v.at = 0;
    v.stage = 0;
    runKills = 0;
    v.power = up;
    v.hull = v.hullMax;
    v.nextAt = at + WRECK_S;
    for (const s of v.skills) s.charge = 0;
  };

  return {
    view: () => v,
    step(t, pace) {
      v = { ...v, monster: v.monster ? { ...v.monster } : null, shots: [...v.shots], hits: [...v.hits], skills: v.skills.map((s) => ({ ...s })) };
      /* A pause in the row's clock, or a jump, is not filled: a tick is
       * never more than eight seconds of the row. */
      let dt = Math.max(0, Math.min(8, t - last));
      last = Math.max(last, t);
      v.pace = pace;
      v.t = t;
      for (const s of v.skills) s.q = nearOf(pace, s.target);
      v.near = Math.max(...v.skills.map((s) => Math.min(1, s.q)));
      let now = t - dt;
      /* A tick can hold several hits at forty times a clock: it is stepped
       * to the next thing that happens, a full skill or a monster's hit. */
      while (dt > 1e-9) {
        if (!v.monster && now >= v.nextAt - 1e-9) v.monster = spawn(v.at, now);
        const m = v.monster;
        let step = dt;
        if (m) {
          for (const s of v.skills) {
            const rate = s.q / (s.def.fill * fillMul);
            if (rate > 0) step = Math.min(step, (1 - s.charge) / rate);
          }
          step = Math.min(step, Math.max(0, m.atkAt - now));
        } else step = Math.min(step, Math.max(1e-6, v.nextAt - now));
        step = Math.max(step, 1e-6);
        now += step;
        dt -= step;
        if (!m) continue;
        /* The skills fill only with something to throw at. */
        for (const s of v.skills) {
          s.charge = Math.min(1, s.charge + (s.q / (s.def.fill * fillMul)) * step);
          if (s.charge >= 1 - 1e-9 && v.monster) {
            shoot(now, s);
            s.charge = 0;
          }
        }
        /* The monster hits back. */
        const mm = v.monster;
        if (mm && now >= mm.atkAt - 1e-9) {
          const dmg = ATK * ATK_S * atkScale * (mm.boss ? BOSS_ATK : 1);
          v.hull = Math.max(0, v.hull - dmg);
          v.hits.push({ n: (v.hits[v.hits.length - 1]?.n ?? 0) + 1, at: now, dmg, boss: mm.boss });
          if (v.hits.length > 30) v.hits = v.hits.slice(-20);
          mm.atkAt += ATK_S;
          if (v.hull <= 1e-6) wreck(now);
        }
      }
      if (!v.monster && t >= v.nextAt) v.monster = spawn(v.at, v.nextAt);
      return v;
    },
  };
}
