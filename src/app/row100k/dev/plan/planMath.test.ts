/* The plan arithmetic, checked by hand: npx tsx src/app/row100k/dev/plan/planMath.test.ts
 * (no test runner in the repo; plain asserts, exit 1 on the first miss).
 * The cases are the owner's own words from 2026-09-25: days are on or
 * off, the remaining meters redistribute across the on days by
 * themselves. */
import assert from "node:assert/strict";
import {
  DEFAULT_TARGET,
  PLAN_VERSION,
  evenSplit,
  fmtK,
  freshPlan,
  isOff,
  needOf,
  onDays,
  parseMetersText,
  parseSplit,
  planned,
  projectedAvg,
  remainingDays,
  requiredSplit,
  revivePlan,
  runningAverage,
  setPace,
  setTarget,
  toggleOff,
} from "./planMath";

const ctx = { monthKey: "2026-12", monthDays: 31, today: 22 };
const rem = remainingDays(ctx.monthKey, ctx.monthDays, ctx.today);
const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);

/* Ten days left, today included. */
assert.equal(rem.length, 10, "Dec 22 leaves ten days, today included");
assert.equal(rem[0], "2026-12-22");
assert.equal(rem[9], "2026-12-31");
assert.deepEqual(remainingDays("2026-12", 31, 31), ["2026-12-31"]);
assert.deepEqual(remainingDays("2026-12", 31, 0), remainingDays("2026-12", 31, 1), "a day before the 1st plans the whole month");
assert.deepEqual(remainingDays("2026-12", 31, 40), ["2026-12-31"], "past the month there is only the last day");

assert.deepEqual(evenSplit(100_000, 10), Array(10).fill(10_000));
assert.deepEqual(evenSplit(10, 3), [4, 3, 3]);
assert.deepEqual(evenSplit(0, 3), [0, 0, 0]);
assert.deepEqual(evenSplit(5, 0), []);
assert.equal(evenSplit(100_001, 7).reduce((a, b) => a + b, 0), 100_001, "the parts add back up");

assert.equal(needOf(100_000, 37_500), 62_500);
assert.equal(needOf(100_000, 120_000), 0, "never negative");

/* A fresh plan: every day on, the pace following the average. */
let plan = freshPlan({ monthKey: "2026-12" });
assert.equal(plan.v, PLAN_VERSION);
assert.equal(plan.target, DEFAULT_TARGET);
assert.equal(plan.pace, null, "untouched: the field shows the current average");
assert.deepEqual(plan.off, []);
assert.equal(onDays(plan, rem).length, 10);
let days = planned(plan, rem, 100_000);
assert.equal(sum(days), 100_000);
for (const d of rem) assert.equal(days[d], 10_000, "100K over ten days is 10K a day");

/* "Clicking a day turns it off … and the remaining meters are
 * redistributed automatically across the on days." */
plan = toggleOff(plan, "2026-12-25");
assert.equal(isOff(plan, "2026-12-25"), true);
assert.equal(onDays(plan, rem).length, 9);
days = planned(plan, rem, 100_000);
assert.equal(days["2026-12-25"], undefined, "an off day holds nothing");
assert.equal(sum(days), 100_000, "every meter still has a day");
const values = onDays(plan, rem).map((d) => days[d]);
assert.equal(Math.max(...values) - Math.min(...values) <= 1, true, "even to the meter");
assert.equal(days["2026-12-22"], 11_112);
assert.equal(days["2026-12-31"], 11_111);

/* "Clicking again turns it on." */
plan = toggleOff(plan, "2026-12-25");
assert.equal(isOff(plan, "2026-12-25"), false);
assert.equal(planned(plan, rem, 100_000)["2026-12-25"], 10_000);

/* Two off days; the order they were clicked does not matter. */
plan = toggleOff(toggleOff(plan, "2026-12-30"), "2026-12-23");
assert.deepEqual(plan.off, ["2026-12-23", "2026-12-30"]);
assert.equal(sum(planned(plan, rem, 100_000)), 100_000);
/* A day outside the month is not a day of this plan. */
assert.deepEqual(toggleOff(plan, "2026-11-30").off, plan.off);

/* Every day off: nothing planned, nothing lost — the tool says so. */
let allOff = freshPlan({ monthKey: "2026-12" });
for (const d of rem) allOff = toggleOff(allOff, d);
assert.deepEqual(planned(allOff, rem, 100_000), {});
assert.equal(onDays(allOff, rem).length, 0);

/* The need counts what was rowed: 37,500 m in gives 62,500 to place, and
 * what was rowed since shows up in the split without anyone doing
 * anything. */
assert.equal(sum(planned(plan, rem, needOf(100_000, 37_500))), 62_500);
assert.equal(planned(plan, rem, needOf(100_000, 100_000))["2026-12-22"], 0, "target reached: zero a day");

/* "If they change it to 500K, keep 500K." */
plan = setTarget(plan, 500_000);
assert.equal(plan.target, 500_000);
assert.equal(sum(planned(plan, rem, 500_000)), 500_000);
assert.equal(planned(plan, rem, 500_000)["2026-12-22"], 62_500, "500K over the eight on days");
assert.equal(setTarget(plan, 0).target, DEFAULT_TARGET, "no target is the default");
plan = setPace(plan, "1:59.9");
assert.equal(plan.pace, "1:59.9");
assert.equal(setPace(plan, "").pace, "", "cleared is cleared, not untouched");

/* Remembered: a round trip through JSON gives the same plan back. */
const saved = JSON.stringify(plan);
assert.deepEqual(revivePlan(saved, ctx), plan);
/* Another month's plan is not this month's, but the target and pace are. */
const other = revivePlan(JSON.stringify({ ...plan, monthKey: "2026-11" }), ctx);
assert.equal(other.monthKey, "2026-12");
assert.equal(other.target, 500_000);
assert.equal(other.pace, "1:59.9");
assert.deepEqual(other.off, [], "every day of the new month is on");
/* Garbage is a fresh plan at 100K. */
assert.equal(revivePlan("{not json", ctx).target, DEFAULT_TARGET);
assert.equal(revivePlan(null, ctx).target, DEFAULT_TARGET);
assert.equal(revivePlan(JSON.stringify({ target: -5 }), ctx).target, DEFAULT_TARGET);
assert.deepEqual(revivePlan(JSON.stringify({ monthKey: "2026-12", off: [3, null, "2026-12-30"] }), ctx).off, ["2026-12-30"], "only days are off days");
/* A day passes: an off day that is behind us is forgotten. */
const later = revivePlan(saved, { ...ctx, today: 24 });
assert.deepEqual(later.off, ["2026-12-30"]);
/* A v1 plan (a cell per day) keeps its off days, and its empty pace is
 * untouched rather than cleared. */
const v1 = JSON.stringify({
  v: 1,
  monthKey: "2026-12",
  target: 120_000,
  pace: "",
  days: { "2026-12-22": { m: 5000, pinned: true, off: false }, "2026-12-26": { m: 0, pinned: false, off: true } },
});
const fromV1 = revivePlan(v1, ctx);
assert.equal(fromV1.v, PLAN_VERSION);
assert.equal(fromV1.target, 120_000);
assert.equal(fromV1.pace, null);
assert.deepEqual(fromV1.off, ["2026-12-26"]);
/* A v2 plan with an empty pace was cleared on purpose. */
assert.equal(revivePlan(JSON.stringify({ ...plan, pace: "" }), ctx).pace, "");

/* What a rower types for the target. */
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
assert.equal(requiredSplit(100_000, 120, 100_000, 1), 0, "nothing left to row");
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
assert.equal(avg[1].s, 125, "the last point is the month average — the pace goal prefill");
/* A goal equal to the average asks for the average from here on. */
assert.equal(Math.round(requiredSplit(100_000, 125, 10_000, 2500) * 10) / 10, 125);

assert.equal(fmtK(10_000), "10k");
assert.equal(fmtK(3_334), "3.3k");
assert.equal(fmtK(800), "800");

console.log("planMath: every case holds");
