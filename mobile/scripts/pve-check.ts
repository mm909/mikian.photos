/* The single-player course (src/arcade/pve.ts), checked with no phone:
 * `npx tsx scripts/pve-check.ts` in mobile/. Rows whole 5Ks through it a
 * tenth of a second at a time at a steady pace with stroke-to-stroke noise,
 * and prints how far the run got, how long the fights took and how much
 * hull was left. The owner's bar (2026-11-24): early fights about 10 s /
 * 100 m; a run, ten floors, is about a 5K at his own pace; a second or two
 * faster is felt. */
import { createPve, pacesOf, roomOf, restOf, type BoatLv } from "../src/arcade/pve";
import { prng } from "../src/arcade/rng";

const NONE: BoatLv = { dmg: 0, hull: 0, quick: 0, ease: 0 };
const INTRO = 125;
const KICK = 250;

function row(own: number, pace: number, seed: number, from = { at: 0, run: 0 }) {
  const rnd = prng(seed);
  let t = 0;
  let m = 0;
  let noise = 0;
  let m0 = -1;
  let pve: ReturnType<typeof createPve> | null = null;
  const fights: { floor: number; s: number; m: number }[] = [];
  let fightAt = { t: 0, m: 0, floor: 0 };
  let had = false;
  let out = false;
  while (m < 5000) {
    noise = 0.8 * noise + 0.6 * (rnd() - 0.5) * 2;
    const p = pace + noise;
    t += 0.1;
    m += (500 / p) * 0.1;
    if (!pve && m >= INTRO) {
      pve = createPve({ t0: t, m0: m, seed, own, boat: NONE, from });
      m0 = m;
    }
    if (!pve) continue;
    if (!out && m >= 5000 - KICK) {
      pve.kickOut(t);
      out = true;
    }
    const v = pve.step(t, p, m);
    if (v.monster && !had) fightAt = { t, m, floor: v.monster.floor };
    if (!v.monster && had) fights.push({ floor: fightAt.floor, s: Math.round(t - fightAt.t), m: Math.round(m - fightAt.m) });
    had = !!v.monster;
  }
  const v = pve!.view();
  void m0;
  return { v, fights, t };
}

const own = 118;
console.log("paces at own 1:58:", pacesOf(own).map((p) => `${Math.floor(p / 60)}:${String(p % 60).padStart(2, "0")}`).join(" "));
console.log("rooms run 0:", Array.from({ length: 10 }, (_, i) => roomOf(i, 1)).join(" "), "rests:", Array.from({ length: 10 }, (_, i) => Math.round(restOf(roomOf(i, 1), 1, i % 5 === 4))).join(" "));
for (const pace of [121, 120, 119, 118, 117, 116]) {
  const r = row(own, pace, 7);
  const v = r.v;
  const f = r.fights.slice(0, 4).map((x) => `${x.s}s/${x.m}m`).join(" ");
  console.log(`pace ${pace}: floor ${v.at + 1} run ${v.run} runsDone ${v.runsDone} lost ${v.lost} kills ${v.kills} bosses ${v.bosses} hull ${Math.round(v.hull)}/${v.hullMax} boxes ${v.loot.length} | first fights ${f}`);
}
let ok = true;
const steady = row(own, own, 3);
if (steady.fights[0] && (steady.fights[0].s < 6 || steady.fights[0].s > 30)) {
  ok = false;
  console.log("first fight out of range", steady.fights[0]);
}
const slow = row(own, own + 4, 3);
if (!slow.v.lost && slow.v.at > 3) {
  ok = false;
  console.log("4 s slower should not get far");
}
const cont = row(own, own, 5, { at: 6, run: 0 });
if (cont.fights[0]?.floor !== 7) {
  ok = false;
  console.log("continue from floor 7 failed", cont.fights[0]);
}
console.log(ok ? "all ok" : "NOT OK");
