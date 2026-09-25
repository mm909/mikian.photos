/* THE RECORDS PAGE'S ADDRESS, one way to spell it (owner, 2026-09-25: "why
 * is there a loading page between each click (category, bracket, month)?
 * There shouldn't be" — every pick swaps in place, so the client writes
 * the same URL the server reads, with replaceState, and every soft line
 * keeps it as a real href for a middle click; a reload lands on the same
 * view).
 *
 *   /row100k/records/<key>   the record; TOTAL METERS is "total"; the two
 *                            period boards are "day" and "week"
 *   ?d=m | f                 the bracket; absent for All
 *   ?m=YYYY-MM | all         the period; absent for this month
 *   ?day=N                   the day board open on day N (1-based)
 *   ?w=N                     the week board open on week N (1-based)
 *
 * The last two are the stats page's own spelling (stats/statsUrl.ts), so a
 * day carries from one page to the other unchanged (owner, 2026-09-25:
 * "the same day and week picker as the stats page"). Plain functions, no
 * imports: shared by the server page, the client shell and the API route. */

export const RECORDS_PATH = "/row100k/records";

export type RecordsQuery = {
  key: string;
  /* "all" | "m" | "f" — nothing in the URL for "all". */
  d?: string;
  /* The period key; the page's own month when equal to `currentMonthKey`. */
  m?: string;
  /* A picked day / week (1-based); left out when the board is on its
   * default (today, or a past month's last). */
  day?: number;
  w?: number;
};

export function recordsHref(q: RecordsQuery, currentMonthKey: string): string {
  const p = new URLSearchParams();
  if (q.d && q.d !== "all") p.set("d", q.d);
  if (q.m && q.m !== currentMonthKey) p.set("m", q.m);
  if (q.day != null && q.day >= 1) p.set("day", String(q.day));
  if (q.w != null && q.w >= 1) p.set("w", String(q.w));
  const s = p.toString();
  return s ? `${RECORDS_PATH}/${q.key}?${s}` : `${RECORDS_PATH}/${q.key}`;
}
