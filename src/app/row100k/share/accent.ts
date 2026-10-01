import { DEFAULT_PALETTE, accentOn, capsOn, paletteOf } from "@/lib/rowPalette";

/* THE ACCENT THE SHARE CARDS PAINT IN (cards.ts: the ROWTEMBER mark every
 * card is stamped with, and the 100K plaque of the club card). It was one
 * constant, the September water blue, and stayed blue on a site that had
 * gone red and then orange (owner, 2026-10-01: "the colors on some of
 * these ... are a little funky. Like they're blue and also red or orange";
 * "instead of red, let's pick like October orange").
 *
 * A card is a canvas: it cannot read a CSS variable, and its draw function
 * is handed the rower's numbers and the fonts, not the page. So the page
 * tells this file instead — RowSite, the wrapper every /row100k page
 * renders inside, sets the palette's cut for the look the site wears as it
 * renders, before any card under it can paint — and cards.ts asks here at
 * draw time. `caps` is the type a slab of the accent carries (rowPalette.ts
 * capsOn): ink on the pumpkin, white on a red or the blue.
 *
 * Outside the layout (a harness drawing a card on its own) it is the
 * default preset's ink cut. Module state, client-side in effect: nothing
 * draws on the server. */
const start = accentOn(paletteOf(DEFAULT_PALETTE), "ink");
let accent = start.accent;
let caps = capsOn(start.accent);

export function setCardAccent(nextAccent: string, nextCaps: string): void {
  accent = nextAccent;
  caps = nextCaps;
}

export function cardAccent(): { accent: string; caps: string } {
  return { accent, caps };
}
