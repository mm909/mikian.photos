/* poster/community.ts — the ROWTEMBER poster: its modules and plans
 * (COMMUNITY stream, 2026-09-10; re-composed the same evening after the
 * owner read the first sheets).
 *
 * The front page as a broadsheet (SPEC.md §0): the nameplate on a hairline,
 * the mono dateline, the water-blue meters as the lead number, the
 * bracketed strip, then columns under one-line eyebrows.
 *
 * WHAT THE REVIEW CHANGED. Three of the biggest blocks came off the sheet
 * and two of the footer's three lines went with them, so every plan below
 * is a new composition rather than the old one with holes in it:
 *   · the curve — "I do not really like the whole curve there with the
 *     cumulative meters. I think that can leave."
 *   · the 100K club roll — "we do not need to list the hundred K club
 *     because there is going to be a ton of members eventually."
 *   · the partner plate — "we can remove any reference to Grizzly Health
 *     on these."
 * THE MONTH takes their room: the calendar is the hero of the upper sheet,
 * two columns wide on the 24x36 with the takeaways ledger under it, the two
 * top tens down the right rail, and the hours, the field and the records
 * along the foot. `curve`, `club` and `plate` stay REGISTERED below and are
 * named in no plan — the drawings are good, the partner still ships in the
 * payload, and putting one back is one line in a plan.
 *
 * The phone frames keep the nameplate, the number and the strip and carry
 * the month over a short takeaways ledger (the square is the takeaways
 * alone). The month is the one module that grows: on paper it is as wide as
 * its column allows, on a phone it measures a floor cell and the plan's
 * grow hands it the rest.
 *
 * Every module here is one PosterModule: it owns its eyebrow, draws inside
 * its box, returns the height it used, and reads pitch and gap from
 * paint.tk so the engine's shrink steps reach it. measure() is the SAME
 * draw under an empty clip (charts.ts silently), so the engine's budget and
 * the ink can never disagree by a unit.
 *
 * Masking is the share-card rule (SPEC §1.4): every board row, record line
 * and headline figure arrives as a Figure and is drawn as text or as ink
 * blocks; the ledger is aggregates only. A hidden number does not exist in
 * this file's input and so cannot reach the canvas. */

import {
  drawBoard,
  drawClub,
  drawCurve,
  drawFooter,
  drawHeadline,
  drawHours,
  drawLedger,
  drawMonth,
  drawNameplate,
  drawPlate,
  drawRecords,
  drawSplit,
  drawStrip,
  plateMinH,
  silently,
  type Run,
  type StripCell,
} from "./charts";
import { GRAY, INK, SEP_FIRST_DOW } from "./paint";
import type {
  CommunityPoster,
  PosterBox,
  PosterLayout,
  PosterModule,
  PosterPaint,
  PosterPlan,
  PosterTakeaway,
  PosterTakeawayKey,
} from "./types";

type Ctx = CanvasRenderingContext2D;
type Mod = PosterModule<CommunityPoster>;
type Draw = (ctx: Ctx, box: PosterBox, d: CommunityPoster, paint: PosterPaint) => number;

/* A module whose measure is its draw under an empty clip. */
function mod(id: string, minH: number, draw: Draw): Mod {
  return {
    id,
    minH,
    measure: (ctx, box, d, _fonts, paint) => silently(ctx, () => draw(ctx, box, d, paint)),
    draw: (ctx, box, d, _fonts, paint) => draw(ctx, box, d, paint),
  };
}

/* A chart that fills its box: measure() is the family minimum (the plan
 * grows the row), draw() paints to box.h. `minH` is the floor across
 * families, which is what the engine's `chart` step measures. */
function chart(id: string, minH: number, want: (paint: PosterPaint) => number, draw: Draw): Mod {
  return {
    id,
    minH,
    measure: (_ctx, _box, _d, _fonts, paint) => want(paint),
    draw: (ctx, box, d, _fonts, paint) => draw(ctx, box, d, paint),
  };
}

const family = (paint: PosterPaint) => paint.format.family;
const isPhone = (paint: PosterPaint) => family(paint) === "phone";

const n = (v: number) => Math.round(v).toLocaleString("en-US");
const hoursText = (s: number) => `${(s / 3600).toFixed(1)} h`;

/* The owner's title for the tier, on the strip and on the ledger: "instead
 * of saying IN THE 100K CLUB, I kind of like the title of 100K FINISHERS"
 * (2026-09-10). */
const FINISHERS = "100K finishers";

/* The takeaways this sheet prints. The DATA stream ships the club line with
 * its claim tail — "25 ROWERS · FIRST TESS VALE · SEP 8" — for the surfaces
 * that still want it; the poster drops the tail ("we can remove the first
 * Frankie, like the first person to get the hundred K club") and keeps the
 * count, under the owner's title. Everything else passes through in the
 * priority order data.ts set. */
const takeawaysOf = (d: CommunityPoster): PosterTakeaway[] =>
  d.takeaways.map((t) =>
    t.key === "club" ? { ...t, label: FINISHERS, value: t.value.replace(/\s·\sFIRST\b[\s\S]*$/i, "") } : t,
  );

/* ------------------------------------------------------------ shared */

/* S1. "ROWTEMBER 2026", the dateline, and — while a window is open — the
 * blackout note, so the sheet explains its own blocks. On print only: the
 * community phone sheets carry the month and the takeaways, neither of
 * which draws a block, and the note's line is the two ledger lines the
 * square has room for. The dateline itself is the DATA stream's ("SEP 12",
 * or "FINAL" from Oct 1 — the DAY N OF 30 tail came off both sheets). */
const masthead = mod("masthead", 60, (ctx, box, d, paint) => {
  const runs: Run[] = [{ text: `ROWTEMBER ${d.year}`, color: INK }];
  const note = d.blackout.active && !isPhone(paint) ? d.blackout.note : null;
  return drawNameplate(ctx, paint, box, runs, d.asOf.dateline, note, paint.tk.nameCap);
});

/* S2. The meters, and "METERS · EVERYONE TOGETHER · 96 ROWERS". The day
 * count came off the label with the dateline's: "day ten of thirty can get
 * removed, and TEN DAYS can get removed, because we have the September
 * tenth there" (owner, 2026-09-10). */
const headline = mod("headline", 100, (ctx, box, d, paint) => {
  const bold = paint.font("monoBold", paint.tk.headLabel);
  const label: Run[] = [
    { text: "METERS · ", color: GRAY },
    { text: "EVERYONE TOGETHER", color: INK, font: bold },
    { text: ` · ${d.totals.rowers} ROWERS`, color: GRAY },
  ];
  return drawHeadline(ctx, paint, box, { text: n(d.totals.meters) }, label, paint.tk.headCap);
});

/* S3. Four cells on print, three on the phone. */
const strip = mod("strip", 60, (ctx, box, d, paint) => {
  const cells: StripCell[] = isPhone(paint)
    ? [
        { n: { text: hoursText(d.totals.seconds) }, l: "Time rowed" },
        { n: { text: String(d.totals.rowers) }, l: "Rowers" },
        { n: { text: String(d.totals.club) }, l: FINISHERS },
      ]
    : [
        { n: { text: hoursText(d.totals.seconds) }, l: "Time rowed" },
        { n: { text: n(d.totals.sessions) }, l: "Sessions" },
        { n: { text: String(d.totals.rowers) }, l: "Rowers" },
        { n: { text: String(d.totals.club) }, l: FINISHERS },
      ];
  return drawStrip(ctx, paint, box, cells);
});

/* S14. OFF EVERY PLAN (owner, 2026-09-10: "we need to remove partner
 * Grizzly Health, code ROWTEMBER, ten percent off, on all of them"). Kept
 * registered, with `partner` still in the payload, so a future partner is a
 * slot in a plan and nothing more. */
const plate: Mod = {
  id: "plate",
  minH: 110,
  measure: (_ctx, _box, d, _fonts, paint) => (d.partner ? Math.max(plateMinH(paint), paint.tk.ledger * 11.5) : 0),
  draw: (ctx, box, d, _fonts, paint) => (d.partner ? drawPlate(ctx, paint, box, d.partner, d.year) : 0),
};

/* S15. One line: FOR YOURSELF AND OTHERS (owner, 2026-09-10 — the name,
 * the URL, the handle and the partner line all came off). */
const footer = mod("footer", 40, (ctx, box, _d, paint) => drawFooter(ctx, paint, box));

/* --------------------------------------------------------- community */

/* C5. OFF EVERY PLAN (owner, 2026-09-10: "the curve needs to go"). Kept
 * registered: it is the one drawing of the month as a total, and the byDay
 * series it reads still ships. */
const curve = chart(
  "curve",
  115,
  (paint) => (family(paint) === "printL" ? 210 : family(paint) === "printS" ? 160 : 115),
  (ctx, box, d, paint) => drawCurve(ctx, paint, box, d.byDay, d.asOf.dayNumber, d.asOf.day),
);

/* C6. One drawing, two registrations, and the one module on the sheet that
 * grows.
 *
 * `month.full` is the whole September grid — five rows whatever the day,
 * the days still to come drawn as empty boxes (charts.ts) — and it is what
 * every PRINT plan uses, so a wall sheet composes identically at day 12 and
 * at FINAL: "just make sure that it still looks good when the month chart
 * is filled" (owner, item 17) is then true by construction, not by luck.
 * `month` is the elapsed weeks only, which is what the phone frames want —
 * they are shared the day they are made.
 *
 * The cell: as wide as the column allows on paper, and as tall (a square)
 * whenever the box is deep enough, which every print sheet is — so a print
 * month can never grow past its width. On a phone the module MEASURES at a
 * floor cell and the plan's grow hands it the rest, so a story mid-month
 * gets big square cells and a FINAL five-row month still fits over its
 * takeaways as wall-calendar rectangles. draw() fits the grid to box.h, so
 * a fit:"cap" slot the engine has cut gets a shorter cell, never an
 * overflow. */
const PHONE_CELL = 34;
const monthModule = (id: string, full: boolean): Mod => {
  const rowsOf = (d: CommunityPoster) =>
    Math.ceil(((full ? 30 : Math.max(1, Math.min(30, d.asOf.dayNumber))) + SEP_FIRST_DOW) / 7);
  /* The eyebrow plus the S M T W T F S row — measured off paint.eyebrow
   * itself, never guessed, because drawMonth lays the grid under it. */
  const head = (ctx: Ctx, paint: PosterPaint, w: number) =>
    silently(ctx, () => paint.eyebrow(ctx, 0, 0, w, "X", "X")) + paint.tk.small * 1.9;
  const wideCell = (paint: PosterPaint, w: number) => (w - paint.tk.small * 0.7 * 6) / 7;
  return {
    id,
    minH: 80,
    measure: (ctx, box, d, _fonts, paint) => {
      const gap = paint.tk.small * 0.7;
      const wide = wideCell(paint, box.w);
      const cell = isPhone(paint) ? Math.min(wide, PHONE_CELL) : wide;
      const rows = rowsOf(d);
      return head(ctx, paint, box.w) + rows * cell + (rows - 1) * gap;
    },
    draw: (ctx, box, d, _fonts, paint) => {
      const tk = paint.tk;
      const gap = tk.small * 0.7;
      const rows = rowsOf(d);
      const wide = wideCell(paint, box.w);
      let cell = wide;
      if (Number.isFinite(box.h) && box.h > 0) {
        // No epsilon here: a cell a hair over its share draws a grid a hair
        // taller than the box, which the engine logs as a module overflow.
        const fit = (box.h - head(ctx, paint, box.w) - (rows - 1) * gap) / rows;
        cell = Math.max(tk.small * 1.5, Math.min(wide, fit));
      }
      return drawMonth(ctx, paint, box, {
        eyebrow: { left: "THE MONTH", right: "METERS PER DAY" },
        meters: d.byDay,
        dayNumber: d.asOf.dayNumber,
        full,
        buckets: "quartile",
        cellCap: cell,
      });
    },
  };
};
const month = monthModule("month", false);
const monthFull = monthModule("month.full", true);

/* C7. The two top tens and their top-five variants. "I like that we list
 * the top ten men and women" (owner, 2026-09-10), so the wall sheets list
 * ten; the hand-outs keep the top five they were built with — a printS
 * column cannot hold twenty rows and the month. A masked row on a narrow
 * column drops the rower number so the name, the pace chip and the blocks
 * fit. */
const board = (id: string, division: "M" | "F", count: 5 | 10): Mod =>
  mod(id, 60, (ctx, box, d, paint) =>
    drawBoard(ctx, paint, box, division === "M" ? d.standings.men : d.standings.women, {
      division,
      count,
      until: d.blackout.until,
      noNum: isPhone(paint) || box.w < 320,
    }),
  );

/* C8. "I like that we call out the records here for fastest rows, longest
 * row, biggest day." On the wall sheets the records take the foot of the
 * right rail and spread their lines to fill it (charts.ts drawRecords). */
const records = mod("records", 80, (ctx, box, d, paint) => drawRecords(ctx, paint, box, d.records, d.blackout.active));

/* C9, C10. "I like that we have the hours and the field chart here." Fixed
 * rows: 170 on the wall, 130 in the hand, 120 on the phone — or the
 * one-line note when the data is null (a day-1 sheet). */
const fixedH = (paint: PosterPaint) => (family(paint) === "printL" ? 170 : family(paint) === "printS" ? 130 : 120);
const hours: Mod = {
  id: "hours",
  minH: 60,
  measure: (ctx, box, d, _fonts, paint) =>
    d.hours ? fixedH(paint) : silently(ctx, () => drawHours(ctx, paint, box, null)),
  draw: (ctx, box, d, _fonts, paint) => drawHours(ctx, paint, box, d.hours),
};
const field: Mod = {
  id: "field",
  minH: 60,
  measure: (ctx, box, d, _fonts, paint) =>
    d.split ? fixedH(paint) : silently(ctx, () => drawSplit(ctx, paint, box, null)),
  draw: (ctx, box, d, _fonts, paint) => drawSplit(ctx, paint, box, d.split),
};

/* C11. The print ledger: the first six takeaways as a dotted KEY ······
 * VALUE ledger (two columns when the box is 600 wide or more), two lines
 * at least or none at all. minH is TWO lines in the widest family metric
 * (printS: thick + air + 2 × 29 = 72.4), because the floor is what a
 * `fit:"lines"` slot is cut to and what a stack hands its fit member when
 * the column beside it is taller: a letter sheet gets two takeaways under
 * its month instead of 73 units of white. */
const printItems = (d: CommunityPoster) => takeawaysOf(d).slice(0, 6);
const ledger: Mod = {
  id: "ledger",
  minH: 73,
  measure: (ctx, box, d, _fonts, paint) =>
    silently(ctx, () => drawLedger(ctx, paint, box, printItems(d), { max: 6, min: 2 })),
  draw: (ctx, box, d, _fonts, paint) => drawLedger(ctx, paint, box, printItems(d), { max: 6, min: 2 }),
};

/* The phone pick order: the day, the split, the finishers, then the rest. */
const PHONE_PICK: PosterTakeawayKey[] = ["biggestDay", "medianSplit", "club", "busiestHour", "avgRow", "rowsADay"];
const phoneItems = (d: CommunityPoster) => {
  const all = takeawaysOf(d);
  return PHONE_PICK.map((k) => all.find((t) => t.key === k)).filter((t): t is PosterTakeaway => !!t);
};
const ledgerPhone: Mod = {
  id: "ledger.phone",
  minH: 3 + 9.24 + 2 * 25,
  measure: (ctx, box, d, _fonts, paint) =>
    silently(ctx, () => drawLedger(ctx, paint, box, phoneItems(d), { max: 4, min: 2 })),
  draw: (ctx, box, d, _fonts, paint) => drawLedger(ctx, paint, box, phoneItems(d), { max: 4, min: 2 }),
};

/* C12. OFF EVERY PLAN (owner, 2026-09-10: "we do not need to list the
 * hundred K club"; the count keeps its strip cell and its ledger line under
 * the title 100K FINISHERS). Kept registered — the roll is still in the
 * payload and still masked-safe, names only. */
const club = mod("club", 100, (ctx, box, d, paint) => drawClub(ctx, paint, box, d.club, { fit: "cap" }));

/* ------------------------------------------------------------- plans */

/* The three-column sheets and the two-column ones share their top three
 * rows; only the span differs. */
const top3 = [
  { id: "A", slots: [{ module: "masthead", span: 3 as const }] },
  { id: "B", slots: [{ module: "headline", span: 3 as const }] },
  { id: "C", slots: [{ module: "strip", span: 3 as const }] },
];
const top2 = [
  { id: "A", slots: [{ module: "masthead", span: 2 as const }] },
  { id: "B", slots: [{ module: "headline", span: 2 as const }] },
  { id: "C", slots: [{ module: "strip", span: 2 as const }] },
];

/* THE WALL SHEET (24x36). Two flows under the strip: the MONTH two columns
 * wide with the takeaways ledger under it, and the two top tens down the
 * right rail — the calendar and the standings read at the same height, the
 * way a front page runs a picture against a table. Then the foot: the hours
 * over the field across two columns, the records beside them filling the
 * same height. Nothing is parked on the right of a rule; every row's
 * columns close within a few units of each other, so the sheet has no
 * band of dead paper anywhere. */
const tall: PosterPlan = {
  key: "tall",
  cols: 3,
  rows: [
    ...top3,
    {
      id: "D",
      slots: [
        { stack: ["month.full", "ledger"], span: 2, fit: "lines" },
        { stack: ["board.men", "board.women"], span: 1 },
      ],
    },
    {
      id: "E",
      slots: [
        { stack: ["hours", "field"], span: 2 },
        { module: "records", span: 1 },
      ],
    },
  ],
  footer: "footer",
  shrink: ["gap", "pitch", "cap"],
  next: "short",
};

/* 18x24 (and the 24x36's fallback): 200 units shorter, so the month gives
 * up a column and sits beside the two boards, the charts and the records
 * keep the middle band, and the takeaways run the full measure across the
 * foot as one wide dotted ledger. */
const shortRows = [
  ...top3,
  {
    id: "D",
    slots: [
      { module: "month.full", span: 1 as const },
      { module: "board.men", span: 1 as const },
      { module: "board.women", span: 1 as const },
    ],
  },
  {
    id: "E",
    slots: [
      { stack: ["hours", "field"], span: 2 as const },
      { module: "records", span: 1 as const },
    ],
  },
  { id: "F", slots: [{ module: "ledger", span: 3 as const, fit: "lines" as const }] },
];

const short: PosterPlan = {
  key: "short",
  cols: 3,
  rows: shortRows,
  footer: "footer",
  shrink: ["gap", "pitch", "cap"],
  next: "squat",
};

/* 16x20: the same composition, 100 units shorter again — it spends the gap
 * and the pitch steps to hold it rather than give a module up, because
 * every block on this sheet is one the owner asked to keep. */
const squat: PosterPlan = {
  key: "squat",
  cols: 3,
  rows: shortRows,
  footer: "footer",
  shrink: ["gap", "pitch", "cap"],
  next: "core",
};

/* The wall family's last resort (§8.6) — reached only if a sheet of data
 * outgrows all three: the top fives, the records and the takeaways. */
const core: PosterPlan = {
  key: "core",
  cols: 3,
  rows: [
    ...top3,
    {
      id: "D",
      slots: [
        { module: "board.men.5", span: 1 },
        { module: "board.women.5", span: 1 },
        { module: "records", span: 1 },
      ],
    },
    { id: "E", slots: [{ module: "ledger", span: 3, fit: "lines" }] },
  ],
  footer: "footer",
  shrink: ["gap", "pitch", "cap"],
};

/* 11x17, A3, letter, A4 — two columns, read in the hand. The month and the
 * takeaways in the first column, the two top fives in the second: the
 * whole front page above the fold. The ledger is the elastic part — 11x17
 * holds all six lines, A3 and A4 four, letter none — and the pitch step is
 * what letter spends to keep both boards whole. A printS column is 302
 * units: twenty board rows and a calendar cannot share it, so the hand-outs
 * keep the top five they were designed with. */
const hand: PosterPlan = {
  key: "hand",
  cols: 2,
  rows: [
    ...top2,
    {
      id: "D",
      slots: [
        { stack: ["month.full", "ledger"], span: 1, fit: "lines" },
        { stack: ["board.men.5", "board.women.5"], span: 1 },
      ],
    },
  ],
  footer: "footer",
  shrink: ["gap", "pitch", "cap"],
};

/* The phone: one full-width column (two of the family's, spanned). The
 * month is the picture on both frames now that the curve is gone; it
 * measures a floor cell and grows into whatever the ledger leaves, and it
 * is a fit:"cap" slot so a FINAL five-row month takes smaller cells instead
 * of pushing the footer. The ledger yields lines before the month yields
 * cells (the engine trims a lines slot first), which is the right order:
 * two takeaways are worth more than four when the picture is the post. */
const story: PosterPlan = {
  key: "story",
  cols: 2,
  rows: [
    ...top2,
    { id: "D", slots: [{ module: "month", span: 2, fit: "cap" }], grow: 1 },
    { id: "F", slots: [{ module: "ledger.phone", span: 2, fit: "lines" }] },
  ],
  footer: "footer",
  shrink: ["gap", "cap"],
};

const post: PosterPlan = {
  key: "post",
  cols: 2,
  rows: [
    ...top2,
    { id: "D", slots: [{ module: "month", span: 2, fit: "cap" }], grow: 1 },
    { id: "F", slots: [{ module: "ledger.phone", span: 2, fit: "lines" }] },
  ],
  footer: "footer",
  shrink: ["gap", "cap"],
};

/* 1:1 has room for the number, the strip and the takeaways and nothing
 * else — a calendar under them would be four rows of 20-unit cells. */
const square: PosterPlan = {
  key: "square",
  cols: 2,
  rows: [...top2, { id: "F", slots: [{ module: "ledger.phone", span: 2, fit: "lines" }] }],
  footer: "footer",
  shrink: ["gap", "cap"],
};

/* ------------------------------------------------------------ layout */

export const communityLayout: PosterLayout<CommunityPoster> = {
  subject: "community",
  modules: {
    masthead,
    headline,
    strip,
    curve,
    month,
    "month.full": monthFull,
    "board.men": board("board.men", "M", 10),
    "board.women": board("board.women", "F", 10),
    "board.men.5": board("board.men.5", "M", 5),
    "board.women.5": board("board.women.5", "F", 5),
    records,
    hours,
    field,
    ledger,
    "ledger.phone": ledgerPhone,
    club,
    plate,
    footer,
  },
  plans: { tall, short, squat, core, hand, story, post, square },
};
