import { monthOf, monthsThrough, pacificDayKey } from "@/lib/rowPeriod";
import type { RawEntry } from "./data";

/* THE MONTHS (owner, 2026-09-25: "a comparison between months — on the
 * third day of the month we had this many meters, but this month we have
 * this many; same for number of sessions and daily active users. Graphed
 * on the month scale").
 *
 * One line per month there has been, x the day of the month, so December
 * can be read against November and October at the same day. The rest of
 * the numbers page is this month only (compute.ts filters to it); this
 * builder takes EVERY entry in the challenge, which data.ts already loads
 * in one query and caches, and folds it by month and day. Nothing here is
 * per rower, so nothing here needs masking: three totals a day, and the
 * count of distinct rowers behind them. */

export type MonthLine = {
  /* "2026-12" */
  key: string;
  /* "December 2026" */
  label: string;
  /* "DEC" */
  short: string;
  /* days in the month; a past month draws all of them */
  days: number;
  /* the month the clock is in — drawn in water blue and stopped at today */
  current: boolean;
  /* index 0 = day 1. Cumulative meters through that day. */
  meters: number[];
  /* cumulative sessions through that day */
  sessions: number[];
  /* distinct rowers who logged that day (not cumulative) */
  active: number[];
  /* distinct rowers with a row anywhere in the month */
  rowers: number;
};

export type MonthsModel = {
  /* oldest first, the current month last */
  lines: MonthLine[];
  /* today's day number on the challenge clock, 1–31 */
  today: number;
  /* "Dec 15" */
  todayLabel: string;
  /* the widest month on the chart, 28–31 */
  span: number;
  /* axis tops, or 0 when the chart has nothing to draw */
  yMeters: number;
  ySessions: number;
  yActive: number;
};

const SHORT_LONG: Record<string, string> = {
  JAN: "Jan",
  FEB: "Feb",
  MAR: "Mar",
  APR: "Apr",
  MAY: "May",
  JUN: "Jun",
  JUL: "Jul",
  AUG: "Aug",
  SEP: "Sep",
  OCT: "Oct",
  NOV: "Nov",
  DEC: "Dec",
};

/* 1 / 2 / 4 / 5 / 8 / 10 × 10ⁿ above the max: tops that quarter into
 * whole gridline labels (8 M reads 2, 4, 6, 8) and sit close enough to the
 * data that a six-million-meter month does not live in the bottom half of
 * a ten-million frame. Counts under ten get a top of ten so a two-session
 * day is not drawn as a mountain. */
function top(max: number, floor: number): number {
  if (!(max > 0)) return 0;
  const m = Math.max(max, floor);
  const pow = Math.pow(10, Math.floor(Math.log10(m)));
  for (const k of [1, 2, 4, 5, 8, 10]) if (m <= k * pow) return k * pow;
  return 10 * pow;
}

export function buildMonths(entries: RawEntry[], atMs: number): MonthsModel {
  const now = monthOf(atMs);
  const todayKey = pacificDayKey(atMs);
  const today = todayKey.startsWith(now.key) ? Math.max(1, Math.min(now.days, Number(todayKey.slice(8, 10)))) : now.days;
  const months = monthsThrough(atMs);

  /* Fold the entries by month, then by day. A row logged for a day outside
   * any month on the list (a bad key, a day past the month's end) is
   * dropped rather than drawn somewhere wrong. */
  type Acc = { meters: number[]; sessions: number[]; who: Set<string>[]; rowers: Set<string> };
  const acc = new Map<string, Acc>();
  for (const m of months) {
    acc.set(m.key, {
      meters: new Array<number>(m.days).fill(0),
      sessions: new Array<number>(m.days).fill(0),
      who: Array.from({ length: m.days }, () => new Set<string>()),
      rowers: new Set<string>(),
    });
  }
  for (const e of entries) {
    const a = acc.get(e.day.slice(0, 7));
    if (!a) continue;
    const d = Number(e.day.slice(8, 10));
    if (!(d >= 1 && d <= a.meters.length)) continue;
    /* A logged row is a session whatever its meters; only the meters sum
     * ignores a non-positive value. */
    if (e.meters > 0) a.meters[d - 1] += e.meters;
    a.sessions[d - 1] += 1;
    a.who[d - 1].add(e.participantId);
    a.rowers.add(e.participantId);
  }

  const lines: MonthLine[] = months.map((m) => {
    const a = acc.get(m.key) as Acc;
    const current = m.key === now.key;
    /* The current month stops at today: the days ahead have not happened,
     * and a flat line to the 31st would read as a month that gave up. */
    const n = current ? today : m.days;
    const meters: number[] = [];
    const sessions: number[] = [];
    const active: number[] = [];
    let cm = 0;
    let cs = 0;
    for (let i = 0; i < n; i++) {
      cm += a.meters[i];
      cs += a.sessions[i];
      meters.push(cm);
      sessions.push(cs);
      active.push(a.who[i].size);
    }
    return { key: m.key, label: m.label, short: m.short, days: m.days, current, meters, sessions, active, rowers: a.rowers.size };
  });

  const last = (xs: number[]) => (xs.length ? xs[xs.length - 1] : 0);
  return {
    lines,
    today,
    todayLabel: `${SHORT_LONG[now.short] ?? now.short} ${today}`,
    span: Math.max(...months.map((m) => m.days), 28),
    yMeters: top(Math.max(...lines.map((l) => last(l.meters))), 1000),
    ySessions: top(Math.max(...lines.map((l) => last(l.sessions))), 10),
    yActive: top(Math.max(...lines.map((l) => Math.max(0, ...l.active))), 10),
  };
}

/* The figure a line had on a given day of its month, or null when that
 * month had not reached the day (a 30-day month asked for the 31st, or the
 * current month asked for tomorrow). */
export function atDay(xs: number[], day: number): number | null {
  return day >= 1 && day <= xs.length ? xs[day - 1] : null;
}
