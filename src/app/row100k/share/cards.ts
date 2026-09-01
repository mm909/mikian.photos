import { fmtDuration, fmtMeters, fmtRowerNumber, fmtSplit, type RecordBadge } from "@/lib/row100k";

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
   * "Fastest 5k" / "22:30" / #2 in division when placed. */
  best?: { label: string; value: string; place?: number | null };
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
      ctx.strokeStyle = boxColor === SILVER ? "rgba(21,23,26,0.66)" : "rgba(255,255,255,0.66)";
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
    // place off the canvas.
    const metersText = data.meters.toLocaleString("en-US");
    const rankText = top10 ? `#${top10.place}` : null;
    const rankSize = 76;
    const gap = 30;
    const maxW = this.width - 90;
    let mSize = 210;
    const lineW = () => {
      ctx.font = `${mSize}px ${fonts.black}`;
      let w = ctx.measureText(metersText).width;
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
    ctx.font = `${mSize}px ${fonts.black}`;
    ctx.fillText(metersText, x, 250);
    if (rankText) {
      x += ctx.measureText(metersText).width + gap;
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
 * once the rower crosses 50k, and upgrades itself at 75k and 100k. */
const MILESTONES = [100_000, 75_000, 50_000] as const;

const rowtemberClub: ShareCard = {
  id: "rowtember-club",
  label: "Club card",
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
 * the profile draws, white cells on transparency, brighter = more meters.
 * Each rowed day wears its meter count, rounded to the nearest k. */
const rowtemberMonth: ShareCard = {
  id: "rowtember-month",
  label: "The month",
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
        // The day's meters, to the nearest k — ink on the white cell.
        ctx.save();
        ctx.font = `34px ${fonts.mono}`;
        ctx.fillStyle = INK;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${Math.max(1, Math.round(m / 1000))}k`, x + cell / 2, y + cell / 2 + 2);
        ctx.restore();
      }
    }

    const gridBottom = top + Math.ceil((firstDow + 30) / cols) * (cell + gap) - gap;

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
 * when the dialog was opened from a specific row. */
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

    drawMark(ctx, [{ text: "ROWTEMBER" }], {
      cx,
      cy: 490,
      size: 100,
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

    // The blue ROWTEMBER stamp where the gray event line used to sit —
    // clearly smaller than the number below it.
    drawMark(ctx, [{ text: "ROWTEMBER" }], {
      cx,
      cy: top + 88,
      size: 36,
      fontFamily: fonts.black,
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
    const fittedLine = ellipsize(ctx, nameLine, maxW - 3 * (nameLine.length - 1));
    drawCenteredText(ctx, fittedLine, {
      cx,
      baseline: top + 366,
      font: `${nameSize}px ${fonts.mono}`,
      color: WATER,
      tracking: 3,
    });
  },
};

/* The profile header, redrawn white-on-transparent: number + name, the @,
 * the board tag, three outlined stat boxes, the progress bar. */
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

    // Number + name, one line, shrunk to fit.
    const numText = fmtRowerNumber(data.rowerNumber);
    const nameText = ` ${data.displayName.toUpperCase()}`;
    let nameSize = 68;
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
    ctx.fillText(numText, M, 140);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(fittedName, M + ctx.measureText(numText).width, 140);

    // The @, water blue mono.
    ctx.font = `34px ${fonts.mono}`;
    ctx.fillStyle = WATER;
    ctx.fillText(`@${data.instagram}`, M, 198);

    // Board tag, with the club stamp once earned.
    const board = data.division === "F" ? "WOMEN'S BOARD" : "MEN'S BOARD";
    const tag = data.meters >= 100_000 ? `${board} · 100K CLUB` : board;
    ctx.font = `24px ${fonts.mono}`;
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillText(tag, M, 254);
    ctx.restore();

    // Three outlined stat boxes: METERS / SESSIONS / their loudest record.
    // The third box headlines the highest-ranking badge — lowest place,
    // total excluded (it has its own cards), ties broken in board order —
    // labelled "FASTEST 10K · #1". No badges at all → LONGEST ROW as before.
    const BADGE_ORDER = ["fastest5000", "fastest10000", "longest", "bigday"];
    const badge = (data.records ?? [])
      .filter((r) => r.key !== "total")
      .slice()
      .sort(
        (a, b) => a.place - b.place || BADGE_ORDER.indexOf(a.key) - BADGE_ORDER.indexOf(b.key),
      )[0];
    const gap = 24;
    const boxW = (contentW - gap * 2) / 3;
    const boxH = 160;
    const boxTop = 300;
    const stats: { v: string; l: string }[] = [
      { v: data.meters.toLocaleString("en-US"), l: "METERS" },
      { v: String(data.sessions), l: "SESSIONS" },
      badge
        ? { v: badge.value, l: `${badge.label.toUpperCase()} · #${badge.place}` }
        : { v: (data.longest ?? 0).toLocaleString("en-US"), l: "LONGEST ROW" },
    ];
    stats.forEach((s, i) => {
      const bx = M + i * (boxW + gap);
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 4;
      ctx.strokeRect(bx + 2, boxTop + 2, boxW - 4, boxH - 4);
      // Value shrinks to fit the box.
      let vSize = 52;
      ctx.font = `${vSize}px ${fonts.black}`;
      while (vSize > 26 && ctx.measureText(s.v).width > boxW - 40) {
        vSize -= 2;
        ctx.font = `${vSize}px ${fonts.black}`;
      }
      drawCenteredText(ctx, s.v, {
        cx: bx + boxW / 2,
        baseline: boxTop + 88,
        font: `${vSize}px ${fonts.black}`,
        color: "#ffffff",
      });
      // Labels now run to "FASTEST 10K · #10" — budget the tracking, then
      // ellipsize so a label can never cross into the neighbor box.
      ctx.font = `20px ${fonts.mono}`;
      const fittedLabel = ellipsize(ctx, s.l, boxW - 24 - 4 * (s.l.length - 1));
      drawCenteredText(ctx, fittedLabel, {
        cx: bx + boxW / 2,
        baseline: boxTop + 128,
        font: `20px ${fonts.mono}`,
        color: "rgba(255,255,255,0.72)",
        tracking: 4,
      });
    });

    // Progress bar toward 100k.
    const barTop = 528;
    const barH = 28;
    const pct = Math.min(100, (data.meters / 100_000) * 100);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(M, barTop, contentW, barH);
    if (pct > 0) {
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
    ctx.fillText(fmtMeters(data.meters), M, barTop + barH + 44);
    ctx.textAlign = "right";
    ctx.fillText(
      data.meters >= 100_000 ? "100K — DONE" : `${fmtMeters(100_000 - data.meters)} TO GO`,
      this.width - M,
      barTop + barH + 44,
    );
    ctx.restore();
  },
};

/* The rower's own cumulative curve for September — their line vs the dashed
 * finish-on-time line, same vocabulary as the profile's Curve. */
const rowtemberCurve: ShareCard = {
  id: "rowtember-curve",
  label: "The curve",
  width: 1080,
  height: 1080,
  light: true,
  available: (d) => Object.values(d.byDay).some((m) => m > 0),
  draw(ctx, data, fonts) {
    const cx = this.width / 2;

    drawMark(ctx, [{ text: "ROWTEMBER" }], {
      cx,
      cy: 120,
      size: 80,
      fontFamily: fonts.black,
    });

    // Cumulative points from byDay, September days only, ascending.
    const days = Object.keys(data.byDay)
      .filter((d) => d.startsWith("2026-09-") && (data.byDay[d] ?? 0) > 0)
      .sort();
    let cum = 0;
    const pts = days.map((d) => {
      cum += data.byDay[d];
      return { dayNum: Number(d.slice(8, 10)), cum };
    });
    if (pts.length === 0) return;
    if (pts[0].dayNum > 1) pts.unshift({ dayNum: pts[0].dayNum - 1, cum: 0 });
    const total = pts[pts.length - 1].cum;

    // Chart frame.
    const L = 110;
    const R = 1010;
    const T = 240;
    const B = 790;
    const maxV = Math.max(total, 100_000);
    const x = (dayNum: number) => L + ((dayNum - 1) / 29) * (R - L);
    const y = (v: number) => B - (v / maxV) * (B - T);

    // Minimal axes: baseline + two day ticks + the 100k mark on the right.
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
    ctx.fillText("30", R, B + 40);
    ctx.fillText("100K", R, y(100_000) - 14);

    // The finish-on-time line: 0 on Sep 1 → 100k on Sep 30, dashed, quiet.
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 12]);
    ctx.beginPath();
    ctx.moveTo(x(1), y(0));
    ctx.lineTo(x(30), y(100_000));
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
 * day). Only in the menu when the dialog was opened from a specific row. */
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

    drawCenteredText(ctx, row.meters.toLocaleString("en-US"), {
      cx,
      baseline: 390,
      font: `180px ${fonts.black}`,
      color: "#ffffff",
      maxWidth: this.width - 100,
    });
    drawCenteredText(ctx, "METERS", {
      cx,
      baseline: 448,
      font: `30px ${fonts.mono}`,
      color: "rgba(255,255,255,0.82)",
      tracking: 9,
    });

    drawCenteredText(ctx, `${fmtDuration(row.seconds)} · ${fmtSplit(row.meters, row.seconds)} /500M`, {
      cx,
      baseline: 528,
      font: `46px ${fonts.black}`,
      color: "#ffffff",
      maxWidth: this.width - 120,
    });

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

    const metersText = data.meters.toLocaleString("en-US");
    const rankText = top10 ? `#${top10.place}` : null;
    const rankSize = 70;
    const gap = 28;
    const maxW = this.width - 90;
    let mSize = 190;
    const lineW = () => {
      ctx.font = `${mSize}px ${fonts.black}`;
      let w = ctx.measureText(metersText).width;
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
    ctx.font = `${mSize}px ${fonts.black}`;
    ctx.fillText(metersText, x, 350);
    if (rankText) {
      x += ctx.measureText(metersText).width + gap;
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
 * Only in the menu when the dialog was opened from a bests card. */
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
    drawCenteredText(ctx, best.value, {
      cx,
      baseline: 320,
      font: `170px ${fonts.black}`,
      color: "#ffffff",
      maxWidth: this.width - 120,
    });
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
  rowtemberLogo,
];

export function availableCards(data: ShareData): ShareCard[] {
  return CARDS.filter((c) => !c.available || c.available(data));
}

export function cardById(id: string, data: ShareData): ShareCard {
  const pool = availableCards(data);
  return pool.find((c) => c.id === id) ?? pool[0];
}
