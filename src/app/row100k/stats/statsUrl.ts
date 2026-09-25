/* THE STATS PAGE'S ADDRESS, one way to spell it (owner, 2026-09-25: every
 * pick on the page swaps in place, but "links still work on reload" — so
 * the client writes the same URL the server reads, with replaceState, and
 * every soft line keeps it as a real href for a middle click).
 *
 *   ?m=YYYY-MM | all   the period; absent for this month
 *   ?s=<stat key>      the stat; absent for TOTAL METERS. A record key
 *                      (records/defs.ts) or one of the two period stats,
 *                      "day" (METERS BY DAY) and "week" (METERS BY WEEK)
 *   ?day=N             with ?s=day: the day on the board (1-based)
 *   ?w=N               with ?s=week: the week on the board (1-based)
 *
 * METERS BY DAY and BY WEEK are stats on the stat word since 2026-09-25
 * (owner: "combine METERS BY DAY and BY WEEK with the headline stat: add
 * them as categories on the stat word"), so they spell like any other
 * stat, and the day or week rides along only for them.
 *
 * Plain functions, no imports: shared by the server page, the client shell
 * and the API route. */

export type PeriodStatKey = "day" | "week";

export function isPeriodStat(k: string | undefined): k is PeriodStatKey {
  return k === "day" || k === "week";
}

export const STATS_PATH = "/row100k/stats";

export type StatsQuery = {
  /* The period key; the page's own month when equal to `currentMonthKey`. */
  m?: string;
  s?: string;
  day?: number;
  w?: number;
};

export function statsHref(q: StatsQuery, currentMonthKey: string): string {
  const p = new URLSearchParams();
  if (q.m && q.m !== currentMonthKey) p.set("m", q.m);
  if (q.s && q.s !== "total") p.set("s", q.s);
  if (q.day != null && q.day >= 1) p.set("day", String(q.day));
  if (q.w != null && q.w >= 1) p.set("w", String(q.w));
  const s = p.toString();
  return s ? `${STATS_PATH}?${s}` : STATS_PATH;
}

/* The full-ranking page for a stat over a period — ALL selected, no ?d=
 * (owner, 2026-09-25: one link under the two top fives). For the two
 * period stats the page is /records/day?m=YYYY-MM&day=N and
 * /records/week?m=YYYY-MM&w=N — those two categories of the records page
 * are another package's work (2026-09-25); this is the address they were
 * agreed to answer at. */
export function rankingsHref(key: string, periodKey: string, at?: { day?: number; w?: number }): string {
  const p = new URLSearchParams();
  p.set("m", periodKey);
  if (key === "day" && at?.day != null && at.day >= 1) p.set("day", String(at.day));
  if (key === "week" && at?.w != null && at.w >= 1) p.set("w", String(at.w));
  return `/row100k/records/${key}?${p.toString()}`;
}
