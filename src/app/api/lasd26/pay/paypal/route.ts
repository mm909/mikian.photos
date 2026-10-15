import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { captureOrder, createOrder } from "@/lib/paypal";
import { isPaymentsOpen } from "@/lib/paymentLock";
import { getTeamViewer, TEAM } from "@/lib/lasd26/team";
import { dueFor, memberDue } from "@/lib/lasd26/settle";
import { fmtUsd } from "@/lib/lasd26/money";

export const runtime = "nodejs";

/* Paying YOUR SHARE of the crossing (owner, 2026-10-15: "each person's
 * share payable on the site by card after the race"). The same PayPal
 * connection the photo shop and the Rowtember shirt use (lib/paypal.ts),
 * with its own two steps so nothing else is touched:
 *
 *   POST { action: "create" }            → a PayPal order for the caller's
 *                                          outstanding share (reference =
 *                                          their TeamMember.id)
 *   POST { action: "capture", orderId }  → capture it and mark them paid
 *
 * Guards, in order: payments open (the owner's unlock cookie bypasses the
 * site-wide lock, as everywhere), signed in, on the team (a member row —
 * the owner too must have joined through the link to carry a share),
 * settling up open OR the owner (owner: the pay button is his alone until
 * he opens it), and not already paid. The amount is the live share
 * (settle.ts), never a number from the client. */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const viewer = await getTeamViewer(TEAM);
  if (!isPaymentsOpen() && !viewer.owner) return bad("Payments are paused right now.", 503);
  if (!viewer.actor) return bad("Sign in with Google first.", 401);
  if (!viewer.member) {
    return bad(viewer.owner ? "You are not on the roster yet — join through the invite link to carry a share." : "Join the team through the invite link first.", 403);
  }

  let body: { action?: unknown; orderId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return bad("Send JSON.");
  }

  const due = await dueFor(TEAM);
  if (!due.settleOpen && !viewer.owner) return bad("Settling up opens after the race — the crew will send the word.", 403);
  const mine = memberDue(viewer.member, due);
  if (mine.paid) return bad("Already paid.", 409);
  if (mine.outstandingCents <= 0) return bad("Nothing to pay yet — the cost sheet is empty.", 409);
  const amountUsd = mine.outstandingCents / 100;

  if (body.action === "create") {
    try {
      const order = await createOrder({
        amountUsd,
        description: "LASD26 — your share",
        referenceId: viewer.member.id,
      });
      return NextResponse.json({ ok: true, id: order.id, amountCents: mine.outstandingCents, amount: fmtUsd(mine.outstandingCents) });
    } catch (err) {
      console.error("lasd26/pay: paypal create failed", err);
      return bad("Couldn't start the payment — try again.", 502);
    }
  }

  if (body.action === "capture") {
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    if (!orderId) return bad("orderId required.");
    try {
      const captured = await captureOrder(orderId);
      if (captured.status !== "COMPLETED") return bad(`Capture not completed: ${captured.status}`, 402);
      const captureId = captured.captureId ?? captured.id;
      // What PayPal actually took, in cents; the share we asked for when the
      // response leaves the amount out (it never should).
      const paidCents = typeof captured.amountUsd === "number" && Number.isFinite(captured.amountUsd) ? Math.round(captured.amountUsd * 100) : mine.outstandingCents;
      // The order id comes from the browser. Only a capture that covers the
      // share settles it: an order for less (any approved order on the same
      // PayPal account could be handed to this route) is kept as a record
      // but leaves the member unpaid, and says so.
      if (paidCents + 1 < mine.outstandingCents) {
        console.warn(`lasd26/pay: capture ${captureId} paid ${paidCents} < share ${mine.outstandingCents} for member ${viewer.member.id}`);
        await db.teamMember.update({ where: { id: viewer.member.id }, data: { paypalCaptureId: captureId } });
        return bad(`PayPal took ${fmtUsd(paidCents)} but your share is ${fmtUsd(mine.outstandingCents)} — tell Mikian and he'll sort it.`, 402);
      }
      await db.teamMember.update({
        where: { id: viewer.member.id },
        data: { paidAt: new Date(), paidCents, paidVia: "paypal", paypalCaptureId: captureId },
      });
      return NextResponse.json({ ok: true, status: "paid", captureId, paidCents, paid: fmtUsd(paidCents) });
    } catch (err) {
      console.error("lasd26/pay: paypal capture failed", err);
      return bad("Couldn't finish the payment — if PayPal shows it went through, tell Mikian and he'll mark you paid.", 502);
    }
  }

  return bad("action must be create or capture.");
}
