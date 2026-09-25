import { fmtDay, MONTH_DAYS, MONTH_FIRST_DOW, MONTH_KEY } from "@/lib/row100k";

/* September as a GitHub-style intensity calendar: one cell per day, shaded
 * by meters rowed. Pure server markup — tooltips via title. The default
 * thresholds suit one rower; pass explicit ones for community-scale totals
 * (the stats page derives them from the biggest day on record). */
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

const ONE_ROWER: [number, number, number] = [2500, 5000, 10000];

function bucket(m: number, t: [number, number, number]): string {
  if (m <= 0) return "";
  if (m < t[0]) return " b1";
  if (m < t[1]) return " b2";
  if (m < t[2]) return " b3";
  return " b4";
}

export function Heatmap({
  byDay,
  thresholds = ONE_ROWER,
  days = MONTH_DAYS,
  month,
  fullMonth = false,
}: {
  byDay: Record<string, number>;
  /* Which month to draw (rowPeriod.ts); this one when absent. */
  month?: { key: string; firstDow: number; days: number };
  thresholds?: [number, number, number];
  /* Draw only this many September days — the month stops at today rather
   * than trailing a fortnight of empty cells (owner call, day 4). */
  days?: number;
  /* Draw EVERY day of the month (owner, 2026-09-25, of the profile: "give
   * THE MONTH calendar all its boxes back for the whole month"): the days
   * past `days` are still drawn, as empty dashed cells wearing .hm-todo,
   * so the grid is the month's shape from the first day. Off by default —
   * the stats page still stops at today. */
  fullMonth?: boolean;
}) {
  const mon = month ?? { key: MONTH_KEY, firstDow: MONTH_FIRST_DOW, days: MONTH_DAYS };
  const elapsed = Math.min(mon.days, Math.max(1, days));
  const shown = fullMonth ? mon.days : elapsed;
  // Leading blanks align day 1 under its weekday (rowPeriod.ts).
  const firstDow = mon.firstDow;

  return (
    <div>
      <div className="hm" role="img" aria-label="Meters rowed per day this month">
        {DOW.map((d, i) => (
          <div className="dow" key={`${d}${i}`}>
            {d}
          </div>
        ))}
        {Array.from({ length: firstDow }, (_, i) => (
          <div key={`blank${i}`} />
        ))}
        {Array.from({ length: shown }, (_, i) => {
          const day = `${mon.key}-${String(i + 1).padStart(2, "0")}`;
          const m = byDay[day] ?? 0;
          const b = bucket(m, thresholds);
          // A day still to come: no figure to name in the title, and a
          // class the profile sheet dims.
          const todo = i >= elapsed;
          return (
            <div
              key={day}
              className={`hm-cell${b}${todo ? " hm-todo" : ""}`}
              style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
              title={todo ? fmtDay(day) : `${fmtDay(day)} — ${m.toLocaleString("en-US")} m`}
            >
              {m > 0 && (
                /* Sizing + the ink-vs-white contrast rule live on .hm-num
                 * in theme.ts, so the calendar and the profiles share it. */
                <span aria-hidden="true" className="hm-num">
                  {`${Math.max(1, Math.round(m / 1000))}k`}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="hm-legend">
        <span>Less</span>
        {/* The cells' own classes, so the ramp (and the ink look's ramp)
         * is written once, in theme.ts. */}
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
