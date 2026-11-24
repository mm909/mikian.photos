/* The single-player course (src/arcade/pve.ts), checked with no phone:
 * `npx tsx scripts/pve-check.ts` in mobile/. Rows whole pieces through it a
 * tenth of a second at a time at a steady pace, with stroke-to-stroke
 * noise, and prints what happened: monsters, stages, wrecks, coins. The
 * rower's own pace here is 1:59. */
import { SKILL_BY_ID, createPve, hpOf, nameOf, nearOf, powerOf, type BoatLv } from "../src/arcade/pve";
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
function row(seconds: number, pace: number, sd: number, seed: number, skills = plain, boat?: BoatLv) {
  const rnd = prng(seed);
  const g = createPve({ t0: 0, seed, own: 119, skills, boat });
  let p = pace;
  let m = 0;
  for (let t = 0.1; t <= seconds + 1e-9; t += 0.1) {
    if (Math.round(t * 10) % 21 === 0) p = pace + gauss(rnd) * sd;
    g.step(t, p);
    m += (0.1 * 500) / p;
  }
  return { ...g.view(), meters: m };
}

ok("a skill fills at full speed on its target", nearOf(119, 119) === 1);
ok("inside the plateau too", nearOf(119.8, 119) === 1);
ok("faster fills faster, up to 1.3", nearOf(110, 119) > 1 && nearOf(80, 119) === 1.3);
ok("slower falls off", nearOf(126, 119) < 0.6 && nearOf(126, 119) > 0.3, nearOf(126, 119));
ok("never under the floor while moving", nearOf(200, 119) === 0.15);
ok("nothing fills when stopped", nearOf(Infinity, 119) === 0);

/* The meters each monster takes at the rower's pace. */
console.log("     the course, meters to beat at your pace (no upgrades):");
let stage = "";
for (let i = 0; i < 16; i++) {
  stage += ` ${nameOf(i)} ${Math.round(hpOf(i) / powerOf(i))}${i % 4 === 3 ? "\n" : " ·"}`;
}
console.log(stage.replace(/^/gm, "      "));

/* The battle seconds of a piece: the piece less the intro (a 1K's is 12 s)
 * and less the last tenth (the finale). */
const battle = (meters: number, pace: number, intro: number) => (meters * 0.9 * pace) / 500 - intro;
for (const [label, meters, intro] of [["1K", 1000, 12], ["2K", 2000, 24], ["5K", 5000, 60], ["10K", 10000, 60]] as const) {
  for (const pace of [115, 119, 122, 125, 130]) {
    for (const [kit, skills] of [["plain", plain], ["hard", hard]] as const) {
      if (kit === "hard" && label !== "5K") continue;
      const runs = Array.from({ length: 15 }, (_, i) => row(battle(meters, pace, intro), pace, 1.5, 7 + i, skills));
      const med = (f: (r: (typeof runs)[number]) => number) => runs.map(f).sort((a, b) => a - b)[7];
      console.log(`     ${label} at ${Math.floor(pace / 60)}:${String(pace % 60).padStart(2, "0")} (${kit}): ${med((r) => r.kills)} KO, best stage ${med((r) => r.best)}, ${med((r) => r.wrecks)} wrecks, ${Math.round(med((r) => r.coins))} coins for ${Math.round(med((r) => r.meters))} m, ${med((r) => r.xp)} XP`);
      if (label === "1K" && pace === 119 && kit === "plain") ok("a 1K at your pace: about three monsters", med((r) => r.kills) >= 2 && med((r) => r.kills) <= 4, runs.map((r) => r.kills));
      if (label === "5K" && pace === 119 && kit === "plain") {
        ok("a 5K at your pace: two stages beaten, no wreck", med((r) => r.bosses) >= 2 && med((r) => r.wrecks) === 0, runs.map((r) => [r.bosses, r.wrecks]));
        ok("coins: at least the meters rowed at your pace (more as the skills grow)", med((r) => r.coins / r.meters) >= 0.95, med((r) => r.coins / r.meters));
      }
      if (label === "5K" && pace === 125 && kit === "plain") ok("a 5K six seconds slow: wrecked at least once", med((r) => r.wrecks) >= 1, runs.map((r) => r.wrecks));
    }
  }
}
{
  const a = row(1500, 119, 1.5, 3);
  const b = row(1500, 119, 1.5, 3, plain, { dmg: 5, hull: 5, quick: 3 });
  console.log(`     upgrades 5/5/3, 25 minutes at your pace: ${a.kills} KO → ${b.kills} KO, best stage ${a.best} → ${b.best}`);
  ok("upgrades take the rower further", b.kills > a.kills && b.best >= a.best, [a.kills, b.kills]);
}
/* A demo at forty times a clock: ticks of four seconds of the row. */
{
  const g = createPve({ t0: 0, seed: 3, own: 119, skills: plain });
  for (let t = 4; t <= 400; t += 4) g.step(t, 119);
  const slow = row(400, 119, 0, 3);
  ok("a demo's big ticks do about what small ones do", Math.abs(g.view().coins - slow.coins) < 0.03 * slow.coins && g.view().kills === slow.kills, [g.view().coins, slow.coins, g.view().kills, slow.kills]);
}
console.log(failed ? `${failed} FAILED` : "all ok");
process.exit(failed ? 1 : 0);
