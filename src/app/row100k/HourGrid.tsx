import { Fragment } from "react";

/* When rows get LOGGED, hour by hour — a commit-graph grid: one row per
 * September day (up to today), 24 square hour columns, the heatmap's blue
 * ramp bucketed at 25/50/75% of the busiest hour. This reads createdAt, so
 * it is honest about being log time, not erg time; the page shifts it to
 * US-west wall clock before bucketing. Pure server markup, tooltips via
 * title. The whole grid fits the viewport — the owner wants to see all of
 * it without panning (2026-09-05) — so the day column is just the day
 * number under a SEP header and the cells are whatever 24 equal columns
 * leave, squares down to a 375px phone. */

const TICKS: Record<number, string> = { 0: "12A", 6: "6A", 12: "12P", 18: "6P" };

function hourLabel(h: number): string {
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "AM" : "PM"}`;
}

export function HourGrid({ grid }: { grid: number[][] }) {
  const max = Math.max(0, ...grid.map((row) => Math.max(...row, 0)));
  const bucket = (m: number): string => {
    if (m <= 0 || max <= 0) return "";
    if (m < max * 0.25) return " b1";
    if (m < max * 0.5) return " b2";
    if (m < max * 0.75) return " b3";
    return " b4";
  };

  return (
    <div className="hg-box">
      <div className="hg" role="img" aria-label="Meters logged per hour of day in September, Pacific time">
        <div className="hg-day">Sep</div>
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="hg-tick">
            {TICKS[h] ?? ""}
          </div>
        ))}
        {grid.map((row, di) => (
          <Fragment key={di}>
            <div className="hg-day">{di + 1}</div>
            {row.map((m, h) => (
              <div
                key={h}
                className={`hg-cell${bucket(m)}`}
                title={`SEP ${di + 1} — ${hourLabel(h)} — ${m.toLocaleString("en-US")} ${m === 1 ? "ROW" : "ROWS"}`}
              />
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
