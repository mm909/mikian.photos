import { prng } from "./rng";

/* 159, SINGLE PLAYER: THE COURSE, fourth build (2026-11-25), from the
 * owner's notes after a real 5K on the rower (the third build is in git):
 *
 *   "one full run = one 5K, about 20 minutes", with an end, "like Risk of
 *   Rain or Slay the Spire", and a PERMANENT POWER-UP for finishing it;
 *   "continue from where you left off" (the floor reached), not floor 1
 *   every row; out of hull early, "you keep rowing but can't finish the
 *   run";
 *   the skills' paces come from THE ROWER, not the floor: "green 2:00, blue
 *   1:59, red 1:58" for him, the hardest at about his median 5K; whole
 *   seconds always;
 *   the charge "too fast. One second is probably too fast": about 2, 5 and
 *   10 seconds of rowing at 2:00, "in meters";
 *   fights "about 10 s on early floors, about 100 m per enemy", a boss on
 *   every fifth floor, and A REST between fights: no health bar, nothing
 *   tied to how hard he rows;
 *   the feeling to keep: "I want to row a little faster so I can kill this
 *   monster and see what's next", within a second or two of split.
 *
 * A RUN is ten floors, a boss on the fifth and the tenth. Beat the tenth and
 * the run is done: a STAR (a permanent +STAR_DMG damage), and the next run
 * starts at floor 1 straight away, its rooms a little bigger. The floor the
 * row ended on is kept on the phone (run.ts), and the next row starts there
 * with a full hull. Out of hull is the run lost: the rest of the row is a
 * rest, and the next row starts a new run at floor 1.
 *
 * THE SKILLS, three, told apart by colour (green, blue, red; the names stay
 * in the code). Each has a pace: the rower's own (their median 5K, whole
 * seconds) plus its SLOW (green 2 s slower, blue 1, red 0), plus whole
 * seconds of EASE bought. It fills only at its pace or faster, by the
 * METERS rowed: FILL_M of them at its pace, quicker the more the pace beats
 * it (RISE_S, Q_MAX). Slower than its pace it stands still.
 *
 * DAMAGE IN METERS: with all three filling at their paces the skills do one
 * point a meter between them (SHARE), so a monster's health is the meters it
 * takes at that rate (its ROOM). Its hits on the hull come on a clock while
 * it stands, never in a rest, so the hull is a budget of time from boss to
 * boss (BUDGET_X of the stage's rooms at the rower's pace); a boss down
 * mends it.
 *
 * THE KICK-OUT (show.ts): at 250 m to go the course stops. A boss still
 * standing then can be finished: the fight goes on and the hull drains
 * (`overtime`) until one of them is out or the row ends.
 *
 * NO HANDS: the pace is the only input (the last four seconds of the row's
 * own meters). Pure: told the row's seconds and the pace, it answers;
 * scripts/pve-check.ts rows whole pieces through it. */

/* The pace of a row with no 5Ks to judge by (the owner's "159"). */
export const TARGET = 119;
/* Kept for the swarm's callers: one step of the old difficulty index. */
export const SIGMA = 3;
/* How much quicker than its pace a skill fills: Q_MAX times at most, at
 * RISE_S seconds under it. */
export const RISE_S = 6;
export const Q_MAX = 1.5;

/* ---- the run ---- */
export const PER_STAGE = 5;
export const RUN_FLOORS = 10;
/* A floor's room in meters (at a 5K's scale), by its place in the run: the
 * first four of a stage, then the boss. Rolled a little either way. */
const ROOM_A = [50, 65, 80, 95];
const ROOM_B = [360, 400, 440, 480];
const BOSS_A = 750;
const BOSS_B = 1300;
/* Every run done makes the next one's rooms this much bigger, and the
 * rower this much harder hitting (a STAR). */
export const RUN_GROW = 1.12;
export const STAR_DMG = 0.1;
/* THE REST after a fight, in meters: a share of the fight's room, between
 * the least and the most (scaled with the piece). */
const REST_SHARE = 0.35;
const REST_LEAST = 25;
const REST_MOST = 120;
/* The hull, and the monsters' hits: one every ATK_S seconds of a fight. */
export const HULL0 = 500;
export const ATK_S = 3;
export const BUDGET_X = 1.7;
export const BOSS_ATK = 1.2;
/* After the kick-out, a boss still standing: the hull drains so that a full
 * one lasts this many meters at the rower's pace. */
export const OVERTIME_M = 300;
/* The row's seconds a KO plays before the rest begins. */
export const KO_S = 1.2;

/* XP: a floor's, a boss's stage, a run done. */
export const killXp = (i: number, boss: boolean): number => (boss ? 80 : 25) + 5 * i;
export const clearXp = (stage: number): number => 100 + 50 * stage;
export const RUN_XP = 500;

/* ---- the skills ---- */
export type SkillDef = {
  id: string;
  name: string;
  /* 0 green (quick), 1 blue, 2 red (heavy). */
  slot: 0 | 1 | 2;
  /* Meters to fill at its pace. */
  fillM: number;
  /* Seconds to fill at 2:00 (the swarm's clock). */
  fill: number;
  /* Seconds slower than the rower's own pace it fills at. */
  slow: number;
  /* Its colour: what the screen calls it. */
  color: string;
};
/* Of the damage, each slot's share. */
const SHARE = [0.25, 0.35, 0.4];
const M_AT_200 = 500 / 120;
const skill = (id: string, name: string, slot: 0 | 1 | 2, seconds: number, slow: number, color: string): SkillDef => ({ id, name, slot, fillM: Math.round(seconds * M_AT_200), fill: seconds, slow, color });
export const SKILL_COLOR = ["#2BB673", "#0077B6", "#E2725B"];
export const SKILLS: SkillDef[] = [
  skill("jab", "JAB", 0, 2, 2, SKILL_COLOR[0]),
  skill("spear", "SPEAR", 1, 5, 1, SKILL_COLOR[1]),
  skill("anchor", "ANCHOR", 2, 10, 0, SKILL_COLOR[2]),
];
export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
/* THE KIT EVERY ROW PLAYS: green, blue, red. */
export const KIT: SkillDef[] = SKILLS;
/* Kept for the swarm: one a slot. */
export const rollSkills = (_rnd: () => number): SkillDef[] => KIT;

/* The boat's upgrades (boat.ts), as levels. EASE: every skill's pace a
 * second slower for every two levels (paces are whole seconds). */
export type BoatLv = { dmg: number; hull: number; quick: number; ease: number };
export const NO_UPGRADES: BoatLv = { dmg: 0, hull: 0, quick: 0, ease: 0 };
export const dmgMul = (lv: number): number => 1 + 0.12 * lv;
export const hullOf = (lv: number): number => Math.round(HULL0 * (1 + 0.15 * lv));
export const quickMul = (lv: number): number => Math.max(0.5, 1 - 0.06 * lv);
export const easeOf = (lv: number): number => Math.floor(0.5 * (lv || 0));
/* The rower's three paces, whole seconds: green, blue, red. */
export const pacesOf = (own: number, ease = 0): number[] => KIT.map((d) => Math.round(own) + d.slow + easeOf(ease));

/* ---- the monsters ---- */
type Kind = { skins: string[]; boss: string };
const KINDS: Kind[] = [
  { skins: ["BILGE CRAB", "REEF CRAB", "SALT CRAB", "ROCK CRAB"], boss: "KING CRAB" },
  { skins: ["MUD GULPER", "MOSS GULPER", "PINK GULPER", "DEEP GULPER"], boss: "THE BIG GULP" },
  { skins: ["EEL", "STORM EEL", "SPARK EEL", "GLASS EEL"], boss: "EEL QUEEN" },
  { skins: ["SEA TOAD", "BRINE TOAD", "SAND TOAD", "MARSH TOAD"], boss: "TOAD BARON" },
  { skins: ["KELP KNOT", "OLD ROPE", "NET GHOST", "DRIFT LINE"], boss: "THE TANGLE" },
];
/* `i` is the floor in the run, 0 for floor 1; `run` the runs done before. */
export const stageOf = (i: number): number => Math.floor(i / PER_STAGE);
export const isBoss = (i: number): boolean => i % PER_STAGE === PER_STAGE - 1;
export const floorOf = (i: number): number => i + 1;
/* The kinds go on run to run: a run's two stages are two kinds. */
const kindOf = (i: number, run: number): number => (2 * run + stageOf(i)) % KINDS.length;
export const nameOf = (i: number, run = 0): string => {
  const k = KINDS[kindOf(i, run)];
  return isBoss(i) ? k.boss : k.skins[i % PER_STAGE];
};
/* The art (Monster.tsx): its shape is `n % 3` and its colour `n % 8`. */
export const artOf = (i: number, run = 0): number => {
  const s = kindOf(i, run);
  return 9 * s + 3 * (i % PER_STAGE) + (s % 3);
};
/* A floor's room in meters at a 5K's scale. */
export const roomOf = (i: number, seed: number, run = 0): number => {
  const grow = RUN_GROW ** run;
  const st = stageOf(i);
  if (isBoss(i)) return Math.round((st ? BOSS_B : BOSS_A) * grow);
  const r = prng(seed * 31 + i * 7919 + run * 104729)();
  const base = (st ? ROOM_B : ROOM_A)[i % PER_STAGE];
  return Math.round(base * (0.88 + 0.24 * r) * grow);
};
export const restOf = (room: number, scale = 1): number => Math.max(REST_LEAST * Math.max(0.5, scale), Math.min(REST_MOST * scale, room * REST_SHARE));

/* How fast a skill fills against its pace: none slower than it, 1 on it,
 * up to Q_MAX faster. */
export const fillOf = (pace: number, target: number): number => {
  if (!Number.isFinite(pace) || pace <= 40 || pace >= 600) return 0;
  if (pace > target + 0.5) return 0;
  return Math.min(Q_MAX, 1 + Math.max(0, target + 0.5 - pace) / RISE_S);
};
/* What one hit of a skill does: its share of a point a meter. */
export const hitOf = (d: SkillDef): number => SHARE[d.slot] * d.fillM;
/* A skill's view at the rower's red pace `base`. */
export const skillAt = (def: SkillDef, base: number, charge = 0): SkillView => ({ def, charge, q: 0, target: base + def.slow, hit: hitOf(def) });

export type Monster = { i: number; n: number; name: string; boss: boolean; stage: number; floor: number; hp: number; max: number; born: number; seed: number; atkAt: number; atk: number; room: number };
export type PShot = { n: number; at: number; from: string; slot: number; dmg: number; q: number; kill: boolean; monster: number };
/* A monster's hit on the hull (`dot`: the overtime's drain, no throw). */
export type PHit = { n: number; at: number; dmg: number; boss: boolean; dot?: boolean };
export type Ko = { i: number; n: number; name: string; boss: boolean; seed: number; at: number; xp: number; floor: number };
/* A floor beaten, a boss beaten (clear), the run done, the run lost. */
export type PEvent = { kind: "floor" | "clear" | "run" | "wreck"; at: number; stage: number; floor: number };
export type SkillView = { def: SkillDef; charge: number; q: number; target: number; hit: number };
export type Loot = { kind: "box" | "boss"; floor: number; at: number };

export type PveView = {
  t: number;
  pace: number;
  own: number;
  /* The red pace (the rower's own, eased). */
  floorPace: number;
  skills: SkillView[];
  near: number;
  hull: number;
  hullMax: number;
  monster: Monster | null;
  /* THE REST: the meters it began and ends at; 0 when there is none. */
  restFrom: number;
  restTo: number;
  /* The floor the run is on (0: floor 1), its stage, and the runs done. */
  at: number;
  stage: number;
  run: number;
  /* Runs finished this row (each a star). */
  runsDone: number;
  power: number;
  kills: number;
  bosses: number;
  best: number;
  /* The run was lost this row: the rest of the row is a rest. */
  lost: boolean;
  wrecks: number;
  /* The kick-out: no new monster; a standing boss drains the hull. */
  out: boolean;
  overtime: boolean;
  xp: number;
  /* A box for every monster down, a boss's rarer. */
  loot: Loot[];
  shots: PShot[];
  hits: PHit[];
  kos: Ko[];
  event: PEvent | null;
  events: number;
};

export type Pve = {
  step(t: number, pace: number, m: number): PveView;
  view(): PveView;
  rest(t: number): void;
  /* THE KICK-OUT: no more monsters; a boss still up fights on in overtime. */
  kickOut(t: number): void;
};

/* `scale`: the share of a 5K the show is cut to; rooms are cut with it.
 * `from`: the floor and run the rower's last row reached (run.ts).
 * `stars`: runs finished before, each a STAR_DMG more damage. */
export function createPve({ t0, m0 = 0, seed, own = TARGET, boat = NO_UPGRADES, scale = 1, from = { at: 0, run: 0 }, stars = 0 }: { t0: number; m0?: number; seed: number; own?: number; sigma?: number; boat?: BoatLv; skills?: SkillDef[]; scale?: number; from?: { at: number; run: number }; stars?: number }): Pve {
  const rnd = prng(seed);
  const ownW = Math.round(own);
  const base = ownW + easeOf(boat.ease ?? 0);
  const fillMul = quickMul(boat.quick);
  const hullMax = hullOf(boat.hull);
  const course = seed % 100000;
  const speedOwn = 500 / ownW;
  /* The hits of a stage: the hull lasts BUDGET_X of its rooms' time at the
   * rower's own pace. */
  const atkOf = (i: number, run: number): number => {
    const st = stageOf(i) * PER_STAGE;
    let m = 0;
    for (let j = st; j < st + PER_STAGE; j++) m += roomOf(j, course, run) * scale;
    const secs = (BUDGET_X * m) / speedOwn;
    return ((hullMax * ATK_S) / secs) * (isBoss(i) ? BOSS_ATK : 1);
  };
  const spawn = (i: number, run: number, at: number): Monster => {
    const room = roomOf(i, course, run) * scale;
    return { i, n: artOf(i, run), name: nameOf(i, run), boss: isBoss(i), stage: stageOf(i), floor: floorOf(i), hp: room, max: room, born: at, seed: Math.floor(rnd() * 1e6), atkAt: at + ATK_S, atk: atkOf(i, run), room };
  };
  const at0 = Math.max(0, Math.min(RUN_FLOORS - 1, Math.floor(from.at)));
  let last = t0;
  let lastM = m0;
  /* When the rest ends: the meters, and a KO's beat first (the row's
   * second). */
  let readyAt = t0;
  let v: PveView = {
    t: t0,
    pace: 0,
    own: ownW,
    floorPace: base,
    skills: KIT.map((def) => skillAt(def, base)),
    near: 0,
    hull: hullMax,
    hullMax,
    monster: spawn(at0, from.run, t0),
    restFrom: 0,
    restTo: 0,
    at: at0,
    stage: stageOf(at0),
    run: from.run,
    runsDone: 0,
    power: dmgMul(boat.dmg) * (1 + STAR_DMG * stars),
    kills: 0,
    bosses: 0,
    best: at0 + 1,
    lost: false,
    wrecks: 0,
    out: false,
    overtime: false,
    xp: 0,
    loot: [],
    shots: [],
    hits: [],
    kos: [],
    event: null,
    events: 0,
  };

  const shoot = (at: number, m: number, sv: SkillView) => {
    const mo = v.monster;
    if (!mo) return;
    const want = sv.hit * v.power;
    mo.hp = Math.max(0, mo.hp - want);
    const kill = mo.hp <= 1e-6;
    v.shots.push({ n: (v.shots[v.shots.length - 1]?.n ?? 0) + 1, at, from: "me", slot: sv.def.slot, dmg: Math.max(1, Math.round(want)), q: sv.q, kill, monster: mo.i });
    if (v.shots.length > 60) v.shots = v.shots.slice(-40);
    if (!kill) return;
    const xp = killXp(mo.i, mo.boss);
    v.xp += xp;
    v.kos = [...v.kos.slice(-20), { i: mo.i, n: mo.n, name: mo.name, boss: mo.boss, seed: mo.seed, at, xp, floor: mo.floor }];
    v.loot = [...v.loot, { kind: mo.boss ? "boss" : "box", floor: mo.floor, at }];
    v.kills++;
    v.events++;
    v.monster = null;
    v.overtime = false;
    if (mo.boss) {
      v.bosses++;
      v.xp += clearXp(mo.stage);
      v.hull = v.hullMax;
    }
    if (mo.i >= RUN_FLOORS - 1) {
      /* THE RUN IS DONE: a star, and the next run from floor 1. */
      v.runsDone++;
      v.xp += RUN_XP;
      v.power *= 1 + STAR_DMG;
      v.event = { kind: "run", at, stage: mo.stage, floor: mo.floor };
      v.run++;
      v.at = 0;
    } else {
      v.event = { kind: mo.boss ? "clear" : "floor", at, stage: mo.stage, floor: mo.floor };
      v.at = mo.i + 1;
    }
    v.stage = stageOf(v.at);
    v.best = Math.max(v.best, mo.floor + 1);
    /* The rest, after the KO's beat. */
    const rest = restOf(mo.room, scale) * (v.event.kind === "run" ? 2 : 1);
    v.restFrom = m;
    v.restTo = m + rest;
    readyAt = at + KO_S;
    for (const s of v.skills) s.charge = 0;
  };

  const wreck = (at: number) => {
    v.wrecks++;
    v.lost = true;
    v.overtime = false;
    v.event = { kind: "wreck", at, stage: v.stage, floor: v.at + 1 };
    v.monster = null;
    v.restFrom = 0;
    v.restTo = 0;
    for (const s of v.skills) s.charge = 0;
  };

  return {
    view: () => v,
    rest(t) {
      const gap = t - last;
      v = { ...v, events: 0 };
      if (gap <= 0) return;
      v = { ...v, monster: v.monster ? { ...v.monster, atkAt: v.monster.atkAt + gap } : null };
      last = t;
    },
    kickOut(t) {
      v = { ...v, out: true };
      if (v.monster?.boss && !v.lost) v = { ...v, overtime: true };
      else if (v.monster) v = { ...v, monster: null };
      v.restFrom = 0;
      v.restTo = 0;
      last = Math.max(last, t);
    },
    step(t, pace, m) {
      v = { ...v, monster: v.monster ? { ...v.monster } : null, shots: [...v.shots], hits: [...v.hits], skills: v.skills.map((s) => ({ ...s })) };
      let dt = Math.max(0, Math.min(8, t - last));
      const dm = Math.max(0, m - lastM);
      last = Math.max(last, t);
      lastM = Math.max(lastM, m);
      v.pace = pace;
      v.t = t;
      const qs = () => {
        for (const s of v.skills) s.q = v.monster ? fillOf(pace, s.target) : 0;
        v.near = Math.max(...v.skills.map((s) => Math.min(1, s.q)));
      };
      /* The rest over: the next floor. */
      if (!v.monster && !v.lost && !v.out && t >= readyAt && m >= v.restTo) {
        v.monster = spawn(v.at, v.run, t);
        v.restFrom = 0;
        v.restTo = 0;
      }
      qs();
      if (!v.monster || dt <= 0) return v;
      /* The meters of this tick, spread over its seconds. */
      const mps = dt > 0 ? dm / dt : 0;
      let now = t - dt;
      while (dt > 1e-9 && v.monster) {
        const mo = v.monster;
        let step = dt;
        for (const s of v.skills) {
          const rate = (s.q * mps) / (s.def.fillM * fillMul);
          if (rate > 0) step = Math.min(step, (1 - s.charge) / rate);
        }
        if (!v.overtime) step = Math.min(step, Math.max(0, mo.atkAt - now));
        step = Math.max(step, 1e-6);
        now += step;
        dt -= step;
        const mNow = m - dt * mps;
        for (const s of v.skills) {
          s.charge = Math.min(1, s.charge + ((s.q * mps) / (s.def.fillM * fillMul)) * step);
          if (s.charge >= 1 - 1e-9 && v.monster) {
            shoot(now, mNow, s);
            s.charge = 0;
          }
        }
        const mm = v.monster;
        if (!mm) break;
        if (v.overtime) {
          /* OVERTIME: the hull drains by the second. */
          const drain = (v.hullMax / (OVERTIME_M * scale / speedOwn)) * step;
          v.hull = Math.max(0, v.hull - drain);
          if (now >= mm.atkAt - 1e-9) {
            v.hits.push({ n: (v.hits[v.hits.length - 1]?.n ?? 0) + 1, at: now, dmg: (v.hullMax / (OVERTIME_M * scale / speedOwn)) * ATK_S, boss: true, dot: true });
            if (v.hits.length > 30) v.hits = v.hits.slice(-20);
            mm.atkAt += ATK_S;
          }
          if (v.hull <= 1e-6) wreck(now);
        } else if (now >= mm.atkAt - 1e-9) {
          v.hull = Math.max(0, v.hull - mm.atk);
          v.hits.push({ n: (v.hits[v.hits.length - 1]?.n ?? 0) + 1, at: now, dmg: mm.atk, boss: mm.boss });
          if (v.hits.length > 30) v.hits = v.hits.slice(-20);
          mm.atkAt += ATK_S;
          if (v.hull <= 1e-6) wreck(now);
        }
      }
      qs();
      return v;
    },
  };
}
