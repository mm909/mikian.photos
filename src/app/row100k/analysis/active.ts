import { monthsThrough, pacificDayKey } from "@/lib/rowPeriod";
import type { RawEntry } from "./data";
import { top } from "./months";

/* DAILY ACTIVE ROWERS (owner, 2026-09-25: "a daily active rower chart on
 * the dev numbers page for now").
 *
 * The plain product metric: distinct rowers who logged a row, per calendar
 * day on the challenge clock, every day from the first day there is data
 * (day 1 of the first month) through today — a day with no rows is a zero,
 * never a gap — with a trailing seven-day mean over it. THE MONTHS section
 * folds the same entries onto a day-of-month axis to compare months; this
 * one is the single time series. Nothing here is per rower, so nothing
 * here needs masking. */

export type ActiveDay = {
  /* "2026-09-12" */
  key: string;
  /* "Sep 12" */
  label: string;
  /* distinct rowers with a row logged that day */
  active: number;
  /* rows logged that day */
  sessions: number;
};

export type ActiveModel = {
  /* oldest first, today last; empty when the clock is before day 1 */
  days: ActiveDay[];
  /* trailing seven-day mean of active, same length as days (the first six
   * days average what there is) */
  avg7: number[];
  /* axis top, or 0 when nobody has logged a row on any day */
  yMax: number;
  /* active today */
  today: number;
  avg7Now: number;
  avg30Now: number;
  /* the day with the most rowers, the first of them on a tie; null until
   * somebody has logged a row */
  peak: { key: string; label: string; active: number } | null;
  /* "Sep 1" */
  since: string;
};

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86_400_000;
/* 240 months of days: the same cap monthsThrough puts on a bad clock. */
const MAX_DAYS = 240 * 31;

/* "Sep 12" from "2026-09-12"; the key itself when it is not a day. */
export function dayLabel(key: string): string {
  const m = MON[Number(key.slice(5, 7)) - 1];
  const d = Number(key.slice(8, 10));
  return m && d >= 1 ? `${m} ${d}` : key;
}

/* Every "YYYY-MM-DD" from `first` through `last`, walked in UTC so no
 * server zone or DST shift can skip or double a day. */
function dayKeys(first: string, last: string): string[] {
  const out: string[] = [];
  const at = (k: string) => Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10)));
  for (let t = at(first); out.length < MAX_DAYS; t += DAY_MS) {
    const k = new Date(t).toISOString().slice(0, 10);
    if (k > last) break;
    out.push(k);
  }
  return out;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function buildActive(entries: RawEntry[], atMs: number): ActiveModel {
  const first = monthsThrough(atMs)[0].firstDay;
  const todayKey = pacificDayKey(atMs);
  const keys = dayKeys(first, todayKey);

  /* Fold the entries by day: who rowed, and how many rows. A row on a day
   * outside the range (a bad key, a day ahead of the clock) is dropped
   * rather than drawn somewhere wrong. */
  const who = new Map<string, Set<string>>();
  const rows = new Map<string, number>();
  for (const k of keys) {
    who.set(k, new Set<string>());
    rows.set(k, 0);
  }
  for (const e of entries) {
    const w = who.get(e.day);
    if (!w) continue;
    w.add(e.participantId);
    rows.set(e.day, (rows.get(e.day) ?? 0) + 1);
  }

  const days: ActiveDay[] = keys.map((k) => ({
    key: k,
    label: dayLabel(k),
    active: (who.get(k) as Set<string>).size,
    sessions: rows.get(k) ?? 0,
  }));
  const active = days.map((d) => d.active);
  const avg7 = active.map((_, i) => mean(active.slice(Math.max(0, i - 6), i + 1)));

  let peak: ActiveModel["peak"] = null;
  for (const d of days) if (d.active > 0 && (!peak || d.active > peak.active)) peak = { key: d.key, label: d.label, active: d.active };

  const n = days.length;
  return {
    days,
    avg7,
    yMax: top(peak ? peak.active : 0, 10),
    today: n ? active[n - 1] : 0,
    avg7Now: n ? avg7[n - 1] : 0,
    avg30Now: mean(active.slice(Math.max(0, n - 30))),
    peak,
    since: dayLabel(first),
  };
}
