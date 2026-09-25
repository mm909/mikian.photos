/* The daily-active fold, checked by hand: npx tsx src/app/row100k/analysis/active.test.ts
 * (no test runner in the repo; plain asserts, exit 1 on the first miss).
 * The owner's ask from 2026-09-25: distinct rowers a day, every day since
 * the start, with a seven-day mean — a rower counts once a day however
 * many rows they log, and a quiet day is a zero, not a gap. */
import assert from "node:assert/strict";
import { buildActive, dayLabel } from "./active";
import type { RawEntry } from "./data";

/* Noon Pacific on the day given, on the challenge's fixed UTC-7 clock. */
const noon = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d, 19, 0, 0);
let seq = 0;
const row = (participantId: string, day: string, meters = 5000): RawEntry => ({
  id: `e${++seq}`,
  participantId,
  day,
  meters,
  seconds: 1200,
  createdAtMs: 0,
});

assert.equal(dayLabel("2026-09-12"), "Sep 12");
assert.equal(dayLabel("2026-12-01"), "Dec 1");
assert.equal(dayLabel("nope"), "nope");

/* Empty: every day since Sep 1 is there, all zeros, nothing NaN. */
const empty = buildActive([], noon(2026, 9, 25));
assert.equal(empty.days.length, 25, "Sep 1 through Sep 25");
assert.equal(empty.days[0].key, "2026-09-01");
assert.equal(empty.days[24].key, "2026-09-25");
assert.equal(empty.since, "Sep 1");
assert.equal(empty.yMax, 0, "nothing to draw");
assert.equal(empty.today, 0);
assert.equal(empty.avg7Now, 0);
assert.equal(empty.avg30Now, 0);
assert.equal(empty.peak, null);
assert.equal(empty.avg7.length, 25);
for (const v of [empty.today, empty.avg7Now, empty.avg30Now, ...empty.avg7]) assert.equal(Number.isFinite(v), true, "no NaN on empty input");

/* Three rowers, a few days. A rower with two rows on the 12th is one
 * rower that day; the 13th has nobody. */
const entries: RawEntry[] = [
  row("a", "2026-09-01"),
  row("b", "2026-09-01"),
  row("a", "2026-09-12"),
  row("a", "2026-09-12", 2000),
  row("b", "2026-09-12"),
  row("c", "2026-09-12"),
  row("c", "2026-09-14"),
  row("a", "2026-09-25"),
  row("b", "2026-09-25"),
  /* A row ahead of the clock, and one before the first month: dropped. */
  row("a", "2026-09-26"),
  row("a", "2026-08-31"),
];
const m = buildActive(entries, noon(2026, 9, 25));
const at = (key: string) => m.days.find((d) => d.key === key);
assert.equal(m.days.length, 25);
assert.equal(at("2026-09-01")?.active, 2);
assert.equal(at("2026-09-01")?.sessions, 2);
assert.equal(at("2026-09-12")?.active, 3, "two rows from one rower count once");
assert.equal(at("2026-09-12")?.sessions, 4, "but both are sessions");
assert.equal(at("2026-09-13")?.active, 0, "a quiet day is a zero, not a gap");
assert.equal(at("2026-09-13")?.sessions, 0);
assert.equal(at("2026-09-14")?.active, 1);
assert.equal(at("2026-09-14")?.label, "Sep 14");
assert.equal(m.today, 2);
assert.deepEqual(m.peak, { key: "2026-09-12", label: "Sep 12", active: 3 });
assert.equal(m.yMax, 10, "counts under ten get a top of ten");

/* The trailing seven-day mean: the first six days average what there is. */
assert.equal(m.avg7.length, 25);
assert.equal(m.avg7[0], 2, "day 1 alone");
assert.equal(Math.round(m.avg7[1] * 1000) / 1000, 1, "days 1–2: (2 + 0) / 2");
assert.equal(Math.round(m.avg7[11] * 1000) / 1000, Math.round((3 / 7) * 1000) / 1000, "Sep 6–12: only the 12th");
assert.equal(Math.round(m.avg7[13] * 1000) / 1000, Math.round((4 / 7) * 1000) / 1000, "Sep 8–14: the 12th and the 14th");
assert.equal(Math.round(m.avg7Now * 1000) / 1000, Math.round((2 / 7) * 1000) / 1000, "Sep 19–25: today only");
assert.equal(Math.round(m.avg30Now * 1000) / 1000, Math.round((8 / 25) * 1000) / 1000, "30-day mean over the 25 days there are");

/* Ties go to the first day. */
const tie = buildActive([row("a", "2026-09-03"), row("a", "2026-09-05")], noon(2026, 9, 10));
assert.equal(tie.peak?.key, "2026-09-03");

/* The axis top follows the months idea: 12 rowers read on a top of 20,
 * 57 on 80. */
const twelve = Array.from({ length: 12 }, (_, i) => row(`r${i}`, "2026-09-02"));
assert.equal(buildActive(twelve, noon(2026, 9, 10)).yMax, 20);
const many = Array.from({ length: 57 }, (_, i) => row(`r${i}`, "2026-09-02"));
assert.equal(buildActive(many, noon(2026, 9, 10)).yMax, 80);

/* December: the run spans September through today with no month gap. */
const dec = buildActive([row("a", "2026-11-30"), row("b", "2026-12-15")], noon(2026, 12, 15));
assert.equal(dec.days.length, 30 + 31 + 30 + 15, "Sep, Oct, Nov and half of Dec");
assert.equal(dec.days[30].key, "2026-10-01");
assert.equal(dec.days[dec.days.length - 1].key, "2026-12-15");
assert.equal(dec.since, "Sep 1");
assert.equal(dec.today, 1);
assert.equal(dec.peak?.key, "2026-11-30");
assert.equal(Math.round(dec.avg30Now * 1000) / 1000, Math.round((2 / 30) * 1000) / 1000, "the 30-day window reaches back into November");

/* Day 1 itself: one day, one bar. */
const first = buildActive([row("a", "2026-09-01")], noon(2026, 9, 1));
assert.equal(first.days.length, 1);
assert.equal(first.today, 1);
assert.equal(first.avg7Now, 1);
assert.equal(first.avg30Now, 1);

console.log("active: every case holds");
