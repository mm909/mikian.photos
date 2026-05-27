import { NextResponse } from "next/server";
import { createOrder } from "@/lib/paypal";
import { isPaymentsOpen } from "@/lib/paymentLock";
import { prices } from "@/lib/data";

// Bundle total = price + processing fee. What we charge the buyer; PayPal nets ~bundle to the seller.
function bundleTotal(): number {
  const sub = prices.bundle;
  return +(sub + sub * prices.stripeRate + prices.stripeFlat).toFixed(2);
}

export async function POST() {
  if (!isPaymentsOpen()) {
    return NextResponse.json(
      { error: "Payments are not open yet. Check back soon." },
      { status: 503 }
    );
  }
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
