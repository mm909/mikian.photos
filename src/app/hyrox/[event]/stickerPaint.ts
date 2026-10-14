import { BLACK, YELLOW } from "../theme";
import type { HyroxEvent } from "../events";

/* WHAT EVERY HYROX STICKER SHARES: the canvas width, the padding, the four
 * looks and the colours each puts on the type and the year box, a fitter
 * that shrinks a line until it holds, the header — HYROX, the city huge,
 * the year in a box, a rule — and the cards more than one surface paints:
 * the title, DAYS AWAY, LET US KNOW YOU'RE RACING, and a rower's own race
 * card. No React here, so a harness can paint a card on its own. */

export type Fonts = { display: string; cond: string };

/* yellow: black type on a yellow block. black: yellow type on a black
 * block. clear-black / clear-yellow: the same type on nothing (owner,
 * 2026-10-13: "a black on yellow and a yellow on black", and both "with a
 * transparent background"). */
export type Look = "yellow" | "black" | "clear-black" | "clear-yellow";

export const LOOKS: { id: Look; label: string }[] = [
  { id: "yellow", label: "Black on yellow" },
  { id: "black", label: "Yellow on black" },
  { id: "clear-black", label: "Black on clear" },
  { id: "clear-yellow", label: "Yellow on clear" },
];

export const W = 1080;
export const PAD = 72;
export const INNER = W - PAD * 2;

/* The year's type size and the room above and below it inside its box
 * (owner, 2026-10-13: "the top part of the 27 doesn't have enough
 * margin"). Anton's figures stand nearly the full em, so the box is cut
 * from the baseline, not the em box. */
const YEAR = 150;
const YEAR_PAD = 26;

/* The colours a look paints with: the type, the box behind the year and
 * the year's own colour, a dimmed cut of the type, and the ground an
 * opaque look fills (null for a clear one). */
export function palette(look: Look): { ink: string; box: string; onBox: string; dim: string; ground: string | null } {
  const yellowType = look === "black" || look === "clear-yellow";
  return {
    ink: yellowType ? YELLOW : BLACK,
    box: yellowType ? YELLOW : BLACK,
    onBox: yellowType ? BLACK : YELLOW,
    dim: yellowType ? "rgba(255,237,0,.7)" : "rgba(10,10,10,.7)",
    ground: look === "yellow" ? YELLOW : look === "black" ? BLACK : null,
  };
}

/* The largest size, stepping down by 2 to `min`, at which `text` fits
 * `width`. Leaves ctx.font set to it. */
export function fit(ctx: CanvasRenderingContext2D, text: string, family: string, max: number, min: number, width: number, weight = 400): number {
  let size = max;
  for (; size > min; size -= 2) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= width) break;
  }
  ctx.font = `${weight} ${size}px ${family}`;
  return size;
}

/* One line of type at the left edge; returns the y after it. */
export function line(
  ctx: CanvasRenderingContext2D,
  draw: boolean,
  y: number,
  text: string,
  family: string,
  weight: number,
  size: number,
  color: string,
  gapAfter: number,
  track = 0,
): number {
  if (draw) {
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.fillStyle = color;
    ctx.textBaseline = "alphabetic";
    if (track) ctx.letterSpacing = `${track}px`;
    ctx.fillText(text, PAD, y + size * 0.86);
    if (track) ctx.letterSpacing = "0px";
  }
  return y + size + gapAfter;
}

/* A word in a filled box, the way the year sits — PRO on a category
 * (owner, 2026-10-14: "you know how 27 is opposite from the rest of the
 * sticker ... let's do the same thing with pro"). Condensed caps, tracked.
 * Returns the box's width. */
export function tag(ctx: CanvasRenderingContext2D, draw: boolean, x: number, y: number, text: string, fonts: Fonts, look: Look, size = 26): number {
  const { box, onBox } = palette(look);
  ctx.font = `700 ${size}px ${fonts.cond}`;
  ctx.letterSpacing = "4px";
  const w = ctx.measureText(text).width + 4 + size * 0.9;
  const h = size * 1.5;
  if (draw) {
    ctx.fillStyle = box;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = onBox;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(text, x + size * 0.45, y + size * 0.86 + (h - size) / 2);
  }
  ctx.letterSpacing = "0px";
  return w;
}

/* HYROX, then the city huge and the year in a box — "Las Vegas Hyrox 2027
 * or just 27", the owner's own suggestion — and a rule, unless `rule` is
 * off (the mark alone). Returns the y under it. */
export function paintHeader(ctx: CanvasRenderingContext2D, fonts: Fonts, look: Look, city: string, year: number, draw: boolean, y0 = PAD, rule = true): number {
  const { ink, box, onBox } = palette(look);
  let y = line(ctx, draw, y0, "HYROX", fonts.cond, 700, 40, ink, 10, 10);

  const yr = `’${String(year).slice(-2)}`;
  const cityUp = city.toUpperCase();
  ctx.font = `400 ${YEAR}px ${fonts.display}`;
  const yw = ctx.measureText(yr).width + 36;
  const citySize = fit(ctx, cityUp, fonts.display, YEAR, 60, INNER - yw - 24);
  const baseline = y + YEAR_PAD + YEAR * 0.86;
  const boxTop = y;
  const boxH = YEAR_PAD + YEAR * 0.86 + YEAR_PAD;
  if (draw) {
    ctx.fillStyle = ink;
    ctx.font = `400 ${citySize}px ${fonts.display}`;
    ctx.fillText(cityUp, PAD, baseline);
    ctx.fillStyle = box;
    ctx.fillRect(W - PAD - yw, boxTop, yw, boxH);
    ctx.fillStyle = onBox;
    ctx.font = `400 ${YEAR}px ${fonts.display}`;
    ctx.fillText(yr, W - PAD - yw + 18, baseline);
  }
  y = boxTop + boxH + 26;
  if (!rule) return y;

  if (draw) {
    ctx.fillStyle = ink;
    ctx.fillRect(PAD, y, INNER, 6);
  }
  return y + 6 + 26;
}

/* ---------------------------------------------------------- the cards */

/* A card painter: lays out from `y0`, paints when `draw`, returns the y
 * it ended at. */
type CardPainter = (ctx: CanvasRenderingContext2D, fonts: Fonts, look: Look, draw: boolean, y0: number) => number;

/* Paints a card either at its own height (frame = null: the canvas is
 * the card plus the padding) or at the top of a frame of a fixed height
 * (a story or a post — owner, 2026-10-14: "the header is always at the
 * top and not centered vertically"). Returns the canvas height. */
export function placeCard(ctx: CanvasRenderingContext2D, fonts: Fonts, look: Look, draw: boolean, frame: number | null, card: CardPainter): number {
  if (draw) card(ctx, fonts, look, true, PAD);
  if (frame !== null) return frame;
  return card(ctx, fonts, look, false, 0) + PAD * 2;
}

/* THE MARK: the header without its rule, nothing else. */
export const titleCard =
  (city: string, year: number): CardPainter =>
  (ctx, fonts, look, draw, y0) =>
    paintHeader(ctx, fonts, look, city, year, draw, y0, false) - 26;

/* Whole days from the viewer's today to the event's first day. */
export function daysUntil(ev: HyroxEvent, now = new Date()): number {
  const [y, m, d] = ev.days[0].date.split("-").map(Number);
  const first = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((first - today) / 86_400_000);
}

/* DAYS AWAY: the mark over the count, huge. TODAY on the day, RACE WEEKEND
 * after. The count is taken when the card paints, from the phone's own
 * calendar, so a story posted tonight says tonight's number. */
export const daysCard =
  (ev: HyroxEvent): CardPainter =>
  (ctx, fonts, look, draw, y0) => {
    const { ink } = palette(look);
    let y = paintHeader(ctx, fonts, look, ev.city, ev.year, draw, y0);
    const n = daysUntil(ev);
    const big = n > 0 ? String(n) : n === 0 ? "TODAY" : "RACE WEEKEND";
    const under = n > 1 ? "DAYS AWAY" : n === 1 ? "DAY AWAY" : n === 0 ? "IT IS HERE" : "";
    const bs = fit(ctx, big, fonts.display, 320, 90, INNER);
    y = line(ctx, draw, y + 6, big, fonts.display, 400, bs, ink, 6);
    if (under) y = line(ctx, draw, y, under, fonts.cond, 700, 48, ink, 0, 10);
    return y;
  };

/* LET US KNOW YOU'RE RACING: the mark and the ask. No address (owner,
 * 2026-10-14: "never put mikianmusser.com on any stickers unless I ask
 * for it"). */
export const signUpCard =
  (ev: HyroxEvent): CardPainter =>
  (ctx, fonts, look, draw, y0) => {
    const { ink } = palette(look);
    let y = paintHeader(ctx, fonts, look, ev.city, ev.year, draw, y0);
    y += 14;
    const lines = ["LET US KNOW", "YOU’RE RACING."];
    const size = Math.min(...lines.map((t) => fit(ctx, t, fonts.display, 200, 80, INNER)));
    for (const t of lines) y = line(ctx, draw, y, t, fonts.display, 400, size, ink, 6);
    y = line(ctx, draw, y + 28, "PUT YOUR NAME ON THE BOARD", fonts.cond, 700, 40, ink, 0, 6);
    return y;
  };

/* A ROWER'S OWN RACE (Sticker.tsx): THE RACE — category, day, the names
 * — or START, the same block with the start time huge. */
export type EntryFacts = {
  city: string;
  year: number;
  /* "Women's Pro Doubles". */
  category: string;
  /* "Sat, Mar 13". */
  day: string;
  name: string;
  partners: string[];
  startTime: string;
  /* For the file name. */
  slug: string;
};

export const entryCard =
  (facts: EntryFacts, card: "race" | "start"): CardPainter =>
  (ctx, fonts, look, draw, y0) => {
    const { ink, dim } = palette(look);
    const up = (s: string) => s.toUpperCase();
    let y = paintHeader(ctx, fonts, look, facts.city, facts.year, draw, y0);
    if (card === "start") {
      y = line(ctx, draw, y, "START", fonts.cond, 700, 40, ink, 4, 10);
      const t = up(facts.startTime || "TBA");
      const ts = fit(ctx, t, fonts.display, 220, 80, INNER);
      y = line(ctx, draw, y, t, fonts.display, 400, ts, ink, 18);
      y = line(ctx, draw, y, up(facts.day), fonts.cond, 700, 48, ink, 22, 4);
      const who = [facts.name, ...facts.partners].filter(Boolean).map(up).join("  ·  ");
      const ws = fit(ctx, who, fonts.cond, 44, 24, INNER, 600);
      y = line(ctx, draw, y, who, fonts.cond, 600, ws, ink, 8, 2);
      y = line(ctx, draw, y, up(facts.category), fonts.cond, 600, 32, dim, 0, 4);
      return y;
    }
    const cat = up(facts.category);
    const cs = fit(ctx, cat, fonts.display, 72, 40, INNER);
    y = line(ctx, draw, y, cat, fonts.display, 400, cs, ink, 6);
    y = line(ctx, draw, y, up(facts.day) + (facts.startTime ? `  ·  ${up(facts.startTime)}` : ""), fonts.cond, 700, 44, ink, 26, 4);
    const names = [facts.name, ...facts.partners].filter(Boolean);
    names.forEach((n, i) => {
      const text = (i === 0 ? "" : "& ") + up(n);
      const ns = fit(ctx, text, fonts.display, 92, 44, INNER);
      y = line(ctx, draw, y, text, fonts.display, 400, ns, ink, 4);
    });
    return y - 4;
  };
