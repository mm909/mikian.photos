/**
 * Bundle pricing resolution. Server-only.
 *
 * The bundle price is owner-editable per event (Event.bundlePriceCents) and is
 * the authoritative number for both display and charging. When an event has no
 * explicit price set we fall back to the static `prices.bundle` default so
 * older events (and a fresh DB) still work.
 *
 * Money is stored + passed around as whole cents (Int) to avoid float drift;
 * convert to dollars only at the display / PayPal boundary.
 */
import "server-only";
import { db } from "./db";
import { prices } from "./data";

/** The static fallback, in cents. */
export function defaultBundlePriceCents(): number {
  return Math.round(prices.bundle * 100);
}

/**
 * Resolve an event's pricing in one query: whether it's free, and the bundle
 * price in cents (0 when free). A free event short-circuits to 0 regardless of
 * any bundlePriceCents that may be set. One helper so resolveBundlePriceCents
 * and orderTotalUsd agree and don't double-query.
 */
export async function getEventPricing(
  eventId: string
): Promise<{ isFree: boolean; bundleCents: number }> {
  try {
    const ev = await db.event.findUnique({
      where: { id: eventId },
      select: { isFree: true, bundlePriceCents: true },
    });
    if (ev?.isFree) return { isFree: true, bundleCents: 0 };
    const cents = ev?.bundlePriceCents;
    if (typeof cents === "number" && Number.isFinite(cents) && cents >= 0) {
      return { isFree: false, bundleCents: cents };
    }
  } catch {
    /* fall through to default */
  }
  return { isFree: false, bundleCents: defaultBundlePriceCents() };
}

/**
 * Resolve the bundle price (in cents) for an event: 0 when free, else the
 * owner-set Event.bundlePriceCents if present and valid, else the static default.
 */
export async function resolveBundlePriceCents(eventId: string): Promise<number> {
  return (await getEventPricing(eventId)).bundleCents;
}

/** Cents → dollars (number), rounded to 2 dp. */
export function centsToDollars(cents: number): number {
  return +(cents / 100).toFixed(2);
}

/**
 * Buyer total (USD) for a cart kind + photo count, including the processing
 * fee. Authoritative — both the real PayPal create-order route and the
 * owner-only fake-order route compute the charge through here so they always
 * agree. Bundle ignores `count` and uses the event's owner-set price.
 */
export async function orderTotalUsd(
  kind: "bundle" | "multi",
  count: number,
  eventId?: string
): Promise<number> {
  const subtotal =
    kind === "bundle"
      ? eventId
        ? centsToDollars((await getEventPricing(eventId)).bundleCents)
        : prices.bundle
      : Math.max(0, count) * prices.single;
  // Free → $0 with NO processing fee. (A free event resolves bundleCents to 0
  // via getEventPricing; a $0 paid misconfig is treated as free here too, so it
  // never tries to charge PayPal $0.30.)
  if (subtotal <= 0) return 0;
  const total = subtotal + subtotal * prices.stripeRate + prices.stripeFlat;
  return +total.toFixed(2);
}
