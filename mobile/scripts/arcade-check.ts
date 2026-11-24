/* The arcade (src/arcade), checked with no phone, no monitor and no server:
 * `npx tsx scripts/arcade-check.ts` in mobile/. It asks the schedule where
 * the games go, rows hundreds of games of 159 through the arcade a tenth of
 * a second of the wall at a time, with rowers who hold their pace and
 * rowers who do not, opens a hundred thousand chests, and prints what
 * happened:
 *
 *   a steady rower      their own spread all row, the same pace: mostly wins.
 *   a wobbly rower      steady before the game, and then the pace wanders
 *                       four seconds either way: mostly loses.
 *   a ragged rower      six seconds stroke to stroke all row; the band stops
 *                       at four: mostly loses.
 *   whole pieces        a 5K, the demo 5K at ten times a clock, a 1K demo
 *                       at forty, a plain row.
 */
import { createArcade } from "../src/arcade/arcade";
import { BAND_MAX, BAND_MIN, BAND_NONE, PLAY_M, REWARD_S, SEG_M, SHOTS, TITLE_S, bandOf, type View159 } from "../src/arcade/game159";
import { prng } from "../src/arcade/rng";
import { CLEAR_END_M, GAME_M, gameMarks } from "../src/arcade/schedule";
import { DROP, DROPPABLE, LAYERS, RARITIES, SKIN_BY_ID, TRIPLE, rollChest, rollRarity, wear } from "../src/arcade/skins";

let failed = 0;
const ok = (what: string, pass: boolean, got?: unknown) => {
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${what}${pass ? "" : ` (got ${JSON.stringify(got)})`}`);
};
const fmt = (v: number) => Math.round(v).toLocaleString("en-US");
const pace = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;

/* A normal number off the seeded stream. */
const gauss = (rnd: () => number) => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());

/* ---- where the games go ------------------------------------------------- */
ok("a 5K: games at 1,000, 2,000, 3,000 and 4,000 m", gameMarks(5000).join() === "1000,2000,3000,4000", gameMarks(5000));
ok("a 2K: one, at 1,000 m", gameMarks(2000).join() === "1000", gameMarks(2000));
ok("a 1K: one, at 250 m", gameMarks(1000).join() === "250", gameMarks(1000));
ok("under a 1K: none", gameMarks(800).length === 0 && gameMarks(500).length === 0, gameMarks(800));
ok("a plain row: every 1,000 m after the first 500", gameMarks(0, 4200).slice(0, 5).join() === "1000,2000,3000,4000,5000", gameMarks(0, 4200));
const bad: string[] = [];
for (let t = 1000; t <= 21100; t += 100) {
  for (const at of gameMarks(t)) {
    if (at + GAME_M > t - CLEAR_END_M) bad.push(`${t}: ${at} runs into the last 500`);
    if (t >= 2000 && at < 500) bad.push(`${t}: ${at} is in the first 500`);
  }
}
ok("from 1K to a half marathon, no game in the last 500 m, nor the first 500 of a 2K or more", bad.length === 0, bad.slice(0, 5));

/* ---- the band ------------------------------------------------------------ */
const sample = (sd: number, n: number, seed: number) => {
  const r = prng(seed);
  return Array.from({ length: n }, () => 119 + sd * gauss(r));
};
const b16 = bandOf(sample(1.8, 30, 1));
ok("the band is the rower's own spread: about 1.8 s for a rower 1.8 s stroke to stroke", Math.abs(b16.band - 1.8) < 0.5 && b16.n === 30, b16);
ok(`the band is never under ${BAND_MIN} s`, bandOf(sample(0.3, 30, 2)).band === BAND_MIN, bandOf(sample(0.3, 30, 2)));
ok(`the band is never over ${BAND_MAX} s`, bandOf(sample(8, 30, 3)).band === BAND_MAX, bandOf(sample(8, 30, 3)));
ok(`too few strokes: the band is ${BAND_NONE} s`, bandOf(sample(1.8, 5, 4)).band === BAND_NONE, bandOf(sample(1.8, 5, 4)));

/* ---- rowing it ------------------------------------------------------------ */

/* A rower: the pace of a stroke at `m`, and the strokes a minute. */
type Rower = { name: string; stroke: (m: number, rnd: () => number) => number; spm?: number };
type Seen = { id: string; startM: number; titleS: number; lockM: number; locked: number; band: number; shots: View159["shots"]; shotM: number[]; won: boolean | null; resultM: number; rewardS: number; chest: View159["chest"]; phases: string[]; at: Record<string, number> };

/* A whole piece through the arcade: `speed` times a clock, a tick every
 * tenth of a second of the wall, and ten seconds of the wall after the
 * finish for a chest that is still opening. */
function rowIt(target: number, rower: Rower, seed: number, speed = 1, plainTo = 0): { games: Seen[]; log: ReturnType<typeof createArcade>["log"] } {
  const rnd = prng(seed);
  const arcade = createArcade(seed);
  const DT = 0.1;
  const spm = rower.spm ?? 28;
  let wall = 1000;
  let m = 0;
  let strokes = 0;
  let nextStroke = 0;
  let rowT = 0;
  let now = rower.stroke(0, rnd);
  let endedAt = -1;
  const end = target > 0 ? target : plainTo;
  const seen = new Map<string, Seen>();
  let open: Seen | null = null;
  for (let i = 0; i < 2_000_000; i++) {
    wall += DT;
    const ended = m >= end;
    if (!ended) {
      rowT += DT * speed;
      if (rowT >= nextStroke) {
        nextStroke += 60 / spm;
        strokes++;
        now = rower.stroke(m, rnd);
      }
      m = Math.min(end, m + (500 / now) * DT * speed);
    } else if (endedAt < 0) endedAt = wall;
    if (endedAt > 0 && wall - endedAt > 10) break;
    const v = arcade.step({ now: wall, m, pace: now, spm, strokes, target, ended: ended && target > 0 });
    if (!v) {
      /* The game before has gone: how long its chest was up. */
      if (open && open.at.reward !== undefined && !open.rewardS) open.rewardS = wall - open.at.reward;
      open = null;
      continue;
    }
    let s = seen.get(v.id);
    if (!s) {
      s = { id: v.id, startM: m, titleS: 0, lockM: 0, locked: 0, band: v.band, shots: [], shotM: [], won: null, resultM: 0, rewardS: 0, chest: null, phases: [], at: {} };
      seen.set(v.id, s);
    }
    open = s;
    if (s.phases[s.phases.length - 1] !== v.phase) {
      s.at[v.phase] = wall;
      if (v.phase === "play") {
        s.titleS = wall - s.at.title;
        s.lockM = m;
        s.locked = v.locked;
      }
      if (v.phase === "result") s.resultM = m;
      s.phases.push(v.phase);
    }
    if (v.shots.length > s.shots.length) for (let k = s.shots.length; k < v.shots.length; k++) s.shotM.push(m);
    s.shots = v.shots;
    s.won = v.won;
    if (v.chest) s.chest = v.chest;
  }
  return { games: [...seen.values()], log: arcade.log };
}

/* The pace of the rower who holds it: their own spread, the same middle. */
const steady: Rower = { name: "steady", stroke: (_m, r) => 119 + 1.8 * gauss(r) };
/* Steady until the game, then the pace wanders four seconds either way
 * over 120 m and the strokes are rougher. */
const wobbly: Rower = { name: "wobbly", stroke: (m, r) => (m >= 1000 && m < 1300 ? 119 + 4.2 * Math.sin((m - 1000) / 19) + 2.6 * gauss(r) : 119 + 1.8 * gauss(r)) };
const ragged: Rower = { name: "ragged", stroke: (_m, r) => 119 + 6 * gauss(r) };

function many(rower: Rower, n: number) {
  let won = 0;
  let lucky = 0;
  let hits = 0;
  let shots = 0;
  const games: Seen[] = [];
  for (let i = 0; i < n; i++) {
    const { games: g } = rowIt(2000, rower, 1000 + i);
    for (const s of g) {
      games.push(s);
      if (s.won) won++;
      for (const x of s.shots) {
        shots++;
        if (x.hit) hits++;
        if (x.lucky) lucky++;
      }
    }
  }
  return { won, lucky, hits, shots, games, rate: won / Math.max(1, games.length) };
}

function printGame(title: string, s: Seen) {
  console.log(`\n${title}: band ±${s.band.toFixed(1)} s, locked ${pace(s.locked)} at ${fmt(s.lockM)} m after ${s.titleS.toFixed(1)} s of title`);
  s.shots.forEach((x, i) => console.log(`  shot ${x.n} at ${fmt(s.shotM[i])} m  ${pct(x.share).padStart(4)} in the band  ${x.hit ? "HIT" : x.lucky ? "LUCKY" : "miss"}  -> ${x.target ?? "nothing"}`));
  console.log(`  ${s.won ? "FIELD CLEAR" : "WIPED OUT"}. Chest: ${s.chest ? `${s.chest.triple ? "THREE: " : ""}${s.chest.items.map((id) => `${SKIN_BY_ID[id].name} (${SKIN_BY_ID[id].rarity})`).join(", ")}` : "none"}`);
}

const N = 300;
const st = many(steady, N);
const wo = many(wobbly, N);
const ra = many(ragged, N);
printGame("A steady rower's game", st.games[0]);
printGame("A wobbly rower's game", wo.games[0]);
console.log(`\n${N} games each, a 2K at a clock's speed, the game at 1,000 m:`);
for (const [w, r] of [["steady", st], ["wobbly", wo], ["ragged", ra]] as const) console.log(`  ${w.padEnd(7)} won ${pct(r.rate).padStart(4)}  hits ${pct(r.hits / r.shots).padStart(4)} of shots  lucky ${r.lucky}`);

ok("one game on every 2K, and every one played to its chest", [st, wo, ra].every((r) => r.games.length === N && r.games.every((g) => g.phases.join(" ") === "title play result reward" && !!g.chest)), st.games.find((g) => g.phases.join(" ") !== "title play result reward")?.phases);
ok("a steady rower mostly wins (60% or more)", st.rate >= 0.6, st.rate);
ok("a wobbly rower mostly loses (25% or less)", wo.rate <= 0.25, wo.rate);
ok("a ragged rower mostly loses (a third or less: the band stops at 4 s, so they win some)", ra.rate <= 0.35, ra.rate);
const allLucky = st.lucky + wo.lucky + ra.lucky;
ok("lucky hits happen", allLucky > 0, allLucky);
ok("a lucky hit is only ever a stretch that missed", [st, wo, ra].every((r) => r.games.every((g) => g.shots.every((x) => !(x.lucky && x.hit)))));
ok("a win is four shots that landed, hit or lucky", [st, wo, ra].every((r) => r.games.every((g) => g.won === g.shots.every((x) => x.hit || x.lucky))));
ok(`every game fires ${SHOTS} shots, ${SEG_M} m apart, over ${PLAY_M} m from the lock`, st.games.every((g) => g.shots.length === SHOTS && g.shotM.every((m, i) => Math.abs(m - g.lockM - SEG_M * (i + 1)) < 1)), st.games[0].shotM.map((m) => m - st.games[0].lockM));
ok(`the title card is ${TITLE_S} s of the wall on a real monitor`, st.games.every((g) => Math.abs(g.titleS - TITLE_S) < 0.15), st.games.map((g) => g.titleS).slice(0, 5));
ok("the locked pace is the pace they were rowing (inside 2.5 s of 1:59)", st.games.every((g) => Math.abs(g.locked - 119) < 2.5), st.games.map((g) => g.locked).filter((p) => Math.abs(p - 119) >= 2.5).slice(0, 5));
ok(`the chest is up ${REWARD_S} s of the wall`, st.games.every((g) => Math.abs(g.rewardS - REWARD_S) < 0.15), st.games.map((g) => g.rewardS).slice(0, 5));
ok("a chest is one item or three", [st, wo, ra].every((r) => r.games.every((g) => g.chest && (g.chest.items.length === 1 || (g.chest.triple && g.chest.items.length === 3)))));

/* ---- whole pieces --------------------------------------------------------- */
const piece = (name: string, target: number, speed: number, want: number[], plainTo = 0) => {
  const r = rowIt(target, steady, 77, speed, plainTo);
  console.log(`\n${name}: ${r.games.map((g) => `${fmt(g.startM)} m ${g.phases.join(">")} ${g.won ? "WON" : "lost"}`).join("; ")}`);
  ok(`${name}: games at ${want.map(fmt).join(", ")} m`, r.log.map((l) => l.at).join() === want.join(), r.log.map((l) => l.at));
  ok(`${name}: every game opened its chest`, r.log.every((l) => l.phase === "done"), r.log);
  if (target > 0) ok(`${name}: every game was over before the last 500 m (on the water)`, r.games.every((g) => g.resultM <= target - CLEAR_END_M + (speed > 1 ? 120 : 0)), r.games.map((g) => g.resultM));
  return r;
};
piece("A 5K", 5000, 1, [1000, 2000, 3000, 4000]);
piece("The demo 5K, ten times a clock", 5000, 10, [1000, 2000, 3000, 4000]);
piece("A 1K demo at forty times a clock", 1000, 40, [250]);
piece("A 2K demo at ten times", 2000, 10, [1000]);
piece("A plain row of 3,600 m", 0, 1, [1000, 2000, 3000], 3600);

/* ---- the chest ------------------------------------------------------------ */
const tally: Record<string, number> = {};
const R2 = prng(5);
for (let i = 0; i < 100_000; i++) {
  const r = rollRarity(R2);
  tally[r] = (tally[r] ?? 0) + 1;
}
console.log(`\n100,000 drops: ${RARITIES.map((r) => `${r} ${(tally[r] / 1000).toFixed(1)}%`).join(", ")}`);
ok("drops are about 60 / 25 / 10 / 4 / 1", RARITIES.every((r) => Math.abs(tally[r] / 1000 - DROP[r]) < (r === "legendary" ? 0.3 : 1)), tally);
let tripleL = 0;
let tripleW = 0;
let distinct = true;
const R3 = prng(6);
for (let i = 0; i < 50_000; i++) {
  const a = rollChest(R3, false);
  const b = rollChest(R3, true);
  if (a.triple) tripleL++;
  if (b.triple) tripleW++;
  for (const c of [a, b]) if (new Set(c.items).size !== c.items.length) distinct = false;
}
console.log(`Three-item chests: ${pct(tripleL / 50_000)} after a loss, ${pct(tripleW / 50_000)} after a win.`);
ok(`a chest bursts into three ${pct(TRIPLE.lose)} of the time, ${pct(TRIPLE.win)} after a win`, Math.abs(tripleL / 50_000 - TRIPLE.lose) < 0.01 && Math.abs(tripleW / 50_000 - TRIPLE.win) < 0.01, { tripleL, tripleW });
ok("three items are three different ones", distinct);
ok(`between 25 and 40 items to find (${DROPPABLE.length})`, DROPPABLE.length >= 25 && DROPPABLE.length <= 40, DROPPABLE.length);
ok("every layer has an item of every rarity", LAYERS.every((l) => RARITIES.every((r) => DROPPABLE.some((s) => s.layer === l && s.rarity === r))), LAYERS.map((l) => [l, RARITIES.filter((r) => !DROPPABLE.some((s) => s.layer === l && s.rarity === r))]));
ok("every item has a name and a unique id", new Set(DROPPABLE.map((s) => s.id)).size === DROPPABLE.length && DROPPABLE.every((s) => s.name.length > 1));
ok("an unknown id is worn as the stock item", wear({ hull: "gone-for-good" }).hull.fill === "paper");
console.log(`  ${LAYERS.map((l) => `${l}: ${DROPPABLE.filter((s) => s.layer === l).length}`).join(", ")}`);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
