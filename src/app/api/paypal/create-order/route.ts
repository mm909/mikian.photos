import { NextResponse } from "next/server";
import { createOrder } from "@/lib/paypal";
import { prices } from "@/lib/data";

// One bundle = $30 + processing fee (PayPal Standard ~2.9% + $0.49).
// Total is what we charge the buyer; PayPal nets ~$30 to the seller.
function bundleTotal(): number {
  const sub = prices.bundle;
  return +(sub + sub * prices.stripeRate + prices.stripeFlat).toFixed(2);
}

export async function POST() {
  try {
    const total = bundleTotal();
    const order = await createOrder({
      amountUsd: total,
      description: "Mikian.Photos — all race photos bundle",
    });
    return NextResponse.json({ id: order.id, amount: total });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
