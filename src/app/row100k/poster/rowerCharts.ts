/* poster/rowerCharts.ts — the rower poster's own drawings: the month
 * calendar, the pace curve and the multi-column log. ROWER stream.
 *
 * Pure canvas geometry over a RowerPoster; nothing here decides what is
 * hidden. A masked payload arrives with `month.meters === null`, `pace ===
 * null`, shapes in the log rows and `split === null` (types.ts), and each
 * drawing has a masked form that never asks for the number: the calendar
 * draws DAYS ROWED dots, the pace slot is not a curve at all (rower.ts
 * draws the dog tag there), the log draws blocks and loses its SPLIT
 * column. The renderer cannot print what it was never handed.
 *
 * The calendar is the twin of the community month (charts.ts, COMMUNITY
 * stream) with the site's fixed 2,500 / 5,000 / 10,000 buckets
 * (Heatmap.tsx — "a 10k day IS dark"). It is drawn here because charts.ts
 * did not exist when this stream started; once both are in, one should
 * call the other (see the stream report). The pace curve is
 * r/[num]/looks/PaceCurve.tsx on paper, rule for rule. */

import {
  DOW_LETTERS,
  GRAY,
  GRID,
  GZ_CREAM,
  GZ_EDGE,
  GZ_GOLD,
  GZ_GREEN,
  GZ_SAGE,
  HEAT,
  INK,
  INK_SOFT,
  LINE,
  MEDAL_BRONZE,
  MEDAL_GOLD,
  MEDAL_SILVER,
  PAPER,
  SEP_FIRST_DOW,
  WATER,
  WHITE,
  kLabel,
} from "./paint";
import type { PosterBox, PosterPaint, PosterTokens, RowerLogRow } from "./types";

type Ctx = CanvasRenderingContext2D;

/* SPEC.md §4 — the paper palette, by the rower modules' own names, built
 * from paint.ts so the rower sheet and the community sheet are one paper
 * idiom: tune a colour there and both posters follow. Blocks are always
 * ink, water is the one colour, and the Grizzly plate is the only dark
 * surface on the sheet. */
export const PAL = {
  paper: PAPER,
  ink: INK,
  inkSoft: INK_SOFT,
  gray: GRAY,
  line: LINE,
  grid: GRID,
  water: WATER,
  ramp: HEAT,
  gold: MEDAL_GOLD,
  silver: MEDAL_SILVER,
  bronze: MEDAL_BRONZE,
  gzGreen: GZ_GREEN,
  gzDark: GZ_EDGE,
  gzCream: GZ_CREAM,
  gzSage: GZ_SAGE,
  gzGold: GZ_GOLD,
} as const;

/* The September calendar constants and the cell label are paint.ts's
 * (share/cards.ts originals); re-exported for the rower modules. */
export { DOW_LETTERS, SEP_FIRST_DOW, kLabel };

/* Heatmap.tsx ONE_ROWER thresholds — a rower's day, not a community's. */
const ROWER_BUCKETS = [2500, 5000, 10000];

/* "32K" / "4.2M" — axis ticks and the EVERYONE line. */
export const abbr = (v: number): string =>
  v >= 1_000_000
    ? `${+(v / 1_000_000).toFixed(1)}M`
    : v >= 1000
      ? `${Math.round(v / 1000)}K`
      : String(Math.round(v));

/* "1:52.8" — a split with tenths (PaceCurve.tsx clock). */
export const clockTenths = (s: number): string => {
  const t = Math.round(s * 10);
  return `${Math.floor(t / 600)}:${String(Math.floor((t % 600) / 10)).padStart(2, "0")}.${t % 10}`;
};

/* ================================================================= month */

export type MonthOpts = {
  /* The full five-row September grid (print on the wall), or the elapsed
   * weeks only (phone, hand-outs) — SPEC §6 C6. */
  full: boolean;
  /* The story caps a cell at 44, the post at 56. */
  cellCap?: number;
  /* The height the grid must live in (the box the engine handed the
   * module, eyebrow already taken); the cell shrinks to it. Absent when
   * measuring. */
  maxH?: number;
};

export type MonthLayout = {
  cell: number;
  gap: number;
  rows: number;
  days: number;
  axisH: number;
  h: number;
  /* The grid's own width; less than the measure when the cell is capped. */
  gridW: number;
};

/* The cell the calendar draws at this width: the measure's share, the
 * format's cap, and — under the engine's `chart` shrink step (tk.chart) —
 * the minimum the phone plans fall back to so a FINAL five-row month
 * still fits under the headline (SPEC §8.4; the step is spent on the
 * story and post plans only). */
function cellFor(tk: PosterTokens, w: number, opts: MonthOpts): number {
  const gap = tk.small * 0.7;
  const byWidth = (w - 6 * gap) / 7;
  let cell = Math.min(opts.cellCap ?? byWidth, byWidth);
  if (tk.chart) cell = Math.min(cell, (opts.cellCap ?? byWidth) * 0.68);
  return cell;
}

/* The grid the calendar will draw at this width — the height is what the
 * module's measure() reports (eyebrow excluded). */
export function monthLayout(tk: PosterTokens, w: number, dayNumber: number, opts: MonthOpts): MonthLayout {
  const gap = tk.small * 0.7;
  const days = opts.full ? 30 : Math.min(30, Math.max(1, dayNumber));
  const rows = Math.ceil((days + SEP_FIRST_DOW) / 7);
  const axisH = tk.small * 1.9;
  let cell = cellFor(tk, w, opts);
  if (opts.maxH !== undefined) {
    // Drawn into a budget: the box the engine composed is the truth. The
    // cap governs what the month ASKS for (so the bests get their lines);
    // once the row is grown past that — the bests gone, the room the
    // month's — the grid fills the measure rather than sit beside paper.
    // Never taller than the box; never under 60 % of the cap (a guard,
    // the engine agreed the height).
    const byWidth = (w - 6 * gap) / 7;
    const fit = (opts.maxH - axisH - (rows - 1) * gap) / rows;
    cell = Math.max(Math.min(byWidth, fit), (opts.cellCap ?? byWidth) * 0.6);
  }
  return {
    cell,
    gap,
    rows,
    days,
    axisH,
    h: axisH + rows * cell + (rows - 1) * gap,
    gridW: cell * 7 + gap * 6,
  };
}

/* Seven columns S M T W T F S, Sep 1 under the T. Future days are paper
 * (no outline), rest days a dashed outline, rowed days a ramp cell with
 * the day number top-left and the k-label bottom-centre — white only on
 * the top bucket (theme.ts .hm-num). Masked: rowed days are ink-outlined
 * with a centred dot and the day number; no ramp, no label, because a
 * rowed day is public and its meters are not. A grid narrower than the
 * measure (a capped phone cell) is centred under its eyebrow. Returns
 * the height. */
export function drawMonth(
  ctx: Ctx,
  paint: PosterPaint,
  x: number,
  y: number,
  w: number,
  month: { rowed: boolean[]; meters: number[] | null },
  dayNumber: number,
  opts: MonthOpts,
): number {
  const tk = paint.tk;
  const L = monthLayout(tk, w, dayNumber, opts);
  const { cell, gap } = L;
  const x0 = x + Math.max(0, (w - L.gridW) / 2);
  const axisFont = paint.font("mono", tk.small);
  DOW_LETTERS.forEach((d, i) =>
    paint.drawCentered(
      ctx,
      d,
      x0 + i * (cell + gap) + cell / 2,
      y + tk.small,
      axisFont,
      PAL.gray,
      0.1 * tk.small,
    ),
  );
  const top = y + L.axisH;
  const numSize = Math.min(tk.axis, cell * 0.26);
  const numFont = paint.font("mono", numSize);
  const labelSize = cell * 0.28;
  const labelFont = paint.font("monoBold", labelSize);
  for (let i = 0; i < L.days; i++) {
    const idx = i + SEP_FIRST_DOW;
    const cx = x0 + (idx % 7) * (cell + gap);
    const cy = top + Math.floor(idx / 7) * (cell + gap);
    // A day after the as-of day is paper: the month is not over yet.
    if (i >= dayNumber) continue;
    const m = month.meters ? (month.meters[i] ?? 0) : 0;
    const rowed = month.rowed[i] === true || m > 0;
    if (!rowed) {
      ctx.save();
      ctx.strokeStyle = PAL.line;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(cx + 0.5, cy + 0.5, cell - 1, cell - 1);
      ctx.restore();
      continue;
    }
    if (month.meters === null) {
      // DAYS ROWED: the date is public, the meters are not.
      ctx.save();
      ctx.strokeStyle = PAL.ink;
      ctx.lineWidth = tk.hair;
      ctx.strokeRect(cx + tk.hair / 2, cy + tk.hair / 2, cell - tk.hair, cell - tk.hair);
      ctx.fillStyle = PAL.ink;
      ctx.beginPath();
      ctx.arc(cx + cell / 2, cy + cell / 2, cell * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      paint.drawText(
        ctx,
        String(i + 1),
        cx + cell * 0.12,
        cy + cell * 0.12 + numSize * 0.8,
        numFont,
        PAL.ink,
      );
      continue;
    }
    const b = m < ROWER_BUCKETS[0] ? 0 : m < ROWER_BUCKETS[1] ? 1 : m < ROWER_BUCKETS[2] ? 2 : 3;
    ctx.fillStyle = PAL.ramp[b];
    ctx.fillRect(cx, cy, cell, cell);
    // A 1-unit outline so the palest bucket survives matte stock.
    ctx.save();
    ctx.strokeStyle = PAL.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(cx + 0.5, cy + 0.5, cell - 1, cell - 1);
    ctx.restore();
    const fg = b === 3 ? WHITE : PAL.ink;
    paint.drawText(ctx, String(i + 1), cx + cell * 0.12, cy + cell * 0.12 + numSize * 0.8, numFont, fg);
    paint.drawCentered(ctx, kLabel(m), cx + cell / 2, cy + cell - cell * 0.14, labelFont, fg);
  }
  return L.h;
}

/* ================================================================== pace */

/* PaceCurve.tsx on paper: one point per timed session, x the meters so
 * far, y the running average split, faster UP. The y range is rounded to
 * 5 s with at least 3 s of air; tick step 15 / 10 / 5 s; x ticks at 0 · 25
 * · 50 · 75 · 100 % of the total. Draws inside `box` (the chart area under
 * the eyebrow); the caller has already checked there are two points. */
export function drawPaceCurve(
  ctx: Ctx,
  paint: PosterPaint,
  box: PosterBox,
  pts: { m: number; s: number }[],
): void {
  const tk = paint.tk;
  const axisFont = paint.font("mono", tk.axis);
  const L = box.x + tk.axis * 4.2;
  const R = box.x + box.w - tk.axis * 0.6;
  const T = box.y + tk.axis * 0.8;
  const B = box.y + box.h - tk.axis * 2.4;
  const maxM = pts[pts.length - 1].m;
  const splits = pts.map((p) => p.s);
  const lo = Math.min(...splits);
  const hi = Math.max(...splits);
  const pad = Math.max(3, (hi - lo) * 0.25);
  const yMin = Math.floor((lo - pad) / 5) * 5;
  const yMax = Math.ceil((hi + pad) / 5) * 5;
  const X = (m: number) => L + (m / Math.max(1, maxM)) * (R - L);
  const Y = (s: number) => T + ((s - yMin) / (yMax - yMin)) * (B - T);
  const step = yMax - yMin > 40 ? 15 : yMax - yMin > 20 ? 10 : 5;
  for (let s = yMin; s <= yMax; s += step) {
    const gy = Y(s);
    // The top gridline is solid, the rest dashed grid (SPEC §4).
    if (s === yMin) paint.rule(ctx, L, gy - 0.5, R - L, 1, PAL.grid);
    else paint.dashedRule(ctx, L, gy - 0.5, R - L, PAL.grid, 1);
    paint.drawRight(
      ctx,
      clockTenths(s).slice(0, -2),
      L - tk.axis * 0.8,
      gy + tk.axis * 0.35,
      axisFont,
      PAL.gray,
    );
  }
  paint.rule(ctx, L, B, R - L, tk.hair * 1.4, PAL.ink);
  const tickY = B + tk.axis * 1.7;
  paint.drawText(ctx, "0", L, tickY, axisFont, PAL.gray);
  for (const fr of [0.25, 0.5, 0.75]) {
    paint.drawCentered(
      ctx,
      abbr(Math.round((maxM * fr) / 1000) * 1000),
      X(maxM * fr),
      tickY,
      axisFont,
      PAL.gray,
    );
  }
  paint.drawRight(ctx, abbr(maxM), R, tickY, axisFont, PAL.gray);
  ctx.save();
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(X(p.m), Y(p.s)) : ctx.moveTo(X(p.m), Y(p.s))));
  ctx.strokeStyle = PAL.water;
  ctx.lineWidth = tk.hair * 2.2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.fillStyle = PAL.water;
  pts.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(X(p.m), Y(p.s), i === pts.length - 1 ? tk.hair * 3.2 : tk.hair * 1.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
  const last = pts[pts.length - 1];
  paint.drawRight(
    ctx,
    `${clockTenths(last.s)} /500M`,
    Math.min(X(last.m), R - 2),
    Math.max(Y(last.s) - tk.axis * 1.1, T + tk.axis),
    paint.font("monoBold", tk.small),
    PAL.ink,
  );
}

/* =================================================================== log */

export type LogPlan = {
  cols: number;
  colW: number;
  colGap: number;
  /* The type step: row / rowPitch, or small / rowPitch × .82. */
  size: number;
  pitch: number;
  /* Rows per log-column (balanced, column-major, newest at the top of the first). */
  perCol: number;
  /* Rows drawn; `more` is the "+ N MORE" count (0 when every row fits). */
  shown: number;
  more: number;
  headH: number;
  w: { day: number; meters: number; time: number; split: number };
  /* Room for the title in a log-column; under ~four glyphs the column
   * drops titles rather than print a single letter and an ellipsis. */
  titleW: number;
};

/* The width of a Figure at this font / size — text measured, a shape
 * measured as blocks — so right-aligned columns can be laid out before
 * anything is drawn. */
export function figureWidth(
  ctx: Ctx,
  paint: PosterPaint,
  f: { text?: string; shape?: string },
  font: string,
  size: number,
  tracking = 0,
): number {
  if (f.shape !== undefined) return paint.blocks(ctx, 0, 0, f.shape, size, { paint: false });
  return paint.measure(ctx, f.text ?? "", font, tracking);
}

/* Draw a Figure with its right edge on `right`. Text keeps its colour;
 * blocks are ink whatever the colour would have been (types.ts figure). */
export function figureRight(
  ctx: Ctx,
  paint: PosterPaint,
  f: { text?: string; shape?: string },
  right: number,
  baseline: number,
  font: string,
  size: number,
  color: string,
  tracking = 0,
): number {
  const w = figureWidth(ctx, paint, f, font, size, tracking);
  const fig = f.shape !== undefined ? { shape: f.shape } : { text: f.text ?? "" };
  paint.figure(ctx, fig, right - w, baseline, font, size, color, { tracking });
  return w;
}

/* How far a log's pitch may open when it is handed more room than its
 * rows need (a mid-month wall sheet: fourteen rows under a pace curve
 * already at its cap). 1.4 × keeps the table a table — the board on the
 * community sheet runs at 1.9 × its type, this tops out at 2.7 ×, the
 * pitch of the rower's two-line bests. */
export const LOG_STRETCH = 1.4;

/* How the log lays its rows in `w` × `room` (room may be Infinity when
 * the engine is measuring). The progression is the infographic graft
 * (SPEC §0): ONE column while every row fits at row / rowPitch → as many
 * log-columns as the box holds (≥ 330 units each on printL, ≥ 300 on
 * printS) → every row at small / rowPitch × .82 → "+ N MORE" as the last
 * cell. `forMeasure` measures at the SMALL step only: the height a module
 * REPORTS is the compact multi-column one, so a forty-row log never talks
 * the engine into dropping the plate for room it would not have used
 * (measured at the row step the 18x24 FINAL came to one unit over its
 * region and lost the partner plate to it); draw() still climbs to the
 * row step when the box it is handed allows it. `stretch` opens the pitch
 * up to that factor when every row fits with room to spare, so a short
 * log closes on its box instead of leaving a band of paper under its last
 * row (1 = the natural pitch). Column widths are the SPEC's shares of
 * `small` (a touch narrower on the hand-outs, whose `small` is a bigger
 * share of a narrower column), widened to the widest figure actually in
 * the column so a six-digit row never runs into its title. */
export function planLog(
  ctx: Ctx,
  paint: PosterPaint,
  w: number,
  rows: RowerLogRow[],
  room: number,
  masked: boolean,
  forMeasure = false,
  stretch = 1,
): LogPlan {
  const tk = paint.tk;
  const printS = paint.format.family === "printS";
  const minColW = paint.format.family === "printL" ? 330 : 300;
  const colGap = tk.gutter;
  const maxCols = Math.max(1, Math.floor((w + colGap) / (minColW + colGap)));
  const headH = tk.small * 1.8 + tk.hair;
  // Half a unit of tolerance, so a box handed back at exactly the measured
  // height does not read as one row short (floating point).
  const roomRows = room - headH + 0.5;
  const n = rows.length;
  // The engine sets tk.step once the plan has spent its `step` shrink
  // (SPEC §8.4): the log then starts at its small type step.
  const rowStep: [number, number] = [tk.row, tk.rowPitch];
  const smallStep: [number, number] = [tk.small, tk.rowPitch * 0.82];
  const rungs: [number, number, number][] = [];
  if (!tk.step && !forMeasure) {
    if (maxCols > 1) rungs.push([1, ...rowStep]);
    rungs.push([maxCols, ...rowStep]);
  }
  rungs.push([maxCols, ...smallStep]);
  let cols = maxCols;
  let size = smallStep[0];
  let pitch = smallStep[1];
  let perCol = Math.ceil(n / cols);
  let shown = n;
  let more = 0;
  let fitted = false;
  for (const [c, s, p] of rungs) {
    const perColMax = Math.floor(roomRows / p);
    if (n <= c * perColMax) {
      cols = c;
      size = s;
      pitch = p;
      perCol = Math.ceil(n / cols);
      fitted = true;
      break;
    }
  }
  if (!fitted) {
    // The cap happens at the small step; the last cell is "+ N MORE".
    cols = maxCols;
    perCol = Math.max(0, Math.floor(roomRows / pitch));
    const capacity = cols * perCol;
    shown = Math.max(0, capacity - 1);
    more = n - shown;
  } else if (stretch > 1 && Number.isFinite(room) && perCol > 0) {
    // Every row is on the sheet and the box is taller than they need:
    // open the pitch toward the box (the tolerance excluded, so the log
    // never reports a hair more than its box), never past the stretch.
    pitch = Math.max(pitch, Math.min(pitch * stretch, (room - headH) / perCol));
  }
  const colW = (w - (cols - 1) * colGap) / cols;
  const widest = (pick: (r: RowerLogRow) => { text?: string; shape?: string } | null, font: string) =>
    rows.reduce((m, r) => {
      const f = pick(r);
      return f ? Math.max(m, figureWidth(ctx, paint, f, font, size)) : m;
    }, 0);
  // One `small` of air between right-aligned neighbours, whatever the
  // widest figure turns out to be.
  const airW = tk.small;
  const share = printS ? 0.85 : 1;
  const wDay = Math.max(
    tk.small * 4.6 * share,
    paint.measure(ctx, "SEP 30", paint.font("mono", size * 0.86)) + tk.small * 0.7,
  );
  const wMeters = Math.max(
    tk.small * 6.6 * share,
    widest((r) => r.meters, paint.font("monoBold", size)) + airW,
  );
  const wTime = Math.max(tk.small * 6.4 * share, widest((r) => r.time, paint.font("mono", size)) + airW);
  const wSplit = masked
    ? 0
    : Math.max(
        tk.small * 5.4 * share,
        widest((r) => ({ text: r.split ?? "—" }), paint.font("mono", size)) + airW,
      );
  const titleW = colW - wDay - wMeters - wTime - wSplit - tk.small * 0.6;
  return {
    cols,
    colW,
    colGap,
    size,
    pitch,
    perCol,
    shown,
    more,
    headH,
    w: { day: wDay, meters: wMeters, time: wTime, split: wSplit },
    titleW: titleW >= size * 3.5 ? titleW : 0,
  };
}

/* The height a LogPlan takes under its eyebrow. */
export function logHeight(plan: LogPlan): number {
  const cells = plan.shown + (plan.more > 0 ? 1 : 0);
  const rowsDrawn = Math.min(plan.perCol, cells);
  return plan.headH + rowsDrawn * plan.pitch;
}

/* DAY · ROW · METERS · TIME · SPLIT on a hairline, then the rows newest
 * first down each log-column: day gray, title ink (ellipsized first),
 * meters mono bold, time ink-soft, split gray, dashed hairlines between.
 * Masked rows draw blocks, a block clock, and no split column at all.
 * Returns the height used. */
export function drawLog(
  ctx: Ctx,
  paint: PosterPaint,
  x: number,
  y: number,
  w: number,
  rows: RowerLogRow[],
  plan: LogPlan,
  masked: boolean,
): number {
  const tk = paint.tk;
  const { size, pitch, cols, colW, colGap, perCol } = plan;
  const headFont = paint.font("mono", tk.small);
  const headTrack = 0.12 * tk.small;
  const hb = y + tk.small;
  for (let c = 0; c < cols; c++) {
    const cx = x + c * (colW + colGap);
    const right = cx + colW;
    const xSplit = right;
    const xTime = right - plan.w.split;
    const xMeters = xTime - plan.w.time;
    paint.drawText(ctx, "DAY", cx, hb, headFont, PAL.gray, headTrack);
    if (plan.titleW > 0) paint.drawText(ctx, "ROW", cx + plan.w.day, hb, headFont, PAL.gray, headTrack);
    paint.drawRight(ctx, "METERS", xMeters, hb, headFont, PAL.gray, headTrack);
    paint.drawRight(ctx, "TIME", xTime, hb, headFont, PAL.gray, headTrack);
    if (!masked) paint.drawRight(ctx, "SPLIT", xSplit, hb, headFont, PAL.gray, headTrack);
  }
  const ruleY = hb + tk.small * 0.8;
  paint.rule(ctx, x, ruleY, w, tk.hair, PAL.ink);
  const top = ruleY + tk.hair;
  const rm = paint.metricsOf(ctx, paint.font("mono", size), size);
  const dayFont = paint.font("mono", size * 0.86);
  const titleFont = paint.font("archivo", size);
  const metersFont = paint.font("monoBold", size);
  const timeFont = paint.font("mono", size);
  const cells = plan.shown + (plan.more > 0 ? 1 : 0);
  for (let i = 0; i < cells; i++) {
    const c = Math.floor(i / Math.max(1, perCol));
    const r = i % Math.max(1, perCol);
    const cx = x + c * (colW + colGap);
    const right = cx + colW;
    const rowTop = top + r * pitch;
    const base = rowTop + (pitch - rm.lh) / 2 + rm.asc;
    const lastInCol = r === perCol - 1 || i === cells - 1;
    if (i >= plan.shown) {
      paint.drawText(ctx, `+ ${plan.more} MORE`, cx, base, dayFont, PAL.gray, 0.08 * size);
      continue;
    }
    const row = rows[i];
    const xSplit = right;
    const xTime = right - plan.w.split;
    const xMeters = xTime - plan.w.time;
    paint.drawText(ctx, row.day.toUpperCase(), cx, base, dayFont, PAL.gray);
    if (row.title && plan.titleW > 0) {
      const title = paint.ellipsize(ctx, row.title, plan.titleW, titleFont);
      paint.drawText(ctx, title, cx + plan.w.day, base, titleFont, PAL.ink);
    }
    figureRight(ctx, paint, row.meters, xMeters, base, metersFont, size, PAL.ink);
    figureRight(ctx, paint, row.time, xTime, base, timeFont, size, PAL.inkSoft);
    if (!masked) paint.drawRight(ctx, row.split ?? "—", xSplit, base, timeFont, PAL.gray);
    if (!lastInCol) paint.dashedRule(ctx, cx, rowTop + pitch - 0.5, colW);
  }
  return logHeight(plan);
}
