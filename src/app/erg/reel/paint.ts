import { calHrFromWatts, frameAt, wattsFromPace, type ReelFrame, type ReelSeries } from "./series";

/* THE REEL PAINTERS (owner, 2026-11-13). One canvas, one frame of one clip:
 * the studio calls paintClip every animation frame with the row time it
 * wants, and what is on the canvas is what the recorder films.
 *
 * A VIDEO HAS NO ALPHA, so a clip meant to sit over footage is painted on a
 * key colour (green by default) and keyed out in the editor. On a key
 * ground NOTHING IS SEMI-TRANSPARENT — a half-clear pixel is a half-green
 * pixel — so every colour here is solid and legibility over footage comes
 * from a hard ink outline instead of a shadow.
 *
 * NO ADDRESS, NO HANDLE on any of it (owner, 2026-10-14). */

export type ClipId = "meters" | "clock" | "pace" | "stack" | "stroke" | "monitor";
export type BgId = "green" | "blue" | "black" | "brown" | "cream" | "clear";
export type UnitId = "pace" | "watts" | "cal";
export type ScreenId = "all" | "large" | "force" | "bars";
export type Fonts = { black: string; sans: string; mono: string };

export type PaintOpts = {
  clip: ClipId;
  bg: BgId;
  unit: UnitId;
  screen: ScreenId;
  /* The month's metres before this row; 0 counts the row alone. */
  startTotal: number;
  /* "ROWVEMBER" — the word over the running total. */
  label: string;
  /* The stretch of the row the clip covers, for the pace graph's x axis. */
  fromS: number;
  toS: number;
  fonts: Fonts;
  /* Picked colours for the big numbers and for the labels; null leaves the
   * ground's own (owner, 2026-11-13: the brown label "doesn't show well"). */
  numColor: string | null;
  labColor: string | null;
  /* A line over the clip, and/or the month's mark over that. */
  title: string;
  mark: CanvasImageSource | null;
  markRatio: number;
};

type Theme = { ground: string | null; fg: string; dim: string; accent: string; label: string; outline: string | null };

const INK = "#15171a";
const THEMES: Record<BgId, Theme> = {
  green: { ground: "#00ff00", fg: "#ffffff", dim: "#ffffff", accent: "#e0a070", label: "#ffffff", outline: INK },
  blue: { ground: "#0000ff", fg: "#ffffff", dim: "#ffffff", accent: "#e0a070", label: "#ffffff", outline: INK },
  clear: { ground: null, fg: "#ffffff", dim: "#ffffff", accent: "#e0a070", label: "#ffffff", outline: INK },
  black: { ground: "#000000", fg: "#ffffff", dim: "#a8a8a8", accent: "#c98a5a", label: "#c98a5a", outline: null },
  brown: { ground: "#33241b", fg: "#f3ecdd", dim: "#b9a48f", accent: "#c98a5a", label: "#c98a5a", outline: null },
  cream: { ground: "#f3ecdd", fg: "#2b1d14", dim: "#7a6655", accent: "#8a5a35", label: "#8a5a35", outline: null },
};

export const BG_SWATCH: Record<BgId, string> = { green: "#00ff00", blue: "#0000ff", black: "#000000", brown: "#33241b", cream: "#f3ecdd", clear: "transparent" };

/* ---- words and numbers -------------------------------------------------- */

export const fmtInt = (v: number): string => Math.round(v).toLocaleString("en-US");

/* `pad` keeps two minute digits ("09:59.9") so a clock that will reach ten
 * minutes holds one width from the first frame (owner, 2026-11-13). */
export function fmtClock(seconds: number, tenths = true, pad = false): string {
  const t = Math.max(0, Math.floor(seconds * 10 + 1e-6));
  const h = Math.floor(t / 36000);
  const m = Math.floor((t % 36000) / 600);
  const s = Math.floor((t % 600) / 10);
  const body = `${h || pad ? String(m).padStart(2, "0") : m}:${String(s).padStart(2, "0")}${tenths ? `.${t % 10}` : ""}`;
  return h ? `${h}:${body}` : body;
}

export const fmtPace = (pace: number): string => (pace > 0 && pace < 600 ? fmtClock(pace) : "-:--.-");

/* The rower's effort in the unit the monitor is set to. */
function effort(pace: number, watts: number, unit: UnitId): { v: string; u: string } {
  const w = watts > 0 ? watts : wattsFromPace(pace);
  if (unit === "watts") return { v: w > 0 ? fmtInt(w) : "---", u: "watt" };
  if (unit === "cal") return { v: w > 0 ? fmtInt(calHrFromWatts(w)) : "---", u: "cal/hr" };
  return { v: fmtPace(pace), u: "/500m" };
}

type Ctx = CanvasRenderingContext2D;

/* The hard edge under a colour on a key ground: ink under anything light,
 * white under ink. Null where the ground needs none. */
function edge(T: Theme, color: string): string | null {
  if (!T.outline) return null;
  return color.toLowerCase() === INK || color === "#000000" ? "#ffffff" : T.outline;
}
type Align = "left" | "center" | "right";

function spacing(ctx: Ctx, px: number) {
  (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
}

/* Digits in equal cells, so a number that is counting does not shiver. */
function cells(ctx: Ctx, s: string): { w: number[]; total: number } {
  const cell = ctx.measureText("0").width;
  const w = Array.from(s).map((ch) => (ch >= "0" && ch <= "9" ? cell : ctx.measureText(ch).width));
  return { w, total: w.reduce((a, b) => a + b, 0) };
}

/* A number in the display face. Returns the width it took. */
function num(ctx: Ctx, T: Theme, fonts: Fonts, s: string, x: number, y: number, size: number, align: Align, color: string, maxW = 0): number {
  spacing(ctx, 0);
  ctx.font = `400 ${size}px ${fonts.black}`;
  let c = cells(ctx, s);
  if (maxW > 0 && c.total > maxW) {
    size = (size * maxW) / c.total;
    ctx.font = `400 ${size}px ${fonts.black}`;
    c = cells(ctx, s);
  }
  const x0 = align === "center" ? x - c.total / 2 : align === "right" ? x - c.total : x;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const chars = Array.from(s);
  const pass = (fn: (ch: string, cx: number) => void) => {
    let cx = x0;
    chars.forEach((ch, i) => {
      fn(ch, cx + c.w[i] / 2);
      cx += c.w[i];
    });
  };
  const e = edge(T, color);
  if (e) {
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(4, size * 0.11);
    ctx.strokeStyle = e;
    pass((ch, cx) => ctx.strokeText(ch, cx, y));
  }
  ctx.fillStyle = color;
  pass((ch, cx) => ctx.fillText(ch, cx, y));
  return c.total;
}

/* A label in the mono, capitals, tracked. */
function lab(ctx: Ctx, T: Theme, fonts: Fonts, s: string, x: number, y: number, size: number, align: Align, color: string): number {
  ctx.font = `700 ${size}px ${fonts.mono}`;
  spacing(ctx, size * 0.12);
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  const text = s.toUpperCase();
  const e = edge(T, color);
  if (e) {
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(4, size * 0.18);
    ctx.strokeStyle = e;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  const w = ctx.measureText(text).width;
  spacing(ctx, 0);
  return w;
}

/* "2:05.3 /500m": a number with its unit trailing, centred as one thing. */
function pair(ctx: Ctx, T: Theme, fonts: Fonts, value: string, unit: string, x: number, y: number, size: number, color: string) {
  ctx.font = `400 ${size}px ${fonts.black}`;
  spacing(ctx, 0);
  const vw = cells(ctx, value).total;
  const us = size * 0.4;
  ctx.font = `700 ${us}px ${fonts.mono}`;
  spacing(ctx, us * 0.12);
  const uw = ctx.measureText(unit.toUpperCase()).width;
  spacing(ctx, 0);
  const gap = size * 0.16;
  const x0 = x - (vw + gap + uw) / 2;
  num(ctx, T, fonts, value, x0, y, size, "left", color);
  lab(ctx, T, fonts, unit, x0 + vw + gap, y, us, "left", T.dim);
}

/* A smooth line through points, optionally only the first `part` of it. */
function curve(ctx: Ctx, pts: [number, number][], part = 1) {
  const n = Math.max(2, Math.ceil((pts.length - 1) * part) + 1);
  const p = pts.slice(0, Math.min(pts.length, n));
  if (p.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i][0] + p[i + 1][0]) / 2;
    const my = (p[i][1] + p[i + 1][1]) / 2;
    ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my);
  }
  ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
}

function line(ctx: Ctx, T: Theme, color: string, width: number) {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const e = edge(T, color);
  if (e) {
    ctx.strokeStyle = e;
    ctx.lineWidth = width * 2.1;
    ctx.stroke();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function forcePoints(series: ReelSeries, points: number[], x: number, y: number, w: number, h: number): [number, number][] {
  const span = Math.max(2, series.maxPoints) - 1;
  const top = Math.max(1, series.maxForce) * 1.05;
  return points.map((p, i) => [x + (i / span) * w, y + h - (Math.max(0, p) / top) * h]);
}

/* ---- the pace graph's memory ------------------------------------------- */

type PaceShape = { key: string; pts: { t: number; pace: number }[]; lo: number; hi: number; avg: number };
let paceShape: PaceShape | null = null;
const shapes = new WeakMap<ReelSeries, PaceShape>();

function paceOf(series: ReelSeries, fromS: number, toS: number): PaceShape {
  const key = `${fromS}|${toS}`;
  const kept = shapes.get(series);
  if (kept && kept.key === key) return kept;
  const raw = series.ticks.filter((k) => k.pace > 0 && k.pace < 600);
  /* Five ticks of smoothing: the monitor's pace jumps stroke to stroke and a
   * time-lapse of that is noise. */
  const smooth = raw.map((k, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(raw.length - 1, i + 2); j++) {
      sum += raw[j].pace;
      n++;
    }
    return { t: k.t, pace: sum / n };
  });
  const pts = smooth.filter((k) => k.t >= fromS && k.t <= toS);
  const sorted = pts.map((k) => k.pace).sort((a, b) => a - b);
  const q = (f: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(f * (sorted.length - 1))))] ?? 120;
  const lo = q(0.02);
  const hi = q(0.98);
  const pad = Math.max(1.5, (hi - lo) * 0.25);
  const a = frameAt(series, fromS);
  const b = frameAt(series, toS);
  const avg = b.m - a.m > 1 ? ((b.t - a.t) / (b.m - a.m)) * 500 : (lo + hi) / 2;
  paceShape = { key, pts, lo: lo - pad, hi: hi + pad, avg };
  shapes.set(series, paceShape);
  return paceShape;
}

/* ---- the clips ---------------------------------------------------------- */

export function paintClip(ctx: Ctx, W: number, H: number, series: ReelSeries, f: ReelFrame, o: PaintOpts) {
  const T: Theme = { ...THEMES[o.bg] };
  if (o.numColor) T.fg = o.numColor;
  if (o.labColor) {
    T.label = o.labColor;
    T.dim = o.labColor;
  }
  const pad = series.totalS >= 600;
  ctx.clearRect(0, 0, W, H);
  if (T.ground) {
    ctx.fillStyle = T.ground;
    ctx.fillRect(0, 0, W, H);
  }
  const s = W / 1080;
  const cx = W / 2;
  const cy = H / 2;
  const fonts = o.fonts;

  /* THE TITLE, over whatever the clip is: a line of type, the month's mark,
   * or the mark with the line under it. It sits a fixed gap above the
   * clip's own top edge, and never off the sheet. */
  if (o.title || o.mark) {
    const reach = o.clip === "meters" ? 250 : o.clip === "clock" ? 210 : o.clip === "stack" ? 405 : o.clip === "pace" ? 490 : o.clip === "stroke" ? 380 : Math.min(H * 0.92, W * 0.9 * 0.94) / 2 / s;
    const mw = 520 * s;
    const mh = o.mark ? mw / o.markRatio : 0;
    const need = (o.title ? 70 : 0) * s + (o.mark ? mh + 30 * s : 0);
    let y = Math.max(40 * s + need, cy - reach * s - 70 * s);
    if (o.title) {
      lab(ctx, T, fonts, o.title, cx, y, 50 * s, "center", T.fg);
      y -= 86 * s;
    }
    if (o.mark) ctx.drawImage(o.mark, cx - mw / 2, y - mh, mw, mh);
  }

  if (o.clip === "meters") {
    const running = o.startTotal > 0;
    lab(ctx, T, fonts, running ? `${o.label} meters` : "Meters", cx, cy - 190 * s, 44 * s, "center", T.label);
    num(ctx, T, fonts, fmtInt(o.startTotal + Math.floor(f.m)), cx, cy + 40 * s, 250 * s, "center", T.fg, W * 0.88);
    pair(ctx, T, fonts, fmtPace(f.avgPace), "avg /500m", cx, cy + 170 * s, 92 * s, T.fg);
    if (running) lab(ctx, T, fonts, `+${fmtInt(Math.floor(f.m))} m today`, cx, cy + 260 * s, 40 * s, "center", T.dim);
    return;
  }

  if (o.clip === "clock") {
    lab(ctx, T, fonts, "Elapsed", cx, cy - 150 * s, 44 * s, "center", T.label);
    num(ctx, T, fonts, fmtClock(f.t, true, pad), cx, cy + 80 * s, 280 * s, "center", T.fg, W * 0.88);
    return;
  }

  if (o.clip === "stack") {
    const total = o.startTotal + Math.floor(f.m);
    const cellsOf: [string, string][] = [
      [o.startTotal > 0 ? `${o.label} m` : "Meters", fmtInt(total)],
      ["Time", fmtClock(f.t, true, pad)],
      ["/500m", fmtPace(f.pace)],
      ["Avg /500m", fmtPace(f.avgPace)],
      ["S/M", f.spm > 0 ? String(Math.round(f.spm)) : "--"],
      ["Watts", f.watts > 0 ? fmtInt(f.watts) : "---"],
    ];
    const colW = W * 0.44;
    const rowH = 270 * s;
    const top = cy - (rowH * 3) / 2;
    cellsOf.forEach(([k, v], i) => {
      const x = cx + (i % 2 === 0 ? -1 : 1) * (colW / 2 + 12 * s);
      const y = top + Math.floor(i / 2) * rowH;
      lab(ctx, T, fonts, k, x, y + 62 * s, 34 * s, "center", T.label);
      num(ctx, T, fonts, v, x, y + 198 * s, 128 * s, "center", T.fg, colW);
    });
    return;
  }

  if (o.clip === "pace") {
    const shape = paceOf(series, o.fromS, o.toS);
    const e = effort(f.pace, f.watts, o.unit);
    lab(ctx, T, fonts, o.unit === "pace" ? "Pace" : o.unit === "watts" ? "Power" : "Burn", cx, cy - 430 * s, 44 * s, "center", T.label);
    pair(ctx, T, fonts, e.v, e.u, cx, cy - 290 * s, 150 * s, T.fg);

    const x0 = W * 0.09;
    const x1 = W * 0.91;
    const y0 = cy - 200 * s;
    const y1 = cy + 300 * s;
    const span = Math.max(1, o.toS - o.fromS);
    const X = (t: number) => x0 + ((t - o.fromS) / span) * (x1 - x0);
    /* Faster is higher. */
    const Y = (p: number) => y0 + ((Math.max(shape.lo, Math.min(shape.hi, p)) - shape.lo) / Math.max(0.1, shape.hi - shape.lo)) * (y1 - y0);

    /* The floor, and the average of the stretch as a dashed rule. */
    ctx.beginPath();
    ctx.moveTo(x0, y1);
    ctx.lineTo(x1, y1);
    line(ctx, T, T.dim, 4 * s);
    ctx.setLineDash([18 * s, 18 * s]);
    ctx.beginPath();
    ctx.moveTo(x0, Y(shape.avg));
    ctx.lineTo(x1, Y(shape.avg));
    ctx.lineCap = "butt";
    ctx.strokeStyle = T.accent;
    ctx.lineWidth = 5 * s;
    ctx.stroke();
    ctx.setLineDash([]);

    const drawn: [number, number][] = shape.pts.filter((k) => k.t <= f.t).map((k) => [X(k.t), Y(k.pace)]);
    if (drawn.length >= 2) {
      curve(ctx, drawn);
      line(ctx, T, T.fg, 10 * s);
      const head = drawn[drawn.length - 1];
      ctx.beginPath();
      ctx.arc(head[0], head[1], 18 * s, 0, Math.PI * 2);
      if (T.outline) {
        ctx.fillStyle = T.outline;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(head[0], head[1], 13 * s, 0, Math.PI * 2);
      }
      ctx.fillStyle = T.accent;
      ctx.fill();
    }
    const a = frameAt(series, o.fromS);
    const b = frameAt(series, o.toS);
    lab(ctx, T, fonts, `${fmtInt(a.m)} m`, x0, y1 + 60 * s, 34 * s, "left", T.dim);
    lab(ctx, T, fonts, `${fmtInt(b.m)} m`, x1, y1 + 60 * s, 34 * s, "right", T.dim);
    lab(ctx, T, fonts, `avg ${fmtPace(shape.avg)}`, cx, y1 + 60 * s, 34 * s, "center", T.label);
    return;
  }

  if (o.clip === "stroke") {
    const st = f.stroke >= 0 ? series.strokes[f.stroke] : null;
    const x0 = W * 0.1;
    const bw = W * 0.8;
    const y0 = cy - 280 * s;
    const bh = 460 * s;
    lab(ctx, T, fonts, st ? `Stroke ${fmtInt(st.n)}` : "Stroke", x0, y0 - 50 * s, 44 * s, "left", T.label);
    if (st && st.peak > 0) lab(ctx, T, fonts, `peak ${Math.round(st.peak)} lbf`, x0 + bw, y0 - 50 * s, 38 * s, "right", T.dim);

    ctx.beginPath();
    ctx.moveTo(x0, y0 + bh);
    ctx.lineTo(x0 + bw, y0 + bh);
    line(ctx, T, T.dim, 4 * s);

    if (!series.maxPoints) {
      lab(ctx, T, fonts, "No force curves in this piece", cx, cy, 34 * s, "center", T.dim);
    } else {
      /* The strokes before this one, thin, so the shape reads as a habit. */
      if (o.bg !== "green" && o.bg !== "blue" && o.bg !== "clear") {
        for (let i = Math.max(0, f.stroke - 4); i < f.stroke; i++) {
          const g = series.strokes[i];
          if (!g.points) continue;
          curve(ctx, forcePoints(series, g.points, x0, y0, bw, bh));
          ctx.strokeStyle = T.dim;
          ctx.lineWidth = 3 * s;
          ctx.stroke();
        }
      }
      if (st?.points) {
        curve(ctx, forcePoints(series, st.points, x0, y0, bw, bh), f.drive);
        line(ctx, T, T.fg, 12 * s);
      }
    }
    pair(ctx, T, fonts, fmtPace(st?.pace || f.pace), "/500m", cx, y0 + bh + 170 * s, 120 * s, T.fg);
    lab(ctx, T, fonts, `${f.spm > 0 ? Math.round(f.spm) : "--"} s/m`, cx, y0 + bh + 250 * s, 40 * s, "center", T.dim);
    return;
  }

  paintMonitor(ctx, W, H, series, f, o, T);
}

/* ---- the monitor's own screens ----------------------------------------- */

/* The displays a rower can page through mid-piece, drawn from the saved
 * numbers: all data, large print, force curve, bar chart. An LCD, so it is
 * its own grey-green ground with ink figures whatever sits behind it. */
function paintMonitor(ctx: Ctx, W: number, H: number, series: ReelSeries, f: ReelFrame, o: PaintOpts, T: Theme) {
  const s = W / 1080;
  const LCD: Theme = { ground: "#c6ccbc", fg: "#161a15", dim: "#161a15", accent: "#161a15", label: "#161a15", outline: null };
  const fonts = o.fonts;
  const pw = W * 0.9;
  const ph = Math.min(H * 0.92, pw * 0.94);
  const px = (W - pw) / 2;
  const py = (H - ph) / 2;
  const r = 30 * s;

  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, r);
  ctx.fillStyle = T.outline ?? INK;
  ctx.fill();
  const bz = 12 * s;
  ctx.beginPath();
  ctx.roundRect(px + bz, py + bz, pw - bz * 2, ph - bz * 2, r - bz);
  ctx.fillStyle = LCD.ground as string;
  ctx.fill();

  const pad = 46 * s;
  const L = px + bz + pad;
  const R = px + pw - bz - pad;
  const top = py + bz;
  const innerH = ph - bz * 2;
  const rule = (y: number) => {
    ctx.fillStyle = LCD.fg;
    ctx.fillRect(px + bz, y - 2 * s, pw - bz * 2, 4 * s);
  };
  const N = (text: string, x: number, y: number, size: number, align: Align, maxW = 0) => num(ctx, LCD, fonts, text, x, y, size, align, LCD.fg, maxW);
  const S = (text: string, x: number, y: number, size: number, align: Align) => {
    ctx.font = `700 ${size}px ${fonts.sans}`;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = LCD.fg;
    ctx.fillText(text, x, y);
  };

  const e = effort(f.pace, f.watts, o.unit);
  const avgW = f.avgPace > 0 ? wattsFromPace(f.avgPace) : 0;
  const ea = effort(f.avgPace, avgW, o.unit);
  const meters = String(Math.floor(f.m));
  const spm = f.spm > 0 ? String(Math.round(f.spm)) : "--";

  /* Every screen opens on the same band: the clock, and the rate. */
  const band = (h: number, size: number): number => {
    const y = top + h;
    N(fmtClock(f.t, false, series.totalS >= 600), L, y - h * 0.24, size, "left");
    S("s/m", R, y - h * 0.24, 40 * s, "right");
    N(spm, R - 92 * s, y - h * 0.24, size, "right");
    rule(y);
    return y;
  };

  if (o.screen === "large") {
    let y = band(innerH * 0.3, 138 * s);
    const h2 = innerH * 0.42;
    N(e.v, L, y + h2 * 0.74, 250 * s, "left", (R - L) * 0.78);
    S(e.u, R, y + h2 * 0.74, 44 * s, "right");
    y += h2;
    rule(y);
    N(meters, R - 70 * s, y + innerH * 0.28 * 0.7, 170 * s, "right");
    S("m", R, y + innerH * 0.28 * 0.7, 48 * s, "right");
    return;
  }

  if (o.screen === "all") {
    let y = band(innerH * 0.2, 118 * s);
    const big = innerH * 0.28;
    N(e.v, L, y + big * 0.76, 196 * s, "left", (R - L) * 0.76);
    S(e.u, R, y + big * 0.76, 42 * s, "right");
    y += big;
    rule(y);
    const row = (innerH * 0.52) / 3;
    const rows: [string, string, string][] = [
      [meters, "m", ""],
      [ea.v, e.u, "ave"],
      [f.m > 20 ? fmtClock((f.t / f.m) * series.totalM, false) : "-:--", "", "projected"],
    ];
    for (const [v, u, k] of rows) {
      if (k) S(k, L, y + row * 0.68, 40 * s, "left");
      const right = u ? R - (u.length * 24 + 24) * s : R;
      N(v, right, y + row * 0.72, 92 * s, "right");
      if (u) S(u, R, y + row * 0.72, 40 * s, "right");
      y += row;
      if (k !== "projected") rule(y);
    }
    return;
  }

  /* Force curve and bar chart share a second band: effort left, metres right. */
  let y = band(innerH * 0.2, 118 * s);
  const h2 = innerH * 0.2;
  N(e.v, L, y + h2 * 0.72, 112 * s, "left");
  ctx.font = `400 ${112 * s}px ${fonts.black}`;
  S(e.u, L + cells(ctx, e.v).total + 16 * s, y + h2 * 0.72, 38 * s, "left");
  S("m", R, y + h2 * 0.72, 40 * s, "right");
  N(meters, R - 44 * s, y + h2 * 0.72, 92 * s, "right");
  y += h2;
  rule(y);

  const gx = L;
  const gy = y + 36 * s;
  const gw = R - L;
  const gh = top + innerH - gy - 44 * s;
  ctx.fillStyle = LCD.fg;
  ctx.fillRect(gx, gy + gh, gw, 4 * s);

  if (o.screen === "force") {
    const st = f.stroke >= 0 ? series.strokes[f.stroke] : null;
    if (st?.points) {
      curve(ctx, forcePoints(series, st.points, gx, gy, gw, gh), f.drive);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = LCD.fg;
      ctx.lineWidth = 9 * s;
      ctx.stroke();
    }
    return;
  }

  /* Bar chart: one bar a stroke, the newest on the right. */
  const BARS = 26;
  const done = f.stroke >= 0 && f.drive >= 1 ? f.stroke : f.stroke - 1;
  let maxW = 1;
  for (const k of series.strokes) if (k.watts > maxW) maxW = k.watts;
  const bw = gw / BARS;
  for (let i = 0; i < BARS; i++) {
    const k = series.strokes[done - (BARS - 1 - i)];
    if (!k) continue;
    const bh = Math.max(4 * s, (k.watts / maxW) * gh);
    ctx.fillStyle = LCD.fg;
    ctx.fillRect(gx + i * bw + bw * 0.14, gy + gh - bh, bw * 0.72, bh);
  }
}

/* ---- the thumbnail overlay --------------------------------------------- */

export type ThumbOpts = {
  day: number | null;
  total: number | null;
  mark: CanvasImageSource | null;
  /* Width over height of the mark. */
  markRatio: number;
  color: "white" | "ink";
  pos: "top" | "middle" | "bottom";
  photo: CanvasImageSource | null;
  photoW: number;
  photoH: number;
  fonts: Fonts;
};

/* A transparent 9:16 sheet to drop on a photo: DAY and its number, the
 * running total, the month's mark. Everything sits inside the middle 4:5
 * so the grid crop keeps it. No address (owner, 2026-10-14). */
export function paintThumb(ctx: Ctx, W: number, H: number, o: ThumbOpts) {
  ctx.clearRect(0, 0, W, H);
  if (o.photo && o.photoW > 0 && o.photoH > 0) {
    const k = Math.max(W / o.photoW, H / o.photoH);
    ctx.drawImage(o.photo, (W - o.photoW * k) / 2, (H - o.photoH * k) / 2, o.photoW * k, o.photoH * k);
  }
  const s = W / 1080;
  const T: Theme = o.color === "white" ? { ground: null, fg: "#ffffff", dim: "#ffffff", accent: "#e0a070", label: "#e0a070", outline: INK } : { ground: null, fg: INK, dim: INK, accent: "#8a5a35", label: "#8a5a35", outline: "#f3ecdd" };
  const fonts = o.fonts;

  const parts: { h: number; draw: (y: number) => void }[] = [];
  if (o.day !== null) {
    parts.push({ h: 150 * s, draw: (y) => void lab(ctx, T, fonts, "Day", W / 2, y + 120 * s, 130 * s, "center", T.accent) });
    parts.push({ h: 430 * s, draw: (y) => void num(ctx, T, fonts, String(o.day), W / 2, y + 390 * s, 520 * s, "center", T.fg, W * 0.8) });
  }
  if (o.total !== null) {
    parts.push({
      h: 190 * s,
      draw: (y) => {
        ctx.font = `400 ${150 * s}px ${fonts.black}`;
        const text = fmtInt(o.total as number);
        const vw = Math.min(W * 0.62, cells(ctx, text).total);
        const x0 = W / 2 - (vw + 100 * s) / 2;
        num(ctx, T, fonts, text, x0, y + 150 * s, 150 * s, "left", T.fg, W * 0.62);
        lab(ctx, T, fonts, "m", x0 + vw + 24 * s, y + 150 * s, 80 * s, "left", T.accent);
      },
    });
  }
  if (o.mark) {
    const mw = 620 * s;
    const mh = mw / o.markRatio;
    parts.push({ h: mh + 50 * s, draw: (y) => ctx.drawImage(o.mark as CanvasImageSource, (W - mw) / 2, y + 40 * s, mw, mh) });
  }
  const total = parts.reduce((a, p) => a + p.h, 0);
  /* The 4:5 middle of a 9:16 sheet. */
  const safeTop = (H - Math.min(H, W * 1.25)) / 2 + 40 * s;
  const safeBot = H - safeTop;
  let y = o.pos === "top" ? safeTop : o.pos === "bottom" ? safeBot - total : (H - total) / 2;
  for (const p of parts) {
    p.draw(y);
    y += p.h;
  }
}
