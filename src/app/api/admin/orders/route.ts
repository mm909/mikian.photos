import { NextResponse } from "next/server";
import { hasRole, requireEventManager } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getDefaultEvent, getEvent } from "@/lib/events";
import { formatOrderNumber } from "@/lib/orderId";

/**
 * GET /api/admin/orders?eventId= — every order for ONE event. Gated by
 * canManageEvent (platform owner OR the event's own owner). Refund/resend
 * actions are owner-gated on their own routes; here we just flag which rows are
 * refundable so the UI shows the button only to owners.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Scope to ?eventId= if supplied, else the default (newest published) event.
  const qEventId = new URL(req.url).searchParams.get("eventId");
  const ev = qEventId ? await getEvent(qEventId) : await getDefaultEvent();
  if (!ev) {
    return NextResponse.json({ error: "No event configured" }, { status: 404 });
  }
  const eventId = ev.id;

  const actor = await requireEventManager(eventId);
  if (!actor) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const isOwner = hasRole(actor, "owner");
  const rows = await db.order.findMany({
    where: { eventIdCovered: eventId },
    orderBy: { paidAt: "desc" },
    select: {
      orderNumber: true,
      email: true,
      kind: true,
      amount: true,
      photoIds: true,
      paidAt: true,
      paypalCaptureId: true,
      downloadToken: true,
      emailSentAt: true,
      emailError: true,
      refundedAt: true,
      refundId: true,
    },
  });

  const orders = rows.map((o) => {
    const tag = formatOrderNumber(o.orderNumber);
    const simulated = Boolean(o.paypalCaptureId?.startsWith("DEV-FAKE"));
    return {
      orderNumber: o.orderNumber,
      orderNumberDisplay: tag,
      email: o.email,
      kind: o.kind,
      amount: o.amount,
      photoCount: o.photoIds.length,
      paidAt: o.paidAt.toISOString(),
      refundedAt: o.refundedAt ? o.refundedAt.toISOString() : null,
      emailSentAt: o.emailSentAt ? o.emailSentAt.toISOString() : null,
      emailError: o.emailError ?? null,
      simulated,
      // A row is refundable only for owners, when it has a real (non-simulated)
      // capture and hasn't already been refunded.
      refundable: isOwner && !o.refundedAt && Boolean(o.paypalCaptureId) && !simulated,
      // Magic-link URL so an owner/race-director can open any buyer's order
      // page (token grants access without being the buyer).
      orderUrl: `/orders/${tag}${o.downloadToken ? `?key=${encodeURIComponent(o.downloadToken)}` : ""}`,
    };
  });

  const gross = orders.reduce((s, o) => s + o.amount, 0);
  const refunded = orders.filter((o) => o.refundedAt);
  const refundedUsd = refunded.reduce((s, o) => s + o.amount, 0);
  const stats = {
    count: orders.length,
    grossUsd: +gross.toFixed(2),
    netUsd: +(gross - refundedUsd).toFixed(2),
    refundedCount: refunded.length,
    refundedUsd: +refundedUsd.toFixed(2),
  };

  return NextResponse.json({ event: { id: eventId, name: ev.name }, isOwner, stats, orders });
}
