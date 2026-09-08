import { GOAL_METERS } from "@/lib/row100k";

/* THE SHIRT — pure rules and copy, safe in client components.
 *
 * Owner, 2026-09-08: sell the Rowtember shirt for $20 OR 100,000 meters —
 * free if you get the 100K, $20 if you did not, settled at the END of the
 * month, never before ("buy now, pay later" — and no paying early, no
 * giving it up). Reserving never subtracts from a total. Pick-up only.
 * Sizes side by side; a size that is gone still sells, as a pre-order,
 * counted on the same box. One shirt per rower; a rower with a shirt can
 * change its size, never buy a second. Dev first.
 *
 * The emails live in ./shirtEmail (server only — HTML and text twins). */

export const SHIRT_PRICE_USD = 20;
export const SHIRT_FREE_AT = GOAL_METERS;

/* DEV ONLY for now (owner, 2026-09-08: live "as long as all of the shop
 * parts are only for dev"): in production every shop surface — the page,
 * the pay page, the buy and pay routes — answers only to a challenge
 * admin. Flip this one function when the shop opens. */
export function shopOpenFor(isAdmin: boolean): boolean {
  return process.env.NODE_ENV !== "production" || isAdmin;
}

/* Pick-up only — the owner's call, and the whole of it (owner, 2026-09-08:
 * drop the where-and-when). One line, used everywhere it comes up. */
export const PICKUP_LINE = "Pick-up only.";

/* The sentence under the price (owner, 2026-09-08). */
export const PRICE_LINE = `The shirt costs $${SHIRT_PRICE_USD} or ${SHIRT_FREE_AT.toLocaleString("en-US")} meters, paid at the end of the month.`;

export const SIZES = ["S", "M", "L", "XL", "2XL"] as const;
export type Size = (typeof SIZES)[number];

export function parseSize(v: unknown): Size | null {
  return typeof v === "string" && (SIZES as readonly string[]).includes(v) ? (v as Size) : null;
}

/* What is on the shelf, per size. Dev numbers until the owner sends the
 * real count; the box shows these minus what is reserved. */
export const SHIRT_STOCK: Record<Size, number> = { S: 4, M: 8, L: 8, XL: 6, "2XL": 3 };

export type ShirtOrderLite = {
  size: string;
  kind: string;
  status: string;
};

export type SizeCount = {
  size: Size;
  stock: number;
  /* reserved against the shelf */
  taken: number;
  /* reserved past the shelf */
  preorders: number;
  /* still on the shelf */
  left: number;
};

/* The box numbers: live orders fill the shelf first, in the order they
 * were placed, and the rest are pre-orders. `kind` on a row is what the
 * rower was told when they bought, and it stays. */
export function shirtCounts(orders: ShirtOrderLite[]): SizeCount[] {
  return SIZES.map((size) => {
    const live = orders.filter((o) => o.size === size && o.status !== "cancelled");
    const taken = live.filter((o) => o.kind === "stock").length;
    const preorders = live.length - taken;
    const stock = SHIRT_STOCK[size];
    return { size, stock, taken, preorders, left: Math.max(0, stock - taken) };
  });
}

/* Whether a new order for this size gets a shelf spot or is a pre-order. */
export function nextKind(size: Size, counts: SizeCount[]): "stock" | "preorder" {
  const c = counts.find((x) => x.size === size);
  return c && c.left > 0 ? "stock" : "preorder";
}

/* The one line on a size box (owner, 2026-09-08: stock OR pre-order, not
 * both): what is left while there is any, then how many are pre-ordered —
 * "0 PRE-ORDERED" the moment it sells out. */
export function boxLine(c: SizeCount): string {
  return c.left > 0 ? `${c.left} IN STOCK` : `${c.preorders} PRE-ORDERED`;
}

/* The line under the price: what the rower will owe, as things stand. */
export function shirtDue(meters: number): { free: boolean; line: string } {
  if (meters >= SHIRT_FREE_AT) {
    return { free: true, line: `YOU GOT THE ${SHIRT_FREE_AT / 1000}K — THE SHIRT IS FREE` };
  }
  const left = SHIRT_FREE_AT - meters;
  return {
    free: false,
    line: `${left.toLocaleString("en-US")} M FROM FREE — OTHERWISE $${SHIRT_PRICE_USD} AT THE END OF THE MONTH`,
  };
}
