import { fmtDay } from "@/lib/row100k";

/* September as a GitHub-style intensity calendar: one cell per day, shaded
 * by meters rowed. Pure server markup — tooltips via title. */
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

function bucket(m: number): string {
  if (m <= 0) return "";
  if (m < 2500) return " b1";
  if (m < 5000) return " b2";
  if (m < 10000) return " b3";
  return " b4";
}

export function Heatmap({ byDay }: { byDay: Record<string, number> }) {
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
        {Array.from({ length: 30 }, (_, i) => {
          const day = `2026-09-${String(i + 1).padStart(2, "0")}`;
          const m = byDay[day] ?? 0;
          return (
            <div
              key={day}
              className={`hm-cell${bucket(m)}`}
              title={`${fmtDay(day)} — ${m.toLocaleString("en-US")} m`}
            />
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
