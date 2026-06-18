import { NextResponse } from "next/server";
import { hasRole, requireEventManager, requireRole } from "@/lib/permissions";
import { db } from "@/lib/db";
import { getDefaultEvent, getEvent, listEvents } from "@/lib/events";
import { formatOrderNumber } from "@/lib/orderId";

/**
 * GET /api/admin/orders
 *   ?eventId=<id>  — every order for ONE event. Gated by canManageEvent
 *                    (platform owner OR the event's own owner).
 *   ?all=1         — every order across ALL events. Platform-owner only.
 *
 * Refund/resend actions are owner-gated on their own routes; here we just flag
 * which rows are refundable so the UI shows the button only to owners.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORDER_SELECT = {
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
  eventIdCovered: true,
} as const;

type OrderRow = {
  orderNumber: number;
  email: string;
  kind: string;
  amount: number;
  photoIds: string[];
  paidAt: Date;
  paypalCaptureId: string | null;
  downloadToken: string | null;
  emailSentAt: Date | null;
  emailError: string | null;
  refundedAt: Date | null;
  refundId: string | null;
  eventIdCovered: string | null;
};

function mapRow(o: OrderRow, isOwner: boolean, eventName: string) {
  const tag = formatOrderNumber(o.orderNumber);
  const simulated = Boolean(o.paypalCaptureId?.startsWith("DEV-FAKE"));
  return {
    orderNumber: o.orderNumber,
    orderNumberDisplay: tag,
    email: o.email,
    kind: o.kind,
    amount: o.amount,
    photoCount: o.photoIds.length,
    eventId: o.eventIdCovered,
    eventName,
    paidAt: o.paidAt.toISOString(),
    refundedAt: o.refundedAt ? o.refundedAt.toISOString() : null,
    emailSentAt: o.emailSentAt ? o.emailSentAt.toISOString() : null,
    emailError: o.emailError ?? null,
    simulated,
    // A row is refundable only for owners, when it has a real (non-simulated)
    // capture and hasn't already been refunded.
    refundable: isOwner && !o.refundedAt && Boolean(o.paypalCaptureId) && !simulated,
    // Magic-link URL so an owner can open any buyer's order page (the token
    // grants access without being the buyer).
    orderUrl: `/orders/${tag}${o.downloadToken ? `?key=${encodeURIComponent(o.downloadToken)}` : ""}`,
  };
}

function computeStats(orders: ReturnType<typeof mapRow>[]) {
  const gross = orders.reduce((s, o) => s + o.amount, 0);
  const refunded = orders.filter((o) => o.refundedAt);
  const refundedUsd = refunded.reduce((s, o) => s + o.amount, 0);
  return {
    count: orders.length,
    grossUsd: +gross.toFixed(2),
    netUsd: +(gross - refundedUsd).toFixed(2),
    refundedCount: refunded.length,
    refundedUsd: +refundedUsd.toFixed(2),
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  // --- All-events view (platform owner only) -------------------------------
  if (url.searchParams.get("all") === "1") {
    const actor = await requireRole("owner");
    if (!actor) {
      return NextResponse.json({ error: "Owner role required" }, { status: 403 });
    }
    const events = await listEvents({ includeArchived: true });
    const nameById = new Map(events.map((e) => [e.id, e.name]));
    const rows = (await db.order.findMany({
      orderBy: { paidAt: "desc" },
      select: ORDER_SELECT,
    })) as OrderRow[];
    const orders = rows.map((o) =>
      mapRow(o, true, (o.eventIdCovered && nameById.get(o.eventIdCovered)) || "—")
    );
    return NextResponse.json({
      event: { id: "all", name: "All events" },
      isOwner: true,
      allEvents: true,
      stats: computeStats(orders),
      orders,
    });
  }

  // --- Single-event view ----------------------------------------------------
  const qEventId = url.searchParams.get("eventId");
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
  const rows = (await db.order.findMany({
    where: { eventIdCovered: eventId },
    orderBy: { paidAt: "desc" },
    select: ORDER_SELECT,
  })) as OrderRow[];

  const orders = rows.map((o) => mapRow(o, isOwner, ev.name));
  return NextResponse.json({
    event: { id: eventId, name: ev.name },
    isOwner,
    allEvents: false,
    stats: computeStats(orders),
    orders,
  });
}
