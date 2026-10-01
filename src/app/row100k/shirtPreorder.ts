import { SIZES, parseSize, type Size } from "./shirt";

/* THE SHIRT PRE-ORDER — pure rules and copy, safe in client components.
 *
 * Owner, 2026-09-30: sell the shirts as PRE-ORDERS, at cost, no payment
 * now — "you don't pay until we get them" — so there is no processor,
 * only RESERVE. Two shirts, black and cream, in the September sizes. A
 * signed-in rower reserves a size of either or both (one of each colour
 * at most), can change the size, or let it go. The number reserved of
 * each shirt is public, per colour and per size. Nothing about the 100K,
 * nothing about earning it, no price games: one line that they are sold
 * at cost and paid when they arrive.
 *
 * This is NOT the September shirt (./shirt.ts, RowShirtOrder): that one is
 * $20-or-100K, settled at the month end, and stays dev-only. Only the
 * sizes are shared. The table is RowShirtPreorder; the page is
 * /row100k/shirts, the route /api/row100k/shirts. */

export { SIZES, parseSize, type Size };

export const COLORS = ["black", "cream"] as const;
export type Color = (typeof COLORS)[number];

export function parseColor(v: unknown): Color | null {
  return typeof v === "string" && (COLORS as readonly string[]).includes(v) ? (v as Color) : null;
}

/* The word on the page for each shirt. */
export const COLOR_LABEL: Record<Color, string> = { black: "Black", cream: "Cream" };

/* THE PRICE IS NOT KNOWN YET (owner, 2026-09-30): the page prints "at
 * cost" and nothing else until the owner fills this in, at which point the
 * same line carries the number. Whole dollars. */
export const PREORDER_PRICE_USD: number | null = null;

/* The one line of copy on the page. */
export function costLine(price: number | null = PREORDER_PRICE_USD): string {
  return price === null ? "Sold at cost, paid when they arrive." : `Sold at cost — $${price} — paid when they arrive.`;
}

export type PreorderLite = {
  color: string;
  size: string;
  cancelledAt: Date | string | null;
};

export type ColorCount = {
  /* live reservations of this colour, every size */
  total: number;
  bySize: Record<Size, number>;
};

export type Counts = Record<Color, ColorCount>;

/* A rower's own live reservations: the size by colour, null where they
 * have none. */
export type Mine = Record<Color, string | null>;

/* What the page shows under each shirt and in the table: live rows only
 * (a row with cancelledAt set was let go and counts for nothing), per
 * colour and per size. A row whose colour or size is not one of ours — a
 * hand edit, say — is left out rather than counted under the wrong word. */
export function preorderCounts(rows: PreorderLite[]): Counts {
  const blank = (): ColorCount => ({
    total: 0,
    bySize: Object.fromEntries(SIZES.map((s) => [s, 0])) as Record<Size, number>,
  });
  const out: Counts = { black: blank(), cream: blank() };
  for (const r of rows) {
    if (r.cancelledAt) continue;
    const color = parseColor(r.color);
    const size = parseSize(r.size);
    if (!color || !size) continue;
    out[color].total += 1;
    out[color].bySize[size] += 1;
  }
  return out;
}
