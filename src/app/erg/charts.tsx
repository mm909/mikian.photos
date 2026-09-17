"use client";

import type { ReactNode } from "react";
import type { ForceCurve } from "@/lib/pm5/pm5";

/* THE ERG CHARTS (owner, 2026-09-17: the telemetry product moves out of
 * Rowtember into its own place). The same two components the Rowtember
 * console drew with, re-cut for the /erg sheet: every colour comes from an
 * --eg- variable through a class name, so one chart reads on the ink ground
 * of a live erg and on the paper ground of a piece being read afterwards
 * without knowing which it is on.
 *
 * Inline SVG, no library. A Chart draws lines, dashed lines and bars over
 * one x/y scale with labelled axes; a ForceCurveChart draws the filled
 * curve of a stroke. Monochrome on purpose — a series is told apart by
 * weight and dash, not hue, which is the only way four series stay legible
 * on both grounds.
 *
 * A viewBox that fills its panel, so every chart reads at phone width. */

export type XY = { x: number; y: number };

export type Series = {
  points: XY[];
  /* line: the solid one; dashed: the quieter second; bars: filled. */
  kind: "line" | "dashed" | "bars";
  label: string;
};

type ChartProps = {
  title: string;
  unit: string;
  series: Series[];
  xLabel: string;
  yLabel: string;
  xFmt?: (x: number) => string;
  yFmt?: (y: number) => string;
  /* Faster is up: the pace chart. */
  invertY?: boolean;
  /* A dashed rule at this y, with its word. */
  refY?: number;
  refLabel?: string;
  yMin?: number;
  yMax?: number;
  /* What the panel says with no data yet. */
  empty?: string;
  small?: boolean;
};

const W = 360;
const PAD = { l: 46, r: 10, t: 10, b: 28 };

const fmtNum = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

/* Round ticks: the axis wants about four labels at a step that reads. */
function ticks(min: number, max: number, n = 4): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / n;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  const step = (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

/* At most `cap` points on a line, keeping the last one so a chart ends
 * where the piece does. A played-back forty-five minute row hands the whole
 * of itself to a panel 360 units wide; drawing twelve thousand points into
 * that is a slower frame and not one extra pixel of truth. */
export function thinPoints(points: XY[], cap = 600): XY[] {
  if (points.length <= cap) return points;
  const k = Math.ceil(points.length / cap);
  const out: XY[] = [];
  for (let i = points.length - 1; i >= 0; i -= k) out.push(points[i]);
  return out.reverse();
}

export function Chart({
  title,
  unit,
  series,
  xLabel,
  yLabel,
  xFmt = fmtNum,
  yFmt = fmtNum,
  invertY = false,
  refY,
  refLabel,
  yMin,
  yMax,
  empty = "WAITING FOR DATA",
  small = false,
}: ChartProps) {
  const H = small ? 150 : 190;
  const all = series.flatMap((s) => s.points).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const legend = series.map((s) => s.label).join(" · ");

  let body: ReactNode;
  if (all.length < 2) {
    body = (
      <text className="empty" x={W / 2} y={H / 2} textAnchor="middle">
        {empty}
      </text>
    );
  } else {
    let x1 = Math.max(...all.map((p) => p.x));
    const x0 = Math.min(...all.map((p) => p.x));
    if (x1 === x0) x1 = x0 + 1;
    let lo = yMin ?? Math.min(...all.map((p) => p.y), refY ?? Number.POSITIVE_INFINITY);
    let hi = yMax ?? Math.max(...all.map((p) => p.y), refY ?? Number.NEGATIVE_INFINITY);
    if (hi === lo) {
      lo -= 1;
      hi += 1;
    }
    /* A little air above and below the data. */
    const air = (hi - lo) * 0.08;
    if (yMin === undefined) lo -= air;
    if (yMax === undefined) hi += air;
    const hasBars = series.some((s) => s.kind === "bars");
    if (hasBars && yMin === undefined) lo = Math.min(lo, 0);

    const pw = W - PAD.l - PAD.r;
    const ph = H - PAD.t - PAD.b;
    const sx = (x: number) => PAD.l + ((x - x0) / (x1 - x0)) * pw;
    const sy = (y: number) => {
      const f = (y - lo) / (hi - lo);
      return invertY ? PAD.t + f * ph : PAD.t + (1 - f) * ph;
    };
    const xt = ticks(x0, x1, 4);
    const yt = ticks(lo, hi, 4);
    const barN = Math.max(1, ...series.filter((s) => s.kind === "bars").map((s) => s.points.length));
    const barW = Math.max(1, (pw / barN) * 0.7);

    body = (
      <>
        {yt.map((v) => (
          <g key={`y${v}`}>
            <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} />
            <text className="ax" x={PAD.l - 5} y={sy(v) + 3} textAnchor="end">
              {yFmt(v)}
            </text>
          </g>
        ))}
        {xt.map((v) => (
          <text key={`x${v}`} className="ax" x={sx(v)} y={H - PAD.b + 12} textAnchor="middle">
            {xFmt(v)}
          </text>
        ))}
        <line className="axis" x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b} />
        <line className="axis" x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />
        {refY !== undefined && refY >= Math.min(lo, hi) && refY <= Math.max(lo, hi) && (
          <g>
            <line className="ref" x1={PAD.l} x2={W - PAD.r} y1={sy(refY)} y2={sy(refY)} />
            {refLabel && (
              <text className="axl" x={W - PAD.r} y={sy(refY) - 3} textAnchor="end">
                {refLabel}
              </text>
            )}
          </g>
        )}
        {series.map((s, i) => {
          const pts = s.points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
          if (s.kind === "bars") {
            return (
              <g key={i}>
                {pts.map((p) => {
                  const y = sy(p.y);
                  const yz = sy(Math.max(lo, 0));
                  return <rect key={p.x} className="bar" x={sx(p.x) - barW / 2} y={Math.min(y, yz)} width={barW} height={Math.abs(yz - y)} />;
                })}
              </g>
            );
          }
          const d = pts.map((p, j) => `${j ? "L" : "M"}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(" ");
          return <path key={i} className={s.kind === "dashed" ? "ln2" : "ln"} d={d} />;
        })}
      </>
    );
  }

  return (
    <div className="eg-chart">
      <div className="t">
        <span>
          <b>{title}</b> {unit}
        </span>
        <span className="lg">{legend}</span>
      </div>
      <svg className="eg-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}, ${unit}`}>
        {body}
        <text className="axl" x={W - PAD.r} y={H - 3} textAnchor="end">
          {xLabel}
        </text>
        <text className="axl" x={PAD.l} y={PAD.t - 2} textAnchor="start">
          {yLabel}
        </text>
      </svg>
    </div>
  );
}

/* The latest stroke's force curve: a filled area under the curve with the
 * peak marked and named in both units. */
export function ForceCurveChart({ curve, newtons }: { curve: ForceCurve | null; newtons: (lbf: number) => number }) {
  const H = 200;
  const pw = W - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  let body: ReactNode;
  if (!curve || curve.pointsLbf.length < 2) {
    body = (
      <text className="empty" x={W / 2} y={H / 2} textAnchor="middle">
        WAITING FOR A STROKE
      </text>
    );
  } else {
    const n = curve.pointsLbf.length;
    const hi = Math.max(curve.peakLbf, 1) * 1.1;
    const sx = (i: number) => PAD.l + (i / (n - 1)) * pw;
    const sy = (v: number) => PAD.t + (1 - v / hi) * ph;
    const line = curve.pointsLbf.map((v, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)} ${sy(v).toFixed(1)}`).join(" ");
    const area = `${line} L${sx(n - 1).toFixed(1)} ${sy(0).toFixed(1)} L${sx(0).toFixed(1)} ${sy(0).toFixed(1)} Z`;
    const yt = ticks(0, hi, 4);
    const px = sx(curve.peakIndex);
    const py = sy(curve.peakLbf);
    body = (
      <>
        {yt.map((v) => (
          <g key={v}>
            <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} />
            <text className="ax" x={PAD.l - 5} y={sy(v) + 3} textAnchor="end">
              {Math.round(v)}
            </text>
          </g>
        ))}
        <line className="axis" x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b} />
        <line className="axis" x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />
        <path className="area" d={area} />
        <path className="ln" d={line} />
        <circle className="dot" cx={px} cy={py} r={3} />
        <text className="peak" x={px + (px > W * 0.6 ? -6 : 6)} y={py - 6} textAnchor={px > W * 0.6 ? "end" : "start"}>
          PEAK {curve.peakLbf} LBF · {Math.round(newtons(curve.peakLbf))} N
        </text>
        {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
          <text key={i} className="ax" x={sx(i)} y={H - PAD.b + 12} textAnchor="middle">
            {i}
          </text>
        ))}
      </>
    );
  }
  return (
    <div className="eg-chart">
      <div className="t">
        <span>
          <b>FORCE CURVE</b> LBF
        </span>
        <span className="lg">{curve ? `${curve.pointsLbf.length} POINTS · ${curve.chunks} NOTIFICATIONS` : "0X3D"}</span>
      </div>
      <svg className="eg-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Force curve of the latest stroke">
        {body}
        <text className="axl" x={W - PAD.r} y={H - 3} textAnchor="end">
          SAMPLE
        </text>
        <text className="axl" x={PAD.l} y={PAD.t - 2} textAnchor="start">
          LBF
        </text>
      </svg>
    </div>
  );
}
