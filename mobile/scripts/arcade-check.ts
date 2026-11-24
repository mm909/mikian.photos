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
import { AIM_S, CYCLE_S, HEALTH, HIT_SLACK, LUCK_AT_LINE, createMatch, holds, luckOf } from "../src/arcade/match";
import { GRID_S, HOME_MIN_S, INTRO_S, FINALE, LAST_MATCH, createShow, healthOf, scaleOf, type ShowCtx, type ShowView } from "../src/arcade/show";
import { DRAW_XP, ELO_K, WIN_XP, botElo, eloAfter, levelOf, matchXp, needFor } from "../src/arcade/score";
import type { Ghost } from "../src/erg/ghosts";

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

/* ==== 159, THE MATCH, and THE SHOW BY THE CLOCK ============================
 * (owner, 2026-11-24: the show keyed off the row's own seconds; the match
 * on health, damage the meters rowed in the aim.) */
console.log("\n---- the match ----");

/* The hit rule: the aim's pace, read in tenths, at the pace given or within
 * HIT_SLACK of it. */
ok(`the hit rule: 1:59.9 holds 1:59, 2:00.0 does not, 1:55 does (slack ${HIT_SLACK})`, holds(119.95, 119) && holds(119.9, 119) && !holds(120.0, 119) && holds(115, 119) && !holds(Infinity, 119));
ok("an off-pace shot lands less the further off it is", luckOf(120.0, 119) > luckOf(122, 119) && luckOf(122, 119) > luckOf(126, 119) && luckOf(118, 119) === LUCK_AT_LINE);

/* Even lines, for the arithmetic. */
const line = (pace: number) => (t: number) => (t > 0 ? (500 / pace) * t : 0);
const lines = (a: (t: number) => number, b: (t: number) => number) => (id: string, t: number) => (id === "me" ? a(t) : b(t));
{
  /* Both hold their pace: every round both land, and every round cancels. */
  const m = createMatch({ id: "c", t0: 100, sides: [{ id: "me", name: "You", kind: "me", assigned: 119 }, { id: "b", name: "Bot", kind: "bot", assigned: 125 }], metersAt: lines(line(119), line(125)), seed: 1 });
  const v = m.step(100 + CYCLE_S * 10 + 0.5);
  ok("both land at once: they cancel, nobody is hurt (10 rounds)", v.shots.length === 20 && v.shots.every((s) => s.hit && s.cancelled && s.damage === 0) && v.players.every((p) => p.health === HEALTH) && v.phase !== "over", v.players.map((p) => p.health));
}
{
  /* The rower holds 1:59; the bot, given 2:05, rows 2:10 and (all but)
   * never lands. Damage is the rower's meters in the aim: 3 s at 1:59 is
   * 12.6 m, so 13 a shot. */
  const m = createMatch({ id: "d", t0: 0, sides: [{ id: "me", name: "You", kind: "me", assigned: 119 }, { id: "b", name: "Bot", kind: "bot", assigned: 125 }], metersAt: lines(line(119), line(130)), seed: 2 });
  let v = m.step(0);
  for (let t = 0; t < 400 && v.phase !== "over"; t += 0.1) v = m.step(t);
  const mine = v.shots.filter((s) => s.from === "me");
  const per = Math.round((500 / 119) * AIM_S);
  const rounds = Math.ceil(HEALTH / per);
  ok(`damage is the meters rowed in the aim: ${per} a shot at 1:59`, mine.every((s) => s.damage === per || s.cancelled), mine.map((s) => s.damage));
  ok(`health ${HEALTH}: the bot is out after ${rounds} clean rounds, ${rounds * CYCLE_S} s, and the rower wins`, v.winner === "me" && v.endAt === rounds * CYCLE_S && v.players.find((p) => p.id === "b")?.health === 0, { winner: v.winner, end: v.endAt });
  ok("a shot that does not land does no damage", v.shots.filter((s) => !s.hit).every((s) => s.damage === 0));
  ok("the rower's meters in the match are counted", Math.abs((v.players.find((p) => p.id === "me")?.rowed ?? 0) - line(119)(v.endAt)) < 0.01);
}
{
  /* Called: the more health wins; level is a draw. */
  const m = createMatch({ id: "e", t0: 0, sides: [{ id: "me", name: "You", kind: "me", assigned: 119 }, { id: "b", name: "Bot", kind: "bot", assigned: 125 }], metersAt: lines(line(119), line(130)), seed: 3 });
  m.step(13);
  const v = m.call(13);
  ok("a match called by the show: the more health wins", v.called && v.winner === "me" && v.phase === "over", v);
  const d = createMatch({ id: "f", t0: 0, sides: [{ id: "me", name: "You", kind: "me", assigned: 119 }, { id: "b", name: "Bot", kind: "bot", assigned: 125 }], metersAt: lines(line(119), line(125)), seed: 4 });
  d.step(30);
  ok("called level: a draw", d.call(30).winner === "draw");
  const late = createMatch({ id: "g", t0: 0, sides: [{ id: "me", name: "You", kind: "me", assigned: 119 }, { id: "b", name: "Bot", kind: "bot", assigned: 125 }], metersAt: lines(line(119), line(125)), seed: 5, late: ["me"] });
  const lv = late.step(6.5);
  ok("a rower who failed the ready check loses only the first shot", lv.shots.length === 1 && lv.shots[0].from === "b" && lv.players[0].health === HEALTH - Math.round((500 / 125) * 3), lv.shots);
}

/* ---- rowers and saved rows for the show ---------------------------------- */
type SRower = { name: string; pace: number; sd: number; wander?: (t: number) => number };
const steadyS: SRower = { name: "steady 1:59", pace: 119, sd: 1.8 };
const wobblyS: SRower = { name: "wobbly 1:59", pace: 119, sd: 2.6, wander: (t) => 4.5 * Math.sin(t / 9) };
const slowS: SRower = { name: "steady 2:30", pace: 150, sd: 2.2 };

/* A field of saved rows over `M` meters: two a second from 1:48 to 2:45,
 * every third one logged by hand (no lines), the rest recorded with their
 * 100 m lines, each with its own spread and a little fade. */
function fieldOf(M: number, seed: number): Ghost[] {
  const r = prng(seed);
  const out: Ghost[] = [];
  let k = 0;
  for (let p = 108; p <= 165; p += 0.5) {
    k++;
    const recorded = k % 3 !== 0;
    const marks: number[] = [];
    let t = 0;
    for (let m = 100; m <= M; m += 100) {
      const split = (p + 1.4 * gauss(r) + 1.5 * (m / M - 0.5)) / 5;
      t += split;
      marks.push(+t.toFixed(1));
    }
    out.push({ id: `g${k}`, kind: "field", name: `Rower ${k}`, numStr: String(k).padStart(3, "0"), day: "NOV 1", seconds: t, spm: 28, marks: recorded ? marks : [] });
  }
  return out;
}

type Rowed = { show: ReturnType<typeof createShow>; phases: { phase: string; t: number; m: number }[]; end: ShowView; wallS: number; rowS: number };
/* A whole piece through the show: `speed` times a clock, a tick each tenth of
 * a second of the wall, the monitor's word every half second of the wall as
 * a PM5 gives it, and 15 s of the wall after the finish. */
function showIt(target: number, rower: SRower, seed: number, speed = 1, plainTo = 0, assigned: number | null = rower.pace, ghostsOn = true): Rowed {
  const rnd = prng(seed);
  const show = createShow(seed);
  const M = target > 0 ? target : 5000;
  const ctx: ShowCtx = { assigned, elo: 1200, xp: 0, lifetime: 0, ghosts: ghostsOn ? fieldOf(M, seed + 1) : [], ghostM: M, loaded: true };
  const end = target > 0 ? target : plainTo;
  let wall = 1000;
  let t = 0;
  let m = 0;
  let next = 0;
  let pace = rower.pace;
  let noise = 0;
  let saidT = 0;
  let saidM = 0;
  let endedAt = -1;
  let v: ShowView | null = null;
  for (let i = 0; i < 3_000_000; i++) {
    wall += 0.1;
    if (m < end) {
      const dt = 0.1 * speed;
      t += dt;
      if (t >= next) {
        next += 60 / 28;
        noise = 0.5 * noise + 0.87 * rower.sd * gauss(rnd);
        pace = rower.pace + noise + (rower.wander ? rower.wander(t) : 0);
      }
      m = Math.min(end, m + (500 / pace) * dt);
    } else if (endedAt < 0) endedAt = wall;
    if (endedAt > 0 && wall - endedAt > 15) break;
    /* The monitor's word, twice a second of the wall. */
    if (i % 5 === 0 || m >= end) {
      saidT = t;
      saidM = m;
    }
    v = show.step({ wall, t: saidT, m: saidM, pace, target, ended: target > 0 && m >= end }, ctx);
    /* What the hook does: the XP and the rating are banked as each match ends. */
    if (v.phase === "celebrate" && v.result && !banked.has(`${seed}/${v.result.id}`)) {
      banked.add(`${seed}/${v.result.id}`);
      ctx.xp += v.result.xp;
      ctx.elo = v.result.eloAfter;
    }
  }
  return { show, phases: show.log.phases, end: v as ShowView, wallS: wall - 1000, rowS: t };
}
const banked = new Set<string>();

const durations = (r: Rowed) => r.show.log.matches.filter((x) => x.result).map((x) => x.end - x.t0);
const median = (v: number[]) => (v.length ? [...v].sort((a, b) => a - b)[v.length >> 1] : 0);
const clockOf = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

function printShow(title: string, r: Rowed) {
  console.log(`\n${title}:`);
  console.log(`  ${r.phases.map((p) => `${p.phase} ${clockOf(p.t)}/${fmt(p.m)}m`).join(" > ")}`);
  for (const x of r.show.log.matches) {
    const res = x.result;
    if (!res) continue;
    const mv = x.match;
    const mine = mv.shots.filter((s) => s.from === "me");
    const theirs = mv.shots.filter((s) => s.from !== "me");
    console.log(`  ${x.id} vs ${res.opp.name} (given ${pace(res.opp.assigned)}, Elo ${res.opp.elo}): gun ${fmt(x.m0)} m, ${Math.round(x.end - x.t0)} s, ${res.result.toUpperCase()}${res.called ? " (called)" : ""} ${res.health.me}-${res.health.opp} of ${res.health.max}; you landed ${mine.filter((s) => s.hit && !s.cancelled).length}/${mine.length} (lucky ${mine.filter((s) => s.lucky).length}), they ${theirs.filter((s) => s.hit && !s.cancelled).length}/${theirs.length}, cancels ${mine.filter((s) => s.cancelled).length}; +${res.xp} XP, Elo ${res.eloBefore}->${res.eloAfter}`);
  }
  if (r.end.final) console.log(`  final chest: ${r.end.final.chest.items.map((id) => SKIN_BY_ID[id].name).join(", ")}; the row's XP ${r.end.xpRow}`);
}

console.log("\n---- the show ----");
ok("a 5K's show is the 5K's; a 1K's is cut to a fifth; a plain row's is a 5K's", scaleOf(5000) === 1 && scaleOf(1000) === 0.2 && scaleOf(0) === 1 && scaleOf(500) === 0.2);
ok(`health: ${HEALTH} m on a 5K, ${healthOf(1000)} m on a 1K, ${healthOf(2000)} m on a 2K`, healthOf(5000) === HEALTH && healthOf(1000) < HEALTH / 2);

const checkPiece = (name: string, r: Rowed, target: number) => {
  const ph = r.phases;
  const at = (p: string) => ph.find((x) => x.phase === p);
  const lv = at("levelup");
  const fin = at("finish");
  const ch = at("chest");
  const starts = r.show.log.matches.map((x) => x.m0);
  ok(`${name}: starts on the intro, and home follows it at ${clockOf(INTRO_S * scaleOf(target))}`, ph[0].phase === "intro" && ph[1]?.phase === "home" && Math.abs(ph[1].t - INTRO_S * scaleOf(target)) < 1 * r.end.rate + 0.6, ph.slice(0, 2));
  ok(`${name}: at least one match`, starts.length >= 1, starts);
  ok(`${name}: no match started past 80% (${fmt(LAST_MATCH * target)} m)`, starts.every((m0) => m0 < LAST_MATCH * target), starts);
  ok(`${name}: every match has its celebration`, r.show.log.matches.every((x) => !!x.result));
  /* A match on at 90% is called, and the level up waits for its
   * celebration: at ten times a clock that hold can run to the line, and
   * the finish line is then the level up's own. */
  const before = lv ? ph[ph.indexOf(lv) - 1] : undefined;
  const onTime = !!lv && lv.m >= FINALE * target - 1 && lv.m < FINALE * target + 0.06 * target;
  const afterCard = !!lv && before?.phase === "celebrate" && before.m <= FINALE * target + 0.06 * target;
  ok(`${name}: the level up at 90% (${fmt(FINALE * target)} m), or as the celebration on then ends`, onTime || afterCard, { lv, before });
  ok(`${name}: then the finish line (unless the level up ran to the line), then the chest at ${fmt(target)} m`, !!ch && ch.m >= target - 0.5 && !!r.end.final && (fin ? fin.t >= (lv?.t ?? 0) : (lv?.m ?? 0) >= target - 0.5), { fin, ch });
  ok(`${name}: home is a minute at least (its share), every time`, ph.every((p, i) => p.phase !== "home" || !ph[i + 1] || ph[i + 1].phase !== "lobby" || ph[i + 1].t - p.t >= HOME_MIN_S * scaleOf(target) - 1), ph.map((p) => `${p.phase}@${Math.round(p.t)}`));
  ok(`${name}: every lobby starts on a whole minute (its share) of the row`, ph.filter((p) => p.phase === "lobby").every((p) => { const g = GRID_S * scaleOf(target); return Math.abs(p.t / g - Math.round(p.t / g)) * g < 1.2 * r.end.rate; }), ph.filter((p) => p.phase === "lobby").map((p) => p.t));
};

const five = showIt(5000, steadyS, 31);
printShow("A 5K, a steady 1:59 rower against bots", five);
checkPiece("a 5K", five, 5000);
ok("a 5K at 1:59 plays two or three matches", five.show.log.matches.length >= 2 && five.show.log.matches.length <= 4, five.show.log.matches.length);
ok("the row's XP is its matches' XP", five.end.xpRow === five.show.log.matches.reduce((s, x) => s + (x.result?.xp ?? 0), 0));

const fiveDemo = showIt(5000, steadyS, 32, 10);
printShow("The demo 5K at ten times a clock", fiveDemo);
checkPiece("the demo 5K at 10x", fiveDemo, 5000);
const oneDemo = showIt(1000, steadyS, 33, 10);
printShow("A 1K demo at ten times a clock", oneDemo);
checkPiece("a 1K demo at 10x", oneDemo, 1000);
const oneReal = showIt(1000, steadyS, 34, 1);
printShow("A 1K at a clock's speed", oneReal);
checkPiece("a 1K", oneReal, 1000);
const slowFive = showIt(5000, slowS, 35);
printShow("A 5K, a steady 2:30 rower", slowFive);
checkPiece("a 2:30 5K", slowFive, 5000);
const plain = showIt(0, steadyS, 36, 1, 4000);
printShow("A plain row of 4,000 m", plain);
ok("a plain row: intro, home and matches, and no finale", plain.show.log.matches.length >= 2 && !plain.phases.some((p) => ["levelup", "finish", "chest"].includes(p.phase)) && !plain.end.final, plain.phases.map((p) => p.phase));
const noRows = showIt(2000, steadyS, 37, 4, 0, 119, false);
ok("no saved rows: a pace bot is played", noRows.show.log.matches.length >= 1 && noRows.show.log.matches.every((x) => x.result?.opp.name.startsWith("Pace bot")), noRows.show.log.matches.map((x) => x.result?.opp.name));
const noPace = showIt(2000, steadyS, 38, 4, 0, null);
ok("no median known: the pace given is the pace of the row so far (about 1:59)", noPace.show.log.matches.every((x) => Math.abs((x.match.players.find((p) => p.id === "me")?.assigned ?? 0) - 119) <= 2), noPace.show.log.matches.map((x) => x.match.players[0].assigned));

/* ---- many matches: how long, who wins ------------------------------------ */
function many5k(rower: SRower, n: number) {
  const d: number[] = [];
  let won = 0;
  let games = 0;
  let draws = 0;
  for (let i = 0; i < n; i++) {
    const r = showIt(5000, rower, 500 + i * 7);
    d.push(...durations(r));
    for (const x of r.show.log.matches) {
      if (!x.result) continue;
      games++;
      if (x.result.result === "win") won++;
      if (x.result.result === "draw") draws++;
    }
  }
  const s = [...d].sort((a, b) => a - b);
  return { games, won, draws, med: median(d), p10: s[Math.floor(s.length * 0.1)], p90: s[Math.floor(s.length * 0.9)], rate: won / Math.max(1, games) };
}
const N5 = 40;
const mSteady = many5k(steadyS, N5);
const mWobbly = many5k(wobblyS, N5);
const mSlow = many5k(slowS, N5);
console.log(`\n${N5} 5Ks each, every match against a bot near the rower's level:`);
for (const [w, r] of [["steady 1:59", mSteady], ["wobbly 1:59", mWobbly], ["steady 2:30", mSlow]] as const) console.log(`  ${w.padEnd(12)} ${r.games} matches, won ${pct(r.rate).padStart(4)} (${r.draws} drawn), a match lasts ${clockOf(r.med)} (most ${clockOf(r.p10)} to ${clockOf(r.p90)})`);
ok("evenly matched, a match lasts about 1:30 to 3:00 (the middle one)", mSteady.med >= 90 && mSteady.med <= 180, mSteady.med);
ok("a steady rower against a bot of their level wins some and loses some (30-80%)", mSteady.rate >= 0.3 && mSteady.rate <= 0.8, mSteady.rate);
ok("a wobbly rower wins less than a steady one", mWobbly.rate < mSteady.rate, { wobbly: mWobbly.rate, steady: mSteady.rate });
ok("a 2:30 rower's matches still end (inside 4:30)", mSlow.med > 0 && mSlow.med <= 270, mSlow.med);

/* ---- the score ------------------------------------------------------------ */
console.log("\n---- the score ----");
ok(`Elo: an even win is +${ELO_K / 2}, an even loss -${ELO_K / 2}, a draw nothing`, eloAfter(1200, 1200, 1) === 1216 && eloAfter(1200, 1200, 0) === 1184 && eloAfter(1200, 1200, 0.5) === 1200);
ok("a bot 2 s quicker is rated 80 more, and beating it is worth more", botElo(1200, 119, 117) === 1280 && eloAfter(1200, 1280, 1) - 1200 > 16 && eloAfter(1200, 1120, 1) - 1200 < 16, [eloAfter(1200, 1280, 1), eloAfter(1200, 1120, 1)]);
ok("the rating moves through a row's matches", five.show.log.matches.every((x) => x.result && (x.result.result === "draw" || x.result.eloAfter !== x.result.eloBefore)));
ok(`XP: meters rowed plus ${WIN_XP} for a win, ${DRAW_XP} a draw`, matchXp(412.4, "win") === 512 && matchXp(412.4, "draw") === 462 && matchXp(412.4, "loss") === 412);
ok(`levels: ${needFor(1)} XP to level 2, ${needFor(2)} more to 3`, levelOf(0).level === 1 && levelOf(1499).level === 1 && levelOf(1500).level === 2 && levelOf(3249).level === 2 && levelOf(3250).level === 3 && levelOf(3250).into === 0);
console.log(`  levels: ${[1, 2, 3, 5, 10].map((l) => `${l}->${l + 1} ${needFor(l)}`).join(", ")} XP; a steady 5K's matches gave ${five.end.xpRow} XP`);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
