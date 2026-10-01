import { fmtDay } from "@/lib/row100k";

/* THE YEAR (owner, 2026-10-01: "when we swap to all time the month
 * disappears on the stats page — instead make it just like the year: every
 * row is a month and every column is one of the days in the month"). The
 * month calendar's cells (Heatmap.tsx, .hm-cell and its ramp) laid out as
 * one row per month, oldest at the top, thirty-one columns across with the
 * month's word on the left. A day a short month does not have is a gap;
 * a day still to come in this month is the dimmed dashed cell the calendar
 * uses (.todo). No figure in a cell — at phone width a cell is ten pixels
 * — the title carries the day and its meters. Pure server markup. */

const COLS = 31;

function bucket(m: number, t: [number, number, number]): string {
  if (m <= 0) return "";
  if (m < t[0]) return " b1";
  if (m < t[1]) return " b2";
  if (m < t[2]) return " b3";
  return " b4";
}

export function YearGrid({
  months,
  byDay,
  thresholds,
}: {
  months: { key: string; label: string; short: string; days: number; elapsed: number }[];
  byDay: Record<string, number>;
  thresholds: [number, number, number];
}) {
  return (
    <div>
      <div className="yg" role="img" aria-label="Meters rowed per day, every month so far">
        <div className="yg-m" aria-hidden="true" />
        {Array.from({ length: COLS }, (_, i) => (
          <div className="yg-d" key={`d${i}`}>
            {/* Every fifth day and the first, so the row can be read. */}
            {i === 0 || (i + 1) % 5 === 0 ? i + 1 : ""}
          </div>
        ))}
        {months.map((mon) => (
          <div className="yg-row" key={mon.key}>
            <div className="yg-m">{mon.short}</div>
            {Array.from({ length: COLS }, (_, i) => {
              if (i >= mon.days) return <div className="yg-gap" key={`${mon.key}-${i}`} />;
              const day = `${mon.key}-${String(i + 1).padStart(2, "0")}`;
              const m = byDay[day] ?? 0;
              const todo = i >= mon.elapsed;
              return (
                <div
                  key={day}
                  className={`hm-cell${bucket(m, thresholds)}${todo ? " todo hm-todo" : ""}`}
                  title={todo ? fmtDay(day) : `${fmtDay(day)} — ${m.toLocaleString("en-US")} m`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="hm-legend">
        <span>Less</span>
        <i className="hm-cell" />
        <i className="hm-cell b1" />
        <i className="hm-cell b2" />
        <i className="hm-cell b3" />
        <i className="hm-cell b4" />
        <span>More</span>
      </div>
    </div>
  );
}
