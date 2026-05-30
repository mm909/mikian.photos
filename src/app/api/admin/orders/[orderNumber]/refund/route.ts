import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { db } from "@/lib/db";
import { parseOrderNumber } from "@/lib/orderId";
import { refundCapture, getCaptureIdFromOrder } from "@/lib/paypal";

/**
 * POST /api/admin/orders/[orderNumber]/refund — owner only.
 *
 * Issues a FULL PayPal refund against the order's capture, then records
 * refundedAt + refundId. Guarded so it can't double-refund or be fired at a
 * simulated (DEV-FAKE) order with no real payment behind it. The actual money
 * movement is PayPal's; this route only triggers it on the owner's request.
 */
export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: { orderNumber: string } }
) {
  const actor = await requireRole("owner");
  if (!actor) return NextResponse.json({ error: "Owner only" }, { status: 403 });

  const n = parseOrderNumber(params.orderNumber);
  if (n == null) return NextResponse.json({ error: "Bad order number" }, { status: 400 });

  const order = await db.order.findUnique({ where: { orderNumber: n } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (order.refundedAt) {
    return NextResponse.json({ error: "Order is already refunded" }, { status: 409 });
  }
  if (!order.paypalCaptureId) {
    return NextResponse.json(
      { error: "No PayPal capture on this order — nothing to refund" },
      { status: 400 }
    );
  }
  if (order.paypalCaptureId.startsWith("DEV-FAKE")) {
    return NextResponse.json(
      { error: "Simulated order — there's no real payment to refund" },
      { status: 400 }
    );
  }

  // Refund. Some orders stored the PayPal *order* id in paypalCaptureId (the
  // capture response's top-level `id`), so /captures/{id}/refund 404s with
  // INVALID_RESOURCE_ID. On that error, resolve the real capture id from the
  // order id, retry once, and persist the correction.
  let captureId = order.paypalCaptureId;
  let refund: { id: string; status: string };
  try {
    refund = await refundCapture(captureId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const wrongId = /INVALID_RESOURCE_ID|RESOURCE_NOT_FOUND|\(404\)/.test(msg);
    const resolved = wrongId
      ? await getCaptureIdFromOrder(captureId).catch(() => null)
      : null;
    if (!resolved || resolved === captureId) {
      return NextResponse.json(
        {
          ok: false,
          error: wrongId
            ? `PayPal couldn't find that capture. If the order was paid in a different PayPal environment than PAYPAL_ENV points to, the refund can't reach it. (${msg})`
            : msg,
        },
        { status: 502 }
      );
    }
    try {
      refund = await refundCapture(resolved);
      captureId = resolved;
    } catch (e2) {
      return NextResponse.json(
        { ok: false, error: e2 instanceof Error ? e2.message : String(e2) },
        { status: 502 }
      );
    }
  }

  const updated = await db.order.update({
    where: { id: order.id },
    data: { refundedAt: new Date(), refundId: refund.id, paypalCaptureId: captureId },
    select: { refundedAt: true },
  });

  return NextResponse.json({
    ok: true,
    refundId: refund.id,
    status: refund.status,
    refundedAt: updated.refundedAt ? updated.refundedAt.toISOString() : null,
  });
}
