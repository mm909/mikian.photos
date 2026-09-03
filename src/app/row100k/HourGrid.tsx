import { Fragment } from "react";

/* When rows get LOGGED, hour by hour — a commit-graph grid: one row per
 * September day (up to today), 24 hour columns, the heatmap's blue ramp
 * bucketed at 25/50/75% of the busiest hour. This reads createdAt, so it's
 * honest about being log time, not erg time; the page shifts it to US-west
 * wall clock before bucketing. Pure server markup, tooltips via title;
 * .hg-scroll pans horizontally on phones. */

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
    <div className="hg-scroll">
      <div className="hg" role="img" aria-label="Meters logged per hour of day in September, Pacific time">
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="hg-tick">
            {TICKS[h] ?? ""}
          </div>
        ))}
        {grid.map((row, di) => (
          <Fragment key={di}>
            <div className="hg-day">SEP {di + 1}</div>
            {row.map((m, h) => (
              <div
                key={h}
                className={`hg-cell${bucket(m)}`}
                title={`SEP ${di + 1} — ${hourLabel(h)} — ${m.toLocaleString("en-US")} M`}
              />
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
