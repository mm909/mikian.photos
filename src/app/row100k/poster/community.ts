/* poster/community.ts — the ROWTEMBER poster: its modules and plans
 * (COMMUNITY stream, 2026-09-10).
 *
 * The front page as a broadsheet (SPEC.md §0): the nameplate on a hairline,
 * the mono dateline, the water-blue meters as the lead number, the
 * bracketed strip, then columns under one-line eyebrows — the curve and
 * the month, the two top tens and the records, the hours, the field and
 * the takeaways ledger, the 100K club as an honour roll beside the partner
 * plate — and the footer all-left. The phone formats keep the nameplate,
 * the number and the strip and carry one chart (the month on the story,
 * the curve on the post) over a short takeaways ledger; the square is the
 * takeaways alone.
 *
 * Every module here is one PosterModule: it owns its eyebrow, draws inside
 * its box, returns the height it used, and reads pitch and gap from
 * paint.tk so the engine's shrink steps reach it. measure() is the SAME
 * draw under an empty clip (charts.ts silently), so the engine's budget and
 * the ink can never disagree by a unit. The chart modules (curve, hours,
 * field) are the exception on purpose: they fill whatever box the plan
 * hands them, so their measure() reports the family minimum and the plan's
 * `grow` gives them the rest.
 *
 * Masking is the share-card rule (SPEC §1.4): every board row, record line
 * and headline figure arrives as a Figure and is drawn as text or as ink
 * blocks; the club roll is names only; the ledger is aggregates only. A
 * hidden number does not exist in this file's input and so cannot reach
 * the canvas. */

import {
  EPS,
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
import { GRAY, INK } from "./paint";
import type {
  CommunityPoster,
  PosterBox,
  PosterLayout,
  PosterModule,
  PosterPaint,
  PosterPlan,
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

/* "TEN DAYS" — the day count spelled out on the headline label. */
const WORDS = [
  "",
  "ONE",
  "TWO",
  "THREE",
  "FOUR",
  "FIVE",
  "SIX",
  "SEVEN",
  "EIGHT",
  "NINE",
  "TEN",
  "ELEVEN",
  "TWELVE",
  "THIRTEEN",
  "FOURTEEN",
  "FIFTEEN",
  "SIXTEEN",
  "SEVENTEEN",
  "EIGHTEEN",
  "NINETEEN",
  "TWENTY",
  "TWENTY-ONE",
  "TWENTY-TWO",
  "TWENTY-THREE",
  "TWENTY-FOUR",
  "TWENTY-FIVE",
  "TWENTY-SIX",
  "TWENTY-SEVEN",
  "TWENTY-EIGHT",
  "TWENTY-NINE",
  "THIRTY",
];
const daysWord = (d: CommunityPoster): string => {
  if (d.asOf.final) return "THIRTY DAYS";
  const n = Math.max(1, Math.min(30, d.asOf.dayNumber));
  return n === 1 ? "ONE DAY" : `${WORDS[n]} DAYS`;
};

const n = (v: number) => Math.round(v).toLocaleString("en-US");
const hoursText = (s: number) => `${(s / 3600).toFixed(1)} h`;

/* ------------------------------------------------------------ shared */

/* S1. "ROWTEMBER 2026", the dateline, and — while a window is open — the
 * blackout note, so the sheet explains its own blocks. On print only: the
 * community phone sheets carry the month, the curve and the takeaways,
 * none of which draws a block, and the note's line is the two ledger
 * lines the square has room for. */
const masthead = mod("masthead", 60, (ctx, box, d, paint) => {
  const runs: Run[] = [{ text: `ROWTEMBER ${d.year}`, color: INK }];
  const note = d.blackout.active && !isPhone(paint) ? d.blackout.note : null;
  return drawNameplate(ctx, paint, box, runs, d.asOf.dateline, note, paint.tk.nameCap);
});

/* S2. The meters, and "METERS · EVERYONE TOGETHER · 96 ROWERS · TEN DAYS"
 * (the tail drops on a narrow measure). */
const headline = mod("headline", 100, (ctx, box, d, paint) => {
  const bold = paint.font("monoBold", paint.tk.headLabel);
  const label: Run[] = [
    { text: "METERS · ", color: GRAY },
    { text: "EVERYONE TOGETHER", color: INK, font: bold },
    { text: ` · ${d.totals.rowers} ROWERS · ${daysWord(d)}`, color: GRAY },
  ];
  return drawHeadline(ctx, paint, box, { text: n(d.totals.meters) }, label, paint.tk.headCap);
});

/* S3. Four cells on print, three on the phone. */
const strip = mod("strip", 60, (ctx, box, d, paint) => {
  const cells: StripCell[] = isPhone(paint)
    ? [
        { n: { text: hoursText(d.totals.seconds) }, l: "Time rowed" },
        { n: { text: String(d.totals.rowers) }, l: "Rowers" },
        { n: { text: String(d.totals.club) }, l: "100K club" },
      ]
    : [
        { n: { text: hoursText(d.totals.seconds) }, l: "Time rowed" },
        { n: { text: n(d.totals.sessions) }, l: "Sessions" },
        { n: { text: String(d.totals.rowers) }, l: "Rowers" },
        // The hand sizes' cells are 158 wide: the long label ellipsized there.
        { n: { text: String(d.totals.club) }, l: family(paint) === "printL" ? "In the 100K club" : "100K club" },
      ];
  return drawStrip(ctx, paint, box, cells);
});

/* S14. The plate wants ~150 on the wall; it takes the row's height up to
 * plateMaxH and is dropped by the plan under plateMinH. No partner → 0. */
const plate: Mod = {
  id: "plate",
  minH: 110,
  measure: (_ctx, _box, d, _fonts, paint) => (d.partner ? Math.max(plateMinH(paint), paint.tk.ledger * 11.5) : 0),
  draw: (ctx, box, d, _fonts, paint) => (d.partner ? drawPlate(ctx, paint, box, d.partner, d.year) : 0),
};

/* S15. The third line is the partner line on the phone (no plate there),
 * "for yourself and others" on print. */
const footer = mod("footer", 60, (ctx, box, d, paint) => {
  const third = isPhone(paint) && d.partner ? d.partner.footerLine : "for yourself and others";
  return drawFooter(ctx, paint, box, d.url, third);
});

/* --------------------------------------------------------- community */

/* C5. Min 210 / 160 / 115 by family; the plan's grow sizes the row. (The
 * phone post holds a 115 curve over two takeaway lines; at 140 the ledger
 * could never keep its two lines.) */
const curve = chart(
  "curve",
  115,
  (paint) => (family(paint) === "printL" ? 210 : family(paint) === "printS" ? 160 : 115),
  (ctx, box, d, paint) => drawCurve(ctx, paint, box, d.byDay, d.asOf.dayNumber, d.asOf.day),
);

/* C6. Two registrations of one drawing: `month.full` is the five-row
 * September grid, future days in paper (the tall plan — a 24x36 shows the
 * whole month from six feet); `month` is the elapsed weeks only (the short
 * plan, where the ledger sits under it mid-month; the hand-outs; the
 * phone). Quartile buckets; the story caps the cell at 44, the post at 56.
 * When the engine hands it a shorter box (a fit:"cap" slot at FINAL on the
 * story) the cell shrinks to fit rather than overflow. */
const monthModule = (id: string, full: boolean): Mod =>
  mod(id, 80, (ctx, box, d, paint) => {
    const key = paint.format.key;
    const tk = paint.tk;
    let cellCap = key === "story" ? 44 : key === "post" ? 56 : undefined;
    if (Number.isFinite(box.h) && box.h > 0) {
      const shown = full ? 30 : Math.max(1, Math.min(30, d.asOf.dayNumber));
      const rows = Math.ceil((shown + 2) / 7);
      // eyebrow + weekday header + rows × cell + (rows − 1) × gap ≤ box.h
      const head = silently(ctx, () => paint.eyebrow(ctx, 0, 0, box.w, "X", "X")) + tk.small * 1.9;
      const fitCell = (box.h + EPS - head - (rows - 1) * tk.small * 0.7) / rows;
      if (fitCell < (box.w - tk.small * 0.7 * 6) / 7) {
        cellCap = Math.max(tk.small * 1.5, Math.min(cellCap ?? fitCell, fitCell));
      }
    }
    return drawMonth(ctx, paint, box, {
      eyebrow: { left: "THE MONTH", right: "METERS PER DAY" },
      meters: d.byDay,
      dayNumber: d.asOf.dayNumber,
      full,
      buckets: "quartile",
      cellCap,
    });
  });
const month = monthModule("month", false);
const monthFull = monthModule("month.full", true);

/* C7. The two top tens and their top-five variants. A masked row on a
 * narrow column (under the wall's 333) drops the rower number so the name,
 * the pace chip and the blocks fit. */
const board = (id: string, division: "M" | "F", count: 5 | 10): Mod =>
  mod(id, 60, (ctx, box, d, paint) =>
    drawBoard(ctx, paint, box, division === "M" ? d.standings.men : d.standings.women, {
      division,
      count,
      until: d.blackout.until,
      noNum: isPhone(paint) || box.w < 320,
    }),
  );

/* C8. */
const records = mod("records", 80, (ctx, box, d, paint) => drawRecords(ctx, paint, box, d.records, d.blackout.active));

/* C9, C10. Fixed rows: 170 on the wall, 130 in the hand, 120 on the phone
 * — or the one-line note when the data is null. */
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

/* C11. The print ledger: the first six takeaways, at least three (a
 * fit:"lines" slot draws the lines that fit or nothing). minH is three
 * lines on the wall (thick + air + 3 × ledgerPitch) — the engine zeroes a
 * lines slot cut under it. */
const ledger: Mod = {
  id: "ledger",
  minH: 4 + 10 + 3 * 27,
  measure: (ctx, box, d, _fonts, paint) =>
    silently(ctx, () => drawLedger(ctx, paint, box, d.takeaways.slice(0, 6), { max: 6, min: 3 })),
  draw: (ctx, box, d, _fonts, paint) => drawLedger(ctx, paint, box, d.takeaways.slice(0, 6), { max: 6, min: 3 }),
};

/* The ledger UNDER the month on the short plan (SPEC.md §7: "the ledger is
 * the first module to yield on 3:4"). The engine's cap step runs last row
 * first, which would cap the club roll before this ledger gave way; so it
 * yields on its own — once the month above it has five rows (from Sep 27)
 * it measures 0 and draws nothing, and the roll keeps its room. */
const fiveRows = (d: CommunityPoster) => Math.ceil((Math.min(30, d.asOf.dayNumber) + 2) / 7) >= 5;
const ledgerSide: Mod = {
  id: "ledger.side",
  minH: 4 + 10 + 3 * 27,
  measure: (ctx, box, d, _fonts, paint) =>
    fiveRows(d) ? 0 : silently(ctx, () => drawLedger(ctx, paint, box, d.takeaways.slice(0, 6), { max: 6, min: 3 })),
  draw: (ctx, box, d, _fonts, paint) =>
    fiveRows(d) ? 0 : drawLedger(ctx, paint, box, d.takeaways.slice(0, 6), { max: 6, min: 3 }),
};

/* The phone pick order: the day, the split, the club, then the rest. */
const PHONE_PICK: PosterTakeawayKey[] = ["biggestDay", "medianSplit", "club", "busiestHour", "avgRow", "rowsADay"];
const phoneItems = (d: CommunityPoster) =>
  PHONE_PICK.map((k) => d.takeaways.find((t) => t.key === k)).filter((t): t is NonNullable<typeof t> => !!t);
const ledgerPhone: Mod = {
  id: "ledger.phone",
  minH: 3 + 9.24 + 2 * 25,
  measure: (ctx, box, d, _fonts, paint) =>
    silently(ctx, () => drawLedger(ctx, paint, box, phoneItems(d), { max: 4, min: 2 })),
  draw: (ctx, box, d, _fonts, paint) => drawLedger(ctx, paint, box, phoneItems(d), { max: 4, min: 2 }),
};

/* C12. The roll never draws outside its box: a fit:"all" slot is measured
 * unbounded (the engine cascades before it would cut), a fit:"cap" slot
 * ends with "+ N MORE". */
const club = mod("club", 100, (ctx, box, d, paint) => drawClub(ctx, paint, box, d.club, { fit: "cap" }));

/* ------------------------------------------------------------- plans */

const full = (module: string): PosterPlan["rows"][number]["slots"][number] => ({ module, span: 3 });
const top3 = [
  { id: "A", slots: [full("masthead")] },
  { id: "B", slots: [full("headline")] },
  { id: "C", slots: [full("strip")] },
];
const boardsRow = { id: "E", slots: [{ module: "board.men", span: 1 as const }, { module: "board.women", span: 1 as const }, { module: "records", span: 1 as const }] };

/* 24x36 first: everything, the whole month, the club roll at every name
 * (fit:all). `step` is in the shrink order so a roll of forty with one
 * 19-character name (three columns at the row size, four at the small
 * step) still keeps the hours, the field and the ledger on the wall; past
 * that the plan cascades and the roll takes the room (SPEC.md §14.3). */
const tall: PosterPlan = {
  key: "tall",
  cols: 3,
  rows: [
    ...top3,
    { id: "D", slots: [{ module: "curve", span: 2 }, { module: "month.full", span: 1 }], grow: 1, maxH: 320 },
    boardsRow,
    { id: "F", slots: [{ module: "hours", span: 1 }, { module: "field", span: 1 }, { module: "ledger", span: 1 }] },
    { id: "G", slots: [{ module: "club", span: 2, fit: "all" }, { module: "plate", span: 1 }] },
  ],
  footer: "footer",
  shrink: ["gap", "pitch", "chart", "step"],
  next: "short",
};

/* 18x24 first; the 24x36 fallback: hours and field gone, the ledger under
 * a short month, the roll may cap. */
const short: PosterPlan = {
  key: "short",
  cols: 3,
  rows: [
    ...top3,
    {
      id: "D",
      slots: [
        { module: "curve", span: 2 },
        { stack: ["month", "ledger.side"], span: 1, grow: "ledger.side", fit: "lines" },
      ],
      grow: 1,
      maxH: 340,
    },
    boardsRow,
    { id: "G", slots: [{ module: "club", span: 2, fit: "cap" }, { module: "plate", span: 1 }] },
  ],
  footer: "footer",
  shrink: ["gap", "pitch", "chart", "step", "cap"],
  next: "squat",
};

/* 16x20 first; the 18x24 fallback: the curve alone across the sheet. */
const squat: PosterPlan = {
  key: "squat",
  cols: 3,
  rows: [
    ...top3,
    { id: "D", slots: [{ module: "curve", span: 3 }], grow: 1, maxH: 260 },
    boardsRow,
    { id: "G", slots: [{ module: "club", span: 2, fit: "cap" }, { module: "plate", span: 1 }] },
  ],
  footer: "footer",
  shrink: ["gap", "pitch", "chart", "step", "cap"],
  next: "core",
};

/* The wall family's last resort. */
const core: PosterPlan = {
  key: "core",
  cols: 3,
  rows: [
    ...top3,
    { id: "D", slots: [{ module: "curve", span: 3 }], grow: 1, maxH: 300 },
    {
      id: "E",
      slots: [
        { module: "board.men.5", span: 1 },
        { module: "board.women.5", span: 1 },
        { module: "ledger", span: 1, fit: "lines" },
      ],
    },
  ],
  footer: "footer",
  shrink: ["gap", "pitch", "chart", "cap"],
};

/* 11x17, A3, letter, A4: two columns, the front page above the fold. */
const hand: PosterPlan = {
  key: "hand",
  cols: 2,
  rows: [
    { id: "A", slots: [{ module: "masthead", span: 2 }] },
    { id: "B", slots: [{ module: "headline", span: 2 }] },
    { id: "C", slots: [{ module: "strip", span: 2 }] },
    { id: "D", slots: [{ module: "curve", span: 2 }], grow: 1, maxH: 220 },
    { id: "E", slots: [{ module: "board.men.5", span: 1 }, { module: "board.women.5", span: 1 }] },
    { id: "F", slots: [{ module: "ledger", span: 2, fit: "lines" }] },
  ],
  footer: "footer",
  drop: ["ledger"],
  shrink: ["gap", "pitch", "chart"],
};

/* The phone: one full-width column (two of the family's, spanned). */
const phoneTop = [
  { id: "A", slots: [{ module: "masthead", span: 2 as const }] },
  { id: "B", slots: [{ module: "headline", span: 2 as const }] },
  { id: "C", slots: [{ module: "strip", span: 2 as const }] },
];

/* The story: the month (a cap slot, so a FINAL five-row month shrinks its
 * cells rather than push the footer) over the short ledger. No drop list:
 * the engine drops before it shrinks, and a ledger dropped whole leaves a
 * hole where the cap step would have kept two lines of it. */
const story: PosterPlan = {
  key: "story",
  cols: 2,
  rows: [
    ...phoneTop,
    { id: "D", slots: [{ module: "month", span: 2, fit: "cap" }], grow: 1 },
    { id: "F", slots: [{ module: "ledger.phone", span: 2, fit: "lines" }] },
  ],
  footer: "footer",
  shrink: ["gap", "chart", "cap"],
};

/* The post: the curve over the short ledger; the ledger yields lines
 * before it yields whole (cap), and the curve takes the slack. */
const post: PosterPlan = {
  key: "post",
  cols: 2,
  rows: [
    ...phoneTop,
    { id: "D", slots: [{ module: "curve", span: 2 }], grow: 1, maxH: 220 },
    { id: "F", slots: [{ module: "ledger.phone", span: 2, fit: "lines" }] },
  ],
  footer: "footer",
  shrink: ["gap", "chart", "cap"],
};

const square: PosterPlan = {
  key: "square",
  cols: 2,
  rows: [...phoneTop, { id: "F", slots: [{ module: "ledger.phone", span: 2, fit: "lines" }] }],
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
    "ledger.side": ledgerSide,
    "ledger.phone": ledgerPhone,
    club,
    plate,
    footer,
  },
  plans: { tall, short, squat, core, hand, story, post, square },
};
