/* The LLM export by the month, checked by hand: npx tsx src/app/row100k/llmExport.test.ts
 * (no test runner in the repo; plain asserts, exit 1 on the first miss).
 * THE MONTHS, 2026-09-28: one month per file — buildRowerExport takes the
 * month, so an October file has 31 days, five weeks and an October guide,
 * a month that is over reads as all elapsed, and September is as it was. */
import assert from "node:assert/strict";
import { computeBoards, pacificDay } from "@/lib/row100k";
import { monthFromKey, type Month } from "@/lib/rowPeriod";
import { buildRowerExport, fieldStats, type ExportEntry, type ExportParticipant } from "./llmExport";

const SEP = monthFromKey("2026-09") as Month;
const OCT = monthFromKey("2026-10") as Month;
/* Noon Pacific on the day given, on the challenge's fixed UTC-7 clock. */
const noon = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d, 19, 0, 0);

let seq = 0;
const row = (participantId: string, day: string, meters: number, seconds: number): ExportEntry => ({
  id: `e${++seq}`,
  participantId,
  day,
  meters,
  seconds,
  title: "",
  note: "",
  photos: [],
  createdAt: new Date(noon(Number(day.slice(0, 4)), Number(day.slice(5, 7)), Number(day.slice(8, 10)))),
});
const rower = (n: number): ExportParticipant => ({
  id: `p${n}`,
  rowerNumber: n,
  displayName: `Rower ${n}`,
  instagram: "",
  division: "M",
  createdAt: new Date(noon(2026, 9, 1)),
});
const rowers = [rower(1), rower(2)];

/* ---------------------------------------------------------- October 16 */
const octRows = [
  row("p1", "2026-10-01", 5000, 1250),
  row("p1", "2026-10-03", 6000, 1500),
  row("p1", "2026-10-16", 8000, 2000),
  row("p2", "2026-10-02", 4000, 1000),
];
const mine = octRows.filter((e) => e.participantId === "p1");
const now = noon(2026, 10, 16);
const boards = computeBoards(rowers, octRows, pacificDay(now));
const field = fieldStats(boards);
const x = buildRowerExport({ participant: rowers[0], entries: mine, boards, field, race: null, now, month: OCT });

assert.equal(x.challenge.name, "Rowtember — October 2026");
assert.equal(x.challenge.firstDay, "2026-10-01");
assert.equal(x.challenge.lastDay, "2026-10-31");
assert.equal(x.challenge.today, "2026-10-16");
assert.equal(x.challenge.dayOfChallenge, 16);
assert.equal(x.challenge.daysLeft, 15);
assert.equal(x.challenge.lateLogsThrough, "2026-11-03");

assert.equal(x.byDay.length, 31);
assert.equal(x.byDay[0].day, "2026-10-01");
assert.equal(x.byDay[30].day, "2026-10-31");
assert.equal(x.byDay[0].status, "rowed");
assert.equal(x.byDay[1].status, "rest");
assert.equal(x.byDay[15].status, "rowed");
assert.equal(x.byDay[16].status, "future");
assert.equal(x.byDay[30].weekday, "Saturday");

assert.deepEqual(
  x.byWeek.map((w) => w.week),
  ["Week 1", "Week 2", "Week 3", "Week 4", "The finish"],
);
assert.deepEqual(
  x.byWeek.map((w) => [w.from, w.to]),
  [
    ["2026-10-01", "2026-10-07"],
    ["2026-10-08", "2026-10-14"],
    ["2026-10-15", "2026-10-21"],
    ["2026-10-22", "2026-10-28"],
    ["2026-10-29", "2026-10-31"],
  ],
);
assert.equal(x.byWeek[4].daysInWeek, 3, "October's finish is three days");
assert.equal(x.byWeek[2].daysElapsedInWeek, 2, "the 15th and the 16th");
assert.equal(x.byWeek[0].complete, true);
assert.equal(x.byWeek[2].complete, false);
assert.equal(x.byWeek[0].meters, 11000);

assert.equal(x.totals.meters, 19000);
assert.equal(x.totals.daysRowed, 3);
assert.equal(x.totals.daysRested, 13, "the thirteen ended days with nothing logged");
assert.equal(x.totals.metersPerCalendarDay, Math.round(19000 / 16));
/* 19,000 so far, 8,000 of it in the last seven days: recent = 8000/7,
 * month = 19000/16, rate = 0.6·recent + 0.4·month = 1160.714…, run out
 * over the fifteen days October has left. */
assert.equal(x.trends.projectedFinalMeters, 36411);

assert.ok(x.guide.includes("between Oct 1 and Oct 31, 2026"), x.guide);
assert.ok(x.guide.includes("This file covers October 2026."), x.guide);
assert.ok(x.guide.includes("`byDay` has all 31 days of October 2026."), x.guide);
assert.ok(x.guide.includes("Late logging of October 2026 rows is allowed through Nov 3"), x.guide);
assert.ok(x.guide.includes("`byWeek` cuts October 2026 into calendar weeks"), x.guide);
assert.ok(x.suggestedPrompt.includes("one rower's October 2026 on the erg"), x.suggestedPrompt);
assert.equal(x.units.dayOfChallenge, "1 on Oct 1 ... 31 on Oct 31; today's number");
assert.equal(x.units.daysLeft, "challenge days after today (31 minus dayOfChallenge)");

/* ------------------------------------------------ October, from November */
const done = buildRowerExport({ participant: rowers[0], entries: mine, boards, field, race: null, now: noon(2026, 11, 5), month: OCT });
assert.equal(done.challenge.dayOfChallenge, 31);
assert.equal(done.challenge.daysLeft, 0);
assert.equal(done.challenge.today, "2026-11-05");
assert.ok(done.byDay.every((d) => d.status === "rowed" || d.status === "rest"), "nothing future or today once the month is over");
assert.equal(done.totals.daysRested, 28);
assert.ok(done.byWeek.every((w) => w.complete));
assert.equal(done.byWeek[4].daysElapsedInWeek, 3);
assert.equal(done.trends.projectedFinalMeters, 19000, "no days left: the projection is the total");

/* ------------------------------------------------- September, as it was */
const sepRows = [row("p1", "2026-09-01", 5000, 1250), row("p1", "2026-09-16", 8000, 2000)];
const sepBoards = computeBoards(rowers, sepRows, "2026-09-16");
const s = buildRowerExport({
  participant: rowers[0],
  entries: sepRows,
  boards: sepBoards,
  field: fieldStats(sepBoards),
  race: null,
  now: noon(2026, 9, 16),
  month: SEP,
});
assert.equal(s.challenge.name, "Rowtember — September 2026");
assert.equal(s.challenge.daysLeft, 14);
assert.equal(s.challenge.lateLogsThrough, "2026-10-03");
assert.equal(s.byDay.length, 30);
assert.deepEqual(
  s.byWeek.map((w) => w.week),
  ["Week 1", "Week 2", "Week 3", "Week 4", "The finish"],
);
assert.equal(s.byWeek[4].daysInWeek, 2, "September's finish is the two days");
assert.equal(s.byWeek[4].from, "2026-09-29");
assert.ok(s.guide.includes("This file covers September 2026."), s.guide);
assert.equal(s.units.dayOfChallenge, "1 on Sep 1 ... 30 on Sep 30; today's number");

/* An October row handed to a September build is not a day of it. */
const stray = buildRowerExport({
  participant: rowers[0],
  entries: [...sepRows, row("p1", "2026-10-02", 9000, 2200)],
  boards: sepBoards,
  field: fieldStats(sepBoards),
  race: null,
  now: noon(2026, 9, 16),
  month: SEP,
});
assert.equal(stray.byDay.reduce((n, d) => n + d.sessions, 0), 2, "byDay holds September's two rows only");
assert.equal(stray.byWeek.reduce((n, w) => n + w.sessions, 0), 2);

console.log("llmExport.test: ok");
