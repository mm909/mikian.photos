import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { PanResponder, Platform, Pressable, ScrollView, Text, View, type GestureResponderEvent, type LayoutChangeEvent, type TextStyle, type ViewStyle } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import type { Kde, KdeYou } from "./api";
import { mono } from "./site";
import { scrub } from "./ui";
import { C, F, fmtInt } from "./theme";

/* THE CHARTS, drawn from what the site's own stats and profile compute
 * (stats/field.ts, stats/distances.ts, the profile's pace points). The
 * server sends the curves; these draw them, in the site's manner: the
 * field as a pale ground, the rower in the blue, ink for the axis, mono
 * capitals for the words. No colour carries meaning on its own: every mark
 * is named in a line under the chart.
 *
 * Colours are read off C while drawing, never kept in a constant: the dark
 * look changes C in place (theme.ts). */

/* The width a chart has, measured, so SVG coordinates are real points. */
function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e) => setW(Math.round(e.nativeEvent.layout.width))];
}

/* The small grey capitals. A function, so the colour is today's. */
const small = (): TextStyle => ({ fontFamily: F.mono, fontSize: 10, letterSpacing: 1.2, color: C.gray });

/* A style only a browser understands (touch-action, user-select). */
const web = (s: Record<string, string>): ViewStyle | undefined => (Platform.OS === "web" ? (s as unknown as ViewStyle) : undefined);

const fin = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/* The value a share p of a sorted list sits under. */
function quantile(sorted: number[], p: number): number {
  if (!sorted.length) return NaN;
  const at = (sorted.length - 1) * p;
  const i = Math.floor(at);
  const j = Math.min(sorted.length - 1, i + 1);
  return sorted[i] + (sorted[j] - sorted[i]) * (at - i);
}

function area(xs: number[], ys: number[], sx: (x: number) => number, sy: (y: number) => number, base: number): { line: string; fill: string } | null {
  if (xs.length < 2) return null;
  let line = "";
  for (let i = 0; i < xs.length; i++) line += `${i ? "L" : "M"}${sx(xs[i]).toFixed(1)} ${sy(ys[i]).toFixed(1)}`;
  return { line, fill: `${line}L${sx(xs[xs.length - 1]).toFixed(1)} ${base}L${sx(xs[0]).toFixed(1)} ${base}Z` };
}

/* ONE FINGER ON A CHART. Two views share the work, because a view that
 * holds the touch is never asked again on a move:
 *
 *   surface  an empty view laid over the drawing. It takes the touch when
 *            it lands, so a tap is seen and x is measured against a view
 *            with nothing inside it. It does not block the page: a
 *            vertical drag still scrolls, and the chart hears `cancel`.
 *   pan      on the view around it. While `live()` is true it takes over
 *            the moment the finger goes sideways, and holds the page still
 *            so the drag is the chart's until the finger lifts.
 *
 * x is in the surface's own points: where the touch landed plus how far
 * the finger has gone across the page since, which reads the same on a
 * phone and in a browser. `hold` refuses to give the touch up (a mouse
 * dragging a scroller in a browser). */
type Touch = { x: number; dx: number; mouse: boolean; moved: boolean; taken: boolean };
type TouchHandlers = {
  live: () => boolean;
  down: (t: Touch) => void;
  move: (t: Touch) => void;
  up: (t: Touch) => void;
  cancel: () => void;
  hold?: (t: Touch) => boolean;
};

function useTouch(handlers: TouchHandlers) {
  const h = useRef(handlers);
  useEffect(() => {
    h.current = handlers;
  });
  const o = useRef<{ x0: number; px: number; py: number; mouse: boolean; moved: boolean; taken: boolean } | null>(null);
  return useMemo(() => {
    const read = (e: GestureResponderEvent): Touch | null => {
      const g = o.current;
      if (!g) return null;
      const dx = e.nativeEvent.pageX - g.px;
      if (Math.abs(dx) > 6 || Math.abs(e.nativeEvent.pageY - g.py) > 6) g.moved = true;
      return { x: g.x0 + dx, dx, mouse: g.mouse, moved: g.moved, taken: g.taken };
    };
    const pan = PanResponder.create({
      onMoveShouldSetPanResponder: (e) => {
        const g = o.current;
        if (!g || !h.current.live()) return false;
        const dx = Math.abs(e.nativeEvent.pageX - g.px);
        const dy = Math.abs(e.nativeEvent.pageY - g.py);
        if (dx <= 3 || dx <= dy) return false;
        g.taken = true;
        return true;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (e) => {
        const t = read(e);
        if (t) h.current.move(t);
      },
      onPanResponderRelease: (e) => {
        const t = read(e);
        o.current = null;
        if (t) h.current.up(t);
      },
      onPanResponderTerminate: () => {
        o.current = null;
        h.current.cancel();
      },
    });
    const surface = {
      /* This touch began on a chart: the tabs do not swipe under it. It
       * is over when the finger lifts, or the page takes it to scroll. */
      onTouchStart: () => {
        scrub.on = true;
        scrub.chart = true;
      },
      onTouchEnd: () => {
        scrub.on = false;
        scrub.chart = false;
      },
      onTouchCancel: () => {
        scrub.on = false;
        scrub.chart = false;
      },
      onStartShouldSetResponder: () => true,
      onResponderGrant: (e: GestureResponderEvent) => {
        const n = e.nativeEvent;
        /* A browser says which pointer it was; a phone has only fingers. */
        const kind = (n as unknown as { type?: string }).type ?? "";
        o.current = { x0: n.locationX, px: n.pageX, py: n.pageY, mouse: kind.startsWith("mouse"), moved: false, taken: false };
        const t = read(e);
        if (t) h.current.down(t);
      },
      onResponderMove: (e: GestureResponderEvent) => {
        const t = read(e);
        if (t && !t.taken) h.current.move(t);
      },
      onResponderRelease: (e: GestureResponderEvent) => {
        const t = read(e);
        o.current = null;
        if (t) h.current.up(t);
      },
      onResponderTerminationRequest: (e: GestureResponderEvent) => {
        const t = read(e);
        if (!t || t.taken) return true;
        return !h.current.hold?.(t);
      },
      /* Either the pan above took the touch (it carries on), or the page
       * began to scroll (the touch is over). */
      onResponderTerminate: () => {
        if (o.current?.taken) return;
        o.current = null;
        h.current.cancel();
      },
    };
    return { pan: pan.panHandlers, surface };
  }, []);
}

/* F(v), the share of a curve's mass at or under v, as the cumulative
 * trapezoid over its grid; and its inverse, the x a share sits at. */
function cdfOf(xs: number[], ys: number[]): { at: (v: number) => number; inv: (p: number) => number } {
  const n = xs.length;
  const cum = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + ((xs[i] - xs[i - 1]) * (ys[i] + ys[i - 1])) / 2;
  const total = cum[n - 1] ?? 0;
  return {
    at: (v) => {
      if (!(total > 0)) return NaN;
      if (v <= xs[0]) return 0;
      if (v >= xs[n - 1]) return 1;
      let i = 0;
      while (i < n - 2 && xs[i + 1] < v) i++;
      const t = (v - xs[i]) / (xs[i + 1] - xs[i] || 1);
      return (cum[i] + (cum[i + 1] - cum[i]) * t) / total;
    },
    inv: (p) => {
      if (!(total > 0)) return p < 0.5 ? xs[0] : xs[n - 1];
      const want = p * total;
      let i = 0;
      while (i < n - 2 && cum[i + 1] < want) i++;
      const span = cum[i + 1] - cum[i];
      return span > 0 ? xs[i] + ((want - cum[i]) / span) * (xs[i + 1] - xs[i]) : xs[i];
    },
  };
}

/* The part of a curve inside [lo, hi], its two ends interpolated onto the
 * edges, and its tallest point scaled to 1. */
function clip(xs: number[], ys: number[], lo: number, hi: number): { xs: number[]; ys: number[] } {
  const X: number[] = [];
  const Y: number[] = [];
  const cross = (i: number, v: number) => {
    const t = (v - xs[i - 1]) / (xs[i] - xs[i - 1] || 1);
    X.push(v);
    Y.push(ys[i - 1] + (ys[i] - ys[i - 1]) * t);
  };
  for (let i = 0; i < xs.length; i++) {
    if (i > 0 && xs[i - 1] < lo && xs[i] > lo) cross(i, lo);
    if (i > 0 && xs[i - 1] < hi && xs[i] > hi) cross(i, hi);
    if (xs[i] >= lo && xs[i] <= hi) {
      X.push(xs[i]);
      Y.push(ys[i]);
    }
  }
  const top = Math.max(0, ...Y);
  return { xs: X, ys: top > 0 ? Y.map((y) => y / top) : Y };
}

/* A rower's own density from their own marks, for the charts the server
 * sends no curve with. Silverman's bandwidth, widened for a small sample
 * and never narrower than a sixtieth of the frame, the way the site draws
 * the viewer's curve on the 5K and the 10K (stats/distances.ts). */
function ownCurve(vals: number[], lo: number, hi: number): { xs: number[]; ys: number[] } | null {
  const n = vals.length;
  if (n < 3 || !(hi > lo)) return null;
  const sorted = [...vals].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  const iqr = quantile(sorted, 0.75) - quantile(sorted, 0.25);
  const spread = Math.min(sd, iqr / 1.34) || sd;
  const h = Math.max(0.9 * spread * Math.pow(n, -0.2) * Math.max(1, Math.sqrt(12 / n)), (hi - lo) / 60);
  const N = 96;
  const xs = Array.from({ length: N }, (_, i) => lo + ((hi - lo) * i) / (N - 1));
  const ys = xs.map((x) => {
    let sum = 0;
    for (const v of sorted) sum += Math.exp(-0.5 * ((x - v) / h) ** 2);
    return sum;
  });
  const top = Math.max(...ys);
  return top > 0 ? { xs, ys: ys.map((y) => y / top) } : null;
}

/* Round values across [lo, hi], five at most. A clock axis steps in
 * seconds and minutes, any other in 1, 2, 2.5 and 5s. */
const CLOCK_STEPS = [1, 2, 5, 10, 15, 20, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200];
const PLAIN_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000, 100000];
function roundTicks(lo: number, hi: number, clock: boolean, most = 5): number[] {
  for (const s of clock ? CLOCK_STEPS : PLAIN_STEPS) {
    const first = Math.ceil(lo / s - 1e-9) * s;
    const count = Math.floor((hi - first) / s + 1e-9) + 1;
    if (count <= most) return Array.from({ length: Math.max(0, count) }, (_, i) => +(first + i * s).toFixed(6));
  }
  return [];
}

/* What the hairline snaps to: a second on a clock, else a round number of
 * about a sixtieth of the frame (50 m, 100 m). */
function snapStep(span: number, clock: boolean): number {
  if (clock || !(span > 0)) return 1;
  const raw = span / 60;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  return Math.max(1, raw >= 5 * p ? 5 * p : p);
}

/* What a density draws, worked out once per payload.
 *
 * THE FRAME (owner, 2026-11-21: "let's make some sensible cuts for the
 * x-axis ... if the tail is long right-sided, let's cut off that long
 * right-side tail earlier ... I don't want any of my rows to get cut off"):
 * the field's 1st to 97.5th percentile, read off its own curve, then
 * widened until every one of the rower's marks is inside with a little
 * air. A stranger's 4-minute split may fall off the right; the rower's own
 * best never does.
 *
 * THE ROWER'S CURVE: the server's when it sent one worth drawing, else one
 * made here from the rower's marks (three or more), else no curve and a
 * line at their middle. So a rower with rows always has something blue. */
function densityModel(kde: Kde, you: KdeYou | null) {
  const n = Math.min(kde.xs.length, kde.ys.length);
  if (n < 2) return null;
  const xs = kde.xs.slice(0, n);
  const ys = kde.ys.slice(0, n).map((y) => (fin(y) && y > 0 ? y : 0));
  const cdf = cdfOf(xs, ys);
  const g0 = xs[0];
  const g1 = xs[n - 1];
  let lo = cdf.inv(0.01);
  let hi = cdf.inv(0.975);
  /* A left edge that is nearly the grid's own start is the grid's start:
   * a length axis opens on 0, not on 180 m. */
  if (lo - g0 < 0.08 * (hi - g0)) lo = g0;
  const rug = you ? (you.rug ?? []).filter(fin) : [];
  const mine = you ? [...rug, you.best, you.median].filter(fin) : [];
  if (mine.length) {
    const a = Math.min(...mine);
    const b = Math.max(...mine);
    const air = 0.04 * (Math.max(hi, b) - Math.min(lo, a));
    lo = Math.min(lo, a - air);
    hi = Math.max(hi, b + air);
    if (g0 >= 0) lo = Math.max(0, lo);
  }
  if (!(hi > lo)) {
    lo = g0;
    hi = g1 > g0 ? g1 : g0 + 1;
  }
  const field = clip(xs, ys, lo, hi);
  let own: { xs: number[]; ys: number[] } | null = null;
  const sent = you?.ys;
  if (sent && sent.length === kde.xs.length && sent.some((y) => fin(y) && y > 0)) {
    const c = clip(xs, sent.slice(0, n).map((y) => (fin(y) && y > 0 ? y : 0)), lo, hi);
    if (c.xs.length >= 2 && c.ys.some((y) => y > 0)) own = c;
  }
  if (!own) own = ownCurve(rug, lo, hi);
  const sortedRug = [...rug].sort((p, q) => p - q);
  const middle = you ? (fin(you.median) ? you.median : sortedRug.length ? quantile(sortedRug, 0.5) : null) : null;
  return { lo, hi, cdf, field, own, rug, mark: own ? null : middle };
}

/* WHAT A SENTENCE UNDER A DENSITY IS WORKED OUT FROM (Stats.tsx): the share
 * of the field's rows at or under a value, the value a share of them sits
 * under, and the value the curve is tallest at, all read off the curve
 * that is drawn, as the hairline's own line is. NaN where there is no
 * curve to read. */
export function kdeAtShare(kde: Kde, p: number): number {
  const n = Math.min(kde.xs.length, kde.ys.length);
  if (n < 2) return NaN;
  const c = cdfOf(
    kde.xs.slice(0, n),
    kde.ys.slice(0, n).map((y) => (fin(y) && y > 0 ? y : 0)),
  );
  return fin(c.at(kde.xs[n - 1])) ? c.inv(p) : NaN;
}
export function kdeShareUnder(kde: Kde, v: number): number {
  const n = Math.min(kde.xs.length, kde.ys.length);
  if (n < 2 || !fin(v)) return NaN;
  return cdfOf(
    kde.xs.slice(0, n),
    kde.ys.slice(0, n).map((y) => (fin(y) && y > 0 ? y : 0)),
  ).at(v);
}
export function kdePeak(kde: Kde): number {
  const n = Math.min(kde.xs.length, kde.ys.length);
  let at = -1;
  for (let i = 0; i < n; i++) if (fin(kde.ys[i]) && (at < 0 || kde.ys[i] > kde.ys[at])) at = i;
  return at < 0 ? NaN : kde.xs[at];
}

/* A curve's height at x, between its points. */
function heightAt(c: { xs: number[]; ys: number[] }, x: number): number {
  const n = c.xs.length;
  if (n < 2 || x < c.xs[0] || x > c.xs[n - 1]) return 0;
  let i = 0;
  while (i < n - 2 && c.xs[i + 1] < x) i++;
  const t = (x - c.xs[i]) / (c.xs[i + 1] - c.xs[i] || 1);
  return c.ys[i] + (c.ys[i + 1] - c.ys[i]) * t;
}

/* A DENSITY: where the field's rows fall along one measure (length, pace,
 * a 5K time), with one rower's own rows as ticks under it and their own
 * curve in the blue over it. Each curve is drawn to its own height: height
 * is shape, not a count.
 *
 * It scrubs (owner, 2026-11-21: "I need to be able to scrub through the
 * thing"): a finger on the chart draws a hairline and prints, over the
 * chart, the value there and the share of the field it beats. A finger
 * that goes down the page scrolls the page and leaves no mark. */
export function Density({
  kde,
  you,
  fmt,
  /* TALLER (owner, 2026-11-23: "give more vertical space to the KDEs"):
   * 120 was a shape squashed flat on a phone. */
  height = 200,
  lowerIsBetter = false,
  title,
  note,
}: {
  kde: Kde;
  you?: KdeYou | null;
  fmt: (x: number) => string;
  height?: number;
  /* A pace or a time, where less is better: the readout says "faster
   * than", and counts the field to the right. */
  lowerIsBetter?: boolean;
  /* Printed over the chart, with the sample beside it in grey. */
  title?: string;
  note?: string;
}) {
  const [w, onLayout] = useWidth();
  const [cur, setCur] = useState<number | null>(null);
  const m = useMemo(() => densityModel(kde, you ?? null), [kde, you]);

  /* A finger shows the hairline once it has stayed a moment or gone
   * sideways, so a thumb scrolling the page past six charts does not
   * flash six hairlines. A mouse shows it at once. */
  const wait = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef({ on: false, x: 0 });
  const stop = () => {
    if (wait.current) clearTimeout(wait.current);
    wait.current = null;
    live.current.on = false;
  };
  useEffect(
    () => () => {
      if (wait.current) clearTimeout(wait.current);
    },
    [],
  );
  const touch = useTouch({
    live: () => true,
    down: (t) => {
      stop();
      live.current.x = t.x;
      if (t.mouse) {
        live.current.on = true;
        setCur(t.x);
        return;
      }
      wait.current = setTimeout(() => {
        live.current.on = true;
        setCur(live.current.x);
      }, 90);
    },
    move: (t) => {
      live.current.x = t.x;
      if (t.taken) live.current.on = true;
      if (live.current.on) setCur(t.x);
    },
    /* On a phone the mark goes when the finger lifts. In a browser it
     * stays until the next press, so a click can be read. */
    up: (t) => {
      stop();
      setCur(Platform.OS === "web" ? t.x : null);
    },
    cancel: () => {
      stop();
      setCur(null);
    },
  });

  const H = height;
  /* EVERY ROW AS A MARK under the curve (owner, 2026-11-22, of the stats
   * tab: "I would love some marks at the bottom showing the individual
   * dots"): the rower's own where the chart is about a rower, the field's
   * where it is about everybody. */
  const fieldRug = you || !m ? [] : (kde.rug ?? []).filter((x) => Number.isFinite(x) && x >= m.lo && x <= m.hi);
  const rugH = you || fieldRug.length ? 10 : 0;
  const top = 6;
  const base = H - rugH - 4;
  /* A clock axis is one whose labels are clocks. */
  const clock = lowerIsBetter || fmt(90).includes(":");
  const lo = m ? m.lo : 0;
  const hi = m ? m.hi : 1;
  const sx = (x: number) => ((x - lo) / (hi - lo)) * w;
  const sy = (y: number) => base - y * (base - top);
  const f = m && w ? area(m.field.xs, m.field.ys, sx, sy, base) : null;
  const y = m && m.own && w ? area(m.own.xs, m.own.ys, sx, sy, base) : null;
  const ticks = m && w ? roundTicks(lo, hi, clock) : [];

  /* The hairline: the value under the finger, snapped to a round one that
   * is still inside the frame, and the share of the field it beats. */
  let at: number | null = null;
  let read = "";
  if (m && w && cur !== null) {
    const step = snapStep(hi - lo, clock);
    let v = Math.round((lo + (Math.max(0, Math.min(w, cur)) / w) * (hi - lo)) / step) * step;
    if (v > hi) v -= step;
    if (v < lo) v += step;
    at = Math.max(lo, Math.min(hi, v));
    const under = m.cdf.at(at);
    const share = lowerIsBetter ? 1 - under : under;
    /* Capped at 99: the curve's own ends would otherwise claim the lot. */
    read = Number.isFinite(share) ? `${fmt(at)} · ${lowerIsBetter ? "faster" : "longer"} than ${Math.max(0, Math.min(99, Math.round(100 * share)))}% of rows` : fmt(at);
  }

  const LW = 52;
  return (
    <View onLayout={onLayout} style={web({ userSelect: "none" })}>
      {title ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 10, rowGap: 2, marginBottom: 4 }}>
          <Text style={mono(12, true, C.ink, 0.1)}>{title}</Text>
          {note ? <Text style={mono(10, false, C.gray, 0.1)}>{note}</Text> : null}
        </View>
      ) : null}
      <View style={{ minHeight: 18, justifyContent: "center" }}>
        {read ? (
          <Text numberOfLines={1} accessibilityLiveRegion="polite" style={mono(11, true, C.ink, 0.08)}>
            {read}
          </Text>
        ) : null}
      </View>
      {w && m ? (
        <View {...touch.pan} collapsable={false} style={{ width: w, height: H }}>
          <Svg width={w} height={H}>
            {f ? <Path d={f.fill} fill={C.line} opacity={0.55} /> : null}
            {f ? <Path d={f.line} stroke={C.soft} strokeWidth={1.5} fill="none" /> : null}
            {y ? <Path d={y.fill} fill={C.accent} opacity={0.12} /> : null}
            {y ? <Path d={y.line} stroke={C.accent} strokeWidth={2.5} fill="none" strokeLinejoin="round" /> : null}
            <Line x1={0} y1={base} x2={w} y2={base} stroke={C.ink} strokeWidth={2} />
            {m.rug.map((x, i) => (
              <Line key={i} x1={sx(x)} y1={base + 3} x2={sx(x)} y2={base + 3 + rugH} stroke={C.accent} strokeWidth={1.5} opacity={0.7} />
            ))}
            {fieldRug.map((x, i) => (
              <Line key={`f${i}`} x1={sx(x)} y1={base + 3} x2={sx(x)} y2={base + 3 + rugH} stroke={C.soft} strokeWidth={1} opacity={0.35} />
            ))}
            {m.mark !== null ? <Line x1={sx(m.mark)} y1={top} x2={sx(m.mark)} y2={base} stroke={C.accent} strokeWidth={2.5} /> : null}
            {at !== null ? <Line x1={sx(at)} y1={0} x2={sx(at)} y2={base} stroke={C.ink} strokeWidth={1} strokeDasharray="2 3" /> : null}
            {at !== null ? <Circle cx={sx(at)} cy={sy(heightAt(m.field, at))} r={3.5} fill={C.ink} /> : null}
          </Svg>
          {/* Never folded away: a view with no drawing of its own still has to be there to be touched. */}
          <View
            {...touch.surface}
            collapsable={false}
            accessibilityLabel={`${title ? `${title}. ` : ""}Drag across the chart to read a value.`}
            style={[{ position: "absolute", left: 0, top: 0, width: w, height: H }, web({ touchAction: "pan-y", cursor: "crosshair" })]}
          />
        </View>
      ) : (
        <View style={{ height: H }} />
      )}
      <View style={{ height: 16 }}>
        {ticks.map((t) => {
          const x = sx(t);
          const edge = x < LW / 2 ? "left" : x > w - LW / 2 ? "right" : "center";
          return (
            <Text key={t} numberOfLines={1} style={[small(), { position: "absolute", top: 2, width: LW, left: Math.max(0, Math.min(w - LW, x - LW / 2)), textAlign: edge }]}>
              {fmt(t)}
            </Text>
          );
        })}
      </View>
      {you ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 14, marginTop: 6 }}>
          <Text style={[small(), { color: C.accent, fontFamily: F.monoBold }]}>{m && m.own ? "━" : "│"} YOU</Text>
          <Text style={small()}>▒ EVERYONE</Text>
        </View>
      ) : null}
    </View>
  );
}

/* THE PACE, row by row (owner, 2026-11-21: "we're missing the x-axis
 * labels and y-axis on this chart"; "let's have it just show the last 20
 * rows and have it scrubbable"; "if there's a very large outlier, we can
 * remove it"; "we can keep the running average").
 *
 * The x axis is the rows in order, a step a row, newest on the right. The
 * pace axis stands still on the left, a label every ten seconds, faster at
 * the top; the plot beside it scrolls back in time. 20, 50 and ALL choose
 * how many rows fit the width. A dot is a row, the line is the running
 * average. A tap picks a row and prints it over the chart; where
 * everything fits and there is nothing to scroll, a drag does too. */
type PacePoint = { m: number; s: number; dayStr?: string };
type PaceDot = { m: number; s: number; rowM?: number; dayStr?: string };
type PaceRow = { i: number; s: number | null; avg: number | null; rowM?: number; dayStr?: string; cum?: number };

/* The rows a pace chart draws, and its pace range.
 *
 * A row far slower than the rest is left out (past the third quartile by
 * three times the middle spread, once there are eight rows to judge by):
 * two paddles at 5:33 would flatten every other row into one line. The
 * chart says how many went. When every row left carries its meters, the
 * running average is worked again without them, weighted by meters as the
 * site's is, so the line belongs to the dots under it. */
function paceModel(curve: PacePoint[], dots: PaceDot[]) {
  const n = Math.max(curve.length, dots.length);
  const all: PaceRow[] = [];
  for (let i = 0; i < n; i++) {
    const d = dots[i];
    const c = curve[i];
    all.push({ i, s: d && fin(d.s) ? d.s : null, avg: c && fin(c.s) ? c.s : null, rowM: d && fin(d.rowM) ? d.rowM : undefined, dayStr: d?.dayStr ?? c?.dayStr, cum: d && fin(d.m) ? d.m : c && fin(c.m) ? c.m : undefined });
  }
  const paces = all.flatMap((r) => (r.s === null ? [] : [r.s])).sort((a, b) => a - b);
  let fence = Infinity;
  if (paces.length >= 8) {
    const q1 = quantile(paces, 0.25);
    const q3 = quantile(paces, 0.75);
    fence = q3 + 3 * Math.max(q3 - q1, 1);
  }
  const rows = all.filter((r) => r.s === null || r.s <= fence);
  const left = all.length - rows.length;
  let again = false;
  if (left > 0 && rows.every((r) => r.s !== null && (r.rowM ?? 0) > 0)) {
    let meters = 0;
    let seconds = 0;
    for (const r of rows) {
      const rowM = r.rowM ?? 0;
      meters += rowM;
      seconds += ((r.s ?? 0) * rowM) / 500;
      r.avg = seconds / (meters / 500);
    }
    again = true;
  }
  const seen = rows.flatMap((r) => (r.s === null ? [] : [r.s]));
  const range = seen.length ? seen : rows.flatMap((r) => (r.avg === null ? [] : [r.avg]));
  if (rows.length < 2 || !range.length) return null;
  /* THE RANGE HUGS THE DOTS (owner, 2026-11-23: "its y-axis goes from 2
   * minutes to 150, but all of the dots on here are between 2 minutes and
   * 155 ... the bounds plus or minus some margin ... would get us a tighter
   * y range"): the slowest and the fastest with a tenth of the spread and at
   * least a second of air, never under four seconds tall. It used to round
   * out to whole tens of seconds. */
  const min = Math.min(...range);
  const max = Math.max(...range);
  const air = Math.max(1, (max - min) * 0.1);
  let lo = min - air;
  let hi = max + air;
  if (hi - lo < 4) {
    const mid = (lo + hi) / 2;
    lo = mid - 2;
    hi = mid + 2;
  }
  return { rows, lo, hi, left, again };
}

/* A word that chooses how many rows fit: grey, ink on a blue rule when on. */
function Fit({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Show ${label} rows`} accessibilityState={{ selected: on }} onPress={onPress} hitSlop={10} style={{ paddingVertical: 3, borderBottomWidth: 2, borderColor: on ? C.accent : "transparent" }}>
      <Text style={[small(), { fontFamily: F.monoBold, color: on ? C.ink : C.gray }]}>{label}</Text>
    </Pressable>
  );
}

const AXIS_W = 44;
const PAD_R = 8;
const PAD_Y = 8;
/* One drawing is never wider than about this: a long history is laid as
 * drawings side by side, because a phone will not draw one 6,000 points
 * wide. */
const TILE_W = 480;

export function PaceLine({ curve, dots, fmt, height = 220 }: { curve: PacePoint[]; dots: PaceDot[]; fmt: (s: number) => string; height?: number }) {
  const [w, onLayout] = useWidth();
  /* How many rows fit the width; 0 is all of them. */
  const [fit, setFit] = useState(20);
  const [sel, setSel] = useState<number | null>(null);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const offset = useRef(0);
  const from = useRef(0);
  const pin = useRef(true);
  const model = useMemo(() => paceModel(curve, dots), [curve, dots]);

  const H = height;
  const n = model ? model.rows.length : 0;
  const lo = model ? model.lo : 0;
  const hi = model ? model.hi : 10;
  const visW = Math.max(0, w - AXIS_W);
  const per = fit === 0 ? n : Math.min(fit, n);
  const step = per > 0 && visW > PAD_R ? (visW - PAD_R) / per : 1;
  const contentW = Math.max(visW, n * step + PAD_R);
  const scrollable = contentW > visW + 0.5;
  const sy = (s: number) => PAD_Y + ((s - lo) / (hi - lo)) * (H - 2 * PAD_Y);
  const cx = (i: number) => (i + 0.5) * step;
  const pick = (x: number) => setSel(Math.max(0, Math.min(n - 1, Math.floor(x / step))));

  const touch = useTouch({
    /* With nothing to scroll, a sideways drag is the chart's. */
    live: () => !scrollable,
    down: () => {
      from.current = offset.current;
    },
    move: (t) => {
      if (!scrollable) {
        if (t.taken || t.mouse) pick(t.x);
      } else if (t.mouse) {
        /* A mouse has no finger to fling with: its drag moves the plot. */
        pin.current = false;
        scroller.current?.scrollTo({ x: from.current - t.dx, animated: false });
      }
    },
    up: (t) => {
      if (!t.moved) pick(t.x);
    },
    cancel: () => {},
    /* The plot moving under a dragging mouse is not the touch ending. */
    hold: (t) => t.mouse && scrollable,
  });

  /* Open on the newest row, and go back to it when the fit changes. */
  useEffect(() => {
    pin.current = true;
    scroller.current?.scrollToEnd({ animated: false });
  }, [fit, w, n]);
  const startAt = useMemo(() => ({ x: Math.max(0, contentW - visW), y: 0 }), [contentW, visW]);

  const accent = C.accent;
  const soft = C.soft;
  const tiles = useMemo(() => {
    if (!model || !visW) return null;
    const rows = model.rows;
    const count = rows.length;
    const y = (s: number) => PAD_Y + ((s - model.lo) / (model.hi - model.lo)) * (H - 2 * PAD_Y);
    const each = Math.max(1, Math.floor(TILE_W / step));
    const tileCount = Math.max(1, Math.floor(count / each));
    const r = Math.max(1.2, Math.min(3, step * 0.3));
    return Array.from({ length: tileCount }, (_, t) => {
      const a = t * each;
      const b = t === tileCount - 1 ? count : a + each;
      const x0 = a * step;
      /* The line runs one row past each edge, so it meets the next drawing. */
      let d = "";
      let pen = false;
      for (let i = Math.max(0, a - 1); i <= Math.min(count - 1, b); i++) {
        const v = rows[i].avg;
        if (v === null) {
          pen = false;
          continue;
        }
        d += `${pen ? "L" : "M"}${((i + 0.5) * step - x0).toFixed(1)} ${y(v).toFixed(1)}`;
        pen = true;
      }
      const last = b === count ? rows[count - 1] : null;
      return (
        <Svg key={t} width={(b - a) * step + (b === count ? PAD_R : 0)} height={H}>
          {rows.slice(a, b).map((row, k) => (row.s === null ? null : <Circle key={k} cx={(a + k + 0.5) * step - x0} cy={y(row.s)} r={r} fill={soft} opacity={0.5} />))}
          {d ? <Path d={d} stroke={accent} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : null}
          {last && last.avg !== null ? <Circle cx={(count - 0.5) * step - x0} cy={y(last.avg)} r={4.5} fill={accent} /> : null}
        </Svg>
      );
    });
  }, [model, visW, step, H, accent, soft]);

  if (!model || n < 2) return null;
  const rows = model.rows;

  /* A label every ten seconds; fewer when they would sit on each other. */
  /* A RULE EVERY FIVE SECONDS (owner, 2026-11-23: "It was only a vertical
   * marking for y-axis at 2 minutes and at 150, but we should definitely
   * have at least every 5"): the rules every 5 s while they stand 6 px
   * apart, the labels on the fewest of them that keep 15 px apart. */
  const px = (g: number) => ((H - 2 * PAD_Y) * g) / (hi - lo);
  const STEPS = [1, 2, 5, 10, 20, 30, 60, 120, 300, 600];
  const gap = STEPS.find((g) => px(g) >= 22) ?? 600;
  /* And as many lines between the labels as stand 10 px apart. */
  const fine = STEPS.find((g) => px(g) >= 10 && gap % g === 0) ?? gap;
  const marks: number[] = [];
  for (let v = Math.ceil(lo / gap) * gap; v <= hi + 1e-6; v += gap) marks.push(v);
  const rules: number[] = [];
  for (let v = Math.ceil(lo / fine) * fine; v <= hi + 1e-6; v += fine) rules.push(v);
  const axisWord = (s: number) => fmt(s).replace(/\.0$/, "");

  /* The date under every few rows, counted back from the newest. */
  const DW = 60;
  const every = Math.max(1, Math.ceil(64 / step));
  const dated: number[] = [];
  for (let i = n - 1; i >= 0; i -= every) dated.push(i);

  /* What the line over the chart reads: the picked row, else the newest. */
  const at = Math.min(sel ?? n - 1, n - 1);
  const row = rows[at];
  const read = [row.dayStr ?? `Row ${row.i + 1}`, row.rowM ? `${fmtInt(row.rowM)} m` : "", row.s !== null ? fmt(row.s) : "", row.avg !== null ? `avg ${fmt(row.avg)}` : ""].filter(Boolean).join(" · ");
  const fits = n > 20 ? [20, ...(n > 50 ? [50] : []), 0] : [];

  return (
    <View onLayout={onLayout} style={web({ userSelect: "none" })}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 12, rowGap: 4, minHeight: 22, marginBottom: 6 }}>
        <Text accessibilityLiveRegion="polite" style={mono(11, true, C.ink, 0.08)}>
          {read}
        </Text>
        {fits.length ? (
          <View style={{ flexDirection: "row", alignItems: "center", columnGap: 14 }}>
            <Text style={small()}>ROWS</Text>
            {fits.map((k) => (
              <Fit key={k} label={k ? String(k) : "ALL"} on={fit === k} onPress={() => setFit(k)} />
            ))}
          </View>
        ) : null}
      </View>
      {w ? (
        <View style={{ flexDirection: "row" }}>
          <View style={{ width: AXIS_W, height: H }}>
            {marks.map((v) => (
              <Text key={v} numberOfLines={1} style={[small(), { position: "absolute", right: 6, top: sy(v) - 7, lineHeight: 14, letterSpacing: 0.4 }]}>
                {axisWord(v)}
              </Text>
            ))}
          </View>
          <View {...touch.pan} collapsable={false} style={{ width: visW }}>
            {/* The rules stand still behind the plot: they are the same at every row. */}
            <Svg width={visW} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
              {rules.map((v) => (
                <Line key={v} x1={0} y1={sy(v)} x2={visW} y2={sy(v)} stroke={C.line} strokeWidth={marks.includes(v) ? 1 : 0.6} strokeDasharray="3 4" />
              ))}
              <Line x1={0} y1={H - 1} x2={visW} y2={H - 1} stroke={C.ink} strokeWidth={2} />
            </Svg>
            <ScrollView
              ref={scroller}
              horizontal
              scrollEnabled={scrollable}
              showsHorizontalScrollIndicator={false}
              contentOffset={startAt}
              scrollEventThrottle={16}
              onScroll={(e) => {
                offset.current = e.nativeEvent.contentOffset.x;
              }}
              onScrollBeginDrag={() => {
                pin.current = false;
              }}
              onContentSizeChange={() => {
                if (pin.current) scroller.current?.scrollToEnd({ animated: false });
              }}
            >
              <View style={{ width: contentW }}>
                <View style={{ flexDirection: "row", height: H }}>{tiles}</View>
                {sel !== null ? <View pointerEvents="none" style={{ position: "absolute", left: cx(at) - 0.5, top: 0, width: 1, height: H - 2, backgroundColor: C.ink, opacity: 0.45 }} /> : null}
                {/* The picked row's dot, ringed and filled grey right through
                    (owner, 2026-11-23: "inside the circle should be all gray,
                    but instead it's like gray and a section of black"): the
                    ring was hollow, so the hairline showed through it. */}
                {sel !== null && row.s !== null ? <View pointerEvents="none" style={{ position: "absolute", left: cx(at) - 6, top: sy(row.s) - 6, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: C.ink, backgroundColor: C.gray }} /> : null}
                {sel !== null && row.avg !== null && row.avg >= lo && row.avg <= hi ? (
                  <View pointerEvents="none" style={{ position: "absolute", left: cx(at) - 4, top: sy(row.avg) - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent, borderWidth: 1, borderColor: C.paper }} />
                ) : null}
                <View
                  {...touch.surface}
                  collapsable={false}
                  accessibilityLabel="Pace of each row. Tap a row to read it."
                  style={[{ position: "absolute", left: 0, top: 0, width: contentW, height: H }, scrollable ? web({ cursor: "grab" }) : web({ touchAction: "pan-y", cursor: "crosshair" })]}
                />
                <View style={{ height: 20 }}>
                  {dated.map((i) => (
                    <View key={i} style={{ position: "absolute", left: cx(i) - 0.5, top: 0, width: 1, height: 4, backgroundColor: C.gray }} />
                  ))}
                  {dated.map((i) => {
                    const x = cx(i);
                    const edge = x < DW / 2 ? "left" : x > contentW - DW / 2 ? "right" : "center";
                    return (
                      <Text key={i} numberOfLines={1} style={[small(), { position: "absolute", top: 5, width: DW, left: Math.max(0, Math.min(contentW - DW, x - DW / 2)), textAlign: edge, letterSpacing: 0.6 }]}>
                        {/* Meters rowed by then (owner, 2026-11-22: "the x-axis
                            on the rows, I think, should be meters, not days"). */}
                        {rows[i].cum !== undefined ? `${rows[i].cum! >= 10000 ? Math.round(rows[i].cum! / 1000) : Math.round(rows[i].cum! / 100) / 10}K M` : (rows[i].dayStr ?? `#${rows[i].i + 1}`).toUpperCase()}
                      </Text>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      ) : (
        <View style={{ height: H + 20 }} />
      )}
      {/* No key under it (owner, 2026-11-23: "we can remove each row in the
          running average ... we don't need that copy"); the head over the
          chart says how many rows it is. Taller too: 150 was cramped. */}
      {model.left ? (
        <Text style={[small(), { marginTop: 4 }]}>
          {model.left} SLOW {model.left === 1 ? "ROW" : "ROWS"} LEFT OUT{model.again ? " OF THE CHART AND ITS AVERAGE" : ""}
        </Text>
      ) : null}
    </View>
  );
}

/* A MONTH AS A CALENDAR, the site's (Heatmap.tsx): a square a day in four
 * shades of the blue, the day's metres printed in it ("228k"), a day with
 * nothing a dashed empty square, and the scale named under it. `marks` are
 * the metre thresholds between the shades. */
const kilo = (m: number) => (m >= 1000 ? `${Math.round(m / 1000)}k` : `${m}`);
const SHADES = [0.32, 0.55, 0.78, 1];

export function MonthGrid({ month, byDay, today, marks }: { month: { key: string; firstDow: number; days: number }; byDay: Record<string, number>; today?: number; marks: [number, number, number] }) {
  const cells: (number | null)[] = [...Array.from({ length: month.firstDow }, () => null), ...Array.from({ length: month.days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const shade = (m: number) => (m <= 0 ? -1 : m < marks[0] ? 0 : m < marks[1] ? 1 : m < marks[2] ? 2 : 3);
  return (
    <View>
      <View style={{ flexDirection: "row", marginBottom: 6 }}>
        {"SMTWTFS".split("").map((l, i) => (
          <Text key={i} style={[small(), { flex: 1, textAlign: "center" }]}>
            {l}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={{ flexDirection: "row", gap: 5, marginBottom: 5 }}>
          {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
            if (d === null) return <View key={i} style={{ flex: 1, aspectRatio: 1.15 }} />;
            const m = byDay[`${month.key}-${String(d).padStart(2, "0")}`] ?? 0;
            const s = shade(m);
            const future = today !== undefined && d > today;
            return (
              <View key={i} accessibilityLabel={`${d}: ${m.toLocaleString("en-US")} meters`} style={{ flex: 1, aspectRatio: 1.15, alignItems: "center", justifyContent: "center", borderWidth: s < 0 ? 1 : 0, borderStyle: "dashed", borderColor: C.line, opacity: future ? 0.5 : 1 }}>
                {s >= 0 ? <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: C.accent, opacity: SHADES[s] }} /> : null}
                {s >= 0 ? <Text style={{ fontFamily: F.monoBold, fontSize: 11, color: s >= 2 ? "#fff" : C.ink }}>{kilo(m)}</Text> : null}
              </View>
            );
          })}
        </View>
      ))}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
        <Text style={[small(), { marginRight: 4 }]}>LESS</Text>
        <View style={{ width: 12, height: 12, borderWidth: 1, borderStyle: "dashed", borderColor: C.line }} />
        {SHADES.map((o) => (
          <View key={o} style={{ width: 12, height: 12, backgroundColor: C.accent, opacity: o }} />
        ))}
        <Text style={[small(), { marginLeft: 4 }]}>MORE</Text>
      </View>
    </View>
  );
}

/* THE HOURS: one row a day, one cell an hour, darker the more rows landed
 * in it. Hours run from 3 a.m. so a late night stays on its own day.
 *
 * The cells are squares (owner, 2026-11-21: "looks a little cramped on the
 * y-axis ... Maybe we can make them squares"): a side is the width left
 * for the grid over its 24 columns, so a month stands as tall as it needs.
 * The hours are named over the grid, as the site has them, and the day of
 * the month down the left, the first and every fifth. */
const hourWord = (h: number) => (h === 0 ? "12 AM" : h === 12 ? "NOON" : h < 12 ? `${h} AM` : `${h - 12} PM`);

export function HourGrid({ grid, start = 3, dayLabels = true }: { grid: number[][]; start?: number; dayLabels?: boolean }) {
  const [w, onLayout] = useWidth();
  const max = Math.max(1, ...grid.flat());
  const gutter = dayLabels ? 20 : 0;
  const side = Math.max(0, w - gutter) / 24;
  const order = Array.from({ length: 24 }, (_, i) => (i + start) % 24);
  return (
    <View onLayout={onLayout}>
      {w ? (
        <>
          <View style={{ height: 16, marginLeft: gutter }}>
            {[0, 6, 12, 18].map((k) => (
              <Text key={k} numberOfLines={1} style={[small(), { position: "absolute", left: k * side, top: 0 }]}>
                {hourWord((start + k) % 24)}
              </Text>
            ))}
            <Text numberOfLines={1} style={[small(), { position: "absolute", right: 0, top: 0 }]}>
              {hourWord(start % 24)}
            </Text>
          </View>
          <View style={{ flexDirection: "row" }}>
            {dayLabels ? (
              <View style={{ width: gutter, height: grid.length * side }}>
                {grid.map((_, r) =>
                  r === 0 || (r + 1) % 5 === 0 ? (
                    <Text key={r} numberOfLines={1} style={[small(), { position: "absolute", right: 5, top: r * side + (side - 12) / 2, lineHeight: 12, letterSpacing: 0 }]}>
                      {r + 1}
                    </Text>
                  ) : null,
                )}
              </View>
            ) : null}
            <Svg width={w - gutter} height={grid.length * side}>
              {grid.map((row, r) =>
                order.map((h, c) => {
                  const v = row[h] ?? 0;
                  return <Rect key={`${r}-${c}`} x={c * side + 0.5} y={r * side + 0.5} width={Math.max(0, side - 1)} height={Math.max(0, side - 1)} fill={v ? C.accent : C.pale} opacity={v ? 0.3 + 0.7 * (v / max) : 1} />;
                }),
              )}
            </Svg>
          </View>
        </>
      ) : null}
    </View>
  );
}

/* Columns: one value a slot, the tallest named. */
export function Columns({ values, height = 70, accent }: { values: number[]; height?: number; accent?: number }) {
  const max = Math.max(1, ...values);
  return (
    <View style={{ height, flexDirection: "row", alignItems: "flex-end", gap: 2, borderBottomWidth: 2, borderColor: C.ink }}>
      {values.map((v, i) => (
        <View key={i} style={{ flex: 1, height: `${Math.max(v ? 3 : 0, (v / max) * 100)}%`, backgroundColor: i === accent ? C.accent : C.ink }} />
      ))}
    </View>
  );
}
