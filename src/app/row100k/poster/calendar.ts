/* poster/calendar.ts — WHERE THE CALENDAR'S CELLS GO, for both months
 * (rowerCharts.ts drawMonth, the rower's; charts.ts drawMonth, the
 * community's and the M2D window's). The two drawings keep their own cell
 * painting; this file owns the geometry and the column of figures that
 * stands beside a grid narrower than its measure.
 *
 * THE MONTHS AS THEIR OWN GRIDS (owner, 2026-11-26, of his All time story:
 * "this is what the calendar looks like when I'm sharing the whole view,
 * or when I'm sharing for all meters ... we obviously just need to fix the
 * format ... And obviously I don't like how it clips on it"). All time
 * used to be one continuous seven-column run from Sep 1 to today — twelve
 * rows and counting, past the footer and off the sheet. A span that
 * crosses a month is now cut at every 1st into small grids of its own,
 * each labelled SEP / OCT / NOV, laid side by side and wrapped; the
 * number of grids across is whichever gives the biggest square cell in
 * the room the engine hands the module, so the calendar always fits its
 * box and never draws past the footer, whatever month it is.
 *
 * NO PAPER LEFT AND RIGHT (owner, 2026-11-26: "I don't like how there's so
 * much white space on the left and the right. Like this could get split
 * up, right? Like the month could be on the left and there could be
 * another stat on the right"). A grid held narrower than its measure — a
 * capped phone cell, a month bound by the height of its row — stands at
 * the left of the measure and the room on its right is a column of the
 * calendar's own figures (calendarFigures, drawCalendarSide): the days
 * rowed, the longest streak, the best day, week and month, the meters a
 * day. All of it is read off the cells the grid already draws; no site
 * address, nothing the grid was not handed. The same figures take the
 * hole beside a month left alone on the last row of grids, and the band of
 * paper under a calendar bound by its width (the drawings' own call); a
 * grid only a little too wide for them gives up at most a fifth of its
 * cell to make the room. Cells stay square throughout (owner, 2026-11-26:
 * "the squares ... get a little rectangle-y").
 *
 * PURE geometry over tokens, plus the one drawing of the figures. */

import { dayPlus, domAt } from "./span";
import type { PosterBox, PosterPaint, PosterTokens } from "./types";

type Ctx = CanvasRenderingContext2D;

const SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export type CalBlock = {
  /* "SEP", "JAN ’27" — null on a one-grid calendar. */
  label: string | null;
  /* The span's index of the block's first day, and its day count. */
  start: number;
  days: number;
  /* The weekday of the block's first day, 0 = Sunday. */
  firstDow: number;
  rows: number;
  /* Where the block's label sits (its top), and where its first cell row starts. */
  x: number;
  labelY: number;
  top: number;
};

export type CalGrid = {
  cell: number;
  gap: number;
  blocks: CalBlock[];
  /* The baseline row of the S M T W T F S letters, one per block column. */
  dowY: number;
  dowXs: number[];
  /* The height used, from the top of the first labels (or letters) to the
   * last cell row. */
  h: number;
  /* The width the grids take, left edge to right edge. */
  gridW: number;
  /* The room for the figures — the grid's right, or the hole beside a lone
   * month on the last row — or null. */
  side: PosterBox | null;
  /* The top-left of the span's i-th cell. */
  at(i: number): { x: number; y: number };
};

export type CalOpts = {
  x: number;
  y: number;
  w: number;
  /* The cells drawn: the elapsed days, or the whole grid. */
  shown: number;
  firstDay: string;
  firstDow: number;
  /* Cut the span at every 1st into a grid of its own (all time). */
  split: boolean;
  /* The most a cell may be, and the height the calendar must live in
   * (from the top of the weekday letters). Absent: as wide as the measure. */
  cellCap?: number;
  maxH?: number;
  /* Where a narrow grid stands when there is no room for the figures. */
  align: "center" | "left";
  /* A column of figures may take the room on the grid's right. */
  side: boolean;
};

const gapOf = (tk: PosterTokens) => tk.small * 0.7;
const axisOf = (tk: PosterTokens) => tk.small * 1.9;

/* The months the shown days fall in: one block, or one per month. */
function blocksOf(o: CalOpts): Omit<CalBlock, "x" | "labelY" | "top">[] {
  const out: Omit<CalBlock, "x" | "labelY" | "top">[] = [];
  let start = 0;
  const shown = Math.max(1, o.shown);
  for (let i = 1; i <= shown; i++) {
    if (i === shown || (o.split && domAt(o.firstDay, i) === 1)) {
      const days = i - start;
      const firstDow = (o.firstDow + start) % 7;
      out.push({ label: null, start, days, firstDow, rows: Math.ceil((days + firstDow) / 7) });
      start = i;
    }
  }
  if (out.length > 1) {
    const y0 = dayPlus(o.firstDay, 0).slice(0, 4);
    for (const b of out) {
      const day = dayPlus(o.firstDay, b.start);
      const word = SHORT[Number(day.slice(5, 7)) - 1];
      b.label = day.slice(0, 4) === y0 ? word : `${word} ’${day.slice(2, 4)}`;
    }
  }
  return out;
}

/* The side column wants at least this much room before the grid gives up
 * the middle of the measure for it. */
const sideMin = (tk: PosterTokens, w: number) => Math.max(w * 0.2, tk.statN * 1.8);
const sideGutter = (tk: PosterTokens) => tk.small * 2.4;

export function calendarGrid(tk: PosterTokens, o: CalOpts): CalGrid {
  const gap = gapOf(tk);
  const axisH = axisOf(tk);
  const raw = blocksOf(o);
  const k = raw.length;
  const multi = k > 1;
  const labelH = multi ? tk.small * 2 : 0;
  const G = multi ? tk.small * 2.4 : 0;
  const V = multi ? tk.small * 1.2 : 0;
  const cap = o.cellCap ?? Number.POSITIVE_INFINITY;

  type Fit = { c: number; R: number[]; A: number; B: number; cell: number };
  const fitFor = (c: number): Fit => {
    const r = Math.ceil(k / c);
    const R: number[] = [];
    for (let j = 0; j < r; j++) R.push(Math.max(...raw.slice(j * c, j * c + c).map((b) => b.rows)));
    const B = R.reduce((a, b) => a + b, 0);
    const A = axisH + r * labelH + R.reduce((a, b) => a + (b - 1) * gap, 0) + (r - 1) * V;
    const byW = (o.w - (c - 1) * G - c * 6 * gap) / (7 * c);
    const byH = o.maxH === undefined ? Number.POSITIVE_INFINITY : (o.maxH - A) / B;
    return { c, R, A, B, cell: Math.max(0, Math.min(cap, byW, byH)) };
  };
  // The biggest square cell wins; a tie goes to more grids across, the
  // shorter and wider calendar.
  let best = fitFor(1);
  for (let c = 2; c <= k; c++) {
    const f = fitFor(c);
    if (f.cell >= best.cell - 1e-6) best = f;
  }
  const { c, R } = best;
  let cell = best.cell;
  // TOO LITTLE ROOM FOR THE FIGURES, TOO MUCH TO LEAVE (owner, 2026-11-26:
  // "maybe they could be smaller. Probably not. I don't like how there's
  // so much white space on the left and the right"): a single grid held by
  // its height a little under the measure — a FINAL month on a post —
  // gives up at most a fifth of its cell so the figures column fits beside
  // it, rather than stand in the middle with a strip of paper either side.
  const need = sideGutter(tk) + sideMin(tk, o.w);
  const spare = o.w - (7 * cell + 6 * gap);
  if (o.side && !multi && spare > o.w * 0.1 && spare < need) {
    const smaller = (o.w - need - 6 * gap) / 7;
    if (smaller >= cell * 0.8) cell = smaller;
  }
  const blockW = 7 * cell + 6 * gap;
  const cols = Math.min(c, k);
  const gridW = cols * blockW + (cols - 1) * G;
  const room = o.w - gridW;
  const useSide = o.side && room - sideGutter(tk) >= sideMin(tk, o.w) - 0.01;
  // A last row with a hole in it (see THE HOLE below) stands left too, so
  // the hole is the paper the figures take instead of two margins.
  const holed = o.side && multi && k % c !== 0;
  // MONTHS ACROSS THE WHOLE MEASURE (owner, 2026-11-26: "I don't like how
  // there's so much white space on the left and the right"): grids several
  // across that the height holds under the width are spread edge to edge,
  // the paper going between them rather than either side.
  const spread = multi && !useSide && cols > 1 && room > 0;
  const Gx = spread ? G + room / (cols - 1) : G;
  const x0 = useSide || holed || spread || o.align === "left" ? o.x : o.x + Math.max(0, room / 2);

  // Each block row is its labels, then (the first row only) the weekday
  // letters, then the cells: SEP / S M T W T F S / the grid.
  const blocks: CalBlock[] = [];
  let y = o.y;
  const rowTops: number[] = [];
  for (let j = 0; j < R.length; j++) {
    const labelY = y;
    const top = y + labelH + (j === 0 ? axisH : 0);
    rowTops.push(top);
    raw.slice(j * c, j * c + c).forEach((b, i) => {
      blocks.push({ ...b, x: x0 + i * (blockW + Gx), labelY, top });
    });
    y = top + R[j] * cell + (R[j] - 1) * gap + V;
  }
  const h = y - V - o.y;
  const dowXs = Array.from({ length: cols }, (_, i) => x0 + i * (blockW + Gx));
  let side: PosterBox | null = useSide
    ? { x: o.x + gridW + sideGutter(tk), y: rowTops[0], w: o.w - gridW - sideGutter(tk), h: o.y + h - rowTops[0] }
    : null;
  // THE HOLE IN THE LAST ROW (owner, 2026-11-26, no paper left and right):
  // three months on two grids across leave NOV alone on its row and a
  // block of paper beside it. The figures go there.
  const last = R.length - 1;
  const inLast = k - last * c;
  if (!side && o.side && multi && inLast < c) {
    const hx = x0 + inLast * (blockW + Gx);
    const hw = o.x + o.w - hx;
    if (hw >= sideMin(tk, o.w)) side = { x: hx, y: rowTops[last], w: hw, h: R[last] * cell + (R[last] - 1) * gap };
  }
  const at = (i: number) => {
    let b = blocks[0];
    for (const bl of blocks) if (bl.start <= i) b = bl;
    const idx = i - b.start + b.firstDow;
    return { x: b.x + (idx % 7) * (cell + gap), y: b.top + Math.floor(idx / 7) * (cell + gap) };
  };
  return { cell, gap, blocks, dowY: o.y + labelH + tk.small, dowXs, h, gridW, side, at };
}

/* What the measure asks for on a span cut into months: the engine grows a
 * phone month into the slack, so a phone asks for a short calendar and
 * draws into what it is handed; a wall sheet's month is a fixed member of
 * its side stack, so it asks for the room it means to keep. Under the
 * `chart` shrink step it asks for less. */
export function calendarBudget(paint: PosterPaint, w: number): number {
  const phone = paint.format.family === "phone";
  return w * (phone ? 0.7 : 1.6) * (paint.tk.chart ? 0.75 : 1);
}

/* The block labels and the weekday letters, drawn once per grid column
 * over the first row of grids. */
export function drawCalendarFrame(
  ctx: Ctx,
  paint: PosterPaint,
  g: CalGrid,
  letters: readonly string[],
  dowSize: number = paint.tk.small,
): void {
  const { tk } = paint;
  const C = paint.c;
  const dow = paint.font("mono", dowSize);
  for (const x of g.dowXs) {
    letters.forEach((d, i) =>
      paint.drawCentered(ctx, d, x + i * (g.cell + g.gap) + g.cell / 2, g.dowY, dow, C.gray, 0.1 * tk.small),
    );
  }
  const lab = paint.font("monoBold", tk.small);
  for (const b of g.blocks) {
    if (!b.label) continue;
    paint.drawText(ctx, b.label, b.x, b.labelY + tk.small * 1.05, lab, C.ink, 0.14 * tk.small);
  }
}

/* ------------------------------------------------------------ figures */

export type CalFigure = { value: string; label: string; note?: string };

/* Labels stay short (DAYS ROWED, DAY STREAK, BEST WEEK): a side column on
 * a phone is about ninety units wide, and a label is never cut. */

const n = (v: number) => Math.round(v).toLocaleString("en-US");
/* "38K" / "4.2M" — rowerCharts.ts abbr, copied so the two drawings that
 * import this file are not imported back. */
const abbr = (v: number): string =>
  v >= 1_000_000 ? `${+(v / 1_000_000).toFixed(2)}M` : v >= 1000 ? `${Math.round(v / 1000)}K` : String(Math.round(v));
const dayTag = (day: string) => `${SHORT[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}`;
/* "NOV 15–21", or "SEP 28–OCT 4" for a week across the 1st. */
const weekTag = (a: string, b: string) =>
  a.slice(0, 7) === b.slice(0, 7) ? `${dayTag(a)}–${Number(b.slice(8, 10))}` : `${dayTag(a)}–${dayTag(b)}`;

/* The calendar's own figures, off the cells it draws: `meters` per day
 * (null when the rower's meters are hidden — then only what the dots
 * already say), `rowed` per day, over the elapsed `dayN` days. A rower's
 * column leads with the days rowed and the streak (the ledger and the
 * bests already carry the best day and the meters a day on the wall);
 * everyone's leads with the best day. Best week is a row of the grid,
 * Sunday to Saturday; best month only when the span holds more than one. */
export function calendarFigures(
  kind: "rower" | "community",
  meters: number[] | null,
  rowed: boolean[] | null,
  firstDay: string,
  firstDow: number,
  dayN: number,
  multi: boolean,
): CalFigure[] {
  const m = (i: number) => (meters ? Math.max(0, meters[i] ?? 0) : 0);
  const did = (i: number) => m(i) > 0 || !!rowed?.[i];
  let days = 0;
  let streak = 0;
  let run = 0;
  let total = 0;
  let bestDay = -1;
  for (let i = 0; i < dayN; i++) {
    total += m(i);
    if (did(i)) {
      days++;
      run++;
      streak = Math.max(streak, run);
    } else run = 0;
    if (meters && m(i) > 0 && (bestDay < 0 || m(i) > m(bestDay))) bestDay = i;
  }
  // Weeks are the grid's rows, months its blocks.
  const weeks = new Map<number, { sum: number; first: number; last: number }>();
  const months = new Map<string, { sum: number; days: number }>();
  for (let i = 0; i < dayN; i++) {
    const wk = Math.floor((i + firstDow) / 7);
    const w = weeks.get(wk) ?? { sum: 0, first: i, last: i };
    w.sum += m(i);
    w.last = i;
    weeks.set(wk, w);
    const key = dayPlus(firstDay, i).slice(0, 7);
    const mo = months.get(key) ?? { sum: 0, days: 0 };
    mo.sum += m(i);
    if (did(i)) mo.days++;
    months.set(key, mo);
  }
  let bestWeek: { sum: number; first: number; last: number } | null = null;
  for (const w of weeks.values()) if (w.sum > 0 && (!bestWeek || w.sum > bestWeek.sum)) bestWeek = w;
  let bestMonth: [string, { sum: number; days: number }] | null = null;
  for (const e of months.entries()) {
    const score = meters ? e[1].sum : e[1].days;
    if (score > 0 && (!bestMonth || score > (meters ? bestMonth[1].sum : bestMonth[1].days))) bestMonth = e;
  }
  const monthWord = (key: string) => SHORT[Number(key.slice(5, 7)) - 1];
  const out: CalFigure[] = [];
  const week = bestWeek && {
    value: n(bestWeek.sum),
    label: "BEST WEEK",
    note: weekTag(dayPlus(firstDay, bestWeek.first), dayPlus(firstDay, bestWeek.last)),
  };
  const month = multi && bestMonth && {
    value: meters ? n(bestMonth[1].sum) : String(bestMonth[1].days),
    label: meters ? "BEST MONTH" : "MOST DAYS",
    note: monthWord(bestMonth[0]),
  };
  if (kind === "rower") {
    out.push({ value: String(days), label: "DAYS ROWED", note: `OF ${dayN}` });
    if (streak > 0) out.push({ value: String(streak), label: "DAY STREAK", note: "THE LONGEST" });
    if (month) out.push(month);
    if (week) out.push(week);
    if (bestDay >= 0) out.push({ value: n(m(bestDay)), label: "BEST DAY", note: dayTag(dayPlus(firstDay, bestDay)) });
    return out;
  }
  if (bestDay >= 0) out.push({ value: n(m(bestDay)), label: "BEST DAY", note: dayTag(dayPlus(firstDay, bestDay)) });
  if (week) out.push(week);
  if (month) out.push(month);
  if (total > 0) out.push({ value: n(total / Math.max(1, dayN)), label: "METERS A DAY", note: `OVER ${dayN} DAYS` });
  return out;
}

/* The figures: each a black number over a gray mono label and its note,
 * the strip's idiom stood on end — one column beside a grid, two or three
 * across in a wider box (the hole beside a lone month, the paper under a
 * calendar bound by its width). One size for every number, fitted to the
 * widest; long numbers go to "38K" before a figure is dropped, and as
 * many figures as the box holds, in order. Returns the height used, 0
 * when not one figure fits. */
export function drawCalendarSide(ctx: Ctx, paint: PosterPaint, box: PosterBox, figs: CalFigure[]): number {
  if (!figs.length || box.w <= 0 || box.h <= 0) return 0;
  const { tk } = paint;
  const C = paint.c;
  const black = (s: number) => paint.font("black", s);
  const ls = tk.small;
  const lf = paint.font("mono", ls);
  const track = 0.12 * ls;
  const top = tk.statN * 0.9;
  const floor = Math.max(ls * 1.6, tk.statN * 0.55);
  const colG = ls * 2.4;
  const minSep = ls * 1.4;
  const textOf = (list: CalFigure[]) => (list.some((f) => f.note) ? ls * 3.6 : ls * 2.2);
  const widest = (list: CalFigure[], s: number) =>
    Math.max(...list.map((f) => paint.measure(ctx, f.value, black(s), -0.01 * s)));
  const short = figs.map((f) =>
    /^[\d,]+$/.test(f.value) && f.value.length > 4 ? { ...f, value: abbr(Number(f.value.replace(/,/g, ""))) } : f,
  );
  // A band too short for the notes (the date under BEST DAY) keeps the
  // figures and loses the notes before it loses a figure.
  const bare = (l: CalFigure[]) => l.map(({ value, label }) => ({ value, label }));
  type Pick = { ncol: number; colW: number; list: CalFigure[]; size: number };
  let best: Pick | null = null;
  const noted = (p: Pick) => (p.list.some((f) => f.note) ? 1 : 0);
  const better = (a: Pick, b: Pick | null) =>
    !b ||
    a.list.length > b.list.length ||
    (a.list.length === b.list.length && (noted(a) > noted(b) || (noted(a) === noted(b) && a.size > b.size + 0.5)));
  for (let ncol = 1; ncol <= Math.min(4, figs.length); ncol++) {
    const colW = (box.w - (ncol - 1) * colG) / ncol;
    if (colW < tk.statN * 1.6) break;
    // A label is never cut to "DAYS ROW…" to make a second column: more
    // columns only when every label and note fits whole.
    const wordW = Math.max(...figs.flatMap((f) => [f.label, f.note ?? ""]).map((t) => paint.measure(ctx, t, lf, track)));
    if (ncol > 1 && wordW > colW) break;
    for (const variant of [figs, short, bare(figs), bare(short)]) {
      for (let count = variant.length; count >= 1; count--) {
        const list = variant.slice(0, count);
        const rows = Math.ceil(count / ncol);
        const byW = (top * colW) / Math.max(1, widest(list, top));
        const byH = (box.h - (rows - 1) * minSep - rows * textOf(list)) / (rows * 0.74);
        const size = Math.min(top, byW, byH);
        if (size < floor) continue;
        const p = { ncol, colW, list, size };
        if (better(p, best)) best = p;
        break;
      }
    }
  }
  if (!best) return 0;
  const { ncol, colW, list, size } = best;
  const rows = Math.ceil(list.length / ncol);
  const itemH = size * 0.74 + textOf(list);
  const sep = rows > 1 ? Math.min(ls * 4, (box.h - rows * itemH) / (rows - 1)) : 0;
  list.forEach((f, i) => {
    const r = Math.floor(i / ncol);
    const x = box.x + (i % ncol) * (colW + colG);
    const y = box.y + r * (itemH + sep);
    if (r > 0) paint.rule(ctx, x, y - sep / 2, colW, tk.hair, C.line);
    const base = y + size * 0.74;
    paint.drawText(ctx, f.value, x, base, black(size), C.ink, -0.01 * size);
    let ly = base + ls * 1.1 + ls * 0.8;
    paint.drawText(ctx, paint.ellipsize(ctx, f.label, colW, lf, track), x, ly, lf, C.gray, track);
    if (f.note) {
      ly += ls * 1.3;
      paint.drawText(ctx, paint.ellipsize(ctx, f.note, colW, lf, track), x, ly, lf, C.gray, track);
    }
  });
  return rows * itemH + (rows - 1) * sep;
}

/* What drawCalendarSide needs under a calendar for one row of figures. */
export const calendarStripH = (paint: PosterPaint): number =>
  Math.max(paint.tk.small * 1.6, paint.tk.statN * 0.55) * 0.74 + paint.tk.small * 2.2;
