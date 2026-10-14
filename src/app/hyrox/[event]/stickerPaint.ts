import { BLACK, YELLOW } from "../theme";

/* WHAT EVERY HYROX STICKER SHARES: the canvas width, the padding, the four
 * looks and the colours each puts on the type and the year box, a fitter
 * that shrinks a line until it holds, and the header — HYROX, the city
 * huge, the year in a box, a rule — that the entry sticker (Sticker.tsx)
 * and the roster (RosterSticker.tsx) both open with. No React here, so a
 * harness can paint a card on its own. */

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
 * `width` in the display face. Leaves ctx.font set to it. */
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

/* HYROX, then the city huge and the year in a box — "Las Vegas Hyrox 2027
 * or just 27", the owner's own suggestion — and a rule. Returns the y
 * under the rule. */
export function paintHeader(ctx: CanvasRenderingContext2D, fonts: Fonts, look: Look, city: string, year: number, draw: boolean, y0 = PAD): number {
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

  if (draw) {
    ctx.fillStyle = ink;
    ctx.fillRect(PAD, y, INNER, 6);
  }
  return y + 6 + 26;
}
