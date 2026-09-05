import {
  daysElapsed,
  fmtDuration,
  fmtMeters,
  fmtRowerNumber,
  fmtSplit,
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
   * "Fastest 5k" / "22:30" / #2 in division when placed. Under `masked`
   * the card draws the value's silhouette instead (shapeOf: "##:##.#" for
   * a pace best, "##,### m" for a meters best); a page that blanks `value`
   * before it reaches the client hands the silhouette over as `shape`. */
  best?: { label: string; value: string; place?: number | null; shape?: string };
  /* September days elapsed (daysElapsed()), 1..30. Every calendar and curve
   * stops here instead of framing the whole month (owner call, 2026-09-05:
   * the curve looked dumb against thirty days). Absent = the full month. */
  days?: number;
  /* Blackout (blackoutRules.ts): this rower is in the elite fifteen while a
   * window is open, so none of their numbers is shareable. The total cards
   * draw `digits` blocks where the number would go, the row and best cards
   * draw blocks for their meters and times, the curve and month cards drop
   * out of the menu, and the elite card comes in. Set by the pages. */
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
 * for white caps, so text flips to ink on it. */
function drawMark(
  ctx: CanvasRenderingContext2D,
  segments: { text: string; strike?: boolean }[],
  opts: { cx: number; cy: number; size: number; fontFamily: string; box?: string },
) {
  const { cx, cy, size, fontFamily } = opts;
  const boxColor = opts.box ?? WATER;
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
  ctx.font = `${size}px ${fonts.mono}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const commaW = ctx.measureText(",").width;
  const commas = Math.floor((n - 1) / 3);
  const width = n * cell + commas * commaW;
  let cx = opts.align === "right" ? x - width : x;
  ctx.fillStyle = opts.fill ?? "#ffffff";
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
    let cx = opts.align === "right" ? x - width : opts.align === "center" ? x - width / 2 : x;
    ctx.fillStyle = opts.fill ?? "#ffffff";
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
    });
  },
};

/* Card two: the club stamp. Earned, not given — it only appears in the menu
 * once the rower crosses 50k, and upgrades itself through the clubs. Each
 * club has its own colour (owner call, 2026-09-05), painted as an opaque
 * plaque behind the type so the four cards tell apart at a glance in a
 * story feed; the card stays see-through outside the plaque. */
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

    // Just the club, in white, on nothing (owner call, 2026-09-05: "no
    // background colour on the club card, just the 50K club in white and
    // nothing else") — the sticker takes its ground from the story it lands
    // on. Same soft shadow as the board stickers so it reads on a photo.
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 3;
    drawCenteredText(ctx, club.label, {
      cx,
      baseline: 330,
      font: `270px ${fonts.black}`,
      color: "#ffffff",
      maxWidth: this.width - 160,
    });
    drawCenteredText(ctx, "CLUB", {
      cx,
      baseline: 480,
      font: `118px ${fonts.black}`,
      color: "#ffffff",
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
 * meters as big as the card allows, the progress bar. The @ handle is gone
 * (owner call, 2026-09-05: just the bib number and the name), so the meters
 * move up and grow into the room it left. */
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

    // Progress bar toward 100k. A masked rower keeps the empty track and
    // the labels go dark: the fill and "X TO GO" would both give the
    // hidden number away.
    const barTop = 530;
    const barH = 28;
    const pct = Math.min(100, (data.meters / 100_000) * 100);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(M, barTop, contentW, barH);
    if (pct > 0 && !data.masked) {
      const fillW = Math.max(6, (pct / 100) * contentW);
      const grad = ctx.createLinearGradient(M, 0, M + contentW, 0);
      grad.addColorStop(0, WATER);
      grad.addColorStop(1, "#ffffff");
      ctx.fillStyle = grad;
      ctx.fillRect(M, barTop, fillW, barH);
    }
    ctx.save();
    ctx.font = `26px ${fonts.mono}`;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.textAlign = "left";
    const labelY = barTop + barH + 44;
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

/* The rower's own cumulative curve for September so far — their line vs
 * the dashed finish-on-time line, same vocabulary as the profile's Curve.
 * The frame ends at today, not Sep 30 (owner call, 2026-09-05), and the
 * pace line is clipped with it. Out of the menu under a blackout: the
 * endpoint is the number being hidden. */
const rowtemberCurve: ShareCard = {
  id: "rowtember-curve",
  label: "The curve",
  width: 1080,
  height: 1080,
  light: true,
  // A one-day month is a dot, not a curve: on Sep 1 the card stays out of
  // the menu rather than drawing a lone point between two SEP 1 labels.
  available: (d) =>
    !d.masked && spanFor(d.days) > 1 && Object.values(d.byDay).some((m) => m > 0),
  draw(ctx, data, fonts) {
    const cx = this.width / 2;
    const span = spanFor(data.days);

    drawMark(ctx, [{ text: "ROWTEMBER" }], {
      cx,
      cy: 120,
      size: 80,
      fontFamily: fonts.black,
    });

    // Cumulative points from byDay, September days only, ascending.
    const days = Object.keys(data.byDay)
      .filter((d) => d.startsWith("2026-09-") && (data.byDay[d] ?? 0) > 0)
      .filter((d) => Number(d.slice(8, 10)) <= span)
      .sort();
    let cum = 0;
    const pts = days.map((d) => {
      cum += data.byDay[d];
      return { dayNum: Number(d.slice(8, 10)), cum };
    });
    if (pts.length === 0) return;
    if (pts[0].dayNum > 1) pts.unshift({ dayNum: pts[0].dayNum - 1, cum: 0 });
    const total = pts[pts.length - 1].cum;

    // Chart frame. The y range tops out where the pace line reaches today,
    // so the dashed line still runs corner to corner in a short month.
    const L = 110;
    const R = 1010;
    const T = 240;
    const B = 790;
    const paceAt = (dayNum: number) => (100_000 * (dayNum - 1)) / 29;
    const maxV = Math.max(total, paceAt(span), 1);
    const x = (dayNum: number) => L + ((dayNum - 1) / Math.max(1, span - 1)) * (R - L);
    const y = (v: number) => B - (v / maxV) * (B - T);

    // Minimal axes: baseline + two day ticks + the pace mark on the right.
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
    if (span >= 30) {
      ctx.fillText("100K", R, y(100_000) - 14);
    } else if (span > 1) {
      // Mid-month the dashed line ends short of 100k; say what it is.
      ctx.fillText("100K PACE", R, y(paceAt(span)) - 14);
    }

    // The finish-on-time line: 0 on Sep 1 → 100k on Sep 30, dashed, quiet,
    // drawn as far as today.
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 12]);
    ctx.beginPath();
    ctx.moveTo(x(1), y(0));
    ctx.lineTo(x(span), y(paceAt(span)));
    ctx.stroke();
    ctx.setLineDash([]);

    // The rower's line, solid white, with a bright endpoint dot.
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

    // The total under the chart.
    drawCenteredText(ctx, total.toLocaleString("en-US"), {
      cx,
      baseline: 950,
      font: `96px ${fonts.black}`,
      color: "#ffffff",
    });
    drawCenteredText(ctx, "METERS", {
      cx,
      baseline: 998,
      font: `28px ${fonts.mono}`,
      color: "rgba(255,255,255,0.82)",
      tracking: 8,
    });
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
    });
  },
};

/* One personal best: the label, the number, the place when they hold one.
 * Only in the menu when the dialog was opened from a bests card. A hidden
 * rower's best is drawn as its silhouette — ▮▮:▮▮.▮ for a pace best,
 * ▮▮,▮▮▮ m for a meters one — with the place kept, since places are
 * public and the number is not. */
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

    drawCenteredText(ctx, best.label.toUpperCase(), {
      cx,
      baseline: 120,
      font: `36px ${fonts.mono}`,
      color: "rgba(255,255,255,0.82)",
      tracking: 8,
    });
    if (data.masked) {
      // The page may have blanked the value and sent only its shape; when
      // the dialog is the rower's own the value is still here and the
      // shape is read off it.
      const shape = best.shape || shapeOf(best.value);
      const maxW = this.width - 120;
      let size = 170;
      while (size > 80 && drawBlockShape(ctx, 0, 0, shape, size, fonts, { paint: false }) > maxW) size -= 6;
      drawBlockShape(ctx, cx, 320, shape, size, fonts, { align: "center" });
    } else {
      drawCenteredText(ctx, best.value, {
        cx,
        baseline: 320,
        font: `170px ${fonts.black}`,
        color: "#ffffff",
        maxWidth: this.width - 120,
      });
    }
    if (best.place) {
      drawCenteredText(ctx, `#${best.place}`, {
        cx,
        baseline: 402,
        font: `52px ${fonts.black}`,
        color: medalColor(best.place) ?? "#ffffff",
      });
    }

    drawMark(ctx, [{ text: "ROWTEMBER" }], {
      cx,
      cy: 500,
      size: 96,
      fontFamily: fonts.black,
    });
  },
};

/* The blackout flex: in the menu only while the rower is one of the hidden
 * fifteen. Their total as ink blocks — the board's own blocks, painted — over
 * THE ELITE FIFTEEN and the mark. The blocks wear a white halo instead of
 * the dark shadow the type gets, so ink still reads on a night photo. */
const rowtemberElite: ShareCard = {
  id: "rowtember-elite",
  label: "Elite 15",
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
    });

    let size = 168;
    const maxW = this.width - 120;
    while (size > 80 && blockDigitsWidth(ctx, digits, size, fonts) > maxW) size -= 6;
    const w = blockDigitsWidth(ctx, digits, size, fonts);
    // The halo is laid down twice before the ink: one pass at 60% barely
    // registered at 1080px and the blocks read as plain black slabs on a
    // night photo. Stacking two near-white shadows gives them a light field
    // to sit on without painting a white card behind them.
    ctx.save();
    ctx.shadowColor = "rgba(255,255,255,0.95)";
    ctx.shadowBlur = 36;
    drawBlockDigits(ctx, cx - w / 2, 440, digits, size, fonts, { fill: INK });
    drawBlockDigits(ctx, cx - w / 2, 440, digits, size, fonts, { fill: INK });
    ctx.restore();
    drawBlockDigits(ctx, cx - w / 2, 440, digits, size, fonts, { fill: INK });

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

/* Just the mark. Big, centered, transparent — the sticker of stickers. */
const rowtemberLogo: ShareCard = {
  id: "rowtember-logo",
  label: "The logo",
  width: 1080,
  height: 620,
  light: true,
  draw(ctx, _data, fonts) {
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

/* The hours grid as a sticker — the stats page's commit-graph (one row per
 * September day so far, 24 hour columns) in the community month card's alpha
 * ramp. Rows fatten early in the month and thin toward GitHub-graph texture
 * as days accumulate; the block stays vertically centered either way. Just
 * the grid — no mark, no caption (owner call, day 3). */
const rowtemberCommunityHours: ShareCard = {
  id: "rowtember-community-hours",
  label: "The hours",
  width: 1080,
  height: 1080,
  light: true,
  available: (d) =>
    !!d.community?.hourGrid && d.community.hourGrid.some((row) => row.some((m) => m > 0)),
  draw(ctx, data, fonts) {
    const community = data.community;
    const grid = community?.hourGrid;
    if (!community || !grid || grid.length === 0) return;
    const busiest = Math.max(0, ...grid.map((row) => Math.max(...row, 0)));
    const alphaFor = (m: number) =>
      m <= 0 || busiest <= 0
        ? 0
        : m < busiest * 0.25
          ? 0.3
          : m < busiest * 0.5
            ? 0.55
            : m < busiest * 0.75
              ? 0.78
              : 1;

    const n = grid.length;
    const cw = 32;
    const cgap = 6;
    const rgap = 6;
    const labelW = 92;
    const gridW = 24 * cw + 23 * cgap;
    const left = (this.width - (labelW + gridW)) / 2 + labelW;
    const tickH = 34;
    const bandTop = 90;
    const bandH = 900;
    const rowH = Math.min(44, Math.floor((bandH - tickH - (n - 1) * rgap) / n));
    const gridH = n * rowH + (n - 1) * rgap;
    const top = bandTop + Math.max(0, (bandH - tickH - gridH) / 2) + tickH;

    ctx.save();
    ctx.font = `22px ${fonts.mono}`;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    for (const [h, label] of [[0, "12A"], [6, "6A"], [12, "12P"], [18, "6P"]] as const) {
      ctx.fillText(label, left + h * (cw + cgap) + cw / 2, top - 14);
    }

    // Every row gets a label while rows are chunky; every 5th once they thin.
    const labelEvery = rowH >= 22 ? 1 : 5;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let di = 0; di < n; di++) {
      const y = top + di * (rowH + rgap);
      if (di === 0 || (di + 1) % labelEvery === 0) {
        ctx.fillText(`SEP ${di + 1}`, left - 16, y + rowH / 2 + 1);
      }
      for (let h = 0; h < 24; h++) {
        const x = left + h * (cw + cgap);
        const a = alphaFor(grid[di][h]);
        if (a === 0) {
          ctx.strokeStyle = "rgba(255,255,255,0.25)";
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, cw - 2, rowH - 2);
        } else {
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.fillRect(x, y, cw, rowH);
        }
      }
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

function boardCard(page: number): ShareCard {
  const start = page * BOARD_PAGE + 1;
  const end = start + BOARD_PAGE - 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    id: `rowtember-board-${pad(start)}-${pad(end)}`,
    label: `${start}–${end}`,
    width: 1080,
    height: 1080,
    light: true,
    available: (d) => (d.community?.standings?.length ?? 0) > page * BOARD_PAGE,
    draw(ctx, data, fonts) {
      const rows = data.community?.standings?.slice(page * BOARD_PAGE, (page + 1) * BOARD_PAGE) ?? [];
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

      // Section label, dim: which ten places this is.
      ctx.font = `30px ${fonts.mono}`;
      ctx.fillStyle = "rgba(255,255,255,0.62)";
      ctx.fillText(`The board · ${start}–${end}`, L, 196);

      const top = 292;
      const step = 82;
      const size = 42;
      rows.forEach((r, i) => {
        const place = start + i;
        const y = top + i * step;
        const medal = medalColor(place);

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

        // Place number — dim, or the medal colour on the podium.
        ctx.textAlign = "left";
        ctx.font = `${size * 0.72}px ${fonts.mono}`;
        ctx.fillStyle = medal ?? "rgba(255,255,255,0.55)";
        ctx.fillText(pad(place), L, y);

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
  rowtemberNamed,
  rowtemberProfile,
  rowtemberCurve,
  rowtemberBib,
  rowtemberClub,
  rowtemberMonth,
  rowtemberElite,
  rowtemberLogo,
  rowtemberCommunityMonth,
  rowtemberCommunityTotal,
  rowtemberCommunityCurve,
  rowtemberCommunityDaily,
  rowtemberCommunityHours,
  ...boardCards,
];

export function availableCards(data: ShareData): ShareCard[] {
  return CARDS.filter((c) => !c.available || c.available(data));
}

export function cardById(id: string, data: ShareData): ShareCard {
  const pool = availableCards(data);
  return pool.find((c) => c.id === id) ?? pool[0];
}
