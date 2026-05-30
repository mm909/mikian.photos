/**
 * Capture a PayPal order and persist it.
 *
 * Flow:
 *   1. Capture via PayPal (server-to-server). Bail on non-COMPLETED.
 *   2. Look up the buyer's session — if signed-in, link Order.userId.
 *   3. Hand off to createPaidOrder(): snapshot covered photos, insert the
 *      Order, mint + persist the download token, fire the receipt email.
 *
 * Returns: orderNumber + orderUrl so the client can redirect.
 */

import { NextResponse } from "next/server";
import { captureOrder } from "@/lib/paypal";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { buildOrderPayload, createPaidOrder, resolveBaseUrl } from "@/lib/createOrder";

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
      return NextResponse.json({ error: "eventId required" }, { status: 400 });
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
      return NextResponse.json(buildOrderPayload(existing));
    }

    // 2) Linkage — pull session, link userId if email matches PayPal payer.
    const actor = await getEffectiveActor();
    const userId =
      actor && actor.email.toLowerCase() === payerEmail ? actor.photographerId : null;

    // 3) Snapshot + persist + email.
    const result = await createPaidOrder({
      email: payerEmail,
      userId,
      kind,
      eventId,
      clientPhotoIds,
      amountUsd,
      paypalCaptureId: captured.id,
      baseUrl: resolveBaseUrl(req),
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, missing: result.missing },
        { status: result.status }
      );
    }

    return NextResponse.json(buildOrderPayload(result.order));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("capture-order failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
