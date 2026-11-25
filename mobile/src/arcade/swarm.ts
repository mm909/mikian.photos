import { NO_UPGRADES, TARGET, dmgMul, fillOf, hullOf, quickMul, rollSkills, skillAt, type BoatLv, type SkillDef, type SkillView } from "./pve";
import { prng } from "./rng";

/* THE SWARM (owner, 2026-11-24: "maybe our director can do a round or two
 * of the single boss, and then a round or two of the Vampire Survivors type
 * of game ... I really like the view of Vampire Survivors ... more things
 * moving around, more things exploding").
 *
 * The rower's boat is out on open water, seen from above, and it STEERS
 * ITSELF, LIKE A BOXER IN HIS JAB'S REACH (owner, the same night: "move in
 * and out so fish sit inside the jab circle, and hold an area while killing
 * what's in it ... path towards coins too"): it closes on the school as the
 * quick skill is about to go, backs off from anything about to bite, holds
 * a ring round itself while fish are in it, and goes for the XP the dead
 * ones leave when the water near it is clear. How fast it goes is how fast they row (the
 * last four seconds of their meters), one meter of the water for every
 * meter rowed; the fish swim at FISH_V of the rower's own pace, so a rower
 * at their pace stays a little ahead and one well under it is caught.
 * The three skills (the course's: pve.ts) fill exactly as they do there and
 * go off by themselves as AREA ATTACKS round the boat: the quick one a small
 * pulse, the middle one a blast on the nearest fish, the heavy one a wide
 * ring. A fish that touches the boat bites the hull. A round is ROUND_S
 * seconds of the row, or until the hull is gone.
 *
 * A dead fish leaves XP, picked up as the boat goes over it; what is left
 * behind sinks after DROP_S. (No coins: since the owner's review the coins
 * are the meters of the game, counted by the show.)
 *
 * No hands, as everywhere in the arcade: the pace is the only input.
 *
 * Pure, as the rest of the arcade is: told the row's seconds and the pace,
 * it answers. The director (show.ts) runs it between stages of the course;
 * the screen is screens/Show.tsx (Swarm); scripts/swarm-check.ts rows
 * rounds through it. */

/* The fish's speed, a share of the rower's own pace's. */
export const FISH_V = 0.97;
/* A fish's health at the start of a round, and its growth a minute. */
export const FISH_HP = 8;
export const FISH_HP_MIN = 0.8;
/* Hull a second for each fish touching the boat, at the rower's speed. */
export const BITE = 9;
export const TOUCH = 2.2;
/* Fish come at this distance; at most MAX_FISH at once; one every SPAWN_S
 * seconds at first, faster as the round goes. */
const SPAWN_R = 34;
export const MAX_FISH = 44;
const SPAWN_S = 0.9;
const SPAWN_LEAST = 0.3;
/* The skills' areas, in meters of the water. */
export const AREA = [7, 9, 20];
/* How far the middle skill reaches for its fish. */
const REACH = 26;
/* Pickups: drawn in from MAGNET, taken at GRAB; sunk after DROP_S. */
const MAGNET = 14;
const GRAB = 2.5;
const DROP_S = 30;
export const XP_GEM = 3;
export const ROUND_S = 120;
/* How fast the boat can turn, radians a second. */
const TURN = 2.6;
const STEP = 0.1;
const V_REF = 500 / 119;

export type SFish = { id: number; x: number; y: number; vx: number; vy: number; hp: number; max: number; kind: number; hitAt: number };
export type SDrop = { id: number; x: number; y: number; kind: "xp"; value: number; born: number };
export type SBlast = { id: number; at: number; x: number; y: number; r: number; slot: number };
export type SDeath = { id: number; at: number; x: number; y: number; kind: number };

export type SwarmView = {
  t: number;
  t0: number;
  end: number;
  pace: number;
  own: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  hull: number;
  hullMax: number;
  /* The last bite, the row's second. */
  bitAt: number;
  skills: SkillView[];
  near: number;
  fish: SFish[];
  drops: SDrop[];
  blasts: SBlast[];
  deaths: SDeath[];
  kills: number;
  xp: number;
  over: boolean;
  wrecked: boolean;
};

export type Swarm = { step(t: number, pace: number): SwarmView; view(): SwarmView };

/* `base`: the pace the skills key off (the course's floor's, show.ts). */
export function createSwarm({ t0, seed, own = TARGET, base, boat = NO_UPGRADES, skills, roundS = ROUND_S }: { t0: number; seed: number; own?: number; base?: number; boat?: BoatLv; skills?: SkillDef[]; roundS?: number }): Swarm {
  const rnd = prng(seed);
  const kit = skills ?? rollSkills(rnd);
  const vOwn = 500 / own;
  const up = dmgMul(boat.dmg);
  const fillMul = quickMul(boat.quick);
  const hullMax = hullOf(boat.hull);
  const bite = BITE * (vOwn / V_REF);
  const fp = base ?? own + 2;
  let ids = 0;
  let last = t0;
  let spawnAt = t0 + 0.5;
  let wander = rnd() * Math.PI * 2;
  let v: SwarmView = {
    t: t0,
    t0,
    end: t0 + roundS,
    pace: 0,
    own,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    heading: -Math.PI / 2,
    hull: hullMax,
    hullMax,
    bitAt: -99,
    skills: kit.map((def) => skillAt(def, fp)),
    near: 0,
    fish: [],
    drops: [],
    blasts: [],
    deaths: [],
    kills: 0,
    xp: 0,
    over: false,
    wrecked: false,
  };

  const spawn = (now: number) => {
    const a = rnd() * Math.PI * 2;
    const into = (now - t0) / 60;
    const kind = Math.floor(rnd() * 4);
    const hp = FISH_HP * (1 + FISH_HP_MIN * into) * (kind === 3 ? 2.5 : 1);
    v.fish.push({ id: ++ids, x: v.x + Math.cos(a) * SPAWN_R, y: v.y + Math.sin(a) * SPAWN_R, vx: 0, vy: 0, hp, max: hp, kind, hitAt: -99 });
  };

  const kill = (f: SFish, now: number) => {
    v.kills++;
    v.deaths.push({ id: f.id, at: now, x: f.x, y: f.y, kind: f.kind });
    v.drops.push({ id: ++ids, x: f.x, y: f.y, kind: "xp", value: f.kind === 3 ? XP_GEM * 3 : XP_GEM, born: now });
  };

  const area = (now: number, s: SkillView) => {
    const slot = s.def.slot;
    let cx = v.x;
    let cy = v.y;
    if (slot === 1) {
      /* The middle skill: a blast on the nearest fish in reach. */
      let best: SFish | null = null;
      let bd = REACH * REACH;
      for (const f of v.fish) {
        const d = (f.x - v.x) ** 2 + (f.y - v.y) ** 2;
        if (d < bd) {
          bd = d;
          best = f;
        }
      }
      if (!best) return false;
      cx = best.x;
      cy = best.y;
    }
    const r = AREA[slot];
    const dmg = s.hit * up;
    v.blasts.push({ id: ++ids, at: now, x: cx, y: cy, r, slot });
    for (const f of v.fish) {
      if ((f.x - cx) ** 2 + (f.y - cy) ** 2 > r * r) continue;
      f.hp -= dmg;
      f.hitAt = now;
      /* Knocked back from the middle of the blast. */
      const d = Math.max(0.5, Math.hypot(f.x - cx, f.y - cy));
      f.x += ((f.x - cx) / d) * 1.5;
      f.y += ((f.y - cy) / d) * 1.5;
    }
    for (const f of v.fish) if (f.hp <= 0) kill(f, now);
    v.fish = v.fish.filter((f) => f.hp > 0);
    return true;
  };

  const tick = (now: number, dt: number, speed: number) => {
    /* Where the boat wants to go, a boxer's footwork round its jab's
     * reach (AREA[0]): in toward the school as the quick skill is about to
     * go, out from anything about to bite, and round in a ring while fish
     * sit in the reach; the XP when the water near it is clear. */
    const jab = v.skills.find((s) => s.def.slot === 0);
    const ready = !!jab && jab.q > 0 && jab.charge > 0.6;
    const reach = AREA[0];
    let ax = Math.cos(v.heading) * 0.5;
    let ay = Math.sin(v.heading) * 0.5;
    let inReach = 0;
    let nearD = 99;
    let cx = 0;
    let cy = 0;
    let cn = 0;
    for (const f of v.fish) {
      const dx = f.x - v.x;
      const dy = f.y - v.y;
      const d = Math.max(0.3, Math.hypot(dx, dy));
      nearD = Math.min(nearD, d);
      if (d > 30) continue;
      if (d < reach) inReach++;
      if (d < 16) {
        cx += f.x;
        cy += f.y;
        cn++;
      }
      /* Too close: out, hard. */
      if (d < TOUCH + 2.2) {
        const k = ((TOUCH + 2.2 - d) / d) * 3.2;
        ax -= dx * k;
        ay -= dy * k;
      } else if (d < 12) {
        /* In reach and beyond it: in when the jab is ready, else a little
         * out, so they sit on the edge of the ring. */
        const k = ready ? 0.3 / d : d < reach * 0.8 ? -0.35 / d : 0.05 / d;
        ax += dx * k;
        ay += dy * k;
      } else {
        ax -= (dx / (d * d)) * 6;
        ay -= (dy / (d * d)) * 6;
      }
    }
    /* Holding: fish in the reach and none on top of it, the boat circles
     * (turns across the school instead of from it). */
    if (inReach >= 2 && nearD > TOUCH + 1.5 && cn) {
      const tx = cx / cn - v.x;
      const ty = cy / cn - v.y;
      const d = Math.hypot(tx, ty) || 1;
      ax += (-ty / d) * 0.9;
      ay += (tx / d) * 0.9;
    }
    let pick: SDrop | null = null;
    let pd = 40 * 40;
    for (const p of v.drops) {
      const d = (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
      if (d < pd) {
        pd = d;
        pick = p;
      }
    }
    if (pick) {
      const d = Math.sqrt(pd) || 1;
      const w = nearD > reach ? 1.1 : 0.35;
      ax += ((pick.x - v.x) / d) * w;
      ay += ((pick.y - v.y) / d) * w;
    }
    wander += (rnd() - 0.5) * 0.6 * dt;
    ax += Math.cos(wander) * 0.25;
    ay += Math.sin(wander) * 0.25;
    const want = Math.atan2(ay, ax);
    let turn = want - v.heading;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    v.heading += Math.max(-TURN * dt, Math.min(TURN * dt, turn));
    v.vx = Math.cos(v.heading) * speed;
    v.vy = Math.sin(v.heading) * speed;
    v.x += v.vx * dt;
    v.y += v.vy * dt;

    /* The fish close in, keeping a little apart from each other. */
    const fv = FISH_V * vOwn;
    let touching = 0;
    for (const f of v.fish) {
      const dx = v.x - f.x;
      const dy = v.y - f.y;
      const d = Math.max(0.01, Math.hypot(dx, dy));
      const k = f.kind === 3 ? 0.8 : f.kind === 2 ? 1.08 : 1;
      f.vx = (dx / d) * fv * k;
      f.vy = (dy / d) * fv * k;
      if (d < TOUCH) {
        touching++;
        f.vx = 0;
        f.vy = 0;
      }
    }
    for (let i = 0; i < v.fish.length; i++) {
      const a = v.fish[i];
      for (let j = i + 1; j < v.fish.length; j++) {
        const b = v.fish[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 2.4 || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = ((1.55 - d) / d) * 0.5;
        a.x += dx * push;
        a.y += dy * push;
        b.x -= dx * push;
        b.y -= dy * push;
      }
      a.x += a.vx * dt;
      a.y += a.vy * dt;
    }
    if (touching) {
      v.hull = Math.max(0, v.hull - touching * bite * dt);
      v.bitAt = now;
    }

    /* Pickups, drawn in and taken. */
    v.drops = v.drops.filter((p) => {
      if (now - p.born > DROP_S) return false;
      const dx = v.x - p.x;
      const dy = v.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < GRAB) {
        v.xp += p.value;
        return false;
      }
      if (d < MAGNET) {
        p.x += (dx / d) * Math.min(d, 22 * dt);
        p.y += (dy / d) * Math.min(d, 22 * dt);
      }
      return true;
    });

    /* The skills fill, and go off. */
    for (const s of v.skills) {
      s.charge = Math.min(1, s.charge + (s.q / (s.def.fill * fillMul)) * dt);
      if (s.charge >= 1 && area(now, s)) s.charge = 0;
    }

    /* More fish, faster as the round goes. */
    const every = Math.max(SPAWN_LEAST, SPAWN_S * (1 - (now - t0) / (ROUND_S * 1.5)));
    while (spawnAt <= now) {
      if (v.fish.length < MAX_FISH) spawn(now);
      spawnAt += every;
    }
  };

  return {
    view: () => v,
    step(t, pace) {
      v = { ...v, fish: v.fish.map((f) => ({ ...f })), drops: v.drops.map((p) => ({ ...p })), skills: v.skills.map((s) => ({ ...s })), blasts: v.blasts.filter((b) => t - b.at < 3), deaths: v.deaths.filter((d) => t - d.at < 3) };
      let dt = Math.max(0, Math.min(8, t - last));
      last = Math.max(last, t);
      v.pace = pace;
      v.t = t;
      for (const s of v.skills) s.q = fillOf(pace, s.target);
      v.near = Math.max(...v.skills.map((s) => Math.min(1, s.q)));
      if (v.over) return v;
      const speed = Number.isFinite(pace) && pace > 40 && pace < 600 ? 500 / pace : 0;
      let now = t - dt;
      while (dt > 1e-9 && !v.over) {
        const h = Math.min(STEP, dt);
        now += h;
        dt -= h;
        tick(now, h, speed);
        if (v.hull <= 0) {
          v.over = true;
          v.wrecked = true;
          v.end = now;
        } else if (now >= v.end) v.over = true;
      }
      return v;
    },
  };
}
