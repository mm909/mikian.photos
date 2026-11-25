/* The swarm (src/arcade/swarm.ts), checked with no phone:
 * `npx tsx scripts/swarm-check.ts` in mobile/. Rows whole rounds through it
 * at a steady pace with stroke-to-stroke noise; the rower's own pace is
 * 1:59. */
import { SKILL_BY_ID } from "../src/arcade/pve";
import { prng } from "../src/arcade/rng";
import { ROUND_S, createSwarm } from "../src/arcade/swarm";

let failed = 0;
const ok = (what: string, pass: boolean, got?: unknown) => {
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${what}${pass ? "" : ` (got ${JSON.stringify(got)})`}`);
};
const gauss = (rnd: () => number) => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
const plain = [SKILL_BY_ID.jab, SKILL_BY_ID.throw, SKILL_BY_ID.cannon];

function round(pace: number, seed: number, tickS = 0.1) {
  const rnd = prng(seed);
  const g = createSwarm({ t0: 0, seed, own: 119, base: 121, skills: plain });
  let p = pace;
  for (let t = tickS; t <= ROUND_S + 1e-9; t += tickS) {
    if (Math.round(t * 10) % 21 === 0) p = pace + gauss(rnd) * 1.5;
    g.step(t, p);
  }
  return g.view();
}

for (const pace of [115, 119, 121, 125, 132, 145]) {
  const rs = Array.from({ length: 12 }, (_, i) => round(pace, 11 + i));
  const med = (f: (r: (typeof rs)[number]) => number) => rs.map(f).sort((a, b) => a - b)[6];
  const wrecked = rs.filter((r) => r.wrecked).length;
  console.log(`     ${Math.floor(pace / 60)}:${String(pace % 60).padStart(2, "0")}: ${med((r) => r.kills)} fish, ${med((r) => r.xp)} XP, hull left ${Math.round(med((r) => r.hull))}/${rs[0].hullMax}, wrecked ${wrecked}/12, ${Math.round(med((r) => r.end))} s`);
  if (pace === 119) ok("at your pace: lives the round, and kills plenty", wrecked <= 2 && med((r) => r.kills) >= 40, { wrecked, kills: med((r) => r.kills) });
  if (pace === 145) ok("well under your pace: wrecked", wrecked >= 8, wrecked);
}
{
  const a = round(119, 5, 0.1);
  const b = round(119, 5, 4);
  console.log(`     a demo's 4 s ticks: ${b.kills} fish against ${a.kills}`);
  ok("a demo's big ticks do about what small ones do", Math.abs(a.kills - b.kills) <= Math.max(6, a.kills * 0.25), [a.kills, b.kills]);
}
console.log(failed ? `${failed} FAILED` : "all ok");
process.exit(failed ? 1 : 0);
