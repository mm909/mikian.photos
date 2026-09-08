import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { captureOrder, createOrder } from "@/lib/paypal";
import { isPaymentsOpen } from "@/lib/paymentLock";
import { getEffectiveActor, isOwnerActor } from "@/lib/permissions";
import { CHALLENGE, isRow100kAdmin } from "@/lib/row100k";
import { SHIRT_PRICE_USD, shopOpenFor } from "@/app/row100k/shirt";

export const runtime = "nodejs";

/* Paying for THE SHIRT once it has been billed — the same PayPal connection
 * the photo shop uses (lib/paypal.ts createOrder / captureOrder, the same
 * client id on the page), with its own two steps so the photo order flow
 * is untouched.
 *
 *   POST { action: "create" }            → a PayPal order for $20 against
 *                                          the caller's billed shirt
 *   POST { action: "capture", orderId }  → capture it and mark the shirt paid
 *
 * Only a shirt the month-end settlement marked "owed" can be paid (owner
 * call, 2026-09-08: no paying early). */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  if (!isPaymentsOpen() && !(await isOwnerActor())) {
    return bad("Payments are not open yet.", 503);
  }
  const actor = await getEffectiveActor();
  if (!actor) return bad("Sign in with Google first.", 401);
  if (!shopOpenFor(isRow100kAdmin(actor.email, actor.roles))) return bad("The shirt is not on sale yet.", 403);
  const p = await db.rowParticipant.findUnique({
    where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
    select: { id: true },
  });
  if (!p) return bad("Opt in to Rowtember first.", 403);

  let body: { action?: unknown; orderId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return bad("Send JSON.");
  }

  const mine = await db.rowShirtOrder.findUnique({
    where: { challenge_participantId: { challenge: CHALLENGE, participantId: p.id } },
    select: { id: true, status: true, size: true, amountUsd: true },
  });
  if (!mine) return bad("No shirt on your name.", 409);
  if (mine.status === "paid") return bad("Already paid.", 409);
  if (mine.status !== "owed") return bad("Nothing is due until the month is settled.", 409);

  if (body.action === "create") {
    try {
      const order = await createOrder({
        amountUsd: mine.amountUsd || SHIRT_PRICE_USD,
        description: `Rowtember shirt — size ${mine.size}`,
        referenceId: mine.id,
      });
      return NextResponse.json({ ok: true, id: order.id, amount: mine.amountUsd || SHIRT_PRICE_USD });
    } catch (err) {
      console.error("row100k shirt: paypal create failed", err);
      return bad("Couldn't start the payment — try again.", 502);
    }
  }

  if (body.action === "capture") {
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    if (!orderId) return bad("orderId required.");
    try {
      const captured = await captureOrder(orderId);
      if (captured.status !== "COMPLETED") return bad(`Capture not completed: ${captured.status}`, 402);
      const captureId = captured.captureId ?? captured.id;
      await db.rowShirtOrder.update({
        where: { id: mine.id },
        data: {
          status: "paid",
          paypalCaptureId: captureId,
          payerEmail: captured.payerEmail ?? actor.email,
          amountUsd: captured.amountUsd ?? mine.amountUsd,
          paidAt: new Date(),
        },
      });
      return NextResponse.json({ ok: true, status: "paid", captureId });
    } catch (err) {
      console.error("row100k shirt: paypal capture failed", err);
      return bad("Couldn't finish the payment — if PayPal shows it went through, email and it will be sorted.", 502);
    }
  }

  return bad("action must be create or capture.");
}
