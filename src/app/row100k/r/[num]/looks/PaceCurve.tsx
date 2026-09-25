"use client";

import { useState } from "react";
import { fmtMeters } from "@/lib/row100k";

/* THE PACE — the rower's average split as it has moved with every meter
 * (owner ask, 2026-09-08: "a graph on the profile, meters on x, average
 * pace per 500 on y"). One point per timed session, x the meters rowed so
 * far, y the running average split over all of them, so the line is the
 * identity settling: a fast day pulls it down, a long slow one pulls it
 * up, and the right-hand end is the number the ledger prints as AVERAGE
 * SPLIT. Faster is UP, the way a pace chart is read. The clock stands
 * alone, no /500m after it (owner, 2026-09-25 pm: remove the /500m unit on
 * the avg split section of the profile).
 *
 * Nothing here reaches a hidden rower's page — the profile shows the dog
 * tag instead while a window is open — so the points can be the truth. */
export type PacePoint = {
  /* cumulative meters after this session */
  m: number;
  /* running average split, seconds per 500 m */
  s: number;
  /* "Sep 4", for the readout */
  dayStr: string;
};

/* A DOT (owner ask, 2026-09-24: "I want to see a dot where the average
 * pace of that row was — if my month average is 1:57 and going down, that
 * is because I had rows at 1:55, and I want to see those dots"). One per
 * timed row, at the meters rowed so far and that row's OWN split, so the
 * line can be read against the days that moved it. */
export type PaceDot = {
  /* cumulative meters after this row — the same x as the line's point */
  m: number;
  /* this row's own split, seconds per 500 m */
  s: number;
  /* the row's own meters, for the readout */
  rowM: number;
  /* "Sep 4", for the readout */
  dayStr: string;
};

const W = 660;
const H = 220;
const L = 54;
const R = 16;
const T = 14;
const B = 28;

const clock = (s: number) => {
  const t = Math.round(s * 10);
  return `${Math.floor(t / 600)}:${String(Math.floor((t % 600) / 10)).padStart(2, "0")}.${t % 10}`;
};
const abbr = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}K` : String(n));

/* `dots` is optional so the plan page (another package) can keep calling
 * this with the line alone. */
export function PaceCurve({ pts, dots = [] }: { pts: PacePoint[]; dots?: PaceDot[] }) {
  const [hover, setHover] = useState<number | null>(null);
  /* A dot under the pointer or the keyboard: it wins the readout over the
   * line's nearest point, because it is what the hand is on. */
  const [dotHover, setDotHover] = useState<number | null>(null);
  if (pts.length < 2) return null;

  const maxM = pts[pts.length - 1].m;
  /* The axis holds the dots too: a 1:45 row on a 1:55 average has to be on
   * the chart, not clipped off its top (owner, 2026-09-24). */
  const splits = pts.map((p) => p.s).concat(dots.map((d) => d.s));
  const lo = Math.min(...splits);
  const hi = Math.max(...splits);
  /* A few seconds of air either side, and never a flat band: a rower whose
   * average has not moved still gets a frame to sit in. */
  const pad = Math.max(3, (hi - lo) * 0.25);
  const yMin = Math.floor((lo - pad) / 5) * 5;
  const yMax = Math.ceil((hi + pad) / 5) * 5;

  const x = (m: number) => L + (m / maxM) * (W - L - R);
  /* Faster (smaller split) sits higher. */
  const y = (s: number) => T + ((s - yMin) / (yMax - yMin)) * (H - T - B);

  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.m).toFixed(1)},${y(p.s).toFixed(1)}`).join("");

  const yTicks: number[] = [];
  const step = yMax - yMin > 40 ? 15 : yMax - yMin > 20 ? 10 : 5;
  for (let s = yMin; s <= yMax; s += step) yTicks.push(s);
  const xTicks = [0.25, 0.5, 0.75, 1].map((f) => Math.round(maxM * f));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let dist = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(x(p.m) - px);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    setHover(best);
  };

  const last = pts[pts.length - 1];
  const dh = dotHover !== null ? dots[dotHover] : null;
  const h = dh ? null : hover !== null ? pts[hover] : null;
  /* Where the hairline sits: the dot if one is held, else the line's
   * nearest point. */
  const at = dh ?? h;

  return (
    <div className="st-kde pf-pace">
      <div className="t">Average split, meter by meter</div>
      <div style={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Average split over ${fmtMeters(maxM)} — now ${clock(last.s)} per 500 m`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {yTicks.map((s) => (
            <g key={s}>
              <line x1={L} x2={W - R} y1={y(s)} y2={y(s)} stroke="var(--line)" strokeWidth="1" strokeDasharray="3 4" />
              <text x={L - 8} y={y(s) + 3} textAnchor="end" fontSize="10" fill="var(--gray)" fontFamily="var(--row-mono), monospace">
                {clock(s).slice(0, -2)}
              </text>
            </g>
          ))}
          <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="var(--ink)" strokeWidth="2" />
          {xTicks.map((m) => (
            <text key={m} x={x(m)} y={H - 8} textAnchor={m === maxM ? "end" : "middle"} fontSize="10" fill="var(--gray)" fontFamily="var(--row-mono), monospace">
              {abbr(m)}
            </text>
          ))}
          <text x={L} y={H - 8} textAnchor="start" fontSize="10" fill="var(--gray)" fontFamily="var(--row-mono), monospace">
            0
          </text>
          {/* The rows themselves, under the line: water blue with a paper
              ring so they read as separate marks where they touch it.
              Focusable, with a title, so the keyboard gets the same
              readout as the pointer. */}
          {dots.map((d, i) => (
            <circle
              key={`d${i}`}
              className="dot"
              cx={x(d.m)}
              cy={y(d.s)}
              r={dotHover === i ? 4 : 3}
              fill="var(--water)"
              stroke="var(--paper)"
              strokeWidth="1.5"
              tabIndex={0}
              onPointerEnter={() => setDotHover(i)}
              onPointerLeave={() => setDotHover(null)}
              onFocus={() => setDotHover(i)}
              onBlur={() => setDotHover(null)}
            >
              <title>{`${d.dayStr} · ${fmtMeters(d.rowM)} · ${clock(d.s)}`}</title>
            </circle>
          ))}
          <path d={path} fill="none" stroke="var(--water)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p, i) => (
            <circle key={i} cx={x(p.m)} cy={y(p.s)} r={i === pts.length - 1 ? 4.5 : 2.2} fill="var(--water)" />
          ))}
          {at && <line x1={x(at.m)} x2={x(at.m)} y1={T} y2={H - B} stroke="var(--ink)" strokeWidth="1" strokeDasharray="2 3" />}
          <text x={Math.min(x(last.m), W - R - 4)} y={Math.max(y(last.s) - 10, 12)} textAnchor="end" fontSize="11" fontWeight="700" fill="var(--ink)" fontFamily="var(--row-mono), monospace">
            {clock(last.s)}
          </text>
        </svg>
        {dh && (
          <div className="tip" style={{ left: `${(x(dh.m) / W) * 100}%`, top: `${(y(dh.s) / H) * 100}%` }}>
            {dh.dayStr} · {fmtMeters(dh.rowM)} row · {clock(dh.s)}
          </div>
        )}
        {h && (
          <div className="tip" style={{ left: `${(x(h.m) / W) * 100}%`, top: `${(y(h.s) / H) * 100}%` }}>
            {h.dayStr} · {fmtMeters(h.m)} · {clock(h.s)}
          </div>
        )}
      </div>
    </div>
  );
}
