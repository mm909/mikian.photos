/* THE STATS PAGE'S ADDRESS, one way to spell it (owner, 2026-09-25: every
 * pick on the page swaps in place, but "links still work on reload" — so
 * the client writes the same URL the server reads, with replaceState, and
 * every soft line keeps it as a real href for a middle click).
 *
 *   ?m=YYYY-MM | all   the period; absent for this month
 *   ?s=<record key>    the stat; absent for TOTAL METERS
 *   ?day=N             the day board open on day N (1-based)
 *   ?w=N               the week board open on week N (1-based)
 *
 * Plain functions, no imports: shared by the server page, the client shell
 * and the API route. */

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
 * (owner, 2026-09-25: one link above the two top fives). */
export function rankingsHref(key: string, periodKey: string): string {
  return `/row100k/records/${key}?m=${encodeURIComponent(periodKey)}`;
}
