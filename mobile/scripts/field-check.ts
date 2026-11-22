/* A row measured, and rows as a field (src/pm5/craft.ts), checked with no
 * phone and no server: `npx tsx scripts/field-check.ts` in mobile/. */
import { createLive } from "../src/erg/model";
import { analyseSession } from "../src/pm5/analysis";
import { FIELD_KEYS, SHAPE_STEPS, fieldOf, measureOf, medianOf, placeOf, quantile, type RowMeasure } from "../src/pm5/craft";
import { createPm5Sim } from "../src/pm5/simulate";

let failed = 0;
const ok = (what: string, pass: boolean, got?: unknown) => {
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${what}${pass ? "" : ` (got ${JSON.stringify(got)})`}`);
};

function row(distanceM: number, seed: number): RowMeasure {
  const model = createLive();
  const sim = createPm5Sim({ distanceM, seed });
  while (!sim.done) for (const p of sim.step(1000)) model.feed(p);
  const doc = model.toDoc("Check erg", true);
  return measureOf(analyseSession({ doc, id: `r${seed}`, history: [], compare: null }), doc);
}

const a = row(2000, 11);
console.log("one 2,000 m:", JSON.stringify({ ...a, pacing: a.pacing?.map((v) => Math.round(v * 10) / 10) }));
ok("every figure of a whole recording is there", FIELD_KEYS.every((k) => typeof a[k] === "number"), a);
ok("the scores are out of 100", a.steady! >= 0 && a.steady! <= 100 && a.same! >= 0 && a.same! <= 100, [a.steady, a.same]);
ok("the pacing is read at every place", a.pacing?.length === SHAPE_STEPS, a.pacing?.length);
ok("the pacing is about its own average", Math.abs(a.pacing!.reduce((s, v) => s + v, 0) / SHAPE_STEPS) < 1.5, a.pacing);
ok("rate times length is the speed of the split", Math.abs(a.rate! * a.length! - (500 / a.pace!) * 60) < 12, [a.rate! * a.length!, (500 / a.pace!) * 60]);
ok("the peak is a place along the drive", a.peak! > 0 && a.peak! < 100, a.peak);

/* Four rowers: one with three rows, three with one. */
const rowers = [[row(2000, 1), row(2000, 2), row(5000, 3)], [row(2000, 4)], [row(5000, 5)], [row(2000, 6)]];
const f = fieldOf(rowers)!;
ok("a rower with three rows counts once", f.rowers === 4 && f.rows === 6 && f.steady.length === 4, [f.rowers, f.rows, f.steady.length]);
ok("every list is smallest first", FIELD_KEYS.every((k) => f[k].every((v, i) => i === 0 || v >= f[k][i - 1])));
ok("a pair a rower", f.pairs.length === 4, f.pairs);
ok("the field has a pacing of its own", f.pacing?.length === SHAPE_STEPS);
const three = rowers[0].map((m) => m.spread!);
ok("their figure is the average of their rows", f.spread.some((v) => Math.abs(v - (three[0] + three[1] + three[2]) / 3) < 0.01), [f.spread, three]);

/* A rower whose recording says nothing is in no list. */
const mute: RowMeasure = { steady: null, same: null, spread: null, rateSd: null, rate: null, length: null, work: null, fade: null, halves: null, peak: null, pace: null, pacing: null };
const g = fieldOf([...rowers, [mute]])!;
ok("a recording with nothing to say is in no list and no count", g.steady.length === 4 && g.pairs.length === 4 && g.rowers === 4 && g.rows === 6, [g.steady.length, g.pairs.length, g.rowers, g.rows]);
console.log("the field:", JSON.stringify({ ...f, pacing: f.pacing?.map((v) => Math.round(v * 10) / 10) }));
ok("nobody is no field", fieldOf([]) === null && fieldOf([[]]) === null);

ok("the middle of an odd list is its middle", medianOf([1, 2, 9]) === 2);
ok("the middle of an even list is between", medianOf([1, 2, 4, 9]) === 3);
ok("a quarter of the way", quantile([0, 10, 20, 30, 40], 0.25) === 10);
const p = placeOf([1, 2, 3, 4, 5], 3.02, 0.05);
ok("level with one, two under and two over", p.under === 2 && p.over === 2 && p.n === 5, p);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
