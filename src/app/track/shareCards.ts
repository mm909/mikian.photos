import { distUnit, distValue, fmtClock, fmtClockDay, fmtClockRange, fmtDuration, fmtPace, secondsBetween } from "@/lib/tracker/format";
import type { EventStatus, Snapshot, SnapshotCheckpoint, SnapshotEta, SnapshotOnCourse, SnapshotParticipant, Units } from "@/lib/tracker/types";

/* STORY STICKERS FOR THE LIVE TRACKER (owner, 2026-10-15: "share a sticker
 * that's No Shortcuts and Just Friends … how many miles we're in, how many
 * miles to go, expected ETA, how long we've been running, how many miles an
 * individual runner has run, how much elevation … number of legs … create
 * several and we can remove the ones we don't like … the goal is that we
 * paste these onto the story and they're more recognizable what team they
 * come from … include the just friends logo").
 *
 * Canvas painters only — no React — so a harness can paint a card with a
 * mocked context. Adapted from the Hyrox stickers (src/app/hyrox/[event]/
 * stickerPaint.ts) and generalised: a painter is (ctx, look, kit, draw) →
 * height, called once to measure and once to draw, so a sticker is exactly
 * as tall as its content. `kit` carries the font families next/font hands
 * out AND the three brand marks as Image elements (loaded once, loadMarks).
 * Every card wears the No Shortcuts mark, the Just Friends mark and the
 * "justfriends." wordmark with its lime dot, so a story is recognisably
 * theirs before anyone reads the number.
 *
 * The numbers come from one snapshot (src/lib/tracker/types.ts) through
 * factsOf(); before the start the cards tell the truth ("0.0 MI IN",
 * "STARTS FRI 5:00 AM") rather than hiding. */

export const W = 1080;
export const PAD = 72;
export const INNER = W - PAD * 2;

/* Just Friends LV: black ground and the lime dot (#D0F858 is the LASD
 * page's --safety token, sampled from their mark; the file reads #d3fe5c).
 * No Shortcuts: the Instagram mark's red, sampled from ns-ig.png (#dc1929
 * at its brightest). Lime TYPE on cream fails contrast, so the paper look
 * writes its accents in the LASD page's deep green, --safety-ink. */
export const LIME = "#D0F858";
export const LIME_INK = "#3C7A0B";
export const NS_RED = "#DC1929";
export const INK = "#111110";
export const PAPER = "#F4F3EE";
export const BLACK = "#0A0A0A";

export const BRAND = {
  jf: "/lasd26/brand/jf-mark.png",
  nsPoster: "/lasd26/brand/ns-poster.png",
  nsIg: "/lasd26/brand/ns-ig.png",
} as const;
/* ns-poster.png is 1159 × 1475. */
const POSTER_ASPECT = 1159 / 1475;
/* The JF file is 150 px; it is drawn at its own size (≤ 180 on the canvas
 * so it never goes soft). */
const JF = 150;

/* jf: black + lime. ns: black + the NS red, with the poster logo. paper:
 * the LASD cream, ink type, lime fills. clear: nothing behind it, ink type
 * with a lime accent — for pasting over a photo. */
export type Look = "jf" | "ns" | "paper" | "clear";

export const LOOKS: { id: Look; label: string }[] = [
  { id: "jf", label: "Just Friends" },
  { id: "ns", label: "No Shortcuts" },
  { id: "paper", label: "Paper" },
  { id: "clear", label: "Clear" },
];

export type Format = "sticker" | "story" | "post";
export const FORMATS: { id: Format; label: string }[] = [
  { id: "sticker", label: "Sticker" },
  { id: "story", label: "Story" },
  { id: "post", label: "Post" },
];
/* The canvas height of each format; null = as tall as the card. */
export const FRAME: Record<Format, number | null> = { sticker: null, story: 1920, post: 1350 };

export type Fonts = { display: string; cond: string; mono: string };
export type Marks = { jf: HTMLImageElement | null; nsPoster: HTMLImageElement | null; nsIg: HTMLImageElement | null };
export type Kit = { fonts: Fonts; marks: Marks };

export type Painter = (ctx: CanvasRenderingContext2D, look: Look, kit: Kit, draw: boolean) => number;
/* A card lays out from `y0`, paints when `draw`, returns the y it ended at. */
export type CardPainter = (ctx: CanvasRenderingContext2D, look: Look, kit: Kit, draw: boolean, y0: number) => number;

export type Palette = {
  ink: string;
  /* Fills: the bar, the slot boxes, the wordmark's dot. */
  accent: string;
  /* The accent as TYPE — the deep green on paper, where lime would vanish. */
  accentInk: string;
  /* Type on an accent fill. */
  onAccent: string;
  dim: string;
  /* The empty part of a bar, the footer's hairline. */
  track: string;
  /* Null for the clear look: the frame leaves the canvas transparent. */
  ground: string | null;
};

export function palette(look: Look): Palette {
  switch (look) {
    case "jf":
      return { ink: PAPER, accent: LIME, accentInk: LIME, onAccent: INK, dim: "rgba(244,243,238,.62)", track: "rgba(244,243,238,.16)", ground: BLACK };
    case "ns":
      return { ink: PAPER, accent: NS_RED, accentInk: NS_RED, onAccent: PAPER, dim: "rgba(244,243,238,.62)", track: "rgba(244,243,238,.16)", ground: BLACK };
    case "paper":
      return { ink: INK, accent: LIME, accentInk: LIME_INK, onAccent: INK, dim: "rgba(17,17,16,.6)", track: "rgba(17,17,16,.14)", ground: PAPER };
    case "clear":
      return { ink: INK, accent: LIME, accentInk: LIME, onAccent: INK, dim: "rgba(17,17,16,.66)", track: "rgba(17,17,16,.22)", ground: null };
  }
}

/* ------------------------------------------------------------ the marks */

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof Image === "undefined") return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

let marksPromise: Promise<Marks> | null = null;

/* The three PNGs as Image elements, loaded once per page. A failed load
 * leaves that mark null (the painters draw a lettered disc instead) and
 * lets the next paint try again. */
export function loadMarks(): Promise<Marks> {
  if (!marksPromise) {
    marksPromise = Promise.all([loadImage(BRAND.jf), loadImage(BRAND.nsPoster), loadImage(BRAND.nsIg)]).then(([jf, nsPoster, nsIg]) => {
      if (!jf || !nsPoster || !nsIg) marksPromise = null;
      return { jf, nsPoster, nsIg };
    });
  }
  return marksPromise;
}

/* ------------------------------------------------------------- the type */

type Align = "left" | "right" | "center";
type TextOpts = { track?: number; align?: Align };
type Run = { w: number; asc: number; desc: number };

function setFont(ctx: CanvasRenderingContext2D, family: string, weight: number, size: number, track = 0): void {
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.letterSpacing = `${track}px`;
}

/* The arrows are drawn as paths: "→" is not in the latin subset next/font
 * serves at all and "↑" only when the face happens to carry it, and a
 * system fallback glyph in the middle of a condensed numeral looks wrong. */
const ARROWS = /(→|↑)/;
type Arrow = "→" | "↑";
const isArrow = (s: string): s is Arrow => s === "→" || s === "↑";
const arrowW = (kind: Arrow, size: number): number => size * (kind === "→" ? 0.9 : 0.62);

function paintArrow(ctx: CanvasRenderingContext2D, kind: Arrow, x: number, baseline: number, size: number, color: string): void {
  const w = arrowW(kind, size);
  /* The centre of a capital letter. */
  const cy = baseline - size * 0.34;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.085);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (kind === "→") {
    const x0 = x + size * 0.08;
    const x1 = x + w - size * 0.08;
    const head = size * 0.28;
    ctx.beginPath();
    ctx.moveTo(x0, cy);
    ctx.lineTo(x1, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1 - head, cy - head * 0.78);
    ctx.lineTo(x1, cy);
    ctx.lineTo(x1 - head, cy + head * 0.78);
    ctx.stroke();
  } else {
    const cx = x + w / 2;
    const y0 = cy - size * 0.36;
    const y1 = cy + size * 0.36;
    const head = size * 0.26;
    ctx.beginPath();
    ctx.moveTo(cx, y1);
    ctx.lineTo(cx, y0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - head * 0.78, y0 + head);
    ctx.lineTo(cx, y0);
    ctx.lineTo(cx + head * 0.78, y0 + head);
    ctx.stroke();
  }
  ctx.restore();
}

/* Width, ascent and descent of `str` in the font set on ctx, arrows
 * included. The real glyph bounds (actualBoundingBox*) make the layout
 * tight whatever the face; a context without them gets a cap estimate. */
function measure(ctx: CanvasRenderingContext2D, str: string, size: number): Run {
  let w = 0;
  let asc = 0;
  let desc = 0;
  for (const p of str.split(ARROWS)) {
    if (isArrow(p)) {
      w += arrowW(p, size);
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
    for (const p of str.split(ARROWS)) {
      if (isArrow(p)) {
        paintArrow(ctx, p, cx, baseline, size, color);
        cx += arrowW(p, size);
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

/* One line from the top edge `y`, at the left edge (or right / centre);
 * returns the y under it plus `gapAfter`. */
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
  opts: TextOpts = {},
): number {
  setFont(ctx, family, weight, size, opts.track ?? 0);
  const { asc, desc } = measure(ctx, str, size);
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

type Piece = { text: string; family: string; weight: number; size: number; color: string; track?: number };

/* A left and a right text on one baseline: the right keeps its size, the
 * left shrinks to fit beside it. Returns the y under the row. */
function pair(ctx: CanvasRenderingContext2D, draw: boolean, y: number, left: Piece, right: Piece | null, minLeft = 28): number {
  let r: Run = { w: 0, asc: 0, desc: 0 };
  if (right) {
    setFont(ctx, right.family, right.weight, right.size, right.track ?? 0);
    r = measure(ctx, right.text, right.size);
  }
  const room = INNER - (right ? r.w + 24 : 0);
  const ls = fit(ctx, left.text, left.family, left.size, minLeft, room, left.weight, left.track ?? 0);
  setFont(ctx, left.family, left.weight, ls, left.track ?? 0);
  const l = measure(ctx, left.text, ls);
  const asc = Math.max(l.asc, r.asc);
  const desc = Math.max(l.desc, r.desc);
  glyphs(ctx, draw, PAD, y + asc, left.text, left.family, left.weight, ls, left.color, { track: left.track });
  if (right) glyphs(ctx, draw, W - PAD, y + asc, right.text, right.family, right.weight, right.size, right.color, { track: right.track, align: "right" });
  return y + asc + desc;
}

/* The big numeral with its unit beside it in the accent, on one baseline:
 * "58.3 MI IN". The numeral shrinks until the pair fits. */
function bigWithUnit(ctx: CanvasRenderingContext2D, look: Look, kit: Kit, draw: boolean, y: number, num: string, unit: string, max = 300): number {
  const { ink, accentInk } = palette(look);
  const unitSize = 72;
  const gap = 20;
  setFont(ctx, kit.fonts.cond, 700, unitSize);
  const uw = measure(ctx, unit, unitSize).w;
  const size = fit(ctx, num, kit.fonts.cond, max, 110, INNER - uw - gap, 700);
  setFont(ctx, kit.fonts.cond, 700, size);
  const n = measure(ctx, num, size);
  const baseline = y + n.asc;
  glyphs(ctx, draw, PAD, baseline, num, kit.fonts.cond, 700, size, ink);
  glyphs(ctx, draw, PAD + n.w + gap, baseline, unit, kit.fonts.cond, 700, unitSize, accentInk);
  return y + n.asc + n.desc;
}

/* A letter in a filled box — the slot a runner holds (A / B). Returns the
 * box's size. */
function slotTag(ctx: CanvasRenderingContext2D, look: Look, kit: Kit, draw: boolean, x: number, y: number, label: string, size = 52): { w: number; h: number } {
  const { accent, onAccent } = palette(look);
  setFont(ctx, kit.fonts.cond, 700, size);
  const m = measure(ctx, label, size);
  const h = Math.round(size * 1.3);
  const w = Math.max(h, Math.round(m.w + size * 0.7));
  if (draw) {
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, w, h);
    glyphs(ctx, true, x + w / 2, y + (h + m.asc) / 2, label, kit.fonts.cond, 700, size, onAccent, { align: "center" });
  }
  return { w, h };
}

/* A progress bar across the card: the done part in the accent. */
function bar(ctx: CanvasRenderingContext2D, look: Look, draw: boolean, y: number, frac: number, h = 26): number {
  const { accent, track } = palette(look);
  const f = Math.max(0, Math.min(1, Number.isFinite(frac) ? frac : 0));
  if (draw) {
    ctx.fillStyle = track;
    ctx.fillRect(PAD, y, INNER, h);
    if (f > 0) {
      ctx.fillStyle = accent;
      ctx.fillRect(PAD, y, Math.max(6, Math.round(INNER * f)), h);
    }
  }
  return y + h;
}

/* A value over a small label, for a grid of stats. Returns the y under it. */
function stat(ctx: CanvasRenderingContext2D, look: Look, kit: Kit, draw: boolean, x: number, y: number, value: string, label: string, colW: number): number {
  const { ink, dim } = palette(look);
  const vs = fit(ctx, value, kit.fonts.cond, 96, 44, colW - 16, 700);
  setFont(ctx, kit.fonts.cond, 700, vs);
  const v = measure(ctx, value, vs);
  glyphs(ctx, draw, x, y + v.asc, value, kit.fonts.cond, 700, vs, ink);
  const ly = y + v.asc + v.desc + 12;
  glyphs(ctx, draw, x, ly + 22 * 0.72, label, kit.fonts.mono, 700, 22, dim, { track: 4 });
  return ly + 22;
}

/* ------------------------------------------------------- the brand bits */

function circleImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, size: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
}

/* When a PNG did not load: a lettered disc in the accent, so the card is
 * still signed. */
function fallbackDisc(ctx: CanvasRenderingContext2D, look: Look, kit: Kit, x: number, y: number, size: number, letters: string): void {
  const { accent, onAccent } = palette(look);
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();
  glyphs(ctx, true, x + size / 2, y + size / 2 + size * 0.16, letters, kit.fonts.cond, 700, size * 0.44, onAccent, { align: "center" });
}

/* THE JF MARK: always in a circle — the file's square is black and would
 * sit as a block on paper or over a photo. */
export function drawJf(ctx: CanvasRenderingContext2D, look: Look, kit: Kit, draw: boolean, x: number, y: number, size = JF): void {
  if (!draw) return;
  if (kit.marks.jf) circleImage(ctx, kit.marks.jf, x, y, size);
  else fallbackDisc(ctx, look, kit, x, y, size, "JF");
}

/* THE NS MARK: the Instagram mark (red on black, in a circle) on the black
 * JF look, where its ground disappears; the poster logo everywhere else —
 * on the NS look because it is theirs, on paper and clear because it is
 * transparent and needs no ground. Returns the width it takes at `h`. */
export function nsWidth(look: Look, h: number): number {
  return look === "jf" ? h : Math.round(h * POSTER_ASPECT);
}

export function drawNs(ctx: CanvasRenderingContext2D, look: Look, kit: Kit, draw: boolean, x: number, y: number, h: number): number {
  const w = nsWidth(look, h);
  if (!draw) return w;
  if (look === "jf") {
    if (kit.marks.nsIg) circleImage(ctx, kit.marks.nsIg, x, y, h);
    else fallbackDisc(ctx, look, kit, x, y, h, "NS");
    return w;
  }
  if (kit.marks.nsPoster) ctx.drawImage(kit.marks.nsPoster, x, y, w, h);
  else fallbackDisc(ctx, look, kit, x + (w - Math.min(w, h)) / 2, y + (h - Math.min(w, h)) / 2, Math.min(w, h), "NS");
  return w;
}

/* "justfriends." — the word in the display face, the dot a lime disc, the
 * way their wordmark is set. Returns the run. */
export function wordmark(ctx: CanvasRenderingContext2D, look: Look, kit: Kit, draw: boolean, x: number, y: number, size: number): Run {
  const { ink, accent } = palette(look);
  setFont(ctx, kit.fonts.display, 400, size);
  const word = measure(ctx, "justfriends", size);
  const baseline = y + word.asc;
  glyphs(ctx, draw, x, baseline, "justfriends", kit.fonts.display, 400, size, ink);
  const r = size * 0.11;
  const cx = x + word.w + size * 0.07 + r;
  if (draw) {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(cx, baseline - r, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  }
  return { w: cx + r - x, asc: word.asc, desc: word.desc };
}

const nsHeight = (look: Look): number => (look === "jf" ? JF : look === "ns" ? 250 : 190);

/* THE HEADER every data card opens with: the JF mark left, the NS mark
 * right, the eyebrow "NO SHORTCUTS × JUST FRIENDS" with the date at the
 * far right, a rule. Returns the y under it. */
export function paintHeader(ctx: CanvasRenderingContext2D, look: Look, kit: Kit, draw: boolean, y0: number, words: Words): number {
  const { ink, accentInk, dim } = palette(look);
  const nsH = nsHeight(look);
  const band = Math.max(JF, nsH);
  drawJf(ctx, look, kit, draw, PAD, y0 + (band - JF) / 2, JF);
  const nsW = nsWidth(look, nsH);
  drawNs(ctx, look, kit, draw, W - PAD - nsW, y0 + (band - nsH) / 2, nsH);
  let y = y0 + band + 34;
  const eyebrow = 28;
  glyphs(ctx, draw, PAD, y + eyebrow * 0.72, "NO SHORTCUTS × JUST FRIENDS", kit.fonts.mono, 700, eyebrow, accentInk, { track: 5 });
  if (words.date) glyphs(ctx, draw, W - PAD, y + eyebrow * 0.72, words.date, kit.fonts.mono, 700, eyebrow, dim, { track: 5, align: "right" });
  y += eyebrow + 24;
  if (draw) {
    ctx.fillStyle = ink;
    ctx.fillRect(PAD, y, INNER, 6);
  }
  return y + 6 + 36;
}

/* THE FOOTER every card closes with: a hairline, the wordmark, a small
 * line at the right (the route, or a phrase). Returns the y under it. */
export function paintFooter(ctx: CanvasRenderingContext2D, look: Look, kit: Kit, draw: boolean, y: number, right: string): number {
  const { dim, track } = palette(look);
  y += 36;
  if (draw) {
    ctx.fillStyle = track;
    ctx.fillRect(PAD, y, INNER, 2);
  }
  y += 2 + 26;
  const wm = wordmark(ctx, look, kit, draw, PAD, y, 52);
  if (right) glyphs(ctx, draw, W - PAD, y + wm.asc, right, kit.fonts.mono, 700, 24, dim, { track: 4, align: "right" });
  return y + wm.asc + wm.desc;
}

/* ----------------------------------------------------------- the facts */

/* What the server page knows before any snapshot: enough for THE MARK. */
export type Shell = { slug: string; name: string; units: Units; timezone: string; start_time: string };

export type Words = {
  /* "SAN DIEGO" — where the ETA points. */
  to: string;
  /* "LA → SD". */
  route: string;
  /* "10.23.26", in the event's zone. */
  date: string;
  /* "FRI 5:00 AM", in the event's zone. */
  start: string;
};

export type Facts = {
  slug: string;
  units: Units;
  tz: string;
  startIso: string;
  /* False when built from the shell alone (no snapshot yet): only THE MARK
   * is offered then. */
  hasData: boolean;
  status: EventStatus;
  started: boolean;
  finished: boolean;
  finishedAt: string | null;
  lengthM: number;
  progressM: number;
  remainingM: number;
  percent: number;
  /* Seconds on the road, carried forward from the snapshot to `now`. */
  elapsedS: number;
  finishTimeS: number | null;
  eta: SnapshotEta;
  climbM: number;
  climbLeftM: number;
  slotNames: string[];
  onCourse: SnapshotOnCourse[];
  participants: SnapshotParticipant[];
  legsDone: number;
  /* Runners with at least one leg. */
  ranCount: number;
  words: Words;
};

/* Per-event words the data cannot supply: where the ETA points and how
 * the route is said. Other events fall back to their checkpoints. */
const EVENT_WORDS: Record<string, { to: string; route: string }> = {
  lasd26: { to: "SAN DIEGO", route: "LA → SD" },
};

/* "10.23.26" */
function dateStamp(iso: string, tz: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const opts: Intl.DateTimeFormatOptions = { month: "2-digit", day: "2-digit", year: "2-digit" };
  try {
    return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: tz }).format(d).replace(/\//g, ".");
  } catch {
    return new Intl.DateTimeFormat("en-US", opts).format(d).replace(/\//g, ".");
  }
}

/* "FRI 5:00 AM" */
function startStamp(iso: string, tz: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  let wd = "";
  try {
    wd = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(d);
  } catch {
    wd = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(d);
  }
  return `${wd} ${fmtClock(iso, tz)}`.toUpperCase();
}

function wordsOf(shell: Shell, checkpoints?: SnapshotCheckpoint[]): Words {
  const known = EVENT_WORDS[shell.slug];
  const start = checkpoints?.find((c) => c.kind === "start")?.name;
  const finish = checkpoints?.find((c) => c.kind === "finish")?.name;
  return {
    to: (known?.to ?? finish ?? "THE FINISH").toUpperCase(),
    route: known?.route ?? (start && finish ? `${start} → ${finish}` : shell.name).toUpperCase(),
    date: dateStamp(shell.start_time, shell.timezone),
    start: startStamp(shell.start_time, shell.timezone),
  };
}

const NO_ETA: SnapshotEta = { finish: null, earliest: null, latest: null, pace_s_per_km: null };

/* Facts with nothing in them: the page before its first snapshot. */
export function factsFromShell(shell: Shell): Facts {
  return {
    slug: shell.slug,
    units: shell.units,
    tz: shell.timezone,
    startIso: shell.start_time,
    hasData: false,
    status: "upcoming",
    started: false,
    finished: false,
    finishedAt: null,
    lengthM: 0,
    progressM: 0,
    remainingM: 0,
    percent: 0,
    elapsedS: 0,
    finishTimeS: null,
    eta: NO_ETA,
    climbM: 0,
    climbLeftM: 0,
    slotNames: [],
    onCourse: [],
    participants: [],
    legsDone: 0,
    ranCount: 0,
    words: wordsOf(shell),
  };
}

/* The facts of one entry (the first, unless `entryId` names another —
 * LASD26 has one: the crew, in pairs). `now` carries the clocks forward
 * from the snapshot's generated_at, so a sticker made a minute after the
 * poll says the minute. */
export function factsOf(snap: Snapshot, entryId: string | null = null, now = Date.now()): Facts {
  const shell: Shell = { slug: snap.event.slug, name: snap.event.name, units: snap.event.units, timezone: snap.event.timezone, start_time: snap.event.start_time };
  const entry = (entryId ? snap.entries.find((e) => e.id === entryId) : undefined) ?? snap.entries[0];
  if (!entry) return factsFromShell(shell);
  const status = snap.event.status;
  const started = status !== "upcoming";
  const finished = entry.finished;
  const gen = Date.parse(snap.generated_at);
  const drift = started && !finished && Number.isFinite(gen) ? Math.max(0, (now - gen) / 1000) : 0;
  const finishTimeS = finished ? (entry.finished_at ? Math.max(0, secondsBetween(snap.event.start_time, entry.finished_at)) : entry.elapsed_s) : null;
  return {
    slug: shell.slug,
    units: shell.units,
    tz: shell.timezone,
    startIso: shell.start_time,
    hasData: true,
    status,
    started,
    finished,
    finishedAt: entry.finished_at,
    lengthM: snap.event.length_m,
    progressM: entry.progress_m,
    remainingM: entry.remaining_m,
    percent: entry.percent,
    elapsedS: started ? entry.elapsed_s + drift : 0,
    finishTimeS,
    eta: entry.eta,
    climbM: entry.elevation_gain_m,
    climbLeftM: entry.elevation_remaining_m,
    slotNames: entry.slot_names.length ? entry.slot_names : Array.from({ length: Math.max(1, entry.slots) }, (_, i) => String(i + 1)),
    onCourse: entry.on_course.map((o) => ({ ...o, leg_time_s: o.leg_time_s + drift })),
    participants: entry.participants,
    legsDone: entry.legs.filter((l) => !l.live).length,
    ranCount: entry.participants.filter((p) => p.legs > 0).length,
    words: wordsOf(shell, entry.checkpoints),
  };
}

/* ------------------------------------------------------- small formats */

const up = (s: string): string => s.toUpperCase();
const miles = (f: Facts, m: number): string => distValue(m, f.units, 1);
const unitLabel = (f: Facts): string => up(distUnit(f.units));
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/* Always h:mm:ss, unlike fmtDuration's m:ss under an hour: a sticker's
 * clock should read as a clock ("0:00:00" before the start). */
export function hms(s: number | null | undefined): string {
  if (s === null || s === undefined || !Number.isFinite(s)) return "—";
  const t = Math.max(0, Math.round(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/* 652 m → { value: "2,139", unit: "FT" } (feet = m × 3.28084) | metres. */
export function elevParts(m: number, units: Units): { value: string; unit: string } {
  const v = units === "imperial" ? m * 3.28084 : m;
  return { value: Math.round(Math.max(0, v)).toLocaleString("en-US"), unit: units === "imperial" ? "FT" : "M" };
}

/* ------------------------------------------------------------ the cards */

/* 1 MILES IN — "58.3 MI IN", the bar, "84.1 MI TO GO · 41%". Before the
 * start: 0.0 in, the whole route to go, when it starts. */
export const milesCard =
  (f: Facts): CardPainter =>
  (ctx, look, kit, draw, y0) => {
    const { ink, accentInk } = palette(look);
    const u = unitLabel(f);
    let y = paintHeader(ctx, look, kit, draw, y0, f.words);
    y = bigWithUnit(ctx, look, kit, draw, y, miles(f, f.progressM), `${u} IN`);
    y += 30;
    y = bar(ctx, look, draw, y, f.lengthM > 0 ? f.progressM / f.lengthM : 0);
    y += 24;
    const left = f.finished ? `${miles(f, f.lengthM)} ${u} · DONE` : `${miles(f, f.remainingM)} ${u} TO GO`;
    const right: Piece = f.finished
      ? { text: "100%", family: kit.fonts.cond, weight: 700, size: 52, color: accentInk }
      : f.started
        ? { text: `${Math.round(f.percent)}%`, family: kit.fonts.cond, weight: 700, size: 52, color: accentInk }
        : { text: `STARTS ${f.words.start}`, family: kit.fonts.cond, weight: 700, size: 36, color: accentInk };
    y = pair(ctx, draw, y, { text: left, family: kit.fonts.cond, weight: 600, size: 52, color: ink }, right);
    return paintFooter(ctx, look, kit, draw, y, f.words.route);
  };

/* 2 ETA — "SAN DIEGO ~3:42 PM", the window, the miles to go. Before the
 * start it is the start time; after the finish, the finish time. */
export const etaCard =
  (f: Facts): CardPainter =>
  (ctx, look, kit, draw, y0) => {
    const { ink, accentInk, dim } = palette(look);
    const u = unitLabel(f);
    let y = paintHeader(ctx, look, kit, draw, y0, f.words);
    let eyebrow: string;
    let big: string;
    const under: string[] = [];
    if (f.finished) {
      eyebrow = `FINISHED · ${f.words.to}`;
      big = up(fmtClockDay(f.finishedAt, f.tz, f.startIso));
      under.push(`${miles(f, f.lengthM)} ${u} · ${hms(f.finishTimeS)}`);
    } else if (!f.started) {
      eyebrow = "STARTS";
      big = f.words.start || "—";
      under.push(`${miles(f, f.lengthM)} ${u} TO ${f.words.to}`);
    } else if (f.eta.finish) {
      eyebrow = `ETA · ${f.words.to}`;
      big = `~${up(fmtClockDay(f.eta.finish, f.tz, f.startIso))}`;
      const win = fmtClockRange(f.eta.earliest, f.eta.latest, f.tz);
      if (win !== "—") under.push(`${up(win)} WINDOW`);
      under.push(`${miles(f, f.remainingM)} ${u} TO GO · ${miles(f, f.progressM)} IN`);
    } else {
      eyebrow = `ETA · ${f.words.to}`;
      big = "SOON";
      under.push(`${miles(f, f.remainingM)} ${u} TO GO`);
    }
    y = line(ctx, draw, y, eyebrow, kit.fonts.mono, 700, 30, accentInk, 22, { track: 6 });
    const bs = fit(ctx, big, kit.fonts.cond, 250, 90, INNER, 700);
    y = line(ctx, draw, y, big, kit.fonts.cond, 700, bs, ink, 24);
    under.forEach((t, i) => {
      const s = fit(ctx, t, kit.fonts.cond, 50, 28, INNER, 600);
      y = line(ctx, draw, y, t, kit.fonts.cond, 600, s, i === 0 && under.length > 1 ? dim : ink, i < under.length - 1 ? 12 : 0);
    });
    return paintFooter(ctx, look, kit, draw, y, f.words.route);
  };

/* 3 THE CLOCK — "9:15:20 ON THE ROAD", the miles so far, the legs done. */
export const clockCard =
  (f: Facts): CardPainter =>
  (ctx, look, kit, draw, y0) => {
    const { ink, accentInk } = palette(look);
    let y = paintHeader(ctx, look, kit, draw, y0, f.words);
    const big = hms(f.finished ? (f.finishTimeS ?? f.elapsedS) : f.started ? f.elapsedS : 0);
    const bs = fit(ctx, big, kit.fonts.cond, 300, 110, INNER, 700);
    y = line(ctx, draw, y, big, kit.fonts.cond, 700, bs, ink, 18);
    const label = f.finished ? "FINAL TIME" : f.started ? "ON THE ROAD" : `STARTS ${f.words.start}`;
    const ls = fit(ctx, label, kit.fonts.cond, 64, 36, INNER, 700, 3);
    y = line(ctx, draw, y, label, kit.fonts.cond, 700, ls, accentInk, 26, { track: 3 });
    const under = `${miles(f, f.progressM)} ${unitLabel(f)} · ${plural(f.legsDone, "LEG", "LEGS")} DONE`;
    const us = fit(ctx, under, kit.fonts.cond, 50, 28, INNER, 600);
    y = line(ctx, draw, y, under, kit.fonts.cond, 600, us, ink);
    return paintFooter(ctx, look, kit, draw, y, f.words.route);
  };

/* 4 RUNNING NOW — the pair: a slot box (A / B), the name, their leg so far
 * (owner, 2026-10-15: "we are running two by two … it's just the current
 * runner"). A slot nobody holds says so. */
export const nowCard =
  (f: Facts): CardPainter =>
  (ctx, look, kit, draw, y0) => {
    const { ink, accentInk, dim } = palette(look);
    const u = unitLabel(f);
    let y = paintHeader(ctx, look, kit, draw, y0, f.words);
    const eyebrow = f.finished ? "FINISHED" : f.started ? "RUNNING NOW" : `STARTS ${f.words.start}`;
    y = line(ctx, draw, y, eyebrow, kit.fonts.mono, 700, 30, accentInk, 26, { track: 6 });
    const slots = Math.max(1, f.slotNames.length);
    for (let i = 0; i < slots; i++) {
      const slotName = f.slotNames[i] ?? String(i + 1);
      const oc = f.onCourse.find((o) => o.slot === i + 1);
      const tag = slotTag(ctx, look, kit, false, PAD, y, slotName, 52);
      const x = PAD + tag.w + 22;
      const who = oc ? up(oc.name) : "—";
      const ws = fit(ctx, who, kit.fonts.display, 92, 44, INNER - tag.w - 22);
      setFont(ctx, kit.fonts.display, 400, ws);
      const wr = measure(ctx, who, ws);
      /* The box sits on the name's cap centre. */
      slotTag(ctx, look, kit, draw, PAD, y + wr.asc / 2 - tag.h / 2, slotName, 52);
      glyphs(ctx, draw, x, y + wr.asc, who, kit.fonts.display, 400, ws, ink);
      y += Math.max(wr.asc + wr.desc, tag.h) + 12;
      const sub = oc
        ? `LEG ${oc.leg_no} · ${miles(f, oc.leg_distance_m)} ${u} · ${hms(oc.leg_time_s)} · ${up(fmtPace(oc.leg_pace_s_per_km, f.units))}`
        : f.finished
          ? "DONE"
          : f.started
            ? "NOBODY OUT IN THIS SLOT"
            : "NOT YET";
      const ss = fit(ctx, sub, kit.fonts.cond, 40, 24, INNER, 600, 1);
      y = line(ctx, draw, y, sub, kit.fonts.cond, 600, ss, dim, i < slots - 1 ? 34 : 0, { track: 1 });
    }
    return paintFooter(ctx, look, kit, draw, y, f.words.route);
  };

/* 5 A RUNNER — the name, legs, miles, pace, climb. */
export const runnerCard =
  (f: Facts, participantId: string | null): CardPainter =>
  (ctx, look, kit, draw, y0) => {
    const { ink, accentInk } = palette(look);
    let y = paintHeader(ctx, look, kit, draw, y0, f.words);
    const p = (participantId ? f.participants.find((x) => x.id === participantId) : undefined) ?? f.participants[0];
    if (!p) {
      y = line(ctx, draw, y, "NO ROSTER YET", kit.fonts.cond, 700, 72, ink);
      return paintFooter(ctx, look, kit, draw, y, f.words.route);
    }
    const eyebrow = p.on_course ? "ON COURSE NOW" : p.legs > 0 ? "RUNNER" : f.started && !f.finished ? "WAITING" : "RUNNER";
    y = line(ctx, draw, y, eyebrow, kit.fonts.mono, 700, 30, accentInk, 22, { track: 6 });
    const name = up(p.name);
    const ns = fit(ctx, name, kit.fonts.display, 128, 56, INNER);
    y = line(ctx, draw, y, name, kit.fonts.display, 400, ns, ink, 36);
    const col = INNER / 2;
    const climb = elevParts(p.elevation_gain_m, f.units);
    const rows: [string, string][][] = [
      [
        [String(p.legs), p.legs === 1 ? "LEG" : "LEGS"],
        [miles(f, p.distance_m), unitLabel(f)],
      ],
      [
        [up(fmtPace(p.avg_pace_s_per_km, f.units)), "AVG PACE"],
        [`↑ ${climb.value}`, `${climb.unit} CLIMBED`],
      ],
    ];
    rows.forEach((cells, r) => {
      const bottoms = cells.map(([v, l], c) => stat(ctx, look, kit, draw, PAD + c * col, y, v, l, col));
      y = Math.max(...bottoms) + (r < rows.length - 1 ? 30 : 0);
    });
    return paintFooter(ctx, look, kit, draw, y, f.words.route);
  };

/* 6 ELEVATION — "↑ 2,140 FT CLIMBED · 980 TO GO", with a bar. */
export const climbCard =
  (f: Facts): CardPainter =>
  (ctx, look, kit, draw, y0) => {
    const { ink, accentInk, dim } = palette(look);
    let y = paintHeader(ctx, look, kit, draw, y0, f.words);
    const gain = elevParts(f.climbM, f.units);
    const left = elevParts(f.climbLeftM, f.units);
    const total = elevParts(f.climbM + f.climbLeftM, f.units);
    y = bigWithUnit(ctx, look, kit, draw, y, `↑ ${gain.value}`, gain.unit);
    y += 18;
    const label = f.finished ? "CLIMBED · DONE" : f.started ? "CLIMBED SO FAR" : `CLIMBED · STARTS ${f.words.start}`;
    const ls = fit(ctx, label, kit.fonts.cond, 64, 36, INNER, 700, 3);
    y = line(ctx, draw, y, label, kit.fonts.cond, 700, ls, accentInk, 26, { track: 3 });
    const all = f.climbM + f.climbLeftM;
    y = bar(ctx, look, draw, y, all > 0 ? f.climbM / all : 0);
    y += 24;
    y = pair(
      ctx,
      draw,
      y,
      { text: `${left.value} ${left.unit} TO GO`, family: kit.fonts.cond, weight: 600, size: 52, color: ink },
      { text: `${total.value} ${total.unit} TOTAL`, family: kit.fonts.cond, weight: 600, size: 36, color: dim },
    );
    return paintFooter(ctx, look, kit, draw, y, f.words.route);
  };

/* 7 THE MARK — the two logos and "NO SHORTCUTS × JUST FRIENDS · LA → SD ·
 * 10.23.26". Needs no snapshot, so it works before the start. */
export const markCard =
  (f: Facts): CardPainter =>
  (ctx, look, kit, draw, y0) => {
    const { ink, accentInk } = palette(look);
    const jf = 180;
    const nsH = look === "jf" ? 180 : 340;
    const nsW = nsWidth(look, nsH);
    const gap = 56;
    const x0 = Math.round((W - (nsW + gap + jf)) / 2);
    const band = Math.max(jf, nsH);
    drawNs(ctx, look, kit, draw, x0, y0 + (band - nsH) / 2, nsH);
    drawJf(ctx, look, kit, draw, x0 + nsW + gap, y0 + (band - jf) / 2, jf);
    let y = y0 + band + 52;
    const l1 = "NO SHORTCUTS";
    const l2 = "JUST FRIENDS";
    const size = Math.min(fit(ctx, l1, kit.fonts.display, 128, 60, INNER), fit(ctx, `× ${l2}`, kit.fonts.display, 128, 60, INNER));
    y = line(ctx, draw, y, l1, kit.fonts.display, 400, size, ink, 8);
    setFont(ctx, kit.fonts.display, 400, size);
    const cross = measure(ctx, "× ", size);
    const rest = measure(ctx, l2, size);
    const asc = Math.max(cross.asc, rest.asc);
    glyphs(ctx, draw, PAD, y + asc, "×", kit.fonts.display, 400, size, accentInk);
    glyphs(ctx, draw, PAD + cross.w, y + asc, l2, kit.fonts.display, 400, size, ink);
    y += asc + Math.max(cross.desc, rest.desc) + 28;
    const tail = [f.words.route, f.words.date].filter(Boolean).join(" · ");
    const ts = fit(ctx, tail, kit.fonts.cond, 58, 32, INNER, 700, 3);
    y = line(ctx, draw, y, tail, kit.fonts.cond, 700, ts, accentInk, 0, { track: 3 });
    return paintFooter(ctx, look, kit, draw, y, "UNITY IN COMMUNITY");
  };

/* 8 FINISH — once finished: the total time, miles, legs, runners. Until
 * then it says so, with the miles to go and the ETA, so the owner can see
 * the layout before race day. */
export const finishCard =
  (f: Facts): CardPainter =>
  (ctx, look, kit, draw, y0) => {
    const { ink, accentInk } = palette(look);
    const u = unitLabel(f);
    let y = paintHeader(ctx, look, kit, draw, y0, f.words);
    const eyebrow = f.finished ? `FINISHED · ${f.words.to}` : "THE FINISH";
    y = line(ctx, draw, y, eyebrow, kit.fonts.mono, 700, 30, accentInk, 22, { track: 6 });
    const big = f.finished ? hms(f.finishTimeS) : "NOT YET";
    const bs = fit(ctx, big, kit.fonts.cond, 300, 110, INNER, 700);
    y = line(ctx, draw, y, big, kit.fonts.cond, 700, bs, ink, 18);
    const label = f.finished ? f.words.route : `${miles(f, f.remainingM)} ${u} TO GO`;
    const ls = fit(ctx, label, kit.fonts.cond, 64, 36, INNER, 700, 3);
    y = line(ctx, draw, y, label, kit.fonts.cond, 700, ls, accentInk, 26, { track: 3 });
    const under = f.finished
      ? `${miles(f, f.lengthM)} ${u} · ${plural(f.legsDone, "LEG", "LEGS")} · ${plural(f.ranCount, "RUNNER", "RUNNERS")}`
      : f.started
        ? f.eta.finish
          ? `ETA ~${up(fmtClockDay(f.eta.finish, f.tz, f.startIso))}`
          : "RUNNING"
        : `STARTS ${f.words.start}`;
    const us = fit(ctx, under, kit.fonts.cond, 50, 28, INNER, 600);
    y = line(ctx, draw, y, under, kit.fonts.cond, 600, us, ink);
    return paintFooter(ctx, look, kit, draw, y, f.words.route);
  };

/* ---------------------------------------------------------- the deck */

export type CardId = "miles" | "eta" | "clock" | "now" | "runner" | "climb" | "mark" | "finish";

/* In the owner's order. `data`: needs a snapshot (THE MARK does not). */
export const CARDS: { id: CardId; label: string; data: boolean }[] = [
  { id: "miles", label: "Miles in", data: true },
  { id: "eta", label: "ETA", data: true },
  { id: "clock", label: "The clock", data: true },
  { id: "now", label: "Running now", data: true },
  { id: "runner", label: "A runner", data: true },
  { id: "climb", label: "Elevation", data: true },
  { id: "mark", label: "The mark", data: false },
  { id: "finish", label: "Finish", data: true },
];

export function cardPainter(id: CardId, f: Facts, runnerId: string | null): CardPainter {
  switch (id) {
    case "miles":
      return milesCard(f);
    case "eta":
      return etaCard(f);
    case "clock":
      return clockCard(f);
    case "now":
      return nowCard(f);
    case "runner":
      return runnerCard(f, runnerId);
    case "climb":
      return climbCard(f);
    case "mark":
      return markCard(f);
    case "finish":
      return finishCard(f);
  }
}

/* Paints a card at its own height (frame = null: the canvas is the card
 * plus the padding) or centred in a frame of a fixed height (a story or a
 * post). Returns the canvas height. */
export function placeCard(ctx: CanvasRenderingContext2D, look: Look, kit: Kit, draw: boolean, frame: number | null, card: CardPainter): number {
  const h = card(ctx, look, kit, false, 0);
  if (frame === null) {
    if (draw) card(ctx, look, kit, true, PAD);
    return h + PAD * 2;
  }
  const y0 = Math.max(PAD, Math.round((frame - h) / 2));
  if (draw) card(ctx, look, kit, true, y0);
  return frame;
}

/* The file a sticker saves as: lasd26-miles-story-jf.png. */
export function stickerFile(slug: string, id: CardId, format: Format, look: Look): string {
  return `${slug}-${id}-${format}-${look}.png`;
}
