import { PACIFIC_SHIFT_MS } from "@/lib/blackoutRules";
import { fmtDay } from "@/lib/row100k";

/* What the feed renders (Strips.tsx, FeedHead.tsx) and the pure helpers
 * that build it. No db, no server-only imports: page.tsx computes
 * everything on the server and the strips — a client component, for the
 * lightbox — only lay it out. Every number in here is either an aggregate
 * (a day's total, today's headline) or a FeedItem string the page already
 * blanked for a masked rower, so no hidden figure reaches the browser. */

/* One photo's display URLs: the public CDN full image plus its grid-sized
 * thumb (null only for shapes that carry none — the server always sends one
 * today, and a thumb that 404s swaps to the full frame in Thumb).
 * Structurally compatible with PhotoMedia in photoUrls.ts; declared here so
 * the client module never imports from the server-only one. */
export type FeedPhoto = {
  full: string;
  thumb: string | null;
};

/* One row of the feed, as a strip prints it. */
export type FeedItem = {
  id: string;
  /* the exact UTC instant the row landed, as an ISO string, for the title
   * attribute on the clock */
  absIso: string;
  /* "2026-09-05" — the Pacific day the row LANDED (createdAt shifted the
   * repo's seven hours): the day-section key. The challenge `day` the
   * rower picked can be earlier (a row logged the next morning); grouping
   * by the landing day keeps every stamp under a head that agrees with it. */
  dayKey: string;
  /* "SEP 5" */
  dayStr: string;
  /* "3:54 PM" */
  clockStr: string;
  rowerNumber: number;
  /* "023" */
  numStr: string;
  name: string;
  metersStr: string;
  durationStr: string;
  splitStr: string;
  /* session title, may be "" — printed on its own line above the number
   * and the name (omitted when empty) */
  title: string;
  /* resolved photo media, rower photo first — stable public CDN URLs for
   * real keys, inline SVG data URIs for demo color squares; empty when the
   * row has no photos or photos can't be served on this deploy */
  photos: FeedPhoto[];
  /* Blackout (blackoutRules.ts): the rower is one of the hidden fifteen —
   * metersStr, durationStr and splitStr are all "", `digits` says how many
   * blocks to draw in the meters slot and `timeShape` ("#:##:##") is the
   * silhouette of the time. No number of theirs is in this object. */
  masked?: boolean;
  digits?: number;
  timeShape?: string;
};

/* A whole day's total — every row that landed that Pacific day, not just
 * the ones on this page, and EVERY rower's meters, the hidden fifteen's
 * included. The owner's rule (restated 2026-09-05): a blacked-out rower's
 * meters still count inside every total and aggregate; only where THEIR
 * OWN number would be displayed is it blocked out, and a day's total is
 * nobody's own number — even on a day with a single elite row (the
 * owner's call). Nothing is subtracted and no hidden count is printed
 * next to the sum. */
export type DayTotal = { meters: number; rows: number };

export type FeedDayGroup = { dayKey: string; dayStr: string; items: FeedItem[] };

/* The one big blue number: what landed today (Pacific), page-independent.
 * Same rule as DayTotal: everyone's meters; `rows` and `rowers` count
 * everyone too. */
export type FeedHeadline = {
  /* "SEP 5" */
  dayStr: string;
  meters: number;
  rows: number;
  /* distinct rowers */
  rowers: number;
};

/* The three parts of a stamp, off the same UTC-7 shift as admin/fix-days
 * usWestDay — read back as UTC fields so the server's own zone never leaks
 * in. createdAt is REAL time even when the demo clock (nowMs) is shifted
 * into September. */
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
export function groupByDay(items: FeedItem[]): FeedDayGroup[] {
  const groups: FeedDayGroup[] = [];
  for (const it of items) {
    const last = groups[groups.length - 1];
    if (last && last.dayKey === it.dayKey) last.items.push(it);
    else groups.push({ dayKey: it.dayKey, dayStr: it.dayStr, items: [it] });
  }
  return groups;
}
