import { NextResponse } from "next/server";
import { createOrder } from "@/lib/paypal";
import { isPaymentsOpen } from "@/lib/paymentLock";
import { prices } from "@/lib/data";
import { resolveBundlePriceCents, centsToDollars } from "@/lib/pricing";

/**
 * Compute the buyer total for a given cart kind + photo count.
 *
 * Pricing rules are owned server-side so the client can't ask us to charge
 * the wrong amount (e.g. $0 for a bundle). Client tells us what KIND it
 * wants to buy and how many photos for `multi`, and we compute total.
 *
 * For single/multi, total = (count × single price) + processing fee.
 * For bundle, total = the event's owner-set bundle price (Event.bundlePriceCents,
 * falling back to the static default) + processing fee. (count is ignored.)
 *
 * Processing fee mirrors what the cart UI estimates so the buyer sees the
 * same total at every step.
 */
async function totalFor(
  kind: "bundle" | "multi",
  count: number,
  eventId?: string
): Promise<number> {
  const subtotal =
    kind === "bundle"
      ? eventId
        ? centsToDollars(await resolveBundlePriceCents(eventId))
        : prices.bundle
      : Math.max(0, count) * prices.single;
  const total = subtotal + subtotal * prices.stripeRate + prices.stripeFlat;
  return +total.toFixed(2);
}

type Body = {
  kind?: "bundle" | "multi";
  /** For kind="multi", how many photos. Ignored for bundle. */
  count?: number;
  /** Event the bundle covers — used to resolve the owner-set bundle price. */
  eventId?: string;
};

export async function POST(req: Request) {
  if (!isPaymentsOpen()) {
    return NextResponse.json(
      { error: "Payments are not open yet. Check back soon." },
      { status: 503 }
    );
  }
  try {
    // Older callers (and any cached client) may POST with no body. Default
    // to the historical behaviour: kind=bundle, no count needed.
    let kind: "bundle" | "multi" = "bundle";
    let count = 0;
    let eventId: string | undefined;
    try {
      const body = (await req.json()) as Body;
      if (body.kind === "multi" || body.kind === "bundle") kind = body.kind;
      if (typeof body.count === "number") count = body.count;
      if (typeof body.eventId === "string" && body.eventId) eventId = body.eventId;
    } catch {
      /* empty body — keep defaults */
    }

    if (kind === "multi" && count <= 0) {
      return NextResponse.json(
        { error: "kind=multi requires count >= 1" },
        { status: 400 }
      );
    }

    const total = await totalFor(kind, count, eventId);
    const description =
      kind === "bundle"
        ? "Mikian.Photos — all race photos bundle"
        : `Mikian.Photos — ${count} race photo${count === 1 ? "" : "s"}`;

    const order = await createOrder({
      amountUsd: total,
      description,
    });
    return NextResponse.json({ id: order.id, amount: total });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
