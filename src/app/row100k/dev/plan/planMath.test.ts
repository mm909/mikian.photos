/* The plan arithmetic, checked by hand: npx tsx src/app/row100k/dev/plan/planMath.test.ts
 * (no test runner in the repo; plain asserts, exit 1 on the first miss).
 * The cases are the owner's own examples from 2026-09-24. */
import assert from "node:assert/strict";
import {
  autoDays,
  autoDistribute,
  evenSplit,
  fmtK,
  freshPlan,
  needOf,
  parseMetersText,
  parseSplit,
  plannedSum,
  projectedAvg,
  releaseDay,
  remainingDays,
  requiredSplit,
  revivePlan,
  runningAverage,
  setDay,
  setTarget,
  toggleOff,
  unallocated,
} from "./planMath";

const ctx = { monthKey: "2026-12", monthDays: 31, today: 22, rowed: 0 };
const rem = remainingDays(ctx.monthKey, ctx.monthDays, ctx.today);

/* "10 days left → the split across those 10 days" */
assert.equal(rem.length, 10, "Dec 22 leaves ten days, today included");
assert.equal(rem[0], "2026-12-22");
assert.equal(rem[9], "2026-12-31");
assert.deepEqual(remainingDays("2026-12", 31, 31), ["2026-12-31"]);
assert.deepEqual(remainingDays("2026-12", 31, 0), remainingDays("2026-12", 31, 1), "a day before the 1st plans the whole month");

assert.deepEqual(evenSplit(100_000, 10), Array(10).fill(10_000));
assert.deepEqual(evenSplit(10, 3), [4, 3, 3]);
assert.deepEqual(evenSplit(0, 3), [0, 0, 0]);
assert.deepEqual(evenSplit(5, 0), []);
assert.equal(evenSplit(100_001, 7).reduce((a, b) => a + b, 0), 100_001, "the parts add back up");

assert.equal(needOf(100_000, 37_500), 62_500);
assert.equal(needOf(100_000, 120_000), 0, "never negative");

/* A fresh plan: 100K over ten days is 10K a day, nothing pinned or off. */
let plan = freshPlan({ ...ctx, target: 100_000 });
assert.equal(plan.target, 100_000);
assert.equal(plan.pace, "", "the pace is not prefilled");
assert.equal(plannedSum(plan, rem), 100_000);
assert.equal(unallocated(plan, rem, 100_000), 0);
for (const d of rem) assert.deepEqual(plan.days[d], { m: 10_000, pinned: false, off: false });

/* "Let me set a day to 5K instead of 10K — but do NOT redistribute the
 * removed meters automatically: note that 5K is unallocated." */
plan = setDay(plan, "2026-12-25", 5_000);
assert.equal(plan.days["2026-12-25"].m, 5_000);
assert.equal(plan.days["2026-12-25"].pinned, true);
assert.equal(plan.days["2026-12-24"].m, 10_000, "the neighbours did not move");
assert.equal(unallocated(plan, rem, 100_000), 5_000);
assert.equal(autoDays(plan, rem).length, 9, "nine days are still auto");

/* "Let me click a day to turn it off (no meters there)." */
plan = toggleOff(plan, "2026-12-26");
assert.equal(plan.days["2026-12-26"].off, true);
assert.equal(plan.days["2026-12-26"].m, 10_000, "an off day keeps its number for when it comes back");
assert.equal(plannedSum(plan, rem), 85_000);
assert.equal(unallocated(plan, rem, 100_000), 15_000);
assert.equal(autoDays(plan, rem).length, 8);

/* AUTO DISTRIBUTE spreads the 15K over the eight open auto days: the
 * pinned 5K holds, the off day stays off. */
plan = autoDistribute(plan, rem, 100_000);
assert.equal(plan.days["2026-12-25"].m, 5_000, "the day set by hand holds");
assert.equal(plan.days["2026-12-26"].off, true);
assert.equal(unallocated(plan, rem, 100_000), 0, "every meter has a day");
const autoValues = autoDays(plan, rem).map((d) => plan.days[d].m);
assert.equal(Math.max(...autoValues) - Math.min(...autoValues) <= 1, true, "even to the meter");
assert.equal(autoValues.reduce((a, b) => a + b, 0), 95_000);

/* Overplanned: a day bumped to 30K shows a surplus; auto brings the auto
 * days down, never the set ones. */
plan = setDay(plan, "2026-12-31", 30_000);
assert.equal(unallocated(plan, rem, 100_000) < 0, true, "over the target");
plan = autoDistribute(plan, rem, 100_000);
assert.equal(unallocated(plan, rem, 100_000), 0);
assert.equal(plan.days["2026-12-31"].m, 30_000);

/* Turn the off day back on: its 10K returns, and is now over. */
plan = toggleOff(plan, "2026-12-26");
assert.equal(plan.days["2026-12-26"].off, false);
assert.equal(unallocated(plan, rem, 100_000), -10_000);

/* Release a pinned day and it is auto again, keeping its number until
 * the next distribute. */
plan = releaseDay(plan, "2026-12-31");
assert.equal(plan.days["2026-12-31"].pinned, false);
assert.equal(plan.days["2026-12-31"].m, 30_000);

/* Every open day pinned: nowhere to distribute, the plan is untouched. */
let pinnedAll = freshPlan({ ...ctx, target: 100_000 });
for (const d of rem) pinnedAll = setDay(pinnedAll, d, 5_000);
assert.equal(unallocated(pinnedAll, rem, 100_000), 50_000);
assert.deepEqual(autoDistribute(pinnedAll, rem, 100_000), pinnedAll);

/* "If they change it to 500K, keep 500K": the target moves, the auto
 * days follow, the set days hold. */
let big = freshPlan({ ...ctx, target: 100_000 });
big = setDay(big, "2026-12-25", 5_000);
big = setTarget(big, 500_000, rem, 0);
assert.equal(big.target, 500_000);
assert.equal(big.days["2026-12-25"].m, 5_000);
assert.equal(unallocated(big, rem, 500_000), 0);
assert.equal(big.days["2026-12-22"].m, 55_000);

/* The need counts what was rowed: 37,500 m in gives 62,500 to place. */
const partway = freshPlan({ ...ctx, rowed: 37_500, target: 100_000 });
assert.equal(plannedSum(partway, rem), 62_500);

/* Remembered: a round trip through JSON gives the same plan back. */
const saved = JSON.stringify(big);
const back = revivePlan(saved, ctx);
assert.deepEqual(back, big);
/* Another month's plan is not this month's, but the target and pace are. */
const other = revivePlan(JSON.stringify({ ...big, pace: "1:59.9", monthKey: "2026-11" }), ctx);
assert.equal(other.monthKey, "2026-12");
assert.equal(other.target, 500_000);
assert.equal(other.pace, "1:59.9");
assert.equal(unallocated(other, rem, 500_000), 0, "a fresh even split for the new month");
/* Garbage is a fresh plan at 100K. */
assert.equal(revivePlan("{not json", ctx).target, 100_000);
assert.equal(revivePlan(null, ctx).target, 100_000);
assert.equal(revivePlan(JSON.stringify({ target: -5 }), ctx).target, 100_000);
/* A day passes: yesterday drops out, the kept days keep their numbers. */
const tomorrow = revivePlan(saved, { ...ctx, today: 23 });
assert.equal(Object.keys(tomorrow.days).length, 9);
assert.equal(tomorrow.days["2026-12-25"].m, 5_000);
assert.equal(tomorrow.days["2026-12-22"], undefined);

/* What a rower types. */
assert.equal(parseMetersText("5000"), 5_000);
assert.equal(parseMetersText("5,000"), 5_000);
assert.equal(parseMetersText("5k"), 5_000);
assert.equal(parseMetersText("7.5K"), 7_500);
assert.equal(parseMetersText(""), null);
assert.equal(parseMetersText("ten"), null);
assert.equal(parseMetersText("-5"), null);

/* The pace. */
assert.equal(parseSplit("1:59.9"), 119.9);
assert.equal(parseSplit("2:05"), 125);
assert.equal(parseSplit(""), null);
assert.equal(parseSplit("fast"), null);
/* 100K at 2:00 with 50K rowed at 2:10: the rest has to be 1:50. */
assert.equal(Math.round(requiredSplit(100_000, 120, 50_000, 100 * 130) * 10) / 10, 110);
/* 50K rowed at 1:40 leaves room: the rest can be 2:20. */
assert.equal(Math.round(requiredSplit(100_000, 120, 50_000, 100 * 100)), 140);
/* 50K rowed at 4:10 already spends more time than the goal allows: zero or less. */
assert.equal(requiredSplit(100_000, 120, 50_000, 100 * 250) <= 0, true);
assert.equal(requiredSplit(100_000, 120, 100_000, 1) , 0, "nothing left to row");
/* The projection lands on the goal at the target. */
const req = requiredSplit(100_000, 120, 50_000, 100 * 130);
assert.equal(Math.round(projectedAvg(50_000, 100 * 130, req, 100_000) * 10) / 10, 120);
assert.equal(Math.round(projectedAvg(50_000, 100 * 130, req, 50_000) * 10) / 10, 130, "and starts where the average is");

const avg = runningAverage([
  { day: "2026-12-01", meters: 5000, seconds: 1200 },
  { day: "2026-12-02", meters: 5000, seconds: 1300 },
  { day: "2026-12-03", meters: 5000, seconds: 0 },
]);
assert.equal(avg.length, 2, "an untimed row is skipped");
assert.equal(avg[0].s, 120);
assert.equal(avg[1].s, 125);

assert.equal(fmtK(10_000), "10k");
assert.equal(fmtK(3_334), "3.3k");
assert.equal(fmtK(800), "800");

console.log("planMath: every case holds");
