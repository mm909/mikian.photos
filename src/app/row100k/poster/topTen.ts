/* poster/topTen.ts — THE TOP TEN (owner, 2026-09-21: "give me a top 10
 * poster in black and white"; 2026-09-22: "make sure to include men's and
 * women's board … during lights out they should be censored"; later the
 * same day: "the shareables for the top 5 get cut off — give me one
 * shareable per board instead of reducing it to top 5. Remove the 2
 * sponsor logos on the posters").
 *
 * ONE BOARD PER SHEET. The men's ten and the women's ten are two artworks
 * of the same subject — the studio offers MEN and WOMEN under the TOP TEN
 * chip — and every frame, wall or phone, draws that one board of ten,
 * large, and nothing else: the Rowtember masthead, THE TOP TEN over a
 * line saying which board, the ten rows, the site footer. No partner
 * strip. The rows are the Rowtember sheet's own (assemble.ts
 * standingsOf), masked by the same rule as the board, so while lights out
 * is on the ten print as blocks, unranked and by average split, and the
 * title line says so.
 *
 * It reads the CommunityPoster payload as it is: a layout, not a subject
 * of its own, so the engine and the studio need nothing new to draw it. */

import { drawBoard, drawFooter, drawNameplate, silently, type Run } from "./charts";
import type { CommunityPoster, PosterBox, PosterLayout, PosterModule, PosterPaint, PosterPlan } from "./types";

type Ctx = CanvasRenderingContext2D;
type Mod = PosterModule<CommunityPoster>;
type Draw = (ctx: Ctx, box: PosterBox, d: CommunityPoster, paint: PosterPaint) => number;

export type TopTenBoard = "M" | "F";

export const TOP_TEN_BOARDS: { key: TopTenBoard; label: string }[] = [
  { key: "M", label: "Men" },
  { key: "F", label: "Women" },
];

function mod(id: string, minH: number, draw: Draw): Mod {
  return {
    id,
    minH,
    measure: (ctx, box, d, _fonts, paint) => silently(ctx, () => draw(ctx, box, d, paint)),
    draw: (ctx, box, d, _fonts, paint) => draw(ctx, box, d, paint),
  };
}

const isPhone = (paint: PosterPaint) => paint.format.family === "phone";

/* The board drawn LARGER than the Rowtember sheet draws its two: the rows
 * are the picture here. The row tokens are scaled on a clone of the paint
 * (everything drawBoard sizes by tk.row / tk.rowPitch follows; the chips
 * and the eyebrow keep the family size, which reads as intended — a small
 * label over big rows). */
function boardScale(paint: PosterPaint): number {
  if (paint.format.family === "printL") return 2.4;
  if (paint.format.key === "square") return 1;
  return 1.2;
}

function scaled(paint: PosterPaint, k: number): PosterPaint {
  if (k === 1) return paint;
  return { ...paint, tk: { ...paint.tk, row: paint.tk.row * k, rowPitch: paint.tk.rowPitch * k } };
}

/* S1. The Rowtember nameplate, as the community sheet has it. */
const masthead = mod("masthead", 60, (ctx, box, d, paint) => {
  const runs: Run[] = [{ text: `ROWTEMBER ${d.year}`, color: paint.c.ink }];
  const note = d.blackout.active && !isPhone(paint) ? d.blackout.note : null;
  return drawNameplate(ctx, paint, box, runs, d.asOf.dateline, note, paint.tk.nameCap);
});

/* S2. THE TOP TEN across the measure, and one mono line under it saying
 * which board and what the ten are — by metres, or by split with no
 * places while the lights are out. */
const title = (division: TopTenBoard): Mod =>
  mod("title", 100, (ctx, box, d, paint) => {
    const C = paint.c;
    const { tk } = paint;
    const text = "THE TOP TEN";
    const size = paint.fitSize(ctx, text, "black", tk.headCap, 24, box.w, -0.02);
    const f = paint.font("black", size);
    const m = paint.metricsOf(ctx, f, size);
    let y = box.y + tk.small * 0.4;
    paint.drawText(ctx, text, box.x, y + m.asc, f, C.ink, -0.02 * size);
    y += m.asc + size * 0.22;
    const who = division === "M" ? "MEN" : "WOMEN";
    const line = d.blackout.active
      ? `${who} · LIGHTS OUT · BY AVERAGE SPLIT · NO PLACES`
      : `${who} · BY METERS · ${d.totals.rowers} ROWERS IN ALL`;
    const lf = paint.font("mono", tk.headLabel);
    const lm = paint.metricsOf(ctx, lf, tk.headLabel);
    paint.drawText(ctx, paint.ellipsize(ctx, line, box.w, lf, 0.12 * tk.headLabel), box.x, y + lm.asc, lf, C.gray, 0.12 * tk.headLabel);
    y += lm.lh + tk.small * 0.6;
    return y - box.y;
  });

/* S3. The one board, ten rows. */
const board = (division: TopTenBoard): Mod =>
  mod("board", 120, (ctx, box, d, paint) =>
    drawBoard(ctx, scaled(paint, boardScale(paint)), box, division === "M" ? d.standings.men : d.standings.women, {
      division,
      count: 10,
      until: d.blackout.until,
      noNum: box.w < 320,
    }),
  );

/* S4. FOR YOURSELF AND OTHERS. */
const footer = mod("footer", 40, (ctx, box, _d, paint) => drawFooter(ctx, paint, box));

/* ------------------------------------------------------------- plans */

/* One stack on every frame. The board takes the slack, so a short sheet
 * and a tall one both put the footer at the foot. */
const stackOf = (span: 1 | 2 | 3, key: PosterPlan["key"], next?: PosterPlan["key"]): PosterPlan => ({
  key,
  cols: span,
  rows: [
    { id: "A", slots: [{ module: "masthead", span }] },
    { id: "B", slots: [{ module: "title", span }] },
    { id: "C", slots: [{ module: "board", span }], grow: 1 },
  ],
  footer: "footer",
  shrink: ["gap", "cap"],
  ...(next ? { next } : {}),
});

const plans: PosterLayout<CommunityPoster>["plans"] = {
  tall: stackOf(3, "tall", "short"),
  short: stackOf(3, "short", "squat"),
  squat: stackOf(3, "squat", "core"),
  core: stackOf(3, "core"),
  story: stackOf(2, "story"),
  post: stackOf(2, "post"),
  square: stackOf(2, "square"),
};

export function topTenLayoutFor(division: TopTenBoard): PosterLayout<CommunityPoster> {
  return {
    subject: "community",
    modules: { masthead, title: title(division), board: board(division), footer },
    plans,
  };
}

export const topTenMenLayout = topTenLayoutFor("M");
export const topTenWomenLayout = topTenLayoutFor("F");
