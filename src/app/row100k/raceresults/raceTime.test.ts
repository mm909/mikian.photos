/* THE RACE SURFACES (types.ts): whole seconds floored, never rounded; the
 * split floored off the raw seconds; the seed with its asterisk; PR and
 * FIRST 5K off the one rule; the podium with no fourth; ties after the
 * floor keeping the tenths order. Run: npx tsx src/app/row100k/raceresults/raceTime.test.ts */
import assert from "node:assert/strict";
import {
  bracketView,
  fmtGap,
  fmtRaceTime,
  fmtSeed,
  fmtSplitFor,
  isFirst5k,
  isPr,
  podium,
  raceTag,
  ranked,
  type ResultBoard,
  type ResultRacer,
} from "./types";

function racer(id: string, seconds: number, best: ResultRacer["best5k"], wave = 1, lane = 1): ResultRacer {
  return { id, name: id, rowerNumber: 1, bracket: "F", wave, lane, status: "finished", seconds, best5k: best };
}

function boardOf(racers: ResultRacer[]): ResultBoard {
  return {
    raceSlug: "t",
    dateLine: "Race day · Sunday, Sep 27 · 5,000 m",
    placeLine: "The Strip Barbell · The Engine Room",
    meters: 5000,
    ergs: 10,
    waveMinutes: 45,
    state: "finished",
    nowMs: 0,
    updatedAtMs: 0,
    waves: [{ wave: 1, scheduledAtMs: 0, startedAtMs: null, state: "rowed" }],
    racers,
    youId: null,
    sample: true,
  };
}

async function main() {
  /* Floored, every time: 21:41.1 and 21:41.9 both print 21:41. */
  assert.equal(fmtRaceTime(1301.1), "21:41");
  assert.equal(fmtRaceTime(1301.9), "21:41");
  assert.equal(fmtRaceTime(1301), "21:41");
  assert.equal(fmtRaceTime(1072.0), "17:52");
  assert.equal(fmtRaceTime(3599.9), "59:59");
  assert.equal(fmtRaceTime(3661.5), "1:01:01", "an hour wears its hour");
  /* A float a hair under the second still prints the second it is. */
  assert.equal(fmtRaceTime(1302 - 1e-9), "21:42");

  /* The split: 21:41.1 over 5,000 m is 2:10.11 per 500 — prints 2:10. */
  assert.equal(fmtSplitFor(5000, 1301.1), "2:10");
  assert.equal(fmtSplitFor(5000, 1072), "1:47");

  /* The gap, signed and floored. */
  assert.equal(fmtGap(26.1), "+0:26");
  assert.equal(fmtGap(-127.9), "-2:07");

  /* The seed: asterisk for prorated, never the word; null for none. */
  assert.equal(fmtSeed({ seconds: 1296.5, prorated: true }), "21:36*");
  assert.equal(fmtSeed({ seconds: 1099, prorated: false }), "18:19");
  assert.equal(fmtSeed(null), null);

  /* THE TAGS. No baseline: FIRST 5K. Prorated baseline: PR when faster
   * than the prorated time. Rowed baseline: PR when faster. Equal is not
   * a PR. Measured on the tenths, not the floor. */
  const first = racer("first", 1184.0, null);
  const proPr = racer("proPr", 1116.3, { seconds: 1296.5, prorated: true });
  const proNo = racer("proNo", 1377.0, { seconds: 1101, prorated: true });
  const realPr = racer("realPr", 1072.0, { seconds: 1099, prorated: false });
  const realNo = racer("realNo", 1334.8, { seconds: 1205, prorated: false });
  const equal = racer("equal", 1301.0, { seconds: 1301.0, prorated: false });
  const tenth = racer("tenth", 1366.2, { seconds: 1366.8, prorated: false });
  assert.equal(raceTag(first), "FIRST 5K");
  assert.ok(isFirst5k(first) && !isPr(first));
  assert.equal(raceTag(proPr), "PR");
  assert.equal(raceTag(proNo), null);
  assert.equal(raceTag(realPr), "PR");
  assert.equal(raceTag(realNo), null);
  assert.equal(raceTag(equal), null, "equal to the seed is not a PR");
  assert.equal(raceTag(tenth), "PR", "six tenths faster is a PR even though both floor to 22:46");

  /* TIES AFTER THE FLOOR keep the tenths order: 22:46.2 before 22:46.8. */
  const b = boardOf([racer("slow", 1366.8, null, 1, 1), racer("fast", 1366.2, null, 1, 2)]);
  assert.deepEqual(ranked(b.racers).map((r) => r.id), ["fast", "slow"]);
  assert.equal(fmtRaceTime(1366.8), fmtRaceTime(1366.2), "and they print the same");

  /* THE PODIUM: three steps, the gaps, no fourth. */
  const four = boardOf([
    racer("a", 1301.1, null, 1, 1),
    racer("b", 1331.7, null, 1, 2),
    racer("c", 1334.8, null, 1, 3),
    racer("d", 1338.6, null, 1, 4),
  ]);
  const p = podium(bracketView(four, "F"));
  assert.equal(p.steps.length, 3);
  assert.deepEqual(p.steps.map((s) => s.place), [1, 2, 3]);
  assert.equal(fmtGap(p.wonBy ?? 0), "+0:30");
  assert.equal(fmtGap(p.steps[2].gap), "+0:33");
  assert.ok(!("fourth" in p), "no fourth line");

  console.log("race time: every case holds");
  process.exit(0);
}

void main();
