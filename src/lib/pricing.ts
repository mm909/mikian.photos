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
 * Resolve the bundle price (in cents) for an event: the owner-set
 * Event.bundlePriceCents if present and valid, else the static default.
 */
export async function resolveBundlePriceCents(eventId: string): Promise<number> {
  try {
    const ev = await db.event.findUnique({
      where: { id: eventId },
      select: { bundlePriceCents: true },
    });
    const cents = ev?.bundlePriceCents;
    if (typeof cents === "number" && Number.isFinite(cents) && cents >= 0) {
      return cents;
    }
  } catch {
    /* fall through to default */
  }
  return defaultBundlePriceCents();
}

/** Cents → dollars (number), rounded to 2 dp. */
export function centsToDollars(cents: number): number {
  return +(cents / 100).toFixed(2);
}
