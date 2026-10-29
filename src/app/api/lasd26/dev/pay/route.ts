import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { captureOrder, createOrder } from "@/lib/paypal";
import { isPaymentsOpen } from "@/lib/paymentLock";
import { ensureOwnerMember, getTeamViewer, TEAM } from "@/lib/lasd26/team";
import { dueFor, memberDue } from "@/lib/lasd26/settle";
import { fmtUsd, wholeDollarsUp } from "@/lib/lasd26/money";

export const runtime = "nodejs";

/* PAY WHAT YOU'RE ABLE — the route behind /lasd26/dev/pay (owner,
 * 2026-10-28: "if someone is only able to pay $100 then I want to only
 * take that 100"). The same two steps as /api/lasd26/pay/paypal, with one
 * difference: the amount is THEIRS.
 *
 *   POST { action: "create", amountCents }  → a PayPal order for that
 *                                             amount (whole cents, $1 up to
 *                                             what they still owe)
 *   POST { action: "capture", orderId }     → capture it and mark them
 *                                             PAID at whatever it was
 *
 * The ceiling is the OUTSTANDING NET from settle.ts — the share less what
 * they fronted — rounded UP to the whole dollar, as the page shows it
 * (money.ts wholeDollarsUp), worked out here from the live cost sheet; the
 * page's number is never trusted for it. Below the ceiling anything goes, and a
 * capture settles the row whatever its size: paidAt set, paidCents = what
 * PayPal took (statusOf reads paidAt as paid, whatever the cents say), so
 * nobody is chased for the rest. The team console shows the figure.
 *
 * IN DEVELOPMENT (CLAUDE.md): the same gate as the page — a production
 * build answers 404 to anyone but the owner. When the page goes live this
 * body replaces /api/lasd26/pay/paypal.
 *
 * Guards, in order: the dev gate, payments open (the owner's unlock cookie
 * bypasses the site-wide lock, as everywhere), signed in, on the team,
 * settling up open OR the owner, and something still owed. The pool's own
 * row (the owner's) never pays — the page simulates for him. */

const MIN_CENTS = 100;

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const viewer = await ensureOwnerMember(await getTeamViewer(TEAM));
  if (process.env.NODE_ENV === "production" && !viewer.owner) return new NextResponse(null, { status: 404 });
  if (!isPaymentsOpen() && !viewer.owner) return bad("Payments are paused right now.", 503);
  if (!viewer.actor) return bad("Sign in with Google first.", 401);
  if (!viewer.member) return bad("Join the team through the invite link first.", 403);

  let body: { action?: unknown; orderId?: unknown; amountCents?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return bad("Send JSON.");
  }

  const due = await dueFor(TEAM);
  if (!due.settleOpen && !viewer.owner) return bad("Settling up opens after the race — the crew will send the word.", 403);
  const mine = memberDue(viewer.member, due);
  if (mine.status === "pool") return bad("You're the pool — people pay you; nothing to pay here.", 409);
  if (mine.status === "paid") return bad("Already paid — thank you.", 409);
  if (mine.status === "owed") return bad(`Nothing to pay — you fronted more than your share, Mikian owes you ${fmtUsd(mine.owedCents)}.`, 409);
  if (mine.status === "square") return bad("All square — nothing to pay.", 409);
  if (mine.outstandingCents <= 0) return bad("Nothing to pay yet — the cost sheet is empty.", 409);
  const ceiling = wholeDollarsUp(mine.outstandingCents);

  if (body.action === "create") {
    // Their figure: whole cents, $1 up to what they still owe.
    const cents = typeof body.amountCents === "number" && Number.isInteger(body.amountCents) ? body.amountCents : NaN;
    if (!Number.isFinite(cents) || cents < MIN_CENTS) return bad(`Pick an amount of at least ${fmtUsd(MIN_CENTS, { whole: true })}.`);
    if (cents > ceiling) return bad(`Your share is ${fmtUsd(ceiling, { whole: true })} — no need to send more than that.`);
    try {
      const order = await createOrder({
        amountUsd: cents / 100,
        description: "LASD26 — your share, as you're able",
        referenceId: viewer.member.id,
      });
      return NextResponse.json({
        ok: true,
        id: order.id,
        amountCents: cents,
        amount: fmtUsd(cents),
      });
    } catch (err) {
      console.error("lasd26/dev/pay: paypal create failed", err);
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
      // What PayPal actually took, in cents. The order id comes from the
      // browser, so the capture is the only number trusted: an order for
      // nothing (any approved order on the same PayPal account could be
      // handed to this route) is kept as a record and settles nothing.
      const paidCents = typeof captured.amountUsd === "number" && Number.isFinite(captured.amountUsd) ? Math.round(captured.amountUsd * 100) : 0;
      if (paidCents < MIN_CENTS) {
        console.warn(`lasd26/dev/pay: capture ${captureId} paid ${paidCents} for member ${viewer.member.id} — not recorded as paid`);
        await db.teamMember.update({
          where: { id: viewer.member.id },
          data: { paypalCaptureId: captureId },
        });
        return bad(`The card paid ${fmtUsd(paidCents)} — tell Mikian and he'll sort it.`, 402);
      }
      await db.teamMember.update({
        where: { id: viewer.member.id },
        data: {
          paidAt: new Date(),
          paidCents,
          paidVia: "card",
          paypalCaptureId: captureId,
        },
      });
      return NextResponse.json({
        ok: true,
        status: "paid",
        captureId,
        paidCents,
        paid: fmtUsd(paidCents),
      });
    } catch (err) {
      console.error("lasd26/dev/pay: paypal capture failed", err);
      return bad("Couldn't finish the payment — if your card shows it went through, tell Mikian and he'll mark you paid.", 502);
    }
  }

  return bad("action must be create or capture.");
}
