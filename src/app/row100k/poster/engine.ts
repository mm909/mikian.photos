/* poster/engine.ts — the flow engine (SPEC.md §8) and the render pipeline
 * (§9, §10.1–2).
 *
 * compose() turns a plan into a sheet: every module is measured at its
 * column width, rows stack, the footer is pinned to the bottom margin,
 * overflow is spent by the plan's drop list, then its shrink order, then
 * by cascading to the next plan; slack is spent by the named elastic rows
 * and then the gaps. Deterministic — two agents given the same data and
 * plan draw the same sheet — and the engine never knows what a module
 * draws: it knows modules by id and plans by key, and reads heights.
 *
 * render() puts that on a canvas sized to the format's pixels with ONE
 * ctx.scale (300 ppi is the same drawing at twice the 150 ppi scale). The
 * allocation probe and the ppi ladder are here too, because an over-limit
 * canvas fails SILENTLY — fillRect no-ops, getImageData reads zeros, no
 * exception — so a try/catch proves nothing. */

import { fmtRowerNumber } from "@/lib/row100k";
import { FORMATS, pixelsFor, pointsFor, tokensFor } from "./formats";
import { PAPER, makePaint } from "./paint";
import { jpegToPdf } from "./pdf";
import type {
  PosterAssets,
  PosterData,
  PosterFonts,
  PosterFormat,
  PosterLayout,
  PosterLayoutLog,
  PosterModule,
  PosterPaint,
  PosterPlan,
  PosterPlanKey,
  PosterPpi,
  PosterRenderTarget,
  PosterRow,
  PosterShrink,
  PosterSlot,
  PosterTokens,
} from "./types";

type Ctx = CanvasRenderingContext2D;

/* The modules the `chart` shrink step measures at their minimum instead
 * of what they ask for (SPEC.md §8.4: "curve / pace at their minimum").
 * Named here because the engine reaches them by id; the same step also
 * sets tk.chart on the paint clone for a module that wants to know. */
export const CHART_IDS = new Set(["curve", "pace"]);

/* A cut that lands exactly on the region re-reads as a hair over it once
 * the total is summed back from the rows (floating point), which would
 * spend a shrink step on nothing; every fit test allows this much. */
export const EPS = 1e-6;

/* ----------------------------------------------------------- measuring */

type SlotM = {
  slot: PosterSlot;
  ids: string[];
  x: number;
  w: number;
  /* Heights per member (one entry for a module slot). */
  hs: number[];
  /* The member that absorbs extra height in a stack: `grow`, else the
   * fit member (the last), else none. */
  growAt: number | null;
  /* The member a fit rule applies to (a module slot: 0). */
  fitAt: number | null;
  h: number;
};

type RowM = { row: PosterRow; slots: SlotM[]; h: number };

type Composed = {
  plan: PosterPlan;
  rows: RowM[];
  footerH: number;
  dropped: string[];
  shrinks: PosterShrink[];
  gap: number;
  /* Extra gap between rows after the grow pass. */
  gapExtra: number;
  slack: number;
  tk: PosterTokens;
};

function moduleOf<D extends PosterData>(layout: PosterLayout<D>, id: string): PosterModule<D> {
  const m = layout.modules[id];
  if (!m) throw new Error(`poster: layout "${layout.subject}" has no module "${id}"`);
  return m;
}

function paintWith(paint: PosterPaint, tk: PosterTokens): PosterPaint {
  return { ...paint, tk };
}

/* The height a module wants at width w with an unbounded budget — or its
 * minimum under the `chart` step. */
function measureModule<D extends PosterData>(
  ctx: Ctx,
  layout: PosterLayout<D>,
  id: string,
  w: number,
  data: D,
  paint: PosterPaint,
  scale: number,
  chartMin: boolean,
): number {
  const m = moduleOf(layout, id);
  if (!m.measure) return m.minH;
  ctx.save();
  const h = m.measure(ctx, { x: 0, y: 0, w, h: Number.POSITIVE_INFINITY }, data, paint.fonts, paint, scale);
  ctx.restore();
  // Under the `chart` step the curve and the pace measure at their
  // minimum — but the minimum is per FAMILY (a wall curve wants 210, the
  // phone's 115), and `minH` is the floor across families; so a chart is
  // asked again on the clone carrying tk.chart and held at no less than
  // its floor. A module that wants a different chart-step size reads
  // paint.tk.chart itself.
  if (chartMin && CHART_IDS.has(id)) return Math.max(m.minH, h);
  return Math.max(0, h);
}

function slotIds(slot: PosterSlot): string[] {
  return "module" in slot ? [slot.module] : slot.stack;
}

/* Lay a plan's rows out at the format's columns and measure every slot.
 * `removed` holds the ids dropped so far — a slot with nothing left is
 * skipped and an emptied row goes with its gap. */
function measurePlan<D extends PosterData>(
  ctx: Ctx,
  layout: PosterLayout<D>,
  plan: PosterPlan,
  format: PosterFormat,
  data: D,
  paint: PosterPaint,
  scale: number,
  removed: Set<string>,
  chartMin: boolean,
): RowM[] {
  const tk = paint.tk;
  const left = format.margins.left;
  const width = format.w - format.margins.left - format.margins.right;
  const colW = (width - tk.gutter * (plan.cols - 1)) / plan.cols;
  const rows: RowM[] = [];
  for (const row of plan.rows) {
    const slots: SlotM[] = [];
    let x = left;
    for (const slot of row.slots) {
      const ids = slotIds(slot).filter((id) => !removed.has(id));
      const w = slot.span * colW + (slot.span - 1) * tk.gutter;
      if (ids.length > 0) {
        const hs = ids.map((id) => measureModule(ctx, layout, id, w, data, paint, scale, chartMin));
        const growName = "stack" in slot ? slot.grow : undefined;
        let growAt: number | null = growName ? ids.indexOf(growName) : -1;
        if (growAt < 0) growAt = slot.fit ? ids.length - 1 : null;
        const fitAt = slot.fit
          ? growName && ids.includes(growName)
            ? ids.indexOf(growName)
            : ids.length - 1
          : null;
        const h = hs.reduce((a, b) => a + b, 0) + tk.gap * (ids.length - 1);
        slots.push({ slot, ids, x, w, hs, growAt, fitAt, h });
      }
      x += w + tk.gutter;
    }
    if (slots.length === 0) continue;
    rows.push({ row, slots, h: Math.max(...slots.map((s) => s.h)) });
  }
  return rows;
}

/* A row every slot of which has yielded to nothing takes no gap either. */
const liveRows = (rows: RowM[]): RowM[] => rows.filter((r) => r.h > 0);

const totalOf = (rows: RowM[], gap: number): number => {
  const live = liveRows(rows);
  return live.reduce((a, r) => a + r.h, 0) + gap * Math.max(0, live.length - 1);
};

/* Set a slot's height to `h`, spending the cut on its fit member. */
function cutSlot(slot: SlotM, h: number, gap: number): void {
  const at = slot.fitAt ?? slot.growAt;
  if (at === null) return;
  const others = slot.hs.reduce((a, v, i) => (i === at ? a : a + v), 0) + gap * (slot.ids.length - 1);
  slot.hs[at] = Math.max(0, h - others);
  slot.h = others + slot.hs[at];
}

/* Fit slots cut to what remains, last row first (SPEC.md §8.4). A slot
 * may shrink to its fit member's minH — or, when `toZero`, a "lines"
 * slot to nothing — but a cut only helps when the slot is the tallest in
 * its row. `kinds` says which fit rules take part: the "lines yield
 * first" pass trims lines slots alone (down to their minimum) before the
 * plan drops anything — "the ledger is the first module to yield on 3:4"
 * (§7 short); the `cap` step then cuts cap slots and lets lines slots go
 * to nothing. Returns what is still over. */
function capRows<D extends PosterData>(
  layout: PosterLayout<D>,
  rows: RowM[],
  gap: number,
  over: number,
  kinds: ReadonlySet<"cap" | "lines">,
  toZero: boolean,
): number {
  for (let r = rows.length - 1; r >= 0 && over > 0; r--) {
    const row = rows[r];
    for (const slot of row.slots) {
      const fit = slot.slot.fit;
      if (!fit || fit === "all" || !kinds.has(fit) || slot.fitAt === null || over <= 0) continue;
      const m = moduleOf(layout, slot.ids[slot.fitAt]);
      const floor = fit === "lines" && toZero ? 0 : m.minH;
      const others =
        slot.hs.reduce((a, v, i) => (i === slot.fitAt ? a : a + v), 0) + gap * (slot.ids.length - 1);
      const minSlot = others + floor;
      const otherSlots = Math.max(0, ...row.slots.filter((s) => s !== slot).map((s) => s.h));
      const target = Math.max(minSlot, otherSlots, row.h - over);
      if (target >= row.h) continue;
      const before = row.h;
      cutSlot(slot, target, gap);
      // A lines slot cut under its minimum draws nothing: give the member 0.
      if (fit === "lines" && toZero && slot.hs[slot.fitAt] < m.minH) {
        slot.hs[slot.fitAt] = 0;
        slot.h = others;
      }
      row.h = Math.max(...row.slots.map((s) => s.h));
      // The WHOLE cut, the zeroing included — spending only the asked-for
      // cut left the room a zeroed slot freed as paper above the footer
      // (the rower post's month row never grew into it). `over` may go
      // negative; composePlan's `region + left` is the same arithmetic.
      over -= before - row.h;
    }
  }
  return over;
}

const LINES_ONLY: ReadonlySet<"cap" | "lines"> = new Set(["lines"]);
const CAP_AND_LINES: ReadonlySet<"cap" | "lines"> = new Set(["cap", "lines"]);

/* ------------------------------------------------------------ compose */

export type ComposeOpts<D extends PosterData> = {
  ctx: Ctx;
  layout: PosterLayout<D>;
  format: PosterFormat;
  data: D;
  paint: PosterPaint;
  scale: number;
  /* Draw, or only measure (the studio's dev log without a paint). */
  draw?: boolean;
};

function planFor<D extends PosterData>(layout: PosterLayout<D>, key: PosterPlanKey): PosterPlan {
  const plan = layout.plans[key];
  if (!plan) throw new Error(`poster: layout "${layout.subject}" has no plan "${key}"`);
  return plan;
}

/* One plan, measured, dropped, shrunk and grown — or null when it cannot
 * hold its rows and has a `next` to cascade to. */
function composePlan<D extends PosterData>(
  o: ComposeOpts<D>,
  key: PosterPlanKey,
  terminal: boolean,
): Composed | null {
  const { ctx, layout, format, data, scale } = o;
  const plan = planFor(layout, key);
  const base = o.paint.tk;
  const width = format.w - format.margins.left - format.margins.right;

  let tk: PosterTokens = { ...base };
  let paint = paintWith(o.paint, tk);
  let chartMin = false;
  const removed = new Set<string>();
  const dropped: string[] = [];
  const shrinks: PosterShrink[] = [];

  const footerH = measureModule(ctx, layout, plan.footer, width, data, paint, scale, false);
  // The rows' budget: the sheet less the margins, the pinned footer and
  // the gap above it — that gap follows the `gap` step like every other
  // (the rower post's two bests lines were 2.8 units short of a footer
  // gap that never shrank).
  const regionOf = (gap: number) => format.h - format.margins.bottom - footerH - gap - format.margins.top;
  let region = regionOf(base.gap);

  let rows = measurePlan(ctx, layout, plan, format, data, paint, scale, removed, chartMin);
  let total = totalOf(rows, tk.gap);

  // Lines slots yield first: a ledger under the month draws the lines
  // that fit, down to its minimum, before the plan drops or shrinks
  // anything. Not to nothing here — the `gap` step alone finds the two
  // lines a square or a post is a few units short of, and a slot zeroed
  // before that step left the square with no takeaways and a dead band
  // above the footer. The `cap` step and the terminal last resort are
  // where a lines slot goes to nothing. The total is re-read from the
  // rows after every cut: a row that yielded to nothing takes no gap.
  const yieldLines = () => {
    if (total <= region + EPS) return;
    capRows(layout, rows, tk.gap, total - region, LINES_ONLY, false);
    total = totalOf(rows, tk.gap);
  };
  yieldLines();

  // 3. Drop.
  const dropList = plan.drop ?? [];
  for (let i = 0; i < dropList.length && total > region + EPS; i++) {
    removed.add(dropList[i]);
    dropped.push(dropList[i]);
    rows = measurePlan(ctx, layout, plan, format, data, paint, scale, removed, chartMin);
    total = totalOf(rows, tk.gap);
    yieldLines();
  }

  // 4. Shrink, one step each, in the plan's order.
  for (const step of plan.shrink) {
    if (total <= region + EPS) break;
    shrinks.push(step);
    if (step === "gap") tk = { ...tk, gap: tk.gap * 0.8 };
    else if (step === "pitch") tk = { ...tk, rowPitch: tk.rowPitch * 0.9 };
    else if (step === "chart") {
      chartMin = true;
      tk = { ...tk, chart: true };
    } else if (step === "step") tk = { ...tk, step: true };
    paint = paintWith(o.paint, tk);
    region = regionOf(tk.gap);
    rows = measurePlan(ctx, layout, plan, format, data, paint, scale, removed, chartMin);
    total = totalOf(rows, tk.gap);
    yieldLines();
    if (step === "cap" && total > region + EPS) {
      capRows(layout, rows, tk.gap, total - region, CAP_AND_LINES, true);
      total = totalOf(rows, tk.gap);
    }
  }

  // 5. Cascade — or, on a terminal plan, the last resort: every fit slot
  // cut to what remains, then to nothing, and the gaps to 0.6×.
  if (total > region + EPS) {
    if (!terminal) return null;
    capRows(layout, rows, tk.gap, total - region, CAP_AND_LINES, true);
    total = totalOf(rows, tk.gap);
  }
  if (total > region + EPS) {
    for (const row of rows) {
      for (const slot of row.slots) {
        if (slot.slot.fit && slot.slot.fit !== "all" && slot.fitAt !== null) {
          slot.hs[slot.fitAt] = 0;
          slot.h = slot.hs.reduce((a, b) => a + b, 0) + tk.gap * (slot.ids.length - 1);
        }
      }
      row.h = Math.max(...row.slots.map((s) => s.h));
    }
    tk = { ...tk, gap: tk.gap * 0.6 };
    paint = paintWith(o.paint, tk);
    region = regionOf(tk.gap);
    total = totalOf(rows, tk.gap);
  }

  // 6. Grow.
  let slack = region - total;
  if (Math.abs(slack) < EPS) slack = 0;
  const growRows = rows
    .filter((r) => typeof r.row.grow === "number")
    .sort((a, b) => (a.row.grow ?? 0) - (b.row.grow ?? 0));
  for (const r of growRows) {
    if (slack <= 0) break;
    const maxH = r.row.maxH ?? Number.POSITIVE_INFINITY;
    const add = Math.max(0, Math.min(slack, maxH - r.h));
    if (add <= 0) continue;
    r.h += add;
    slack -= add;
  }
  // Every slot lives in its row's height: a module slot's box is the row;
  // a stack hands the extra to its grow member (or its fit member).
  for (const r of rows) {
    for (const slot of r.slots) {
      if (slot.ids.length === 1) {
        slot.hs[0] = r.h;
        slot.h = r.h;
        continue;
      }
      const at = slot.growAt;
      if (at !== null && r.h > slot.h) {
        slot.hs[at] += r.h - slot.h;
        slot.h = r.h;
      }
    }
  }
  let gapExtra = 0;
  const nGaps = Math.max(0, liveRows(rows).length - 1);
  if (slack > 0 && nGaps > 0) {
    gapExtra = Math.min(slack / nGaps, tk.gap * 0.5);
    slack -= gapExtra * nGaps;
  }

  return { plan, rows: liveRows(rows), footerH, dropped, shrinks, gap: tk.gap, gapExtra, slack, tk };
}

/* The cascade: the format's first plan, then each `next` until one holds;
 * a terminal plan holds by force (§8.5). Draws unless told not to. */
export function compose<D extends PosterData>(o: ComposeOpts<D>): PosterLayoutLog {
  const { ctx, layout, format, data, scale } = o;
  const seen = new Set<PosterPlanKey>();
  let key: PosterPlanKey = format.plan;
  let composed: Composed | null = null;
  for (;;) {
    seen.add(key);
    const plan = planFor(layout, key);
    const next = plan.next && !seen.has(plan.next) ? plan.next : undefined;
    composed = composePlan(o, key, next === undefined);
    if (composed) break;
    key = next as PosterPlanKey;
  }

  const c = composed;
  const paint = paintWith(o.paint, c.tk);
  const log: PosterLayoutLog = {
    plan: c.plan.key,
    rows: [],
    dropped: c.dropped,
    shrinks: c.shrinks,
    slack: Math.round(c.slack * 10) / 10,
  };
  if (c.slack < -EPS) console.error(`poster: plan ${c.plan.key} still over by ${-c.slack} on ${format.key}`);

  const drawModule = (id: string, x: number, y: number, w: number, h: number): void => {
    const m = moduleOf(layout, id);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    let used = 0;
    try {
      used = m.draw(ctx, { x, y, w, h }, data, paint.fonts, paint, scale);
    } finally {
      ctx.restore();
    }
    if (used > h + 0.5) console.error(`poster: module ${id} drew ${used} into a box of ${h} (${format.key})`);
  };

  let y = format.margins.top;
  for (let i = 0; i < c.rows.length; i++) {
    const r = c.rows[i];
    const names: string[] = [];
    for (const slot of r.slots) {
      const spanTag = slot.slot.span > 1 ? `×${slot.slot.span}` : "";
      names.push(
        slot.ids.length === 1
          ? `${slot.ids[0]}${spanTag} ${Math.round(slot.hs[0])}`
          : `{${slot.ids.map((id, k) => `${id} ${Math.round(slot.hs[k])}`).join(", ")}}${spanTag}`,
      );
      if (o.draw !== false) {
        let my = y;
        for (let k = 0; k < slot.ids.length; k++) {
          const h = slot.hs[k];
          if (h > 0) drawModule(slot.ids[k], slot.x, my, slot.w, h);
          my += h + (h > 0 ? c.gap : 0);
        }
      }
    }
    log.rows.push({ id: r.row.id, h: Math.round(r.h), slots: names });
    y += r.h + c.gap + c.gapExtra;
  }
  const width = format.w - format.margins.left - format.margins.right;
  const footerY = format.h - format.margins.bottom - c.footerH;
  if (o.draw !== false) drawModule(c.plan.footer, format.margins.left, footerY, width, c.footerH);
  log.rows.push({ id: "footer", h: Math.round(c.footerH), slots: [c.plan.footer] });
  return log;
}

/* -------------------------------------------------------------- targets */

/* One render target: the format at a ppi (null on Instagram), with bleed
 * in inches per edge. `scale` is pixels per logical unit, `offset` the
 * bleed in pixels. */
export function targetFor(
  format: PosterFormat,
  ppi: PosterPpi | null,
  bleedIn = 0,
  fellBack = false,
): PosterRenderTarget {
  const bleed = format.kind === "print" ? bleedIn : 0;
  const px = pixelsFor(format, ppi, bleed);
  const p = format.kind === "print" ? (ppi ?? format.ppi?.default ?? 150) : null;
  const scale =
    format.kind === "print" ? (p as number) * ((format.inches?.w ?? 0) / format.w) : px.w / format.w;
  const off = format.kind === "print" ? bleed * (p as number) : 0;
  return {
    format,
    ppi: p,
    bleedIn: bleed,
    pxW: px.w,
    pxH: px.h,
    scale,
    offset: { x: off, y: off },
    fellBack,
  };
}

/* The preview: the same drawing at about `cssWidth` px, device-pixel-ratio
 * aware but never past 2×. No bleed — the preview shows the trim. */
export function previewTarget(format: PosterFormat, cssWidth: number, dpr = 1): PosterRenderTarget {
  const pxW = Math.max(200, Math.round(cssWidth * Math.min(2, Math.max(1, dpr))));
  const scale = pxW / format.w;
  return {
    format,
    ppi: null,
    bleedIn: 0,
    pxW,
    pxH: Math.round(format.h * scale),
    scale,
    offset: { x: 0, y: 0 },
    fellBack: false,
  };
}

/* The allocation probe (SPEC.md §9.3). An over-limit canvas fails
 * silently, so the proof is a pixel read back and a non-null blob. Cached
 * per size for the session; freed in `finally`. */
const probed = new Map<string, boolean>();

export async function probeCanvas(w: number, h: number): Promise<boolean> {
  const key = `${w}x${h}`;
  const known = probed.get(key);
  if (known !== undefined) return known;
  let ok = false;
  const canvas = document.createElement("canvas");
  try {
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#0077B6";
      ctx.fillRect(w - 2, h - 2, 1, 1);
      const px = ctx.getImageData(w - 2, h - 2, 1, 1).data;
      if (px[0] === 0 && px[1] === 119 && px[2] === 182 && px[3] === 255) {
        const blob = await new Promise<Blob | null>((resolve) => {
          try {
            canvas.toBlob((b) => resolve(b), "image/png");
          } catch {
            resolve(null);
          }
        });
        ok = blob !== null;
      }
    }
  } catch {
    ok = false;
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
  probed.set(key, ok);
  return ok;
}

export const PPI_LADDER: PosterPpi[] = [300, 200, 150, 100];

/* Try `wanted`, then 300 → 200 → 150 → 100 skipping anything at or above a
 * failed value; the first pass wins. `refuse` lets the dev fixture force a
 * fallback (?noprobe=300). Instagram targets probe once at their fixed
 * frame. */
export async function ladder(
  format: PosterFormat,
  wanted: PosterPpi | null,
  bleedIn = 0,
  refuse: PosterPpi[] = [],
): Promise<PosterRenderTarget> {
  if (format.kind !== "print") return targetFor(format, null, 0);
  const want = wanted ?? format.ppi?.default ?? 150;
  const tried = new Set<PosterPpi>();
  let failedAt = Number.POSITIVE_INFINITY;
  for (const p of [want, ...PPI_LADDER]) {
    if (tried.has(p) || p >= failedAt) continue;
    tried.add(p);
    const px = pixelsFor(format, p, bleedIn);
    const ok = !refuse.includes(p) && (await probeCanvas(px.w, px.h));
    if (ok) return targetFor(format, p, bleedIn, p !== want);
    failedAt = Math.min(failedAt, p);
  }
  // Nothing passed: hand back the smallest rung and let the encode say so.
  return targetFor(format, 100, bleedIn, true);
}

/* --------------------------------------------------------------- render */

export type RenderInput<D extends PosterData> = {
  target: PosterRenderTarget;
  layout: PosterLayout<D>;
  data: D;
  fonts: PosterFonts;
  assets: PosterAssets;
};

/* One detached canvas at the target's pixels: paper over everything (the
 * PDF's JPEG has no alpha — an unpainted canvas encodes as black), then
 * translate by the bleed, scale once, compose. Never mounted; the caller
 * frees it with freeCanvas after encoding. */
export function render<D extends PosterData>(
  input: RenderInput<D>,
): { canvas: HTMLCanvasElement; log: PosterLayoutLog } {
  const { target, layout, data, fonts, assets } = input;
  const canvas = document.createElement("canvas");
  canvas.width = target.pxW;
  canvas.height = target.pxH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("poster: no 2d context");
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, target.pxW, target.pxH);
  const paint = makePaint({ tk: tokensFor(target.format), format: target.format, fonts, assets });
  ctx.save();
  ctx.translate(target.offset.x, target.offset.y);
  ctx.scale(target.scale, target.scale);
  let log: PosterLayoutLog;
  try {
    log = compose({ ctx, layout, format: target.format, data, paint, scale: target.scale });
  } finally {
    ctx.restore();
  }
  return { canvas, log };
}

export function freeCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 1;
  canvas.height = 1;
}

function blobOf(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error(`poster: ${type} encode returned null`))),
        type,
        quality,
      );
    } catch (err) {
      reject(err);
    }
  });
}

export const toPng = (canvas: HTMLCanvasElement): Promise<Blob> => blobOf(canvas, "image/png");
export const toJpeg = (canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> =>
  blobOf(canvas, "image/jpeg", quality);

/* The PDF of a print render: the JPEG of the same canvas on a page of the
 * true size (bleed included in the MediaBox, the trim as TrimBox). */
export async function toPdf(canvas: HTMLCanvasElement, target: PosterRenderTarget): Promise<Blob> {
  const pts = pointsFor(target.format, target.bleedIn);
  if (!pts) throw new Error(`poster: ${target.format.key} has no page size`);
  const jpeg = new Uint8Array(await (await toJpeg(canvas)).arrayBuffer());
  const b = target.bleedIn * 72;
  const trim: [number, number, number, number] | undefined =
    target.bleedIn > 0 ? [b, b, pts.w - b, pts.h - b] : undefined;
  return jpegToPdf(jpeg, pts.w, pts.h, { trimPt: trim });
}

/* ------------------------------------------------------------ filenames */

/* rowtember-2026-poster-24x36.pdf · rower-013-story.png · a ppi other than
 * the format's default appends -300ppi; bleed appends -bleed (SPEC.md §2). */
export function fileName(
  data: PosterData,
  format: PosterFormat,
  ext: "png" | "pdf",
  opts: { ppi?: PosterPpi | null; bleed?: boolean } = {},
): string {
  const subject =
    data.kind === "community" ? `rowtember-${data.year}` : `rower-${fmtRowerNumber(data.rower.rowerNumber)}`;
  let suffix = "";
  if (format.kind === "print" && opts.ppi && format.ppi && opts.ppi !== format.ppi.default)
    suffix += `-${opts.ppi}ppi`;
  if (format.kind === "print" && opts.bleed) suffix += "-bleed";
  return `${subject}-${format.stem}${suffix}.${ext}`;
}

/* The format a key names, defaulting to the 24x36. */
export function formatOf(key: string | null | undefined): PosterFormat {
  return (key && FORMATS[key as keyof typeof FORMATS]) || FORMATS["24x36"];
}
