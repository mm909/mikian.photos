/* poster/topTen.ts — THE TOP TEN (owner, 2026-09-21: "give me a top 10
 * poster in black and white, and individualized black and white logos for
 * sponsors").
 *
 * THE MEN'S TEN AND THE WOMEN'S TEN (owner, 2026-09-22: "I did not like
 * this version — make sure to include men's and women's board; also during
 * lights out they should be censored"). The same two boards the Rowtember
 * sheet draws (assemble.ts standingsOf), drawn large, side by side on a
 * wall sheet and one over the other on a phone — masked by the same rule
 * as the board, so while lights out is on the ten print as blocks,
 * unranked and by average split, and the title line says so. The sheet is
 * the Rowtember masthead, THE TOP TEN as the headline, the two boards, a
 * strip of the partners' marks, the site footer. The phone frames have no
 * room for twenty rows and print the top FIVE of each.
 *
 * THE MARKS ARE MONO. Each partner has a black-and-white pair under
 * public/row100k/partners/bw — a WHITE mark for the black stock and an INK
 * mark for cream — and the strip picks by stock, so the same sheet prints
 * on either without a coloured logo on it. The pair is loaded by the studio
 * (PosterAssets.bw); a mark that did not load is skipped, never drawn as a
 * hole.
 *
 * It reads the CommunityPoster payload as it is: a layout, not a subject
 * of its own, so the engine and the studio need nothing new to draw it. */

import { drawBoard, drawFooter, drawNameplate, silently, type Run } from "./charts";
import type { CommunityPoster, PosterBox, PosterLayout, PosterModule, PosterPaint, PosterPlan } from "./types";

type Ctx = CanvasRenderingContext2D;
type Mod = PosterModule<CommunityPoster>;
type Draw = (ctx: Ctx, box: PosterBox, d: CommunityPoster, paint: PosterPaint) => number;

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
 * label over big rows). Ten rows at the wall scale take about half of a
 * 24 by 36; the square gets no scale, it has no room to give. */
function boardScale(paint: PosterPaint): number {
  if (paint.format.family === "printL") return 1.9;
  return 1.2;
}

/* Ten each on a wall sheet, which holds twenty rows; five each on a phone
 * frame, which does not — twenty rows on a story ran under the footer. */
function countFor(paint: PosterPaint): 5 | 10 {
  return isPhone(paint) ? 5 : 10;
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
 * what the ten are — by metres, or by split with no places while the
 * lights are out. */
const title = mod("title", 100, (ctx, box, d, paint) => {
  const C = paint.c;
  const { tk } = paint;
  const text = countFor(paint) === 5 ? "THE TOP FIVE" : "THE TOP TEN";
  const size = paint.fitSize(ctx, text, "black", tk.headCap, 24, box.w, -0.02);
  const f = paint.font("black", size);
  const m = paint.metricsOf(ctx, f, size);
  let y = box.y + tk.small * 0.4;
  paint.drawText(ctx, text, box.x, y + m.asc, f, C.ink, -0.02 * size);
  y += m.asc + size * 0.22;
  const out = d.blackout.active;
  const line = out
    ? `LIGHTS OUT · BY AVERAGE SPLIT · NO PLACES · ${d.totals.rowers} ROWERS`
    : `BY METERS · MEN AND WOMEN · ${d.totals.rowers} ROWERS`;
  const lf = paint.font("mono", tk.headLabel);
  const lm = paint.metricsOf(ctx, lf, tk.headLabel);
  paint.drawText(ctx, paint.ellipsize(ctx, line, box.w, lf, 0.12 * tk.headLabel), box.x, y + lm.asc, lf, C.gray, 0.12 * tk.headLabel);
  y += lm.lh + tk.small * 0.6;
  return y - box.y;
});

/* S3. The two boards. */
const board = (id: string, division: "M" | "F"): Mod =>
  mod(id, 120, (ctx, box, d, paint) =>
    drawBoard(ctx, scaled(paint, boardScale(paint)), box, division === "M" ? d.standings.men : d.standings.women, {
      division,
      count: countFor(paint),
      until: d.blackout.until,
      noNum: box.w < 320,
    }),
  );
const boardMen = board("board.men", "M");
const boardWomen = board("board.women", "F");

/* S4. THE PARTNERS, in mono: an eyebrow, then each partner's mark at one
 * height in a row, a hairline between them, centred on the measure and
 * scaled down together when the measure is narrower than the row. The
 * pair drawn is the stock's: white on the black sheet, ink on cream. */
type MarkKey = "grizzlyBear" | "grizzlyWord" | "lvss" | "venue";
/* THE ROOM SPONSOR AND THE HOUSE, and not the meal partner (owner,
 * 2026-09-22: "let us not include Grizzly Health in the list of sponsors
 * on the shareables"). Their mono marks stay on disk; they are just not
 * in the order. */
const ORDER: { keys: MarkKey[]; gapEm: number }[] = [
  { keys: ["lvss"], gapEm: 0 },
  { keys: ["venue"], gapEm: 0 },
];

const partners = mod("partners", 80, (ctx, box, d, paint) => {
  const C = paint.c;
  const { tk } = paint;
  const bw = paint.assets.bw;
  if (!bw) return 0;
  const pick = (k: MarkKey) => (paint.stock === "bw" ? bw[`${k}White`] : bw[`${k}Ink`]) ?? null;
  const groups = ORDER.map((g) => g.keys.map((k) => ({ k, img: pick(k) })).filter((m) => m.img !== null)).filter((g) => g.length > 0);
  if (groups.length === 0) return 0;
  let y = paint.eyebrow(ctx, box.x, box.y, box.w, "Partners", `ROWTEMBER ${d.year}`);
  const markH0 = isPhone(paint) ? tk.statN * 0.95 : tk.statN * 1.7;
  const sep = tk.small * (isPhone(paint) ? 1.6 : 2.4);
  const widthAt = (h: number) =>
    groups.reduce((w, g, gi) => {
      const inner = g.reduce((s, m, i) => {
        const im = m.img as HTMLImageElement;
        const ratio = im.naturalWidth / Math.max(1, im.naturalHeight);
        return s + ratio * h + (i > 0 ? ORDER[gi].gapEm * h : 0);
      }, 0);
      return w + inner + (gi > 0 ? sep * 2 + tk.hair : 0);
    }, 0);
  let markH = markH0;
  const need = widthAt(markH);
  if (need > box.w) markH = (markH * box.w) / need;
  const total = widthAt(markH);
  let x = box.x + (box.w - total) / 2;
  const top = y + tk.small * 0.4;
  groups.forEach((g, gi) => {
    if (gi > 0) {
      x += sep;
      paint.rule(ctx, x, top, tk.hair, markH, C.line);
      x += tk.hair + sep;
    }
    g.forEach((m, i) => {
      const im = m.img as HTMLImageElement;
      const ratio = im.naturalWidth / Math.max(1, im.naturalHeight);
      if (i > 0) x += ORDER[gi].gapEm * markH;
      paint.image(ctx, im, x, top, ratio * markH, markH);
      x += ratio * markH;
    });
  });
  y = top + markH + tk.small * 1.2;
  return y - box.y;
});

/* S5. FOR YOURSELF AND OTHERS. */
const footer = mod("footer", 40, (ctx, box, _d, paint) => drawFooter(ctx, paint, box));

/* ------------------------------------------------------------- plans */

/* The wall sheets: two columns, the men's board left and the women's
 * right. The boards take the slack, so the partners sit at the foot over
 * the footer rather than under a hole. */
const sideBySide = (key: PosterPlan["key"], next?: PosterPlan["key"]): PosterPlan => ({
  key,
  cols: 2,
  rows: [
    { id: "A", slots: [{ module: "masthead", span: 2 }] },
    { id: "B", slots: [{ module: "title", span: 2 }] },
    {
      id: "C",
      slots: [
        { module: "board.men", span: 1 },
        { module: "board.women", span: 1 },
      ],
      grow: 1,
    },
    { id: "D", slots: [{ module: "partners", span: 2 }] },
  ],
  footer: "footer",
  shrink: ["gap", "cap"],
  ...(next ? { next } : {}),
});

/* The phone frames: one over the other. */
const stacked = (key: PosterPlan["key"]): PosterPlan => ({
  key,
  cols: 2,
  rows: [
    { id: "A", slots: [{ module: "masthead", span: 2 }] },
    { id: "B", slots: [{ module: "title", span: 2 }] },
    { id: "C", slots: [{ module: "board.men", span: 2 }] },
    { id: "D", slots: [{ module: "board.women", span: 2 }], grow: 1 },
    { id: "E", slots: [{ module: "partners", span: 2 }] },
  ],
  footer: "footer",
  shrink: ["gap", "cap"],
});

export const topTenLayout: PosterLayout<CommunityPoster> = {
  subject: "community",
  modules: { masthead, title, "board.men": boardMen, "board.women": boardWomen, partners, footer },
  plans: {
    tall: sideBySide("tall", "short"),
    short: sideBySide("short", "squat"),
    squat: sideBySide("squat", "core"),
    core: sideBySide("core"),
    story: stacked("story"),
    post: stacked("post"),
    square: stacked("square"),
  },
};
