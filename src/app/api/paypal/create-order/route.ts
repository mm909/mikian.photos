import { NextResponse } from "next/server";
import { createOrder } from "@/lib/paypal";
import { isPaymentsOpen } from "@/lib/paymentLock";
import { isOwnerActor } from "@/lib/permissions";
import { orderTotalUsd } from "@/lib/pricing";

type Body = {
  kind?: "bundle" | "multi";
  /** For kind="multi", how many photos. Ignored for bundle. */
  count?: number;
  /** Event the bundle covers — used to resolve the owner-set bundle price. */
  eventId?: string;
};

export async function POST(req: Request) {
  // Owner can always reach the buy flow even while the shop is locked for
  // everyone else — lets the owner run real (or simulated) test purchases.
  if (!isPaymentsOpen() && !(await isOwnerActor())) {
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

    const total = await orderTotalUsd(kind, count, eventId);

    // Free event (or a $0 total): PayPal rejects $0 orders, so skip it entirely.
    // The client claims the photos via /api/orders/free-claim instead.
    if (total <= 0) {
      return NextResponse.json({ free: true, amount: 0 });
    }

    const description =
      kind === "bundle"
        ? "Mikian.Photos — all photos bundle"
        : `Mikian.Photos — ${count} photo${count === 1 ? "" : "s"}`;

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
