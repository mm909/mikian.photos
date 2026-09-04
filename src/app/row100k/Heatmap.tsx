import { fmtDay } from "@/lib/row100k";

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
  days = 30,
}: {
  byDay: Record<string, number>;
  thresholds?: [number, number, number];
  /* Draw only this many September days — the month stops at today rather
   * than trailing a fortnight of empty cells (owner call, day 4). */
  days?: number;
}) {
  const shown = Math.min(30, Math.max(1, days));
  // Sep 1, 2026 — leading blanks align day 1 under its weekday.
  const firstDow = new Date(Date.UTC(2026, 8, 1)).getUTCDay();

  return (
    <div>
      <div className="hm" role="img" aria-label="Meters rowed per day in September">
        {DOW.map((d, i) => (
          <div className="dow" key={`${d}${i}`}>
            {d}
          </div>
        ))}
        {Array.from({ length: firstDow }, (_, i) => (
          <div key={`blank${i}`} />
        ))}
        {Array.from({ length: shown }, (_, i) => {
          const day = `2026-09-${String(i + 1).padStart(2, "0")}`;
          const m = byDay[day] ?? 0;
          const b = bucket(m, thresholds);
          return (
            <div
              key={day}
              className={`hm-cell${b}`}
              style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
              title={`${fmtDay(day)} — ${m.toLocaleString("en-US")} m`}
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
        <i style={{ border: "1px dashed var(--line)" }} />
        <i style={{ background: "#d9e8f2" }} />
        <i style={{ background: "#a5cde3" }} />
        <i style={{ background: "#4d9fc9" }} />
        <i style={{ background: "var(--water)" }} />
        <span>More</span>
      </div>
    </div>
  );
}
