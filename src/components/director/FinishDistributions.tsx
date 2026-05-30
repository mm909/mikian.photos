"use client";

import { useRef, useState } from "react";
import { AXIS_MIN, AXIS_MAX, finishCurves, fmtMinutes } from "@/lib/directorStats";

/**
 * FinishDistributions — three finish-time density curves (5K / 10K / Half)
 * on one shared time axis. The Half is the real 2026 field (kernel density of
 * the actual roster); 5K and 10K are representative. Each curve is normalized
 * to its own peak so the *shapes* compare cleanly. Hover to scrub the clock.
 */

const W = 600;
const H = 230;
const PAD_L = 10;
const PAD_R = 10;
const PAD_T = 16;
const PAD_B = 30;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

function xForMin(min: number): number {
  return PAD_L + ((min - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * PLOT_W;
}

function curvePath(samples: { min: number; density: number }[], peak: number, close: boolean): string {
  const pts = samples.map((s) => {
    const x = xForMin(s.min);
    const y = PAD_T + PLOT_H - (s.density / peak) * PLOT_H;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  let d = "M " + pts.join(" L ");
  if (close) {
    const x0 = xForMin(samples[0].min);
    const x1 = xForMin(samples[samples.length - 1].min);
    d += ` L ${x1.toFixed(1)} ${(PAD_T + PLOT_H).toFixed(1)} L ${x0.toFixed(1)} ${(PAD_T + PLOT_H).toFixed(1)} Z`;
  }
  return d;
}

const AXIS_TICKS = [30, 60, 90, 120, 150, 180];

export function FinishDistributions() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [hoverMin, setHoverMin] = useState<number | null>(null);

  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHoverMin(AXIS_MIN + frac * (AXIS_MAX - AXIS_MIN));
  }

  const peaks = finishCurves.map((c) => Math.max(...c.samples.map((s) => s.density)));

  return (
    <div className="card" style={{ padding: 20, background: "var(--surface)", border: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)" }}>
          Finish times by distance
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: hoverMin == null ? "var(--muted)" : "var(--accent)" }}>
          {hoverMin == null ? "Hover to scrub" : fmtMinutes(hoverMin)}
        </div>
      </div>

      <div ref={ref} style={{ position: "relative" }} onMouseMove={onMove} onMouseLeave={() => setHoverMin(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
          {/* curves (drawn back-to-front: largest spread first) */}
          {finishCurves.map((c, i) => (
            <g key={c.key}>
              <path d={curvePath(c.samples, peaks[i], true)} fill={c.color} opacity={0.1} />
              <path d={curvePath(c.samples, peaks[i], false)} fill="none" stroke={c.color} strokeWidth={2} strokeLinejoin="round" />
              {/* median tick */}
              <line x1={xForMin(c.medianMin)} x2={xForMin(c.medianMin)} y1={PAD_T + PLOT_H} y2={PAD_T + PLOT_H - 12} stroke={c.color} strokeWidth={1.5} />
              <circle cx={xForMin(c.medianMin)} cy={PAD_T + PLOT_H - 12} r={2.5} fill={c.color} />
            </g>
          ))}

          {/* hover guide */}
          {hoverMin != null && (
            <line x1={xForMin(hoverMin)} x2={xForMin(hoverMin)} y1={PAD_T} y2={PAD_T + PLOT_H} stroke="var(--ink)" strokeWidth={1} strokeDasharray="3 3" opacity={0.4} />
          )}

          {/* x axis */}
          <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + PLOT_H} y2={PAD_T + PLOT_H} stroke="var(--line)" />
          {AXIS_TICKS.map((t) => (
            <g key={t}>
              <line x1={xForMin(t)} x2={xForMin(t)} y1={PAD_T + PLOT_H} y2={PAD_T + PLOT_H + 4} stroke="var(--line)" />
              <text x={xForMin(t)} y={PAD_T + PLOT_H + 16} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={9} letterSpacing="0.06em" fill="var(--muted)">
                {fmtMinutes(t)}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 8 }}>
        {finishCurves.map((c) => (
          <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color, display: "inline-block" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".06em", color: "var(--ink)" }}>
              {c.label}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: ".04em", color: "var(--muted)" }}>
              {c.finishers} finishers · median {fmtMinutes(c.medianMin)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
