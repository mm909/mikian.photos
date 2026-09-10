/* poster/rower.ts — the ROWER poster: its modules and plans (ROWER stream).
 *
 * One rower's September on paper, the profile page as a broadsheet: the
 * nameplate (number gray, name ink), the meters as the headline number in
 * water, the bracketed strip, then two flows — the month, the bests, the
 * ledger and the partner plate down the side; the pace curve and EVERY
 * logged row down the wide column, the log closing on the footer. The
 * phone formats are the month made big (story, post) or the bests alone
 * (square). SPEC.md §6 R4–R8 and §7 "Rower" are the contract; types.ts
 * wins where the prose disagrees.
 *
 * Masking is the share-card rule (SPEC §1.4): a poster leaves the site, so
 * a rower among the elite draws blocks for meters, block clocks for times,
 * keeps split / sessions / dates / places on the time bests, and carries
 * no rank — ELITE where the place would go. Every hidden value arrives as
 * a Figure with a shape (types.ts) and `pace`, `seconds`, `month.meters`
 * arrive null; the modules here draw what they are handed and never
 * reconstruct a number ("the pace curve is meters by another name").
 *
 * Every module reads pitch and gap from `paint.tk` so the engine's shrink
 * steps reach it, draws inside its box, and returns the height it used.
 * `measure()` is the same draw under an empty clip (see `measureByDraw`),
 * so the two can never disagree by a unit. */

import { fmtDuration, fmtRowerNumber } from "@/lib/row100k";
import type {
  Figure,
  PosterBox,
  PosterChipKind,
  PosterLayout,
  PosterModule,
  PosterPaint,
  PosterPlan,
  RowerBest,
  RowerPoster,
} from "./types";
import {
  LOG_STRETCH,
  PAL,
  abbr,
  drawLog,
  drawMonth,
  drawPaceCurve,
  figureRight,
  monthLayout,
  planLog,
} from "./rowerCharts";

type Ctx = CanvasRenderingContext2D;
type Mod = PosterModule<RowerPoster>;
type Run = { text: string; color: string; font: string };

const n = (v: number) => Math.round(v).toLocaleString("en-US");

/* ----------------------------------------------------------- helpers */

/* Run a drawing under an empty clip: every fill lands nowhere, but the
 * layout still happens, so a module can learn exactly what the paint
 * helper's eyebrow or chip will take before committing to it. */
function hidden<T>(ctx: Ctx, fn: () => T): T {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, 0, 0);
  ctx.clip();
  try {
    return fn();
  } finally {
    ctx.restore();
  }
}

/* measure() = draw() with an unbounded budget, under the empty clip. The
 * chart modules override this with their fixed heights (they fill any box
 * they are handed); everything else measures what it would draw. */
function measureByDraw(draw: Mod["draw"]): NonNullable<Mod["measure"]> {
  return (ctx, box, data, fonts, paint, scale) =>
    hidden(ctx, () => draw(ctx, { ...box, h: 1e6 }, data, fonts, paint, scale));
}

function eyebrowHeight(
  ctx: Ctx,
  paint: PosterPaint,
  w: number,
  left: string,
  right?: string,
  short?: string,
) {
  return hidden(ctx, () => paint.eyebrow(ctx, 0, 0, w, left, right, short));
}

function chipWidth(ctx: Ctx, paint: PosterPaint, text: string, kind: PosterChipKind): number {
  return hidden(ctx, () => paint.chip(ctx, 0, 0, text, kind));
}

function runsWidth(ctx: Ctx, paint: PosterPaint, runs: Run[], tracking: number): number {
  return runs.reduce((w, r) => w + paint.measure(ctx, r.text, r.font, tracking), 0);
}

function drawRuns(
  ctx: Ctx,
  paint: PosterPaint,
  runs: Run[],
  x: number,
  base: number,
  tracking: number,
): number {
  let cx = x;
  for (const r of runs) {
    paint.drawText(ctx, r.text, cx, base, r.font, r.color, tracking);
    cx += paint.measure(ctx, r.text, r.font, tracking);
  }
  return cx - x;
}

/* Archivo Black fitted to a measure: the size at which `text` spans
 * `maxW` at most, capped at `cap`. Measured with the tracking it is drawn
 * with. Never fillText(maxWidth) — it condenses the glyphs. */
function fitBlack(
  ctx: Ctx,
  paint: PosterPaint,
  text: string,
  cap: number,
  maxW: number,
  trackEm: number,
): number {
  const w = paint.measure(ctx, text, paint.font("black", 100), trackEm * 100);
  return Math.min(cap, Math.floor((100 * maxW) / Math.max(1, w)));
}

const chipKind = (place: number): PosterChipKind =>
  place === 1 ? "gold" : place === 2 ? "silver" : place === 3 ? "bronze" : "outline";

const boardWord = (d: RowerPoster): string =>
  d.rower.division === "M" ? "MEN" : d.rower.division === "F" ? "WOMEN" : "";

/* "#3 of 47" | "ELITE" | "—" and its strip label (with the short form a
 * narrow cell falls back to before it ellipsizes). */
type StripCell = { v: Figure; l: string; short?: string };

function rankCell(d: RowerPoster): StripCell {
  if (d.rank === "ELITE")
    return { v: { text: "ELITE" }, l: "RANK · NO PLACES WHILE HIDDEN", short: "RANK · NO PLACES" };
  const board = boardWord(d);
  if (d.rank)
    return { v: { text: `#${d.rank.place} of ${d.rank.of}` }, l: board ? `RANK · ${board}` : "RANK" };
  return { v: { text: "—" }, l: "RANK" };
}

const untilText = (d: RowerPoster): string =>
  d.blackout.until ? `HIDDEN UNTIL ${d.blackout.until.toUpperCase()}` : "HIDDEN";

const isPhone = (paint: PosterPaint) => paint.format.family === "phone";

/* ---------------------------------------------------------- nameplate */

/* S1. "023 AVERY STONE" across the measure at 0.8 × nameCap (the number
 * gray, the name ink, one line, never wrapped), a hairline, then the
 * dateline the DATA stream built ("ROWTEMBER 2026 · MEN’S BOARD · 100K
 * CLUB · SEP 10 · DAY 10 OF 30"). The phone post and square append the
 * rank to it; a masked rower's sheet prints the blackout note as a second
 * line so it explains its own blocks. */
const nameplate: Mod = {
  id: "nameplate",
  minH: 60,
  draw(ctx, box, d, _fonts, paint) {
    const tk = paint.tk;
    const cap = tk.nameCap * 0.8;
    const num = `${fmtRowerNumber(d.rower.rowerNumber)} `;
    let name = d.rower.name.toUpperCase();
    let size = fitBlack(ctx, paint, num + name, cap, box.w, -0.02);
    if (size < cap * 0.5) {
      // A very long name: hold the floor and let the name give way.
      size = Math.floor(cap * 0.5);
      const numW = paint.measure(ctx, num, paint.font("black", size), -0.02 * size);
      name = paint.ellipsize(ctx, name, box.w - numW, paint.font("black", size), -0.02 * size);
    }
    const font = paint.font("black", size);
    const m = paint.metricsOf(ctx, font, size);
    const lh = size * 0.9;
    const base = paint.baselineOf(box.y, lh, m);
    drawRuns(
      ctx,
      paint,
      [
        { text: num, color: PAL.gray, font },
        { text: name, color: PAL.ink, font },
      ],
      box.x,
      base,
      -0.02 * size,
    );
    let y = box.y + lh + size * 0.12;
    paint.rule(ctx, box.x, y, box.w, tk.hair, PAL.ink);
    y += tk.hair + tk.datel * 0.9;
    const dfont = paint.font("monoBold", tk.datel);
    const dm = paint.metricsOf(ctx, dfont, tk.datel);
    let dateline = d.asOf.dateline;
    const key = paint.format.key;
    if ((key === "post" || key === "square") && d.rank && d.rank !== "ELITE") {
      dateline += ` · #${d.rank.place} OF ${d.rank.of}`;
    }
    const lines: { text: string; color: string; track: number }[] = [];
    const push = (text: string, color: string) => {
      for (const line of datelineLines(ctx, paint, text, box.w, dfont)) lines.push({ ...line, color });
    };
    push(dateline, PAL.inkSoft);
    if (d.blackout.active && d.masked && d.blackout.note) push(d.blackout.note, PAL.ink);
    lines.forEach((line, i) => {
      paint.drawText(ctx, line.text, box.x, y + i * tk.datel * 1.7 + dm.asc, dfont, line.color, line.track);
    });
    y += (lines.length - 1) * tk.datel * 1.7 + dm.lh;
    return y - box.y;
  },
};

/* A dateline is one line when it can be: the tracking gives first (.16em
 * → .12 → .08 — the hand-outs' measure is two glyphs short of it), and
 * only then does it break, at its own " · " joints, never mid-phrase
 * ("DAY 12 OF" / "30" was the wrap the phone produced). */
function datelineLines(
  ctx: Ctx,
  paint: PosterPaint,
  text: string,
  maxW: number,
  font: string,
): { text: string; track: number }[] {
  const datel = paint.tk.datel;
  for (const em of [0.16, 0.12, 0.08]) {
    const track = em * datel;
    if (paint.measure(ctx, text, font, track) <= maxW) return [{ text, track }];
  }
  const track = 0.12 * datel;
  const parts = text.split(" · ");
  const out: string[] = [];
  let line = "";
  for (const part of parts) {
    const next = line ? `${line} · ${part}` : part;
    if (line && paint.measure(ctx, next, font, track) > maxW) {
      out.push(line);
      line = part;
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  // A single joint-less phrase wider than the measure still has to break.
  return out.flatMap((l) =>
    paint.measure(ctx, l, font, track) > maxW
      ? paint.wrap(ctx, l, maxW, font, track).map((t) => ({ text: t, track }))
      : [{ text: l, track }],
  );
}
nameplate.measure = measureByDraw(nameplate.draw);

/* ----------------------------------------------------------- headline */

/* S2. The meters, water Archivo Black fitted to ≤ 94 % of the measure, set
 * by cap height; a masked total is its shape as ink blocks at 0.8 × the
 * size those digits would have had. Under it the label line: gray mono
 * runs with one bold ink run — the hours on the erg (or THE ELITE), then
 * the community line "OF 4,182,400 M BY 96 ROWERS" and the share. Runs
 * fall off the end until the line fits the measure. */
const headline: Mod = {
  id: "headline",
  minH: 100,
  draw(ctx, box, d, _fonts, paint) {
    const tk = paint.tk;
    const fig = d.totals.meters;
    const maxW = box.w * 0.94;
    let size: number;
    if (fig.shape !== undefined) {
      const bw = paint.blocks(ctx, 0, 0, fig.shape, 100, { paint: false });
      size = Math.min(tk.headCap * 0.8, Math.floor((100 * maxW) / Math.max(1, bw)));
    } else {
      size = fitBlack(ctx, paint, fig.text, tk.headCap, maxW, -0.01);
    }
    const base = box.y + size * 0.74;
    if (fig.shape !== undefined) paint.blocks(ctx, box.x, base, fig.shape, size, { fill: PAL.ink });
    else paint.drawText(ctx, fig.text, box.x, base, paint.font("black", size), PAL.water, -0.01 * size);

    const lf = paint.font("mono", tk.headLabel);
    const lb = paint.font("monoBold", tk.headLabel);
    const track = 0.14 * tk.headLabel;
    const gray = (text: string): Run => ({ text, color: PAL.gray, font: lf });
    const bold = (text: string): Run => ({ text, color: PAL.ink, font: lb });
    const community = ` · OF ${n(d.community.meters)} M BY ${d.community.rowers} ROWERS`;
    const post = paint.format.key === "post";
    // A rower who never times a row has "0.0 h" of erg time in the payload;
    // the sessions are the honest bold run then.
    const hours = d.totals.seconds !== null && d.totals.seconds > 0 ? d.totals.hours : null;
    const lead = d.masked
      ? bold("THE ELITE")
      : hours
        ? bold(`${hours.toUpperCase()} ON THE ERG`)
        : bold(`${d.totals.sessions} SESSION${d.totals.sessions === 1 ? "" : "S"}`);
    // Required runs first, the ones that may fall off the end last.
    const runs: Run[] = [gray("METERS · "), lead];
    if (post) {
      runs.push(gray(` · ${d.totals.sessions} SESSIONS`));
      if (d.masked) runs.push(gray(` · ${untilText(d)}`));
    } else if (d.masked) {
      runs.push(gray(` · ${untilText(d)}`), gray(community));
    } else {
      runs.push(gray(community));
      if (d.community.share !== null)
        runs.push(gray(` · ${(d.community.share * 100).toFixed(1)} % OF ROWTEMBER`));
    }
    while (runs.length > 2 && runsWidth(ctx, paint, runs, track) > box.w) runs.pop();
    if (runsWidth(ctx, paint, runs, track) > box.w) {
      const last = runs[runs.length - 1];
      const room = box.w - runsWidth(ctx, paint, runs.slice(0, -1), track);
      last.text = paint.ellipsize(ctx, last.text, room, last.font, track);
    }
    const lm = paint.metricsOf(ctx, lf, tk.headLabel);
    const ly = base + size * 0.08 + tk.headLabel * 1.2;
    drawRuns(ctx, paint, runs, box.x, ly + lm.asc, track);
    return ly + lm.lh - box.y;
  },
};
headline.measure = measureByDraw(headline.draw);

/* -------------------------------------------------------------- strip */

/* S3. The .front-stats idiom: a thick rule top and bottom, cells parted
 * by hairlines, each a black number (shrink-to-fit, floor 0.7 ×) over a
 * gray mono label. Print: SESSIONS · LONGEST ROW · AVERAGE SPLIT · RANK.
 * Story: SESSIONS (with the split in its label) · RANK. Masked: the
 * longest row as blocks, the pace tag, ELITE. */
function stripCells(d: RowerPoster, paint: PosterPaint): StripCell[] {
  const sessions: Figure = { text: String(d.totals.sessions) };
  const rank = rankCell(d);
  if (isPhone(paint)) {
    return [
      {
        v: sessions,
        l: d.totals.paceTag ? `SESSIONS · ${d.totals.paceTag} /500 AVERAGE` : "SESSIONS",
        short: d.totals.paceTag ? `SESSIONS · ${d.totals.paceTag} /500` : undefined,
      },
      rank,
    ];
  }
  const longest: StripCell =
    d.totals.longest === null
      ? { v: { text: "—" }, l: "LONGEST ROW" }
      : d.totals.longest.shape !== undefined
        ? { v: { shape: d.totals.longest.shape.replace(/\s*m$/, "") }, l: "LONGEST ROW · M" }
        : { v: { text: d.totals.longest.text }, l: "LONGEST ROW" };
  return [
    { v: sessions, l: "SESSIONS" },
    longest,
    { v: { text: d.totals.paceTag ? `${d.totals.paceTag} /500` : "—" }, l: "AVERAGE SPLIT" },
    rank,
  ];
}

const strip: Mod = {
  id: "strip",
  minH: 60,
  draw(ctx, box, d, _fonts, paint) {
    const tk = paint.tk;
    const cells = stripCells(d, paint);
    const cellW = box.w / cells.length;
    const padTop = tk.statN * 0.42;
    const cellH = padTop + tk.statN + tk.statL * 0.9 + tk.statL + tk.statN * 0.4;
    paint.rule(ctx, box.x, box.y, box.w, tk.thick, PAL.ink);
    const top = box.y + tk.thick;
    const lfont = paint.font("mono", tk.statL);
    const lm = paint.metricsOf(ctx, lfont, tk.statL);
    cells.forEach((cell, i) => {
      const x = box.x + i * cellW;
      const pad = i === 0 ? 0 : tk.statN * 0.4;
      const room = cellW - pad - tk.statN * 0.3;
      // Shrink-to-fit the number, never under 0.7 × statN.
      let size = tk.statN;
      const widthAt = (s: number) =>
        cell.v.shape !== undefined
          ? paint.blocks(ctx, 0, 0, cell.v.shape, s * 0.9, { paint: false })
          : paint.measure(ctx, cell.v.text, paint.font("black", s), -0.01 * s);
      const w0 = widthAt(size);
      if (w0 > room) size = Math.max(tk.statN * 0.7, Math.floor((size * room) / w0));
      const nfont = paint.font("black", size);
      const nm = paint.metricsOf(ctx, nfont, size);
      // The cap top sits at padTop whatever the fitted size.
      const base = top + padTop + size * 0.72 + (nm.asc - size * 0.72) * 0.02;
      if (cell.v.shape !== undefined)
        paint.blocks(ctx, x + pad, base, cell.v.shape, size * 0.9, { fill: PAL.ink });
      else paint.drawText(ctx, cell.v.text, x + pad, base, nfont, PAL.ink, -0.01 * size);
      const ltrack = 0.14 * tk.statL;
      let label = cell.l;
      if (cell.short && paint.measure(ctx, label, lfont, ltrack) > room) label = cell.short;
      label = paint.ellipsize(ctx, label, room, lfont, ltrack);
      paint.drawText(ctx, label, x + pad, base + tk.statL * 0.9 + lm.asc, lfont, PAL.gray, ltrack);
      if (i > 0) paint.rule(ctx, x - tk.hair / 2, top, tk.hair, cellH, PAL.ink);
    });
    paint.rule(ctx, box.x, top + cellH, box.w, tk.thick, PAL.ink);
    return tk.thick + cellH + tk.thick;
  },
};
strip.measure = measureByDraw(strip.draw);

/* -------------------------------------------------------------- month */

/* R4. The calendar under "THE MONTH / METERS PER DAY": the full five-row
 * grid on the wall, the elapsed weeks on a phone or a hand-out. Masked:
 * "DAYS ROWED · METERS HIDDEN" and dots. The month never grows past its
 * cell cap, so a grown row leaves the remainder as paper. */
function monthOpts(paint: PosterPaint) {
  const key = paint.format.key;
  return {
    full: paint.format.family === "printL",
    cellCap: key === "story" ? 44 : key === "post" ? 56 : undefined,
  };
}

const month: Mod = {
  id: "month",
  minH: 80,
  measure(ctx, box, d, _fonts, paint) {
    const masked = d.month.meters === null;
    const eye = eyebrowHeight(
      ctx,
      paint,
      box.w,
      "THE MONTH",
      masked ? "DAYS ROWED · METERS HIDDEN" : "METERS PER DAY",
      masked ? "DAYS ROWED" : undefined,
    );
    return eye + monthLayout(paint.tk, box.w, d.asOf.dayNumber, monthOpts(paint)).h;
  },
  draw(ctx, box, d, _fonts, paint) {
    const masked = d.month.meters === null;
    const y = paint.eyebrow(
      ctx,
      box.x,
      box.y,
      box.w,
      "THE MONTH",
      masked ? "DAYS ROWED · METERS HIDDEN" : "METERS PER DAY",
      masked ? "DAYS ROWED" : undefined,
    );
    // The engine's box is the budget (a grown phone row, or a plan that
    // spent its chart step); the grid fits its cell to it.
    const maxH = box.h >= 1e6 ? undefined : box.y + box.h - y;
    const h = drawMonth(ctx, paint, box.x, y, box.w, d.month, d.asOf.dayNumber, {
      ...monthOpts(paint),
      maxH,
    });
    return y + h - box.y;
  },
};

/* --------------------------------------------------------------- pace */

/* R5. "THE PACE / AVERAGE SPLIT · METER BY METER": the running average
 * split per session against cumulative meters (rowerCharts.drawPaceCurve).
 * Fixed 250 on printL, 200 on printS; the hand plan may grow it, capped
 * at a readable aspect, and the print fold (`paceLog`) hands it what the
 * log cannot use. Masked (`pace === null`): no curve of any kind — the
 * DogTag idiom on paper, the one figure that stays public. A rower with
 * fewer than two timed rows has neither: one gray line, and the module
 * measures at that line (a 250-unit frame around it was 3.75 inches of
 * paper above the log on the 18x24 — rowers who log meters without a
 * time are a real case). */
const PACE_H = { printL: 250, printS: 200, phone: 160 } as const;

const PACE_EYEBROW = ["THE PACE", "AVERAGE SPLIT · METER BY METER", "METER BY METER"] as const;

/* No curve and no dog tag: fewer than two timed rows on an open sheet. */
const paceUntimed = (d: RowerPoster): boolean => !d.masked && d.pace !== null && d.pace.length < 2;

const pace: Mod = {
  id: "pace",
  minH: 160,
  measure(ctx, box, d, _fonts, paint) {
    if (paceUntimed(d)) return eyebrowHeight(ctx, paint, box.w, ...PACE_EYEBROW) + paint.tk.small * 2.4;
    return PACE_H[paint.format.family];
  },
  draw(ctx, box, d, _fonts, paint) {
    const tk = paint.tk;
    const y = paint.eyebrow(ctx, box.x, box.y, box.w, ...PACE_EYEBROW);
    const small = paint.font("mono", tk.small);
    if (paceUntimed(d)) {
      paint.drawText(
        ctx,
        "TWO TIMED ROWS DRAW THE FIRST CURVE",
        box.x,
        y + tk.small * 1.6,
        small,
        PAL.gray,
        0.1 * tk.small,
      );
      return y + tk.small * 2.4 - box.y;
    }
    const chartH = Math.max(
      tk.axis * 6,
      Math.min(box.y + box.h - y, Math.max(PACE_H[paint.format.family], box.w * 0.8)),
    );
    const chart: PosterBox = { x: box.x, y, w: box.w, h: chartH };
    if (d.masked || d.pace === null) {
      // The dog tag: the pace in Archivo Black, its unit, and why it is alone.
      const tag = d.totals.paceTag;
      const tagSize = tag
        ? Math.min(tk.recV * 3.4, fitBlack(ctx, paint, tag, tk.recV * 3.4, box.w * 0.9, -0.01))
        : tk.recV * 1.4;
      const line3 = paint.wrap(
        ctx,
        `THE ONE FIGURE THAT STAYS PUBLIC · ${untilText(d)}`,
        box.w,
        small,
        0.1 * tk.small,
      );
      const blockH = tagSize * 0.74 + tk.small * 2.2 + tk.small * 1.6 + (line3.length - 1) * tk.small * 1.5;
      const cx = box.x + box.w / 2;
      let ty = chart.y + Math.max(0, (chart.h - blockH) / 2) + tagSize * 0.74;
      if (tag) paint.drawCentered(ctx, tag, cx, ty, paint.font("black", tagSize), PAL.ink, -0.01 * tagSize);
      else paint.drawCentered(ctx, "NO TIMED ROW YET", cx, ty, paint.font("black", tagSize), PAL.ink);
      ty += tk.small * 2.2;
      paint.drawCentered(ctx, "AVERAGE SPLIT · PER 500 M", cx, ty, small, PAL.gray, 0.14 * tk.small);
      ty += tk.small * 1.6;
      line3.forEach((t, i) =>
        paint.drawCentered(ctx, t, cx, ty + i * tk.small * 1.5, small, PAL.gray, 0.1 * tk.small),
      );
    } else {
      drawPaceCurve(ctx, paint, chart, d.pace);
    }
    return y + chartH - box.y;
  },
};

/* -------------------------------------------------------------- bests */

/* R6. Four rows on dashed hairlines: the label (Archivo 700) over its
 * small gray sub, the value right in mono bold, a place chip before it
 * (#1–#3 filled medals, #4+ outline gray, none when unplaced — the DATA
 * stream already nulls a masked meters best's place). Masked meters bests
 * arrive as shapes and draw as blocks + " m". */
function drawBestValue(ctx: Ctx, paint: PosterPaint, b: RowerBest, right: number, base: number): number {
  const tk = paint.tk;
  const vfont = paint.font("monoBold", tk.row);
  const vw = figureRight(ctx, paint, b.value, right, base, vfont, tk.row, PAL.ink);
  if (b.place !== null && b.place > 0) {
    const tag = `#${b.place}`;
    const kind = chipKind(b.place);
    const cw = chipWidth(ctx, paint, tag, kind);
    paint.chip(ctx, right - vw - tk.small * 0.9 - cw, base, tag, kind);
    return vw + tk.small * 0.9 + cw;
  }
  return vw;
}

const bests: Mod = {
  id: "bests",
  minH: 80,
  draw(ctx, box, d, _fonts, paint) {
    const tk = paint.tk;
    let y = paint.eyebrow(ctx, box.x, box.y, box.w, "THE BESTS", "THIS SEPTEMBER");
    const pitch = tk.rowPitch * 1.4;
    const lfont = paint.font("archivoBold", tk.row);
    const sfont = paint.font("mono", tk.small);
    d.bests.forEach((b, i) => {
      const base = y + tk.row * 1.1;
      const vw = drawBestValue(ctx, paint, b, box.x + box.w, base);
      const label = paint.ellipsize(ctx, b.label, box.w - vw - tk.row, lfont);
      paint.drawText(ctx, label, box.x, base, lfont, PAL.ink);
      const sub = paint.ellipsize(ctx, b.sub.toUpperCase(), box.w, sfont, 0.04 * tk.small);
      paint.drawText(ctx, sub, box.x, base + tk.small * 1.5, sfont, PAL.gray, 0.04 * tk.small);
      y += pitch;
      // The rule is placed from the sub-line, never above it: on the hand
      // family the pitch shrink used to walk it through "SEP 2 · 1:55.4"
      // (verify, 2026-09-10).
      if (i < d.bests.length - 1) {
        paint.dashedRule(ctx, box.x, Math.max(y - tk.small * 0.6, base + tk.small * 2.0), box.w);
      }
    });
    return y - box.y;
  },
};
bests.measure = measureByDraw(bests.draw);

/* The phone's bests: one line per best at rowPitch — label, chip, value
 * right — as many as fit (fit "lines", minimum two, else nothing). minH
 * is that two-line minimum on the phone tokens (eyebrow ≈ 33 + 2 × 26):
 * the engine's cap step zeroes a lines slot cut under it, so the row goes
 * cleanly instead of standing empty at one line. */
const bestsCompact: Mod = {
  id: "bests.compact",
  minH: 88,
  draw(ctx, box, d, _fonts, paint) {
    const tk = paint.tk;
    const eyeH = eyebrowHeight(ctx, paint, box.w, "THE BESTS", "THIS SEPTEMBER");
    // Half a unit of tolerance: a box handed back at exactly the measured
    // height read as 3.9999 lines and drew three (Integrate, the square).
    const lines = Math.min(d.bests.length, Math.floor((box.h + 0.5 - eyeH) / tk.rowPitch));
    if (lines < Math.min(2, d.bests.length)) return 0;
    let y = paint.eyebrow(ctx, box.x, box.y, box.w, "THE BESTS", "THIS SEPTEMBER");
    const lfont = paint.font("archivoBold", tk.row);
    const rm = paint.metricsOf(ctx, paint.font("mono", tk.row), tk.row);
    for (let i = 0; i < lines; i++) {
      const b = d.bests[i];
      const base = y + (tk.rowPitch - rm.lh) / 2 + rm.asc;
      const vw = drawBestValue(ctx, paint, b, box.x + box.w, base);
      paint.drawText(
        ctx,
        paint.ellipsize(ctx, b.label, box.w - vw - tk.row, lfont),
        box.x,
        base,
        lfont,
        PAL.ink,
      );
      y += tk.rowPitch;
      if (i < lines - 1) paint.dashedRule(ctx, box.x, y - 0.5, box.w);
    }
    return y - box.y;
  },
};
bestsCompact.measure = measureByDraw(bestsCompact.draw);

/* ------------------------------------------------------------- ledger */

/* R7. The .bl ledger — a thick rule, then KEY ······ VALUE lines: TIME
 * ROWED · METERS A DAY · SHARE OF EVERYTHING · EVERYONE. Masked: SESSIONS
 * · DAYS ROWED · AVERAGE SPLIT · EVERYONE — no time (with the split
 * public, time is the total by another route), no per-day, no share. */
function ledgerItems(d: RowerPoster): { k: string; v: string }[] {
  const everyone = { k: "EVERYONE", v: `${abbr(d.community.meters)} · ${d.community.rowers} ROWERS` };
  if (d.masked) {
    return [
      { k: "SESSIONS", v: String(d.totals.sessions) },
      { k: "DAYS ROWED", v: String(d.totals.daysRowed) },
      { k: "AVERAGE SPLIT", v: d.totals.paceTag ? `${d.totals.paceTag} /500M` : "—" },
      everyone,
    ];
  }
  return [
    { k: "TIME ROWED", v: d.totals.seconds ? fmtDuration(d.totals.seconds) : "—" },
    { k: "METERS A DAY", v: d.totals.metersADay !== null ? `${n(d.totals.metersADay)} M` : "—" },
    {
      k: "SHARE OF EVERYTHING",
      v: d.community.share !== null ? `${(d.community.share * 100).toFixed(1)} %` : "—",
    },
    everyone,
  ];
}

const ledger: Mod = {
  id: "ledger",
  minH: 40,
  draw(ctx, box, d, _fonts, paint) {
    const tk = paint.tk;
    const items = ledgerItems(d);
    paint.rule(ctx, box.x, box.y, box.w, tk.thick, PAL.ink);
    const y = box.y + tk.thick + tk.ledger * 0.8;
    const kf = paint.font("mono", tk.ledger);
    const vf = paint.font("monoBold", tk.ledger);
    const track = 0.1 * tk.ledger;
    const right = box.x + box.w;
    items.forEach((it, i) => {
      const base = y + i * tk.ledgerPitch + tk.ledger;
      const vw = paint.measure(ctx, it.v, vf, track);
      paint.drawRight(ctx, it.v, right, base, vf, PAL.ink, track);
      const key = paint.ellipsize(ctx, it.k, box.w - vw - tk.ledger * 2, kf, track);
      paint.drawText(ctx, key, box.x, base, kf, PAL.inkSoft, track);
      const kw = paint.measure(ctx, key, kf, track);
      paint.dottedRule(
        ctx,
        box.x + kw + tk.ledger * 0.6,
        right - vw - tk.ledger * 0.6,
        base - tk.ledger * 0.05,
      );
    });
    return tk.thick + tk.ledger * 0.8 + items.length * tk.ledgerPitch;
  },
};
ledger.measure = measureByDraw(ledger.draw);

/* ---------------------------------------------------------------- log */

/* R8. "THE LOG / 14 SESSIONS · EVERY ROW" — every row newest first, in as
 * many log-columns as the box holds, stepping the type down once before
 * it caps with "+ N MORE" (rowerCharts.planLog). A cap slot: the engine
 * hands the room and this returns no more than it. Handed more than its
 * rows need, it opens its pitch toward the box (LOG_STRETCH) rather than
 * leave a band of paper under its last row. Cut so tight that a
 * log-column holds ONE row under "+ N MORE", it draws nothing at all: a
 * header, one row and "+ 39 MORE" was noise on the letter hand-out. */
function logEyebrow(d: RowerPoster): [string, string, string] {
  const count = d.log.length;
  return ["THE LOG", `${count} SESSION${count === 1 ? "" : "S"} · EVERY ROW`, "EVERY ROW"];
}

function drawLogModule(
  ctx: Ctx,
  box: PosterBox,
  d: RowerPoster,
  paint: PosterPaint,
  stretch = LOG_STRETCH,
): number {
  const tk = paint.tk;
  const eye = logEyebrow(d);
  if (d.log.length === 0) {
    const y = paint.eyebrow(ctx, box.x, box.y, box.w, ...eye);
    paint.drawText(
      ctx,
      "NO ROWS LOGGED YET",
      box.x,
      y + tk.small * 1.6,
      paint.font("mono", tk.small),
      PAL.gray,
      0.1 * tk.small,
    );
    return y + tk.small * 2.4 - box.y;
  }
  const rows = [...d.log].reverse();
  // An unbounded box is the engine measuring: report the compact
  // multi-column height, never the one-column one (planLog).
  const measuring = box.h >= 1e6;
  const eyeH = eyebrowHeight(ctx, paint, box.w, ...eye);
  const room = measuring ? Number.POSITIVE_INFINITY : box.h - eyeH;
  const plan = planLog(ctx, paint, box.w, rows, room, d.masked, measuring, measuring ? 1 : stretch);
  // A capped log with a single row per column is not a log.
  if (plan.more > 0 && plan.perCol < 2) return 0;
  const y = paint.eyebrow(ctx, box.x, box.y, box.w, ...eye);
  const h = drawLog(ctx, paint, box.x, y, box.w, rows, plan, d.masked);
  return y + h - box.y;
}

/* minH is the floor the engine's `cap` step cuts the hand plan's log row
 * to (§8.4): eyebrow + header + two small-step rows on the hand-outs at
 * the pitch step (38 + 23 + 2 × 22 ≈ 105), so a capped log always shows
 * two rows a column or goes to nothing through the terminal path — never
 * a box that holds one row and "+ N MORE" (which draws nothing and would
 * have stood as paper above the footer). */
const log: Mod = {
  id: "log",
  minH: 106,
  draw(ctx, box, d, _fonts, paint) {
    return drawLogModule(ctx, box, d, paint);
  },
};
log.measure = measureByDraw(log.draw);

/* The wide column of the print plan, folded: THE PACE over THE LOG in one
 * cap slot, so the pace takes what the log cannot use. A stack gave the
 * log everything under a fixed pace, and the log drew only what its rows
 * needed — on the 24x36 at day 12 its last row sat 7.2 inches above the
 * footer rule. Here the log is planned first at the room the pace's
 * minimum leaves (the rung that fits, or the cap); the pace then grows
 * into what is left, up to PACE_CAP_W of its width (0.6 × 706 on the
 * wall = a 14 × 8 in chart, the graphic of the sheet — past that a
 * mid-month curve is a thin band in a big frame); and the log opens its
 * pitch toward whatever is still over (LOG_STRETCH), which at day 12 on
 * the 24x36 leaves ~40 units, inside the 1.5 × gap the SPEC allows. A dog
 * tag grows the same way (it is centred); the untimed line does not.
 * measure() is pace + gap + the log's compact height, so the engine's
 * drop and shrink arithmetic is the stack's; the `cap` step lands on this
 * slot and the log inside it caps. */
const PACE_CAP_W = 0.6;

const paceLog: Mod = {
  id: "paceLog",
  minH: 300,
  measure(ctx, box, d, fonts, paint, scale) {
    const p = pace.measure ? pace.measure(ctx, box, d, fonts, paint, scale) : pace.minH;
    const l = log.measure ? log.measure(ctx, box, d, fonts, paint, scale) : log.minH;
    return p + paint.tk.gap + l;
  },
  draw(ctx, box, d, fonts, paint, scale) {
    const gap = paint.tk.gap;
    const paceMin = pace.measure ? pace.measure(ctx, box, d, fonts, paint, scale) : pace.minH;
    // The log at its natural height in the room the pace's minimum leaves.
    const logRoom = box.h - gap - paceMin;
    const logH =
      logRoom > 0 ? hidden(ctx, () => drawLogModule(ctx, { ...box, y: 0, h: logRoom }, d, paint, 1)) : 0;
    const paceCap = paceUntimed(d) ? paceMin : Math.max(paceMin, box.w * PACE_CAP_W);
    const paceH = Math.min(box.h, Math.min(paceCap, Math.max(paceMin, box.h - gap - logH)));
    const usedPace = pace.draw(ctx, { ...box, h: paceH }, d, fonts, paint, scale);
    if (logH <= 0) return usedPace;
    // The log again in the room the grown pace leaves — the same rung (the
    // room is between its natural height and the room it was planned
    // in), the pitch opened toward the box.
    const ly = box.y + paceH + gap;
    const usedLog = drawLogModule(ctx, { x: box.x, y: ly, w: box.w, h: box.y + box.h - ly }, d, paint);
    return usedLog > 0 ? ly + usedLog - box.y : usedPace;
  },
};

/* -------------------------------------------------------------- plate */

/* S14. The partner ad box on the Grizzly green — the only dark surface on
 * the sheet, because the wordmark is gold and white and never sits on
 * paper. STACK when the slot is tall enough, COMPACT under that, nothing
 * under ~110 (the plan drops it first anyway). Phone formats never carry
 * it — the footer's third line does.
 *
 * It ASKS for the stack only on the 24x36: with the wall month drawn as
 * the full five-row grid, the 18x24's side column holds month + bests +
 * ledger + a stacked plate seven units short of the budget, and the plan
 * would drop the plate for those seven units. So the short and squat
 * sheets ask for the compact plate and keep it.
 *
 * It is PINNED to the foot of the side column: the plan names it the
 * stack's grow member, so the engine hands it the column's extra, and it
 * paints its fixed-height box at the bottom of that — the air of a short
 * month sits between the ledger and the ad, the way the front page parks
 * its ad in the bottom-right corner, and the column closes on the footer
 * with the log. */
function plateStackH(paint: PosterPaint): number {
  const tk = paint.tk;
  return (
    tk.ledger * 1.4 * 2 +
    tk.small * 2.4 +
    tk.ledger * 3.4 +
    tk.ledger * 1.6 +
    tk.small * 1.6 +
    tk.recV * 1.05 * 1.15 +
    tk.small * 1.6
  );
}
function plateCompactH(paint: PosterPaint): number {
  const tk = paint.tk;
  return (
    tk.ledger * 1.4 * 0.9 * 2 +
    tk.ledger * 2.6 +
    tk.ledger * 1.1 +
    tk.small * 1.5 +
    tk.ledger * 1.7 * 1.05 +
    tk.small * 1.4
  );
}

const plate: Mod = {
  id: "plate",
  minH: 110,
  measure(_ctx, _box, d, _fonts, paint) {
    if (!d.partner) return 0;
    return paint.format.plan === "tall" ? plateStackH(paint) : plateCompactH(paint);
  },
  draw(ctx, box, d, _fonts, paint) {
    const tk = paint.tk;
    const p = d.partner;
    if (!p) return 0;
    const stackH = plateStackH(paint);
    const compactH = plateCompactH(paint);
    if (box.h < compactH) return 0;
    const layout = box.h >= stackH ? "stack" : "compact";
    const h = layout === "stack" ? stackH : compactH;
    // The foot of the box; whatever the engine handed over that is air above.
    const top = box.y + box.h - h;
    ctx.fillStyle = PAL.gzGreen;
    ctx.fillRect(box.x, top, box.w, h);
    ctx.save();
    ctx.strokeStyle = PAL.gzDark;
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x + 1, top + 1, box.w - 2, h - 2);
    ctx.restore();
    const cx = box.x + box.w / 2;
    const { bear, wordmark } = paint.assets;
    const ratio = (img: HTMLImageElement | null, fallback: number) =>
      img && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : fallback;
    const marks = (y: number, markH: number, gapM: number) => {
      const bearW = ratio(bear, 0.95) * markH;
      const wmH = markH * 0.5;
      const wmW = ratio(wordmark, 6.9) * wmH;
      let x = cx - (bearW + gapM + wmW) / 2;
      paint.image(ctx, bear, x, y, bearW, markH);
      x += bearW + gapM;
      paint.image(ctx, wordmark, x, y + (markH - wmH) / 2, wmW, wmH);
    };
    const smallF = paint.font("mono", tk.small);
    const deal = paint.ellipsize(ctx, p.deal.toUpperCase(), box.w - tk.ledger * 2, smallF, 0.12 * tk.small);
    if (layout === "stack") {
      const pad = tk.ledger * 1.4;
      let y = top + pad;
      paint.drawCentered(
        ctx,
        `ROWTEMBER ${d.year} · PARTNER`,
        cx,
        y + tk.small,
        smallF,
        PAL.gzSage,
        0.22 * tk.small,
      );
      y += tk.small * 2.4;
      const markH = tk.ledger * 3.4;
      marks(y, markH, tk.ledger * 1.2);
      y += markH + tk.ledger * 1.6;
      paint.drawCentered(ctx, "THE CODE", cx, y + tk.small, smallF, PAL.gzSage, 0.22 * tk.small);
      y += tk.small * 1.6;
      const codeS = tk.recV * 1.05;
      paint.drawCentered(
        ctx,
        p.code.toUpperCase(),
        cx,
        y + codeS * 0.86,
        paint.font("black", codeS),
        PAL.gzGold,
        0.02 * codeS,
      );
      y += codeS * 1.15;
      paint.drawCentered(ctx, deal, cx, y + tk.small, smallF, PAL.gzCream, 0.12 * tk.small);
    } else {
      const pad = tk.ledger * 1.4 * 0.9;
      let y = top + pad;
      const markH = tk.ledger * 2.6;
      marks(y, markH, tk.ledger);
      y += markH + tk.ledger * 1.1;
      const s9 = paint.font("mono", tk.small * 0.9);
      paint.drawCentered(ctx, "THE CODE", cx, y + tk.small * 0.9, s9, PAL.gzSage, 0.22 * tk.small);
      y += tk.small * 1.5;
      const codeS = tk.ledger * 1.7;
      paint.drawCentered(
        ctx,
        p.code.toUpperCase(),
        cx,
        y + codeS * 0.8,
        paint.font("black", codeS),
        PAL.gzGold,
        0.02 * codeS,
      );
      y += codeS * 1.05;
      paint.drawCentered(ctx, deal, cx, y + tk.small * 0.9, s9, PAL.gzCream, 0.08 * tk.small);
    }
    // The box is spent whole: the plate at its foot, the air above it.
    return box.h;
  },
};

/* ------------------------------------------------------------- footer */

/* S15. A thick rule, MIKIAN MUSSER, the URL and the handle, then "for
 * yourself and others" on print or the partner line on a phone. Pinned to
 * the bottom margin by the engine; everything left, nothing on the right. */
function footerH(paint: PosterPaint): number {
  return paint.tk.thick + paint.tk.footer * 6.4;
}

const footer: Mod = {
  id: "footer",
  minH: 40,
  measure(_ctx, _box, _d, _fonts, paint) {
    return footerH(paint);
  },
  draw(ctx, box, d, _fonts, paint) {
    const tk = paint.tk;
    const f = tk.footer;
    paint.rule(ctx, box.x, box.y, box.w, tk.thick, PAL.ink);
    let y = box.y + tk.thick + f * 1.6;
    paint.drawText(ctx, "MIKIAN MUSSER", box.x, y + f * 0.85, paint.font("black", f), PAL.ink, 0.1 * f);
    y += f * 1.9;
    const mf = paint.font("mono", f * 0.92);
    const line2 = paint.ellipsize(ctx, `${d.url.toUpperCase()}  ·  @MIKIAN_`, box.w, mf, 0.06 * f);
    paint.drawText(ctx, line2, box.x, y + f * 0.85, mf, PAL.gray, 0.06 * f);
    y += f * 1.8;
    const third =
      isPhone(paint) && d.partner ? d.partner.footerLine.toUpperCase() : "for yourself and others";
    const track = isPhone(paint) && d.partner ? 0.06 * f : 0.02 * f;
    paint.drawText(
      ctx,
      paint.ellipsize(ctx, third, box.w, mf, track),
      box.x,
      y + f * 0.85,
      mf,
      PAL.gray,
      track,
    );
    return footerH(paint);
  },
};

/* ================================================================ plans */

/* SPEC §7 "Rower". One print plan under every printL key: two FLOWS, not
 * rows — the side stack stacks down from the row's top with the plate
 * pinned to its foot (grow: "plate"), and the wide column is the pace +
 * log fold, which hands the pace what the log cannot use, so a short
 * month never leaves a hole and BOTH columns close on the footer. The
 * plate is the first thing to yield; then gaps, pitch, the log's type
 * step, its cap (the fold is the cap slot; the log inside it caps). */
const printPlan = (key: PosterPlan["key"]): PosterPlan => ({
  key,
  cols: 3,
  rows: [
    { id: "nameplate", slots: [{ module: "nameplate", span: 3 }] },
    { id: "headline", slots: [{ module: "headline", span: 3 }] },
    { id: "strip", slots: [{ module: "strip", span: 3 }] },
    {
      id: "body",
      grow: 1,
      slots: [
        { stack: ["month", "bests", "ledger", "plate"], span: 1, grow: "plate" },
        { module: "paceLog", span: 2, fit: "cap" },
      ],
    },
  ],
  footer: "footer",
  drop: ["plate"],
  shrink: ["gap", "pitch", "step", "cap"],
});

/* The hand-out (11x17, A3, letter, A4): the whole profile above the log,
 * the pace grown to level the two stacks, the log capped on what is left.
 * The body row is the second grow row so that any slack the log row
 * cannot take goes to the pace rather than the gap above the footer —
 * inert while the log row has no maxH (it takes every unit first), kept
 * so the order is stated if the engine ever lets a slot decline a box. */
const hand: PosterPlan = {
  key: "hand",
  cols: 2,
  rows: [
    { id: "nameplate", slots: [{ module: "nameplate", span: 2 }] },
    {
      id: "body",
      grow: 2,
      slots: [
        { stack: ["headline", "ledger", "bests"], span: 1 },
        { stack: ["month", "pace"], span: 1, grow: "pace" },
      ],
    },
    { id: "log", grow: 1, slots: [{ module: "log", span: 2, fit: "cap" }] },
  ],
  footer: "footer",
  shrink: ["gap", "pitch", "step", "cap"],
};

/* The story: the month made big (cell ≤ 44) over the bests; the post the
 * same without the strip (cell ≤ 56, the rank in the dateline, the hours
 * and sessions in the headline label); the square the bests alone.
 *
 * The SPEC wrote these as `drop bests.compact; shrink gap, chart`, but
 * the engine spends the drop list BEFORE any shrink step (§8.3), so the
 * bests would go whole on any day the sheet ran a few units over and the
 * grown month would leave the room as paper — the "lines" fit never got
 * its turn. So: no drop; `gap`, then `chart` (the month to its small
 * cell), then `cap` (the bests to the lines that fit, two at least, else
 * the row goes). The month yields before the bests (SPEC §14.9): under a
 * window mid-month a masked nameplate is two lines taller, and with the
 * bests yielding first the story was the DAYS ROWED dots over eighty
 * units of paper — the two public time bests (a 5k with its place, a 10k)
 * are what an elite rower has to share during the blackout. The cost is
 * a FINAL open story with the five-row month at a smaller cell over the
 * bests instead of alone at its cap. One array each to swap back. */
const story: PosterPlan = {
  key: "story",
  cols: 2,
  rows: [
    { id: "nameplate", slots: [{ module: "nameplate", span: 2 }] },
    { id: "headline", slots: [{ module: "headline", span: 2 }] },
    { id: "strip", slots: [{ module: "strip", span: 2 }] },
    { id: "month", grow: 1, slots: [{ module: "month", span: 2 }] },
    { id: "bests", slots: [{ module: "bests.compact", span: 2, fit: "lines" }] },
  ],
  footer: "footer",
  shrink: ["gap", "chart", "cap"],
};

const post: PosterPlan = {
  key: "post",
  cols: 2,
  rows: [
    { id: "nameplate", slots: [{ module: "nameplate", span: 2 }] },
    { id: "headline", slots: [{ module: "headline", span: 2 }] },
    { id: "month", grow: 1, slots: [{ module: "month", span: 2 }] },
    { id: "bests", slots: [{ module: "bests.compact", span: 2, fit: "lines" }] },
  ],
  footer: "footer",
  shrink: ["gap", "chart", "cap"],
};

/* The square carries `cap` too: a masked nameplate is three lines (the
 * dateline and the blackout note), which put the four bests twenty units
 * over — without the cap step the terminal plan zeroes the whole slot
 * rather than show three lines. */
const square: PosterPlan = {
  key: "square",
  cols: 2,
  rows: [
    { id: "nameplate", slots: [{ module: "nameplate", span: 2 }] },
    { id: "headline", slots: [{ module: "headline", span: 2 }] },
    { id: "bests", slots: [{ module: "bests.compact", span: 2, fit: "lines" }] },
  ],
  footer: "footer",
  shrink: ["gap", "cap"],
};

export const rowerLayout: PosterLayout<RowerPoster> = {
  subject: "rower",
  modules: {
    nameplate,
    headline,
    strip,
    month,
    pace,
    bests,
    "bests.compact": bestsCompact,
    ledger,
    log,
    paceLog,
    plate,
    footer,
  },
  plans: {
    tall: printPlan("tall"),
    short: printPlan("short"),
    squat: printPlan("squat"),
    hand,
    story,
    post,
    square,
  },
};
