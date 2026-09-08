import { GOAL_METERS } from "@/lib/row100k";

/* THE SHIRT — pure rules and copy, safe in client components.
 *
 * Owner, 2026-09-08: sell the Rowtember shirt for $20 OR 100,000 meters —
 * free if you get the 100K, $20 if you did not, settled at the END of the
 * month, never before ("buy now, pay later" — and no paying early, no
 * giving it up). Reserving never subtracts from a total. Pick-up only.
 * Sizes side by side; a size that is gone still sells, as a pre-order,
 * counted on the same box. Dev first. */

export const SHIRT_PRICE_USD = 20;
export const SHIRT_FREE_AT = GOAL_METERS;

/* DEV ONLY for now (owner, 2026-09-08: live "as long as all of the shop
 * parts are only for dev"): in production every shop surface — the page,
 * the pay page, the buy and pay routes — answers only to a challenge
 * admin. Flip this one function when the shop opens. */
export function shopOpenFor(isAdmin: boolean): boolean {
  return process.env.NODE_ENV !== "production" || isAdmin;
}

/* Pick-up only — the owner's call. One line, used everywhere it comes up. */
export const PICKUP_LINE = "Pick-up only — no shipping. Where and when comes by email once the month is settled.";

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

/* ------------------------------------------------------------- the emails */

const M = (n: number) => `${Math.round(n).toLocaleString("en-US")} m`;

/* The receipt, the moment they buy (owner, 2026-09-08): their total meters,
 * the reminder that $20 is charged at the end of the month without the
 * 100K, and the pick-up reminder. Plain text, the site's voice. */
export function receiptEmail(o: {
  name: string;
  rowerNumber: number;
  size: string;
  kind: "stock" | "preorder";
  meters: number;
}): { subject: string; text: string } {
  const num = String(o.rowerNumber).padStart(3, "0");
  const left = Math.max(0, SHIRT_FREE_AT - o.meters);
  const standing =
    o.meters >= SHIRT_FREE_AT
      ? `You are at ${M(o.meters)} — past the ${SHIRT_FREE_AT / 1000}K. As it stands, the shirt is free.`
      : `You are at ${M(o.meters)} — ${M(left)} from the ${SHIRT_FREE_AT / 1000}K.`;
  return {
    subject: `Your Rowtember shirt — size ${o.size}, rower ${num}`,
    text: [
      `ROWTEMBER 2026 — THE SHIRT`,
      ``,
      `${o.name} · rower ${num}`,
      `Size ${o.size}${o.kind === "preorder" ? " — pre-order, ships with the next run" : ""}`,
      ``,
      `BUY NOW, PAY LATER`,
      `$${SHIRT_PRICE_USD} or ${M(SHIRT_FREE_AT)}. Nothing is charged today.`,
      `At the end of the month the shirt is free if you have rowed ${M(SHIRT_FREE_AT)},`,
      `and $${SHIRT_PRICE_USD} if you have not. The shirt never comes out of your total.`,
      ``,
      `WHERE YOU STAND`,
      standing,
      ``,
      `PICK-UP`,
      PICKUP_LINE,
      ``,
      `Row on.`,
    ].join("\n"),
  };
}

/* Month end, one of two. */
export function settledEmail(o: {
  name: string;
  rowerNumber: number;
  size: string;
  meters: number;
  free: boolean;
  payUrl: string;
}): { subject: string; text: string } {
  const num = String(o.rowerNumber).padStart(3, "0");
  return o.free
    ? {
        subject: `Your Rowtember shirt is free — ${M(o.meters)}`,
        text: [
          `ROWTEMBER 2026 — THE SHIRT`,
          ``,
          `${o.name} · rower ${num} · size ${o.size}`,
          ``,
          `${M(o.meters)}. You got the ${SHIRT_FREE_AT / 1000}K. The shirt is yours, nothing owed.`,
          ``,
          `PICK-UP`,
          PICKUP_LINE,
        ].join("\n"),
      }
    : {
        subject: `Your Rowtember shirt — $${SHIRT_PRICE_USD} due`,
        text: [
          `ROWTEMBER 2026 — THE SHIRT`,
          ``,
          `${o.name} · rower ${num} · size ${o.size}`,
          ``,
          `${M(o.meters)} — short of the ${SHIRT_FREE_AT / 1000}K, so the shirt is $${SHIRT_PRICE_USD}, as agreed.`,
          `Pay here (PayPal, or any card as a guest):`,
          o.payUrl,
          ``,
          `PICK-UP`,
          PICKUP_LINE,
        ].join("\n"),
      };
}
