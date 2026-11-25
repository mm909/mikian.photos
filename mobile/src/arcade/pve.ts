import { prng } from "./rng";

/* 159, SINGLE PLAYER: THE COURSE. First built the afternoon of 2026-11-24;
 * rebuilt that evening from his notes ("3 monsters worth of battles with my
 * 1 HP bar, and then maybe the 4th one is a boss ... if I die, I just
 * restart back to the beginning"); and this, the third, from his review of
 * that one the same night:
 *
 *   "floor 1, king crab, floor 2" ... a boss on every fifth floor;
 *   "the boss having a pace that sets how hard your skills are ... you row
 *   this boss at 1:58 instead of 1:59 ... it can go up, it can go down,
 *   relatively random within a reasonable range";
 *   a skill "can't rise below its pace and rises faster the more you beat
 *   it" ("I'm never rowing a 1:47 casually");
 *   rooms sized in meters behind the scenes, "some 500, 1,000, 1,500, 2,000,
 *   2,500";
 *   "coins are just meters rowed during the game for now" (show.ts counts
 *   them; the course no longer does).
 *
 * THE COURSE is FLOORS, one monster a floor, and every fifth floor is that
 * kind's BOSS. Each floor has A PACE OF ITS OWN, rolled: the rower's own
 * pace (their median 5K) give or take a few seconds, a boss's a little
 * faster. Every skill keys off the floor's pace. Beat the boss and the hull
 * is mended. The monsters HIT BACK on a clock, whatever the rower does: the
 * hull is the rower's one health bar from boss to boss. Out of hull is
 * WRECKED: back to floor 1 with a full hull, keeping the XP the run made.
 *
 * SKILLS, three charging at once: a quick one (fills in a second), a middle
 * one (three) and a heavy one (eight or ten). Each has a pace: the floor's
 * pace less its OFFSET (JAB a second slower than the floor's, SPEAR at it,
 * ANCHOR a second faster), and it FILLS ONLY AT ITS PACE OR FASTER: at its pace
 * in its own time, and faster the more the rower beats it (RISE_S). Slower
 * than its pace it stands still. A skill a second harder hits a fifth
 * harder (OFF_BONUS).
 *
 * ROOMS IN METERS: a monster's health is about the meters it takes at its
 * floor's pace (ROOMS; a boss's BOSS_ROOM), cut to the show's scale for a
 * piece shorter than a 5K, and a fifth more every five floors
 * (LAP_GROW): a clicker's curve, with no end. The monsters' hits come on a
 * clock, so the hull is a budget of time from boss to boss (BUDGET_M):
 * a rower who sits under a skill's pace gets nowhere and is wrecked.
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
/* Kept for the swarm's callers: one step of the old difficulty index. */
export const SIGMA = 3;
/* How much faster than its pace a skill fills: twice as fast RISE_S
 * seconds under it, at most Q_MAX times. */
export const RISE_S = 3;
export const Q_MAX = 2;

/* ---- the course, in meters ---- */
export const PER_STAGE = 5;
/* A floor's room, in meters at its pace (at a 5K's scale); a boss's. */
export const ROOMS = [500, 600, 750];
export const BOSS_ROOM = 1500;
export const LAP_GROW = 1.2;
/* The health of a room of `m` meters (the share of a meter's damage the
 * three skills do on average at the floor's pace). */
const HP_PER_M = 0.7;
/* The floors' paces: the rower's pace plus one of these (seconds slower
 * is easier); a boss's. */
export const FLOOR_MOD = [0, 1, 2, 3, 4];
export const BOSS_MOD = [-1, 0, 1, 2];
/* The hull, and the monsters' hits: one every ATK_S seconds of the row, on
 * a clock, so the hull is a budget of time: HULL0 lasts the time it takes
 * to row BUDGET_M (at a 5K's scale) at the rower's own pace, and a boss
 * hits BOSS_ATK times as hard. */
export const HULL0 = 500;
export const ATK_S = 3;
export const BUDGET_M = 3300;
export const BOSS_ATK = 1.2;
/* The row's seconds between a kill and the next floor; after a wreck. */
export const RESPAWN_S = 2.5;
export const WRECK_S = 6;

/* XP: a floor's, and a boss's stage. */
export const killXp = (i: number, boss: boolean): number => (boss ? 80 : 25) + 5 * i;
export const clearXp = (stage: number): number => 100 + 50 * stage;

/* ---- the skills ---- */
export type SkillDef = {
  id: string;
  name: string;
  /* 0 quick, 1 middle, 2 heavy. */
  slot: 0 | 1 | 2;
  /* Seconds to fill at its pace. */
  fill: number;
  /* Seconds faster than the floor's pace it fills at (a second slower: -1). */
  off: number;
  line: string;
};
/* Of the damage, each slot's share. */
const SHARE = [0.25, 0.35, 0.4];
/* What a second harder adds to a skill's hits. */
const OFF_BONUS = 0.2;
export const SKILLS: SkillDef[] = [
  { id: "jab", name: "JAB", slot: 0, fill: 1, off: -1, line: "A SECOND, AT A SECOND SLOWER THAN THE FLOOR'S PACE" },
  { id: "flick", name: "FLICK", slot: 0, fill: 1, off: 0, line: "A SECOND, AT THE FLOOR'S PACE" },
  { id: "throw", name: "THROW", slot: 1, fill: 3, off: 0, line: "THREE SECONDS AT THE FLOOR'S PACE" },
  { id: "spear", name: "SPEAR", slot: 1, fill: 3, off: 0, line: "THREE SECONDS AT THE FLOOR'S PACE" },
  { id: "cannon", name: "CANNON", slot: 2, fill: 8, off: 1, line: "EIGHT SECONDS, A SECOND UNDER, A BIG HIT" },
  { id: "anchor", name: "ANCHOR", slot: 2, fill: 10, off: 1, line: "TEN SECONDS, A SECOND UNDER, THE BIGGEST HIT" },
];
export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));

/* THE KIT EVERY ROW PLAYS (owner, 2026-11-24: "jab, spear and anchor as
 * three boxes"; one name for each slot, the same every row). The other
 * three are kept for when a slot is picked. */
export const KIT: SkillDef[] = [SKILL_BY_ID.jab, SKILL_BY_ID.spear, SKILL_BY_ID.anchor];

/* Three skills, one a slot, rolled. */
export function rollSkills(rnd: () => number): SkillDef[] {
  return [0, 1, 2].map((slot) => {
    const c = SKILLS.filter((s) => s.slot === slot);
    return c[Math.floor(rnd() * c.length) % c.length];
  });
}

/* The boat's upgrades (boat.ts), as levels. EASE: every floor's pace a
 * half second slower ("purchases can make the modifiers easier"). */
export type BoatLv = { dmg: number; hull: number; quick: number; ease: number };
export const NO_UPGRADES: BoatLv = { dmg: 0, hull: 0, quick: 0, ease: 0 };
export const dmgMul = (lv: number): number => 1 + 0.12 * lv;
export const hullOf = (lv: number): number => Math.round(HULL0 * (1 + 0.15 * lv));
export const quickMul = (lv: number): number => Math.max(0.5, 1 - 0.06 * lv);
export const easeOf = (lv: number): number => 0.5 * (lv || 0);

/* ---- the monsters ---- */
type Kind = { skins: string[]; boss: string };
const KINDS: Kind[] = [
  { skins: ["BILGE CRAB", "REEF CRAB", "SALT CRAB", "ROCK CRAB"], boss: "KING CRAB" },
  { skins: ["MUD GULPER", "MOSS GULPER", "PINK GULPER", "DEEP GULPER"], boss: "THE BIG GULP" },
  { skins: ["EEL", "STORM EEL", "SPARK EEL", "GLASS EEL"], boss: "EEL QUEEN" },
  { skins: ["SEA TOAD", "BRINE TOAD", "SAND TOAD", "MARSH TOAD"], boss: "TOAD BARON" },
  { skins: ["KELP KNOT", "OLD ROPE", "NET GHOST", "DRIFT LINE"], boss: "THE TANGLE" },
];
export const stageOf = (i: number): number => Math.floor(i / PER_STAGE);
export const isBoss = (i: number): boolean => i % PER_STAGE === PER_STAGE - 1;
export const floorOf = (i: number): number => i + 1;
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
/* A floor's room in meters at a 5K's scale, rolled off the course's seed. */
export const roomOf = (i: number, seed: number): number => {
  const lap = LAP_GROW ** stageOf(i);
  if (isBoss(i)) return Math.round(BOSS_ROOM * lap);
  const r = prng(seed * 31 + i * 7919)();
  return Math.round(ROOMS[Math.floor(r * ROOMS.length) % ROOMS.length] * lap);
};
/* A floor's pace: the rower's own and its roll, less the EASE bought. */
export const floorPaceOf = (i: number, seed: number, own: number, ease = 0): number => {
  const r = prng(seed * 17 + i * 104729)();
  const mods = isBoss(i) ? BOSS_MOD : FLOOR_MOD;
  return own + mods[Math.floor(r * mods.length) % mods.length] + easeOf(ease);
};

/* How fast a skill fills against its pace: none slower than it, 1 on it,
 * up to Q_MAX faster. */
export const fillOf = (pace: number, target: number): number => {
  if (!Number.isFinite(pace) || pace <= 40 || pace >= 600) return 0;
  if (pace > target + 1e-6) return 0;
  return Math.min(Q_MAX, 1 + (target - pace) / RISE_S);
};
/* What one hit of a skill does, at the floor's pace `fp`. */
export const hitOf = (d: SkillDef, fp: number): number => SHARE[d.slot] * d.fill * (500 / fp) * (1 + OFF_BONUS * (d.off + 1));
/* Each skill's view at a floor's pace. */
export const skillAt = (def: SkillDef, fp: number, charge = 0): SkillView => ({ def, charge, q: 0, target: fp - def.off, hit: hitOf(def, fp) });

export type Monster = { i: number; n: number; name: string; boss: boolean; stage: number; floor: number; hp: number; max: number; born: number; seed: number; atkAt: number; atk: number; pace: number; room: number };
export type PShot = { n: number; at: number; from: string; slot: number; dmg: number; q: number; kill: boolean; monster: number };
/* A monster's hit on the hull. */
export type PHit = { n: number; at: number; dmg: number; boss: boolean };
export type Ko = { i: number; n: number; name: string; boss: boolean; seed: number; at: number; xp: number; floor: number };
/* A floor beaten, a boss beaten (clear), a wreck. */
export type PEvent = { kind: "floor" | "clear" | "wreck"; at: number; stage: number; floor: number };
export type SkillView = { def: SkillDef; charge: number; q: number; target: number; hit: number };

export type PveView = {
  t: number;
  pace: number;
  own: number;
  /* The floor's pace now (its monster's, or the next one's). */
  floorPace: number;
  skills: SkillView[];
  /* Whether any skill is filling now. */
  near: number;
  hull: number;
  hullMax: number;
  monster: Monster | null;
  nextAt: number;
  /* The floor the run is on (0: floor 1), and its stage of five. */
  at: number;
  stage: number;
  power: number;
  kills: number;
  bosses: number;
  /* The furthest floor reached, 1 for the first. */
  best: number;
  wrecks: number;
  xp: number;
  shots: PShot[];
  hits: PHit[];
  kos: Ko[];
  event: PEvent | null;
  /* Floors beaten since the last wreck or swarm (the director's count). */
  events: number;
};

/* `rest(t)`: the course was put aside (the swarm, show.ts) and is taken
 * up again at the row's second `t`: the time between is not fought. */
export type Pve = { step(t: number, pace: number): PveView; view(): PveView; rest(t: number): void };

/* `scale`: the share of a 5K the show is cut to; rooms are cut with it. */
export function createPve({ t0, seed, own = TARGET, boat = NO_UPGRADES, skills, scale = 1 }: { t0: number; seed: number; own?: number; sigma?: number; boat?: BoatLv; skills?: SkillDef[]; scale?: number }): Pve {
  const rnd = prng(seed);
  const kit = skills ?? KIT;
  const up = dmgMul(boat.dmg);
  const fillMul = quickMul(boat.quick);
  const hullMax = hullOf(boat.hull);
  const course = seed % 100000;
  const budgetS = (BUDGET_M * scale) / (500 / own);
  const spawn = (i: number, at: number): Monster => {
    const room = roomOf(i, course) * scale;
    const hp = room * HP_PER_M;
    const pace = floorPaceOf(i, course, own, boat.ease ?? 0);
    const atk = ((HULL0 * ATK_S) / budgetS) * (isBoss(i) ? BOSS_ATK : 1);
    return { i, n: artOf(i), name: nameOf(i), boss: isBoss(i), stage: stageOf(i), floor: floorOf(i), hp, max: hp, born: at, seed: Math.floor(rnd() * 1e6), atkAt: at + ATK_S, atk, pace, room };
  };
  let last = t0;
  const first = spawn(0, t0);
  let v: PveView = {
    t: t0,
    pace: 0,
    own,
    floorPace: first.pace,
    skills: kit.map((def) => skillAt(def, first.pace)),
    near: 0,
    hull: hullMax,
    hullMax,
    monster: first,
    nextAt: 0,
    at: 0,
    stage: 0,
    power: up,
    kills: 0,
    bosses: 0,
    best: 1,
    wrecks: 0,
    xp: 0,
    shots: [],
    hits: [],
    kos: [],
    event: null,
    events: 0,
  };
  /* The skills follow the floor's pace (kept charge). */
  const toFloor = (fp: number) => {
    v.floorPace = fp;
    v.skills = v.skills.map((s) => skillAt(s.def, fp, s.charge));
  };
  const arrive = (m: Monster) => {
    v.monster = m;
    toFloor(m.pace);
  };

  const shoot = (at: number, sv: SkillView) => {
    const m = v.monster;
    if (!m) return;
    const want = sv.hit * v.power;
    m.hp = Math.max(0, m.hp - want);
    const kill = m.hp <= 1e-6;
    v.shots.push({ n: (v.shots[v.shots.length - 1]?.n ?? 0) + 1, at, from: "me", slot: sv.def.slot, dmg: Math.max(1, Math.round(want)), q: sv.q, kill, monster: m.i });
    if (v.shots.length > 60) v.shots = v.shots.slice(-40);
    if (!kill) return;
    const xp = killXp(m.i, m.boss);
    v.xp += xp;
    v.kos = [...v.kos.slice(-20), { i: m.i, n: m.n, name: m.name, boss: m.boss, seed: m.seed, at, xp, floor: m.floor }];
    v.kills++;
    v.events++;
    v.monster = null;
    v.nextAt = at + RESPAWN_S;
    v.at = m.i + 1;
    if (m.boss) {
      /* The stage is beaten: the hull mended. */
      v.bosses++;
      v.xp += clearXp(m.stage);
      v.hull = v.hullMax;
      v.event = { kind: "clear", at, stage: m.stage, floor: m.floor };
    } else v.event = { kind: "floor", at, stage: m.stage, floor: m.floor };
    v.stage = stageOf(v.at);
    v.best = Math.max(v.best, v.at + 1);
    toFloor(floorPaceOf(v.at, course, own, boat.ease ?? 0));
  };

  const wreck = (at: number) => {
    v.wrecks++;
    v.event = { kind: "wreck", at, stage: v.stage, floor: v.at + 1 };
    v.monster = null;
    v.at = 0;
    v.stage = 0;
    v.hull = v.hullMax;
    v.nextAt = at + WRECK_S;
    for (const s of v.skills) s.charge = 0;
    toFloor(floorPaceOf(0, course, own, boat.ease ?? 0));
  };

  return {
    view: () => v,
    rest(t) {
      const gap = t - last;
      v = { ...v, events: 0 };
      if (gap <= 0) return;
      v = { ...v, monster: v.monster ? { ...v.monster, atkAt: v.monster.atkAt + gap } : null, nextAt: v.nextAt + gap };
      last = t;
    },
    step(t, pace) {
      v = { ...v, monster: v.monster ? { ...v.monster } : null, shots: [...v.shots], hits: [...v.hits], skills: v.skills.map((s) => ({ ...s })) };
      /* A pause in the row's clock, or a jump, is not filled: a tick is
       * never more than eight seconds of the row. */
      let dt = Math.max(0, Math.min(8, t - last));
      last = Math.max(last, t);
      v.pace = pace;
      v.t = t;
      const qs = () => {
        for (const s of v.skills) s.q = fillOf(pace, s.target);
        v.near = Math.max(...v.skills.map((s) => Math.min(1, s.q)));
      };
      qs();
      let now = t - dt;
      /* A tick can hold several hits at forty times a clock: it is stepped
       * to the next thing that happens, a full skill or a monster's hit. */
      while (dt > 1e-9) {
        if (!v.monster && now >= v.nextAt - 1e-9) {
          arrive(spawn(v.at, now));
          qs();
        }
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
        qs();
        /* The monster hits back. */
        const mm = v.monster;
        if (mm && now >= mm.atkAt - 1e-9) {
          v.hull = Math.max(0, v.hull - mm.atk);
          v.hits.push({ n: (v.hits[v.hits.length - 1]?.n ?? 0) + 1, at: now, dmg: mm.atk, boss: mm.boss });
          if (v.hits.length > 30) v.hits = v.hits.slice(-20);
          mm.atkAt += ATK_S;
          if (v.hull <= 1e-6) wreck(now);
        }
      }
      if (!v.monster && t >= v.nextAt) {
        arrive(spawn(v.at, v.nextAt));
        qs();
      }
      return v;
    },
  };
}
