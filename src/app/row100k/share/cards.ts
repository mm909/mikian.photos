import { fmtDay, fmtDuration, fmtRowerNumber, fmtSplit } from "@/lib/row100k";

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
   * unlocks the single-row card. */
  row?: { day: string; meters: number; seconds: number } | null;
};

export type ShareFonts = { black: string; mono: string };

export type ShareCard = {
  id: string;
  /* Menu label + one line on what the card says. */
  label: string;
  blurb: string;
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

/* ------------------------------------------------------------ primitives */

/* The page's "open to everyone" mark: white caps on water blue, rotated a
 * degree and a half and skewed, so it reads as something stamped on rather
 * than typeset. Returns the drawn width so callers can centre it. */
function drawMark(
  ctx: CanvasRenderingContext2D,
  segments: { text: string; strike?: boolean }[],
  opts: { cx: number; cy: number; size: number; fontFamily: string },
) {
  const { cx, cy, size, fontFamily } = opts;
  ctx.save();
  ctx.font = `${size}px ${fontFamily}`;
  ctx.textBaseline = "alphabetic";

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

  ctx.fillStyle = WATER;
  ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);

  const baseline = -boxH / 2 + padTop + capHeight;
  let x = -boxW / 2 + padX;
  ctx.fillStyle = "#ffffff";
  segments.forEach((seg, i) => {
    ctx.fillText(seg.text, x, baseline);
    if (seg.strike) {
      // Through the middle of the caps, at the weight of the letterforms —
      // a struck-out SEP, not a hairline.
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.66)";
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
  opts: { cx: number; baseline: number; font: string; color: string; tracking?: number },
) {
  ctx.save();
  ctx.font = opts.font;
  ctx.fillStyle = opts.color;
  ctx.textBaseline = "alphabetic";
  const tracking = opts.tracking ?? 0;
  if (!tracking) {
    ctx.textAlign = "center";
    ctx.fillText(text, opts.cx, opts.baseline);
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

/* ----------------------------------------------------------------- cards */

/* Card one: the wordmark and your number. Nothing else — it has to survive
 * being 300px wide on someone's story. */
const rowtemberTotal: ShareCard = {
  id: "rowtember-total",
  label: "Rowtember total",
  blurb: "The wordmark and your meters so far.",
  width: 1080,
  height: 620,
  light: true,
  draw(ctx, data, fonts) {
    const cx = this.width / 2;

    drawCenteredText(ctx, data.meters.toLocaleString("en-US"), {
      cx,
      baseline: 250,
      font: `210px ${fonts.black}`,
      color: "#ffffff",
    });
    drawCenteredText(ctx, "METERS ROWED", {
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
    });
  },
};

/* Card two: the club stamp. Earned, not given — it only appears in the menu
 * once the rower crosses 50k, and upgrades itself at 75k and 100k. */
const MILESTONES = [100_000, 75_000, 50_000] as const;

const rowtemberClub: ShareCard = {
  id: "rowtember-club",
  label: "Club card",
  blurb: "Unlocked at 50k — upgrades at 75k and 100k.",
  width: 1080,
  height: 700,
  light: true,
  available: (d) => d.meters >= 50_000,
  draw(ctx, data, fonts) {
    const cx = this.width / 2;
    const milestone = MILESTONES.find((m) => data.meters >= m) ?? 50_000;
    const label = `${milestone / 1000}K`;

    drawCenteredText(ctx, label, {
      cx,
      baseline: 268,
      font: `250px ${fonts.black}`,
      color: "#ffffff",
    });

    drawMark(ctx, [{ text: "CLUB" }], {
      cx,
      cy: 380,
      size: 118,
      fontFamily: fonts.black,
    });

    drawCenteredText(
      ctx,
      milestone >= 100_000
        ? "DONE — AND STILL ROWING"
        : `${data.meters.toLocaleString("en-US")} M AND COUNTING`,
      {
        cx,
        baseline: 540,
        font: `34px ${fonts.mono}`,
        color: "rgba(255,255,255,0.82)",
        tracking: 8,
      },
    );

    drawCenteredText(ctx, "ROWTEMBER", {
      cx,
      baseline: 640,
      font: `26px ${fonts.mono}`,
      color: "rgba(255,255,255,0.7)",
      tracking: 6,
    });
  },
};

/* Card three: the month itself — September as the same intensity calendar
 * the profile draws, white cells on transparency, brighter = more meters. */
const rowtemberMonth: ShareCard = {
  id: "rowtember-month",
  label: "The month",
  blurb: "Your September, one square per day.",
  width: 1080,
  height: 1080,
  light: true,
  draw(ctx, data, fonts) {
    const cx = this.width / 2;

    drawMark(ctx, [{ text: "ROWTEMBER" }], {
      cx,
      cy: 130,
      size: 88,
      fontFamily: fonts.black,
    });

    /* The calendar: Sep 2026 starts on a Tuesday; 7 columns, Sunday first —
     * same layout as the profile heatmap so the shapes rhyme. */
    const cell = 108;
    const gap = 18;
    const cols = 7;
    const gridW = cols * cell + (cols - 1) * gap;
    const left = (this.width - gridW) / 2;
    const top = 250;
    const firstDow = 2; // Sep 1, 2026 = Tuesday

    const alphaFor = (m: number) =>
      m <= 0 ? 0 : m < 2500 ? 0.3 : m < 5000 ? 0.55 : m < 10000 ? 0.78 : 1;

    for (let d = 1; d <= 30; d++) {
      const idx = firstDow + (d - 1);
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = left + col * (cell + gap);
      const y = top + row * (cell + gap);
      const m = data.byDay[`2026-09-${String(d).padStart(2, "0")}`] ?? 0;
      const a = alphaFor(m);
      if (a === 0) {
        // Rest day: an outline, so the month's shape stays legible.
        ctx.strokeStyle = "rgba(255,255,255,0.30)";
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 1.5, y + 1.5, cell - 3, cell - 3);
      } else {
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(x, y, cell, cell);
      }
    }

    const gridBottom = top + Math.ceil((firstDow + 30) / cols) * (cell + gap) - gap;

    drawCenteredText(ctx, data.meters.toLocaleString("en-US"), {
      cx,
      baseline: gridBottom + 104,
      font: `96px ${fonts.black}`,
      color: "#ffffff",
    });
    drawCenteredText(ctx, "METERS THIS SEPTEMBER", {
      cx,
      baseline: gridBottom + 150,
      font: `28px ${fonts.mono}`,
      color: "rgba(255,255,255,0.82)",
      tracking: 8,
    });
  },
};

/* Card four: one session. Available only when the dialog was opened from a
 * specific row — just logged, or the share action next to a row in the log. */
const rowtemberRow: ShareCard = {
  id: "rowtember-row",
  label: "This row",
  blurb: "Just this session — day, time, split.",
  width: 1080,
  height: 620,
  light: true,
  available: (d) => !!d.row,
  draw(ctx, data, fonts) {
    const cx = this.width / 2;
    const row = data.row;
    if (!row) return;

    drawCenteredText(ctx, row.meters.toLocaleString("en-US"), {
      cx,
      baseline: 250,
      font: `210px ${fonts.black}`,
      color: "#ffffff",
    });
    drawCenteredText(
      ctx,
      `${fmtDay(row.day).toUpperCase()} · ${fmtDuration(row.seconds)} · ${fmtSplit(row.meters, row.seconds)} /500M`,
      {
        cx,
        baseline: 318,
        font: `34px ${fonts.mono}`,
        color: "rgba(255,255,255,0.82)",
        tracking: 6,
      },
    );

    drawMark(ctx, [{ text: "ROWTEMBER" }], {
      cx,
      cy: 470,
      size: 112,
      fontFamily: fonts.black,
    });
  },
};

/* Card five: the bib itself — the same white card the dashboard shows,
 * redrawn as a sticker. This is the "I'm in" card: it auto-opens right after
 * someone claims their number, before they've rowed a meter. */
const rowtemberBib: ShareCard = {
  id: "rowtember-bib",
  label: "The bib",
  blurb: "Your number, name and @ — fresh off the press.",
  width: 1080,
  height: 700,
  light: true,
  draw(ctx, data, fonts) {
    const cx = this.width / 2;
    const bibW = 816;
    const bibH = 430;
    const left = cx - bibW / 2;
    // Centered — the bib is the whole card now (no caption below).
    const top = Math.round((this.height - bibH - 16) / 2);

    // The dashboard bib's hard offset shadow, softened for photo backgrounds.
    ctx.fillStyle = "rgba(0,0,0,0.30)";
    ctx.fillRect(left + 16, top + 16, bibW, bibH);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(left, top, bibW, bibH);
    ctx.strokeStyle = "#15171a";
    ctx.lineWidth = 7;
    ctx.strokeRect(left + 3.5, top + 3.5, bibW - 7, bibH - 7);

    // Pin holes, top corners.
    ctx.strokeStyle = "#c9c8c0";
    ctx.lineWidth = 5;
    for (const px of [left + 52, left + bibW - 52]) {
      ctx.beginPath();
      ctx.arc(px, top + 52, 13, 0, Math.PI * 2);
      ctx.stroke();
    }

    drawCenteredText(ctx, "ROWTEMBER · 2026", {
      cx,
      baseline: top + 96,
      font: `26px ${fonts.mono}`,
      color: "#8a8a85",
      tracking: 8,
    });

    drawCenteredText(ctx, fmtRowerNumber(data.rowerNumber), {
      cx,
      baseline: top + 290,
      font: `185px ${fonts.black}`,
      color: "#15171a",
    });

    // Name line shrinks to fit the bib — names run to 40 chars, handles 30.
    const nameLine = `${data.displayName} · @${data.instagram}`.toUpperCase();
    let nameSize = 30;
    const maxW = bibW - 90;
    ctx.font = `30px ${fonts.mono}`;
    while (nameSize > 14 && ctx.measureText(nameLine).width + 3 * (nameLine.length - 1) > maxW) {
      nameSize -= 2;
      ctx.font = `${nameSize}px ${fonts.mono}`;
    }
    drawCenteredText(ctx, nameLine, {
      cx,
      baseline: top + 366,
      font: `${nameSize}px ${fonts.mono}`,
      color: WATER,
      tracking: 3,
    });
  },
};

export const CARDS: ShareCard[] = [
  rowtemberRow,
  rowtemberTotal,
  rowtemberBib,
  rowtemberClub,
  rowtemberMonth,
];

export function availableCards(data: ShareData): ShareCard[] {
  return CARDS.filter((c) => !c.available || c.available(data));
}

export function cardById(id: string, data: ShareData): ShareCard {
  const pool = availableCards(data);
  return pool.find((c) => c.id === id) ?? pool[0];
}
