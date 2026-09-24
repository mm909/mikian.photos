/* THE MONTHS (owner, 2026-09-24: "we want to transition into being more of
 * a Strava-like platform rather than a monthly challenge platform … the
 * totals for the month can just be total monthly leaderboards … we default
 * to the numbers for this month, allow you to select previous months, and
 * an all time option").
 *
 * September was written into the site as constants — FIRST_DAY, 30 days,
 * a first weekday. This module is where a month becomes a value, so the
 * site can be in October the way it was in September, and a board can be
 * asked for any month, or for all of them.
 *
 * NO IMPORTS FROM row100k.ts: that file derives its September-shaped
 * constants from monthOf(nowMs()) and this one must load first. Days are
 * plain "YYYY-MM-DD" strings and the clock is the challenge's fixed UTC-7
 * (the same shift every chart uses), so nothing here depends on the
 * server's zone. */

export type Week = { key: string; label: string; first: string; last: string };

export type Month = {
  kind: "month";
  /* "2026-10" */
  key: string;
  year: number;
  /* 1–12 */
  month: number;
  /* "October 2026" */
  label: string;
  /* "OCT" */
  short: string;
  firstDay: string;
  lastDay: string;
  days: number;
  /* Weekday of the 1st, 0 = Sunday — the leading blanks on a calendar. */
  firstDow: number;
  /* Midnight Pacific on the 1st, and on the 1st of the next month. */
  startMs: number;
  endMs: number;
  /* Late logs for this month are taken until here (GRACE_DAYS after). */
  logCloseMs: number;
};

export type Period = Month | { kind: "all"; key: "all"; label: string; short: string; firstDay: string; lastDay: string };

/* The first month there was: Rowtember. Nothing before it is a period. */
export const FIRST_MONTH_KEY = "2026-09";
export const GRACE_DAYS = 3;

const PACIFIC_H = 7;
const DAY_MS = 86_400_000;
const SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const pad2 = (n: number) => String(n).padStart(2, "0");

/* "YYYY-MM-DD" on the challenge's fixed UTC-7 clock. */
export function pacificDayKey(atMs: number): string {
  return new Date(atMs - PACIFIC_H * 3_600_000).toISOString().slice(0, 10);
}

export function monthFromKey(key: string): Month | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startMs = Date.UTC(year, month - 1, 1, PACIFIC_H, 0, 0);
  const endMs = Date.UTC(year, month, 1, PACIFIC_H, 0, 0);
  return {
    kind: "month",
    key,
    year,
    month,
    label: `${LONG[month - 1]} ${year}`,
    short: SHORT[month - 1],
    firstDay: `${key}-01`,
    lastDay: `${key}-${pad2(days)}`,
    days,
    firstDow: new Date(Date.UTC(year, month - 1, 1)).getUTCDay(),
    startMs,
    endMs,
    logCloseMs: endMs + GRACE_DAYS * DAY_MS,
  };
}

/* The month a moment falls in, on the challenge clock. */
export function monthOf(atMs: number): Month {
  return monthFromKey(pacificDayKey(atMs).slice(0, 7)) as Month;
}

export function prevMonth(m: Month): Month {
  return monthFromKey(m.month === 1 ? `${m.year - 1}-12` : `${m.year}-${pad2(m.month - 1)}`) as Month;
}

export function nextMonth(m: Month): Month {
  return monthFromKey(m.month === 12 ? `${m.year + 1}-01` : `${m.year}-${pad2(m.month + 1)}`) as Month;
}

/* Every month from the first one through the one `atMs` is in, oldest
 * first. Capped so a bad clock cannot loop forever. */
export function monthsThrough(atMs: number, fromKey: string = FIRST_MONTH_KEY): Month[] {
  const out: Month[] = [];
  const last = monthOf(atMs);
  let m = monthFromKey(fromKey);
  if (!m) return [last];
  while (m.key <= last.key && out.length < 240) {
    out.push(m);
    m = nextMonth(m);
  }
  return out.length ? out : [last];
}

export function allTime(atMs: number): Period {
  return { kind: "all", key: "all", label: "All time", short: "ALL TIME", firstDay: `${FIRST_MONTH_KEY}-01`, lastDay: pacificDayKey(atMs) };
}

/* ?m=2026-10 | ?m=all | nothing → this month. A month before the first
 * or after this one is this month: a link to nowhere lands somewhere. */
export function parsePeriod(q: string | string[] | undefined, atMs: number): Period {
  const raw = Array.isArray(q) ? q[0] : q;
  const now = monthOf(atMs);
  if (raw === "all") return allTime(atMs);
  if (typeof raw === "string") {
    const m = monthFromKey(raw.trim());
    if (m && m.key >= FIRST_MONTH_KEY && m.key <= now.key) return m;
  }
  return now;
}

export function inPeriod(day: string, p: Period): boolean {
  return day >= p.firstDay && day <= p.lastDay;
}

/* The month cut into calendar sevens from the 1st; the short last one is
 * THE FINISH, as September's two days were. */
export function weeksOf(m: Month): Week[] {
  const out: Week[] = [];
  let first = 1;
  let n = 1;
  while (first <= m.days) {
    const last = Math.min(m.days, first + 6);
    const short = last - first < 6 && first > 1;
    out.push({ key: `w${n}`, label: short ? "The finish" : `Week ${n}`, first: `${m.key}-${pad2(first)}`, last: `${m.key}-${pad2(last)}` });
    first = last + 1;
    n++;
  }
  return out;
}

/* THE OPTIONS a month control offers (PeriodSelect.tsx): every month so
 * far, oldest first, then all time. */
export function periodOptions(atMs: number): { key: string; label: string }[] {
  return [...monthsThrough(atMs).map((m) => ({ key: m.key, label: m.label })), { key: "all", label: "All time" }];
}
