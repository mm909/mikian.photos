/* The double-elimination engine's rules, checked by hand:
 *   npx tsx src/app/pickleball/bracket.test.ts
 * (plain asserts, exit 1 on the first miss, the hyrox tests' idiom). */
import assert from "node:assert/strict";
import { BYE, bracketSpec, matchLabel, nextPow2, readScore, replay, seedSlots, type Reported } from "./bracket";

/* ------------------------------------------------------------- shapes */
assert.equal(nextPow2(2), 2);
assert.equal(nextPow2(3), 4);
assert.equal(nextPow2(8), 8);
assert.equal(nextPow2(9), 16);

assert.deepEqual(seedSlots(4), [1, 4, 2, 3]);
assert.deepEqual(seedSlots(8), [1, 8, 4, 5, 2, 7, 3, 6]);

/* p=8: 7 winners matches, 6 losers (2+2+1+1), one grand final. */
{
  const specs = bracketSpec(8);
  assert.equal(specs.filter((s) => s.bracket === "W").length, 7);
  assert.equal(specs.filter((s) => s.bracket === "L").length, 6);
  assert.equal(specs.filter((s) => s.bracket === "GF").length, 1);
  assert.equal(specs.length, 14);
}
/* p=16: 15 + 14 + 1. */
assert.equal(bracketSpec(16).length, 30);
/* p=2: no losers bracket; the GF is the W1 loser's second chance. */
{
  const specs = bracketSpec(2);
  assert.equal(specs.length, 2);
  const gf = specs.find((s) => s.key === "GF");
  assert.deepEqual(gf?.b, { kind: "loser", key: "W1-0" });
}

assert.equal(matchLabel({ bracket: "GF", round: 1, index: 0 }), "Grand final");
assert.equal(matchLabel({ bracket: "L", round: 2, index: 1 }), "Losers R2 · 2");

/* ------------------------------------------------- scores read loose */
assert.equal(readScore(11), 11);
assert.equal(readScore("7"), 7);
assert.equal(readScore(""), null);
assert.equal(readScore(31), null);
assert.equal(readScore(-1), null);
assert.equal(readScore(7.5), null);

/* ------------------------------------- a full 6-team double elim (p=8) */
const T = ["t1", "t2", "t3", "t4", "t5", "t6"]; /* seed order */
{
  const empty = replay(T, []);
  assert.equal(empty.p, 8);
  /* Seeds 1 and 2 drew the byes (slots 8 and 7 are empty) … */
  const w10 = empty.matches.find((m) => m.key === "W1-0");
  assert.equal(w10?.bye, true);
  assert.equal(w10?.winner, "t1");
  const w12 = empty.matches.find((m) => m.key === "W1-2");
  assert.equal(w12?.winner, "t2");
  /* … so W2-0 already holds t1 against the W1-1 winner-to-come. */
  const w20 = empty.matches.find((m) => m.key === "W2-0");
  assert.equal(w20?.a, "t1");
  assert.equal(w20?.b, null);
  assert.equal(w20?.bFrom, "Winner of Winners R1 · 2");
  /* The byes' "losers" flow through the losers bracket as byes too. */
  assert.equal(empty.champion, null);
  /* 4 real W1 pairings? No — two byes: W1-1 (t4 v t5) and W1-3 (t3 v t6)
   * are the ready ones. */
  const ready = empty.matches.filter((m) => m.ready).map((m) => m.key);
  assert.deepEqual(ready, ["W1-1", "W1-3"]);
}

const res = (matchKey: string, a: string, b: string, sa: number, sb: number): Reported => ({
  matchKey,
  teamAId: a,
  teamBId: b,
  scoreA: sa,
  scoreB: sb,
});

/* Play it through: t1 never loses; t4 loses early, climbs the losers
 * bracket, and falls in the grand final. */
const results: Reported[] = [];
const play = (key: string, winner: string, loser: string, w = 11, l = 7) => {
  results.push(res(key, winner, loser, w, l));
};

play("W1-1", "t4", "t5"); /* t4 beats t5 */
play("W1-3", "t3", "t6"); /* t3 beats t6 */
{
  const s = replay(T, results);
  /* W2: t1 v t4, t2 v t3. L1 is all byes (W1 losers vs bye-losers):
   * t5 and t6 advance without playing. */
  const w20 = s.matches.find((m) => m.key === "W2-0");
  assert.deepEqual([w20?.a, w20?.b], ["t1", "t4"]);
  const l10 = s.matches.find((m) => m.key === "L1-0");
  assert.equal(l10?.bye, true);
  assert.equal(l10?.winner, "t5");
}
play("W2-0", "t1", "t4", 11, 9);
play("W2-1", "t2", "t3");
{
  const s = replay(T, results);
  /* L2 (major, drop order reversed): L2-0 = t5 v t3 (loser of W2-1),
   * L2-1 = t6 v t4 (loser of W2-0). No instant rematch: t4 beat t5 in
   * W1-1 and meets t6 instead. */
  const l20 = s.matches.find((m) => m.key === "L2-0");
  const l21 = s.matches.find((m) => m.key === "L2-1");
  assert.deepEqual([l20?.a, l20?.b], ["t5", "t3"]);
  assert.deepEqual([l21?.a, l21?.b], ["t6", "t4"]);
}
play("L2-0", "t3", "t5");
play("L2-1", "t4", "t6");
play("W3-0", "t1", "t2"); /* t1 to the final unbeaten; t2 drops */
play("L3-0", "t4", "t3"); /* losers semifinal */
{
  const s = replay(T, results);
  const l40 = s.matches.find((m) => m.key === "L4-0");
  assert.deepEqual([l40?.a, l40?.b], ["t4", "t2"]);
}
play("L4-0", "t4", "t2"); /* t4 wins the losers bracket */
{
  const s = replay(T, results);
  assert.deepEqual([s.final.a, s.final.b], ["t1", "t4"]);
  assert.equal(s.champion, null);
  assert.equal(s.final.ready, true);
}
play("GF", "t1", "t4", 11, 6);
{
  const s = replay(T, results);
  assert.equal(s.champion, "t1");
  assert.equal(s.runnerUp, "t4");
  assert.equal(s.played, s.total);
  /* Everyone but the champion lost at most twice; nobody met a third time
   * before the final — structural sanity: every playable match resolved. */
  assert.ok(s.matches.every((m) => m.bye || m.winner !== null));
}

/* ------------------------------- a correction invalidates downstream */
{
  /* Flip W1-1: now t5 beat t4. Every result that named t4 where t5 now
   * stands (and vice versa) goes stale and is ignored — the bracket
   * reopens from there instead of corrupting. */
  const corrected = results.map((r) => (r.matchKey === "W1-1" ? res("W1-1", "t5", "t4", 11, 3) : r));
  const s = replay(T, corrected);
  const w20 = s.matches.find((m) => m.key === "W2-0");
  assert.deepEqual([w20?.a, w20?.b], ["t1", "t5"]);
  assert.equal(w20?.winner, null, "the old t1-v-t4 score no longer applies");
  assert.equal(w20?.ready, true);
  assert.equal(s.champion, null);
  /* W2-1 (t2 v t3) did not involve the flipped teams and stands. */
  assert.equal(s.matches.find((m) => m.key === "W2-1")?.winner, "t2");
}

/* ------------------------------------------------------- tiny fields */
{
  /* Two teams: they meet, then meet again in the GF. */
  const s = replay(["a", "b"], [res("W1-0", "a", "b", 11, 8)]);
  assert.deepEqual([s.final.a, s.final.b], ["a", "b"]);
  const done = replay(["a", "b"], [res("W1-0", "a", "b", 11, 8), res("GF", "b", "a", 11, 9)]);
  assert.equal(done.champion, "b");
}
{
  /* Three teams (p=4): seed 1 byes to W2. */
  const s = replay(["a", "b", "c"], []);
  assert.equal(s.p, 4);
  const w20 = s.matches.find((m) => m.key === "W2-0");
  assert.equal(w20?.a, "a");
  assert.deepEqual(s.matches.filter((m) => m.ready).map((m) => m.key), ["W1-1"]);
}

/* A tie is never applied. */
{
  const s = replay(T, [res("W1-1", "t4", "t5", 9, 9)]);
  assert.equal(s.matches.find((m) => m.key === "W1-1")?.winner, null);
}

assert.notEqual(T[0], BYE);
console.log("bracket.test.ts: all good");
