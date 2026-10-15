/* THE STICKERS' DRAWING KIT: the three looks, the type primitives and OUR
 * OWN MARKS, drawn as type (owner, 2026-10-15: "Don't use the circle JF
 * logo and the circle No Shortcuts logo — if we're going to use those,
 * let's make our own little stickers, remake them … I like using
 * justfriends spelt out with the dot rather than the logo"). No image
 * loads anywhere: the No Shortcuts lockup is Archivo Black caps with a
 * drawn arrow after it (our rendering of the arrow on their Instagram
 * mark) and the Just Friends wordmark is Archivo Black lower-case with the
 * lime dot as a disc. Both are used small and always the same way — one
 * line at the foot of a card — and never as the headline, except on THE
 * MARK, which is nothing but the lockup.
 *
 * Canvas only, no React, so a harness can paint with a mocked context.
 * shareCards.ts builds the cards out of this. */

export const W = 1080;
/* An 8-pt grid at 1080 px: 56 px padding, 24–40 px gaps. */
export const PAD = 56;
export const INNER = W - PAD * 2;
/* The corner of an ink or lime block in the sticker format. */
export const RADIUS = 48;

/* #D0F858 is the LASD page's --safety token, sampled from the Just Friends
 * mark (the file reads #d3fe5c). Ink is the page's near-black; the ink
 * look's block is a touch darker so lime type sits on it. */
export const LIME = "#D0F858";
export const INK = "#111110";
export const BLACK = "#0A0A0A";
export const PAPER = "#F4F3EE";

/* clear: nothing behind the type — for pasting over a photo. ink: a black
 * rounded block, lime type. lime: a lime block, ink type. The red No
 * Shortcuts look and the paper look are gone with the logos. */
export type Look = "clear" | "ink" | "lime";

export const LOOKS: { id: Look; label: string }[] = [
  { id: "clear", label: "Clear" },
  { id: "ink", label: "Ink" },
  { id: "lime", label: "Lime" },
];

/* The families next/font hands out, read off probe spans by the frame:
 * display = Archivo Black (the headline), cond = Barlow Condensed (labels,
 * weight 600), mono = IBM Plex Mono (the tiny eyebrow, weight 500). */
export type Fonts = { display: string; cond: string; mono: string };
export type Kit = { fonts: Fonts };

export type Palette = {
  /* The headline and the big values. */
  ink: string;
  /* Labels, eyebrows, the sentence under a name. */
  dim: string;
  /* Fills: the done part of a bar, the slot square. */
  accent: string;
  /* Type on an accent fill. */
  onAccent: string;
  /* The wordmark's word, and its dot — the dot stays lime wherever lime
   * shows against the ground; on the lime block it is paper. */
  word: string;
  dot: string;
  /* The empty part of a bar. */
  track: string;
  /* Null for the clear look: the canvas stays transparent. */
  ground: string | null;
};

export function palette(look: Look): Palette {
  switch (look) {
    case "clear":
      return { ink: INK, dim: "rgba(17,17,16,.66)", accent: LIME, onAccent: INK, word: INK, dot: LIME, track: "rgba(17,17,16,.22)", ground: null };
    case "ink":
      return { ink: LIME, dim: "rgba(244,243,238,.78)", accent: LIME, onAccent: INK, word: PAPER, dot: LIME, track: "rgba(244,243,238,.18)", ground: BLACK };
    case "lime":
      return { ink: INK, dim: "rgba(17,17,16,.66)", accent: INK, onAccent: LIME, word: INK, dot: PAPER, track: "rgba(17,17,16,.18)", ground: LIME };
  }
}

/* ------------------------------------------------------------- the type */

export type Align = "left" | "right" | "center";
export type TextOpts = { track?: number; align?: Align };
export type Run = { w: number; asc: number; desc: number };

export function setFont(ctx: CanvasRenderingContext2D, family: string, weight: number, size: number, track = 0): void {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.letterSpacing = `${track}px`;
}

/* "→" is drawn as a path: it is not in the latin subset next/font serves,
 * and a system fallback glyph inside Archivo Black looks wrong. It is also
 * the one piece of the No Shortcuts lockup that is ours to draw. */
const ARROW = /(→)/;
export const arrowW = (size: number): number => size * 0.92;

export function paintArrow(ctx: CanvasRenderingContext2D, x: number, baseline: number, size: number, color: string): void {
  const w = arrowW(size);
  /* The centre of a capital letter. */
  const cy = baseline - size * 0.36;
  const x0 = x + size * 0.06;
  const x1 = x + w - size * 0.06;
  const head = size * 0.3;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.13);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x0, cy);
  ctx.lineTo(x1, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1 - head, cy - head * 0.8);
  ctx.lineTo(x1, cy);
  ctx.lineTo(x1 - head, cy + head * 0.8);
  ctx.stroke();
  ctx.restore();
}

/* Width, ascent and descent of `str` in the font set on ctx, arrows
 * included. Real glyph bounds (actualBoundingBox*) keep the layout tight
 * whatever the face; a context without them gets a cap estimate. */
export function measure(ctx: CanvasRenderingContext2D, str: string, size: number): Run {
  let w = 0;
  let asc = 0;
  let desc = 0;
  for (const p of str.split(ARROW)) {
    if (p === "→") {
      w += arrowW(size);
      asc = Math.max(asc, size * 0.7);
      continue;
    }
    if (!p) continue;
    const m = ctx.measureText(p);
    w += m.width;
    asc = Math.max(asc, m.actualBoundingBoxAscent || 0);
    desc = Math.max(desc, m.actualBoundingBoxDescent || 0);
  }
  return { w, asc: asc || size * 0.72, desc };
}

/* `str` with its baseline at `baseline`; `x` is the left edge, or the
 * right edge / the centre per `align`. Returns the run. */
export function glyphs(
  ctx: CanvasRenderingContext2D,
  draw: boolean,
  x: number,
  baseline: number,
  str: string,
  family: string,
  weight: number,
  size: number,
  color: string,
  opts: TextOpts = {},
): Run {
  setFont(ctx, family, weight, size, opts.track ?? 0);
  const run = measure(ctx, str, size);
  const left = opts.align === "right" ? x - run.w : opts.align === "center" ? x - run.w / 2 : x;
  if (draw) {
    ctx.fillStyle = color;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    let cx = left;
    for (const p of str.split(ARROW)) {
      if (p === "→") {
        paintArrow(ctx, cx, baseline, size, color);
        cx += arrowW(size);
        continue;
      }
      if (!p) continue;
      ctx.fillText(p, cx, baseline);
      cx += ctx.measureText(p).width;
    }
  }
  ctx.letterSpacing = "0px";
  return run;
}

/* One line from the top edge `y` at the left edge (or right / centre);
 * returns the y under it plus `gapAfter`. `as` measures a different string
 * than the one drawn, so a counting number keeps the height of its final
 * value. */
export function line(
  ctx: CanvasRenderingContext2D,
  draw: boolean,
  y: number,
  str: string,
  family: string,
  weight: number,
  size: number,
  color: string,
  gapAfter = 0,
  opts: TextOpts & { as?: string } = {},
): number {
  setFont(ctx, family, weight, size, opts.track ?? 0);
  const { asc, desc } = measure(ctx, opts.as ?? str, size);
  const x = opts.align === "right" ? W - PAD : opts.align === "center" ? W / 2 : PAD;
  glyphs(ctx, draw, x, y + asc, str, family, weight, size, color, opts);
  return y + asc + desc + gapAfter;
}

/* The largest size, stepping down by 2 to `min`, at which `str` fits
 * `width`. Leaves ctx.font set to it. */
export function fit(ctx: CanvasRenderingContext2D, str: string, family: string, max: number, min: number, width: number, weight = 400, track = 0): number {
  let size = max;
  for (; size > min; size -= 2) {
    setFont(ctx, family, weight, size, track);
    if (measure(ctx, str, size).w <= width) break;
  }
  setFont(ctx, family, weight, size, track);
  ctx.letterSpacing = "0px";
  return size;
}

/* A rounded rectangle path (ctx.roundRect is too new for every phone). */
export function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/* ------------------------------------------------------------ the marks */

/* "NO SHORTCUTS →": Archivo Black caps, tracked tight, the arrow drawn
 * after a small gap. Returns the run (the arrow counted in). */
export function nsLockup(ctx: CanvasRenderingContext2D, draw: boolean, x: number, baseline: number, size: number, fonts: Fonts, color: string): Run {
  const track = -size * 0.015;
  const word = glyphs(ctx, draw, x, baseline, "NO SHORTCUTS", fonts.display, 400, size, color, { track });
  const gap = size * 0.22;
  const aw = arrowW(size);
  if (draw) paintArrow(ctx, x + word.w + gap, baseline, size, color);
  return { w: word.w + gap + aw, asc: word.asc, desc: word.desc };
}

/* "justfriends." — the word in Archivo Black lower-case, the dot a disc
 * sitting on the baseline like a full stop. Returns the run. */
export function jfWordmark(ctx: CanvasRenderingContext2D, draw: boolean, x: number, baseline: number, size: number, fonts: Fonts, word: string, dot: string): Run {
  const run = glyphs(ctx, draw, x, baseline, "justfriends", fonts.display, 400, size, word, { track: -size * 0.01 });
  const r = size * 0.115;
  const cx = x + run.w + size * 0.1 + r;
  if (draw) {
    ctx.fillStyle = dot;
    ctx.beginPath();
    ctx.arc(cx, baseline - r, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  }
  return { w: cx + r - x, asc: run.asc, desc: run.desc };
}

/* THE SIGNATURE every data card closes with, one line at the foot:
 * "NO SHORTCUTS → × justfriends." Returns the y under it. */
export function signature(ctx: CanvasRenderingContext2D, look: Look, kit: Kit, draw: boolean, y: number, size = 30): number {
  const { ink, dim, word, dot } = palette(look);
  setFont(ctx, kit.fonts.display, 400, size);
  const asc = measure(ctx, "N", size).asc;
  const baseline = y + asc;
  let x = PAD;
  const ns = nsLockup(ctx, draw, x, baseline, size, kit.fonts, ink);
  x += ns.w + size * 0.5;
  const cross = glyphs(ctx, draw, x, baseline, "×", kit.fonts.cond, 600, size * 1.1, dim);
  x += cross.w + size * 0.5;
  const jf = jfWordmark(ctx, draw, x, baseline, size, kit.fonts, word, dot);
  return baseline + Math.max(ns.desc, jf.desc);
}
