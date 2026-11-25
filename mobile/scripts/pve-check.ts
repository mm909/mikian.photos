/* The single-player course (src/arcade/pve.ts), checked with no phone:
 * `npx tsx scripts/pve-check.ts` in mobile/. Rows whole pieces through it a
 * tenth of a second at a time at a steady pace, with stroke-to-stroke
 * noise, and prints what happened: floors, bosses, wrecks. The rower's own
 * pace here is 1:59. */
import { SKILL_BY_ID, createPve, fillOf, floorPaceOf, nameOf, roomOf, type BoatLv } from "../src/arcade/pve";
import { prng } from "../src/arcade/rng";

let failed = 0;
const ok = (what: string, pass: boolean, got?: unknown) => {
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${what}${pass ? "" : ` (got ${JSON.stringify(got)})`}`);
};
const gauss = (rnd: () => number) => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
const plain = [SKILL_BY_ID.jab, SKILL_BY_ID.throw, SKILL_BY_ID.cannon];
const hard = [SKILL_BY_ID.flick, SKILL_BY_ID.spear, SKILL_BY_ID.anchor];

/* `seconds` of battle at `pace`, noise `sd` seconds a 500. */
function row(seconds: number, pace: number, sd: number, seed: number, skills = plain, boat?: BoatLv, scale = 1) {
  const rnd = prng(seed);
  const g = createPve({ t0: 0, seed, own: 119, skills, boat, scale });
  let p = pace;
  let m = 0;
  for (let t = 0.1; t <= seconds + 1e-9; t += 0.1) {
    if (Math.round(t * 10) % 21 === 0) p = pace + gauss(rnd) * sd;
    g.step(t, p);
    m += (0.1 * 500) / p;
  }
  return { ...g.view(), meters: m };
}

ok("a skill fills in its time on its pace", fillOf(119, 119) === 1);
ok("faster fills faster, up to 2", Math.abs(fillOf(116, 119) - 2) < 1e-9 && fillOf(100, 119) === 2);
ok("slower than its pace it stands still", fillOf(119.5, 119) === 0);
ok("nothing fills when stopped", fillOf(Infinity, 119) === 0);

console.log("     the course, rooms in meters at a 5K's scale and their paces (seed 7):");
let line = "";
for (let i = 0; i < 15; i++) {
  const p = floorPaceOf(i, 7, 119);
  line += ` F${i + 1} ${nameOf(i)} ${roomOf(i, 7)} m @${Math.floor(p / 60)}:${String(p % 60).padStart(2, "0")}${i % 5 === 4 ? "\n" : " ·"}`;
}
console.log(line.replace(/^/gm, "      "));

/* The battle seconds of a piece: the piece less the intro (a 1K's is 12 s),
 * less the last tenth (the finale) and less its swarm rounds (two minutes
 * each in a 5K, about one in a 1.5K of course). */
const battle = (meters: number, pace: number, intro: number, scale: number) => {
  const s = (meters * 0.9 * pace) / 500 - intro;
  const swarms = Math.floor(s / ((1500 * scale * pace) / 500 + 120 * scale));
  return s - swarms * Math.max(45, 120 * scale);
};
for (const [label, meters, intro, scale] of [["1K", 1000, 12, 0.2], ["2K", 2000, 24, 0.4], ["5K", 5000, 60, 1], ["10K", 10000, 60, 1]] as const) {
  for (const pace of [115, 117, 119, 121, 123, 126]) {
    for (const [kit, skills] of [["plain", plain], ["hard", hard]] as const) {
      if (kit === "hard" && label !== "5K") continue;
      const runs = Array.from({ length: 15 }, (_, i) => row(battle(meters, pace, intro, scale), pace, 1.5, 7 + i, skills, undefined, scale));
      const med = (f: (r: (typeof runs)[number]) => number) => runs.map(f).sort((a, b) => a - b)[7];
      console.log(`     ${label} at ${Math.floor(pace / 60)}:${String(pace % 60).padStart(2, "0")} (${kit}): ${med((r) => r.kills)} floors, furthest floor ${med((r) => r.best)}, ${med((r) => r.bosses)} bosses, ${med((r) => r.wrecks)} wrecks, ${Math.round(med((r) => r.meters))} m, ${med((r) => r.xp)} XP`);
      if (label === "5K" && pace === 119 && kit === "plain") {
        ok("a 5K at your pace: the first boss down, never wrecked", med((r) => r.bosses) >= 1 && med((r) => r.wrecks) === 0, runs.map((r) => [r.bosses, r.wrecks]));
      }
      if (label === "5K" && pace === 123 && kit === "plain") ok("a 5K four seconds slow: wrecked", med((r) => r.wrecks) >= 1, runs.map((r) => r.wrecks));
      if (label === "1K" && pace === 119 && kit === "plain") ok("a 1K at your pace: a few floors", med((r) => r.kills) >= 2, runs.map((r) => r.kills));
    }
  }
}
{
  const a = row(1500, 121, 1.5, 3);
  const b = row(1500, 121, 1.5, 3, plain, { dmg: 5, hull: 5, quick: 3, ease: 4 });
  console.log(`     upgrades 5/5/3/4, 25 minutes 2 s slower than your pace: ${a.kills} floors → ${b.kills}, furthest ${a.best} → ${b.best}`);
  ok("upgrades take the rower further", b.kills > a.kills && b.best >= a.best, [a.kills, b.kills]);
}
/* A demo at forty times a clock: ticks of four seconds of the row. */
{
  const g = createPve({ t0: 0, seed: 3, own: 119, skills: plain });
  for (let t = 4; t <= 600; t += 4) g.step(t, 117);
  const slow = row(600, 117, 0, 3);
  ok("a demo's big ticks do about what small ones do", Math.abs(g.view().kills - slow.kills) <= 1, [g.view().kills, slow.kills]);
}
console.log(failed ? `${failed} FAILED` : "all ok");
process.exit(failed ? 1 : 0);
