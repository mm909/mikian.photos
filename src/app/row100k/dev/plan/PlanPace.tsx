"use client";

import { fmtMeters } from "@/lib/row100k";
import { clock, projectedAvg } from "./planMath";

/* WHERE THE PACE IS AND WHERE IT HAS TO GO (owner, 2026-09-24: "if I
 * enter a pace goal, show the chart of where my average pace is now and
 * where it needs to go"). The profile's PaceCurve draws the running
 * average over the meters rowed so far; this one draws the same line,
 * then carries it on from the last row to the target at the split the
 * rest has to be rowed at, so the curve bends onto the goal line at the
 * target. Same idiom as PaceCurve (Space Mono ticks, dotted rules, water
 * line, faster is UP); the projection is dashed, the goal dotted ink. */
export type AvgPoint = { m: number; s: number; day: string };

const W = 660;
const H = 220;
const L = 54;
const R = 16;
const T = 14;
const B = 28;

const abbr = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));
const MONO = "var(--row-mono), monospace";

export function PlanPace({
  pts,
  target,
  goal,
  need,
}: {
  /* the running average so far, in row order */
  pts: AvgPoint[];
  target: number;
  /* the goal, seconds per 500 m */
  goal: number;
  /* the split the rest must be rowed at (requiredSplit); null when the
   * time rowed already passes the goal, or the target is behind */
  need: number | null;
}) {
  const last = pts.length ? pts[pts.length - 1] : null;
  const rowedM = last ? last.m : 0;
  const rowedS = last ? last.s * (last.m / 500) : 0;
  const maxM = Math.max(target, rowedM, 1);

  /* The projection: the average as it settles onto the goal. Sampled, so
   * the 1/m curve reads as a curve and not a chord. */
  const proj: { m: number; s: number }[] = [];
  if (need !== null && need > 0 && rowedM < target) {
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const m = rowedM + ((target - rowedM) * i) / n;
      proj.push({ m, s: m > 0 ? projectedAvg(rowedM, rowedS, need, m) : need });
    }
  }

  const splits = [...pts.map((p) => p.s), ...proj.map((p) => p.s), goal];
  const lo = Math.min(...splits);
  const hi = Math.max(...splits);
  const pad = Math.max(3, (hi - lo) * 0.25);
  const yMin = Math.floor((lo - pad) / 5) * 5;
  const yMax = Math.ceil((hi + pad) / 5) * 5;

  const x = (m: number) => L + (m / maxM) * (W - L - R);
  const y = (s: number) => T + ((s - yMin) / (yMax - yMin)) * (H - T - B);

  const line = (arr: { m: number; s: number }[]) => arr.map((p, i) => `${i ? "L" : "M"}${x(p.m).toFixed(1)},${y(p.s).toFixed(1)}`).join("");

  const yTicks: number[] = [];
  const step = yMax - yMin > 40 ? 15 : yMax - yMin > 20 ? 10 : 5;
  for (let s = yMin; s <= yMax; s += step) yTicks.push(s);
  const xTicks = [0.25, 0.5, 0.75, 1].map((f) => Math.round(maxM * f));

  const label = last ? `now ${clock(last.s)} per 500 m over ${fmtMeters(last.m)}` : "no timed rows yet";

  return (
    <div className="st-kde pl-pace">
      <div className="t">Average split, now and where it has to go</div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Goal ${clock(goal)} per 500 m — ${label}`}>
        {yTicks.map((s) => (
          <g key={s}>
            <line x1={L} x2={W - R} y1={y(s)} y2={y(s)} stroke="var(--line)" strokeWidth="1" strokeDasharray="3 4" />
            <text x={L - 8} y={y(s) + 3} textAnchor="end" fontSize="10" fill="var(--gray)" fontFamily={MONO}>
              {clock(s).slice(0, -2)}
            </text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="var(--ink)" strokeWidth="2" />
        {xTicks.map((m) => (
          <text key={m} x={x(m)} y={H - 8} textAnchor={m === maxM ? "end" : "middle"} fontSize="10" fill="var(--gray)" fontFamily={MONO}>
            {abbr(m)}
          </text>
        ))}
        <text x={L} y={H - 8} textAnchor="start" fontSize="10" fill="var(--gray)" fontFamily={MONO}>
          0
        </text>

        {/* The goal: a dotted ink rule the whole way across. */}
        <line x1={L} x2={W - R} y1={y(goal)} y2={y(goal)} stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="2 4" />
        <text x={W - R} y={y(goal) - 5} textAnchor="end" fontSize="10" fontWeight="700" fill="var(--ink)" fontFamily={MONO}>
          GOAL {clock(goal)}
        </text>

        {/* Where it has to go: dashed water, from the last row to the target. */}
        {proj.length > 1 && <path d={line(proj)} fill="none" stroke="var(--water)" strokeWidth="2" strokeDasharray="6 5" strokeLinejoin="round" />}

        {/* Where it is: the running average so far. */}
        {pts.length > 1 && <path d={line(pts)} fill="none" stroke="var(--water)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {pts.map((p, i) => (
          <circle key={i} cx={x(p.m)} cy={y(p.s)} r={i === pts.length - 1 ? 4.5 : 2.2} fill="var(--water)" />
        ))}
        {last && (
          <text
            x={Math.min(Math.max(x(last.m), L + 40), W - R - 4)}
            y={y(last.s) + (last.s > goal ? 16 : -10)}
            textAnchor="end"
            fontSize="11"
            fontWeight="700"
            fill="var(--ink)"
            fontFamily={MONO}
          >
            NOW {clock(last.s)}
          </text>
        )}
      </svg>
      <div className="key">
        <span>
          <i /> Average so far
        </span>
        <span>
          <i className="next" /> If the rest is rowed at the split it takes
        </span>
        <span>
          <i className="goal" /> The goal
        </span>
      </div>
    </div>
  );
}
