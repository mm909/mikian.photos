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
 * with a full hull. Out of hull is the run lost: it starts over at its own
 * first floor straight away, the items kept (since 2026-11-28).
 *
 * THE SKILLS, two since 2026-11-26 (owner, after a row: "Let's experiment
 * with just 2 skills instead of the 3"), told apart by colour: blue and red
 * (the green JAB is kept in SKILLS, out of the KIT). Each has a pace: the
 * rower's own (their median 5K, whole seconds) plus its SLOW (blue 2 s
 * slower, red 0), plus whole
 * seconds of EASE bought. It fills only at its pace or faster, by the
 * METERS rowed: FILL_M of them at its pace, quicker the more the pace beats
 * it (RISE_S, Q_MAX). Slower than its pace it stands still.
 *
 * DAMAGE IN METERS: with every skill filling at their paces the skills do one
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
/* THE REST after a fight, in meters (owner, 2026-11-26: "this amount of
 * rest is good for like after a boss, but ... in between the normal ones, we
 * want to keep it pretty short"). After a boss: a share of its room, between
 * the least and the most (scaled with the piece); after any other floor a
 * short REST_FLOOR, about six seconds at 2:00. */
const REST_SHARE = 0.35;
const REST_LEAST = 25;
const REST_MOST = 120;
export const REST_FLOOR = 25;
/* The hull, and the monsters' hits: one every ATK_S seconds of a fight. */
export const HULL0 = 500;
export const ATK_S = 3;
export const BUDGET_X = 1.7;
export const BOSS_ATK = 1.2;
/* After the kick-out, a boss still standing: the hull drains so that a full
 * one lasts this many meters at the rower's pace. */
export const OVERTIME_M = 300;
/* A BOSS IS TIMED (owner, 2026-11-26: "we can almost time it to where ...
 * the player is going to be left with like 5% HP"; bosses felt rushed): its
 * hits are set as it comes in, off the hull left and how long it takes to
 * beat at the rower's own pace with what they hit with now, so a rower who
 * holds their pace beats it with about BOSS_LEFT of the hull to spare. */
export const BOSS_LEFT = 0.05;
/* A point a meter is what the kit does with every skill on; a stroke-to-
 * stroke wobble about the rower's own pace turns red off now and then, and
 * the boss takes this much longer than that (scripts/pve-check.ts). */
export const BOSS_SLACK = 1.03;
/* ITEMS (owner, 2026-11-28, watching the demo: "We should be getting items
 * instead of like just raw stat bonuses ... maybe we have only 2 items active
 * at a time, and when we get a new one, it like removes the other one"; they
 * were stacking power-ups, +12% damage and 10% faster fills, since 11-26). A
 * monster down drops one ITEM_CHANCE of the time, a boss always; never one
 * already held. Two are held at most; a third pushes out the one held
 * longest. They are kept through a lost run (owner: "restart from floor 1,
 * but with our same power-ups") and go with the row. */
export const ITEM_CHANCE = 0.5;
export const ITEM_SLOTS = 2;
export type ItemKind = "hook" | "sail" | "ring" | "oar" | "patch" | "pet";
export const ITEM_KINDS: ItemKind[] = ["hook", "sail", "ring", "oar", "patch", "pet"];
export const ITEMS: Record<ItemKind, { name: string; word: string; short: string; color: string }> = {
  hook: { name: "SHARP HOOK", word: "HITS 20% HARDER", short: "+20% DMG", color: "#E2725B" },
  sail: { name: "SAIL", word: "SKILLS FILL 20% FASTER", short: "+20% FILL", color: "#0077B6" },
  ring: { name: "LIFE RING", word: "HITS ON YOU 25% SOFTER", short: "-25% HURT", color: "#D8362A" },
  oar: { name: "LIGHT OAR", word: "SKILL PACES 1 S EASIER", short: "PACE +1 S", color: "#B5793F" },
  patch: { name: "PATCH KIT", word: "10% HULL BACK A KNOCKOUT", short: "+10% HULL", color: "#2BB673" },
  /* A COMPANION (owner, 2026-11-28: "one of the items we could get is a
   * companion ... someone to shoot with us ... the pet just does 10% of our
   * damage ... And the pet also just circles around us"): a puffin that
   * flies round the boat and throws a shot of its own after every one of
   * the rower's, a tenth of it. */
  pet: { name: "PUFFIN", word: "A PET THAT HITS FOR 10% OF YOURS", short: "PET 10%", color: "#F28C28" },
};
export const PET_SHARE = 0.1;
export const HOOK_DMG = 1.2;
export const SAIL_FILL = 1.2;
export const RING_HURT = 0.75;
export const PATCH_MEND = 0.1;
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
  /* 0 green (quick), 1 blue, 2 red (heavy): its look on the board. */
  slot: 0 | 1 | 2;
  /* Its share of the damage: the kit's add up to 1 (a point a meter with
   * every skill filling at its pace). */
  share: number;
  /* Meters to fill at its pace. */
  fillM: number;
  /* Seconds to fill at 2:00 (the swarm's clock). */
  fill: number;
  /* Seconds slower than the rower's own pace it fills at. */
  slow: number;
  /* Its colour: what the screen calls it. */
  color: string;
};
const M_AT_200 = 500 / 120;
const skill = (id: string, name: string, slot: 0 | 1 | 2, seconds: number, slow: number, color: string, share: number): SkillDef => ({ id, name, slot, share, fillM: Math.round(seconds * M_AT_200), fill: seconds, slow, color });
export const SKILL_COLOR = ["#2BB673", "#0077B6", "#E2725B"];
/* SLOWER TO FILL (owner, 2026-11-26: "It's still going so fast. It's really
 * hard to see when a thing is filling up or what percentage it's at"): blue
 * about 8 s of rowing at 2:00 (33 m), red about 16 s (67 m); they were 2, 5
 * and 10 s. */
export const SKILLS: SkillDef[] = [
  skill("jab", "JAB", 0, 2, 2, SKILL_COLOR[0], 0.25),
  skill("spear", "SPEAR", 1, 8, 2, SKILL_COLOR[1], 0.45),
  skill("anchor", "ANCHOR", 2, 16, 0, SKILL_COLOR[2], 0.55),
];
export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
/* THE KIT EVERY ROW PLAYS: blue and red. */
export const KIT: SkillDef[] = SKILLS.filter((s) => s.id !== "jab");
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
/* The rower's paces, whole seconds, one a skill of the kit: blue, red. */
export const pacesOf = (own: number, ease = 0): number[] => KIT.map((d) => Math.round(own) + d.slow + easeOf(ease));

/* ---- the monsters ---- */
/* A KIND OF MONSTER FOR TEN FLOORS (owner, 2026-11-28: "maybe it's that the
 * map changes every 5 and the types of mobs you're facing changes every
 * 10"): a run is one kind, eight of its skins and its two bosses; the map
 * (Board.tsx zoneOf) turns every five. */
type Kind = { skins: string[]; boss: [string, string] };
const KINDS: Kind[] = [
  { skins: ["BILGE CRAB", "REEF CRAB", "SALT CRAB", "ROCK CRAB", "HERMIT CRAB", "SPIDER CRAB", "IRON CRAB", "GHOST CRAB"], boss: ["KING CRAB", "THE CLAW"] },
  { skins: ["MUD GULPER", "MOSS GULPER", "PINK GULPER", "DEEP GULPER", "BOG GULPER", "GLOOM GULPER", "FAT GULPER", "OLD GULPER"], boss: ["THE BIG GULP", "THE MAW"] },
  { skins: ["EEL", "STORM EEL", "SPARK EEL", "GLASS EEL", "MOON EEL", "RIBBON EEL", "WIRE EEL", "VOLT EEL"], boss: ["EEL QUEEN", "THE COIL"] },
  { skins: ["SEA TOAD", "BRINE TOAD", "SAND TOAD", "MARSH TOAD", "REED TOAD", "MUD TOAD", "HORN TOAD", "WART TOAD"], boss: ["TOAD BARON", "TOAD KING"] },
  { skins: ["KELP KNOT", "OLD ROPE", "NET GHOST", "DRIFT LINE", "SNARL", "BILGE LINE", "LOST NET", "OLD CHAIN"], boss: ["THE TANGLE", "THE BIG KNOT"] },
];
/* `i` is the floor in the run, 0 for floor 1; `run` the runs done before. */
export const stageOf = (i: number): number => Math.floor(i / PER_STAGE);
export const isBoss = (i: number): boolean => i % PER_STAGE === PER_STAGE - 1;
/* THE FLOOR NUMBER NEVER GOES BACK (owner, 2026-11-26: "we got that star,
 * and now we're back to floor 1. We should definitely be at floor 11 ...
 * continuously increasing the count of those floors"): run 2's first floor
 * is floor 11. `i` stays the floor in the run for the rooms and the bosses. */
export const floorOf = (i: number, run = 0): number => run * RUN_FLOORS + i + 1;
/* The kinds go on run to run: a run is one kind. */
const kindOf = (_i: number, run: number): number => run % KINDS.length;
export const nameOf = (i: number, run = 0): string => {
  const k = KINDS[kindOf(i, run)];
  const st = stageOf(i);
  return isBoss(i) ? k.boss[st % 2] : k.skins[(st % 2) * 4 + (i % PER_STAGE)];
};
/* The art (Monster.tsx): its shape is `n % 3`, the kind's own, and its
 * colour `n % 8`, a new one each floor. */
export const artOf = (i: number, run = 0): number => {
  const s = kindOf(i, run);
  return 9 * s + 3 * (i % RUN_FLOORS) + (s % 3);
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
export const restOf = (room: number, scale = 1, boss = true): number => (boss ? Math.max(REST_LEAST * Math.max(0.5, scale), Math.min(REST_MOST * scale, room * REST_SHARE)) : REST_FLOOR * Math.max(0.5, Math.min(1, scale)));

/* How fast a skill fills against its pace: none slower than it, 1 on it,
 * up to Q_MAX faster. */
export const fillOf = (pace: number, target: number): number => {
  if (!Number.isFinite(pace) || pace <= 40 || pace >= 600) return 0;
  if (pace > target + 0.5) return 0;
  return Math.min(Q_MAX, 1 + Math.max(0, target + 0.5 - pace) / RISE_S);
};
/* What one hit of a skill does: its share of a point a meter. */
export const hitOf = (d: SkillDef): number => d.share * d.fillM;
/* A skill's view at the rower's red pace `base`. */
export const skillAt = (def: SkillDef, base: number, charge = 0): SkillView => ({ def, charge, q: 0, target: base + def.slow, hit: hitOf(def) });

export type Monster = { i: number; n: number; name: string; boss: boolean; stage: number; floor: number; hp: number; max: number; born: number; seed: number; atkAt: number; atk: number; room: number };
export type PShot = { n: number; at: number; from: string; slot: number; dmg: number; q: number; kill: boolean; monster: number };
/* A monster's hit on the hull (`dot`: the overtime's drain, no throw). */
export type PHit = { n: number; at: number; dmg: number; boss: boolean; dot?: boolean };
export type Ko = { i: number; n: number; name: string; boss: boolean; seed: number; at: number; xp: number; floor: number; /* The item it dropped, and the one that pushed out. */ item?: ItemKind; out?: ItemKind };
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
  /* Kept for old callers; a lost run starts over now (wreck), so false. */
  lost: boolean;
  /* The items held, the one held longest first (ITEM_SLOTS at most), and
   * how many were picked up this row. */
  items: ItemKind[];
  got: number;
  wrecks: number;
  /* The kick-out: no new monster; a standing boss drains the hull. */
  out: boolean;
  overtime: boolean;
  xp: number;
  /* The damage done this row. */
  dealt: number;
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
    const mo: Monster = { i, n: artOf(i, run), name: nameOf(i, run), boss: isBoss(i), stage: stageOf(i), floor: floorOf(i, run), hp: room, max: room, born: at, seed: Math.floor(rnd() * 1e6), atkAt: at + ATK_S, atk: atkOf(i, run), room };
    if (mo.boss && v) mo.atk = bossAtk(mo);
    return mo;
  };
  /* The boss's hit, timed: the meters it takes at the rower's own pace with
   * what they hit with (the power, the boat, the perks), in seconds; the
   * hull left less BOSS_LEFT, over that many hits. Never under half a hit of
   * the stage's clock. */
  const bossAtk = (mo: Monster): number => {
    const per = (v.power * mightOf() * fillQuick()) / fillMul;
    const secs = (BOSS_SLACK * mo.room) / per / speedOwn;
    const hits = Math.max(1, secs / ATK_S);
    /* Its hits land softer with the life ring: timed as they land. */
    return Math.max(mo.atk * 0.5 / BOSS_ATK, (v.hull * (1 - BOSS_LEFT)) / hits / hurtOf());
  };
  const has = (k: ItemKind) => !!v?.items.includes(k);
  const mightOf = () => (has("hook") ? HOOK_DMG : 1);
  const fillQuick = () => (has("sail") ? SAIL_FILL : 1);
  const hurtOf = () => (has("ring") ? RING_HURT : 1);
  /* The skills' paces, a second easier with the light oar. */
  const retarget = () => {
    const easy = has("oar") ? 1 : 0;
    for (const s of v.skills) s.target = base + s.def.slow + easy;
  };
  const at0 = Math.max(0, Math.min(RUN_FLOORS - 1, Math.floor(from.at)));
  let last = t0;
  let lastM = m0;
  /* When the rest ends: the meters, and a KO's beat first (the row's
   * second). */
  let readyAt = t0;
  let v: PveView = null as unknown as PveView;
  v = {
    t: t0,
    pace: 0,
    own: ownW,
    floorPace: base,
    skills: KIT.map((def) => skillAt(def, base)),
    near: 0,
    hull: hullMax,
    hullMax,
    monster: null,
    restFrom: 0,
    restTo: 0,
    at: at0,
    stage: stageOf(at0),
    run: from.run,
    runsDone: 0,
    power: dmgMul(boat.dmg) * (1 + STAR_DMG * stars),
    kills: 0,
    bosses: 0,
    best: floorOf(at0, from.run),
    lost: false,
    items: [],
    got: 0,
    wrecks: 0,
    out: false,
    overtime: false,
    xp: 0,
    dealt: 0,
    loot: [],
    shots: [],
    hits: [],
    kos: [],
    event: null,
    events: 0,
  };
  v.monster = spawn(at0, from.run, t0);

  const shoot = (at: number, m: number, sv: SkillView) => {
    const mo = v.monster;
    if (!mo) return;
    const want = sv.hit * v.power * mightOf();
    /* The pet's shot comes a beat after the rower's, a tenth of it. */
    const pet = has("pet") && mo.hp > want ? want * PET_SHARE : 0;
    const all = want + pet;
    v.dealt += Math.min(mo.hp, all);
    mo.hp = Math.max(0, mo.hp - all);
    const kill = mo.hp <= 1e-6;
    v.shots.push({ n: (v.shots[v.shots.length - 1]?.n ?? 0) + 1, at, from: "me", slot: sv.def.slot, dmg: Math.max(1, Math.round(want)), q: sv.q, kill: kill && !pet, monster: mo.i });
    if (pet) v.shots.push({ n: (v.shots[v.shots.length - 1]?.n ?? 0) + 1, at: at + 0.15, from: "pet", slot: 0, dmg: Math.max(1, Math.round(pet)), q: sv.q, kill, monster: mo.i });
    if (v.shots.length > 60) v.shots = v.shots.slice(-40);
    if (!kill) return;
    const xp = killXp(mo.i, mo.boss);
    v.xp += xp;
    let item: ItemKind | undefined;
    let out: ItemKind | undefined;
    if (mo.boss || rnd() < ITEM_CHANCE) {
      const free = ITEM_KINDS.filter((k) => !v.items.includes(k));
      item = free[Math.floor(rnd() * free.length) % free.length];
      const held = [...v.items, item];
      if (held.length > ITEM_SLOTS) out = held.shift();
      v.items = held;
      v.got++;
      retarget();
    }
    if (has("patch")) v.hull = Math.min(v.hullMax, v.hull + PATCH_MEND * v.hullMax);
    v.kos = [...v.kos.slice(-20), { i: mo.i, n: mo.n, name: mo.name, boss: mo.boss, seed: mo.seed, at, xp, floor: mo.floor, item, out }];
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
    const rest = restOf(mo.room, scale, mo.boss) * (v.event.kind === "run" ? 2 : 1);
    v.restFrom = m;
    v.restTo = m + rest;
    readyAt = at + KO_S;
    for (const s of v.skills) s.charge = 0;
  };

  /* OUT OF HULL: THE RUN STARTS OVER (owner, 2026-11-28: "when we lose, we
   * should restart the run. So like restart from floor 1, but with our same
   * power-ups ... don't say that you can't do it until next run"): back to
   * the run's first floor, the hull full, the items kept, after a boss's
   * rest. After the kick-out there is no next floor. */
  const wreck = (at: number, m: number) => {
    const mo = v.monster;
    v.wrecks++;
    v.overtime = false;
    v.event = { kind: "wreck", at, stage: v.stage, floor: floorOf(v.at, v.run) };
    v.monster = null;
    v.at = 0;
    v.stage = 0;
    v.hull = v.hullMax;
    const rest = restOf(mo ? Math.max(mo.room, roomOf(PER_STAGE - 1, course, v.run) * scale) : REST_MOST * scale, scale, true);
    v.restFrom = v.out ? 0 : m;
    v.restTo = v.out ? 0 : m + rest;
    readyAt = at + KO_S;
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
          const rate = (s.q * mps * fillQuick()) / (s.def.fillM * fillMul);
          if (rate > 0) step = Math.min(step, (1 - s.charge) / rate);
        }
        if (!v.overtime) step = Math.min(step, Math.max(0, mo.atkAt - now));
        step = Math.max(step, 1e-6);
        now += step;
        dt -= step;
        const mNow = m - dt * mps;
        for (const s of v.skills) {
          s.charge = Math.min(1, s.charge + ((s.q * mps * fillQuick()) / (s.def.fillM * fillMul)) * step);
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
          if (v.hull <= 1e-6) wreck(now, mNow);
        } else if (now >= mm.atkAt - 1e-9) {
          const hit = mm.atk * hurtOf();
          v.hull = Math.max(0, v.hull - hit);
          v.hits.push({ n: (v.hits[v.hits.length - 1]?.n ?? 0) + 1, at: now, dmg: hit, boss: mm.boss });
          if (v.hits.length > 30) v.hits = v.hits.slice(-20);
          mm.atkAt += ATK_S;
          if (v.hull <= 1e-6) wreck(now, mNow);
        }
      }
      qs();
      return v;
    },
  };
}
