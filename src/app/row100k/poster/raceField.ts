/* poster/raceField.ts — THE FIELD: race day's second artwork, the start
 * list (owner, 2026-09-16: "I want a poster showing what racers are coming
 * to race day").
 *
 * It is the bill with the names where the ways and the facts go: the same
 * masthead (ROWTEMBER 2026 / SUN SEP 27), RACE over DAY on paper and RACE
 * DAY on one line on a phone — back to the stack on a story or a 4:5 when
 * the field is short enough to hand the room back (head.auto, review
 * 2026-09-16) — the piece and the first wave under it, then
 * THE FIELD — the racers who are coming — and a foot that counts them, sets
 * the venue mark as the credit and closes on the short address. Solid ink
 * only: nobody asked for a start list over a photograph, so the artwork
 * takes no ground and the studio hides the ground chips while it is up.
 *
 * WHAT IS ON THE LIST, AND WHAT IS NOT. Names, rower numbers, the bracket
 * letter, the wave and the lane — every one of them public, the race day
 * page prints the field already. NO meters and NO times: the seeded order
 * inside a wave was cut on the server from a clock this payload never
 * carries (raceAssemble raceFieldOf), so the module could not print one if
 * it tried. Withdrawn rowers are off it; spectators are in the count and
 * never in the list. With waves assigned the list runs by wave under a
 * mono eyebrow (WAVE 1 · 6:15 PM, off waveTime and never typed); before
 * that it is the whole field A to Z.
 *
 * HOW IT FITS. The names run in as many columns as the measure holds at a
 * readable size — the family's row token, falling ONCE to a small step
 * that never goes under the small token — and when the field is longer
 * than the frame holds the last slot says how many are not on it (+12
 * MORE) rather than overflowing. The head is still the grow row, as on the
 * bill: a short field on a wall sheet hands its room back to RACE and
 * DAY, which is the signature and not a hole. On paper the head asks less
 * of the sheet than the bill's does (FIELD_HEAD_SHARE) so the names keep
 * the lower half.
 *
 * Every mechanic and every grey is the bill's, imported from raceday.ts,
 * so the two artworks cannot drift a rung apart. */

import { fmtRowerNumber } from "@/lib/row100k";
import {
  MARK_SHARE,
  RACE_TONES,
  raceBlocks,
  raceCapOf,
  raceColOf,
  raceHeadMod,
  raceInset,
  raceMod,
} from "./raceday";
import type {
  PosterBox,
  PosterLayout,
  PosterModule,
  PosterPaint,
  PosterPlan,
  PosterPlanKey,
  PosterRow,
  RaceDayFieldRow,
  RaceDayPoster,
} from "./types";

type Ctx = CanvasRenderingContext2D;
type Mod = PosterModule<RaceDayPoster>;

const { WHITE, BONE, KEY, QUIET, HAIR, FAINT } = RACE_TONES;

/* The head's share of a PAPER sheet on this artwork (the bill takes 0.22).
 * The names are the picture here, so the headline measures for less and
 * only grows back when the field is short enough to leave the room. The
 * phone frames MEASURE the one-line head, which is at its flush fit under
 * any share, and an auto stack budgets against the room it was handed
 * (raceday.ts headMod), so this number never reaches them. */
const FIELD_HEAD_SHARE = 0.16;

/* No column shorter than this unless the field itself is: twelve names in
 * four columns of three reads as a table that lost its rows. */
const ROWS_MIN = 6;

/* Columns a family may run. Four on a wall sheet, two on a phone; the
 * measure decides the rest (colsFor). */
const COLS_MAX: Record<string, number> = { printL: 4, phone: 2 };

/* ----------------------------------------------------------- the items */

/* One slot of a column: a wave eyebrow, a racer, or the overflow count. */
type Item = { kind: "eye"; text: string } | { kind: "row"; r: RaceDayFieldRow } | { kind: "more"; n: number };

/* The list as slots, in the order the payload put it. A wave eyebrow opens
 * each group; a racer still without a wave (the console has assigned some
 * but not all) sits last under his own eyebrow rather than in nobody's. */
function itemsOf(d: RaceDayPoster): { items: Item[]; rows: number; byWave: boolean } {
  const f = d.field;
  if (!f) return { items: [], rows: 0, byWave: false };
  const byWave = f.waves.length > 0;
  if (!byWave) return { items: f.list.map((r) => ({ kind: "row", r })), rows: f.list.length, byWave };
  const label = new Map(f.waves.map((w) => [w.wave, w.label]));
  const items: Item[] = [];
  let last: number | null | undefined;
  for (const r of f.list) {
    if (r.wave !== last) {
      items.push({
        kind: "eye",
        text: r.wave === null ? "NO WAVE YET" : (label.get(r.wave) ?? `WAVE ${r.wave}`),
      });
      last = r.wave;
    }
    items.push({ kind: "row", r });
  }
  return { items, rows: f.list.length, byWave };
}

/* Fill the columns top to bottom, `perCol` slots each. An eyebrow that
 * would land on a column's last slot moves to the next column instead — a
 * heading with nothing under it is worse than a blank slot. `over` is the
 * RACERS that did not fit, not the slots. */
function place(items: Item[], cols: number, perCol: number): { columns: Item[][]; over: number } {
  const columns: Item[][] = Array.from({ length: cols }, () => []);
  let c = 0;
  let i = 0;
  while (i < items.length && c < cols) {
    const col = columns[c];
    if (col.length >= perCol) {
      c++;
      continue;
    }
    const it = items[i];
    if (it.kind === "eye" && perCol > 1 && col.length === perCol - 1) {
      c++;
      continue;
    }
    col.push(it);
    i++;
  }
  let over = 0;
  for (let k = i; k < items.length; k++) if (items[k].kind === "row") over++;
  return { columns, over };
}

/* ----------------------------------------------------------- the type */

/* The two steps a list may set in. `pitch` is the slot; nothing here goes
 * under the family's small token (10 on both), which is the floor the
 * owner's brief drew. */
type Step = { name: number; mono: number; pitch: number };

const stepsOf = (tk: PosterPaint["tk"]): Step[] => [
  { name: tk.row, mono: Math.max(tk.small, tk.row * 0.86), pitch: tk.rowPitch * 0.82 },
  { name: Math.max(tk.small, tk.small * 1.15), mono: tk.small, pitch: tk.rowPitch * 0.66 },
];

type Geom = {
  step: Step;
  cols: number;
  colW: number;
  fName: string;
  fMono: string;
  fMonoB: string;
  lh: number;
  metN: ReturnType<PosterPaint["metricsOf"]>;
  numW: number;
};

/* What one column needs at a step: the number, the widest name (capped at
 * about twenty characters — a longer one ellipsizes in its column rather
 * than costing everyone a column), the bracket and a lane. Then as many
 * columns as the measure holds, never more than the family allows, and
 * never so many that a column runs under ROWS_MIN. */
function geomOf(
  ctx: Ctx,
  paint: PosterPaint,
  step: Step,
  w: number,
  gutter: number,
  list: RaceDayFieldRow[],
): Geom {
  const tk = paint.tk;
  const fName = paint.font("archivoBold", step.name);
  const fMono = paint.font("mono", step.mono);
  const fMonoB = paint.font("monoBold", step.mono);
  const metN = paint.metricsOf(ctx, fName, step.name);
  const numW = paint.measure(ctx, "000", fMono, step.mono * 0.04) + tk.small * 0.55;
  let widest = 0;
  for (const r of list) widest = Math.max(widest, paint.measure(ctx, r.name, fName, 0));
  const nameW = Math.min(widest, step.name * 11);
  const rightW = paint.measure(ctx, "W · L8", fMonoB, step.mono * 0.08);
  const need = numW + nameW + tk.small * 0.6 + rightW;
  const fit = Math.floor((w + gutter) / (need + gutter));
  const most = Math.max(1, Math.min(COLS_MAX[paint.format.family] ?? 2, fit));
  const cols = Math.max(1, Math.min(most, Math.ceil(list.length / ROWS_MIN)));
  const colW = (w - gutter * (cols - 1)) / cols;
  return { step, cols, colW, fName, fMono, fMonoB, lh: metN.lh, metN, numW };
}

/* ---------------------------------------------------------- the module */

function drawItem(ctx: Ctx, paint: PosterPaint, g: Geom, it: Item, x: number, top: number): void {
  const tk = paint.tk;
  const { step, colW } = g;
  const base = paint.baselineOf(top + (step.pitch - g.lh) / 2, g.lh, g.metN);
  if (it.kind === "eye") {
    paint.drawText(ctx, paint.ellipsize(ctx, it.text, colW, g.fMonoB, step.mono * 0.16), x, base, g.fMonoB, KEY, step.mono * 0.16);
    paint.rule(ctx, x, top + step.pitch - tk.hair, colW, tk.hair, FAINT);
    return;
  }
  if (it.kind === "more") {
    paint.drawText(ctx, `+${it.n} MORE`, x, base, g.fMonoB, QUIET, step.mono * 0.16);
    return;
  }
  const r = it.r;
  paint.drawText(ctx, fmtRowerNumber(r.rowerNumber), x, base, g.fMono, KEY, step.mono * 0.04);
  const right = r.lane === null ? r.bracket : `${r.bracket} · L${r.lane}`;
  const rightW = paint.drawRight(ctx, right, x + colW, base, g.fMonoB, BONE, step.mono * 0.08);
  const room = colW - g.numW - rightW - tk.small * 0.6;
  /* The name as the roster spells it — a list of forty names in caps is a
   * wall, and these are people, not copy. */
  paint.drawText(ctx, paint.ellipsize(ctx, r.name, room, g.fName, 0), x + g.numW, base, g.fName, WHITE, 0);
}

function drawField(ctx: Ctx, box: PosterBox, d: RaceDayPoster, paint: PosterPaint): number {
  const tk = paint.tk;
  const { x, w } = raceColOf(box, paint);
  const { items, rows, byWave } = itemsOf(d);
  const list = d.field?.list ?? [];

  // The section head: the ways table's eyebrow, with a quiet descriptor
  // opposite saying how the list is cut, and a hairline under.
  const hs = tk.small * 1.05;
  const fh = paint.font("monoBold", hs);
  const metH = paint.metricsOf(ctx, fh, hs);
  const top = box.y + tk.small * 0.2;
  const hb = paint.baselineOf(top, metH.lh, metH);
  paint.drawText(ctx, "THE FIELD", x, hb, fh, KEY, hs * 0.2);
  const waves = d.field?.waves.length ?? 0;
  const how = byWave ? `${waves} ${waves === 1 ? "WAVE" : "WAVES"}` : "A TO Z";
  paint.drawRight(ctx, how, x + w, hb, paint.font("mono", hs), QUIET, hs * 0.14);
  let y = top + metH.lh + tk.small * 0.6;
  paint.rule(ctx, x, y, w, tk.hair, HAIR);
  y += tk.hair + tk.small * 0.8;
  const air = tk.small * 0.8;

  if (rows === 0) {
    // Nobody yet: one quiet line, and the foot still counts the spectators.
    const fs = paint.font("mono", hs);
    paint.drawText(ctx, "NOBODY IN YET", x, paint.baselineOf(y, metH.lh, metH), fs, QUIET, hs * 0.14);
    const natural = y + metH.lh + air - box.y;
    return Number.isFinite(box.h) ? box.h : natural;
  }

  const gutter = tk.gutter * 0.6;
  const finite = Number.isFinite(box.h);
  const avail = finite ? box.h - (y - box.y) - air : Number.POSITIVE_INFINITY;

  // The base step, then the small one: the first that holds the whole
  // field in the columns the measure allows. Columns are balanced — as few
  // slots each as hold everything, and one more when an eyebrow was pushed
  // on — up to what the box can take.
  let chosen: { g: Geom; columns: Item[][]; perCol: number } | null = null;
  for (const step of stepsOf(tk)) {
    const g = geomOf(ctx, paint, step, w, gutter, list);
    const hard = finite ? Math.floor(avail / step.pitch + 1e-6) : Number.POSITIVE_INFINITY;
    if (hard < 1) continue;
    let perCol = Math.min(hard, Math.ceil(items.length / g.cols));
    let p = place(items, g.cols, perCol);
    while (p.over > 0 && perCol < hard) {
      perCol++;
      p = place(items, g.cols, perCol);
    }
    if (p.over === 0) {
      chosen = { g, columns: p.columns, perCol };
      break;
    }
  }
  if (!chosen) {
    // Longer than the frame holds: the small step at every column the
    // measure allows, cut to what fits, and the last slot taken back for
    // the count so nothing runs off the sheet.
    const step = stepsOf(tk)[1];
    const g = geomOf(ctx, paint, step, w, gutter, list);
    const hard = Math.max(1, Math.floor(avail / step.pitch + 1e-6));
    const { columns, over } = place(items, g.cols, hard);
    let last = columns.length - 1;
    while (last > 0 && columns[last].length === 0) last--;
    const popped = columns[last].pop();
    columns[last].push({ kind: "more", n: over + (popped?.kind === "row" ? 1 : 0) });
    chosen = { g, columns, perCol: hard };
  }

  const { g, columns } = chosen;
  let used = 0;
  columns.forEach((col, c) => {
    const cx = x + c * (g.colW + gutter);
    col.forEach((it, k) => drawItem(ctx, paint, g, it, cx, y + k * g.step.pitch));
    used = Math.max(used, col.length);
  });
  const natural = y - box.y + used * g.step.pitch + air;
  return finite ? box.h : natural;
}

/* The list: a cap slot, so a frame that cannot hold the field cuts it to
 * what fits (drawField prints the count) rather than pushing the foot.
 * minH is the head and three slots in the widest family metric — the
 * floor the cap step may cut it to. */
const field = raceMod("field", 40 + 3 * 22, drawField);

/* THE FOOT, pinned: the count strip over a thick rule, the venue mark
 * flush left as the credit — the bill's host block — with the room and the
 * short address as a two-line block opposite it, centred on the mark. It
 * carries the format's bottom margin the way the bill's CTA does, because
 * the composition runs full bleed. */
const foot = raceMod("foot", 80, (ctx, box, d, paint) => {
  const tk = paint.tk;
  const m = raceInset(paint);
  const { x, w } = raceColOf(box, paint);
  let y = box.y;
  if (d.field) {
    const cs = tk.small * 1.05;
    const fc = paint.font("monoBold", cs);
    const met = paint.metricsOf(ctx, fc, cs);
    const strip = paint.ellipsize(ctx, d.field.counts, w, fc, cs * 0.16);
    paint.drawText(ctx, strip, x, paint.baselineOf(y, met.lh, met), fc, KEY, cs * 0.16);
    y += met.lh + tk.small * 0.9;
  }
  paint.rule(ctx, x, y, w, tk.thick, WHITE);
  y += tk.thick + tk.small * 1.2;
  const markW = w * MARK_SHARE;
  const ratio = d.race.venueMark?.ratio ?? 1170 / 466;
  const markH = markW / ratio;
  if (d.race.venueMark && paint.assets.venue) {
    paint.image(ctx, paint.assets.venue, x, y, markW, markH);
  } else {
    const vs = Math.min(markH * 0.62, paint.fitSize(ctx, d.race.venue, "black", 200, 10, markW, -0.02));
    const fv = paint.font("black", vs);
    paint.drawText(ctx, d.race.venue, x, y + (markH + raceCapOf(ctx, fv, vs)) / 2, fv, WHITE, -0.02 * vs);
  }
  const rs = tk.small * 1.02;
  const fr = paint.font("monoBold", rs);
  const metR = paint.metricsOf(ctx, fr, rs);
  const room = w - markW - tk.small * 1.6;
  const lead = rs * 0.35;
  const blockH = metR.lh * 2 + lead;
  const rTop = y + (markH - blockH) / 2;
  paint.drawRight(
    ctx,
    paint.ellipsize(ctx, d.race.room, room, fr, rs * 0.14),
    x + w,
    paint.baselineOf(rTop, metR.lh, metR),
    fr,
    WHITE,
    rs * 0.14,
  );
  paint.drawRight(
    ctx,
    paint.ellipsize(ctx, d.url, room, fr, rs * 0.14),
    x + w,
    paint.baselineOf(rTop + metR.lh + lead, metR.lh, metR),
    fr,
    KEY,
    rs * 0.14,
  );
  y += Math.max(markH, blockH) + tk.small * 1.1;
  return y + m.bottom - box.y;
});

/* ----------------------------------------------------------- the plans */

const one = (id: string, module: string, extra: Partial<PosterRow> = {}): PosterRow => ({
  id,
  slots: [{ module, span: 1 }],
  ...extra,
});

const capped = (id: string, module: string): PosterRow => ({
  id,
  slots: [{ module, span: 1, fit: "cap" }],
});

/* One stack on every frame: masthead, head (the grow row, as on the bill),
 * piece, the list. Paper takes RACE over DAY at the field's share. The
 * story and the 4:5 take head.auto — measured as the one-liner so the
 * names get the frame, drawn as the stack when a short field hands the
 * room back (review, 2026-09-16: a one-line head is already flush and
 * cannot spend a surplus as type, so sixteen racers on a story left RACE
 * DAY in ~70 units of air each side). The 1:1 keeps the one-liner, as the
 * bill's does: it never has the room for the stack. The only shrink step
 * is the cap on the list. */
const fieldPlan = (key: PosterPlanKey, head: string): PosterPlan => ({
  key,
  cols: 1,
  rows: [one("A", "mast"), one("B", head, { grow: 1 }), one("C", "piece"), capped("F", "field")],
  footer: "foot",
  drop: [],
  shrink: ["cap"],
});

const modules: Record<string, Mod> = {
  mast: raceBlocks.mast,
  piece: raceBlocks.piece,
  head: raceHeadMod("head", true, FIELD_HEAD_SHARE),
  "head.auto": raceHeadMod("head.auto", "auto", FIELD_HEAD_SHARE),
  "head.one": raceBlocks["head.one"],
  field,
  foot,
};

export const raceDayFieldLayout: PosterLayout<RaceDayPoster> = {
  subject: "raceday",
  modules,
  plans: {
    tall: fieldPlan("tall", "head"),
    short: fieldPlan("short", "head"),
    squat: fieldPlan("squat", "head"),
    core: fieldPlan("core", "head"),
    story: fieldPlan("story", "head.auto"),
    post: fieldPlan("post", "head.auto"),
    square: fieldPlan("square", "head.one"),
  },
};
