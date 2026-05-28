/**
 * Capture a PayPal order and persist it.
 *
 * Flow:
 *   1. Capture via PayPal (server-to-server). Bail on non-COMPLETED.
 *   2. Look up the buyer's session — if signed-in, link Order.userId.
 *   3. Snapshot the photos this purchase covers, scoped by `kind`:
 *        kind="bundle"  → every visible photo in the named event.
 *        kind="multi"   → exactly the photoIds the client sent, after we
 *                         validate each one belongs to the event and isn't
 *                         hidden. Never trust the client list blindly.
 *   4. Insert Order, mint a tiny `{ orderId }` downloadToken, write the
 *      token back onto the row.
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
  /** Event the order covers. Required for both bundle and multi. */
  eventId?: string;
  /** "bundle" → all event photos. "multi" → specific photoIds. */
  kind?: "bundle" | "multi";
  /** For kind=multi: the photo ids the buyer is claiming. Server validates. */
  photoIds?: string[];
};

const MAX_MULTI_PHOTOS = 200;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const { orderId, eventId, kind = "bundle", photoIds: clientPhotoIds } = body;
    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }
    if (!eventId) {
      return NextResponse.json(
        { error: "eventId required" },
        { status: 400 }
      );
    }
    if (kind === "multi") {
      if (!Array.isArray(clientPhotoIds) || clientPhotoIds.length === 0) {
        return NextResponse.json(
          { error: "kind=multi requires non-empty photoIds" },
          { status: 400 }
        );
      }
      if (clientPhotoIds.length > MAX_MULTI_PHOTOS) {
        return NextResponse.json(
          { error: `multi orders capped at ${MAX_MULTI_PHOTOS} photos` },
          { status: 400 }
        );
      }
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
      return NextResponse.json(
        { error: "PayPal capture missing payer email" },
        { status: 500 }
      );
    }

    // Idempotency: PayPal occasionally retries on flaky networks. If we've
    // already saved this capture, return the existing row.
    const existing = await db.order.findUnique({
      where: { paypalCaptureId: captured.id },
    });
    if (existing) {
      return NextResponse.json(buildReturnPayload(existing));
    }

    // 2) Linkage — pull session, link userId if email matches PayPal payer.
    const actor = await getEffectiveActor();
    const userId =
      actor && actor.email.toLowerCase() === payerEmail ? actor.photographerId : null;

    // 3) Resolve event + snapshot photoIds.
    const ev = await db.event.findUnique({
      where: { id: eventId },
      select: { id: true, name: true },
    });
    if (!ev) {
      return NextResponse.json({ error: "Unknown eventId" }, { status: 400 });
    }
    const eventName = ev.name;

    let photoIds: string[];
    if (kind === "bundle") {
      const photos = await db.photo.findMany({
        where: { eventId: ev.id, hidden: false },
        select: { id: true },
      });
      photoIds = photos.map((p) => p.id);
    } else {
      // kind === "multi" — validate every client-supplied id belongs to the
      // event AND isn't hidden. Dedup defensively. If even one id is invalid
      // we reject the whole order so the buyer doesn't end up with a partial
      // entitlement.
      const requested = Array.from(new Set(clientPhotoIds!));
      const found = await db.photo.findMany({
        where: { id: { in: requested }, eventId: ev.id, hidden: false },
        select: { id: true },
      });
      if (found.length !== requested.length) {
        const validIds = new Set(found.map((p) => p.id));
        const missing = requested.filter((id) => !validIds.has(id));
        return NextResponse.json(
          {
            error: "Some photos are not available for this event",
            missing,
          },
          { status: 400 }
        );
      }
      photoIds = found.map((p) => p.id);
    }

    // 4) Insert order + mint token + save token back.
    const order = await db.order.create({
      data: {
        email: payerEmail,
        userId,
        kind,
        amount: amountUsd,
        eventIdCovered: eventId,
        photoIds,
        paypalCaptureId: captured.id,
      },
    });

    const token = await mintDownloadToken({ orderId: order.id });
    const orderWithToken = await db.order.update({
      where: { id: order.id },
      data: { downloadToken: token },
    });

    // 5) Receipt email — best-effort.
    const baseUrl = resolveBaseUrl(req);
    const orderTag = formatOrderNumber(orderWithToken.orderNumber);
    const orderUrl = `${baseUrl}/orders/${orderTag}?key=${encodeURIComponent(token)}`;
    // Direct ZIP URL — same token, different endpoint. Lets the buyer skip
    // the order page and grab everything in one click from the receipt.
    const zipUrl = `${baseUrl}/api/orders/${orderTag}/zip?key=${encodeURIComponent(token)}`;
    const subtotal = amountUsd - +(amountUsd * prices.stripeRate + prices.stripeFlat).toFixed(2);
    const itemLabel =
      kind === "bundle"
        ? `All photos bundle · ${eventName}`
        : `${photoIds.length} photo${photoIds.length === 1 ? "" : "s"} · ${eventName}`;

    void sendReceiptEmail(payerEmail, {
      orderNumber: orderWithToken.orderNumber,
      paidAt: orderWithToken.paidAt,
      email: payerEmail,
      amountUsd,
      eventName,
      photoCount: photoIds.length,
      lineItems: [
        { label: itemLabel, amountUsd: Math.max(subtotal, 0) },
        {
          label: "Processing fee",
          amountUsd: Math.max(amountUsd - Math.max(subtotal, 0), 0),
        },
      ],
      orderUrl,
      zipUrl,
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
    orderUrl: `/orders/${orderNumberStr}${o.downloadToken ? `?key=${encodeURIComponent(o.downloadToken)}` : ""}`,
  };
}

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
