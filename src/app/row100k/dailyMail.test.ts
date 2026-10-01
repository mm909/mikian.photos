/* The daily summary, checked by hand: npx tsx src/app/row100k/dailyMail.test.ts
 * (no test runner in the repo; plain asserts, exit 1 on the first miss).
 * The owner's ask from 2026-09-30: one mail a morning with daily active
 * rowers, meters, who joined, who crossed a rung, the month so far and
 * the top three — every number off the same fold the boards use. */
import assert from "node:assert/strict";
import { TIERS } from "@/lib/row100k";
import type { RawEntry } from "./analysis/data";
import {
  dailyInput,
  dailySummaryMail,
  dayNoonMs,
  emptyDailyInput,
  fmtDayLong,
  fmtDayShort,
  fmtDelta,
  isDayKey,
  rungLabel,
  yesterdayKey,
  type DailyRows,
} from "./dailyMail";

/* Noon Pacific on the day given, on the challenge's fixed UTC-7 clock. */
/* The 10K rung's title wears the month the clock is in (TIERS, since the
 * October rollover), so the test reads it rather than spelling it. */
const T10 = TIERS.find((t) => t.meters === 10_000)!.title;

const noon = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d, 19, 0, 0);
let seq = 0;
const row = (participantId: string, day: string, meters = 5000): RawEntry => ({
  id: `e${++seq}`,
  participantId,
  day,
  meters,
  seconds: Math.round(meters / 4),
  createdAtMs: 0,
});
const person = (id: string, rowerNumber: number, displayName: string, joinedDay: string) => ({
  id,
  rowerNumber,
  displayName,
  createdAtMs: dayNoonMs(joinedDay),
});

/* ------------------------------------------------------------- the clock */
assert.equal(pacificKeyOf(noon(2026, 10, 1)), "2026-10-01");
assert.equal(yesterdayKey(noon(2026, 10, 2)), "2026-10-01");
/* 6:15 AM Pacific on Oct 2 = 13:15 UTC, the cron's minute: still Oct 1. */
assert.equal(yesterdayKey(Date.UTC(2026, 9, 2, 13, 15)), "2026-10-01");
/* The 1st: yesterday is last month's last day. */
assert.equal(yesterdayKey(Date.UTC(2026, 9, 1, 13, 15)), "2026-09-30");
assert.equal(isDayKey("2026-10-01"), true);
assert.equal(isDayKey("2026-02-30"), false, "not a real day");
assert.equal(isDayKey("2026-1-1"), false);
assert.equal(isDayKey(null), false);
assert.equal(fmtDayShort("2026-10-01"), "Thu Oct 1");
assert.equal(fmtDayLong("2026-10-01"), "Thursday, October 1");
assert.equal(fmtDayShort("2026-09-30"), "Wed Sep 30");
assert.equal(fmtDelta(26, 22), "+4");
assert.equal(fmtDelta(20, 22), "-2");
assert.equal(fmtDelta(22, 22), "±0");
assert.equal(rungLabel({ meters: 100_000, title: "The 100K Club" }), "100K · The 100K Club");
assert.equal(rungLabel({ meters: 250_000, title: ".25M" }), "250K · .25M");
assert.equal(rungLabel({ meters: 500_000, title: "Lights out" }), "500K · Lights out");

function pacificKeyOf(ms: number): string {
  return new Date(ms - 7 * 3_600_000).toISOString().slice(0, 10);
}

/* --------------------------------------------------------------- the fold */

/* Four rowers. a and b were there in September; c joined Oct 1, d joined
 * Oct 1 and never rowed; a stranger's row (no participant) is dropped. */
const rows: DailyRows = {
  participants: [
    person("a", 1, "Ann Lee", "2026-09-01"),
    person("b", 2, "Ben Ortiz", "2026-09-02"),
    person("c", 3, "Cal Reyes", "2026-10-01"),
    person("d", 4, "Dee Park", "2026-10-01"),
  ],
  entries: [
    /* September, so it is not October's month block. */
    row("a", "2026-09-30", 10_000),
    row("b", "2026-09-30", 10_000),
    /* Sep 25–30: a rows every day, so the 7-day mean has something in it. */
    ...["2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29"].map((d) => row("a", d, 2000)),
    /* Oct 1: a twice (one rower), b once, c once; b crosses 10K on the day. */
    row("a", "2026-10-01", 6_000),
    row("a", "2026-10-01", 4_000),
    row("b", "2026-10-01", 12_000),
    row("c", "2026-10-01", 3_000),
    row("zz", "2026-10-01", 99_000),
    /* Oct 2, ahead of the day: not in the mail. */
    row("a", "2026-10-02", 50_000),
  ],
};

const i = dailyInput(rows, "2026-10-01");
assert.equal(i.day, "2026-10-01");
assert.equal(i.active, 3, "a, b, c — a's two rows count once");
assert.equal(i.activeBefore, 2, "Sep 30: a and b");
/* Sep 25–Oct 1: a on all seven, b on the 30th and the 1st, c on the 1st:
 * 1,1,1,1,1,2,3 → 10/7. */
assert.equal(Math.round(i.avg7 * 1000) / 1000, Math.round((10 / 7) * 1000) / 1000);
assert.equal(i.meters, 25_000);
assert.equal(i.rows, 4);
assert.deepEqual(i.joined, [
  { name: "Cal Reyes", rowerNumber: 3 },
  { name: "Dee Park", rowerNumber: 4 },
]);
assert.equal(i.signedUp, 4);
assert.deepEqual(i.crossed, [{ meters: 10_000, title: T10, rowers: [{ name: "Ann Lee", rowerNumber: 1 }, { name: "Ben Ortiz", rowerNumber: 2 }] }], "a and b both reach 10K in October on the 1st (their September meters do not count)");
assert.equal(i.month.word, "October");
assert.equal(i.month.dayN, 1);
assert.equal(i.month.days, 31);
assert.equal(i.month.daysLeft, 30);
assert.equal(i.month.meters, 25_000);
assert.equal(i.month.rows, 4);
assert.equal(i.month.rowers, 3);
assert.equal(i.month.club, 0);
assert.deepEqual(
  i.top.map((t) => [t.participantId, t.meters, t.rows]),
  [
    ["b", 12_000, 1],
    ["a", 10_000, 2],
    ["c", 3_000, 1],
  ],
);
assert.equal(i.top[0].name, "Ben Ortiz");
assert.equal(i.top[0].censor, undefined);

/* Sep 30, re-run: a and b, the month is September, one day left is "last day". */
const sep = dailyInput(rows, "2026-09-30");
assert.equal(sep.active, 2);
assert.equal(sep.activeBefore, 1, "Sep 29: a alone");
assert.equal(sep.month.word, "September");
assert.equal(sep.month.daysLeft, 0);
assert.equal(sep.month.meters, 30_000, "Sep 25–30");
assert.equal(sep.month.rowers, 2);
assert.equal(sep.joined.length, 0);
assert.equal(sep.signedUp, 2, "c and d had not joined yet");
assert.deepEqual(sep.crossed, [{ meters: 10_000, title: T10, rowers: [{ name: "Ben Ortiz", rowerNumber: 2 }] }], "a sat at exactly 10,000 the day before, so only b crosses on the 30th");

/* The 100K club and the higher rungs, one huge day. */
const big = dailyInput(
  {
    participants: [person("a", 1, "Ann Lee", "2026-09-01"), person("b", 2, "Ben Ortiz", "2026-09-01")],
    entries: [row("a", "2026-10-03", 95_000), row("a", "2026-10-04", 6_000), row("b", "2026-10-04", 120_000)],
  },
  "2026-10-04",
);
assert.equal(big.month.club, 2);
assert.deepEqual(
  big.crossed.map((c) => [c.meters, c.rowers.map((r) => r.name)]),
  [
    [10_000, ["Ben Ortiz"]],
    [50_000, ["Ben Ortiz"]],
    [100_000, ["Ann Lee", "Ben Ortiz"]],
  ],
  "a crosses only the 100K (she passed 10K and 50K the day before); b crosses three at once",
);

/* Empty: nothing NaN, nothing thrown. */
const empty = emptyDailyInput("2026-10-01");
assert.equal(empty.active, 0);
assert.equal(empty.avg7, 0);
assert.equal(empty.top.length, 0);
assert.equal(empty.crossed.length, 0);
assert.equal(empty.month.daysLeft, 30);

/* --------------------------------------------------------------- the mail */

const m = dailySummaryMail(i);
assert.equal(m.subject, "Rowtember · Thu Oct 1 · 3 rowed · 25,000 m · +2 joined");
assert.ok(m.text.includes("ROWTEMBER — THURSDAY, OCTOBER 1"));
assert.ok(m.text.includes("DAILY ACTIVE ROWERS\n3 · 1.4 avg over 7 days · +1 on the day before"));
assert.ok(m.text.includes("METERS ON THE DAY\n25,000 m · 4 rows"));
assert.ok(m.text.includes("JOINED\n+2 · 4 signed up in all\n003 · Cal Reyes\n004 · Dee Park"));
assert.ok(m.text.includes(`CROSSED A RUNG\n10K · ${T10}: Ann Lee, Ben Ortiz`));
assert.ok(m.text.includes("OCTOBER SO FAR · DAY 1 OF 31\n25,000 m · 4 rows · 3 rowers rowed · 0 in the 100K club · 30 days left"));
assert.ok(m.text.includes("TOP THREE ON THE DAY\n1 · 002 · Ben Ortiz · 12,000 m\n2 · 001 · Ann Lee · 10,000 m\n3 · 003 · Cal Reyes · 3,000 m"));
/* The html carries the same facts, inline styles only, no pictures. */
assert.ok(m.html.includes("Daily active rowers"));
assert.ok(m.html.includes(">3<"), "the big figure");
assert.ok(m.html.includes("#0077B6"), "the one blue figure");
assert.ok(m.html.includes("Ben Ortiz"));
assert.ok(m.html.includes("12,000"));
assert.ok(m.html.includes("Thursday, October 1"));
assert.ok(!m.html.includes("<img"), "no images");
assert.ok(!m.html.includes("<style"), "no style block");

/* Nobody joined: the subject says nothing about it; the block says 0. */
const quiet = dailySummaryMail(sep);
assert.equal(quiet.subject, "Rowtember · Wed Sep 30 · 2 rowed · 20,000 m");
assert.ok(quiet.text.includes("JOINED\n0 · 2 signed up in all\n"));
assert.ok(quiet.text.includes("SEPTEMBER SO FAR · DAY 30 OF 30\n30,000 m · 7 rows · 2 rowers rowed · 0 in the 100K club · last day"));

/* Eleven joined: ten names and "+1 more". */
const crowd = dailyInput(
  {
    participants: Array.from({ length: 11 }, (_, k) => person(`p${k}`, k + 1, `Rower ${k + 1}`, "2026-10-05")),
    entries: [],
  },
  "2026-10-05",
);
const cm = dailySummaryMail(crowd);
assert.equal(crowd.joined.length, 11);
assert.ok(cm.text.includes("010 · Rower 10\n+1 more"));
assert.ok(!cm.text.includes("011 · Rower 11"));
assert.ok(cm.html.includes("+1 more"));
assert.ok(cm.text.includes("TOP THREE ON THE DAY\nnobody rowed"));

/* A hidden rower (blackout) prints blocks, not meters. */
const hidden = { ...i, top: i.top.map((t, k) => (k === 0 ? { ...t, censor: { kind: "full" as const, digits: 5, why: "elite" as const } } : t)) };
const hm = dailySummaryMail(hidden);
assert.ok(hm.text.includes("1 · 002 · Ben Ortiz · ██,███ m"));
assert.ok(!hm.text.includes("12,000"), "the hidden number is nowhere in the text");
assert.ok(!hm.html.includes("12,000"), "nor in the html");

/* Escaping: a name with an ampersand is safe in the html. */
const amp = dailySummaryMail(dailyInput({ participants: [person("a", 1, "Tom & Jerry", "2026-10-01")], entries: [row("a", "2026-10-01")] }, "2026-10-01"));
assert.ok(amp.html.includes("Tom &amp; Jerry"));
assert.ok(amp.text.includes("Tom & Jerry"));

console.log("dailyMail: every case holds");
