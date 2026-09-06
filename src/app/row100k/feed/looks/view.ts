import { PACIFIC_SHIFT_MS } from "@/lib/blackoutRules";
import { fmtDay } from "@/lib/row100k";
import type { FeedItem } from "../FeedViews";

/* What the three feed looks (FeedA/B/C) render, and the pure helpers that
 * build it. No db, no server-only imports: page.tsx computes everything on
 * the server and the looks — client components, for the lightbox — only
 * lay it out. Every number in here is either an aggregate (a day's total,
 * today's headline) or a FeedItem string the page already blanked for a
 * masked rower (FeedViews.tsx), so nothing new reaches the browser. */

/* Three looks for the owner to pick from (2026-09-05), selected with
 * ?look=a|b|c and nothing else — no cookie, no setting; the pick becomes
 * the default next. Anything else renders the feed as it stands. */
export type FeedLook = "a" | "b" | "c";

export function pickFeedLook(raw: string | string[] | undefined): FeedLook | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "a" || v === "b" || v === "c" ? v : null;
}

/* A feed row plus the three parts of its stamp the looks group and print
 * separately: the landing day (the group key and its SEP 5 label) and the
 * clock alone, since the day head already says which day. */
export type FeedLookItem = FeedItem & {
  /* "2026-09-05" — the Pacific day the row LANDED (createdAt shifted the
   * repo's seven hours), which is what the stamps already show. The
   * challenge `day` the rower picked can be earlier (a row logged the
   * next morning); grouping by the landing day keeps every stamp under a
   * head that agrees with it. */
  dayKey: string;
  /* "SEP 5" */
  dayStr: string;
  /* "3:54 PM" */
  clockStr: string;
};

/* A whole day's total — every row that landed that Pacific day, not just
 * the ones on this page. `meters` sums only the rows THIS viewer may see:
 * a masked rower's meters are left out and counted in `hidden` instead,
 * because a day whose only row is an elite's would print that row's
 * meters verbatim, and any other day would give them away by subtracting
 * the visible rows (the owner's no-number rule beats "aggregates stay").
 * `rows` counts every row, hidden ones included — the feed already shows
 * the masked row exists. Self and admins see the full figure: the page's
 * isHidden already exempts them. */
export type DayTotal = { meters: number; rows: number; hidden: number };

export type FeedDayGroup = { dayKey: string; dayStr: string; items: FeedLookItem[] };

/* The one big blue number: what landed today (Pacific), page-independent.
 * Same rule as DayTotal: `meters` is the visible rows' sum, `hidden` the
 * masked rows left out of it; `rows` and `rowers` count everyone. */
export type FeedHeadline = {
  /* "SEP 5" */
  dayStr: string;
  meters: number;
  rows: number;
  /* distinct rowers */
  rowers: number;
  hidden: number;
};

/* The three parts of a stamp, off the same UTC-7 shift as stampWhen in
 * page.tsx (and admin/fix-days usWestDay) — read back as UTC fields so the
 * server's own zone never leaks in. */
export function stampParts(createdAt: Date): { dayKey: string; dayStr: string; clockStr: string } {
  const p = new Date(createdAt.getTime() - PACIFIC_SHIFT_MS);
  const dayKey = p.toISOString().slice(0, 10);
  const h24 = p.getUTCHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const min = String(p.getUTCMinutes()).padStart(2, "0");
  return {
    dayKey,
    dayStr: fmtDay(dayKey).toUpperCase(),
    clockStr: `${h}:${min} ${h24 < 12 ? "AM" : "PM"}`,
  };
}

/* Midnight Pacific of a "YYYY-MM-DD" day as a UTC instant — the lower edge
 * of a createdAt range; add a day for the upper. */
export const DAY_MS = 86_400_000;
export function pacificDayStartMs(dayKey: string): number {
  return Date.parse(`${dayKey}T00:00:00Z`) + PACIFIC_SHIFT_MS;
}

/* Rows into day sections, page order kept (newest first; the server sorts
 * on createdAt, so a day's rows are contiguous and a day appears once). */
export function groupByDay(items: FeedLookItem[]): FeedDayGroup[] {
  const groups: FeedDayGroup[] = [];
  for (const it of items) {
    const last = groups[groups.length - 1];
    if (last && last.dayKey === it.dayKey) last.items.push(it);
    else groups.push({ dayKey: it.dayKey, dayStr: it.dayStr, items: [it] });
  }
  return groups;
}
