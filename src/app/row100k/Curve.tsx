"use client";

import { useMemo, useState } from "react";
import { fmtDay, fmtMeters } from "@/lib/row100k";

/* Cumulative meters as a poster-styled SVG line with a nearest-day hover
 * readout. Single series — the title names it, no legend. Used twice: the
 * community curve on the board, and the personal curve in the dashboard
 * (which adds `goal` — a dashed reference line from 0 on Sep 1 to the goal
 * on Sep 30, i.e. the pace that finishes exactly on time). */
export function Curve({
  daily,
  title,
  goal,
}: {
  daily: { day: string; cum: number }[];
  title: string;
  goal?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 660;
  const H = 250;
  const L = 56;
  const R = 16;
  const T = 14;
  const B = 30;

  const pts = useMemo(() => {
    const raw = daily.map((d) => ({ dayNum: Number(d.day.slice(8, 10)), ...d }));
    if (raw.length && raw[0].dayNum > 1) {
      raw.unshift({ dayNum: raw[0].dayNum - 1, day: "", cum: 0 });
    }
    return raw;
  }, [daily]);

  if (pts.length < 2) return null;

  const maxCum = Math.max(pts[pts.length - 1].cum, goal ?? 0);
  const niceMax = (() => {
    const pow = Math.pow(10, Math.floor(Math.log10(maxCum)));
    for (const m of [1, 2, 2.5, 5, 10]) if (maxCum <= m * pow) return m * pow;
    return 10 * pow;
  })();
  const x = (dayNum: number) => L + ((dayNum - 1) / 29) * (W - L - R);
  const y = (cum: number) => T + (1 - cum / niceMax) * (H - T - B);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.dayNum).toFixed(1)},${y(p.cum).toFixed(1)}`).join("");
  const area = `${path}L${x(pts[pts.length - 1].dayNum).toFixed(1)},${y(0).toFixed(1)}L${x(pts[0].dayNum).toFixed(1)},${y(0).toFixed(1)}Z`;
  const abbr = (n: number) =>
    n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);
  const last = pts[pts.length - 1];

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(x(p.dayNum) - px);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setHover(best);
  };

  const h = hover !== null ? pts[hover] : null;

  return (
    <div className="curve">
      <div className="t">{title}</div>
      <div style={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${title} — currently ${fmtMeters(last.cum)}`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line x1={L} x2={W - R} y1={y(niceMax * f)} y2={y(niceMax * f)} stroke="#dddbd2" strokeWidth="1" strokeDasharray={f === 1 ? undefined : "3 4"} />
              <text x={L - 8} y={y(niceMax * f) + 3} textAnchor="end" fontSize="10" fill="#8a8a85" fontFamily="var(--row-mono), monospace">
                {abbr(niceMax * f)}
              </text>
            </g>
          ))}
          <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="#15171a" strokeWidth="2" />
          {[1, 10, 20, 30].map((d) => (
            <text key={d} x={x(d)} y={H - 8} textAnchor="middle" fontSize="10" fill="#8a8a85" fontFamily="var(--row-mono), monospace">
              {d === 1 ? "SEP 1" : d}
            </text>
          ))}
          {goal ? (
            <g>
              <line x1={x(1)} y1={y(0)} x2={x(30)} y2={y(goal)} stroke="#8a8a85" strokeWidth="1.5" strokeDasharray="5 5" />
              <text x={x(30) - 4} y={Math.max(y(goal) - 8, 12)} textAnchor="end" fontSize="10" fill="#8a8a85" fontFamily="var(--row-mono), monospace">
                {abbr(goal)} PACE
              </text>
            </g>
          ) : null}
          <path d={area} fill="rgba(0,119,182,0.08)" />
          <path d={path} fill="none" stroke="#0077B6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {h && h.day && (
            <line x1={x(h.dayNum)} x2={x(h.dayNum)} y1={T} y2={y(0)} stroke="#15171a" strokeWidth="1" strokeDasharray="2 3" />
          )}
          <circle cx={x(last.dayNum)} cy={y(last.cum)} r="4.5" fill="#0077B6" />
          <text x={Math.min(x(last.dayNum), W - R - 4)} y={Math.max(y(last.cum) - 10, 12)} textAnchor="end" fontSize="11" fontWeight="700" fill="#15171a" fontFamily="var(--row-mono), monospace">
            {fmtMeters(last.cum)}
          </text>
        </svg>
        {h && h.day && (
          <div className="tip" style={{ left: `${(x(h.dayNum) / W) * 100}%`, top: `${(y(h.cum) / H) * 100}%` }}>
            {fmtDay(h.day)} · {fmtMeters(h.cum)}
          </div>
        )}
      </div>
    </div>
  );
}
