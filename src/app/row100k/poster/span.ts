/* poster/span.ts — THE TIME FRAME a poster is drawn over (owner,
 * 2026-10-01: "We need to be able to select the time frame for the
 * posters. A specific month or all time").
 *
 * The poster code grew up September-shaped: FIRST_DAY, MONTH_DAYS and the
 * weekday of the 1st were process constants, and every calendar cell,
 * curve tick and dateline read off them. A span is those facts as a VALUE,
 * built from a rowPeriod.ts Period, so the same assembler and the same
 * charts draw September final, October so far, or every day since the
 * first month there was.
 *
 *   month   the calendar grid is that month (its days, its first weekday);
 *           dayNumber is how many of its days have happened, and a month
 *           that is over is FINAL with every day in;
 *   all     one continuous run of days from the first month's 1st through
 *           today, on the same seven-column grid — the day numbers inside
 *           the cells are each date's own day of the month, so the grid
 *           reads as the months laid end to end.
 *
 * PURE: no db, no next/headers, no process constants. Days are plain
 * "YYYY-MM-DD" strings on the challenge's fixed UTC-7 clock, like
 * rowPeriod.ts. */

import { FIRST_MONTH_KEY, monthFromKey, pacificDayKey, type Period } from "@/lib/rowPeriod";

export type PosterSpan = {
  kind: "month" | "all";
  /* "2026-10" | "all" */
  key: string;
  /* The nameplate: "ROWTEMBER 2026" | "OCTOBER 2026" | "ALL TIME" */
  title: string;
  /* The bests eyebrow: "THIS ROWTEMBER" | "THIS OCTOBER" | "ALL TIME" */
  scope: string;
  firstDay: string;
  /* A month's last day; today for all time. */
  lastDay: string;
  /* Cells in the calendar grid: the month's days, or every day so far. */
  days: number;
  /* Weekday of firstDay, 0 = Sunday — the leading blanks on the grid. */
  firstDow: number;
  /* How many of `days` have happened, 1..days. */
  dayNumber: number;
  /* The month is over: every day is in and the dateline says FINAL. */
  final: boolean;
  year: number;
  /* "SEP 1" | "OCT 1" — the first-day tag on the curve's axis. */
  firstTag: string;
};

const DAY_MS = 86_400_000;
const SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const utcOf = (day: string): number => Date.parse(`${day}T00:00:00Z`);

/* "YYYY-MM-DD" plus n days. */
export function dayPlus(day: string, n: number): string {
  return new Date(utcOf(day) + n * DAY_MS).toISOString().slice(0, 10);
}

/* Whole days from `a` to `b` (b − a); negative when b is before a. */
export function daysBetween(a: string, b: string): number {
  return Math.round((utcOf(b) - utcOf(a)) / DAY_MS);
}

/* The day-of-month number printed in the i-th cell of a grid that starts
 * on firstDay. */
export function domAt(firstDay: string, i: number): number {
  return Number(dayPlus(firstDay, i).slice(8, 10));
}

/* The i-th day of the span as "YYYY-MM-DD". */
export const dayAt = (span: PosterSpan, i: number): string => dayPlus(span.firstDay, i);

/* Where a day falls in the span's grid, or -1 outside it. */
export function dayIndex(span: PosterSpan, day: string): number {
  if (day < span.firstDay || day > span.lastDay) return -1;
  return daysBetween(span.firstDay, day);
}

export function spanOf(period: Period, atMs: number): PosterSpan {
  const today = pacificDayKey(atMs);
  if (period.kind === "month") {
    const m = period;
    const final = atMs >= m.endMs;
    const dayNumber = final || today > m.lastDay ? m.days : today < m.firstDay ? 1 : Number(today.slice(8, 10));
    const word = m.month === 9 ? "Rowtember" : m.label.split(" ")[0];
    return {
      kind: "month",
      key: m.key,
      title: `${word.toUpperCase()} ${m.year}`,
      scope: `THIS ${word.toUpperCase()}`,
      firstDay: m.firstDay,
      lastDay: m.lastDay,
      days: m.days,
      firstDow: m.firstDow,
      dayNumber: Math.max(1, Math.min(m.days, dayNumber)),
      final,
      year: m.year,
      firstTag: `${m.short} 1`,
    };
  }
  const first = monthFromKey(FIRST_MONTH_KEY);
  const firstDay = first ? first.firstDay : `${FIRST_MONTH_KEY}-01`;
  const lastDay = today < firstDay ? firstDay : today;
  const days = daysBetween(firstDay, lastDay) + 1;
  return {
    kind: "all",
    key: "all",
    title: "ALL TIME",
    scope: "ALL TIME",
    firstDay,
    lastDay,
    days,
    firstDow: new Date(utcOf(firstDay)).getUTCDay(),
    dayNumber: days,
    final: false,
    year: Number(lastDay.slice(0, 4)),
    firstTag: `${SHORT[Number(firstDay.slice(5, 7)) - 1]} 1`,
  };
}

/* The x-axis ticks of a curve over the span, as 1-based day indexes: a
 * month's 1 / 10 / 20 / last (row100k.ts dayTicks, copied so this file
 * stays free of the process month); all time ticks on every month's 1st
 * and the last day. */
export type SpanLite = Pick<PosterSpan, "kind" | "firstDay" | "firstTag">;

export function spanTicks(span: SpanLite, days: number): number[] {
  if (span.kind === "month") {
    if (days <= 1) return [1];
    if (days <= 8) return Array.from({ length: days }, (_, i) => i + 1);
    if (days <= 16) return [...new Set([1, Math.round(days / 2), days])];
    return [...new Set([1, 10, 20, days].filter((d) => d <= days))];
  }
  const out: number[] = [];
  for (let i = 0; i < days; i++) if (domAt(span.firstDay, i) === 1) out.push(i + 1);
  if (!out.includes(days)) out.push(days);
  return out;
}

/* The label under a tick: the first-day tag on the 1st of a month, the
 * day number inside a month, and "OCT 1" style tags on all time's month
 * starts. */
export function tickLabel(span: SpanLite, d: number): string {
  if (span.kind === "month") return d === 1 ? span.firstTag : String(d);
  const day = dayPlus(span.firstDay, d - 1);
  const dom = Number(day.slice(8, 10));
  return dom === 1 ? `${SHORT[Number(day.slice(5, 7)) - 1]} 1` : String(dom);
}
