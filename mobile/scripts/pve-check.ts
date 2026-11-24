/* The single-player island (src/arcade/pve.ts), checked with no phone:
 * `npx tsx scripts/pve-check.ts` in mobile/. Rows whole pieces through it a
 * tenth of a second at a time at a steady pace, with stroke-to-stroke
 * noise, and prints how many monsters fell. The owner's bar: about three in
 * a 1K at 1:59. */
import { createPve, nearOf, TARGET } from "../src/arcade/pve";
import { prng } from "../src/arcade/rng";

let failed = 0;
const ok = (what: string, pass: boolean, got?: unknown) => {
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${what}${pass ? "" : ` (got ${JSON.stringify(got)})`}`);
};
const gauss = (rnd: () => number) => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());

/* `seconds` of battle at `pace`, noise `sd` seconds a 500. */
function row(seconds: number, pace: number, sd: number, seed: number) {
  const rnd = prng(seed);
  const g = createPve({ t0: 0, seed });
  let p = pace;
  for (let t = 0.1; t <= seconds + 1e-9; t += 0.1) {
    if (Math.round(t * 10) % 21 === 0) p = pace + gauss(rnd) * sd;
    g.step(t, p);
  }
  return g.view();
}

ok("near is 1 at 1:59", nearOf(TARGET) === 1);
ok("near is 1 at 2:00.5 (inside the plateau)", nearOf(120.5) === 1);
ok("near falls off the pace", nearOf(130) < 0.5 && nearOf(130) > 0.2, nearOf(130));
ok("near never under the floor while moving", nearOf(200) === 0.2);
ok("nothing fills when stopped", nearOf(Infinity) === 0);

/* The battle seconds of a piece at 1:59: the piece less the intro (a 1K's
 * is 12 s) and less the last tenth (the finale). */
const battle = (meters: number, pace: number, intro: number) => (meters * 0.9 * pace) / 500 - intro;
for (const [label, meters, intro] of [["1K", 1000, 12], ["2K", 2000, 24], ["5K", 5000, 60]] as const) {
  for (const pace of [119, 122, 125, 130, 140]) {
    const runs = Array.from({ length: 20 }, (_, i) => row(battle(meters, pace, intro), pace, 1.5, 7 + i));
    const kills = runs.map((r) => r.kills).sort((a, b) => a - b);
    const xp = Math.round(runs.reduce((s, r) => s + r.xp, 0) / runs.length);
    const acc = runs.reduce((s, r) => s + r.accSum / Math.max(1, r.throws), 0) / runs.length;
    console.log(`     ${label} at ${Math.floor(pace / 60)}:${String(pace % 60).padStart(2, "0")}: ${kills[0]}-${kills[kills.length - 1]} monsters (median ${kills[10]}), ${xp} XP, accuracy ${Math.round(acc * 100)}%`);
    if (label === "1K" && pace === 119) ok("a 1K at 1:59: about three monsters", kills[10] >= 2 && kills[10] <= 4, kills);
    if (label === "5K" && pace === 119) ok("a 5K at 1:59: many", kills[10] >= 9, kills);
  }
}
/* A demo at forty times a clock: ticks of four seconds of the row. */
{
  const g = createPve({ t0: 0, seed: 3 });
  for (let t = 4; t <= 200; t += 4) g.step(t, 119);
  const slow = row(200, 119, 0, 3);
  ok("a demo's big ticks throw about as often as small ones", Math.abs(g.view().throws - slow.throws) <= 3, [g.view().throws, slow.throws]);
}
console.log(failed ? `${failed} FAILED` : "all ok");
process.exit(failed ? 1 : 0);
