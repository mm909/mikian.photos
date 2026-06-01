import { NextResponse } from "next/server";
import { requireRole } from "@/lib/permissions";
import { db } from "@/lib/db";
import { parseOrderNumber } from "@/lib/orderId";
import { mintDownloadToken } from "@/lib/downloadToken";
import { buildReceiptInput, resolveBaseUrl } from "@/lib/createOrder";
import { sendReceiptEmail } from "@/lib/email";
import { currentEvent } from "@/lib/data";

/**
 * POST /api/admin/orders/[orderNumber]/resend — owner + race director.
 *
 * Re-sends the receipt email for an existing order (e.g. after fixing the
 * Resend domain, or if the buyer lost it). Rebuilds the same ReceiptInput
 * createPaidOrder uses, sends, and records the outcome on the order.
 */
export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { orderNumber: string } }
) {
  const actor = await requireRole("race_director");
  if (!actor) {
    return NextResponse.json(
      { error: "Race director or owner role required" },
      { status: 403 }
    );
  }

  const n = parseOrderNumber(params.orderNumber);
  if (n == null) return NextResponse.json({ error: "Bad order number" }, { status: 400 });

  const order = await db.order.findUnique({ where: { orderNumber: n } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Ensure a download token exists to embed in the receipt links.
  let token = order.downloadToken;
  if (!token) {
    token = await mintDownloadToken({ orderId: order.id });
    await db.order.update({ where: { id: order.id }, data: { downloadToken: token } });
  }

  // Event display name (fall back to the current run, then a generic label).
  let eventName = Array.isArray(currentEvent.name)
    ? currentEvent.name.join(" ")
    : String(currentEvent.name);
  if (order.eventIdCovered) {
    const ev = await db.event.findUnique({
      where: { id: order.eventIdCovered },
      select: { name: true },
    });
    if (ev?.name) eventName = ev.name;
  }

  const receipt = buildReceiptInput({
    orderNumber: order.orderNumber,
    paidAt: order.paidAt,
    email: order.email,
    amountUsd: order.amount,
    eventName,
    kind: order.kind,
    photoCount: order.photoIds.length,
    token,
    baseUrl: resolveBaseUrl(req),
  });

  const sent = await sendReceiptEmail(order.email, receipt);
  await db.order
    .update({
      where: { id: order.id },
      data: sent.ok
        ? { emailSentAt: new Date(), emailError: null }
        : { emailError: sent.error.slice(0, 500) },
    })
    .catch(() => {});

  if (!sent.ok) {
    return NextResponse.json(
      { ok: false, error: sent.error, sentTo: order.email },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, sentTo: order.email, id: sent.id ?? null });
}
