import {
  END_MS,
  dayTicks,
  daysElapsed,
  fmtDay,
  fmtDuration,
  fmtMeters,
  fmtRowerNumber,
  fmtSplit,
  nowMs,
  type RecordBadge,
} from "@/lib/row100k";
import { ELITE_LABEL, clockShape, digitCount, shapeOf } from "@/lib/blackoutRules";

/* Shareable cards for /row100k — the images themselves.
 *
 * Deliberately separate from the menu UI (ShareMenu.tsx): this file only
 * knows how to paint a card onto a canvas, so a new card is one entry in
 * CARDS and nothing else changes.
 *
 * Every card paints on a TRANSPARENT canvas. They're stickers — they go on
 * top of an Instagram story, a photo, whatever the rower is already posting,
 * so anything outside the blue mark stays see-through and the type is white.
 *
 * Fonts are passed in rather than hardcoded: next/font generates hashed
 * family names at build time, so the caller reads the real names off the
 * live DOM (see ShareMenu) and hands them over.
 */

export type ShareData = {
  displayName: string;
  rowerNumber: number;
  instagram: string;
  meters: number;
  sessions: number;
  /* Meters per "YYYY-MM-DD" day — feeds the month-calendar card. */
  byDay: Record<string, number>;
  /* One highlighted session — set when sharing straight from a logged row;
   * unlocks the single-row cards. Real numbers even for a hidden rower (it
   * is their own dialog): under `masked` the row cards draw blocks for the
   * meters AND the time and no split at all, so a card that leaves the
   * site carries nothing the board hides. */
  row?: { day: string; meters: number; seconds: number; title?: string } | null;
  /* "M" | "F" — unlocks the profile card's board tag. */
  division?: string;
  /* Longest single row, meters. */
  longest?: number;
  /* Standing on total meters within the rower's division. */
  rank?: { place: number; of: number } | null;
  /* Top-10 record-board placements within the division, each carrying its
   * display-formatted stat ("16:03.7" / "22,179 m"). The profile card
   * headlines the best of them. */
  records?: RecordBadge[];
  /* One personal best, set when the dialog opens from a bests card —
   * "Fastest 5k" / "22:30.4" / #2 in division when placed. The card drops
   * the tenth (roundToSeconds: "22:30"). Under `masked` the card draws the
   * value's silhouette instead (shapeOf, minus the tenth: "##:##" for a
   * pace best, "##,### m" for a meters best); a page that blanks `value`
   * before it reaches the client hands the silhouette over as `shape`. */
  best?: { label: string; value: string; place?: number | null; shape?: string };
  /* September days elapsed (daysElapsed()), 1..30. Every calendar and curve
   * stops here instead of framing the whole month (owner call, 2026-09-05:
   * the curve looked dumb against thirty days). Absent = the full month. */
  days?: number;
  /* Blackout (blackoutRules.ts): this rower is one of THE ELITE — the top
   * ten of their board — while a window is open, so none of their numbers
   * is shareable. The total cards draw `digits` blocks where the number
   * would go, the row and best cards draw blocks for their meters and
   * times, the curve and month cards drop out of the menu, the elite card
   * comes in, and every ROWTEMBER mark on their cards goes white on ink
   * (drawMark). Set by the pages. */
  masked?: boolean;
  digits?: number;
  /* Everyone's September, set only where the caller loads community totals
   * (the stats page) — unlocks the three community cards. */
  community?: {
    meters: number;
    rowers: number;
    sessions: number;
    /* Combined meters per "YYYY-MM-DD" day. */
    byDay: Record<string, number>;
    /* Cumulative combined meters, ascending. */
    daily: { day: string; cum: number }[];
    /* September days elapsed — same meaning as the top-level `days`, for
     * the community calendar and curves. Falls back to the top-level one. */
    days?: number;
    /* Meters logged per hour of day (24 slots), one row per September day
     * elapsed so far — the stats page's hour grid. Unlocks the hours card. */
    hourGrid?: number[][];
    /* Everyone in standings order (total meters, descending) — unlocks the
     * board stickers, one per ten places. */
    standings?: {
      name: string;
      rowerNumber: number;
      meters: number;
      /* Blackout (blackoutRules.ts): the number is hidden — `meters` is a
       * tier floor and `digits` says how many blocks to draw in its place. */
      masked?: boolean;
      digits?: number;
      /* Blackout, the places half: one of the hidden elite. The row has
       * no place at all — the sticker leaves its place column blank and
       * never paints a medal on it (maskStandings reorders these rows by
       * average split then name, so their order carries no ranking either). */
      unranked?: boolean;
    }[];
    /* "Sep 3" — the day the standings were read, for the sticker title. */
    asOf?: string;
  };
};

export type ShareFonts = { black: string; mono: string };

export type ShareCard = {
  id: string;
  /* Menu label. */
  label: string;
  /* A label that has to read the data before it can be true. The board
   * stickers use it: under a blackout their page has no places to name, and
   * a picker chip saying "1–10" over a sticker that refuses to print a place
   * would hand the elite back the ranking the rule takes away. Falls back
   * to `label` (review, 2026-09-05). */
  labelFor?: (data: ShareData) => string;
  width: number;
  height: number;
  /* True when the art is white-on-transparent and needs a dark preview
   * backdrop to be visible at all. */
  light: boolean;
  /* Absent = always in the menu. The club card earns its slot at 50k. */
  available?: (data: ShareData) => boolean;
  draw: (ctx: CanvasRenderingContext2D, data: ShareData, fonts: ShareFonts) => void;
};

const WATER = "#0077B6";
const INK = "#15171A";
const GOLD = "#D4AF37";
const SILVER = "#C0C0C0";
const BRONZE = "#CD7F32";

const medalColor = (place: number): string | null =>
  place === 1 ? GOLD : place === 2 ? SILVER : place === 3 ? BRONZE : null;

/* ------------------------------------------------------------ primitives */

/* The page's "open to everyone" mark: white caps on water blue, rotated a
 * degree and a half and skewed, so it reads as something stamped on rather
 * than typeset. Returns the drawn width so callers can centre it. The box
 * paints water blue unless a medal color is handed in; silver is too light
 * for white caps, so text flips to ink on it.
 *
 * THE ELITE wear it white on ink (owner, 2026-09-08: "where someone is in
 * the elite, make the Rowtember logo white on black"): `masked` is the
 * payload's own flag, handed in by every card in the rower family, and it
 * turns the box INK with the caps still white. An explicit `box` — the
 * medal on a placed best — still wins, since it is the rarer claim. The
 * rule lives here and nowhere else. */
function drawMark(
  ctx: CanvasRenderingContext2D,
  segments: { text: string; strike?: boolean }[],
  opts: { cx: number; cy: number; size: number; fontFamily: string; box?: string; masked?: boolean },
) {
  const { cx, cy, size, fontFamily } = opts;
  const boxColor = opts.box ?? (opts.masked ? INK : WATER);
  const textColor = boxColor === SILVER ? INK : "#ffffff";
  ctx.save();
  ctx.font = `${size}px ${fontFamily}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  const widths = segments.map((s) => ctx.measureText(s.text).width);
  const textWidth = widths.reduce((a, b) => a + b, 0);
  const padX = size * 0.34;
  const padTop = size * 0.3;
  const padBottom = size * 0.26;
  const capHeight = size * 0.72;
  const boxW = textWidth + padX * 2;
  const boxH = capHeight + padTop + padBottom;

  ctx.translate(cx, cy);
  ctx.rotate((-1.2 * Math.PI) / 180);
  ctx.transform(1, 0, Math.tan((-2 * Math.PI) / 180), 1, 0, 0);

  ctx.fillStyle = boxColor;
  ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);

  const baseline = -boxH / 2 + padTop + capHeight;
  let x = -boxW / 2 + padX;
  ctx.fillStyle = textColor;
  segments.forEach((seg, i) => {
    ctx.fillText(seg.text, x, baseline);
    if (seg.strike) {
      // Through the middle of the caps, at the weight of the letterforms —
      // a struck-out SEP, not a hairline.
      ctx.save();
      ctx.strokeStyle = textColor === INK ? "rgba(21,23,26,0.66)" : "rgba(255,255,255,0.66)";
      ctx.lineWidth = size * 0.085;
      ctx.beginPath();
      ctx.moveTo(x - size * 0.02, baseline - capHeight * 0.46);
      ctx.lineTo(x + widths[i] + size * 0.02, baseline - capHeight * 0.46);
      ctx.stroke();
      ctx.restore();
    }
    x += widths[i];
  });

  ctx.restore();
  return boxW;
}

function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  opts: {
    cx: number;
    baseline: number;
    font: string;
    color: string;
    tracking?: number;
    /* Cap the drawn width — the canvas condenses the glyphs to fit. */
    maxWidth?: number;
  },
) {
  ctx.save();
  ctx.font = opts.font;
  ctx.fillStyle = opts.color;
  ctx.textBaseline = "alphabetic";
  const tracking = opts.tracking ?? 0;
  if (!tracking) {
    ctx.textAlign = "center";
    ctx.fillText(text, opts.cx, opts.baseline, opts.maxWidth);
    ctx.restore();
    return;
  }
  // Manual tracking — ctx.letterSpacing isn't available everywhere yet.
  const chars = [...text];
  const width =
    chars.reduce((sum, c) => sum + ctx.measureText(c).width, 0) + tracking * (chars.length - 1);
  let x = opts.cx - width / 2;
  ctx.textAlign = "left";
  for (const c of chars) {
    ctx.fillText(c, x, opts.baseline);
    x += ctx.measureText(c).width + tracking;
  }
  ctx.restore();
}

/* Trim text with an ellipsis until it fits maxW at the current ctx.font —
 * the escape hatch under every shrink-to-fit loop, so a worst-case name can
 * never run off the canvas edge. */
function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}\u2026`).width > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}\u2026`;
}

/* Blackout digits on canvas: one fat block per hidden digit with a real
 * comma glyph between thousands groups \u2014 the board's .bo blocks, painted.
 * Each block sits in a 0.6*size cell (the mono advance) so the run is as
 * wide as the number it stands in for; the block itself is 0.54*size with
 * the 0.06*size gap split either side, 0.92*size tall on the baseline
 * `y`. `x` is the left edge, or the right edge with align right. Returns
 * the drawn width so a name can yield to it the way it yields to digits. */
/* Blocks are INK, everywhere (owner, 2026-09-05: "instead of those squares
 * being white on the blackout shareables — and anywhere — make them
 * black"), which is what the page already draws (.bo i is var(--ink)) —
 * and MATTE: flat ink with nothing behind it (owner, 2026-09-08: "instead
 * of the white glowing background behind each of the black squares and
 * fonts, I want it to be just matte black"). The white halo that used to
 * sit under every run is gone; the commas and colons inside a run are the
 * same flat ink. A caller that hands in its own fill keeps it. */

export function drawBlockDigits(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  digits: number,
  size: number,
  fonts: ShareFonts,
  opts: { align?: "left" | "right"; fill?: string } = {},
): number {
  const n = Math.max(1, Math.floor(digits));
  const cell = size * 0.6;
  const gap = size * 0.06;
  const block = cell - gap;
  ctx.save();
  // Matte: a caller's drop shadow (the board sticker sets one before its
  // rows) must not paint under the blocks.
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.font = `${size}px ${fonts.mono}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const commaW = ctx.measureText(",").width;
  const commas = Math.floor((n - 1) / 3);
  const width = n * cell + commas * commaW;
  const start = opts.align === "right" ? x - width : x;
  ctx.fillStyle = opts.fill ?? INK;
  let cx = start;
  for (let i = 0; i < n; i++) {
    ctx.fillRect(cx + gap / 2, y - size * 0.88, block, size * 0.92);
    cx += cell;
    if (i < n - 1 && (n - i - 1) % 3 === 0) {
      ctx.fillText(",", cx, y);
      cx += commaW;
    }
  }
  ctx.restore();
  return width;
}

/* The width drawBlockDigits will take, without painting — the shrink-to-fit
 * loops need it the same way they need measureText for real digits. */
function blockDigitsWidth(
  ctx: CanvasRenderingContext2D,
  digits: number,
  size: number,
  fonts: ShareFonts,
): number {
  const n = Math.max(1, Math.floor(digits));
  ctx.save();
  ctx.font = `${size}px ${fonts.mono}`;
  const commaW = ctx.measureText(",").width;
  ctx.restore();
  return n * size * 0.6 + Math.floor((n - 1) / 3) * commaW;
}

/* A hidden number of any shape (shapeOf / clockShape in blackoutRules.ts):
 * a block in every `#` cell, and every other character — the colon of a
 * time, the point before a tenth, a comma, a unit — drawn as the real mono
 * glyph on the baseline, so ▮▮:▮▮ reads as a time and ▮▮,▮▮▮ m as meters.
 * Same cell geometry as drawBlockDigits. `x` is the left edge, the right
 * edge with align right, or the middle with align center. Returns the
 * drawn width. `paint` off only measures (the shrink-to-fit loops). */
function drawBlockShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  shape: string,
  size: number,
  fonts: ShareFonts,
  opts: { align?: "left" | "right" | "center"; fill?: string; paint?: boolean } = {},
): number {
  const cell = size * 0.6;
  const gap = size * 0.06;
  const block = cell - gap;
  const chars = [...(shape || "#")];
  ctx.save();
  ctx.font = `${size}px ${fonts.mono}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const width = chars.reduce((w, ch) => w + (ch === "#" ? cell : ctx.measureText(ch).width), 0);
  if (opts.paint !== false) {
    const start = opts.align === "right" ? x - width : opts.align === "center" ? x - width / 2 : x;
    ctx.fillStyle = opts.fill ?? INK;
    let cx = start;
    for (const ch of chars) {
      if (ch === "#") {
        ctx.fillRect(cx + gap / 2, y - size * 0.88, block, size * 0.92);
        cx += cell;
      } else {
        ctx.fillText(ch, cx, y);
        cx += ctx.measureText(ch).width;
      }
    }
  }
  ctx.restore();
  return width;
}

/* Blackout time on canvas: the digits of fmtDuration (or fmtRecordTime
 * with `tenths`) as blocks with the colons kept — 22:14 -> ▮▮:▮▮, 1:04:01
 * -> ▮:▮▮:▮▮ — the card's twin of the page's BlockClock. The rule behind
 * it (owner, 2026-09-05): an elite rower's time is their meters by another
 * route, so a card that leaves the site shows its shape and nothing else. */
export function drawBlockClock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  seconds: number,
  size: number,
  fonts: ShareFonts,
  opts: { align?: "left" | "right" | "center"; fill?: string; tenths?: boolean } = {},
): number {
  return drawBlockShape(ctx, x, y, clockShape(seconds, opts.tenths), size, fonts, {
    align: opts.align,
    fill: opts.fill,
  });
}

/* How many September days a chart draws: the caller's day count, clamped to
 * the month — or today's day number off the challenge clock when the caller
 * did not say. The fallback is the clock, not the whole month, because the
 * personal pages hand the cards no `days` at all, and the whole point was
 * to stop framing thirty days (owner, 2026-09-05). daysElapsed() is DOM-free
 * and runs off nowMs(), so the server-side import of this file stays safe. */
function spanFor(days: number | undefined): number {
  return Math.min(30, Math.max(1, Math.round(days ?? daysElapsed())));
}

/* Which byDay key a card means by "today". The day count the page already
 * handed over IS the clock: `days` is daysElapsed() read once by the page
 * (1..30), so day 6 is "2026-09-06" and the drawing stays pure — two cards
 * painted from one payload can never disagree about what day it is, and a
 * card saved at 11:59 says the same thing as the page behind it.
 *
 * With no `days` at all the card falls back to the LAST day byDay actually
 * carries. That is the most recent day with meters on it, which is only
 * really today when the rower rowed today — the honest reading of a payload
 * that never says what day it is. Every surface that matters passes `days`
 * (page.tsx -> Dashboard, r/[num]/page.tsx, StatsShare); the dev preview
 * does not, and there the card names its mock month's last logged day. */
function todayKey(byDay: Record<string, number>, days: number | undefined): string | null {
  if (typeof days === "number" && Number.isFinite(days)) {
    const d = Math.min(30, Math.max(1, Math.round(days)));
    return `2026-09-${String(d).padStart(2, "0")}`;
  }
  // "YYYY-MM-DD" sorts lexically, so the last key is the latest day.
  const logged = Object.keys(byDay).sort();
  return logged.length > 0 ? logged[logged.length - 1] : null;
}

/* Meters logged on that day — 0 when the day is empty or unknown, which is
 * what keeps a card reading "0 METERS TODAY" out of the menu. */
function metersToday(byDay: Record<string, number>, days: number | undefined): number {
  const key = todayKey(byDay, days);
  return key ? Math.max(0, byDay[key] ?? 0) : 0;
}

/* Is September still running? The word TODAY is the one claim in this family
 * that expires. daysElapsed() pins to 30 from Sep 30 onward and stays there
 * forever, so without this gate both day cards would go on offering Sep 30's
 * meters under "METERS TODAY" through the Oct 1–3 late-log window and every
 * archive view after it — the rest of the family are September statements
 * that stay true for good (review, 2026-09-06).
 *
 * The clock lives HERE, in the menu predicate, and never in a draw: a card
 * that is offered paints the same picture whenever it is painted. Safe for
 * the server render too — availableCards has one caller (ShareMenu), and the
 * chip list it feeds only renders inside a dialog the rower has opened, so no
 * server HTML depends on the answer. */
function monthIsRunning(): boolean {
  return nowMs() < END_MS;
}

/* A rounded rectangle path — roundRect is still missing from a few WebViews
 * the share sheet runs in, so the corners are drawn by hand. */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/* Sep 1, 2026 is a Tuesday; the grids run Sunday-first like the profile
 * heatmap, so day 1 sits under T. */
const SEP_FIRST_DOW = 2;
const DOW_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
/* Room for the weekday header above the first row of cells — shared by the
 * grid and its height estimate so the centring stays honest. */
const MONTH_HEAD_H = 52;

/* The month as a compact calendar: only the days elapsed, seven to a row,
 * a weekday-letter header, rows only through today (owner call, 2026-09-05:
 * a full calendar of empty cells made the numbers hard to read). Cells are
 * big enough for a legible k-label. Returns the y just under the last row so
 * the caller can hang the total off it. `labelFor` formats a rowed day; the
 * alpha buckets are the caller's (personal thresholds vs. community scale). */
function drawMonthGrid(
  ctx: CanvasRenderingContext2D,
  fonts: ShareFonts,
  opts: {
    byDay: Record<string, number>;
    span: number;
    top: number;
    width: number;
    alphaFor: (m: number) => number;
    labelFor: (m: number) => string;
    labelSize: number;
  },
): number {
  const cell = 112;
  const gap = 14;
  const cols = 7;
  const gridW = cols * cell + (cols - 1) * gap;
  const left = (opts.width - gridW) / 2;
  const headH = MONTH_HEAD_H;
  const top = opts.top + headH;

  // The weekday letters are the one thing the owner asked for by name, so
  // they get the board sticker's soft shadow and near-white bold mono: a
  // faint 60% row vanished over a bright photo while the cells read fine.
  ctx.save();
  ctx.font = `700 31px ${fonts.mono}`;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 3;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  DOW_LETTERS.forEach((l, i) => ctx.fillText(l, left + i * (cell + gap) + cell / 2, opts.top + 32));
  ctx.restore();

  for (let d = 1; d <= opts.span; d++) {
    const idx = SEP_FIRST_DOW + (d - 1);
    const x = left + (idx % cols) * (cell + gap);
    const y = top + Math.floor(idx / cols) * (cell + gap);
    const m = opts.byDay[`2026-09-${String(d).padStart(2, "0")}`] ?? 0;
    const a = opts.alphaFor(m);
    if (a === 0) {
      // Rest day: an outline, so the month's shape stays legible.
      ctx.strokeStyle = "rgba(255,255,255,0.30)";
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y + 1.5, cell - 3, cell - 3);
    } else {
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fillRect(x, y, cell, cell);
      ctx.save();
      ctx.font = `${opts.labelSize}px ${fonts.mono}`;
      ctx.fillStyle = INK;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(opts.labelFor(m), x + cell / 2, y + cell / 2 + 2, cell - 12);
      ctx.restore();
    }
  }

  const rows = Math.ceil((SEP_FIRST_DOW + opts.span) / cols);
  return top + rows * (cell + gap) - gap;
}

/* How tall drawMonthGrid will be, so a short month can be centred on the
 * card instead of hugging the top. */
function monthGridHeight(span: number): number {
  const rows = Math.ceil((SEP_FIRST_DOW + span) / 7);
  return MONTH_HEAD_H + rows * 126 - 14;
}

/* ----------------------------------------------------------------- cards */

/* Card one: the wordmark and your number. Nothing else — it has to survive
 * being 300px wide on someone's story. Top-10 rowers get their place drawn
 * big on the meters' baseline (owner call, cycle 2 — it was fading into the
 * caption); a podium place paints the mark's box in the medal metal. */
const rowtemberTotal: ShareCard = {
  id: "rowtember-total",
  label: "Rowtember total",
  width: 1080,
  height: 620,
  light: true,
  draw(ctx, data, fonts) {
    const cx = this.width / 2;
    const top10 = data.rank && data.rank.place <= 10 ? data.rank : null;

    // Meters + "#4" share one baseline, centered as a single line; the
    // meters shrink until the pair fits, so a huge total can't push the
    // place off the canvas. Under a blackout the meters are blocks — the
    // place is public, so it still rides along.
    const metersText = data.meters.toLocaleString("en-US");
    const digits = data.digits ?? digitCount(data.meters);
    const rankText = top10 ? `#${top10.place}` : null;
    const rankSize = 76;
    const gap = 30;
    const maxW = this.width - 90;
    let mSize = 210;
    const metersW = () => {
      if (data.masked) return blockDigitsWidth(ctx, digits, mSize, fonts);
      ctx.font = `${mSize}px ${fonts.black}`;
      return ctx.measureText(metersText).width;
    };
    const lineW = () => {
      let w = metersW();
      if (rankText) {
        ctx.font = `${rankSize}px ${fonts.black}`;
        w += gap + ctx.measureText(rankText).width;
      }
      return w;
    };
    while (mSize > 110 && lineW() > maxW) mSize -= 6;

    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    let x = cx - lineW() / 2;
    if (data.masked) {
      x += drawBlockDigits(ctx, x, 250, digits, mSize, fonts) + gap;
    } else {
      ctx.font = `${mSize}px ${fonts.black}`;
      ctx.fillText(metersText, x, 250);
      x += ctx.measureText(metersText).width + gap;
    }
    if (rankText) {
      ctx.font = `${rankSize}px ${fonts.black}`;
      ctx.fillText(rankText, x, 250);
    }
    ctx.restore();

    drawCenteredText(ctx, "METERS", {
      cx,
      baseline: 318,
      font: `38px ${fonts.mono}`,
      color: "rgba(255,255,255,0.82)",
      tracking: 9,
    });

    drawMark(ctx, [{ text: "ROWTEMBER" }], {
      cx,
      cy: 470,
      size: 112,
      fontFamily: fonts.black,
      box: (top10 && medalColor(top10.place)) || undefined,
      masked: data.masked,
    });
  },
};

/* The total card's twin, one day wide: the meters logged TODAY, the label,
 * the mark. The card you post straight after the row, when the season total
 * is not the news — same 1080x620 stage, same figure baseline, same shrink-
 * to-fit, so the two read as one pair.
 *
 * No place and no medal on the mark: a standing is the total's story, and a
 * day's meters next to "#3" would read as a place in a race that isn't run.
 *
 * Out of the menu on a day with nothing logged — a card saying 0 is worse
 * than no card at all — and out of the menu once the month is over, when
 * there is no today left to have rowed (monthIsRunning). */
const rowtemberToday: ShareCard = {
  id: "rowtember-today",
  label: "Today",
  width: 1080,
  height: 620,
  light: true,
  available: (d) => monthIsRunning() && metersToday(d.byDay, d.days) > 0,
  draw(ctx, data, fonts) {
    const cx = this.width / 2;
    const meters = metersToday(data.byDay, data.days);
    if (meters <= 0) return;

    // Blackout: blocks for the figure, exactly as the total card draws them
    // — the day is the season total by another route once you have a few of
    // them. The count comes off TODAY's number: `data.digits` is the SEASON
    // total's digit count (six blocks for a four-figure day), so reusing it
    // would tell the reader the wrong size of number.
    const digits = digitCount(meters);
    const metersText = meters.toLocaleString("en-US");
    const maxW = this.width - 90;
    let mSize = 210;
    const lineW = () => {
      if (data.masked) return blockDigitsWidth(ctx, digits, mSize, fonts);
      ctx.font = `${mSize}px ${fonts.black}`;
      return ctx.measureText(metersText).width;
    };
    while (mSize > 110 && lineW() > maxW) mSize -= 6;

    if (data.masked) {
      drawBlockDigits(ctx, cx - lineW() / 2, 250, digits, mSize, fonts);
    } else {
      drawCenteredText(ctx, metersText, {
        cx,
        baseline: 250,
        font: `${mSize}px ${fonts.black}`,
        color: "#ffffff",
        maxWidth: maxW,
      });
    }

    drawCenteredText(ctx, "METERS TODAY", {
      cx,
      baseline: 318,
      font: `38px ${fonts.mono}`,
      color: "rgba(255,255,255,0.82)",
      tracking: 9,
    });

    drawMark(ctx, [{ text: "ROWTEMBER" }], {
      cx,
      cy: 470,
      size: 112,
      fontFamily: fonts.black,
      masked: data.masked,
    });
  },
};

/* Card two: the club stamp. Earned, not given — it only appears in the menu
 * once the rower crosses 50k, and upgrades itself through the clubs. Each
 * club has its own colour (owner call, 2026-09-05) and it is the SAME ink
 * the board's tier tag uses (theme.ts --tier-*-ink: 50K green, 100K water,
 * .25M gold-brown, 500K ink), so the sticker and the table say the same
 * thing; the card stays see-through outside the tag. */
const MILESTONES: { meters: number; label: string; plaque: string }[] = [
  { meters: 500_000, label: "500K", plaque: INK },
  // The quarter-million club is ".25M", not "250K" (owner rebrand).
  { meters: 250_000, label: ".25M", plaque: "#8a6508" },
  { meters: 100_000, label: "100K", plaque: WATER },
  { meters: 50_000, label: "50K", plaque: "#256e45" },
];

const rowtemberClub: ShareCard = {
  id: "rowtember-club",
  label: "Club card",
  width: 1080,
  height: 700,
  light: true,
  available: (d) => d.meters >= 50_000,
  draw(ctx, data, fonts) {
    const cx = this.width / 2;
    const club = MILESTONES.find((m) => data.meters >= m.meters) ?? MILESTONES[MILESTONES.length - 1];

    // The club is drawn the way the board tags it (owner call, 2026-09-05,
    // second pass: "the same as the indicators on the table — a green square
    // for the 50K and a blue square for the 100K"). That is .tierbadge in
    // theme.ts: white mono caps on a solid rectangle in the tier ink, no
    // skew, 10px type padded 1px/6px — the ratios below are that badge,
    // blown up to sticker size. Everything outside the tag stays
    // transparent; the soft shadow keeps it legible on a photo.
    let size = 150;
    const labelW = () => {
      ctx.font = `${size}px ${fonts.mono}`;
      return ctx.measureText(club.label).width + size * 1.2;
    };
    while (size > 60 && labelW() > this.width - 160) size -= 4;

    ctx.font = `${size}px ${fonts.mono}`;
    const boxW = ctx.measureText(club.label).width + size * 1.2; // 6/10 em each side
    const boxH = size * 1.5; // the badge's line box
    const capH = size * 0.72;
    const clubSize = 118;
    const clubCap = clubSize * 0.72;
    const markSize = 96;
    const markH = markSize * 1.28; // drawMark: caps + its two paddings
    const G1 = 46; // tag -> CLUB
    const G2 = 44; // CLUB -> the mark
    const blockH = boxH + G1 + clubCap + G2 + markH;
    const boxTop = Math.max(40, (this.height - blockH) / 2);
    const clubBaseline = boxTop + boxH + G1 + clubCap;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 3;

    ctx.fillStyle = club.plaque;
    ctx.fillRect(cx - boxW / 2, boxTop, boxW, boxH);

    // Flat white on the ink, like the table: the tag casts a shadow, the
    // caps inside it do not.
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0)";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    drawCenteredText(ctx, club.label, {
      cx,
      baseline: boxTop + (boxH + capH) / 2,
      font: `${size}px ${fonts.mono}`,
      color: "#ffffff",
    });
    ctx.restore();

    drawCenteredText(ctx, "CLUB", {
      cx,
      baseline: clubBaseline,
      font: `${clubSize}px ${fonts.black}`,
      color: "#ffffff",
    });

    drawMark(ctx, [{ text: "ROWTEMBER" }], {
      cx,
      cy: clubBaseline + G2 + markH / 2,
      size: markSize,
      fontFamily: fonts.black,
      masked: data.masked,
    });
    ctx.restore();
  },
};

/* Card three: the month itself — September so far as the same intensity
 * calendar the profile draws, white cells on transparency, brighter = more
 * meters, only the days elapsed. Each rowed day wears its meter count,
 * rounded to the nearest k. Out of the menu under a blackout: the cells
 * add up to the number being hidden. */
const rowtemberMonth: ShareCard = {
  id: "rowtember-month",
  label: "The month",
  width: 1080,
  height: 1080,
  light: true,
  available: (d) => !d.masked,
  draw(ctx, data, fonts) {
    const cx = this.width / 2;
    const span = spanFor(data.days);

    // Mark, grid and total stack as one block, centred on the card, so a
    // one-row month sits in the middle instead of leaving the bottom bare.
    const markH = 120;
    const totalH = 150;
    const blockH = markH + monthGridHeight(span) + totalH;
    const top = Math.max(40, (this.height - blockH) / 2);

    drawMark(ctx, [{ text: "ROWTEMBER" }], {
      cx,
      cy: top + 50,
      size: 84,
      fontFamily: fonts.black,
      masked: data.masked,
    });

    const gridBottom = drawMonthGrid(ctx, fonts, {
      byDay: data.byDay,
      span,
      top: top + markH,
      width: this.width,
      alphaFor: (m) => (m <= 0 ? 0 : m < 2500 ? 0.3 : m < 5000 ? 0.55 : m < 10000 ? 0.78 : 1),
      labelFor: (m) => `${Math.max(1, Math.round(m / 1000))}k`,
      labelSize: 36,
    });

    drawCenteredText(ctx, data.meters.toLocaleString("en-US"), {
      cx,
      baseline: gridBottom + 104,
      font: `96px ${fonts.black}`,
      color: "#ffffff",
    });
    drawCenteredText(ctx, "METERS", {
      cx,
      baseline: gridBottom + 150,
      font: `28px ${fonts.mono}`,
      color: "rgba(255,255,255,0.82)",
      tracking: 8,
    });
  },
};

/* Card four: one session — the meters, the time, the mark. Available only
 * when the dialog was opened from a specific row; it stays in the menu for
 * a hidden rower, who still gets a card of their row — one with blocks for
 * the meters and the time, since either number would give the other away
 * (owner rule, 2026-09-05). */
const rowtemberRow: ShareCard = {
  id: "rowtember-row",
  label: "This row",
  width: 1080,
  height: 620,
  light: true,
  available: (d) => !!d.row,
  draw(ctx, data, fonts) {
    const cx = this.width / 2;
    const row = data.row;
    if (!row) return;

    if (data.masked) {
      // Blocks shrink to fit like the total card's, so a six-figure row
      // cannot run off the edge the way a run of fat cells would.
      const digits = digitCount(row.meters);
      let mSize = 210;
      while (mSize > 110 && blockDigitsWidth(ctx, digits, mSize, fonts) > this.width - 90) mSize -= 6;
      drawBlockDigits(ctx, cx - blockDigitsWidth(ctx, digits, mSize, fonts) / 2, 250, digits, mSize, fonts);
      drawBlockClock(ctx, cx, 352, row.seconds, 72, fonts, { align: "center" });
    } else {
      drawCenteredText(ctx, row.meters.toLocaleString("en-US"), {
        cx,
        baseline: 250,
        font: `210px ${fonts.black}`,
        color: "#ffffff",
      });
      /* The time earns second billing — solid white and big enough to read
       * from a story, not a caption fading into the backdrop. */
      drawCenteredText(ctx, fmtDuration(row.seconds), {
        cx,
        baseline: 352,
        font: `72px ${fonts.black}`,
        color: "#ffffff",
      });
    }

    drawMark(ctx, [{ text: "ROWTEMBER" }], {
      cx,
      cy: 490,
      size: 100,
      fontFamily: fonts.black,
      masked: data.masked,
    });
  },
};

/* Card five: the bib — ROWTEMBER, the number, the name, nothing else. This
 * is the "I'm in" card: it auto-opens right after someone claims their
 * number, before they've rowed a meter. The white bib card, its ink frame
 * and pin holes are gone (owner call, 2026-09-05: "it's literally like a
 * bib" — a paper rectangle stuck on a photo); the type sits straight on the
 * photo in white with the board sticker's soft shadow. No @ handle. */
const rowtemberBib: ShareCard = {
  id: "rowtember-bib",
  label: "The bib",
  width: 1080,
  height: 700,
  light: true,
  draw(ctx, data, fonts) {
    const cx = this.width / 2;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 3;

    drawMark(ctx, [{ text: "ROWTEMBER" }], {
      cx,
      cy: 152,
      size: 62,
      fontFamily: fonts.black,
      masked: data.masked,
    });

    drawCenteredText(ctx, fmtRowerNumber(data.rowerNumber), {
      cx,
      baseline: 455,
      font: `280px ${fonts.black}`,
      color: "#ffffff",
    });

    // The name shrinks to fit — names run to 40 chars.
    const nameLine = data.displayName.toUpperCase();
    let nameSize = 44;
    const tracking = 4;
    const maxW = this.width - 140;
    ctx.font = `${nameSize}px ${fonts.mono}`;
    while (
      nameSize > 22 &&
      ctx.measureText(nameLine).width + tracking * (nameLine.length - 1) > maxW
    ) {
      nameSize -= 2;
      ctx.font = `${nameSize}px ${fonts.mono}`;
    }
    const fittedLine = ellipsize(ctx, nameLine, maxW - tracking * (nameLine.length - 1));
    drawCenteredText(ctx, fittedLine, {
      cx,
      baseline: 566,
      font: `bold ${nameSize}px ${fonts.mono}`,
      color: "#ffffff",
      tracking,
    });
    ctx.restore();
  },
};

/* The profile header, redrawn white-on-transparent: number + name, the
 * meters as big as the card allows, then the total and the gap to 100k in
 * words. The @ handle is gone (owner call, 2026-09-05: just the bib number
 * and the name), so the meters move up and grow into the room it left; the
 * progress bar under them is gone the same day, for being too small to see
 * on a story. */
const rowtemberProfile: ShareCard = {
  id: "rowtember-profile",
  label: "The profile",
  width: 1080,
  height: 700,
  light: true,
  available: (d) => d.division != null && d.longest != null,
  draw(ctx, data, fonts) {
    const M = 70; // side margin
    const contentW = this.width - M * 2;
    const digits = data.digits ?? digitCount(data.meters);

    // Number + name, one line, shrunk to fit.
    const numText = fmtRowerNumber(data.rowerNumber);
    const nameText = ` ${data.displayName.toUpperCase()}`;
    let nameSize = 72;
    ctx.font = `${nameSize}px ${fonts.black}`;
    while (
      nameSize > 34 &&
      ctx.measureText(numText).width + ctx.measureText(nameText).width > contentW
    ) {
      nameSize -= 2;
      ctx.font = `${nameSize}px ${fonts.black}`;
    }
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = `${nameSize}px ${fonts.black}`;
    const fittedName = ellipsize(ctx, nameText, contentW - ctx.measureText(numText).width);
    ctx.fillStyle = "#9a9a95";
    ctx.fillText(numText, M, 150);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(fittedName, M + ctx.measureText(numText).width, 150);

    // The total, as big as the card allows (owner call, day 1 — the board
    // tag and the three stat boxes are out; the meters ARE the story).
    // Blocks under a blackout, the same shrink-to-fit.
    let mSize = 220;
    const metersText = data.meters.toLocaleString("en-US");
    const metersW = () => {
      if (data.masked) return blockDigitsWidth(ctx, digits, mSize, fonts);
      ctx.font = `${mSize}px ${fonts.black}`;
      return ctx.measureText(metersText).width;
    };
    while (mSize > 90 && metersW() > contentW) mSize -= 6;
    ctx.fillStyle = "#ffffff";
    if (data.masked) {
      drawBlockDigits(ctx, M, 420, digits, mSize, fonts);
    } else {
      ctx.font = `${mSize}px ${fonts.black}`;
      ctx.fillText(metersText, M, 420);
    }
    ctx.restore();
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = `30px ${fonts.mono}`;
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.fillText("M E T E R S", M, 474);
    ctx.restore();

    // The progress-to-100k bar is gone (owner call, 2026-09-05: "remove the
    // bar at the bottom, the progress to 100K — too small to see"). What sat
    // under it keeps the card balanced at the same height: the ink now runs
    // from the name's cap top (~98) to this baseline, so the air under the
    // last line matches the air over the first (~98 either side of a 700-tall
    // card). Pulled higher it left a 140px band hanging off the bottom
    // (review, 2026-09-05); the room the track had reads as space instead.
    const labelY = 596;
    ctx.save();
    ctx.font = `26px ${fonts.mono}`;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.textAlign = "left";
    if (data.masked) {
      const unit = " m";
      const w = drawBlockDigits(ctx, M, labelY, digits, 26, fonts);
      ctx.fillText(unit, M + w, labelY);
      ctx.textAlign = "right";
      ctx.fillText(ELITE_LABEL, this.width - M, labelY);
    } else {
      ctx.fillText(fmtMeters(data.meters), M, labelY);
      ctx.textAlign = "right";
      ctx.fillText(
        data.meters >= 100_000 ? "100K — DONE" : `${fmtMeters(100_000 - data.meters)} TO GO`,
        this.width - M,
        labelY,
      );
    }
    ctx.restore();
  },
};

/* The full row: bib + name, the row's title, its meters, its time and its
 * pace — everything about one session on one sticker (owner call, launch
 * day). Only in the menu when the dialog was opened from a specific row.
 * A hidden rower keeps the card, with blocks for the meters and the time
 * and no pace line at all: a split and a time together are the meters. */
const rowtemberRowFull: ShareCard = {
  id: "rowtember-row-full",
  label: "Row + name",
  width: 1080,
  height: 760,
  light: true,
  available: (d) => !!d.row,
  draw(ctx, data, fonts) {
    const cx = this.width / 2;
    const row = data.row;
    if (!row) return;

    ctx.save();
    ctx.font = `48px ${fonts.black}`;
    const whoText = ellipsize(
      ctx,
      `${String(data.rowerNumber).padStart(3, "0")} ${data.displayName.toUpperCase()}`,
      this.width - 120,
    );
    ctx.restore();
    drawCenteredText(ctx, whoText, {
      cx,
      baseline: 104,
      font: `48px ${fonts.black}`,
      color: "#ffffff",
    });

    if (row.title) {
      ctx.save();
      ctx.font = `38px ${fonts.mono}`;
      const titleText = ellipsize(ctx, row.title.toUpperCase(), this.width - 140);
      ctx.restore();
      drawCenteredText(ctx, titleText, {
        cx,
        baseline: 172,
        font: `38px ${fonts.mono}`,
        color: "rgba(255,255,255,0.85)",
      });
    }

    if (data.masked) {
      const digits = digitCount(row.meters);
      let mSize = 180;
      while (mSize > 100 && blockDigitsWidth(ctx, digits, mSize, fonts) > this.width - 100) mSize -= 6;
      drawBlockDigits(ctx, cx - blockDigitsWidth(ctx, digits, mSize, fonts) / 2, 390, digits, mSize, fonts);
    } else {
      drawCenteredText(ctx, row.meters.toLocaleString("en-US"), {
        cx,
        baseline: 390,
        font: `180px ${fonts.black}`,
        color: "#ffffff",
        maxWidth: this.width - 100,
      });
    }
    drawCenteredText(ctx, "METERS", {
      cx,
      baseline: 448,
      font: `30px ${fonts.mono}`,
      color: "rgba(255,255,255,0.82)",
      tracking: 9,
    });

    if (data.masked) {
      drawBlockClock(ctx, cx, 528, row.seconds, 46, fonts, { align: "center" });
    } else {
      drawCenteredText(ctx, `${fmtDuration(row.seconds)} · ${fmtSplit(row.meters, row.seconds)} /500M`, {
        cx,
        baseline: 528,
        font: `46px ${fonts.black}`,
        color: "#ffffff",
        maxWidth: this.width - 120,
      });
    }

    drawMark(ctx, [{ text: "ROWTEMBER" }], {
      cx,
      cy: 645,
      size: 96,
      fontFamily: fonts.black,
      masked: data.masked,
    });
  },
};

/* The named total: bib number + name + the meters, one sticker (owner call,
 * launch day — the plain total card forced typing the name into the story
 * by hand). No @ handle. Same shrink-to-fit meters+place line as the total
 * card, with the identity line above it. */
const rowtemberNamed: ShareCard = {
  id: "rowtember-named",
  label: "Total + name",
  width: 1080,
  height: 700,
  light: true,
  draw(ctx, data, fonts) {
    const cx = this.width / 2;
    const top10 = data.rank && data.rank.place <= 10 ? data.rank : null;

    ctx.save();
    ctx.font = `52px ${fonts.black}`;
    const whoText = ellipsize(
      ctx,
      `${String(data.rowerNumber).padStart(3, "0")} ${data.displayName.toUpperCase()}`,
      this.width - 120,
    );
    ctx.restore();
    drawCenteredText(ctx, whoText, {
      cx,
      baseline: 118,
      font: `52px ${fonts.black}`,
      color: "#ffffff",
    });

    // Blocks for the meters under a blackout; the place stays (it is public).
    const metersText = data.meters.toLocaleString("en-US");
    const digits = data.digits ?? digitCount(data.meters);
    const rankText = top10 ? `#${top10.place}` : null;
    const rankSize = 70;
    const gap = 28;
    const maxW = this.width - 90;
    let mSize = 190;
    const metersW = () => {
      if (data.masked) return blockDigitsWidth(ctx, digits, mSize, fonts);
      ctx.font = `${mSize}px ${fonts.black}`;
      return ctx.measureText(metersText).width;
    };
    const lineW = () => {
      let w = metersW();
      if (rankText) {
        ctx.font = `${rankSize}px ${fonts.black}`;
        w += gap + ctx.measureText(rankText).width;
      }
      return w;
    };
    while (mSize > 100 && lineW() > maxW) mSize -= 6;

    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    let x = cx - lineW() / 2;
    if (data.masked) {
      x += drawBlockDigits(ctx, x, 350, digits, mSize, fonts) + gap;
    } else {
      ctx.font = `${mSize}px ${fonts.black}`;
      ctx.fillText(metersText, x, 350);
      x += ctx.measureText(metersText).width + gap;
    }
    if (rankText) {
      ctx.font = `${rankSize}px ${fonts.black}`;
      ctx.fillText(rankText, x, 350);
    }
    ctx.restore();

    drawCenteredText(ctx, "METERS", {
      cx,
      baseline: 414,
      font: `36px ${fonts.mono}`,
      color: "rgba(255,255,255,0.82)",
      tracking: 9,
    });

    drawMark(ctx, [{ text: "ROWTEMBER" }], {
      cx,
      cy: 560,
      size: 104,
      fontFamily: fonts.black,
      box: (top10 && medalColor(top10.place)) || undefined,
      masked: data.masked,
    });
  },
};

/* A record time without its tenth, for the best card (owner call,
 * 2026-09-05: "it is only ever going to be seconds, never less than
 * seconds, so that .0 can be removed"). Parses fmtRecordTime's h:mm:ss.t,
 * mm:ss.t and m:ss.t, ROUNDS to the whole second in integer tenths so a
 * float can never shave a digit, and reformats through fmtDuration, which
 * carries properly: 18:51.6 -> 18:52, 59:59.5 -> 1:00:00. Anything else —
 * a meters best ("10,000 m"), a bare "—", a time already in seconds —
 * comes back untouched. */
export function roundToSeconds(value: string): string {
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})\.(\d)$/.exec(value.trim());
  if (!m) return value;
  const tenths =
    (m[1] ? Number(m[1]) : 0) * 36_000 + Number(m[2]) * 600 + Number(m[3]) * 10 + Number(m[4]);
  return fmtDuration(Math.floor((tenths + 5) / 10));
}

/* The same rule for a hidden time's silhouette (clockShape with tenths):
 * "##:##.#" -> "##:##", "#:##:##.#" -> "#:##:##". A meters silhouette has
 * no tenth and passes through. The hidden number cannot be rounded, so a
 * carry that would add an hour digit is not reflected — the silhouette
 * keeps the digit count of the seconds it stands in for. */
export function shapeToSeconds(shape: string): string {
  return shape.replace(/^((?:#+:)?#{1,2}:##)\.#$/, "$1");
}

/* One personal best in the total card's idiom: the label as the mono
 * eyebrow, then the number and its place ("18:52 #1") on ONE baseline,
 * centred as a single line, the number shrinking until the pair fits; a
 * podium place paints the mark's box in the medal metal (owner call,
 * 2026-09-05: "the #1 at the end of it, like the Rowtember total card, and
 * the ROWTEMBER mark gold or silver or bronze"). Times lose their tenth
 * (roundToSeconds). Only in the menu when the dialog was opened from a
 * bests card. A hidden rower's best is drawn as its silhouette — ▮▮:▮▮
 * for a pace best, ▮▮,▮▮▮ m for a meters one — with the place kept, since
 * places are public and the number is not. */
const rowtemberBest: ShareCard = {
  id: "rowtember-best",
  label: "This best",
  width: 1080,
  height: 620,
  light: true,
  available: (d) => !!d.best,
  draw(ctx, data, fonts) {
    const cx = this.width / 2;
    const best = data.best;
    if (!best) return;
    const place = best.place && best.place > 0 ? best.place : null;

    drawCenteredText(ctx, best.label.toUpperCase(), {
      cx,
      baseline: 120,
      font: `36px ${fonts.mono}`,
      color: "rgba(255,255,255,0.82)",
      tracking: 8,
    });

    // The page may have blanked the value and sent only its shape; when
    // the dialog is the rower's own the value is still here and the shape
    // is read off it — after rounding, so the silhouette is the seconds'.
    const valueText = roundToSeconds(best.value);
    const shape = best.shape ? shapeToSeconds(best.shape) : shapeOf(valueText);
    const rankText = place ? `#${place}` : null;
    const rankSize = 64;
    const gap = 26;
    const maxW = this.width - 90;
    let vSize = 170;
    const valueW = () => {
      if (data.masked) return drawBlockShape(ctx, 0, 0, shape, vSize, fonts, { paint: false });
      ctx.font = `${vSize}px ${fonts.black}`;
      return ctx.measureText(valueText).width;
    };
    const lineW = () => {
      let w = valueW();
      if (rankText) {
        ctx.font = `${rankSize}px ${fonts.black}`;
        w += gap + ctx.measureText(rankText).width;
      }
      return w;
    };
    while (vSize > 80 && lineW() > maxW) vSize -= 6;

    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    let x = cx - lineW() / 2;
    if (data.masked) {
      x += drawBlockShape(ctx, x, 320, shape, vSize, fonts) + gap;
    } else {
      ctx.font = `${vSize}px ${fonts.black}`;
      ctx.fillText(valueText, x, 320);
      x += ctx.measureText(valueText).width + gap;
    }
    if (rankText) {
      ctx.font = `${rankSize}px ${fonts.black}`;
      ctx.fillText(rankText, x, 320);
    }
    ctx.restore();

    // The mark moves up and grows a little into the room the old "#N" line
    // left, so the value does not float between the label and the box. It is
    // drawn at the total card's 112px (review, 2026-09-05) so a best and a
    // total posted in the same story wear the same mark. A placed best keeps
    // its medal even for one of the elite; an unplaced one wears their ink.
    drawMark(ctx, [{ text: "ROWTEMBER" }], {
      cx,
      cy: 480,
      size: 112,
      fontFamily: fonts.black,
      box: (place && medalColor(place)) || undefined,
      masked: data.masked,
    });
  },
};

/* The blackout flex: in the menu only while the rower is one of the hidden
 * elite. The mark, white on ink like every mark of theirs, their total as
 * matte ink blocks — the board's own blocks, painted, no halo — and THE
 * ELITE under it. The blocks carry no shadow at all; the label keeps the
 * dark one the type gets. */
const rowtemberElite: ShareCard = {
  id: "rowtember-elite",
  label: "The elite",
  width: 1080,
  height: 700,
  light: true,
  available: (d) => !!d.masked,
  draw(ctx, data, fonts) {
    const cx = this.width / 2;
    const digits = data.digits ?? digitCount(data.meters);

    drawMark(ctx, [{ text: "ROWTEMBER" }], {
      cx,
      cy: 150,
      size: 84,
      fontFamily: fonts.black,
      masked: data.masked,
    });

    let size = 168;
    const maxW = this.width - 120;
    while (size > 80 && blockDigitsWidth(ctx, digits, size, fonts) > maxW) size -= 6;
    const w = blockDigitsWidth(ctx, digits, size, fonts);
    drawBlockDigits(ctx, cx - w / 2, 440, digits, size, fonts);

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 3;
    drawCenteredText(ctx, ELITE_LABEL, {
      cx,
      baseline: 600,
      font: `76px ${fonts.black}`,
      color: "#ffffff",
      maxWidth: this.width - 100,
    });
    ctx.restore();
  },
};

/* Just the mark. Big, centered, transparent — the sticker of stickers. In
 * a hidden rower's own menu it is their ink one. */
const rowtemberLogo: ShareCard = {
  id: "rowtember-logo",
  label: "The logo",
  width: 1080,
  height: 620,
  light: true,
  draw(ctx, data, fonts) {
    // As big as fits with breathing room; measured the way drawMark measures.
    let size = 150;
    const maxW = this.width - 70;
    for (;;) {
      ctx.font = `${size}px ${fonts.black}`;
      const boxW = ctx.measureText("ROWTEMBER").width + size * 0.68;
      if (boxW <= maxW || size <= 60) break;
      size -= 4;
    }
    drawMark(ctx, [{ text: "ROWTEMBER" }], {
      cx: this.width / 2,
      cy: this.height / 2,
      size,
      fontFamily: fonts.black,
      masked: data.masked,
    });
  },
};

/* ------------------------------------------------------- community cards */

/* "561k" for a community-scale day; the month can push a single day past a
 * million combined meters, so the label rolls over to "1.2M". */
const kLabel = (m: number): string =>
  m >= 999_500 ? `${(m / 1_000_000).toFixed(1)}M` : `${Math.max(1, Math.round(m / 1000))}k`;

/* Everyone's September so far as the calendar — same compact grid as the
 * personal month card, but the alpha steps scale off the biggest community
 * day (25/50/75%) and the per-day k labels go big enough to read on a
 * story. */
const rowtemberCommunityMonth: ShareCard = {
  id: "rowtember-community-month",
  label: "The month",
  width: 1080,
  height: 1080,
  light: true,
  available: (d) => !!d.community,
  draw(ctx, data, fonts) {
    const community = data.community;
    if (!community) return;
    const cx = this.width / 2;
    const span = spanFor(community.days ?? data.days);

    // Centred as one block, like the personal month card, with room for the
    // extra ROWERS TOGETHER line under the total.
    const markH = 120;
    const totalH = 190;
    const blockH = markH + monthGridHeight(span) + totalH;
    const top = Math.max(40, (this.height - blockH) / 2);

    drawMark(ctx, [{ text: "ROWTEMBER" }], {
      cx,
      cy: top + 50,
      size: 84,
      fontFamily: fonts.black,
    });

    const biggest = Math.max(0, ...Object.values(community.byDay));
    const gridBottom = drawMonthGrid(ctx, fonts, {
      byDay: community.byDay,
      span,
      top: top + markH,
      width: this.width,
      alphaFor: (m) =>
        m <= 0 || biggest <= 0
          ? 0
          : m < biggest * 0.25
            ? 0.3
            : m < biggest * 0.5
              ? 0.55
              : m < biggest * 0.75
                ? 0.78
                : 1,
      labelFor: kLabel,
      labelSize: 40,
    });

    drawCenteredText(ctx, community.meters.toLocaleString("en-US"), {
      cx,
      baseline: gridBottom + 104,
      font: `96px ${fonts.black}`,
      color: "#ffffff",
      maxWidth: this.width - 120,
    });
    drawCenteredText(ctx, "METERS", {
      cx,
      baseline: gridBottom + 146,
      font: `26px ${fonts.mono}`,
      color: "rgba(255,255,255,0.82)",
      tracking: 8,
    });
    drawCenteredText(ctx, `${community.rowers.toLocaleString("en-US")} ROWERS TOGETHER`, {
      cx,
      baseline: gridBottom + 188,
      font: `28px ${fonts.mono}`,
      color: "rgba(255,255,255,0.9)",
      tracking: 5,
    });
  },
};

/* The total, alone: the mark and everyone's combined meters, nothing else
 * (owner call, day 3 — just the number). Same shrink-to-fit loop as the
 * personal total card; digits only, so it never needs the ellipsis. */
const rowtemberCommunityTotal: ShareCard = {
  id: "rowtember-community-total",
  label: "The total",
  width: 1080,
  height: 620,
  light: true,
  available: (d) => !!d.community,
  draw(ctx, data, fonts) {
    const community = data.community;
    if (!community) return;
    const cx = this.width / 2;

    drawMark(ctx, [{ text: "ROWTEMBER" }], {
      cx,
      cy: 130,
      size: 88,
      fontFamily: fonts.black,
    });

    const metersText = community.meters.toLocaleString("en-US");
    const maxW = this.width - 90;
    let mSize = 210;
    ctx.font = `${mSize}px ${fonts.black}`;
    while (mSize > 110 && ctx.measureText(metersText).width > maxW) {
      mSize -= 6;
      ctx.font = `${mSize}px ${fonts.black}`;
    }
    drawCenteredText(ctx, metersText, {
      cx,
      baseline: 440,
      font: `${mSize}px ${fonts.black}`,
      color: "#ffffff",
      maxWidth: maxW,
    });
    drawCenteredText(ctx, "METERS", {
      cx,
      baseline: 508,
      font: `34px ${fonts.mono}`,
      color: "rgba(255,255,255,0.82)",
      tracking: 9,
    });
  },
};

/* The community total, one day wide: everyone's combined meters TODAY, with
 * the day named under the label the way the bar chart names its axis (SEP 6
 * — fmtDay, uppercased, the same mono line the month card spends on ROWERS
 * TOGETHER). A day's number is meaningless without the day on it, and this
 * is the card that goes out at night.
 *
 * Nothing is masked here, ever: the hidden elite's meters are inside this
 * number and nothing on the card says whose, so the aggregate stays the
 * public number it is on the board. Out of the menu until the day has
 * meters in it, and out of it again once the month is over — the day line
 * would keep reading SEP 30 under TODAY otherwise (monthIsRunning). */
const rowtemberCommunityToday: ShareCard = {
  id: "rowtember-community-today",
  label: "Today",
  width: 1080,
  height: 620,
  light: true,
  available: (d) =>
    monthIsRunning() &&
    !!d.community &&
    metersToday(d.community.byDay, d.community.days ?? d.days) > 0,
  draw(ctx, data, fonts) {
    const community = data.community;
    if (!community) return;
    const cx = this.width / 2;
    const key = todayKey(community.byDay, community.days ?? data.days);
    if (!key) return;
    const meters = Math.max(0, community.byDay[key] ?? 0);
    if (meters <= 0) return;

    drawMark(ctx, [{ text: "ROWTEMBER" }], {
      cx,
      cy: 130,
      size: 88,
      fontFamily: fonts.black,
    });

    // Same shrink-to-fit as the community total; digits only, so no ellipsis.
    const metersText = meters.toLocaleString("en-US");
    const maxW = this.width - 90;
    let mSize = 210;
    ctx.font = `${mSize}px ${fonts.black}`;
    while (mSize > 110 && ctx.measureText(metersText).width > maxW) {
      mSize -= 6;
      ctx.font = `${mSize}px ${fonts.black}`;
    }
    // The stack sits a notch higher than the total card's to make room for
    // the date line without crowding the bottom edge.
    drawCenteredText(ctx, metersText, {
      cx,
      baseline: 430,
      font: `${mSize}px ${fonts.black}`,
      color: "#ffffff",
      maxWidth: maxW,
    });
    drawCenteredText(ctx, "METERS TODAY", {
      cx,
      baseline: 498,
      font: `34px ${fonts.mono}`,
      color: "rgba(255,255,255,0.82)",
      tracking: 9,
    });
    drawCenteredText(ctx, fmtDay(key).toUpperCase(), {
      cx,
      baseline: 546,
      font: `28px ${fonts.mono}`,
      color: "rgba(255,255,255,0.9)",
      tracking: 5,
    });
  },
};

/* The community's cumulative line — same vocabulary as the personal curve,
 * but no 100k pace line: at this scale there's no finish to race. */
const rowtemberCommunityCurve: ShareCard = {
  id: "rowtember-community-curve",
  label: "The curve",
  width: 1080,
  height: 1080,
  light: true,
  // Same Sep 1 rule as the personal curve: one point is not a line.
  available: (d) =>
    !!d.community && d.community.daily.length > 0 && spanFor(d.community.days ?? d.days) > 1,
  draw(ctx, data, fonts) {
    const community = data.community;
    if (!community || community.daily.length === 0) return;
    const cx = this.width / 2;

    drawMark(ctx, [{ text: "ROWTEMBER" }], {
      cx,
      cy: 120,
      size: 80,
      fontFamily: fonts.black,
    });

    // The frame ends at today (owner call, 2026-09-05).
    const span = spanFor(community.days ?? data.days);
    const pts = community.daily
      .filter((p) => p.day.startsWith("2026-09-"))
      .map((p) => ({ dayNum: Number(p.day.slice(8, 10)), cum: p.cum }))
      .filter((p) => p.dayNum <= span);
    if (pts.length === 0) return;
    if (pts[0].dayNum > 1) pts.unshift({ dayNum: pts[0].dayNum - 1, cum: 0 });
    const total = pts[pts.length - 1].cum;

    const L = 110;
    const R = 1010;
    const T = 240;
    const B = 790;
    const maxV = Math.max(total, 1);
    const x = (dayNum: number) => L + ((dayNum - 1) / Math.max(1, span - 1)) * (R - L);
    const y = (v: number) => B - (v / maxV) * (B - T);

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(L, B);
    ctx.lineTo(R, B);
    ctx.stroke();
    ctx.font = `24px ${fonts.mono}`;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillText("SEP 1", L, B + 40);
    ctx.textAlign = "right";
    ctx.fillText(`SEP ${span}`, R, B + 40);

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 7;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    pts.forEach((p, i) => {
      if (i === 0) ctx.moveTo(x(p.dayNum), y(p.cum));
      else ctx.lineTo(x(p.dayNum), y(p.cum));
    });
    ctx.stroke();
    const last = pts[pts.length - 1];
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x(last.dayNum), y(last.cum), 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawCenteredText(ctx, total.toLocaleString("en-US"), {
      cx,
      baseline: 950,
      font: `96px ${fonts.black}`,
      color: "#ffffff",
      maxWidth: this.width - 120,
    });
    drawCenteredText(ctx, "METERS TOGETHER", {
      cx,
      baseline: 1000,
      font: `28px ${fonts.mono}`,
      color: "rgba(255,255,255,0.82)",
      tracking: 7,
    });
  },
};

/* Everyone's September, one white bar per day — rest days keep a faint
 * outline stub so the month's shape stays legible, the biggest day wears
 * its number. */
const rowtemberCommunityDaily: ShareCard = {
  id: "rowtember-community-daily",
  label: "Day by day",
  width: 1080,
  height: 1080,
  light: true,
  available: (d) => !!d.community,
  draw(ctx, data, fonts) {
    const community = data.community;
    if (!community) return;
    const cx = this.width / 2;

    drawMark(ctx, [{ text: "ROWTEMBER" }], {
      cx,
      cy: 130,
      size: 88,
      fontFamily: fonts.black,
    });

    // One bar per day elapsed (owner call, 2026-09-05). Early in the month
    // the slots are wide, so the bars are capped rather than turning into
    // slabs.
    const span = spanFor(community.days ?? data.days);
    const vals = Array.from(
      { length: span },
      (_, i) => community.byDay[`2026-09-${String(i + 1).padStart(2, "0")}`] ?? 0,
    );
    const biggest = Math.max(...vals);

    const L = 90;
    const R = 990;
    const T = 300;
    const B = 780;
    const slot = (R - L) / span;
    const barW = Math.min(slot * 0.66, 140);
    const y = (v: number) => B - (biggest > 0 ? (v / biggest) * (B - T) : 0);

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(L, B);
    ctx.lineTo(R, B);
    ctx.stroke();
    ctx.font = `24px ${fonts.mono}`;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillText("SEP 1", L, B + 40);
    ctx.textAlign = "right";
    ctx.fillText(`SEP ${span}`, R, B + 40);

    for (let i = 0; i < span; i++) {
      const x0 = L + i * slot + (slot - barW) / 2;
      const v = vals[i];
      if (v <= 0) {
        // Rest day: a faint stub, not a hole.
        ctx.strokeStyle = "rgba(255,255,255,0.30)";
        ctx.lineWidth = 2;
        ctx.strokeRect(x0 + 1, B - 14, barW - 2, 12);
      } else {
        // Floor at 18px — taller than the rest-day stub, so a short logged
        // day never reads emptier than a rest day (or hides under the axis).
        const h = Math.max(B - y(v), 18);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x0, B - h, barW, h);
      }
    }
    if (biggest > 0) {
      const bx = L + vals.indexOf(biggest) * slot + slot / 2;
      ctx.font = `30px ${fonts.mono}`;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText(kLabel(biggest), bx, y(biggest) - 16);
    }
    ctx.restore();

    drawCenteredText(ctx, community.meters.toLocaleString("en-US"), {
      cx,
      baseline: 950,
      font: `96px ${fonts.black}`,
      color: "#ffffff",
      maxWidth: this.width - 120,
    });
    drawCenteredText(ctx, `${community.rowers.toLocaleString("en-US")} ROWERS TOGETHER`, {
      cx,
      baseline: 1000,
      font: `28px ${fonts.mono}`,
      color: "rgba(255,255,255,0.9)",
      tracking: 5,
    });
  },
};

/* ------------------------------------------------------------ hours cards */

/* The stats page's commit-graph as two stickers: one laid out like the page
 * (days down, hours across) and one turned tall (hours down, days across),
 * because a story is portrait and a feed post is not (owner call,
 * 2026-09-05: "we need to be able to share both horizontally and
 * vertically"). Both are 1080 squares and both draw SQUARE cells ("squares,
 * not rectangles — squares like git commits"): the side is whatever fits
 * BOTH axes, so a two-day grid is a short strip of squares in the middle of
 * the card instead of a slab of wide rectangles, and a thirty-day grid is
 * GitHub-graph texture. The block — cells plus their label gutters — is
 * what sits centred. Same alpha ramp on both (25/50/75% of the busiest
 * hour, counted in sessions), same faint outline on an empty hour so the
 * grid keeps its shape. No mark and no caption on either (owner call, day
 * 3, still standing): the grid is the whole sticker. */

const HOURS = 24;
/* One gap on both axes, so the squares stay squares. */
const HOURS_GAP = 6;
/* Breathing room between the block and the card edge. */
const HOURS_PAD = 40;
const HOUR_TICKS = [[0, "12A"], [6, "6A"], [12, "12P"], [18, "6P"]] as const;

/* In the menu once anyone has logged a row: an all-outline grid says nothing. */
const hoursAvailable = (d: ShareData): boolean =>
  !!d.community?.hourGrid && d.community.hourGrid.some((row) => row.some((m) => m > 0));

/* The alpha ramp, bucketed off the busiest hour of the month so far. */
function hourAlpha(grid: number[][]): (m: number) => number {
  const busiest = Math.max(0, ...grid.map((row) => Math.max(...row, 0)));
  return (m) =>
    m <= 0 || busiest <= 0
      ? 0
      : m < busiest * 0.25
        ? 0.3
        : m < busiest * 0.5
          ? 0.55
          : m < busiest * 0.75
            ? 0.78
            : 1;
}

/* The square's side for a cols × rows grid inside availW × availH: the
 * smaller of the width fit and the height fit, floored so every edge lands
 * on a whole pixel. Never below 1, so a stray oversized grid still paints. */
function squareCell(cols: number, rows: number, availW: number, availH: number): number {
  const g = HOURS_GAP;
  const wFit = (availW - (cols - 1) * g) / cols;
  const hFit = (availH - (rows - 1) * g) / rows;
  return Math.max(1, Math.floor(Math.min(wFit, hFit)));
}

/* The page's tick rule (dayTicks: every day while the month is short,
 * 1 · 10 · 20 · today once it is long), thinned so two labels never crowd:
 * walking back from the last day — which always stays — a tick is kept only
 * when it sits at least minGap px from the tick kept after it. Squares make
 * the steps small (a 30px step on Sep 30), so the old fixed 60px rule would
 * have dropped every label but the last on a short month. */
function thinTicks(n: number, step: number, minGap: number): number[] {
  const kept: number[] = [];
  for (const d of [...dayTicks(n)].reverse()) {
    if (kept.length === 0 || (kept[kept.length - 1] - d) * step >= minGap) kept.push(d);
  }
  return kept.reverse();
}

/* One hour: a fill at its alpha, or the faint outline for an empty hour. */
function drawHourCell(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, a: number) {
  if (a === 0) {
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
  } else {
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(x, y, cell, cell);
  }
}

/* Like the page: one row per September day so far, 24 hour columns, the
 * quarter-day ticks along the top and the day numbers down the left. The
 * month word is gone (owner call, 2026-09-06: the card never had to say
 * September), so day 1 is a bare 1 like every other day and the gutter is
 * measured off the widest number instead of off SEP 1. */
const rowtemberCommunityHours: ShareCard = {
  id: "rowtember-community-hours",
  label: "The hours",
  width: 1080,
  height: 1080,
  light: true,
  available: hoursAvailable,
  draw(ctx, data, fonts) {
    const grid = data.community?.hourGrid;
    if (!grid || grid.length === 0) return;
    const n = grid.length;
    const alphaFor = hourAlpha(grid);

    // Geometry: the day gutter on the left and the hour ticks above are part
    // of the block, so the block — not just the cells — is what sits centred.
    // The gutter is measured rather than guessed: the type is monospaced, so
    // the widest day label is just the last day, plus its 16px gap.
    ctx.save();
    ctx.font = `24px ${fonts.mono}`;
    const labelW = Math.round(ctx.measureText(String(n)).width) + 16;
    const tickH = 40;
    const gap = HOURS_GAP;
    const cell = squareCell(
      HOURS,
      n,
      this.width - HOURS_PAD * 2 - labelW,
      this.height - HOURS_PAD * 2 - tickH,
    );
    const step = cell + gap;
    const gridW = HOURS * cell + (HOURS - 1) * gap;
    const gridH = n * cell + (n - 1) * gap;
    const left = Math.round((this.width - (labelW + gridW)) / 2) + labelW;
    const top = Math.round((this.height - (tickH + gridH)) / 2) + tickH;

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    for (const [h, label] of HOUR_TICKS) {
      ctx.fillText(label, left + h * step + cell / 2, top - 14);
    }

    // Day labels, right-aligned in the gutter and centred on their row; a
    // row is never shorter than a line of 24px type, so the thinning only
    // bites if the tick rule ever changes.
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const d of thinTicks(n, step, 30)) {
      ctx.fillText(String(d), left - 16, top + (d - 1) * step + cell / 2 + 1);
    }

    for (let di = 0; di < n; di++) {
      for (let h = 0; h < HOURS; h++) {
        drawHourCell(ctx, left + h * step, top + di * step, cell, alphaFor(grid[di]?.[h] ?? 0));
      }
    }
    ctx.restore();
  },
};

/* Turned tall: the 24 hours run top to bottom, midnight at the top, with
 * their ticks down the left; the days run left to right with bare numbers
 * along the bottom. The month word that used to sit in the corner of the
 * gutter is gone (owner call, 2026-09-06) — the gutter is the hour ticks
 * column, so the corner simply stays empty and no geometry moves. */
const rowtemberCommunityHoursTall: ShareCard = {
  id: "rowtember-community-hours-tall",
  label: "The hours · tall",
  width: 1080,
  height: 1080,
  light: true,
  available: hoursAvailable,
  draw(ctx, data, fonts) {
    const grid = data.community?.hourGrid;
    if (!grid || grid.length === 0) return;
    const n = grid.length;
    const alphaFor = hourAlpha(grid);

    // The gutter is the hour ticks, measured the same way as the wide card:
    // the widest of them plus its 16px gap. The old rounded-up 72 left 13px
    // of slack inside the gutter, which pushed the whole block off centre.
    ctx.save();
    ctx.font = `24px ${fonts.mono}`;
    const labelW = Math.round(ctx.measureText("12A").width) + 16;
    const tickH = 48;
    const gap = HOURS_GAP;
    const cell = squareCell(
      n,
      HOURS,
      this.width - HOURS_PAD * 2 - labelW,
      this.height - HOURS_PAD * 2 - tickH,
    );
    const step = cell + gap;
    const gridW = n * cell + (n - 1) * gap;
    const gridH = HOURS * cell + (HOURS - 1) * gap;
    const left = Math.round((this.width - (labelW + gridW)) / 2) + labelW;
    const top = Math.round((this.height - (gridH + tickH)) / 2);

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    for (const [h, label] of HOUR_TICKS) {
      ctx.fillText(label, left - 16, top + h * step + cell / 2 + 1);
    }

    for (let di = 0; di < n; di++) {
      for (let h = 0; h < HOURS; h++) {
        drawHourCell(ctx, left + di * step, top + h * step, cell, alphaFor(grid[di]?.[h] ?? 0));
      }
    }

    // The bottom row: the day numbers centred under their columns, thinned
    // so a two-digit label never touches the next one.
    ctx.textBaseline = "alphabetic";
    const baseline = top + gridH + 42;
    ctx.textAlign = "center";
    for (const d of thinTicks(n, step, ctx.measureText("30").width + 8)) {
      ctx.fillText(String(d), left + (d - 1) * step + cell / 2, baseline);
    }
    ctx.restore();
  },
};

/* --------------------------------------------------------- board stickers */

/* The standings, ten places to a sticker, in the schedule-list idiom the
 * owner already posts (a bold mono title, a dim section label, then a
 * name-left / value-right list in white mono on whatever photo is
 * underneath). Every line carries a soft shadow so it stays legible on a
 * bright frame — these are the only cards that do, because they are the
 * only ones that are all thin type. One card per page: 1–10, 11–20, … up
 * to BOARD_PAGES; a page with nobody on it never shows in the picker. */
const BOARD_PAGE = 10;
const BOARD_PAGES = 12;

/* THE ELITE in the sticker's own voice: the section line under the title
 * is sentence case ("The board · 11–20"), so the group's name is set the
 * same way rather than shouted mid-sentence. Same words as ELITE_LABEL,
 * and the same words as the elite card's chip. */
const ELITE_SECTION = "The elite";

/* Blackout, the places half (blackoutRules.ts): a hidden row carries no
 * place at all, so the sticker leaves the place column blank — the name and
 * the meters stay on exactly the grid a ranked row uses, so the ten lines
 * still read as one list. Exported so the rule can be checked without a
 * canvas. */
export function boardPlaceText(row: { unranked?: boolean }, place: number): string {
  return row.unranked ? "" : String(place).padStart(2, "0");
}

/* How many rows of the whole board are hidden — the elite run to twenty
 * (ten a board), which is two stickers of ten, so an all-hidden page has to
 * say which of them it is. */
function hiddenCount(rows: { unranked?: boolean }[]): number {
  return rows.filter((r) => r.unranked).length;
}

/* The name of an all-hidden page: "The elite" when they fit one sticker,
 * "The elite · 1/2" and "· 2/2" when they run past it — a PART number, the
 * way the post pack counts a club welcome that spills over, never a place
 * range: the rows are in pace order, and "1–10" over them would be the
 * ranking the rule takes away. `hidden` is the whole board's count, so
 * page one knows a page two exists. */
function elitePageName(start: number, hidden: number): string {
  const parts = Math.ceil(hidden / BOARD_PAGE);
  if (parts <= 1) return ELITE_SECTION;
  return `${ELITE_SECTION} · ${Math.floor((start - 1) / BOARD_PAGE) + 1}/${parts}`;
}

/* The dim line under the title. A page whose rows are ALL hidden is the
 * elite and says so, with its part when they take two pages. A page that
 * mixes them with real places (11–20 with twelve hidden: two unranked, then
 * 13 to 20) prints no range at all — no range is true of all ten lines, and
 * "11–20" over blank places would be the ranking the rule just took away.
 * Everything else: the places, as before. `hidden` is how many rows the
 * whole board hides; left out, the page counts its own. */
export function boardSectionLabel(
  rows: { unranked?: boolean }[],
  start: number,
  end: number,
  hidden: number = hiddenCount(rows),
): string {
  if (rows.length > 0 && rows.every((r) => r.unranked)) {
    return `The board · ${elitePageName(start, hidden)}`;
  }
  if (rows.some((r) => r.unranked)) return "The board";
  return `The board · ${start}–${end}`;
}

/* The same decision at chip length, for the picker (review, 2026-09-05): a
 * chip reading "1–10" over a sticker that prints no place at all IS a place,
 * and a false one — after the reorder those ten are in pace-then-name
 * order, not places 1 to 10. "The elite" is the chip the elite card already
 * uses, so the picker keeps one vocabulary; two elite pages count themselves
 * so the picker never shows the same chip twice. */
export function boardPageLabel(
  rows: { unranked?: boolean }[],
  start: number,
  end: number,
  hidden: number = hiddenCount(rows),
): string {
  if (rows.length > 0 && rows.every((r) => r.unranked)) return elitePageName(start, hidden);
  if (rows.some((r) => r.unranked)) return "The board";
  return `${start}–${end}`;
}

function boardCard(page: number): ShareCard {
  const start = page * BOARD_PAGE + 1;
  const end = start + BOARD_PAGE - 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const pageRows = (d: ShareData) =>
    d.community?.standings?.slice(page * BOARD_PAGE, (page + 1) * BOARD_PAGE) ?? [];
  const hiddenRows = (d: ShareData) => hiddenCount(d.community?.standings ?? []);
  return {
    id: `rowtember-board-${pad(start)}-${pad(end)}`,
    label: `${start}–${end}`,
    labelFor: (d) => boardPageLabel(pageRows(d), start, end, hiddenRows(d)),
    width: 1080,
    height: 1080,
    light: true,
    available: (d) => (d.community?.standings?.length ?? 0) > page * BOARD_PAGE,
    draw(ctx, data, fonts) {
      const rows = pageRows(data);
      if (rows.length === 0) return;
      const L = 70;
      const R = this.width - 70;

      ctx.save();
      ctx.textBaseline = "alphabetic";
      ctx.shadowColor = "rgba(0,0,0,0.55)";
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 3;

      // Title: "Rowtember · Sep 3" — bold mono, like a date line.
      ctx.textAlign = "left";
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold 46px ${fonts.mono}`;
      const asOf = data.community?.asOf;
      ctx.fillText(asOf ? `Rowtember · ${asOf}` : "Rowtember 2026", L, 118);

      // Section label, dim: which ten places this is — or the elite's
      // name when the page has no places to give.
      ctx.font = `30px ${fonts.mono}`;
      ctx.fillStyle = "rgba(255,255,255,0.62)";
      ctx.fillText(boardSectionLabel(rows, start, end, hiddenRows(data)), L, 196);

      const top = 292;
      const step = 82;
      const size = 42;
      rows.forEach((r, i) => {
        const place = start + i;
        const y = top + i * step;
        // No place, no metal: a hidden row is not on the podium, whatever
        // index it happens to sit at after the reorder.
        const medal = r.unranked ? null : medalColor(place);

        // Meters, right-aligned, measured first so the name can yield to it.
        // A blacked-out row gets blocks where the digits would go: the
        // sticker leaves the site, so it hides exactly what the board hides.
        ctx.font = `${size}px ${fonts.mono}`;
        ctx.textAlign = "right";
        ctx.fillStyle = "#ffffff";
        let metersW: number;
        if (r.masked) {
          const unit = " m";
          ctx.fillText(unit, R, y);
          const unitW = ctx.measureText(unit).width;
          metersW =
            unitW +
            drawBlockDigits(ctx, R - unitW, y, r.digits ?? digitCount(r.meters), size, fonts, {
              align: "right",
            });
        } else {
          const metersText = fmtMeters(r.meters);
          ctx.fillText(metersText, R, y);
          metersW = ctx.measureText(metersText).width;
        }

        // Place number — dim, or the medal colour on the podium. A hidden
        // row draws nothing here and keeps the column, so the names stay on
        // one line down the sticker.
        // (textAlign is set back to left for the name either way — the
        // meters above left it on right.)
        ctx.textAlign = "left";
        const placeText = boardPlaceText(r, place);
        if (placeText) {
          ctx.font = `${size * 0.72}px ${fonts.mono}`;
          ctx.fillStyle = medal ?? "rgba(255,255,255,0.55)";
          ctx.fillText(placeText, L, y);
        }

        // Name, ellipsized into what is left between the number and the meters.
        ctx.font = `${size}px ${fonts.mono}`;
        ctx.fillStyle = "#ffffff";
        const nameX = L + 86;
        const maxW = R - metersW - 36 - nameX;
        ctx.fillText(ellipsize(ctx, r.name, maxW), nameX, y);
      });
      ctx.restore();
    },
  };
}

const boardCards = Array.from({ length: BOARD_PAGES }, (_, i) => boardCard(i));

export const BOARD_CARD_IDS = boardCards.map((c) => c.id);

export const CARDS: ShareCard[] = [
  rowtemberRow,
  rowtemberRowFull,
  rowtemberBest,
  rowtemberTotal,
  rowtemberToday,
  rowtemberNamed,
  rowtemberProfile,
  // The personal curve card is retired (owner call, 2026-09-05: "the curve
  // shareable can be retired"). The community curve on the stats page stays.
  rowtemberBib,
  rowtemberClub,
  rowtemberMonth,
  rowtemberElite,
  rowtemberLogo,
  rowtemberCommunityMonth,
  rowtemberCommunityTotal,
  rowtemberCommunityToday,
  rowtemberCommunityCurve,
  rowtemberCommunityDaily,
  rowtemberCommunityHours,
  rowtemberCommunityHoursTall,
  ...boardCards,
];

export function availableCards(data: ShareData): ShareCard[] {
  return CARDS.filter((c) => !c.available || c.available(data));
}

export function cardById(id: string, data: ShareData): ShareCard {
  const pool = availableCards(data);
  return pool.find((c) => c.id === id) ?? pool[0];
}
