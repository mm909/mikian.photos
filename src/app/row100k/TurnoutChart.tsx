import { dayTicks, fmtDay } from "@/lib/row100k";

/* Turnout: how many different rowers logged at least one row, per September
 * day — the Curve's frame and mono labels as a bar chart. Pure server
 * markup: tooltips via SVG title, the biggest and most recent days wear
 * their counts. */
export function TurnoutChart({ counts, days = 30 }: { counts: number[]; days?: number }) {
  /* Only the days that have happened — the chart grows with the month. */
  const span = Math.min(30, Math.max(1, days));
  const shown = counts.slice(0, span);
  const W = 660;
  const H = 250;
  const L = 56;
  const R = 16;
  const T = 14;
  const B = 30;

  const max = Math.max(...shown, 0);
  /* Rounded up to a multiple of 4 so every quarter-gridline label is a
   * distinct integer. */
  const niceMax = Math.max(4, Math.ceil(max / 4) * 4);
  const slot = (W - L - R) / span;
  const barW = slot * 0.62;
  const xc = (i: number) => L + i * slot + slot / 2;
  const y = (v: number) => T + (1 - v / niceMax) * (H - T - B);

  const biggestIdx = max > 0 ? shown.indexOf(max) : -1;
  let latestIdx = -1;
  for (let i = shown.length - 1; i >= 0; i--) {
    if (shown[i] > 0) {
      latestIdx = i;
      break;
    }
  }
  const labeled = [biggestIdx, latestIdx].filter((i, pos, arr) => i >= 0 && arr.indexOf(i) === pos);

  return (
    <div className="curve">
      <div className="t">Rowers with a logged row, per day</div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Unique rowers logging per day in September">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(niceMax * f)} y2={y(niceMax * f)} stroke="#dddbd2" strokeWidth="1" strokeDasharray={f === 1 ? undefined : "3 4"} />
            <text x={L - 8} y={y(niceMax * f) + 3} textAnchor="end" fontSize="10" fill="#8a8a85" fontFamily="var(--row-mono), monospace">
              {niceMax * f}
            </text>
          </g>
        ))}
        {shown.map((v, i) =>
          v > 0 ? (
            <rect key={i} x={xc(i) - barW / 2} y={y(v)} width={barW} height={y(0) - y(v)} fill="#0077B6">
              <title>{`${fmtDay(`2026-09-${String(i + 1).padStart(2, "0")}`)} · ${v} rower${v === 1 ? "" : "s"}`}</title>
            </rect>
          ) : null,
        )}
        {labeled.map((i) => (
          <text key={i} x={xc(i)} y={Math.max(y(shown[i]) - 5, 10)} textAnchor="middle" fontSize="11" fontWeight="700" fill="#15171a" fontFamily="var(--row-mono), monospace">
            {shown[i]}
          </text>
        ))}
        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="#15171a" strokeWidth="2" />
        {dayTicks(span).map((d) => (
          <text key={d} x={xc(d - 1)} y={H - 8} textAnchor="middle" fontSize="10" fill="#8a8a85" fontFamily="var(--row-mono), monospace">
            {d === 1 ? "SEP 1" : d}
          </text>
        ))}
      </svg>
    </div>
  );
}
