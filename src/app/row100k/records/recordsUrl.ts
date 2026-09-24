/* THE RECORDS PAGE'S ADDRESS, one way to spell it (owner, 2026-09-25: "why
 * is there a loading page between each click (category, bracket, month)?
 * There shouldn't be" — every pick swaps in place, so the client writes
 * the same URL the server reads, with replaceState, and every soft line
 * keeps it as a real href for a middle click; a reload lands on the same
 * view).
 *
 *   /row100k/records/<key>   the record; TOTAL METERS is "total"
 *   ?d=m | f                 the bracket; absent for All
 *   ?m=YYYY-MM | all         the period; absent for this month
 *
 * Plain functions, no imports: shared by the server page, the client shell
 * and the API route (the stats page's statsUrl.ts is the model). */

export const RECORDS_PATH = "/row100k/records";

export type RecordsQuery = {
  key: string;
  /* "all" | "m" | "f" — nothing in the URL for "all". */
  d?: string;
  /* The period key; the page's own month when equal to `currentMonthKey`. */
  m?: string;
};

export function recordsHref(q: RecordsQuery, currentMonthKey: string): string {
  const p = new URLSearchParams();
  if (q.d && q.d !== "all") p.set("d", q.d);
  if (q.m && q.m !== currentMonthKey) p.set("m", q.m);
  const s = p.toString();
  return s ? `${RECORDS_PATH}/${q.key}?${s}` : `${RECORDS_PATH}/${q.key}`;
}
