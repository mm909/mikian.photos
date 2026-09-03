"use client";

import { useState } from "react";
import { fmtDay, fmtMeters } from "@/lib/row100k";
import { Curve } from "./Curve";
import { Heatmap } from "./Heatmap";
import { StatsShare, type CommunityShare } from "./StatsShare";

/* "The month" block on the stats page: the community calendar, then one
 * chart slot the reader flips between CUMULATIVE (the existing Curve) and
 * DAILY (per-day bars, same axis language). One SHARE A CARD button under
 * the calendar (owner call, cycle 13 — the chart button is gone); the
 * dialog's picker still reaches every community card. */

export function MonthSection({
  byDay,
  thresholds,
  daily,
  community,
  hourGrid,
}: {
  byDay: Record<string, number>;
  thresholds: [number, number, number];
  daily: { day: string; cum: number }[];
  community: { meters: number; rowers: number; sessions: number };
  hourGrid?: number[][];
}) {
  const [view, setView] = useState<"cum" | "daily">("cum");

  const share: CommunityShare = {
    meters: community.meters,
    rowers: community.rowers,
    sessions: community.sessions,
    byDay,
    daily,
    hourGrid,
  };

  return (
    <div>
      <Heatmap byDay={byDay} thresholds={thresholds} />
      <StatsShare community={share} prefer="rowtember-community-month" />

      <div style={{ marginTop: 14 }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button
            type="button"
            className={view === "cum" ? "on" : ""}
            aria-pressed={view === "cum"}
            onClick={() => setView("cum")}
          >
            CUMULATIVE
          </button>
          <button
            type="button"
            className={view === "daily" ? "on" : ""}
            aria-pressed={view === "daily"}
            onClick={() => setView("daily")}
          >
            DAILY
          </button>
        </div>
        {view === "cum" ? (
          <Curve daily={daily} title="The curve — cumulative meters, everyone combined" />
        ) : (
          <DailyBars byDay={byDay} />
        )}
      </div>
    </div>
  );
}

/* Per-day community meters as bars — the Curve's frame, gridlines and mono
 * labels, with title-element tooltips instead of a hover readout. */
function DailyBars({ byDay }: { byDay: Record<string, number> }) {
  const W = 660;
  const H = 250;
  const L = 56;
  const R = 16;
  const T = 14;
  const B = 30;

  const vals = Array.from(
    { length: 30 },
    (_, i) => byDay[`2026-09-${String(i + 1).padStart(2, "0")}`] ?? 0,
  );
  /* Nothing logged (pre-Sep-1, or the boardData failure fallback): render
   * nothing, mirroring Curve's own <2-points guard — never a frame whose
   * axis labels would be fractions of a meter. */
  if (!vals.some((v) => v > 0)) return null;
  const max = Math.max(...vals, 1000);
  const niceMax = (() => {
    const pow = Math.pow(10, Math.floor(Math.log10(max)));
    for (const m of [1, 2, 2.5, 5, 10]) if (max <= m * pow) return m * pow;
    return 10 * pow;
  })();
  const abbr = (n: number) =>
    n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);

  const slot = (W - L - R) / 30;
  const barW = slot * 0.62;
  const xc = (i: number) => L + i * slot + slot / 2;
  const y = (v: number) => T + (1 - v / niceMax) * (H - T - B);
  const biggestIdx = vals.indexOf(Math.max(...vals));

  return (
    <div className="curve">
      <div className="t">Day by day — meters, everyone combined</div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Meters per day, everyone combined">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(niceMax * f)} y2={y(niceMax * f)} stroke="#dddbd2" strokeWidth="1" strokeDasharray={f === 1 ? undefined : "3 4"} />
            <text x={L - 8} y={y(niceMax * f) + 3} textAnchor="end" fontSize="10" fill="#8a8a85" fontFamily="var(--row-mono), monospace">
              {abbr(niceMax * f)}
            </text>
          </g>
        ))}
        {vals.map((v, i) => {
          if (v <= 0) return null;
          /* Floor at 2px so a small logged day never vanishes under the axis. */
          const h = Math.max(y(0) - y(v), 2);
          return (
            <rect key={i} x={xc(i) - barW / 2} y={y(0) - h} width={barW} height={h} fill="#0077B6">
              <title>{`${fmtDay(`2026-09-${String(i + 1).padStart(2, "0")}`)} · ${fmtMeters(v)}`}</title>
            </rect>
          );
        })}
        {vals[biggestIdx] > 0 && (
          <text x={xc(biggestIdx)} y={Math.max(y(vals[biggestIdx]) - 5, 10)} textAnchor="middle" fontSize="11" fontWeight="700" fill="#15171a" fontFamily="var(--row-mono), monospace">
            {abbr(vals[biggestIdx])}
          </text>
        )}
        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="#15171a" strokeWidth="2" />
        {[1, 10, 20, 30].map((d) => (
          <text key={d} x={xc(d - 1)} y={H - 8} textAnchor="middle" fontSize="10" fill="#8a8a85" fontFamily="var(--row-mono), monospace">
            {d === 1 ? "SEP 1" : d}
          </text>
        ))}
      </svg>
    </div>
  );
}
