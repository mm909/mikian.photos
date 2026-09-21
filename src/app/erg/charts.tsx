"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { ForceCurve } from "@/lib/pm5/pm5";
import {
  PAD,
  PADZ,
  SPREAD_MIN,
  SPREAD_SD_MIN,
  VW,
  computePlot,
  computeSpread,
  densityAt,
  fmtNum,
  nearestByX,
  spreadRank,
  stepOf,
  thinPoints,
  ticks,
  type Plot,
  type Series,
  type Spread,
  type XY,
} from "./chartGeom";

export { thinPoints };
export type { Series, XY };

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
 * ---------------------------------------------------------------------
 * A CHART OPENS, AND YOU CAN POINT AT IT (owner, 2026-09-17, after using
 * it: "let me click on the charts on the live look on the erg to open them
 * up and scrub through them and make them bigger — kind of like how big the
 * force chart is. I should also be able to hover over these values, my
 * cursor should be able to go to a certain point and see the XY values on
 * it").
 *
 * THE PANEL IS THE BUTTON. He said click on the charts, not click a little
 * word above them, so the whole plot is a real button and the keyboard
 * reaches it like any other.
 *
 * THE OPENED CHART MEASURES ITS OWN BOX and takes exactly that many viewBox
 * units. This is the one decision the rest of the feature rests on. SVG text
 * is sized in viewBox units and this sheet paints charts at width 100% with
 * height auto, so a 9px axis label renders at 7.5px in a 300px column and at
 * 28px across an 1,140px dialog. Enlarging by container width alone inflates
 * the type nearly fourfold; picking a second fixed width instead makes the
 * opened chart SMALLER with smaller type on a phone, which is the opposite
 * of what was asked for. Measuring means the scale is exactly one: one unit
 * is one CSS pixel on a phone, on a laptop and halfway through a window
 * drag, every font size renders at the number it says, bigger type in the
 * big view goes back to being an ordinary CSS rule, and mapping a pointer
 * into the chart becomes a subtraction.
 *
 * THE CURSOR IS AN X, IN CHART UNITS — second 143.2, stroke 287 — and never
 * a pixel and never an index. thinPoints re-picks which six hundred of
 * twelve thousand points get drawn on every packet and the live window rolls
 * under the cursor twelve times a second, so an index would be pointing at a
 * different stroke a second later. A stroke number is a stroke number.
 *
 * NOTHING IS PORTALLED. Every rule on these screens is scoped .eg and every
 * --eg- variable is declared there, so a portal to the body renders an
 * unstyled chart. The sheet is position fixed inside the tree it belongs to,
 * which works because nothing above it carries a transform.
 *
 * TWO HOOKS AND NOT ONE, and the reason is an ordering problem worth
 * stating: the opened size is measured from the DOM, the plot is built from
 * that size, and the cursor is mapped through the plot. So the FRAME hook
 * runs first and owns the sheet and the box; the plot is computed between
 * them; the SCRUB hook runs second and owns the pointer. One hook cannot do
 * both without being called twice, and two calls are two copies of the same
 * state that never agree.
 *
 * FOUR THINGS NOT TO DO HERE, each of which quietly breaks it:
 *   1. Do NOT memo Chart and do NOT useMemo the series or the plot.
 *      thinPoints allocates a fresh array every render, so every prop is a
 *      new identity every packet: the comparison costs and never hits.
 *   2. Do NOT key or remount a chart on anything. The cursor is component
 *      state and a remount tears it. This is the one sure way to break it.
 *   3. Do NOT add per-point hit targets. The handlers sit on the wrapper and
 *      the events bubble; six hundred nodes a chart, rebuilt twelve times a
 *      second, buys nothing.
 *   4. Do NOT setState straight out of pointermove. One frame, one write,
 *      and only when the snapped point actually changed.
 *   5. The useRef cache in useSpread is NOT a breach of 1. Prohibition 1 is
 *      about comparing ARRAY IDENTITIES that thinPoints reallocates every
 *      render, where the comparison costs and never hits. That cache is
 *      keyed on a count, a last point and a clock — scalars — so it hits on
 *      almost every render by construction. Do not delete it.
 *
 * The maths is chartGeom.ts and nothing here duplicates it. The gesture is
 * the one the house already shipped in src/app/row100k/stats/KdeScrub.tsx —
 * rect arithmetic rather than a matrix, touch-action pan-y with a
 * commitment test, a value-identity dedupe, and role=slider rather than a
 * live region. Read that file before changing this one. */

/* /erg is a server page, so these client components are prerendered and a
 * bare useLayoutEffect warns during that pass. */
const useIsoLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

export type SpanControl = {
  /* true: the charts hold the whole piece. false: the rolling window. */
  whole: boolean;
  /* False when there is no more piece than the window already shows, or the
   * erg is a loaded row that was never windowed in the first place. */
  can: boolean;
  set: (v: boolean) => void;
  /* THE WHOLE PIECE, or LAST 120 S · LAST 60 STROKES. */
  note: string;
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
  /* How a distance from refY reads. The pace chart passes a signed second. */
  refDeltaFmt?: (d: number) => string;
  yMin?: number;
  yMax?: number;
  /* What the panel says with no data yet. */
  empty?: string;
  small?: boolean;
  /* The one word the x axis is counted in, for the readout: ELAPSED,
   * STROKE, SAMPLE. Falls back to the first word of xLabel. */
  xWord?: string;
  span?: SpanControl;
  /* THE SPREAD: the mean and the deviation of this KPI on every panel, and
   * the density of it when the chart is opened. Off by default, and off for
   * good on the force curve — see useSpread. */
  stat?: boolean;
  /* A chart on the rowing screen. No opener, no cursor, no focusable node: a
   * sweaty thumb must never drop a full screen dialog over the finish time
   * of the piece somebody is in the middle of. */
  still?: boolean;
  /* MORE ROOM FOR THE Y LABELS (review, 2026-09-17: the rowing screen prints
   * its axis at thirteen units instead of nine so it can be read from a
   * metre away, and 1:50.0 at that size is wider than the forty one units
   * the default pad leaves — so the minute was being cut off the left of
   * every tick and the axis read as a set of seconds). The number is in
   * viewBox units, and an opened chart measures itself in pixels, so it is
   * only honoured on a panel. */
  padL?: number;
};

/* One reading off the rule: which series, and what it says there. */
type Read = { label: string; text: string; p: XY | null };

/* Where a finger landed, and whether it has committed to scrubbing. */
type Touch = { x: number; y: number; on: boolean };

/* CAPTURING A POINTER CAN THROW, and the throw is what matters here (review,
 * 2026-09-17: it aborted the handler before the cursor was ever placed, so a
 * finger in the opened sheet read nothing at all). setPointerCapture raises
 * NotFoundError when the id names no live pointer — a finger already lifted,
 * a pointer the browser cancelled under us, or a synthetic event. Capture is
 * a convenience: it keeps a drag alive past the edge of the plot. Losing it
 * must never cost the reading. */
function capture(e: React.PointerEvent) {
  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {
    /* No live pointer with that id. The drag simply ends at the border. */
  }
}

function release(e: React.PointerEvent) {
  try {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  } catch {
    /* Already gone. */
  }
}

type Box = { w: number; h: number };

/* THE BODY LOCK IS COUNTED (review, 2026-09-17: the first version asserted
 * that a second sheet could not exist because the first covers the screen —
 * true of a pointer and false of the TAB key, which walks straight out of an
 * opaque overlay onto the eight chart buttons behind it. Two sheets then each
 * saved the overflow they found, and the second saved the word HIDDEN, so
 * closing both left the page unable to scroll). The sheet traps focus now, so
 * the second sheet should no longer be reachable at all; the count is what
 * makes that a nicety rather than the only thing holding it up. */
let lockDepth = 0;
let lockPrev = "";
function lockBody() {
  if (lockDepth++ === 0) {
    lockPrev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
}
function unlockBody() {
  if (lockDepth > 0 && --lockDepth === 0) document.body.style.overflow = lockPrev;
}

/* ---- THE FRAME: is the sheet open, and how big is the plot in it ------ */

function useChartFrame() {
  const [zoom, setZoom] = useState(false);
  /* The measured plot box, in CSS pixels. Null until the first layout pass. */
  const [box, setBox] = useState<Box | null>(null);

  /* Where focus goes back to, and the element that is measured — which is
   * also the slider, so one ref does both jobs. */
  const opener = useRef<HTMLButtonElement | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);
  /* THE BUTTON IS NOT THERE TO GIVE FOCUS BACK TO (review, 2026-09-17: the
   * panel unmounts while the sheet is up, so the ref is null by the time the
   * closing effect runs, and a remembered node would be a detached one
   * anyway). So the wish is remembered instead of the element, and it is
   * granted one render AFTER the button comes back. */
  const wantFocus = useRef(false);

  /* The svg is given its size in pixels as well as in units, so the viewBox
   * and the box it is painted into are the same rectangle. Nothing can
   * letterbox and the type cannot inflate. It cannot chase its own tail
   * either: the svg is never larger than the container so it never pushes
   * it, and the container takes its size from the flex column above. */
  useIsoLayout(() => {
    if (!zoom) {
      setBox(null);
      return;
    }
    const el = plotRef.current;
    if (!el) return;
    const read = () => {
      const w = Math.round(el.clientWidth);
      const avail = Math.round(el.clientHeight);
      /* A zero-size first layout pass, or a box too short to draw a chart in
       * at all — a landscape phone whose card chrome has eaten everything.
       * Either way the observer fires again, and until it does the sheet
       * shows the panel geometry, which is small but whole. */
      if (w < 40 || avail < 120) return;
      /* AS TALL AS THE CARD LEFT IT, up to square. On a desktop the card is
       * the limit and the chart comes out wide, which is the shape a line
       * over time wants. On a phone the limit would otherwise be the aspect,
       * and a 347 wide chart held to a landscape ratio opens barely taller
       * than the panel it came from — which is not bigger, which is the one
       * thing that was asked for. Square is where it stops, because past
       * that a time series becomes a tall thin strip. The slack under it is
       * simply empty.
       *
       * AVAIL IS THE CEILING AND THERE IS NO FLOOR ABOVE IT (review,
       * 2026-09-17: a 200px floor beat the measurement on a landscape phone,
       * and the plot box is overflow:hidden with nothing to scroll, so the
       * bottom of the chart — the x axis and its word — was simply cut off
       * rather than there being more chart to see). The guard above is what
       * keeps this above the 54 pixels the opened pad needs. */
      const h = Math.min(avail, Math.max(200, w));
      setBox((b) => (b && b.w === w && b.h === h ? b : { w, h }));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    window.addEventListener("orientationchange", read);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", read);
    };
  }, [zoom]);

  /* Escape, the scroll lock, and the focus into the plot. */
  useEffect(() => {
    if (!zoom) {
      /* Coming back out: the panel button has just remounted, so this is the
       * first moment there is anything to focus. */
      if (wantFocus.current) {
        wantFocus.current = false;
        opener.current?.focus();
      }
      return;
    }
    wantFocus.current = true;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(false);
    };
    lockBody();
    window.addEventListener("keydown", onKey);
    plotRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      unlockBody();
    };
  }, [zoom]);

  const size = (small: boolean, tall = 190): { W: number; H: number; pad: typeof PAD } =>
    zoom && box ? { W: box.w, H: box.h, pad: PADZ } : { W: VW, H: small ? 150 : tall, pad: PAD };

  return { zoom, setZoom, box, opener, plotRef, size };
}

/* ---- THE SCRUB: where the pointer is, in the plot it was given -------- */

function useChartScrub(plot: Plot | null, zoom: boolean, open: () => void) {
  const [cur, setCur] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const touch = useRef<Touch | null>(null);
  const moved = useRef(false);
  const pend = useRef<number | null>(null);
  const raf = useRef(0);

  const aim = (x: number | null) => {
    pend.current = x;
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const want = pend.current;
      /* Same snapped point, no write: a mouse crossing one point does not
       * redraw a chart that is already redrawing at packet rate. */
      setCur((prev) => (prev === want ? prev : want));
    });
  };
  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    },
    [],
  );

  /* THE WINDOW ROLLS OUT FROM UNDER A PARKED CURSOR, and a playback seek
   * empties the slot and pours the piece back in. A cursor outside what is
   * drawn is not corrected and is NOT clamped to the edge — clamping would
   * keep reporting the oldest point as though it were under the pointer. It
   * simply stops being drawn, which costs no render and no effect, and it
   * quietly comes back if a playback is scrubbed back over it. */
  const live = plot && cur !== null && cur >= plot.x0 && cur <= plot.x1 ? cur : null;
  const leadPts = plot && plot.lead >= 0 ? plot.drawn[plot.lead] : null;
  const snapped = live !== null && leadPts ? (nearestByX(leadPts, live)?.x ?? null) : null;

  /* The svg carries no transform and keeps the default preserveAspectRatio,
   * and the sheet paints a panel at width 100% with height auto, so the
   * painted box is the viewBox scaled by one number and rect.width over W is
   * that number. An opened chart is painted at its own pixel size, so the
   * same expression is one there and the whole thing collapses to a
   * subtraction. THE RECT IS READ PER EVENT AND NEVER REMEMBERED, which is
   * what makes this survive a window drag, a page zoom and a scroll with no
   * matrix anywhere. */
  const place = (clientX: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || !r.width || !plot || !leadPts) return;
    const at = plot.ix((clientX - r.left) * (plot.W / r.width));
    aim(nearestByX(leadPts, at)?.x ?? null);
  };

  const down = (e: React.PointerEvent) => {
    moved.current = false;
    if (e.pointerType === "mouse") {
      place(e.clientX);
      return;
    }
    /* In the sheet a finger is committed at once, because the sheet does not
     * scroll. On a panel it has to prove it is going across before it counts
     * as a scrub, or nine stacked charts become nine scroll traps. */
    touch.current = { x: e.clientX, y: e.clientY, on: zoom };
    if (zoom) {
      capture(e);
      place(e.clientX);
    }
  };

  const move = (e: React.PointerEvent) => {
    const t = touch.current;
    if (Math.abs(e.clientX - (t?.x ?? e.clientX)) > 6) moved.current = true;
    if (e.pointerType === "mouse") {
      place(e.clientX);
      return;
    }
    if (!t) return;
    if (!t.on) {
      /* More across than down, and more than three pixels of it, before a
       * finger counts — so the frames before the browser claims a vertical
       * pan do not flash a hairline. */
      const dx = Math.abs(e.clientX - t.x);
      const dy = Math.abs(e.clientY - t.y);
      if (dx < 3 || dy > dx) return;
      t.on = true;
      moved.current = true;
    }
    place(e.clientX);
  };

  const up = (e: React.PointerEvent) => {
    release(e);
    const t = touch.current;
    touch.current = null;
    if (e.pointerType === "mouse") return;
    /* A tap on a panel opens and leaves no cursor behind; a tap in the sheet
     * places one, and it stays until the next touch. */
    if (t?.on) {
      place(e.clientX);
      return;
    }
    if (!zoom) aim(null);
  };

  const cancel = () => {
    touch.current = null;
    aim(null);
  };

  const leave = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") aim(null);
  };

  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      /* The first press drops the cursor, the second closes the sheet. React
       * attaches at the root, so stopping here keeps it off the window.
       *
       * IT GATES ON WHAT IS DRAWN, NOT ON WHAT IS STORED (review,
       * 2026-09-17): a cursor the rolling window has left behind is already
       * invisible, and swallowing a press to drop something nobody can see
       * made Escape do nothing at all, once, at random. That one is cleared
       * silently and the press goes on to close the sheet. */
      if (snapped !== null) e.stopPropagation();
      aim(null);
      return;
    }
    if (!leadPts || !leadPts.length) return;
    const k = e.key;
    if (k !== "ArrowLeft" && k !== "ArrowRight" && k !== "Home" && k !== "End") return;
    /* The sheet must not scroll out from under the cursor. */
    e.preventDefault();
    if (k === "Home") {
      aim(leadPts[0].x);
      return;
    }
    if (k === "End" || snapped === null) {
      /* No cursor yet: the first press lands on the live end, which is where
       * a rower is looking anyway. */
      aim(leadPts[leadPts.length - 1].x);
      return;
    }
    let i = 0;
    while (i < leadPts.length - 1 && leadPts[i].x < snapped) i++;
    const by = (k === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 10 : 1);
    aim(leadPts[Math.min(leadPts.length - 1, Math.max(0, i + by))].x);
  };

  /* The click that opens. Never after a scrub: a drag across a panel that
   * ends in a click would otherwise open the sheet every time. */
  const openClick = () => {
    if (moved.current) {
      moved.current = false;
      return;
    }
    open();
  };

  return {
    snapped,
    svgRef,
    openClick,
    keys,
    handlers: { onPointerDown: down, onPointerMove: move, onPointerUp: up, onPointerCancel: cancel, onPointerLeave: leave },
  };
}

/* THE SPREAD OF THE LEAD SERIES, on a clock.
 *
 * TWO TIERS. "stats" is one pass and one sort — no grid and no exp() — and
 * every chart with the prop gets it. "curve" adds the kernel and is asked
 * for only by a chart that is OPEN; the opened sheet is modal and counts its
 * own lock, so at most one exists. A rower looking at nine panels pays for
 * nine sorts and zero exponentials.
 *
 * THE LEAD SERIES ONLY, which is plot.lead, which is the first series with a
 * line in it. That excludes every dashed companion automatically, and it
 * should: AVERAGE and RUNNING AVG are CUMULANTS, not samples. The deviation
 * of a running mean shrinks towards zero as a row goes on whatever the rower
 * does, so printing it beside the deviation of the pace would say the
 * average is six times steadier than the rower, which is arithmetic rather
 * than a fact about anybody.
 *
 * THE KEY IS SCALARS. The hub mutates its arrays in place and thinPoints
 * reallocates on every render, so an identity key is either a permanent hit
 * that never updates or a permanent miss. A count, the last point, and the
 * domain. The 400 ms floor on top means a live piece recomputes two and a
 * half times a second rather than twelve, and a finished or paused one
 * computes once, ever. */
const SPREAD_EVERY_MS = 400;

function useSpread(plot: Plot | null, want: "off" | "stats" | "curve"): Spread | null {
  /* The tier is remembered as well as the key, because a tier change is not
   * a data change and must not be made to wait out the clock (review,
   * 2026-09-17: opening a chart within 400 ms of the last stats computation
   * left it with no hill until the next packet moved the key). */
  const cache = useRef<{ key: string; tier: string; at: number; v: Spread | null }>({ key: "", tier: "", at: 0, v: null });
  if (want === "off" || !plot || plot.statLead < 0) return null;
  const pts = plot.drawn[plot.statLead];
  const last = pts.length ? pts[pts.length - 1] : null;
  const key = `${want}|${pts.length}|${last ? last.x : 0}|${last ? last.y : 0}|${plot.lo.toFixed(3)}|${plot.hi.toFixed(3)}`;
  const now = typeof performance === "undefined" ? 0 : performance.now();
  if (cache.current.key !== key && (cache.current.tier !== want || now - cache.current.at >= SPREAD_EVERY_MS)) {
    const dom: [number, number] = [Math.min(plot.lo, plot.hi), Math.max(plot.lo, plot.hi)];
    cache.current = { key, tier: want, at: now, v: computeSpread(pts, want === "curve" ? "curve" : "stats", dom) };
  }
  return cache.current.v;
}

/* A DEVIATION ON THE KPI'S OWN SCALE. One fixed decimal rounds a real spread
 * to zero on any KPI whose whole range sits under a tenth of its unit —
 * drive length moves about three centimetres — so SD 0.0 would print one
 * line under a guard that had just said the samples are NOT all the same,
 * beside a z score computed from that same non-zero number. Two significant
 * figures below one, spelled out with toFixed rather than toPrecision so a
 * tiny value cannot come back in exponential form. yFmt is the wrong tool
 * for it: a three second spread on the pace chart is three SECONDS, not the
 * clock time 0:03. */
function fmtSd(s: number): string {
  if (!(s > 0)) return "0";
  const dp = s >= 1 ? 1 : Math.min(6, 1 - Math.floor(Math.log10(s)));
  return s.toFixed(dp);
}

/* THE LINE UNDER THE TITLE: what the piece was made of, in words.
 *
 * The direction word comes off invertY and off nothing else. It is already
 * the prop that orients the axis, so the sentence and the picture cannot
 * contradict each other: on an inverted chart a low number is a fast one, so
 * a rower at the 22nd percentile of their own splits is FASTER THAN 78%. */
function spreadWords(sp: Spread | null, now: number | null, yFmt: (y: number) => string, invertY: boolean): { text: string; quiet: boolean } | null {
  if (!sp) return null;
  const bits: string[] = [`MEAN ${yFmt(sp.mean)}`];
  if (sp.n < SPREAD_MIN) return { text: `${bits[0]} · ${sp.n} VALUES`, quiet: true };
  if (!(sp.sd > 0)) return { text: `${bits[0]} · EVERY SAMPLE THE SAME`, quiet: true };
  bits.push(`SD ${fmtSd(sp.sd)}`);
  if (sp.modes >= 2) bits.push("TWO GROUPS");
  if (now !== null) {
    bits.push(`NOW ${yFmt(now)}`);
    const z = (now - sp.mean) / sp.sd;
    bits.push(`${z >= 0 ? "+" : "−"}${Math.abs(z).toFixed(1)} SD`);
    const pct = spreadRank(sp, now);
    if (Number.isFinite(pct)) bits.push(invertY ? `FASTER THAN ${Math.round(100 - pct)}%` : `ABOVE ${Math.round(pct)}%`);
  }
  if (sp.n < sp.nAll) bits.push(`FROM ${sp.n.toLocaleString("en-US")} OF ${sp.nAll.toLocaleString("en-US")}`);
  return { text: bits.join(" · "), quiet: false };
}

/* Every series read at the rule, in series order. Written with map rather
 * than filter(Boolean), which does not narrow a nullable array under strict
 * TypeScript and is a compile error. */
function readAt(plot: Plot | null, series: Series[], snapped: number | null, fy: (y: number) => string): Read[] {
  if (!plot || snapped === null) return [];
  return plot.drawn.map((pts, i) => {
    const p = nearestByX(pts, snapped);
    /* A series with no point near the rule prints a dash rather than lying
     * about a value forty strokes away. */
    const near = p !== null && Math.abs(p.x - snapped) <= stepOf(plot, pts) * 1.5;
    return { label: series[i].label, text: near && p ? fy(p.y) : "—", p: near ? p : null };
  });
}

/* THE SHEET. It holds no telemetry and no subscription: it is part of the
 * chart output, so a packet landing re-renders the chart and redraws this
 * with it. Closing is one setState and nothing here calls into the hub. A
 * dropped link simply stops the packets and the sheet holds its last frame
 * with the cursor parked where it was left. */
function ChartZoom({
  title,
  unit,
  legend,
  reads,
  moment,
  xWord,
  delta,
  span,
  children,
  onClose,
  plotRef,
  plot,
  snapped,
  handlers,
  keys,
  valueText,
  spread,
}: {
  title: string;
  unit: string;
  legend: string;
  reads: Read[];
  moment: string | null;
  xWord: string;
  delta: { k: string; v: string } | null;
  span?: SpanControl;
  children: ReactNode;
  onClose: () => void;
  plotRef: React.MutableRefObject<HTMLDivElement | null>;
  plot: Plot | null;
  snapped: number | null;
  handlers: React.DOMAttributes<HTMLDivElement>;
  keys: (e: React.KeyboardEvent) => void;
  valueText: string;
  /* The mean, the deviation and where the rower is in their own spread, when
   * this chart carries one. Null on the force curve. */
  spread?: string | null;
}) {
  /* A pointerdown on the ground closes, but only when it started there AND
   * hardly travelled: a scrub that ends past the edge of the card must not
   * dismiss the thing being scrubbed. */
  const from = useRef<{ x: number; y: number; self: boolean } | null>(null);
  const card = useRef<HTMLDivElement | null>(null);

  /* TAB STAYS IN THE SHEET (review, 2026-09-17: it did not, and an opaque
   * overlay that focus walks out of is worse than no overlay — three presses
   * from the plot landed on CLEAR behind it, which opens a confirm about
   * discarding a recording, and a fourth opened a second chart on top of this
   * one). Four focusables at most, so a wrap is the whole trap: no sentinels,
   * no library, nothing to keep in sync. Escape still closes. */
  const trap = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !card.current) return;
    const able = [...card.current.querySelectorAll<HTMLElement>("button, [tabindex]")].filter(
      (el) => !el.hasAttribute("disabled") && el.tabIndex >= 0 && el.offsetParent !== null,
    );
    if (!able.length) return;
    const first = able[0];
    const last = able[able.length - 1];
    const here = document.activeElement;
    if (e.shiftKey && (here === first || !card.current.contains(here))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (here === last || !card.current.contains(here))) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="eg-zoom"
      role="dialog"
      aria-modal="true"
      aria-label={`${title}, ${unit}`}
      onKeyDown={trap}
      onPointerDown={(e) => {
        from.current = { x: e.clientX, y: e.clientY, self: e.target === e.currentTarget };
      }}
      onPointerUp={(e) => {
        const f = from.current;
        from.current = null;
        if (!f || !f.self || e.target !== e.currentTarget) return;
        if (Math.abs(e.clientX - f.x) > 8 || Math.abs(e.clientY - f.y) > 8) return;
        onClose();
      }}
    >
      <div className="eg-zoom-card" ref={card}>
        <div className="eg-zoom-head">
          <span className="eg-zoom-title">{title}</span>
          <span className="eg-note">{unit}</span>
          <span className="eg-note">{legend}</span>
          <button type="button" className="eg-btn eg-btn-quiet" onClick={onClose}>
            Close
          </button>
        </div>

        {/* THE READING SITS ABOVE THE PLOT. The one thing a thumb is certain
          * to cover is whatever is directly under it, so the numbers go
          * where the finger is not, in the same place at every width, at a
          * fixed minimum height so nothing jumps as they appear. */}
        <div className="eg-read">
          {moment === null ? (
            <span className="hint">Point at the chart, or drag across it</span>
          ) : (
            <>
              <span className="c">
                <span className="k">{xWord}</span>
                <span className="v">{moment}</span>
              </span>
              {reads.map((r, i) => (
                <span className="c" key={i}>
                  <span className="k">{r.label}</span>
                  <span className="v">{r.text}</span>
                  <span className="hint">{unit}</span>
                </span>
              ))}
              {delta ? (
                <span className="c">
                  <span className="k">{delta.k}</span>
                  <span className="v">{delta.v}</span>
                </span>
              ) : null}
            </>
          )}
        </div>

        <div
          ref={plotRef}
          className="eg-zoom-plot"
          tabIndex={0}
          role="slider"
          aria-label={`${title}, ${unit}`}
          aria-valuemin={plot ? plot.x0 : 0}
          aria-valuemax={plot ? plot.x1 : 0}
          aria-valuenow={snapped ?? (plot ? plot.x1 : 0)}
          aria-valuetext={valueText}
          onKeyDown={keys}
          {...handlers}
        >
          {children}
        </div>

        {spread ? <div className="eg-chart-stat">{spread}</div> : null}

        <div className="eg-zoom-foot">
          {span?.can ? (
            <span className="eg-chips">
              <button type="button" className={span.whole ? "eg-chip" : "eg-chip on"} aria-pressed={!span.whole} onClick={() => span.set(false)}>
                Rolling window
              </button>
              <button type="button" className={span.whole ? "eg-chip on" : "eg-chip"} aria-pressed={span.whole} onClick={() => span.set(true)}>
                Whole piece
              </button>
            </span>
          ) : null}
          <span className="eg-note">{span ? span.note : "DRAG ACROSS IT, OR USE THE ARROW KEYS · ESCAPE CLOSES"}</span>
        </div>
      </div>
    </div>
  );
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
  refDeltaFmt,
  yMin,
  yMax,
  empty = "WAITING FOR DATA",
  small = false,
  xWord,
  span,
  stat = false,
  still = false,
  padL,
}: ChartProps) {
  const f = useChartFrame();
  const base = f.size(small);
  const { W, H } = base;
  const pad = padL !== undefined && !f.zoom ? { ...base.pad, l: padL } : base.pad;
  const plot = computePlot(series, { W, H, pad, invertY, refY, yMin, yMax });
  const s = useChartScrub(plot, f.zoom, () => f.setZoom(true));
  /* Stats only: the density has its own chart now (owner, 2026-09-21:
   * "there should be a view that I can see the KDE on its own, not on the
   * same chart as the line chart — two different graphs"). */
  const sp = useSpread(plot, stat ? "stats" : "off");

  const legend = series.map((x) => x.label).join(" · ");
  const word = xWord ?? xLabel.split(" ")[0];
  const reads = readAt(plot, series, s.snapped, yFmt);
  const moment = s.snapped === null ? null : xFmt(s.snapped);

  /* The one question a rower is actually asking of a chart with a reference
   * on it: how far off two minutes am I, right here. */
  const leadRead = plot && plot.lead >= 0 ? reads[plot.lead] : undefined;
  const delta = refY !== undefined && refDeltaFmt && leadRead?.p ? { k: `VS ${refLabel ?? fmtNum(refY)}`, v: refDeltaFmt(leadRead.p.y - refY) } : null;

  const readLine =
    moment === null
      ? `${title}, ${unit}`
      : `${word} ${moment} · ${reads.map((r) => `${r.label} ${r.text}`).join(" · ")}${delta ? ` · ${delta.k} ${delta.v}` : ""}`;
  /* Only on a panel. In the sheet the reading has its own strip and the head
   * keeps its title. */
  const panelRead = !f.zoom && s.snapped !== null;

  /* WHERE THE ROWER IS ON THEIR OWN HILL: the scrubbed value when a cursor is
   * placed, and otherwise the newest point — so the distribution is a reading
   * instrument like everything else on this screen rather than a picture. */
  const nowY = leadRead?.p ? leadRead.p.y : plot && plot.lead >= 0 ? (plot.drawn[plot.lead][plot.drawn[plot.lead].length - 1]?.y ?? null) : null;
  const words = spreadWords(sp, nowY ?? null, yFmt, invertY);
  const band = sp && sp.n >= SPREAD_SD_MIN && sp.sd > 0 && plot ? { a: plot.sy(sp.mean + sp.sd), b: plot.sy(sp.mean - sp.sd) } : null;

  const body: ReactNode = !plot ? (
    <text className="empty" x={W / 2} y={H / 2} textAnchor="middle">
      {empty}
    </text>
  ) : (
    <>
      {plot.yt.map((v) => (
        <g key={`y${v}`}>
          <line className="grid" x1={pad.l} x2={W - pad.r} y1={plot.sy(v)} y2={plot.sy(v)} />
          <text className="ax" x={pad.l - 5} y={plot.sy(v) + 3} textAnchor="end">
            {yFmt(v)}
          </text>
        </g>
      ))}
      {plot.xt.map((v) => (
        <text key={`x${v}`} className="ax" x={plot.sx(v)} y={H - pad.b + 12} textAnchor="middle">
          {xFmt(v)}
        </text>
      ))}
      <line className="axis" x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} />
      <line className="axis" x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} />
      {refY !== undefined && refY >= Math.min(plot.lo, plot.hi) && refY <= Math.max(plot.lo, plot.hi) && (
        <g>
          <line className="ref" x1={pad.l} x2={W - pad.r} y1={plot.sy(refY)} y2={plot.sy(refY)} />
          {refLabel && (
            <text className="axl" x={W - pad.r} y={plot.sy(refY) - 3} textAnchor="end">
              {refLabel}
            </text>
          )}
        </g>
      )}
      {/* THE SLAB AND THE RULE GO UNDER THE DATA, so the line stays the
        * brightest thing on the chart and the dots stay on top of both.
        * Min and max rather than an assumed order: on an inverted axis the
        * mean plus one deviation is the LOWER pixel. */}
      {band && sp && Math.min(H - pad.b, Math.max(band.a, band.b)) - Math.max(pad.t, Math.min(band.a, band.b)) > 0 ? (
        <rect
          className="sdband"
          x={pad.l}
          y={Math.max(pad.t, Math.min(band.a, band.b))}
          width={W - pad.r - pad.l}
          height={Math.min(H - pad.b, Math.max(band.a, band.b)) - Math.max(pad.t, Math.min(band.a, band.b))}
        />
      ) : null}
      {sp && plot.sy(sp.mean) >= pad.t && plot.sy(sp.mean) <= H - pad.b ? (
        <g>
          <line className="meanln" x1={pad.l} x2={W - pad.r} y1={plot.sy(sp.mean)} y2={plot.sy(sp.mean)} />
          {/* Anchored LEFT because the reference label is already anchored
            * right, and on a pace chart they would collide at exactly two
            * minutes, which is the commonest split on this machine. */}
          <text className="kdlbl" x={pad.l + 3} y={plot.sy(sp.mean) - 3} textAnchor="start">
            MEAN {yFmt(sp.mean)}
          </text>
        </g>
      ) : null}
      {series.map((x, i) => {
        const pts = plot.drawn[i];
        if (x.kind === "bars") {
          return (
            <g key={i}>
              {pts.map((p) => {
                const y = plot.sy(p.y);
                const on = reads[i]?.p?.x === p.x;
                return (
                  <rect
                    key={p.x}
                    className={on ? "bar bar-on" : "bar"}
                    x={plot.sx(p.x) - plot.barW / 2}
                    y={Math.min(y, plot.barBaseY)}
                    width={plot.barW}
                    height={Math.abs(plot.barBaseY - y)}
                  />
                );
              })}
            </g>
          );
        }
        const d = pts.map((p, j) => `${j ? "L" : "M"}${plot.sx(p.x).toFixed(1)} ${plot.sy(p.y).toFixed(1)}`).join(" ");
        return <path key={i} className={x.kind === "dashed" ? "ln2" : "ln"} d={d} />;
      })}
      {s.snapped !== null ? (
        <g>
          <line className="cur" x1={plot.sx(s.snapped)} x2={plot.sx(s.snapped)} y1={pad.t} y2={H - pad.b} />
          {reads.map((r, i) => (r.p ? <circle key={i} className="cdot" cx={plot.sx(r.p.x)} cy={plot.sy(r.p.y)} r={3.4} /> : null))}
        </g>
      ) : null}
    </>
  );

  const svg = (
    <svg ref={s.svgRef} className="eg-svg" viewBox={`0 0 ${W} ${H}`} style={f.zoom && f.box ? { width: `${W}px`, height: `${H}px` } : undefined} aria-hidden="true">
      {body}
      <text className="axl" x={W - pad.r} y={H - 3} textAnchor="end">
        {xLabel}
      </text>
      <text className="axl" x={pad.l} y={pad.t - 2} textAnchor="start">
        {yLabel}
      </text>
    </svg>
  );

  return (
    <div className="eg-chart">
      <div className="t">
        {/* THE WHOLE ROW GIVES ITSELF UP TO THE READING while a cursor is on
          * the chart: the title, the unit and the legend all step aside for
          * one line of numbers. Same row, same type, nothing jumps, no
          * floating box and no edge flipping — and HTML at a real font size,
          * not nine-unit SVG text rendering at seven pixels.
          *
          * IT TAKES THE TITLE SLOT TOO (review, 2026-09-17: in the four-up
          * stroke grid the title left 252px for a reading that wants 273,
          * and the second series value was being ellipsised away — on the
          * charts where two series is the whole point). Nothing is lost:
          * your cursor is on the chart you would be reading the name of. */}
        {panelRead ? (
          <span className="lg rd">{readLine}</span>
        ) : (
          <>
            <span>
              <b>{title}</b> {unit}
            </span>
            <span className="lg">{legend}</span>
          </>
        )}
      </div>

      {/* WHAT THE PIECE WAS MADE OF, in its own row and NOT inside the title
        * row above: that one reserves exactly two lines, and a third span at
        * nine pixels with wide tracking in a 300px column would wrap to a
        * third line and push every plot down under the pointer that asked
        * for it. HTML rather than SVG text, because a nine unit label
        * renders at about seven pixels in a panel and cannot be read. */}
      {words ? <div className={words.quiet ? "eg-chart-stat off" : "eg-chart-stat"}>{words.text}</div> : null}

      {f.zoom ? null : still ? (
        <div className="eg-chart-hit eg-chart-still">{svg}</div>
      ) : (
        <button type="button" ref={f.opener} className="eg-chart-hit" aria-label={`Open ${title} bigger`} onClick={s.openClick} {...s.handlers}>
          {svg}
        </button>
      )}

      {f.zoom ? (
        <ChartZoom
          title={title}
          unit={unit}
          legend={legend}
          reads={reads}
          moment={moment}
          xWord={word}
          delta={delta}
          span={span}
          plot={plot}
          snapped={s.snapped}
          plotRef={f.plotRef}
          handlers={s.handlers}
          keys={s.keys}
          valueText={readLine}
          spread={words ? words.text : null}
          onClose={() => f.setZoom(false)}
        >
          {svg}
        </ChartZoom>
      ) : null}
    </div>
  );
}

/* THE FORCE CURVES (owner, 2026-09-21: "for the force curve I want to see
 * it drawn out like it does on the erg — it draws every force curve. I want
 * the latest one in a nice white, but I would also like to see the average
 * of my force curves").
 *
 * EVERY STROKE THE PIECE HAS SENT, faint, on one frame — the PM5 does this
 * and it is the picture a rower learns their stroke from: a tight bundle is
 * a repeatable stroke, a wide one is not. Over the bundle the AVERAGE,
 * dashed, and over that the LATEST stroke, bright. The frame is normalised
 * to the drive — x is the share of the stroke, 0 to 1 — because strokes do
 * not all have the same number of samples and a raw index would smear a
 * short stroke over a long one. The y scale is the tallest peak in the
 * bundle, so the latest stroke reads against its own history rather than
 * against itself.
 *
 * Bounded: the last FORCE_DRAWN curves, each resampled to FORCE_GRID points,
 * which is a fixed few thousand line segments however long the piece. */
export const FORCE_DRAWN = 150;
export const FORCE_GRID = 48;

export type CurveLite = { n: number; points: number[] };

/* One stroke on the 0..1 frame, linear between its own samples. */
function resample(points: number[], n = FORCE_GRID): number[] {
  const out: number[] = [];
  const last = points.length - 1;
  if (last < 1) return out;
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * last;
    const j = Math.min(last - 1, Math.floor(t));
    const f = t - j;
    out.push(points[j] + (points[j + 1] - points[j]) * f);
  }
  return out;
}

export function ForceCurveChart({ curves, latest, newtons }: { curves: CurveLite[]; latest: ForceCurve | null; newtons: (lbf: number) => number }) {
  const f = useChartFrame();
  const { W, H, pad } = f.size(false, 240);

  /* The bundle, the average and the latest, all on the same frame. */
  const drawn = curves.slice(-FORCE_DRAWN).map((c) => resample(c.points)).filter((c) => c.length === FORCE_GRID);
  const avg: number[] = drawn.length ? Array.from({ length: FORCE_GRID }, (_, i) => drawn.reduce((a, c) => a + c[i], 0) / drawn.length) : [];
  const now = latest && latest.pointsLbf.length >= 2 ? resample(latest.pointsLbf) : [];

  /* The frame the pointer maps into is the LATEST stroke, so a hover reads
   * the stroke the rower just took; the average reads beside it. */
  const series: Series[] = [
    { points: now.map((v, i) => ({ x: i / (FORCE_GRID - 1), y: v })), kind: "line", label: "LATEST" },
    { points: avg.map((v, i) => ({ x: i / (FORCE_GRID - 1), y: v })), kind: "dashed", label: "AVERAGE" },
  ];
  const peak = Math.max(1, ...drawn.flat(), ...now);
  const plot = drawn.length || now.length ? computePlot(series, { W, H, pad, yMin: 0, yMax: peak * 1.08 }) : null;
  const sc = useChartScrub(plot, f.zoom, () => f.setZoom(true));

  const reads = readAt(plot, series, sc.snapped, (y) => String(Math.round(y)));
  const moment = sc.snapped === null ? null : `${Math.round(sc.snapped * 100)}%`;
  const readLine =
    moment === null
      ? "Force curves"
      : `DRIVE ${moment} · ${reads.map((r) => `${r.label} ${r.text}`).join(" · ")} LBF${reads[0]?.p ? ` · ${Math.round(newtons(reads[0].p.y))} N` : ""}`;

  const body: ReactNode = !plot ? (
    <text className="empty" x={W / 2} y={H / 2} textAnchor="middle">
      WAITING FOR A STROKE
    </text>
  ) : (
    <>
      {plot.yt.map((v) => (
        <g key={v}>
          <line className="grid" x1={pad.l} x2={W - pad.r} y1={plot.sy(v)} y2={plot.sy(v)} />
          <text className="ax" x={pad.l - 5} y={plot.sy(v) + 3} textAnchor="end">
            {Math.round(v)}
          </text>
        </g>
      ))}
      <line className="axis" x1={pad.l} x2={pad.l} y1={pad.t} y2={H - pad.b} />
      <line className="axis" x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} />
      {/* The bundle: every stroke, faint. Drawn first so everything else
        * sits on top of it. */}
      {drawn.map((c, k) => (
        <path key={k} className="fc-one" d={c.map((v, i) => `${i ? "L" : "M"}${plot.sx(i / (FORCE_GRID - 1)).toFixed(1)} ${plot.sy(v).toFixed(1)}`).join(" ")} />
      ))}
      {avg.length ? <path className="fc-avg" d={avg.map((v, i) => `${i ? "L" : "M"}${plot.sx(i / (FORCE_GRID - 1)).toFixed(1)} ${plot.sy(v).toFixed(1)}`).join(" ")} /> : null}
      {now.length ? <path className="fc-now" d={now.map((v, i) => `${i ? "L" : "M"}${plot.sx(i / (FORCE_GRID - 1)).toFixed(1)} ${plot.sy(v).toFixed(1)}`).join(" ")} /> : null}
      {latest && now.length ? (
        <text className="peak" x={pad.l + 4} y={pad.t + 12} textAnchor="start">
          PEAK {latest.peakLbf} LBF · {Math.round(newtons(latest.peakLbf))} N · {drawn.length} STROKES
        </text>
      ) : null}
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <text key={v} className="ax" x={plot.sx(v)} y={H - pad.b + 12} textAnchor="middle">
          {Math.round(v * 100)}%
        </text>
      ))}
      {sc.snapped !== null ? (
        <g>
          <line className="cur" x1={plot.sx(sc.snapped)} x2={plot.sx(sc.snapped)} y1={pad.t} y2={H - pad.b} />
          {reads.map((r, i) => (r.p ? <circle key={i} className="cdot" cx={plot.sx(r.p.x)} cy={plot.sy(r.p.y)} r={3.4} /> : null))}
        </g>
      ) : null}
    </>
  );

  const svg = (
    <svg ref={sc.svgRef} className="eg-svg" viewBox={`0 0 ${W} ${H}`} style={f.zoom && f.box ? { width: `${W}px`, height: `${H}px` } : undefined} aria-hidden="true">
      {body}
      <text className="axl" x={W - pad.r} y={H - 3} textAnchor="end">
        SHARE OF THE DRIVE
      </text>
      <text className="axl" x={pad.l} y={pad.t - 2} textAnchor="start">
        LBF
      </text>
    </svg>
  );

  const legend = `${drawn.length} STROKES · LATEST · AVERAGE`;

  return (
    <div className="eg-chart">
      <div className="t">
        {!f.zoom && sc.snapped !== null ? (
          <span className="lg rd">{readLine}</span>
        ) : (
          <>
            <span>
              <b>FORCE CURVES</b> LBF
            </span>
            <span className="lg">{legend}</span>
          </>
        )}
      </div>

      {f.zoom ? null : (
        <button type="button" ref={f.opener} className="eg-chart-hit" aria-label="Open the force curves bigger" onClick={sc.openClick} {...sc.handlers}>
          {svg}
        </button>
      )}

      {f.zoom ? (
        <ChartZoom
          title="Force curves"
          unit="LBF"
          legend={legend}
          reads={reads}
          moment={moment}
          xWord="DRIVE"
          delta={reads[0]?.p ? { k: "NEWTONS", v: `${Math.round(newtons(reads[0].p.y))} N` } : null}
          plot={plot}
          snapped={sc.snapped}
          plotRef={f.plotRef}
          handlers={sc.handlers}
          keys={sc.keys}
          valueText={readLine}
          onClose={() => f.setZoom(false)}
        >
          {svg}
        </ChartZoom>
      ) : null}
    </div>
  );
}

/* THE DISTRIBUTION, ON ITS OWN (owner, 2026-09-21: "there should be a view
 * that I can see the KDE on its own, not on the same chart as the line
 * chart. So it would be two different graphs"). The value along x, the
 * density up y, the mean as a rule, one standard deviation as a slab, and a
 * dot for where the latest value sits on its own hill. It is handed the
 * SAME points the line chart beside it draws, so the two can never describe
 * different strokes.
 *
 * On an inverted line chart (pace, faster is up) the value axis here still
 * runs left to right, low to high — so a faster pace is to the LEFT, and the
 * axis says so. */
export function DistChart({
  title,
  unit,
  points,
  fmt = fmtNum,
  invertY = false,
  small = false,
}: {
  title: string;
  unit: string;
  points: XY[];
  fmt?: (v: number) => string;
  invertY?: boolean;
  small?: boolean;
}) {
  const H = small ? 150 : 190;
  const W = VW;
  const pad = PAD;
  const cache = useRef<{ key: string; at: number; v: Spread | null }>({ key: "", at: 0, v: null });

  /* The same cache shape and the same clock as useSpread, for the same
   * reason: the kernel is the one thing on this page worth rationing. */
  const last = points.length ? points[points.length - 1] : null;
  const key = `${points.length}|${last ? last.x : 0}|${last ? last.y : 0}`;
  const now = typeof performance === "undefined" ? 0 : performance.now();
  if (cache.current.key !== key && now - cache.current.at >= SPREAD_EVERY_MS) {
    const ys = points.map((p) => p.y).filter((y) => Number.isFinite(y));
    const lo = ys.length ? Math.min(...ys) : 0;
    const hi = ys.length ? Math.max(...ys) : 1;
    cache.current = { key, at: now, v: computeSpread(points, "curve", [lo - (hi - lo) * 0.2 - 1e-6, hi + (hi - lo) * 0.2 + 1e-6]) };
  }
  const sp = cache.current.v;
  const nowY = last ? last.y : null;

  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;

  let body: ReactNode;
  if (!sp || !sp.xs || !sp.ys || sp.xs.length < 2) {
    body = (
      <text className="empty" x={W / 2} y={H / 2} textAnchor="middle">
        {sp && !(sp.sd > 0) ? "EVERY VALUE THE SAME" : sp ? `${sp.n} VALUES` : "WAITING FOR DATA"}
      </text>
    );
  } else {
    const xs = sp.xs;
    const ys = sp.ys;
    const x0 = xs[0];
    const x1 = xs[xs.length - 1];
    const sx = (v: number) => pad.l + ((v - x0) / (x1 - x0)) * pw;
    const sy = (d: number) => pad.t + (1 - d) * ph;
    const line = xs.map((v, i) => `${i ? "L" : "M"}${sx(v).toFixed(1)} ${sy(ys[i]).toFixed(1)}`).join(" ");
    const area = `${line} L${sx(x1).toFixed(1)} ${sy(0).toFixed(1)} L${sx(x0).toFixed(1)} ${sy(0).toFixed(1)} Z`;
    const xt = ticks(x0, x1, 4);
    const a = Math.max(pad.l, sx(sp.mean - sp.sd));
    const b = Math.min(W - pad.r, sx(sp.mean + sp.sd));
    body = (
      <>
        {b > a ? <rect className="sdband" x={a} y={pad.t} width={b - a} height={ph} /> : null}
        <line className="axis" x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} />
        <path className="kd" d={area} />
        <path className="kdln" d={line} />
        <line className="meanln" x1={sx(sp.mean)} x2={sx(sp.mean)} y1={pad.t} y2={H - pad.b} />
        <text className="kdlbl" x={sx(sp.mean) + 4} y={pad.t + 9} textAnchor="start">
          MEAN {fmt(sp.mean)}
        </text>
        {nowY !== null && nowY >= x0 && nowY <= x1 ? <circle className="kdot" cx={sx(nowY)} cy={sy(densityAt(sp, nowY))} r={3.6} /> : null}
        {xt.map((v) => (
          <text key={v} className="ax" x={sx(v)} y={H - pad.b + 12} textAnchor="middle">
            {fmt(v)}
          </text>
        ))}
      </>
    );
  }

  const words = spreadWords(sp, nowY, fmt, invertY);

  return (
    <div className="eg-chart eg-dist">
      <div className="t">
        <span>
          <b>{title}</b> {unit}
        </span>
        <span className="lg">DISTRIBUTION</span>
      </div>
      {words ? <div className={words.quiet ? "eg-chart-stat off" : "eg-chart-stat"}>{words.text}</div> : null}
      <div className="eg-chart-hit eg-chart-still">
        <svg className="eg-svg" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {body}
          <text className="axl" x={W - pad.r} y={H - 3} textAnchor="end">
            {invertY ? "FASTER TO THE LEFT" : unit}
          </text>
          <text className="axl" x={pad.l} y={pad.t - 2} textAnchor="start">
            DENSITY
          </text>
        </svg>
      </div>
    </div>
  );
}
