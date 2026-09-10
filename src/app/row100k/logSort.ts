import { splitSeconds } from "@/lib/row100k";

/* THE LOG, sorted and sifted (owner, 2026-09-10: "a table of all my rows
 * where I can sort by length / time / pace / date, and filter to 5ks, 10ks
 * with some tolerance, plus or minus 50 meters — combine it with the log").
 *
 * Pure helpers, client-safe, shared by the rower's own ledger (MyLog) and
 * the visitor's log (ProfileLog): one LogView — a sort key, a direction and
 * a distance — and the functions that apply it. Rows come in newest-first
 * from the page; the day sort keeps that order inside a day (a stable sort
 * over the given order), so DATE ▼ is exactly the log as it always was. */

export type LogSortKey = "day" | "meters" | "seconds" | "split";
export type LogSortDir = "asc" | "desc";
export type LogDistance = "all" | "5k" | "10k";

export type LogView = { sort: LogSortKey; dir: LogSortDir; distance: LogDistance };

export const DEFAULT_LOG_VIEW: LogView = { sort: "day", dir: "desc", distance: "all" };

/* The distances a rower tests over: the record boards' two, 5k and 10k
 * (owner, 2026-09-10: the 2k and the half came off the same day). Plus or
 * minus DISTANCE_TOL meters counts (owner: "some tolerance") — a 5,030 m
 * piece is a 5k. */
export const DISTANCE_TOL = 50;
export const DISTANCES: { key: LogDistance; label: string; meters: number | null }[] = [
  { key: "all", label: "All", meters: null },
  { key: "5k", label: "5k", meters: 5000 },
  { key: "10k", label: "10k", meters: 10000 },
];

export const SORT_LABEL: Record<LogSortKey, string> = {
  day: "Date",
  meters: "Meters",
  seconds: "Time",
  split: "/500m",
};

/* What a column sorts by on its first press: newest, longest, longest and
 * FASTEST first — a split is the one number where small is good. */
export function defaultDir(key: LogSortKey): LogSortDir {
  return key === "split" ? "asc" : "desc";
}

/* Pressing a column: the same column flips the direction, a new column
 * starts on its natural side. */
export function nextView(view: LogView, key: LogSortKey): LogView {
  if (view.sort === key) return { ...view, dir: view.dir === "asc" ? "desc" : "asc" };
  return { ...view, sort: key, dir: defaultDir(key) };
}

export type SortableRow = { day: string; meters?: number; seconds?: number };

export function distanceMeters(d: LogDistance): number | null {
  return DISTANCES.find((x) => x.key === d)?.meters ?? null;
}

/* A row counts as a 5k when its meters land within the tolerance of 5,000.
 * A row without meters (a hidden rower's, on a visitor's page) never
 * matches a distance — only ALL lists it. */
export function matchesDistance(row: SortableRow, d: LogDistance): boolean {
  const target = distanceMeters(d);
  if (target === null) return true;
  if (row.meters === undefined) return false;
  return Math.abs(row.meters - target) <= DISTANCE_TOL;
}

function keyOf(row: SortableRow, key: LogSortKey): number | string | null {
  if (key === "day") return row.day;
  if (row.meters === undefined || row.seconds === undefined) return null;
  if (key === "meters") return row.meters;
  if (key === "seconds") return row.seconds;
  return row.meters > 0 ? splitSeconds(row.meters, row.seconds) : null;
}

/* Filter, then a stable sort. Rows without the number being sorted on (a
 * hidden rower's rows) sink to the bottom whichever way the sort runs. */
export function applyLogView<T extends SortableRow>(rows: T[], view: LogView): T[] {
  const kept = rows.filter((r) => matchesDistance(r, view.distance));
  const sign = view.dir === "asc" ? 1 : -1;
  return kept
    .map((row, i) => ({ row, i, k: keyOf(row, view.sort) }))
    .sort((a, b) => {
      if (a.k === null && b.k === null) return a.i - b.i;
      if (a.k === null) return 1;
      if (b.k === null) return -1;
      if (a.k < b.k) return -1 * sign;
      if (a.k > b.k) return 1 * sign;
      return a.i - b.i;
    })
    .map((x) => x.row);
}

/* The line under the controls: how many rows, their meters, and the best
 * one — the fastest TIME under a distance (that is what a 5k list is for),
 * the fastest SPLIT under ALL. Rows without numbers count but never win. */
export type LogSummary<T> = { count: number; meters: number; seconds: number; best: T | null; bestIs: "time" | "split" };

export function summarizeLog<T extends SortableRow>(rows: T[], view: LogView): LogSummary<T> {
  let meters = 0;
  let seconds = 0;
  let best: T | null = null;
  let bestVal = Infinity;
  const byTime = distanceMeters(view.distance) !== null;
  for (const r of rows) {
    if (r.meters === undefined || r.seconds === undefined) continue;
    meters += r.meters;
    seconds += r.seconds;
    const v = byTime ? r.seconds : r.meters > 0 ? splitSeconds(r.meters, r.seconds) : Infinity;
    if (v < bestVal) {
      bestVal = v;
      best = r;
    }
  }
  return { count: rows.length, meters, seconds, best, bestIs: byTime ? "time" : "split" };
}
