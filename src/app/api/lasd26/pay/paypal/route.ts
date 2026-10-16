import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { captureOrder, createOrder } from "@/lib/paypal";
import { isPaymentsOpen } from "@/lib/paymentLock";
import { ensureOwnerMember, getTeamViewer, TEAM } from "@/lib/lasd26/team";
import { dueFor, memberDue } from "@/lib/lasd26/settle";
import { fmtUsd } from "@/lib/lasd26/money";

export const runtime = "nodejs";

/* Paying what YOU OWE of the crossing (owner, 2026-10-15: "each person's
 * share payable on the site by card after the race"; 2026-10-16: "Allow
 * users to pay w/ card (only card)"). The same PayPal connection the photo
 * shop and the Rowtember shirt use (lib/paypal.ts) — the page shows only
 * the card button — with its own two steps so nothing else is touched:
 *
 *   POST { action: "create" }            → a PayPal order for what the
 *                                          caller still owes (reference =
 *                                          their TeamMember.id)
 *   POST { action: "capture", orderId }  → capture it and mark them paid
 *
 * The amount is the OUTSTANDING NET from settle.ts — the share less what
 * they fronted — never the full share when something was fronted, and
 * never a number from the client. A member the pool owes, or one who is
 * square, has nothing to pay here and is told so — and so is the pool
 * itself, the owner's own row (owner, 2026-10-16: "People will be paying
 * me"; settle.ts status "pool").
 *
 * Guards, in order: payments open (the owner's unlock cookie bypasses the
 * site-wide lock, as everywhere), signed in, on the team (a member row —
 * the owner gets his made on the way in), settling up open OR the owner
 * (owner: the pay button is his alone until he opens it), and something
 * still owed. */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const viewer = await ensureOwnerMember(await getTeamViewer(TEAM));
  if (!isPaymentsOpen() && !viewer.owner) return bad("Payments are paused right now.", 503);
  if (!viewer.actor) return bad("Sign in with Google first.", 401);
  if (!viewer.member) return bad("Join the team through the invite link first.", 403);

  let body: { action?: unknown; orderId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return bad("Send JSON.");
  }

  const due = await dueFor(TEAM);
  if (!due.settleOpen && !viewer.owner) return bad("Settling up opens after the race — the crew will send the word.", 403);
  const mine = memberDue(viewer.member, due);
  if (mine.status === "pool") return bad("You're the pool — people pay you; nothing to pay here.", 409);
  if (mine.status === "paid") return bad("Already paid.", 409);
  if (mine.status === "owed") return bad(`Nothing to pay — you fronted more than your share, Mikian owes you ${fmtUsd(mine.owedCents)}.`, 409);
  if (mine.status === "square") return bad("All square — nothing to pay.", 409);
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
      // What PayPal actually took, in cents; the net we asked for when the
      // response leaves the amount out (it never should).
      const paidCents = typeof captured.amountUsd === "number" && Number.isFinite(captured.amountUsd) ? Math.round(captured.amountUsd * 100) : mine.outstandingCents;
      // The order id comes from the browser. Only a capture that covers what
      // is owed settles it: an order for less (any approved order on the
      // same PayPal account could be handed to this route) is kept as a
      // record but leaves the member unpaid, and says so.
      if (paidCents + 1 < mine.outstandingCents) {
        console.warn(`lasd26/pay: capture ${captureId} paid ${paidCents} < owed ${mine.outstandingCents} for member ${viewer.member.id}`);
        await db.teamMember.update({ where: { id: viewer.member.id }, data: { paypalCaptureId: captureId } });
        return bad(`The card paid ${fmtUsd(paidCents)} but you owe ${fmtUsd(mine.outstandingCents)} — tell Mikian and he'll sort it.`, 402);
      }
      await db.teamMember.update({
        where: { id: viewer.member.id },
        data: { paidAt: new Date(), paidCents, paidVia: "card", paypalCaptureId: captureId },
      });
      return NextResponse.json({ ok: true, status: "paid", captureId, paidCents, paid: fmtUsd(paidCents) });
    } catch (err) {
      console.error("lasd26/pay: paypal capture failed", err);
      return bad("Couldn't finish the payment — if your card shows it went through, tell Mikian and he'll mark you paid.", 502);
    }
  }

  return bad("action must be create or capture.");
}
