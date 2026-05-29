"use client";

import { useMemo } from "react";
import { LIGHTHOUSE_RACERS } from "@/lib/lighthouseRoster";

/**
 * Finish-time distribution for the Lighthouse Half Marathon.
 * Plain SVG histogram with a smoothed line on top. Median + winner callouts.
 * No external charting deps.
 */
export function FinishTimeChart() {
  // Half-marathon only — the roster now also holds 5K/10K finishers whose
  // much shorter times would otherwise distort this single-distance histogram.
  const halfRacers = useMemo(
    () => LIGHTHOUSE_RACERS.filter((r) => r.distance === "half"),
    []
  );
  const data = useMemo(() => buildBins(halfRacers.map((r) => r.chipMinutes)), [halfRacers]);
  if (data.bins.length === 0) return null;

  const W = 320;
  const H = 120;
  const padL = 8;
  const padR = 8;
  const padT = 12;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxCount = Math.max(...data.bins.map((b) => b.count));
  const barW = plotW / data.bins.length;

  // Build a smooth line over the bin centers using a simple moving-average for shape.
  const smoothed = data.bins.map((_, i) => {
    const lo = Math.max(0, i - 1);
    const hi = Math.min(data.bins.length - 1, i + 1);
    const avg = (data.bins[lo].count + data.bins[i].count + data.bins[hi].count) / (hi - lo + 1);
    return avg;
  });

  const winner = halfRacers.reduce(
    (best, r) => (r.chipMinutes < best.chipMinutes ? r : best),
    halfRacers[0]
  );

  function xForMinutes(m: number): number {
    return padL + ((m - data.min) / (data.max - data.min)) * plotW;
  }

  const medianX = xForMinutes(data.median);
  const winnerX = xForMinutes(winner.chipMinutes);

  return (
    <div
      className="card"
      style={{
        padding: 18,
        background: "var(--surface)",
        border: "1px solid var(--line)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          Finish times — {halfRacers.length} runners
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          Median {fmt(data.median)}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }}>
        {/* Histogram bars */}
        {data.bins.map((b, i) => {
          const h = (b.count / maxCount) * plotH;
          const x = padL + i * barW;
          const y = padT + plotH - h;
          return (
            <rect
              key={i}
              x={x + 0.5}
              y={y}
              width={Math.max(1, barW - 1)}
              height={h}
              fill="var(--cream)"
              stroke="var(--line)"
              strokeWidth={1}
            />
          );
        })}

        {/* Smoothed density line */}
        <path
          d={`M ${data.bins
            .map((b, i) => {
              const x = padL + i * barW + barW / 2;
              const y = padT + plotH - (smoothed[i] / maxCount) * plotH;
              return `${x.toFixed(1)} ${y.toFixed(1)}`;
            })
            .join(" L ")}`}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* Winner marker */}
        <line
          x1={winnerX}
          x2={winnerX}
          y1={padT}
          y2={padT + plotH}
          stroke="var(--accent)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <circle cx={winnerX} cy={padT} r={3} fill="var(--accent)" />

        {/* Median marker */}
        <line
          x1={medianX}
          x2={medianX}
          y1={padT}
          y2={padT + plotH}
          stroke="var(--ink)"
          strokeWidth={1}
          strokeDasharray="2 4"
          opacity={0.35}
        />

        {/* X-axis ticks */}
        {axisTicks(data.min, data.max).map((t, i) => {
          const x = xForMinutes(t);
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={padT + plotH} y2={padT + plotH + 3} stroke="var(--line)" />
              <text
                x={x}
                y={padT + plotH + 14}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize={9}
                letterSpacing="0.08em"
                fill="var(--muted)"
              >
                {fmt(t)}
              </text>
            </g>
          );
        })}
      </svg>

      <div
        style={{
          marginTop: 6,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        <span style={{ color: "var(--accent)" }}>● Winner</span> {winner.name} ·{" "}
        {winner.chipTime}
      </div>
    </div>
  );
}

function buildBins(values: number[]) {
  if (values.length === 0) return { bins: [], min: 0, max: 0, median: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const min = Math.floor(sorted[0] / 5) * 5;
  const max = Math.ceil(sorted[sorted.length - 1] / 5) * 5;
  const binSize = 5; // 5-minute buckets
  const binCount = Math.max(1, Math.ceil((max - min) / binSize));
  const bins = Array.from({ length: binCount }, (_, i) => ({
    start: min + i * binSize,
    end: min + (i + 1) * binSize,
    count: 0,
  }));
  for (const v of values) {
    const idx = Math.min(binCount - 1, Math.floor((v - min) / binSize));
    bins[idx].count++;
  }
  const median = sorted[Math.floor(sorted.length / 2)];
  return { bins, min, max, median };
}

function fmt(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  if (h === 0) return `${m}m`;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function axisTicks(min: number, max: number): number[] {
  const span = max - min;
  const step = span > 120 ? 30 : span > 60 ? 20 : 15;
  const out: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max; t += step) out.push(t);
  return out;
}
