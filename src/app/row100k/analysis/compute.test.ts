/* The numbers page by the month, checked by hand: npx tsx src/app/row100k/analysis/compute.test.ts
 * (no test runner in the repo; plain asserts, exit 1 on the first miss).
 * THE MONTHS, 2026-09-28: buildModel and projectRower take the month, so
 * October runs to 31 where September ran to 30, and the September maths
 * is the same as it was. */
import assert from "node:assert/strict";
import { MONTH_DAYS } from "@/lib/row100k";
import { monthFromKey, type Month } from "@/lib/rowPeriod";
import { buildModel, projectRower, type Viewer } from "./compute";
import type { RawEntry, RawParticipant } from "./data";

const SEP = monthFromKey("2026-09") as Month;
const OCT = monthFromKey("2026-10") as Month;

/* ---------------------------------------------------------- projectRower */
/* Sep 16: 16,000 m so far, 11,000 of it in the last seven days.
 * recent = 11000/7, month = 16000/16 = 1000, rate = 0.6·recent + 0.4·month
 * = 1342.857…; 14 days left in a 30-day month, 15 in a 31-day one. */
const sess = [
  { day: 1, meters: 5000 },
  { day: 10, meters: 5000 },
  { day: 16, meters: 6000 },
];
const p30 = projectRower(sess, 16, 30);
assert.equal(p30.current, 16000);
assert.equal(p30.projected, 34800, "30 days: 16000 + 1342.857 × 14");
assert.equal(p30.low, 30000, "30 days: the month rate × 14");
assert.equal(p30.high, 38000, "30 days: the recent rate × 14");
const p31 = projectRower(sess, 16, 31);
assert.equal(p31.current, 16000);
assert.equal(p31.projected, 36143, "31 days: 16000 + 1342.857 × 15");
assert.equal(p31.low, 31000);
assert.equal(p31.high, 39571);
/* Without a length it is this month's. */
assert.deepEqual(projectRower(sess, 16), projectRower(sess, 16, MONTH_DAYS));
/* The last day of the month projects flat: nothing left to run out over. */
assert.equal(projectRower(sess, 31, 31).projected, 16000);
assert.equal(projectRower(sess, 30, 30).projected, 16000);

/* ------------------------------------------------------------ buildModel */
let seq = 0;
const row = (participantId: string, day: string, meters: number, seconds: number): RawEntry => ({
  id: `e${++seq}`,
  participantId,
  day,
  meters,
  seconds,
  /* logged at noon Pacific on the day */
  createdAtMs: Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 19, 0, 0),
});
const rowers: RawParticipant[] = Array.from({ length: 6 }, (_, i) => ({
  id: `p${i + 1}`,
  rowerNumber: i + 1,
  division: i % 2 ? "F" : "M",
  displayName: `Rower ${i + 1}`,
}));
/* The same field in either month: six rowers, three or four rows each on
 * days 1..16, only the month in the day string differs. */
const field = (key: string): RawEntry[] => {
  const d = (n: number) => `${key}-${String(n).padStart(2, "0")}`;
  return [
    row("p1", d(1), 5000, 1250), row("p1", d(5), 6000, 1500), row("p1", d(9), 5000, 1240), row("p1", d(16), 8000, 2000),
    row("p2", d(2), 4000, 1100), row("p2", d(6), 4000, 1090), row("p2", d(13), 10000, 2700),
    row("p3", d(1), 2000, 520), row("p3", d(3), 2500, 640), row("p3", d(12), 3000, 760), row("p3", d(15), 3000, 750),
    row("p4", d(4), 7000, 1680), row("p4", d(8), 7000, 1670), row("p4", d(14), 7500, 1790),
    row("p5", d(2), 5000, 1300), row("p5", d(7), 5500, 1400), row("p5", d(11), 6000, 1520), row("p5", d(16), 6000, 1500),
    row("p6", d(5), 3000, 800), row("p6", d(10), 3000, 790), row("p6", d(13), 3200, 830),
  ];
};
const me: Viewer = { kind: "joined", id: "p5", rowerNumber: 5, division: "M", entries: field("2026-09").filter((e) => e.participantId === "p5") };
const anon: Viewer = { kind: "anon" };

const sep = buildModel(rowers, field("2026-09"), me, 16, undefined, false, undefined, SEP);
assert.equal(sep.sessions, 21);
assert.equal(sep.rowers, 6);
assert.deepEqual(sep.month, { key: "2026-09", label: "September 2026", short: "SEP", days: 30, last: "Sep 30" });
assert.equal(sep.forecast.daysLeft, 14);
assert.ok(sep.forecast.s.eyebrow.startsWith("FORECAST · SEP 30 · 14 DAYS LEFT · 6 ROWERS"), sep.forecast.s.eyebrow);
assert.ok(sep.forecast.s.tiles[0].d.startsWith("expected community total on Sep 30 ·"), sep.forecast.s.tiles[0].d);
assert.ok(sep.s1.eyebrow.endsWith("DAY 16 OF 30"), sep.s1.eyebrow);
assert.ok(sep.dayc, "sessions-per-day chart draws");
assert.equal(sep.dayc?.counts.length, 16);
assert.equal(sep.dayc?.short, "SEP");
/* September 2026 weekends: the 5th and 6th, the 12th and 13th. */
assert.deepEqual(
  sep.dayc?.weekend.map((w, i) => (w ? i + 1 : 0)).filter(Boolean),
  [5, 6, 12, 13],
);
assert.ok(sep.fan, "the fan draws with six rowers on day 16");
assert.equal(sep.fan?.span, 30);
assert.equal(sep.fan?.short, "SEP");
assert.equal(sep.fan?.days, 16);
assert.ok(sep.fanYou, "the viewer's own line");
assert.deepEqual(sep.fanYou?.proj?.[1][0], 30, "the dashed line runs out to the 30th");
assert.equal(sep.fanYou?.proj?.[1][1], sep.forecast.rows.find((r) => r.you)?.projected, "one number with the table");
assert.ok(sep.fanYou?.label.endsWith(" ON DAY 16"), sep.fanYou?.label);
assert.ok(sep.s4.tiles[1].n.startsWith("Sep "), `busiest day reads Sep n: ${sep.s4.tiles[1].n}`);

/* The same rows, filed in October: 31 days, OCT tags, the 3rd and 4th are
 * the first weekend; the projection runs 15 days out, not 14. */
const meOct: Viewer = { ...me, kind: "joined", entries: field("2026-10").filter((e) => e.participantId === "p5") } as Viewer;
const oct = buildModel(rowers, field("2026-10"), meOct, 16, undefined, false, undefined, OCT);
assert.equal(oct.sessions, 21);
assert.deepEqual(oct.month, { key: "2026-10", label: "October 2026", short: "OCT", days: 31, last: "Oct 31" });
assert.equal(oct.forecast.daysLeft, 15);
assert.ok(oct.forecast.s.eyebrow.startsWith("FORECAST · OCT 31 · 15 DAYS LEFT"), oct.forecast.s.eyebrow);
assert.ok(oct.forecast.s.tiles[0].d.startsWith("expected community total on Oct 31 ·"), oct.forecast.s.tiles[0].d);
assert.ok(oct.s1.eyebrow.endsWith("DAY 16 OF 31"), oct.s1.eyebrow);
assert.equal(oct.dayc?.short, "OCT");
assert.deepEqual(
  oct.dayc?.weekend.map((w, i) => (w ? i + 1 : 0)).filter(Boolean),
  [3, 4, 10, 11],
);
assert.equal(oct.fan?.span, 31);
assert.equal(oct.fan?.short, "OCT");
assert.deepEqual(oct.fanYou?.proj?.[1][0], 31);
assert.ok(oct.s4.tiles[1].n.startsWith("Oct "), oct.s4.tiles[1].n);

/* The maths that does not read the calendar is the same in either month:
 * the distributions and the pace model see the same sessions. */
assert.deepEqual(oct.s1.tiles, sep.s1.tiles);
assert.deepEqual(oct.hist, sep.hist);
assert.deepEqual(oct.s2.tiles, sep.s2.tiles);
assert.deepEqual(oct.pace, sep.pace);
/* A 31-day month projects further from the same rows. */
const sepRow = sep.forecast.rows.find((r) => r.rowerNumber === 1);
const octRow = oct.forecast.rows.find((r) => r.rowerNumber === 1);
assert.ok(sepRow && octRow);
assert.equal(sepRow.current, octRow.current);
assert.ok((octRow.projected ?? 0) > (sepRow.projected ?? 0), "15 days out beats 14");

/* Cross-month rows are not on the page: September's rows under October
 * are nothing, and the empty page is NaN-free. */
const none = buildModel(rowers, field("2026-09"), anon, 16, undefined, false, undefined, OCT);
assert.equal(none.sessions, 0);
assert.equal(none.rowers, 0);
assert.equal(none.dayc, null);
assert.equal(none.fan, null);
assert.ok(none.s1.eyebrow.endsWith("DAY 16 OF 31"), none.s1.eyebrow);
assert.ok(!JSON.stringify(none).includes("NaN"), "no NaN in the empty October page");

/* Without a month it is this month's — the page's default. */
const dflt = buildModel(rowers, field("2026-09"), anon, 16);
assert.equal(dflt.month.days, MONTH_DAYS);

console.log("compute.test: ok");
