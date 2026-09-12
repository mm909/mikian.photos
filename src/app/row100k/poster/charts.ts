/* poster/charts.ts — the charts and tables of the community poster, drawn
 * on canvas in the PAPER idiom (COMMUNITY stream, 2026-09-10).
 *
 * Everything here is a pure drawing function: it takes the ctx, the paint
 * helper (poster/paint.ts, the one text and block engine every stream
 * shares), a box in logical units and plain data, draws inside the box and
 * returns the HEIGHT IT USED — so community.ts can wrap each one as a
 * PosterModule and the engine can stack them (SPEC.md §6, §8). Nothing is
 * read from the DOM, nothing is imported from the server: the data
 * arrives already formatted and already masked (types.ts Figure), and a
 * hidden number reaches this file only as a shape, which is drawn as ink
 * blocks. "Nothing hidden may reach the canvas as a number" — it cannot,
 * because it was never handed over.
 *
 * The look is the front page on paper (owner, 2026-09-05: "running
 * magazine, not sports app"): cream, ink type, mono eyebrows over a
 * hairline, a few thick rules, the water-blue line for every chart, the
 * calendar ramp of Heatmap.tsx, the .dtag medal chips filled and LEFT of
 * the name. No shadows, no radii, no gradients, no boxes. The geometry is
 * the judged front-page mock (scratchpad posters-design-front-page/mock.ts)
 * ported onto the PosterPaint contract; the palette is paint.ts's — one
 * list for every stream.
 *
 * Measuring: a module's measure() must report exactly what draw() uses.
 * Rather than keep two copies of every formula, `silently` runs the SAME
 * draw under an empty clip — nothing is painted, the height comes back
 * exact by construction.
 *
 * THREE DRAWINGS HERE ARE OFF EVERY PLAN since the owner's review of
 * 2026-09-10 — drawCurve ("I do not really like the whole curve there with
 * the cumulative meters"), drawClub ("we do not need to list the hundred K
 * club because there is going to be a ton of members eventually") and
 * drawPlate ("we can remove any reference to Grizzly Health on these").
 * They are kept, whole and tested, because they are good drawings and the
 * data they read still ships; community.ts registers them as modules and
 * names them in no plan, so putting one back is one line there. */

import { dayTicks, fmtMeters, fmtRowerNumber } from "@/lib/row100k";
/* NO COLOUR NAMES HERE — that is the point. Every colour comes off
 * `paint.c` (SPEC.md §4, THE BLACK STOCK), so one drawing serves both
 * stocks; what is left is geometry and formatting. */
import { DOW_LETTERS, SEP_FIRST_DOW, kLabel } from "./paint";
import type {
  Figure,
  PosterBox,
  PosterClub,
  PosterPaint,
  PosterPartner,
  PosterRecord,
  PosterSplit,
  PosterStanding,
  PosterTakeaway,
} from "./types";

type Ctx = CanvasRenderingContext2D;

/* The cream table.board wash behind the top-ten rows — OFF by default
 * (SPEC.md §14.7); one fillRect before the rows when the owner asks. */
const BOARD_WASH = "rgba(236,220,170,0.22)";
const BOARD_WASH_ON = false;

/* Half a logical unit of tolerance on every "does it fit" comparison: the
 * engine hands a module a box sized off that module's own measure, so a
 * strict compare can lose a floating-point tie once box.y is large. */
export const EPS = 0.5;

/* ---------------------------------------------------------- formatting */
const pad2 = (v: number) => String(v).padStart(2, "0");
/* Axis abbreviations: 500K, 1M, 2.5M, 12.5M. */
const abbr = (v: number): string =>
  v >= 1_000_000 ? `${+(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}K` : String(Math.round(v));
const fmtClock = (s: number): string => {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${pad2(t % 60)}`;
};

/* A meters Figure always prints its unit. The DATA stream ships fmtMeters
 * text ("142,300 m") and shapeOf(fmtMeters(...)) shapes with the unit on;
 * a shape that arrives bare ("###,###") gets it here rather than lose it. */
export function withUnit(f: Figure): Figure {
  if (f.shape !== undefined) return /m$/.test(f.shape) ? f : { shape: `${f.shape} m` };
  return /m$/.test(f.text) || f.text === "—" ? f : { text: `${f.text} m` };
}

/* --------------------------------------------------------- measuring */

/* The same draw under an empty clip: nothing reaches the canvas, the
 * height comes back exact. measure() and draw() are one function. */
export function silently(ctx: Ctx, draw: () => number): number {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 0, 0);
  ctx.clip();
  try {
    return draw();
  } finally {
    ctx.restore();
  }
}

/* paint.eyebrow's height, measured off the helper itself (S4 is the
 * engine's drawing; this never guesses its air). */
export function eyebrowHeight(ctx: Ctx, paint: PosterPaint): number {
  return silently(ctx, () => paint.eyebrow(ctx, 0, 0, 400, "X", "X"));
}

/* Shrink-to-fit with an em-based tracking: the largest size ≤ cap at
 * which `text` fits `maxW`. Measured once at 100 units and scaled. */
export function fitCap(
  ctx: Ctx,
  paint: PosterPaint,
  text: string,
  face: "black" | "mono" | "monoBold",
  cap: number,
  maxW: number,
  trackEm = 0,
): number {
  const w = paint.measure(ctx, text, paint.font(face, 100), trackEm * 100);
  return Math.max(4, Math.min(cap, Math.floor((100 * maxW) / Math.max(1, w))));
}

/* A Figure's width in `font` at `size` — text measured with its tracking,
 * a shape measured by the block helper without painting. */
export function figureWidth(
  ctx: Ctx,
  paint: PosterPaint,
  f: Figure,
  font: string,
  size: number,
  tracking = 0,
): number {
  if (f.shape !== undefined) return paint.blocks(ctx, 0, 0, f.shape, size, { paint: false });
  return paint.measure(ctx, f.text, font, tracking);
}

/* Left-aligned figure; the caller does its own right alignment off
 * figureWidth so the helper's alignment semantics are never relied on. */
export function drawFigure(
  ctx: Ctx,
  paint: PosterPaint,
  f: Figure,
  x: number,
  base: number,
  font: string,
  size: number,
  color: string,
  tracking = 0,
): number {
  return paint.figure(ctx, f, x, base, font, size, color, tracking ? { tracking } : undefined);
}

/* Mixed-colour runs on one baseline (slides.ts Run / drawRuns): the label
 * line with its one bold ink phrase. */
export type Run = { text: string; color: string; font?: string };

export function runsWidth(ctx: Ctx, paint: PosterPaint, runs: Run[], font: string, tracking = 0): number {
  return runs.reduce((w, r) => w + paint.measure(ctx, r.text, r.font ?? font, tracking), 0);
}

export function drawRuns(
  ctx: Ctx,
  paint: PosterPaint,
  runs: Run[],
  x: number,
  base: number,
  font: string,
  tracking = 0,
): number {
  let cx = x;
  for (const r of runs) {
    const f = r.font ?? font;
    paint.drawText(ctx, r.text, cx, base, f, r.color, tracking);
    cx += paint.measure(ctx, r.text, f, tracking);
  }
  return cx - x;
}

/* Runs that must fit a measure: the last run loses its " · " segments
 * from the end, then whole runs go, then the survivor is ellipsized. A
 * headline label on a phone keeps its bold phrase and drops its tail. */
export function fitRuns(
  ctx: Ctx,
  paint: PosterPaint,
  runsIn: Run[],
  font: string,
  tracking: number,
  maxW: number,
): Run[] {
  const runs = runsIn.map((r) => ({ ...r }));
  for (let guard = 0; guard < 40 && runs.length > 0; guard++) {
    if (runsWidth(ctx, paint, runs, font, tracking) <= maxW) return runs;
    const last = runs[runs.length - 1];
    const cut = last.text.lastIndexOf(" · ");
    if (cut > 0) {
      last.text = last.text.slice(0, cut);
      continue;
    }
    if (runs.length > 1) {
      runs.pop();
      continue;
    }
    last.text = paint.ellipsize(ctx, last.text, maxW, last.font ?? font, tracking);
    return runs;
  }
  return runs;
}

/* A " · "-joined value that must fit: drops segments from the end first,
 * then ellipsizes — "25 ROWERS · FIRST TESS VALE · SEP 8" on a narrow
 * ledger becomes "25 ROWERS · FIRST TESS VALE", then "25 ROWERS". */
function fitValue(ctx: Ctx, paint: PosterPaint, value: string, font: string, tracking: number, maxW: number): string {
  let v = value;
  for (let guard = 0; guard < 12; guard++) {
    if (paint.measure(ctx, v, font, tracking) <= maxW) return v;
    const cut = v.lastIndexOf(" · ");
    if (cut <= 0) break;
    v = v.slice(0, cut);
  }
  return paint.ellipsize(ctx, v, maxW, font, tracking);
}

/* One mono line in gray — "THE CURVE STARTS TOMORROW", "NOT ENOUGH ROWS
 * LOGGED YET" — under an eyebrow; returns the y under it. */
function noteLine(ctx: Ctx, paint: PosterPaint, x: number, y: number, text: string): number {
  const C = paint.c;
  const size = paint.tk.small * 1.1;
  const f = paint.font("mono", size);
  const m = paint.metricsOf(ctx, f, size);
  paint.drawText(ctx, text, x, y + m.asc, f, C.gray, 0.12 * paint.tk.small);
  return y + m.lh;
}

/* ===================================================== S1 nameplate */

/* Archivo Black fitted to the measure (tracking −.02em), a hairline 0.12em
 * under the line box, the dateline in mono 700 ink-soft, and — while a
 * window is open — the blackout note as a second dateline in ink, so the
 * sheet explains its own blocks. `runs` lets a rower's number go gray. */
export function drawNameplate(
  ctx: Ctx,
  paint: PosterPaint,
  box: PosterBox,
  runs: Run[],
  dateline: string,
  note: string | null,
  cap: number,
): number {
  const C = paint.c;
  const { tk } = paint;
  const text = runs.map((r) => r.text).join("");
  const size = fitCap(ctx, paint, text, "black", cap, box.w, -0.02);
  const font = paint.font("black", size);
  const m = paint.metricsOf(ctx, font, size);
  const lh = size * 0.9;
  const base = paint.baselineOf(box.y, lh, m);
  drawRuns(ctx, paint, runs, box.x, base, font, -0.02 * size);
  let y = box.y + lh + size * 0.12;
  paint.rule(ctx, box.x, y, box.w, tk.hair);
  y += tk.hair + tk.datel * 0.9;
  const dFont = paint.font("monoBold", tk.datel);
  const dm = paint.metricsOf(ctx, dFont, tk.datel);
  const tr = 0.16 * tk.datel;
  paint.drawText(ctx, paint.ellipsize(ctx, dateline, box.w, dFont, tr), box.x, y + dm.asc, dFont, C.inkSoft, tr);
  y += dm.lh;
  if (note) {
    y += tk.datel * 0.25;
    paint.drawText(ctx, paint.ellipsize(ctx, note, box.w, dFont, tr), box.x, y + dm.asc, dFont, C.ink, tr);
    y += dm.lh;
  }
  return y - box.y;
}

/* ====================================================== S2 headline */

/* The lead number: water Archivo Black fitted to ≤ 94 % of the measure
 * and sat by its CAP height (baseline = top + 0.74 × size — the headline
 * wants no leading); a shape draws as ink blocks at 0.8 × the cap (six
 * headline-size blocks are a heavier mass than six blue digits). The
 * label line under it: mono gray runs with one bold ink phrase, fitted. */
export function drawHeadline(
  ctx: Ctx,
  paint: PosterPaint,
  box: PosterBox,
  value: Figure,
  label: Run[],
  cap: number,
): number {
  const C = paint.c;
  const { tk } = paint;
  let size: number;
  if (value.shape !== undefined) {
    const w = paint.blocks(ctx, 0, 0, value.shape, 100, { paint: false });
    size = Math.max(4, Math.min(cap * 0.8, Math.floor((100 * box.w) / Math.max(1, w))));
  } else {
    size = fitCap(ctx, paint, value.text, "black", cap, box.w * 0.94, -0.01);
  }
  const base = box.y + size * 0.74;
  if (value.shape !== undefined) paint.blocks(ctx, box.x, base, value.shape, size * 0.98, { fill: C.ink });
  else paint.drawText(ctx, value.text, box.x, base, paint.font("black", size), C.water, -0.01 * size);
  const y = base + size * 0.08 + tk.headLabel * 1.2;
  const lFont = paint.font("mono", tk.headLabel);
  const lm = paint.metricsOf(ctx, lFont, tk.headLabel);
  const tr = 0.14 * tk.headLabel;
  drawRuns(ctx, paint, fitRuns(ctx, paint, label, lFont, tr, box.w), box.x, y + lm.asc, lFont, tr);
  return y + lm.lh - box.y;
}

/* ========================================================= S3 strip */

export type StripCell = { n: Figure; l: string };

/* The .front-stats idiom: thick rule top and bottom, cells parted by
 * hairlines, statN Archivo Black ink (shrink-to-fit the cell, floor 0.7×)
 * over a mono gray label. Blocks stand in for a hidden number. */
export function drawStrip(ctx: Ctx, paint: PosterPaint, box: PosterBox, cells: StripCell[]): number {
  const C = paint.c;
  const { tk } = paint;
  const count = Math.max(1, cells.length);
  const cellW = box.w / count;
  const padTop = tk.statN * 0.42;
  const cellH = padTop + tk.statN + tk.statL * 0.9 + tk.statL + tk.statN * 0.4;
  paint.rule(ctx, box.x, box.y, box.w, tk.thick);
  const top = box.y + tk.thick;
  const lFont = paint.font("mono", tk.statL);
  const lm = paint.metricsOf(ctx, lFont, tk.statL);
  cells.forEach((cell, i) => {
    const x = box.x + i * cellW;
    const pad = i === 0 ? 0 : tk.statN * 0.4;
    const maxW = cellW - pad - tk.statN * 0.3;
    // The caps sit at padTop below the rule (Archivo Black caps are 0.72em).
    const base = top + padTop + tk.statN * 0.72;
    let size = tk.statN;
    if (cell.n.shape !== undefined) {
      const bs = tk.statN * 0.9;
      const w = paint.blocks(ctx, 0, 0, cell.n.shape, bs, { paint: false });
      const s = w > maxW ? Math.max(bs * 0.7, (bs * maxW) / w) : bs;
      paint.blocks(ctx, x + pad, base, cell.n.shape, s, { fill: C.ink });
    } else {
      const w = paint.measure(ctx, cell.n.text, paint.font("black", size), -0.01 * size);
      if (w > maxW) size = Math.max(size * 0.7, (size * maxW) / w);
      paint.drawText(ctx, cell.n.text, x + pad, base, paint.font("black", size), C.ink, -0.01 * size);
    }
    const label = paint.ellipsize(ctx, cell.l.toUpperCase(), maxW, lFont, 0.14 * tk.statL);
    paint.drawText(ctx, label, x + pad, base + tk.statL * 0.9 + lm.asc, lFont, C.gray, 0.14 * tk.statL);
    if (i > 0) paint.rule(ctx, x - tk.hair / 2, top, tk.hair, cellH);
  });
  paint.rule(ctx, box.x, top + cellH, box.w, tk.thick);
  return tk.thick * 2 + cellH;
}

/* ========================================================= C5 curve */

/* Nice-step gridlines: the first of pow, pow/2, pow/4, pow/5, pow/10
 * giving four to six lines; the top line is the last step at or above
 * the max, so the curve ends inside the frame. */
export function niceStep(max: number): { step: number; lines: number } {
  if (!(max > 0)) return { step: 1, lines: 4 };
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const candidates = [pow, pow / 2, pow / 4, pow / 5, pow / 10];
  let best = { step: pow / 10, lines: Math.ceil(max / (pow / 10)) };
  for (const step of candidates) {
    const lines = Math.ceil(max / step);
    if (lines >= 4 && lines <= 6) return { step, lines };
    if (Math.abs(lines - 5) < Math.abs(best.lines - 5)) best = { step, lines };
  }
  return best;
}

/* Cumulative meters Sep 1 → the as-of day, the total called out at the
 * end dot. Fills its box: the plan sizes the row, the chart is the box
 * minus the eyebrow. Under two days it prints its one line instead. */
export function drawCurve(
  ctx: Ctx,
  paint: PosterPaint,
  box: PosterBox,
  byDay: number[],
  dayNumber: number,
  asOfDay: string,
): number {
  const C = paint.c;
  const { tk } = paint;
  const yTop = paint.eyebrow(
    ctx,
    box.x,
    box.y,
    box.w,
    "THE CURVE",
    `METERS TOGETHER · SEP 1 → ${asOfDay.toUpperCase()}`,
    "METERS TOGETHER",
  );
  const days = Math.max(1, Math.min(dayNumber, byDay.length));
  if (days < 2) return noteLine(ctx, paint, box.x, yTop, "THE CURVE STARTS TOMORROW") - box.y;
  const cum: number[] = [];
  let acc = 0;
  for (let i = 0; i < days; i++) {
    acc += Math.max(0, byDay[i] ?? 0);
    cum.push(acc);
  }
  const total = cum[cum.length - 1];
  const { step, lines } = niceStep(total);
  const top = step * lines;
  const gutter = tk.axis * 4.2;
  const L = box.x + gutter;
  const R = box.x + box.w - tk.axis * 0.6;
  const T = yTop + tk.axis * 0.8;
  const B = box.y + box.h - tk.axis * 2.4;
  if (!(B - T >= tk.axis * 3)) return box.h;
  const X = (d: number) => L + ((d - 1) / (days - 1)) * (R - L);
  const Y = (v: number) => T + (1 - v / top) * (B - T);
  const aFont = paint.font("mono", tk.axis);
  // A squat chart (a phone post) labels every other line; the lines stay.
  const labelEvery = Math.max(1, Math.ceil((tk.axis * 1.6 * lines) / (B - T)));
  for (let i = 1; i <= lines; i++) {
    const v = step * i;
    const gy = Y(v);
    if (i === lines) paint.rule(ctx, L, gy, R - L, 1, C.grid);
    else paint.dashedRule(ctx, L, gy - 0.5, R - L, C.grid, 1);
    if ((lines - i) % labelEvery === 0) {
      paint.drawRight(ctx, abbr(v), L - tk.axis * 0.8, gy + tk.axis * 0.35, aFont, C.gray);
    }
  }
  paint.rule(ctx, L, B, R - L, tk.hair * 1.4, C.ink);
  for (const d of dayTicks(days)) {
    paint.drawCentered(ctx, d === 1 ? "SEP 1" : String(d), X(d), B + tk.axis * 1.7, aFont, C.gray);
  }
  ctx.save();
  ctx.beginPath();
  cum.forEach((v, i) => (i ? ctx.lineTo(X(i + 1), Y(v)) : ctx.moveTo(X(1), Y(v))));
  ctx.lineTo(X(days), Y(0));
  ctx.lineTo(X(1), Y(0));
  ctx.closePath();
  ctx.fillStyle = C.waterArea;
  ctx.fill();
  ctx.beginPath();
  cum.forEach((v, i) => (i ? ctx.lineTo(X(i + 1), Y(v)) : ctx.moveTo(X(1), Y(v))));
  ctx.strokeStyle = C.water;
  ctx.lineWidth = tk.hair * 2.2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
  const lx = X(days);
  const ly = Y(total);
  ctx.fillStyle = C.water;
  ctx.beginPath();
  ctx.arc(lx, ly, tk.hair * 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // The total above the end dot; on a short chart (a phone post) there is
  // no room above, so it sits LEFT of the dot at the dot's height, where
  // the rising line is below it.
  const eFont = paint.font("monoBold", tk.small * 1.15);
  const label = fmtMeters(total);
  const lw = paint.measure(ctx, label, eFont);
  const above = ly - tk.axis * 1.1 >= T + tk.axis * 0.6;
  const right = above ? Math.max(L + lw, Math.min(lx, R - 2)) : Math.max(L + lw, lx - tk.hair * 5);
  paint.drawRight(ctx, label, right, above ? ly - tk.axis * 1.1 : ly + tk.axis * 0.35, eFont, C.ink);
  return box.h;
}

/* ========================================================= C6 month */

export type MonthOpts = {
  eyebrow: { left: string; right: string; short?: string };
  /* Meters per day, index 0 = Sep 1; null = the rower's masked month
   * (DAYS ROWED dots off `rowed`). */
  meters: number[] | null;
  rowed?: boolean[];
  /* 1..30 — cells past it are future days (paper). */
  dayNumber: number;
  /* The full five-row September grid (the wall sizes) or the elapsed
   * weeks only (the hand-outs and the phone). */
  full: boolean;
  /* Community: quartiles of the elapsed days (SPEC.md §14.1); rower: the
   * site's fixed 2,500 / 5,000 / 10,000 (Heatmap.tsx). */
  buckets: "quartile" | [number, number, number];
  /* A cap on the cell's HEIGHT. A cell is square whenever the box is deep
   * enough for that (every print sheet, and a phone frame mid-month); when
   * the plan can only give the grid a short box — a FINAL five-row month on
   * a 4:5 post — the cell keeps its full column width and loses height
   * instead, because a 7 × 5 grid of squares in a 40 %-empty box reads as a
   * mistake and a wall-calendar rectangle does not. */
  cellCap?: number;
};

/* Seven columns S M T W T F S, Sep 1 under T. Rowed days are ramp cells
 * with the day number top-left and the k-label bottom-centre; rest days a
 * dashed outline; future days paper. Left-aligned when the cell is capped. */
export function drawMonth(ctx: Ctx, paint: PosterPaint, box: PosterBox, o: MonthOpts): number {
  const C = paint.c;
  const { tk } = paint;
  let y = paint.eyebrow(ctx, box.x, box.y, box.w, o.eyebrow.left, o.eyebrow.right, o.eyebrow.short);
  const gap = tk.small * 0.7;
  // The cell is as wide as its share of the box, always — the grid fills
  // its column. Its HEIGHT is the same number unless the caller capped it
  // (see MonthOpts.cellCap).
  const cellW = (box.w - gap * 6) / 7;
  const cellH = Math.min(o.cellCap ?? Number.POSITIVE_INFINITY, cellW);
  const cell = Math.min(cellW, cellH);
  const dow = paint.font("mono", tk.axis);
  DOW_LETTERS.forEach((d, i) =>
    paint.drawCentered(ctx, d, box.x + i * (cellW + gap) + cellW / 2, y + tk.small, dow, C.gray, 0.1 * tk.small),
  );
  y += tk.small * 1.9;
  const dayN = Math.max(1, Math.min(30, o.dayNumber));
  const shown = o.full ? 30 : dayN;
  const rows = Math.ceil((shown + SEP_FIRST_DOW) / 7);
  let th: [number, number, number];
  if (o.buckets === "quartile") {
    const sorted = (o.meters ?? [])
      .slice(0, dayN)
      .filter((v) => v > 0)
      .sort((a, b) => a - b);
    const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
    th = [q(0.25), q(0.5), q(0.75)];
  } else {
    th = o.buckets;
  }
  const numFont = paint.font("mono", tk.axis);
  const labelSize = cell * 0.28;
  const labelFont = paint.font("monoBold", labelSize);
  // A squeezed grid (a FINAL five-row month on a 4:5 post) drops the
  // k-label before it prints one too small to read, and the day number
  // before the cell is all ink: the shape of the month is the point, and
  // an 8-px label is noise on a phone and mud in print.
  const showLabel = labelSize >= tk.small * 0.8;
  const showNum = cell >= tk.axis * 1.8;
  for (let i = 0; i < shown; i++) {
    const idx = i + SEP_FIRST_DOW;
    const x = box.x + (idx % 7) * (cellW + gap);
    const cy = y + Math.floor(idx / 7) * (cellH + gap);
    if (i >= dayN) {
      // The days still to come. On the small grid the design left them as
      // bare paper; now that the calendar is the picture of the upper
      // sheet (two columns on a 24x36), three blank rows in September read
      // as a hole rather than as a month in progress — so a future day is
      // drawn as an empty box in the faintest rule on the sheet, one step
      // lighter than a rest day's dashed outline, with its date in `line`.
      // A sheet printed on Sep 12 then shows the month it is halfway
      // through, and the FINAL sheet is the same grid with every cell full.
      if (!o.full) continue;
      ctx.save();
      ctx.strokeStyle = C.grid;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, cy + 0.5, cellW - 1, cellH - 1);
      ctx.restore();
      if (showNum) paint.drawText(ctx, String(i + 1), x + cellW * 0.1, cy + tk.axis * 1.15, numFont, C.line);
      continue;
    }
    const m = o.meters ? Math.max(0, o.meters[i] ?? 0) : 0;
    const rowed = o.meters ? m > 0 : !!o.rowed?.[i];
    if (!rowed) {
      ctx.save();
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(x + 0.5, cy + 0.5, cellW - 1, cellH - 1);
      ctx.restore();
      continue;
    }
    if (!o.meters) {
      // A rowed day is public; its meters are not — an ink outline, a dot.
      ctx.save();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = tk.hair;
      ctx.strokeRect(x + tk.hair / 2, cy + tk.hair / 2, cellW - tk.hair, cellH - tk.hair);
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.arc(x + cellW / 2, cy + cellH / 2 + cellH * 0.06, cell * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (showNum) paint.drawText(ctx, String(i + 1), x + cellW * 0.1, cy + tk.axis * 1.15, numFont, C.ink);
      continue;
    }
    const b = m < th[0] ? 0 : m < th[1] ? 1 : m < th[2] ? 2 : 3;
    const step = C.ramp[b];
    ctx.fillStyle = step.fill;
    ctx.fillRect(x, cy, cellW, cellH);
    // THE KEYLINE IS THE STOCK'S CALL, not this file's. On cream a 1-unit
    // line outline is what makes bucket 0 (1.13:1 against paper) survive
    // matte stock. On ink bucket 0 is already 1.88:1 LIGHTER than its
    // ground and that same rule is 2.70:1 — BRIGHTER than the fill it is
    // meant to hold, so the cell would read as an empty outlined box, which
    // is what a rest day already reads as. Hence `cellEdge: string | null`.
    if (C.cellEdge) {
      ctx.save();
      ctx.strokeStyle = C.cellEdge;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, cy + 0.5, cellW - 1, cellH - 1);
      ctx.restore();
    }
    // THE LABEL COLOUR IS A PROPERTY OF ITS STEP. This was `b === 3 ? WHITE
    // : INK` — a fact about the CREAM ramp, which flips once at the top, and
    // wrong for the bw ramp, which flips in the MIDDLE as the cells go
    // light. Carried beside the fill, a label can never drift from it.
    const ink = step.on;
    if (showNum) paint.drawText(ctx, String(i + 1), x + cellW * 0.1, cy + tk.axis * 1.15, numFont, ink);
    if (showLabel) paint.drawCentered(ctx, kLabel(m), x + cellW / 2, cy + cellH - cellH * 0.16, labelFont, ink);
  }
  return y + rows * cellH + (rows - 1) * gap - box.y;
}

/* ======================================================== C7 boards */

export type BoardOpts = {
  division: "M" | "F";
  count: 5 | 10;
  /* "Sep 27" — the window's end, for the elite eyebrow. */
  until: string | null;
  /* Narrow columns (the hand-outs' 302, a phone) drop the rower number on
   * masked rows so name + pace chip + blocks fit. */
  noNum: boolean;
};

/* Rows on dashed hairlines at rowPitch: place (01–03 as filled medal
 * chips), number gray, name Archivo 700 ellipsized, meters right. A masked
 * row: the division letter where the place goes, a pace chip after the
 * name, blocks right, no medal — and when every row is hidden the eyebrow
 * says so. Rows arrive in PUBLIC-board order and are never re-sorted. */
export function drawBoard(
  ctx: Ctx,
  paint: PosterPaint,
  box: PosterBox,
  rowsIn: PosterStanding[],
  o: BoardOpts,
): number {
  const C = paint.c;
  const { tk } = paint;
  const rows = rowsIn.slice(0, o.count);
  const div = o.division === "M" ? "MEN" : "WOMEN";
  const letter = o.division === "M" ? "M" : "W";
  const allMasked = rows.length > 0 && rows.every((r) => r.masked);
  let y: number;
  if (allMasked) {
    const until = o.until ? `HIDDEN UNTIL ${o.until.toUpperCase()} · ` : "";
    // The descriptor's short forms, by the room left of the title: a
    // 302-wide hand-out column holds "BY SPLIT", a wall column the rest.
    const left = `THE ELITE · ${div}`;
    const room = box.w - paint.measure(ctx, left, paint.font("monoBold", tk.eye), 0.16 * tk.eye) - tk.eye * 2.4;
    const fitsShort = paint.measure(ctx, "BY AVERAGE SPLIT", paint.font("mono", tk.eye), 0.12 * tk.eye) <= room;
    y = paint.eyebrow(
      ctx,
      box.x,
      box.y,
      box.w,
      left,
      `${until}BY AVERAGE SPLIT · NO PLACES`,
      fitsShort ? "BY AVERAGE SPLIT" : "BY SPLIT",
    );
  } else {
    y = paint.eyebrow(ctx, box.x, box.y, box.w, div, o.count === 5 ? "TOP FIVE" : "TOP TEN");
  }
  if (rows.length === 0) return noteLine(ctx, paint, box.x, y, "NO ROWS LOGGED YET") - box.y;
  const size = tk.row;
  const pitch = tk.rowPitch;
  const monoS = paint.font("mono", size * 0.86);
  const nameFont = paint.font("archivoBold", size);
  const metersFont = paint.font("monoBold", size);
  const rm = paint.metricsOf(ctx, paint.font("mono", size), size);
  const right = box.x + box.w;
  if (BOARD_WASH_ON) {
    ctx.fillStyle = BOARD_WASH;
    ctx.fillRect(box.x, y, box.w, rows.length * pitch);
  }
  // The place column is as wide as a medal chip wants, so 04 lines up
  // under the chip's text and the number column never collides with it.
  const chipW = silently(ctx, () => paint.chip(ctx, 0, 0, "00", "gold"));
  const placeW = Math.max(size * 1.7, chipW + size * 0.45);
  let bracket = false;
  rows.forEach((r, i) => {
    // A mixed list: the hidden rows sit first under a small THE ELITE
    // label; the ranked rows keep their public-board places below a
    // hairline. (Ten per division are the elite, so this is the rare case.)
    if (!allMasked && r.masked && !bracket) {
      paint.drawText(ctx, "THE ELITE", box.x, y + tk.small, paint.font("mono", tk.small), C.gray, 0.18 * tk.small);
      y += tk.small * 1.6;
      bracket = true;
    } else if (bracket && !r.masked) {
      paint.rule(ctx, box.x, y, box.w, tk.hair);
      y += tk.hair + tk.small * 0.4;
      bracket = false;
    }
    const base = y + (pitch - rm.lh) / 2 + rm.asc;
    const fig = withUnit(r.meters);
    const mw = figureWidth(ctx, paint, fig, metersFont, size);
    drawFigure(ctx, paint, fig, right - mw, base, metersFont, size, C.ink);
    if (r.masked || r.unranked) {
      paint.drawText(ctx, letter, box.x, base, monoS, C.gray);
    } else {
      const place = pad2(i + 1);
      const medal = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : null;
      if (medal) paint.chip(ctx, box.x, base, place, medal);
      else paint.drawText(ctx, place, box.x + (chipW - paint.measure(ctx, place, monoS)) / 2, base, monoS, C.gray);
    }
    const numT = o.noNum && r.masked ? "" : `${fmtRowerNumber(r.rowerNumber)} `;
    const nx = box.x + placeW;
    if (numT) paint.drawText(ctx, numT, nx, base, monoS, C.gray);
    const numW = numT ? paint.measure(ctx, numT, monoS) : 0;
    const tag = r.paceTag;
    const tagW = tag ? silently(ctx, () => paint.chip(ctx, 0, 0, tag, "pace")) + size * 0.5 : 0;
    const maxNameW = right - mw - size * 1.1 - (nx + numW) - tagW;
    const name = paint.ellipsize(ctx, r.name, Math.max(size * 2, maxNameW), nameFont);
    paint.drawText(ctx, name, nx + numW, base, nameFont, C.ink);
    if (tag) {
      const nw = paint.measure(ctx, name, nameFont);
      paint.chip(ctx, nx + numW + nw + size * 0.5, base, tag, "pace");
    }
    y += pitch;
    if (i < rows.length - 1) paint.dashedRule(ctx, box.x, y - 0.5, box.w);
  });
  return y - box.y;
}

/* ======================================================= C8 records */

/* A small gray label per record, then one line per holder: the division
 * letter, the value in water Archivo Black (a shape → ink blocks at
 * 0.9 × recV with the unit at row size), the holder on the same baseline,
 * "· 075 · SEP 4" small gray, the split meta when it fits. The line pitch
 * levels the list with the boards' ten rows on the wall sizes. */
export function drawRecords(
  ctx: Ctx,
  paint: PosterPaint,
  box: PosterBox,
  records: PosterRecord[],
  blackout: boolean,
): number {
  const C = paint.c;
  const { tk } = paint;
  let y = paint.eyebrow(
    ctx,
    box.x,
    box.y,
    box.w,
    "THE RECORDS",
    blackout ? "TIMES ARE SHOWN, HIDDEN METERS ARE NOT" : "THIS SEPTEMBER",
    blackout ? "TIMES SHOWN" : undefined,
  );
  const labelH = tk.small * 1.5;
  const divH = tk.small * 1.5;
  const lineCount = records.reduce((n, r) => n + Math.max(1, r.lines.length), 0);
  const air = records.length * labelH + Math.max(0, records.length - 1) * divH;
  let linePitch = Math.max(tk.recV * 1.12, (10 * tk.rowPitch - air) / Math.max(1, lineCount));
  // The list levels with the ten board rows beside it — and, when the plan
  // hands it a TALLER box (the room the curve used to take; the owner kept
  // the records and killed the curve, 2026-09-10), the lines spread to fill
  // it instead of leaving the column ragged. Half again the value's cap is
  // as airy as a record line is allowed to get. measure() runs unbounded,
  // so the natural pitch is what the engine budgets.
  if (Number.isFinite(box.h) && box.h > 0) {
    const fill = (box.y + box.h - y - air) / Math.max(1, lineCount);
    if (fill > linePitch) linePitch = Math.min(fill, tk.recV * 1.5);
  }
  const labelFont = paint.font("mono", tk.small);
  const tagFont = paint.font("mono", tk.small * 1.1);
  const valueFont = paint.font("black", tk.recV);
  const unitFont = paint.font("monoBold", tk.row);
  const holderFont = paint.font("archivoBold", tk.row);
  const metaFont = paint.font("mono", tk.small);
  records.forEach((rec, ri) => {
    paint.drawText(ctx, rec.label.toUpperCase(), box.x, y + tk.small, labelFont, C.gray, 0.18 * tk.small);
    y += labelH;
    if (rec.lines.length === 0) {
      paint.drawText(ctx, "NOT YET ROWED", box.x, y + tk.recV * 0.98, metaFont, C.gray, 0.12 * tk.small);
      y += linePitch;
    }
    rec.lines.forEach((l) => {
      const base = y + tk.recV * 0.98;
      let vx = box.x;
      if (l.division) {
        paint.drawText(ctx, l.division === "M" ? "M" : "W", vx, base, tagFont, C.gray);
        vx += tk.small * 1.8;
      }
      let vw: number;
      if (l.value.shape !== undefined) {
        const unit = /m$/.test(l.value.shape) ? " m" : "";
        const digits = unit ? l.value.shape.replace(/\s*m$/, "") : l.value.shape;
        vw = paint.blocks(ctx, vx, base, digits, tk.recV * 0.9, { fill: C.ink });
        if (unit) {
          paint.drawText(ctx, unit, vx + vw, base, unitFont, C.ink);
          vw += paint.measure(ctx, unit, unitFont);
        }
      } else {
        vw = paint.measure(ctx, l.value.text, valueFont, -0.01 * tk.recV);
        paint.drawText(ctx, l.value.text, vx, base, valueFont, C.water, -0.01 * tk.recV);
      }
      const hx = vx + vw + tk.row * 0.9;
      let who = `  ${fmtRowerNumber(l.holder.rowerNumber)} · ${l.day.toUpperCase()}`;
      let whoW = paint.measure(ctx, who, metaFont);
      const room = box.x + box.w - hx;
      // The name is what a rower looks for on a wall: when the line is
      // short, the number goes before the name is cut (review, 2026-09-10).
      if (paint.measure(ctx, l.holder.name, holderFont) + whoW > room) {
        who = `  ${l.day.toUpperCase()}`;
        whoW = paint.measure(ctx, who, metaFont);
      }
      const holder = paint.ellipsize(ctx, l.holder.name, Math.max(tk.row * 2, room - whoW), holderFont);
      paint.drawText(ctx, holder, hx, base, holderFont, C.ink);
      const hw = paint.measure(ctx, holder, holderFont);
      paint.drawText(ctx, who, hx + hw, base, metaFont, C.gray);
      // The split meta rides along only when the line has the room for it.
      if (l.meta) {
        const meta = ` · ${l.meta.toUpperCase()}`;
        if (hw + whoW + paint.measure(ctx, meta, metaFont) <= room) {
          paint.drawText(ctx, meta, hx + hw + whoW, base, metaFont, C.gray);
        }
      }
      y += linePitch;
    });
    if (ri < records.length - 1) {
      paint.dashedRule(ctx, box.x, y - tk.small * 0.2, box.w);
      y += divH;
    }
  });
  return y - box.y;
}

/* ========================================================= C9 hours */

/* 24 bars from 3 AM (HoursSvg's start), slot × .62 wide, the busiest bar
 * solid water with its count above it, ink baseline, 06 · 12 · 18 · 00.
 * Fills its box (a fixed-height row). Null → its one line. */
export function drawHours(ctx: Ctx, paint: PosterPaint, box: PosterBox, hours: number[] | null): number {
  const C = paint.c;
  const { tk } = paint;
  const yTop = paint.eyebrow(ctx, box.x, box.y, box.w, "THE HOURS", "SESSIONS BY HOUR");
  if (!hours || hours.length !== 24 || !hours.some((v) => v > 0)) {
    return noteLine(ctx, paint, box.x, yTop, "NOT ENOUGH ROWS LOGGED YET") - box.y;
  }
  const L = box.x;
  const R = box.x + box.w;
  // Room above the tallest bar for its count.
  const T = yTop + tk.axis * 2.2;
  const B = box.y + box.h - tk.axis * 2.4;
  if (!(B - T >= tk.axis * 2)) return box.h;
  const slot = (R - L) / 24;
  const start = 3;
  let peak = 0;
  hours.forEach((v, h) => {
    if (v > hours[peak]) peak = h;
  });
  const yMax = Math.max(1, hours[peak]);
  const Y = (v: number) => T + (1 - v / yMax) * (B - T);
  for (let i = 0; i < 24; i++) {
    const h = (start + i) % 24;
    const v = hours[h];
    if (v <= 0) continue;
    const bx = L + i * slot + slot * 0.19;
    const bw = slot * 0.62;
    const bh = Math.max(B - Y(v), 2);
    ctx.fillStyle = h === peak ? C.water : C.waterBar;
    ctx.fillRect(bx, B - bh, bw, bh);
  }
  const pi = (((peak - start) % 24) + 24) % 24;
  paint.drawCentered(
    ctx,
    String(hours[peak]),
    L + pi * slot + slot / 2,
    Y(hours[peak]) - tk.axis * 0.5,
    paint.font("monoBold", tk.small * 1.15),
    C.ink,
  );
  paint.rule(ctx, L, B, R - L, tk.hair * 1.4, C.ink);
  const aFont = paint.font("mono", tk.axis);
  for (const h of [6, 12, 18, 0]) {
    const i = (((h - start) % 24) + 24) % 24;
    paint.drawCentered(ctx, pad2(h), L + i * slot + slot / 2, B + tk.axis * 1.7, aFont, C.gray);
  }
  return box.h;
}

/* ========================================================= C10 field */

/* The split density: ±1 SD band, area, ink line, dashed median with its
 * label, ← FASTER / SLOWER → in the corners, ticks every 20 s. Fills its
 * box. Null → its one line. */
export function drawSplit(ctx: Ctx, paint: PosterPaint, box: PosterBox, split: PosterSplit): number {
  const C = paint.c;
  const { tk } = paint;
  const yTop = paint.eyebrow(ctx, box.x, box.y, box.w, "THE FIELD", "SPLIT PER 500 M");
  if (!split || split.xs.length < 2 || split.xs.length !== split.ys.length) {
    return noteLine(ctx, paint, box.x, yTop, "NOT ENOUGH TIMED ROWS YET") - box.y;
  }
  const L = box.x;
  const R = box.x + box.w;
  const T = yTop + tk.axis * 1.8;
  const B = box.y + box.h - tk.axis * 2.4;
  if (!(B - T >= tk.axis * 2)) return box.h;
  const xMin = split.xs[0];
  const xMax = split.xs[split.xs.length - 1];
  const X = (s: number) => L + ((s - xMin) / Math.max(1, xMax - xMin)) * (R - L);
  const Y = (v: number) => T + (1 - Math.max(0, Math.min(1, v))) * (B - T);
  const bandL = Math.max(L, X(split.mean - split.sd));
  const bandR = Math.min(R, X(split.mean + split.sd));
  ctx.fillStyle = C.waterBand;
  ctx.fillRect(bandL, T, Math.max(0, bandR - bandL), B - T);
  ctx.save();
  ctx.beginPath();
  split.xs.forEach((s, i) => (i ? ctx.lineTo(X(s), Y(split.ys[i])) : ctx.moveTo(X(s), Y(split.ys[i]))));
  ctx.lineTo(X(xMax), B);
  ctx.lineTo(X(xMin), B);
  ctx.closePath();
  ctx.fillStyle = C.waterBandSoft;
  ctx.fill();
  ctx.beginPath();
  split.xs.forEach((s, i) => (i ? ctx.lineTo(X(s), Y(split.ys[i])) : ctx.moveTo(X(s), Y(split.ys[i]))));
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = tk.hair;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(X(split.median), T);
  ctx.lineTo(X(split.median), B);
  ctx.stroke();
  ctx.restore();
  const aFont = paint.font("mono", tk.axis);
  const medFont = paint.font("monoBold", tk.small);
  const med = `MED ${fmtClock(split.median)}`;
  const medW = paint.measure(ctx, med, medFont);
  const mx = X(split.median) + tk.axis * 0.5;
  const medX = mx + medW > R ? X(split.median) - tk.axis * 0.5 - medW : mx;
  paint.drawText(ctx, med, medX, T + tk.axis * 0.9, medFont, C.ink);
  const cornerFont = paint.font("mono", tk.axis * 0.9);
  paint.drawText(ctx, "← FASTER", L, T + tk.axis * 0.9, cornerFont, C.gray);
  paint.drawRight(ctx, "SLOWER →", R, T + tk.axis * 0.9, cornerFont, C.gray);
  paint.rule(ctx, L, B, R - L, tk.hair * 1.4, C.ink);
  // Ticks every 20 s, the end labels kept inside the frame.
  for (let s = Math.ceil(xMin / 20) * 20; s <= xMax + 1e-6; s += 20) {
    const t = fmtClock(s);
    const half = paint.measure(ctx, t, aFont) / 2;
    const cx = Math.max(L + half, Math.min(R - half, X(s)));
    paint.drawCentered(ctx, t, cx, B + tk.axis * 1.7, aFont, C.gray);
  }
  return box.h;
}

/* ======================================================== C11 ledger */

export type LedgerOpts = {
  /* Lines drawn = min(items, max, the lines that fit box.h); under `min`
   * nothing is drawn and 0 comes back (a fit:"lines" slot). */
  max: number;
  min: number;
};

/* The air between the thick rule and the first line (~10 on printL). */
export function ledgerAir(paint: PosterPaint): number {
  return paint.tk.ledger * 0.77;
}

/* The .bl ledger: thick rule on top, KEY ······ VALUE mono .1em, one
 * column (two when the box is ≥ 600 wide), pitch ledgerPitch. A value
 * drops its " · " tail before it ellipsizes. */
export function drawLedger(
  ctx: Ctx,
  paint: PosterPaint,
  box: PosterBox,
  items: PosterTakeaway[],
  o: LedgerOpts,
): number {
  const C = paint.c;
  const { tk } = paint;
  const air = ledgerAir(paint);
  const pitch = tk.ledgerPitch;
  const cols = box.w >= 600 ? 2 : 1;
  const bounded = Number.isFinite(box.h) && box.h > 0;
  const fitLines = bounded ? Math.floor((box.h + EPS - tk.thick - air) / pitch) * cols : Number.POSITIVE_INFINITY;
  const n = Math.min(items.length, o.max, fitLines);
  if (n < Math.min(o.min, items.length) || n <= 0) return 0;
  paint.rule(ctx, box.x, box.y, box.w, tk.thick);
  const y0 = box.y + tk.thick + air;
  const colW = (box.w - (cols - 1) * tk.gutter) / cols;
  const rows = Math.ceil(n / cols);
  const kFont = paint.font("mono", tk.ledger);
  const vFont = paint.font("monoBold", tk.ledger);
  const tr = 0.1 * tk.ledger;
  for (let i = 0; i < n; i++) {
    const it = items[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = box.x + col * (colW + tk.gutter);
    const base = y0 + row * pitch + tk.ledger;
    const key = it.label.toUpperCase();
    const kw = paint.measure(ctx, key, kFont, tr);
    paint.drawText(ctx, key, x, base, kFont, C.inkSoft, tr);
    const value = fitValue(ctx, paint, it.value.toUpperCase(), vFont, tr, colW - kw - tk.ledger * 2.4);
    const vw = paint.measure(ctx, value, vFont, tr);
    paint.drawRight(ctx, value, x + colW, base, vFont, C.ink, tr);
    const l1 = x + kw + tk.ledger * 0.6;
    const l2 = x + colW - vw - tk.ledger * 0.6;
    if (l2 - l1 > tk.ledger) paint.dottedRule(ctx, l1, l2, base - tk.ledger * 0.05);
  }
  return tk.thick + air + rows * pitch;
}

/* ========================================================== C12 club */

export type ClubOpts = {
  /* "all": every name is drawn even past box.h (the engine cascades before
   * that — measure reported the full height); "cap": "+ N MORE" in the
   * last cell when the roll cannot fit. */
  fit: "all" | "cap";
  colsMax?: number;
};

/* The honour roll: "FIRST TO 100,000 M · NAME · SEP 8", then number + name
 * flowing DOWN as many columns as the widest name allows, public-board
 * order, names only — never meters. Two type steps (row / rowPitch × .83,
 * then small / rowPitch × .69) before the roll caps; the engine's `step`
 * shrink (paint.tk.step) forces the small one. */
export function drawClub(ctx: Ctx, paint: PosterPaint, box: PosterBox, club: PosterClub, o: ClubOpts): number {
  const C = paint.c;
  const { tk } = paint;
  const n = club.count;
  const right = n === 1 ? "ONE ROWER AT 100,000 M OR MORE" : `${n} ROWERS AT 100,000 M OR MORE`;
  let y = paint.eyebrow(ctx, box.x, box.y, box.w, "THE 100K CLUB", right, n === 1 ? "ONE ROWER" : `${n} ROWERS`);
  if (club.first) {
    const lFont = paint.font("mono", tk.ledger);
    const bFont = paint.font("monoBold", tk.ledger);
    const tr = 0.08 * tk.ledger;
    const base = y + tk.ledger;
    const runs: Run[] = [
      { text: "FIRST TO 100,000 M · ", color: C.inkSoft },
      { text: club.first.name.toUpperCase(), color: C.ink, font: bFont },
      { text: ` · ${club.first.day.toUpperCase()}`, color: C.inkSoft },
    ];
    drawRuns(ctx, paint, fitRuns(ctx, paint, runs, lFont, tr, box.w), box.x, base, lFont, tr);
    y += tk.ledger * 1.5;
  }
  const roll = club.roll;
  if (roll.length === 0) {
    if (n === 0) return noteLine(ctx, paint, box.x, y, "NOBODY YET — THE FIRST 100,000 M IS STILL OPEN") - box.y;
    return y - box.y;
  }
  const bounded = Number.isFinite(box.h) && box.h > 0;
  const room = bounded ? box.y + box.h - y : Number.POSITIVE_INFINITY;
  const colsMax = o.colsMax ?? 6;
  const plan = (size: number, pitch: number) => {
    const numF = paint.font("mono", size * 0.86);
    const nameF = paint.font("archivoBold", size);
    const widest =
      Math.max(
        ...roll.map(
          (r) => paint.measure(ctx, `${fmtRowerNumber(r.rowerNumber)} `, numF) + paint.measure(ctx, r.name, nameF),
        ),
      ) +
      tk.small * 3;
    const cols = Math.max(1, Math.min(colsMax, Math.floor(box.w / widest)));
    const rows = Math.ceil(roll.length / cols);
    return { size, pitch, cols, rows, numF, nameF, h: rows * pitch };
  };
  const big = plan(tk.row, tk.rowPitch * 0.83);
  const smallStep = plan(tk.small, tk.rowPitch * 0.69);
  // A box the engine sized off this module's own measure equals the roll to
  // the decimal; the half-unit keeps a floating-point tie from stepping down.
  const p = tk.step || big.h > room + EPS ? smallStep : big;
  const maxRows = Math.max(1, Math.floor((room + EPS) / p.pitch));
  const fits = p.cols * maxRows;
  const showAll = o.fit === "all" || roll.length <= fits;
  const shown = showAll ? roll : roll.slice(0, Math.max(0, fits - 1));
  const rows = showAll ? p.rows : Math.min(p.rows, maxRows);
  const colW = box.w / p.cols;
  shown.forEach((r, i) => {
    const col = Math.floor(i / rows);
    const row = i % rows;
    const x = box.x + col * colW;
    const base = y + row * p.pitch + p.size;
    const numT = `${fmtRowerNumber(r.rowerNumber)} `;
    paint.drawText(ctx, numT, x, base, p.numF, C.gray);
    const nw = paint.measure(ctx, numT, p.numF);
    paint.drawText(ctx, paint.ellipsize(ctx, r.name, colW - nw - p.size, p.nameF), x + nw, base, p.nameF, C.ink);
  });
  if (!showAll) {
    const i = shown.length;
    const col = Math.floor(i / rows);
    const row = i % rows;
    paint.drawText(
      ctx,
      `+ ${roll.length - shown.length} MORE`,
      box.x + col * colW,
      y + row * p.pitch + p.size,
      p.numF,
      C.gray,
      0.08 * p.size,
    );
  }
  return y + rows * p.pitch - box.y;
}

/* ========================================================= S14 plate */

/* Under plateMinH the plan drops the plate; at plateStackH it gets the
 * STACK layout; plateMaxH is as tall as it will ever go beside a long roll. */
export function plateMinH(paint: PosterPaint): number {
  return paint.tk.ledger * 8.5;
}
export function plateStackH(paint: PosterPaint): number {
  return paint.tk.ledger * 14.6;
}
export function plateMaxH(paint: PosterPaint): number {
  return paint.tk.ledger * 17.7;
}

/* The partner ad box on the Grizzly green: a 2-unit border, the bear at
 * its native ratio at twice the wordmark height, "THE CODE" sage,
 * ROWTEMBER gold Archivo Black, the deal in cream. Takes box.h up to
 * plateMaxH; draws nothing under plateMinH. */
export function drawPlate(
  ctx: Ctx,
  paint: PosterPaint,
  box: PosterBox,
  partner: PosterPartner,
  year: number,
): number {
  const C = paint.c;
  const { tk, assets } = paint;
  const h = Math.min(box.h, plateMaxH(paint));
  if (!(h >= plateMinH(paint))) return 0;
  ctx.fillStyle = C.gzGreen;
  ctx.fillRect(box.x, box.y, box.w, h);
  ctx.save();
  // THEIR GREEN, OUR RULE. Grizzly's five colours are the same on both
  // stocks — a partner who wants a mono lockup supplies one, we never
  // derive one. The BORDER is ours, and it is the one value that has to
  // move: their #06130c against #15171A is 1.06:1, so on black the panel
  // would read as a hole punched in the sheet rather than a plate laid on
  // it. `plateEdge` is their edge on cream and a .3 white rule on bw.
  ctx.strokeStyle = C.plateEdge;
  ctx.lineWidth = 2;
  ctx.strokeRect(box.x + 1, box.y + 1, box.w - 2, h - 2);
  ctx.restore();
  const stack = h >= plateStackH(paint);
  const cx = box.x + box.w / 2;
  const smallF = paint.font("mono", stack ? tk.small : tk.small * 0.9);
  const markH = stack ? tk.ledger * 3.4 : tk.ledger * 2.6;
  const bear = assets.bear;
  const wm = assets.wordmark;
  const bearW = bear ? (bear.naturalWidth / Math.max(1, bear.naturalHeight)) * markH : markH * 0.95;
  const wmH = markH * 0.5;
  const wmW = wm ? (wm.naturalWidth / Math.max(1, wm.naturalHeight)) * wmH : wmH * 6.9;
  const gapM = stack ? tk.ledger * 1.2 : tk.ledger;
  let y = box.y + (stack ? tk.ledger * 1.4 : tk.ledger * 1.26);
  if (stack) {
    paint.drawCentered(ctx, `ROWTEMBER ${year} · PARTNER`, cx, y + tk.small, smallF, C.gzSage, 0.22 * tk.small);
    y += tk.small * 2.4;
  }
  let x = cx - (bearW + gapM + wmW) / 2;
  paint.image(ctx, bear, x, y, bearW, markH);
  x += bearW + gapM;
  paint.image(ctx, wm, x, y + (markH - wmH) / 2, wmW, wmH);
  if (!wm) {
    // No wordmark loaded: the partner's name in cream where it would sit.
    paint.drawText(ctx, partner.name.toUpperCase(), x, y + markH * 0.62, paint.font("black", wmH * 0.9), C.gzCream, 0.04 * wmH);
  }
  y += markH + (stack ? tk.ledger * 1.6 : tk.ledger * 1.1);
  paint.drawCentered(ctx, "THE CODE", cx, y + tk.small * 0.9, smallF, C.gzSage, 0.22 * tk.small);
  y += stack ? tk.small * 1.6 : tk.small * 1.5;
  const codeS = stack ? tk.recV * 1.05 : tk.ledger * 1.7;
  paint.drawCentered(ctx, partner.code.toUpperCase(), cx, y + codeS * 0.84, paint.font("black", codeS), C.gzGold, 0.02 * codeS);
  y += codeS * (stack ? 1.15 : 1.05);
  const deal = paint.ellipsize(ctx, partner.deal.toUpperCase(), box.w - tk.ledger * 2, smallF, 0.1 * tk.small);
  paint.drawCentered(ctx, deal, cx, y + tk.small * 0.9, smallF, C.gzCream, 0.1 * tk.small);
  return h;
}

/* ======================================================== S15 footer */

/* Thick rule; MIKIAN MUSSER; the URL and the handle in gray mono; a third
 * line ("for yourself and others" on print, the partner line on the
 * phone). Everything on the left — nothing parked on the right of a bar. */
export function drawFooter(ctx: Ctx, paint: PosterPaint, box: PosterBox): number {
  const C = paint.c;
  const { tk } = paint;
  paint.rule(ctx, box.x, box.y, box.w, tk.thick);
  const y = box.y + tk.thick + tk.footer * 1.4;
  // ONE line, the site footer's last line and nothing else (owner,
  // 2026-09-10: the bold name, the URL and the handle come off, "and we
  // just replace it with for yourself and others" — in the treatment the
  // footer gives it: mono, gray, upper, letterspaced).
  paint.drawText(
    ctx,
    "FOR YOURSELF AND OTHERS",
    box.x,
    y + tk.footer * 0.85,
    paint.font("mono", tk.footer * 0.92),
    C.gray,
    0.14 * tk.footer,
  );
  return y + tk.footer * 1.55 - box.y;
}
