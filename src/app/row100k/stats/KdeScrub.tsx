"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { fmtClock, fmtInt } from "../analysis/fmt";
import { KdeSvg, PLOT } from "../analysis/charts";
import type { KdeChart, KdeYou } from "../analysis/model";

/* THE SCRUB (owner ask, 2026-09-05 evening: run a finger or the cursor
 * along the density and read the value and its percentile — three minutes
 * is what percentile). A thin client wrapper round KdeSvg: it turns a
 * pointer or an arrow key into a data x and hands the chart a cursor to
 * draw. Nothing shows until the first touch.
 *
 * PERCENTILE SOURCE — blackout-safe, nothing new reaches the browser: the
 * share is read off the density curve the page already ships (KdeChart.xs
 * and ys), as the cumulative trapezoid over xs normalised to 1. The KDE is
 * a public aggregate that counts everyone, elite included, and is
 * the only thing this component knows; no raw sessions, quantile arrays or
 * anything per-row are sent for it. The figure is therefore the share of
 * the smoothed field, not a count of rows — which is what a density chart
 * should say.
 *
 * Mouse: the readout follows and clears on leave. Touch: it follows the
 * finger, and a tap leaves it in place until the next touch; the surface
 * is touch-action pan-y (theme .st-kde .scrub), so a vertical drag still
 * scrolls the page — and a scroll that starts on the chart never leaves a
 * mark (see the pointer handlers). Keyboard: the wrapper is a slider —
 * the arrow keys step from the median (Shift for ten steps, Home and End
 * for the ends), Escape clears. */

type Kind = "length" | "split";

/* The hairline snaps: 50 m on the length axis, a second on the split. */
const STEP: Record<Kind, number> = { length: 50, split: 1 };

/* F(v): the share of the curve's mass at or below v. */
function cdfOf(c: KdeChart): (v: number) => number {
  const n = c.xs.length;
  const cum = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + ((c.xs[i] - c.xs[i - 1]) * (c.ys[i] + c.ys[i - 1])) / 2;
  const total = cum[n - 1];
  return (v: number) => {
    if (!(total > 0)) return NaN;
    if (v <= c.xs[0]) return 0;
    if (v >= c.xs[n - 1]) return 1;
    let i = 0;
    while (i < n - 2 && c.xs[i + 1] < v) i++;
    const t = (v - c.xs[i]) / (c.xs[i + 1] - c.xs[i] || 1);
    return (cum[i] + (cum[i + 1] - cum[i]) * t) / total;
  };
}

/* The one line the chart prints: the value, then where it sits. The share
 * is capped at 99 — the grid ends at about the first and last percentile,
 * so its very edges would otherwise claim the whole field. */
function readout(kind: Kind, v: number, F: number): string {
  const share = kind === "split" ? 1 - F : F;
  const pct = Number.isFinite(share) ? Math.max(0, Math.min(99, Math.round(100 * share))) : 0;
  return kind === "split"
    ? `${fmtClock(v)} /500M · FASTER THAN ${pct}% OF ROWS`
    : `${fmtInt(v)} M · LONGER THAN ${pct}% OF ROWS`;
}

type Cur = { x: number; k: number };

export function KdeScrub({
  c,
  you,
  kind,
  fmt,
  ends,
  label,
}: {
  c: KdeChart;
  you: KdeYou | null;
  kind: Kind;
  fmt?: (v: number) => string;
  ends?: [string, string] | null;
  label?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  /* Where a finger landed, and whether it has committed to scrubbing. */
  const touch = useRef<{ x: number; y: number; on: boolean } | null>(null);
  const [cur, setCur] = useState<Cur | null>(null);
  const cdf = useMemo(() => cdfOf(c), [c]);
  const step = STEP[kind];

  const snap = (v: number) => Math.max(c.xMin, Math.min(c.xMax, Math.round(v / step) * step));

  /* The SVG keeps its viewBox ratio (width 100%, height auto), so the
   * rendered box maps straight onto the 660-wide frame. */
  const frame = () => {
    const svg = root.current?.querySelector("svg");
    const rect = svg?.getBoundingClientRect();
    return rect && rect.width > 0 ? rect : null;
  };

  const place = (clientX: number) => {
    const rect = frame();
    if (!rect) return;
    const vx = ((clientX - rect.left) / rect.width) * PLOT.W;
    const f = Math.max(0, Math.min(1, (vx - PLOT.L) / PLOT.PW));
    const x = snap(c.xMin + f * (c.xMax - c.xMin));
    const k = PLOT.W / rect.width;
    /* Same snapped value, same frame: hand back the old object so a mouse
     * crossing one 50 m cell does not redraw the chart at move rate. */
    setCur((prev) => (prev && prev.x === x && prev.k === k ? prev : { x, k }));
  };

  /* A mouse places on the move and clears when it leaves. A finger (or a
   * pen) never places on the touch itself: the surface is touch-action
   * pan-y, so a thumb-scroll that starts on the chart is handed to the
   * browser as a pan and arrives here as pointercancel — which clears, so
   * a scroll never leaves a mark behind. A sideways drag keeps its
   * pointermoves and a tap keeps its pointerup, so both place, and the
   * mark then stays until the next touch. The first move only counts once
   * it is more across than down, so the frames before the browser claims
   * a vertical pan do not flash a hairline either. */
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") place(e.clientX);
    else touch.current = { x: e.clientX, y: e.clientY, on: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") return place(e.clientX);
    const t = touch.current;
    if (!t) return;
    if (!t.on) {
      const dx = Math.abs(e.clientX - t.x);
      const dy = Math.abs(e.clientY - t.y);
      if (dx < 3 || dy > dx) return;
      t.on = true;
    }
    place(e.clientX);
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") return;
    touch.current = null;
    place(e.clientX);
  };
  const onPointerCancel = () => {
    touch.current = null;
    setCur(null);
  };
  const onPointerLeave = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") setCur(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const by = step * (e.shiftKey ? 10 : 1);
    let move: ((from: number) => number) | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") move = (from) => from + by;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") move = (from) => from - by;
    else if (e.key === "Home") move = () => c.xMin;
    else if (e.key === "End") move = () => c.xMax;
    else if (e.key === "Escape") {
      if (!cur) return;
      e.preventDefault();
      setCur(null);
      return;
    } else return;
    e.preventDefault();
    const go = move;
    const rect = frame();
    const k = rect ? PLOT.W / rect.width : 1;
    /* Functional, so a held key steps from the last value rather than
     * from the one this render saw. */
    setCur((prev) => ({ x: snap(go(prev ? prev.x : snap(c.median))), k }));
  };

  /* Idle, the slider stands at the snapped median — the value the first
   * arrow press steps from, and the one the readout names. */
  const at = cur ? cur.x : snap(c.median);
  const text = readout(kind, at, cdf(at));

  return (
    <div
      ref={root}
      className="scrub"
      tabIndex={0}
      role="slider"
      aria-label={label ?? "Split per 500 m across every session"}
      aria-valuemin={c.xMin}
      aria-valuemax={c.xMax}
      aria-valuenow={at}
      aria-valuetext={text}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={onPointerLeave}
      onKeyDown={onKeyDown}
    >
      {/* The slider carries the name; the picture inside is decorative to
          the tree, so a reader hears the chart once. */}
      <KdeSvg c={c} you={you} fmt={fmt} ends={ends} label={label} decorative cursor={cur ? { x: cur.x, label: text, scale: cur.k } : null} />
    </div>
  );
}
