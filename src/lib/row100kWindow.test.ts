/* The log window across the month boundary, checked by hand:
 * npx tsx src/lib/row100kWindow.test.ts (no test runner in the repo; plain
 * asserts, exit 1 on the first miss). The picker floor and validateEntry
 * on both sides of a month's grace close (rollover review, 2026-09-28).
 * Every instant is given, so the process month plays no part. */
import assert from "node:assert/strict";
import { earliestLoggableDay, validateEntry } from "./row100k";
import { monthFromKey } from "./rowPeriod";

/* Instants on the challenge's fixed UTC-7 clock. */
const pacific = (y: number, m: number, d: number, h = 12) => Date.UTC(y, m - 1, d, h + 7);

const SEP_15 = pacific(2026, 9, 15);
const SEP_30_LATE = pacific(2026, 9, 30, 23);
const OCT_1 = pacific(2026, 10, 1);
const OCT_3_LATE = pacific(2026, 10, 3, 23);
/* Midnight Pacific on Oct 4: September's grace is over. */
const OCT_4_MIDNIGHT = pacific(2026, 10, 4, 0);
const OCT_4 = pacific(2026, 10, 4);
const NOV_2 = pacific(2026, 11, 2);
const DEC_10 = pacific(2026, 12, 10);

assert.equal(monthFromKey("2026-09")?.logCloseMs, OCT_4_MIDNIGHT, "grace closes midnight Pacific on the 4th");

/* ------------------------------------------------- earliestLoggableDay */
assert.equal(earliestLoggableDay(SEP_15), "2026-09-01", "September: nothing before the first month");
assert.equal(earliestLoggableDay(SEP_30_LATE), "2026-09-01");
assert.equal(earliestLoggableDay(OCT_1), "2026-09-01", "Oct 1: September is inside its grace");
assert.equal(earliestLoggableDay(OCT_3_LATE), "2026-09-01", "Oct 3, 11 pm: still inside");
assert.equal(earliestLoggableDay(OCT_4_MIDNIGHT), "2026-10-01", "Oct 4: the grace is over");
assert.equal(earliestLoggableDay(OCT_4), "2026-10-01");
assert.equal(earliestLoggableDay(NOV_2), "2026-10-01", "Nov 2: October inside its grace");

/* --------------------------------------------------------- validateEntry */
const row = (day: string) => ({ day, meters: 5000, seconds: 1200 });
const ok = (day: string, atMs: number, admin = false) => validateEntry(row(day), atMs, { admin }).ok;
const err = (day: string, atMs: number, admin = false) => {
  const r = validateEntry(row(day), atMs, { admin });
  return r.ok ? "" : r.error;
};

// The boundary, as a rower.
assert.equal(ok("2026-09-30", OCT_1), true, "Oct 1 filing Sep 30: inside the grace");
assert.equal(ok("2026-09-30", OCT_3_LATE), true, "Oct 3 filing Sep 30: still inside");
assert.equal(ok("2026-09-30", OCT_4_MIDNIGHT), false, "Oct 4 filing Sep 30: refused");
assert.equal(err("2026-09-30", OCT_4), "That day is outside October 2026 — log a row from this month.");
assert.equal(ok("2026-09-01", OCT_1), true, "any September day inside the grace");
assert.equal(ok("2026-08-31", OCT_1), false, "August was before the first month");
assert.equal(ok("2026-09-30", NOV_2), false, "two months back: no");
assert.equal(ok("2026-10-31", NOV_2), true, "Nov 2 filing Oct 31: inside October's grace");

// A September-born process takes an Oct 1 row: the month is the clock's,
// not the process's (the process running this file is September's).
assert.equal(ok("2026-10-01", OCT_1), true, "Oct 1 filing Oct 1");
assert.equal(ok("2026-10-01", pacific(2026, 10, 1, 0)), true, "Oct 1, midnight Pacific");
assert.equal(ok("2026-10-01", SEP_30_LATE), false, "the future, from Sep 30");
assert.equal(err("2026-10-01", SEP_30_LATE), "That day is outside September 2026 — log a row from this month.");
assert.equal(ok("2026-10-02", OCT_1), false, "the future, from Oct 1");
assert.equal(err("2026-10-02", OCT_1), "You can't log a row you haven't rowed yet.");

// The admin after the grace: any day from the first month through this one.
assert.equal(ok("2026-09-30", OCT_4, true), true, "Oct 4 filing Sep 30 as admin");
assert.equal(ok("2026-09-05", DEC_10, true), true, "December, correcting a September row");
assert.equal(ok("2026-08-31", DEC_10, true), false, "not before the first month, even as admin");
assert.equal(ok("2026-12-31", DEC_10, true), true, "admins may log ahead inside the month");
assert.equal(ok("2027-01-01", DEC_10, true), false, "not into next month");

// Still a row.
assert.equal(ok("2026-10-1", OCT_1), false, "not a day");
assert.equal(validateEntry({ day: "2026-10-01", meters: 5000, seconds: 200 }, OCT_1).ok, false, "faster than the record");

console.log("row100kWindow: all checks passed");
