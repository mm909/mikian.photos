/**
 * Capture a PayPal order and persist it.
 *
 * Flow:
 *   1. Capture via PayPal (server-to-server). Bail on non-COMPLETED.
 *   2. Look up the buyer's session — if signed-in, link Order.userId.
 *   3. Snapshot the photos this purchase covers (server-side, NOT trusted
 *      from the client). For bundle, that's every visible photo in the
 *      named event.
 *   4. Insert Order, mint the downloadToken with { orderId, photoIds },
 *      write the token back onto the row.
 *   5. Fire off the receipt email (best-effort — log on failure, never
 *      fail the capture because email is flaky).
 *
 * Returns: orderNumber + orderUrl so the client can redirect.
 */

import { NextResponse } from "next/server";
import { captureOrder } from "@/lib/paypal";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { mintDownloadToken } from "@/lib/downloadToken";
import { sendReceiptEmail } from "@/lib/email";
import { formatOrderNumber } from "@/lib/orderId";
import { prices } from "@/lib/data";

export const runtime = "nodejs";

type Body = {
  orderId?: string;
  /** Event the bundle covers. Required for bundle kind. */
  eventId?: string;
  kind?: "bundle" | "single";
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const { orderId, eventId, kind = "bundle" } = body;
    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }
    if (kind === "bundle" && !eventId) {
      return NextResponse.json(
        { error: "eventId required for bundle orders" },
        { status: 400 }
      );
    }

    // 1) PayPal capture
    const captured = await captureOrder(orderId);
    if (captured.status !== "COMPLETED") {
      return NextResponse.json(
        { error: `Capture not completed: ${captured.status}`, captured },
        { status: 402 }
      );
    }
    const amountUsd = captured.amountUsd ?? 0;
    const payerEmail = captured.payerEmail?.toLowerCase().trim();
    if (!payerEmail) {
      // PayPal will almost always give us this back, but if it's missing the
      // order is unrecoverable from our side — we can't email the buyer.
      return NextResponse.json(
        { error: "PayPal capture missing payer email" },
        { status: 500 }
      );
    }

    // Idempotency: if we've already captured this PayPal id, return the
    // existing row instead of double-inserting. PayPal can retry on the
    // client side under flaky-network conditions.
    const existing = await db.order.findUnique({
      where: { paypalCaptureId: captured.id },
    });
    if (existing) {
      return NextResponse.json(buildReturnPayload(existing));
    }

    // 2) Linkage — pull session, link userId if email matches.
    const actor = await getEffectiveActor();
    const userId =
      actor && actor.email.toLowerCase() === payerEmail ? actor.photographerId : null;

    // 3) Snapshot photoIds (server trust — never use the client's list).
    let photoIds: string[] = [];
    let eventName = "Mikian.Photos";
    if (kind === "bundle" && eventId) {
      const ev = await db.event.findUnique({
        where: { id: eventId },
        select: { id: true, name: true },
      });
      if (!ev) {
        return NextResponse.json({ error: "Unknown eventId" }, { status: 400 });
      }
      eventName = ev.name;
      const photos = await db.photo.findMany({
        where: { eventId: ev.id, hidden: false },
        select: { id: true },
      });
      photoIds = photos.map((p) => p.id);
    }

    // 4) Insert order + mint token + save token back.
    const order = await db.order.create({
      data: {
        email: payerEmail,
        userId,
        kind,
        amount: amountUsd,
        eventIdCovered: eventId ?? null,
        photoIds,
        paypalCaptureId: captured.id,
      },
    });

    const token = await mintDownloadToken({ orderId: order.id, photoIds });
    const orderWithToken = await db.order.update({
      where: { id: order.id },
      data: { downloadToken: token },
    });

    // 5) Receipt email — best-effort.
    const baseUrl = resolveBaseUrl(req);
    const orderUrl = `${baseUrl}/orders/${formatOrderNumber(orderWithToken.orderNumber)}?key=${encodeURIComponent(token)}`;
    const subtotal = amountUsd - +(amountUsd * prices.stripeRate + prices.stripeFlat).toFixed(2);
    void sendReceiptEmail(payerEmail, {
      orderNumber: orderWithToken.orderNumber,
      paidAt: orderWithToken.paidAt,
      email: payerEmail,
      amountUsd,
      eventName,
      photoCount: photoIds.length,
      lineItems: [
        {
          label: `All photos bundle · ${eventName}`,
          amountUsd: Math.max(subtotal, 0),
        },
        {
          label: "Processing fee",
          amountUsd: Math.max(amountUsd - Math.max(subtotal, 0), 0),
        },
      ],
      orderUrl,
    });

    return NextResponse.json(buildReturnPayload(orderWithToken));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("capture-order failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function buildReturnPayload(o: {
  id: string;
  orderNumber: number;
  amount: number;
  downloadToken: string | null;
}) {
  const orderNumberStr = formatOrderNumber(o.orderNumber);
  return {
    orderId: o.id,
    orderNumber: o.orderNumber,
    orderNumberDisplay: orderNumberStr,
    amountUsd: o.amount,
    // Path the client should redirect to. Includes the token so the URL works
    // even when the buyer isn't signed in.
    orderUrl: `/orders/${orderNumberStr}${o.downloadToken ? `?key=${encodeURIComponent(o.downloadToken)}` : ""}`,
  };
}

/**
 * Best guess at the public base URL for receipt links. We prefer the
 * explicit env var (NEXT_PUBLIC_BASE_URL) so localhost dev still emails a
 * reachable URL; fall back to the request host so prod doesn't need to be
 * told its own name.
 */
function resolveBaseUrl(req: Request): string {
  const explicit = process.env.NEXT_PUBLIC_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "https://mikianmusser.com";
  }
}
