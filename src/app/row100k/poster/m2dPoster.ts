/* poster/m2dPoster.ts — THE M2D POSTER (owner, 2026-11-26: "The other
 * poster I need is one for M2D. I need an M2D poster.").
 *
 * The Concept2 Holiday Challenge window, Nov 26 - Dec 24, on the same sheet
 * the ROWTEMBER poster is: the nameplate on a hairline, the mono dateline,
 * the lead number in the accent, the bracketed strip, then columns under
 * one-line eyebrows. Nothing here is new drawing: the nameplate, the
 * headline, the strip, the calendar, the ledger and the footer are
 * charts.ts's, so the two sheets hang together on a wall and in a feed.
 *
 *   masthead   M2D 2026, the 2 in the accent (the M2D mark's own idiom),
 *              and HOLIDAY CHALLENGE · NOV 26 – DEC 24 · DAY N OF 29
 *   headline   everything raised: Concept2's, ROWTEMBER's and the pledges
 *   strip      meters, rowers, past 100K, the day (the phone: meters
 *              and the parts of the lead number)
 *   you        a rower's own meters and dollars (their poster only)
 *   window     the 29 days, everyone's meters per day
 *   charities  ROWTEMBER's part and the pledges, by the charity picked
 *   sources    where it comes from: CONCEPT2, ROWTEMBER MATCH, PLEDGES
 *              (the wall sheets)
 *
 * NO GOAL, NO GOAL BAR AND NO CAP on any sheet (owner, 2026-11-25: "no cap
 * shown"); no address, no handle (owner, 2026-10-14). PURE: no db. */

import { fmtRowerNumber } from "@/lib/row100k";
import { drawFooter, drawHours, drawHeadline, drawLedger, drawMonth, drawNameplate, drawStrip, silently, type Run, type StripCell } from "./charts";
import type { Figure, M2dPoster, PosterBox, PosterLayout, PosterModule, PosterPaint, PosterPlan, PosterTakeaway } from "./types";

type Ctx = CanvasRenderingContext2D;
type Mod = PosterModule<M2dPoster>;
type Draw = (ctx: Ctx, box: PosterBox, d: M2dPoster, paint: PosterPaint) => number;

/* community.ts's `mod`: a module whose measure is its draw under an empty
 * clip, so the budget and the ink can never disagree. */
function mod(id: string, minH: number, draw: Draw): Mod {
  return {
    id,
    minH,
    measure: (ctx, box, d, _fonts, paint) => silently(ctx, () => draw(ctx, box, d, paint)),
    draw: (ctx, box, d, _fonts, paint) => draw(ctx, box, d, paint),
  };
}

const isPhone = (paint: PosterPaint) => paint.format.family === "phone";
const n = (v: number) => Math.round(v).toLocaleString("en-US");
export const usd = (d: number) => `$${d.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* M2D 2026, the 2 of M2D in the accent like the M2D mark on the stickers
 * (share/cards.ts drawM2d: "one blue per lockup: the 2 carries it"). */
const masthead = mod("masthead", 60, (ctx, box, d, paint) => {
  const runs: Run[] = [
    { text: "M", color: paint.c.ink },
    { text: "2", color: paint.c.water },
    { text: `D ${d.asOf.year}`, color: paint.c.ink },
  ];
  return drawNameplate(ctx, paint, box, runs, d.asOf.dateline, null, paint.tk.nameCap);
});

/* The lead number is THE figure the M2D page prints big: everything raised. */
const headline = mod("headline", 100, (ctx, box, d, paint) => {
  const bold = paint.font("monoBold", paint.tk.headLabel);
  const label: Run[] = [
    { text: "RAISED · ", color: paint.c.gray },
    { text: "FOR CHARITY", color: paint.c.ink, font: bold },
    { text: ` · ${n(d.totals.rowers)} ROWERS`, color: paint.c.gray },
  ];
  return drawHeadline(ctx, paint, box, { text: usd(d.totals.total) }, label, paint.tk.headCap);
});

/* The wall sheets: meters, rowers, past 100K and the day, with the parts
 * of the lead number on the ledger along the foot. A phone frame has no
 * room for that ledger, so its strip IS the parts (the brief, 2026-11-26:
 * "total raised (Concept2 + ROWTEMBER match + pledges)"): the meters, then
 * CONCEPT2 and ROWTEMBER, and PLEDGES once there is one; the rowers ride on
 * the headline's label. */
const strip = mod("strip", 60, (ctx, box, d, paint) => {
  const cells: StripCell[] = isPhone(paint)
    ? [
        { n: { text: n(d.totals.meters) }, l: "Meters" },
        { n: { text: usd(d.totals.concept2) }, l: "Concept2" },
        { n: { text: usd(d.totals.rowtember) }, l: "ROWTEMBER" },
        ...(d.totals.pledges > 0 ? [{ n: { text: usd(d.totals.pledges) }, l: "Pledges" }] : []),
      ]
    : [
        { n: { text: n(d.totals.meters) }, l: "Meters" },
        { n: { text: n(d.totals.rowers) }, l: "Rowers" },
        { n: { text: n(d.totals.past100k) }, l: "Past 100K" },
        { n: { text: d.asOf.dayNumber > 0 ? `${d.asOf.dayNumber}/${d.asOf.days}` : "—" }, l: d.asOf.final ? "Days, final" : "Day" },
      ];
  return drawStrip(ctx, paint, box, cells);
});

/* A ROWER'S OWN LINE (the brief, 2026-11-26: "for a rower's version their
 * own meters and dollars"): their number and name on the eyebrow, their
 * meters in ink at the left and their dollars in the accent at the right.
 * A rower the M2D board hides gets blocks for both, as the board prints. */
const you = mod("you", 60, (ctx, box, d, paint) => {
  const me = d.me;
  if (!me) return 0;
  const { tk, c } = paint;
  let y = paint.eyebrow(ctx, box.x, box.y, box.w, "Your M2D", `${fmtRowerNumber(me.rowerNumber)} ${me.name}`);
  const size = tk.statN * 1.15;
  const f = paint.font("black", size);
  const base = y + size * 0.74;
  const fig = (v: Figure, x: number, color: string, right: boolean) => {
    if (v.shape !== undefined) {
      const w = paint.blocks(ctx, 0, 0, v.shape, size * 0.9, { paint: false });
      paint.blocks(ctx, right ? x - w : x, base, v.shape, size * 0.9, { fill: c.ink });
      return;
    }
    if (right) paint.drawRight(ctx, v.text, x, base, f, color, -0.01 * size);
    else paint.drawText(ctx, v.text, x, base, f, color, -0.01 * size);
  };
  const meters: Figure = me.meters.shape !== undefined ? { shape: `${me.meters.shape} M` } : { text: `${me.meters.text} M` };
  fig(meters, box.x, c.ink, false);
  fig(me.dollars, box.x + box.w, c.water, true);
  y = base + tk.statL * 1.3;
  const lf = paint.font("mono", tk.statL);
  const lm = paint.metricsOf(ctx, lf, tk.statL);
  const tr = 0.14 * tk.statL;
  paint.drawText(ctx, "METERS ROWED", box.x, y + lm.asc, lf, c.gray, tr);
  paint.drawRight(ctx, "RAISED", box.x + box.w, y + lm.asc, lf, c.gray, tr);
  return y + lm.lh - box.y;
});

/* THE WINDOW: the 29 days as the calendar the ROWTEMBER sheet draws (the
 * whole grid, so the days still to come read as boxes to fill), everyone's
 * meters per day. Its cell follows the box the engine hands it, as
 * community.ts's month does. */
const PHONE_CELL = 40;
/* On a phone frame the grid is the weeks so far, as the ROWTEMBER phone
 * month is (community.ts `month`); the wall sheets draw all 29 days. */
const windowGrid: Mod = (() => {
  const shownOf = (d: M2dPoster, paint: PosterPaint) => (isPhone(paint) ? Math.max(1, Math.min(d.asOf.days, d.asOf.dayNumber)) : d.asOf.days);
  const rowsOf = (d: M2dPoster, paint: PosterPaint) => Math.ceil((shownOf(d, paint) + d.asOf.firstDow) / 7);
  const head = (ctx: Ctx, paint: PosterPaint, w: number) =>
    silently(ctx, () => paint.eyebrow(ctx, 0, 0, w, "X", "X")) + paint.tk.small * 1.9;
  const wideCell = (paint: PosterPaint, w: number) => (w - paint.tk.small * 0.7 * 6) / 7;
  return {
    id: "window",
    minH: 80,
    measure: (ctx, box, d, _fonts, paint) => {
      const gap = paint.tk.small * 0.7;
      const wide = wideCell(paint, box.w);
      const cell = isPhone(paint) ? Math.min(wide, PHONE_CELL) : wide;
      const rows = rowsOf(d, paint);
      return head(ctx, paint, box.w) + rows * cell + (rows - 1) * gap;
    },
    draw: (ctx, box, d, _fonts, paint) => {
      const tk = paint.tk;
      const gap = tk.small * 0.7;
      const rows = rowsOf(d, paint);
      let cell = wideCell(paint, box.w);
      if (Number.isFinite(box.h) && box.h > 0) {
        const fit = (box.h - head(ctx, paint, box.w) - (rows - 1) * gap) / rows;
        cell = Math.max(tk.small * 1.5, Math.min(cell, fit));
      }
      return drawMonth(ctx, paint, box, {
        eyebrow: { left: "Nov 26 – Dec 24", right: "Meters per day", short: "Meters" },
        meters: d.byDay,
        dayNumber: Math.max(1, d.asOf.dayNumber),
        days: d.asOf.days,
        firstDow: d.asOf.firstDow,
        firstDay: d.asOf.firstDay,
        full: !isPhone(paint),
        buckets: "quartile",
        cellCap: cell,
      });
    },
  };
})();

/* WHEN M2D ROWS, WHERE THE CHARITIES WERE (owner, 2026-11-26: "I don't
 * want to list the charities ... I don't want it to be super empty"; of a
 * list of figures there: "I don't know if I like those numbers ... What
 * else do we show here"; the curve was off the table, "the curve needs to
 * go", 2026-09-10): everyone's rows by the hour they were logged, the
 * chart the month's poster keeps. A fixed row, as there. */
const numbers: Mod = {
  id: "numbers",
  minH: 60,
  measure: (ctx, box, d, _fonts, paint) => (d.hours ? (paint.format.family === "printL" ? 170 : 120) : silently(ctx, () => drawHours(ctx, paint, box, null))),
  draw: (ctx, box, d, _fonts, paint) => drawHours(ctx, paint, box, d.hours),
};

/* WHERE IT COMES FROM: the three parts of the lead number on the dotted
 * ledger. PLEDGES only once there is one. */
const sourcesOf = (d: M2dPoster): PosterTakeaway[] => {
  const k = "avgRow" as PosterTakeaway["key"];
  const items: PosterTakeaway[] = [
    { key: k, label: "Concept2", value: usd(d.totals.concept2) },
    { key: k, label: "ROWTEMBER match", value: usd(d.totals.rowtember) },
  ];
  if (d.totals.pledges > 0) items.push({ key: k, label: "Pledges", value: usd(d.totals.pledges) });
  return items;
};
const sources = mod("sources", 40, (ctx, box, d, paint) => {
  const y = paint.eyebrow(ctx, box.x, box.y, box.w, "Where it comes from");
  const items = sourcesOf(d);
  const used = drawLedger(ctx, paint, { x: box.x, y, w: box.w, h: Number.POSITIVE_INFINITY }, items, { max: items.length, min: items.length });
  return y + used - box.y;
});

const footer = mod("footer", 40, (ctx, box, _d, paint) => drawFooter(ctx, paint, box));

/* ------------------------------------------------------------- plans */

/* The wall sheets: the window across the full measure (the picture of the
 * sheet, as the month is on the ROWTEMBER one), then the charities beside
 * the sources along the foot. The window takes the slack and is the slot
 * that gives when a shorter sheet is out of room. */
const printRows = [
  { id: "A", slots: [{ module: "masthead", span: 3 as const }] },
  { id: "B", slots: [{ module: "headline", span: 3 as const }] },
  { id: "C", slots: [{ module: "strip", span: 3 as const }] },
  { id: "Y", slots: [{ module: "you", span: 3 as const }] },
  { id: "D", grow: 1, slots: [{ module: "window", span: 3 as const, fit: "cap" as const }] },
  {
    id: "E",
    slots: [
      { module: "numbers", span: 2 as const },
      { module: "sources", span: 1 as const },
    ],
  },
];
const printPlan = (key: PosterPlan["key"], next?: PosterPlan["key"]): PosterPlan => ({
  key,
  cols: 3,
  rows: printRows,
  footer: "footer",
  shrink: ["gap", "cap"],
  ...(next ? { next } : {}),
});

/* The phone: one full-width column, the parts of the lead number on the
 * strip. The story carries the window and the charities; the post lets
 * the window go when it is out of room; the square is the number, the
 * strip and the charities. */
const top2 = [
  { id: "A", slots: [{ module: "masthead", span: 2 as const }] },
  { id: "B", slots: [{ module: "headline", span: 2 as const }] },
  { id: "C", slots: [{ module: "strip", span: 2 as const }] },
  { id: "Y", slots: [{ module: "you", span: 2 as const }] },
];
const story: PosterPlan = {
  key: "story",
  cols: 2,
  rows: [
    ...top2,
    { id: "D", grow: 1, slots: [{ module: "window", span: 2, fit: "cap" }] },
    { id: "E", slots: [{ module: "numbers", span: 2 }] },
  ],
  footer: "footer",
  shrink: ["gap", "cap"],
};
const post: PosterPlan = {
  key: "post",
  cols: 2,
  rows: [
    ...top2,
    { id: "D", grow: 1, slots: [{ module: "window", span: 2, fit: "cap" }] },
    { id: "E", slots: [{ module: "numbers", span: 2 }] },
  ],
  footer: "footer",
  drop: ["window"],
  shrink: ["gap", "cap"],
};
const square: PosterPlan = {
  key: "square",
  cols: 2,
  rows: [...top2, { id: "E", grow: 1, slots: [{ module: "numbers", span: 2 }] }],
  footer: "footer",
  drop: ["you"],
  shrink: ["gap"],
};

export const m2dLayout: PosterLayout<M2dPoster> = {
  subject: "m2d",
  modules: { masthead, headline, strip, you, window: windowGrid, numbers, sources, footer },
  plans: {
    tall: printPlan("tall", "short"),
    short: printPlan("short", "squat"),
    squat: printPlan("squat", "core"),
    core: { ...printPlan("core"), drop: ["you", "window"] },
    story,
    post,
    square,
  },
};
