import { NextResponse } from "next/server";
import { requireRole, hasRole } from "@/lib/permissions";
import { db } from "@/lib/db";
import { currentEvent } from "@/lib/data";
import { formatOrderNumber } from "@/lib/orderId";

/**
 * GET /api/admin/orders — every order for the current run.
 *
 * Visible to owner AND race_director (owner implies race_director, so
 * requireRole("race_director") admits both). Refund/resend actions are
 * gated separately to owner on their own routes; here we just flag which
 * rows are refundable so the UI can show the button only to owners.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireRole("race_director");
  if (!actor) {
    return NextResponse.json(
      { error: "Race director or owner role required" },
      { status: 403 }
    );
  }
  const isOwner = hasRole(actor, "owner");

  const eventId = currentEvent.id;
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

  const eventName = Array.isArray(currentEvent.name)
    ? currentEvent.name.join(" ")
    : String(currentEvent.name);

  return NextResponse.json({ event: { id: eventId, name: eventName }, isOwner, stats, orders });
}
