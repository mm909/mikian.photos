"use client";

import type { ReactNode } from "react";
import { fmtDuration, fmtMeters } from "@/lib/row100k";
import {
  DISTANCES,
  DISTANCE_TOL,
  SORT_LABEL,
  nextView,
  summarizeLog,
  type LogSortKey,
  type LogView,
  type SortableRow,
} from "./logSort";

/* THE LOG CONTROLS (owner, 2026-09-10): the distance chips — ALL · 5K ·
 * 10K, each plus or minus DISTANCE_TOL meters — and the line under them
 * that says what the sift left: how many rows, their meters and time. (The
 * best-of-them callout came off the same evening — owner: "remove the best
 * call out under the selection buttons".) The sort lives in the column
 * heads (SortHeader) where the log is a table, and in a small mono row here
 * (sortChips) where it is the ledger of strips and has no heads. Shared by
 * the rower's own log (MyLog) and the visitor's (ProfileLog).
 *
 * Own style tag (theme.ts untouched): no double quotes, apostrophes, angle
 * brackets or ampersands in the string. */
const lgCss = `
.row100k .lg-bar{display:flex;align-items:center;justify-content:space-between;gap:10px 18px;flex-wrap:wrap;margin:0 0 14px}
.row100k .lg-chips{display:flex;gap:6px;flex-wrap:wrap}
.row100k .lg-chips button{appearance:none;-webkit-appearance:none;background:transparent;border:2px solid var(--ink);border-radius:0;color:var(--ink);font-family:var(--row-mono),monospace;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:5px 11px;margin:0;cursor:pointer}
.row100k .lg-chips button.on{background:var(--ink);color:var(--paper)}
.row100k .lg-chips button:hover:not(.on){border-color:var(--water);color:var(--water)}
.row100k .lg-sorts{display:flex;gap:14px;flex-wrap:wrap;font-family:var(--row-mono),monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--gray)}
.row100k .lg-sorts button{appearance:none;-webkit-appearance:none;background:none;border:none;border-bottom:2px solid transparent;border-radius:0;padding:0 0 2px;margin:0;font:inherit;letter-spacing:inherit;text-transform:inherit;color:var(--gray);cursor:pointer}
.row100k .lg-sorts button.on{color:var(--ink);border-bottom-color:var(--water);font-weight:700}
.row100k .lg-sorts button:hover:not(.on){color:var(--water)}
.row100k .lg-sum{font-family:var(--row-mono),monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gray);line-height:1.7;margin:0 0 14px}
.row100k .lg-sum b{color:var(--ink);font-weight:700}
.row100k table.board th.lg-th{padding:0}
.row100k .lg-th button{appearance:none;-webkit-appearance:none;display:block;width:100%;background:none;border:none;border-radius:0;padding:8px 6px;margin:0;font:inherit;letter-spacing:inherit;text-transform:inherit;color:inherit;text-align:left;cursor:pointer;white-space:nowrap}
.row100k .lg-th.right button{text-align:right}
.row100k .lg-th button:hover{color:var(--water)}
.row100k .lg-th.on button{color:var(--ink);font-weight:700}
`;

const ARROW = { asc: " ▲", desc: " ▼" } as const;

export function LogControls<T extends SortableRow>({
  rows,
  shown,
  view,
  onView,
  sortChips = false,
}: {
  /* Every row, and the rows the view kept — the summary counts the kept. */
  rows: T[];
  shown: T[];
  view: LogView;
  onView: (v: LogView) => void;
  /* Draw the sort row here (a list with no column heads). */
  sortChips?: boolean;
}) {
  const sum = summarizeLog(shown, view);
  const sifted = view.distance !== "all";
  return (
    <>
      <style>{lgCss}</style>
      <div className="lg-bar">
        <div className="lg-chips" role="group" aria-label="Distance">
          {DISTANCES.map((d) => (
            <button
              key={d.key}
              type="button"
              aria-pressed={view.distance === d.key}
              className={view.distance === d.key ? "on" : undefined}
              title={d.meters ? `${d.meters.toLocaleString("en-US")} m, give or take ${DISTANCE_TOL}` : "Every row"}
              onClick={() => onView({ ...view, distance: d.key })}
            >
              {d.label}
            </button>
          ))}
        </div>
        {sortChips && (
          <div className="lg-sorts" role="group" aria-label="Sort">
            <span>Sort</span>
            {(Object.keys(SORT_LABEL) as LogSortKey[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={view.sort === k}
                className={view.sort === k ? "on" : undefined}
                onClick={() => onView(nextView(view, k))}
              >
                {SORT_LABEL[k]}
                {view.sort === k ? ARROW[view.dir] : ""}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="lg-sum">
        <b>{sum.count}</b> {sum.count === 1 ? "row" : "rows"}
        {rows.length !== shown.length ? ` of ${rows.length}` : ""}
        {sum.meters > 0 ? (
          <>
            {" · "}
            <b>{fmtMeters(sum.meters)}</b> · {fmtDuration(sum.seconds)}
          </>
        ) : null}
        {sifted && sum.count === 0 ? " · nothing at that distance yet" : ""}
      </p>
    </>
  );
}

/* A column head that sorts: press once for the natural order, again to
 * flip. aria-sort says which way; the arrow shows it. */
export function SortHeader({
  k,
  view,
  onView,
  right = false,
  children,
}: {
  k: LogSortKey;
  view: LogView;
  onView: (v: LogView) => void;
  right?: boolean;
  children: ReactNode;
}) {
  const on = view.sort === k;
  return (
    <th
      className={`lg-th${right ? " right" : ""}${on ? " on" : ""}`}
      aria-sort={on ? (view.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button type="button" onClick={() => onView(nextView(view, k))}>
        {children}
        {on ? ARROW[view.dir] : ""}
      </button>
    </th>
  );
}
