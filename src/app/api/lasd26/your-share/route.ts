import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { captureOrder, createOrder } from "@/lib/paypal";
import { isPaymentsOpen } from "@/lib/paymentLock";
import { ensureOwnerMember, getTeamViewer, TEAM } from "@/lib/lasd26/team";
import { dueFor, memberDue } from "@/lib/lasd26/settle";
import { fmtUsd, wholeDollarsUp } from "@/lib/lasd26/money";
import { sendOwnerNotification } from "@/lib/email";
import { POOL_STAND_IN_CENTS } from "@/lib/lasd26/yourShare";

export const runtime = "nodejs";

/* PAY WHAT YOU'RE ABLE — the route behind /lasd26/your-share (owner,
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
 * LIVE BUT UNLISTED, like the page (owner, 2026-10-29: "Make it 'live' but
 * only if I send the link to someone"): no dev gate. EVERY CAPTURE EMAILS
 * THE OWNER (CLAUDE.md; owner, 2026-10-29: "Make sure I get an email when
 * someone submits something") — logged, never surfaced, when the send
 * fails.
 *
 * Guards, in order: payments open (the owner's unlock cookie
 * bypasses the site-wide lock, as everywhere), signed in, on the team,
 * settling up open OR the owner, and something still owed. The pool's own
 * row (the owner's) pays the stand-in to himself — a live test, nothing
 * recorded (lib/lasd26/yourShare.ts). */

const MIN_CENTS = 100;

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const viewer = await ensureOwnerMember(await getTeamViewer(TEAM));
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
  // The pool (the owner) pays the stand-in to himself as a live test
  // (lib/lasd26/yourShare.ts); everyone else what they still owe.
  const pool = mine.status === "pool";
  if (!pool && mine.status === "paid") return bad("Already paid — thank you.", 409);
  if (!pool && mine.status === "owed") return bad(`Nothing to pay — you fronted more than your share, Mikian owes you ${fmtUsd(mine.owedCents)}.`, 409);
  if (!pool && mine.status === "square") return bad("All square — nothing to pay.", 409);
  if (!pool && mine.outstandingCents <= 0) return bad("Nothing to pay yet — the cost sheet is empty.", 409);
  const ceiling = pool ? POOL_STAND_IN_CENTS : wholeDollarsUp(mine.outstandingCents);

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
      console.error("lasd26/your-share: paypal create failed", err);
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
        console.warn(`lasd26/your-share: capture ${captureId} paid ${paidCents} for member ${viewer.member.id} — not recorded as paid`);
        await db.teamMember.update({
          where: { id: viewer.member.id },
          data: { paypalCaptureId: captureId },
        });
        const odd = await sendOwnerNotification(
          `LASD26 — ${viewer.member.name}: card paid ${fmtUsd(paidCents)}, NOT recorded as paid`,
          `${viewer.member.name} <${viewer.member.email}> — PayPal capture ${captureId} came back as ${fmtUsd(paidCents)} on /lasd26/your-share. Their row is NOT marked paid; they owe ${fmtUsd(mine.outstandingCents)}.
${new Date().toISOString()}`,
          viewer.member.email,
        );
        if (!odd.ok) console.error("lasd26/your-share: owner email failed", odd.error);
        return bad(`The card paid ${fmtUsd(paidCents)} — tell Mikian and he'll sort it.`, 402);
      }
      if (pool) {
        const test = await sendOwnerNotification(
          `LASD26 — your own test payment: ${fmtUsd(paidCents)}`,
          `You paid ${fmtUsd(paidCents)} to yourself on /lasd26/your-share (the pool's live test). Nothing is recorded on your row.
PayPal capture ${captureId}
${new Date().toISOString()}`,
          viewer.member.email,
        );
        if (!test.ok) console.error("lasd26/your-share: owner email failed", test.error);
        return NextResponse.json({ ok: true, status: "paid", test: true, captureId, paidCents, paid: fmtUsd(paidCents) });
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
      // Every payment emails the owner, whatever its size (CLAUDE.md; owner,
      // 2026-10-29: "Make sure I get an email when someone submits something").
      const sent = await sendOwnerNotification(
        `LASD26 — ${viewer.member.name} paid ${fmtUsd(paidCents)}`,
        `${viewer.member.name} <${viewer.member.email}> paid ${fmtUsd(paidCents)} by card on /lasd26/your-share.

Share ${fmtUsd(mine.shareCents)} · fronted ${fmtUsd(mine.frontedCents)} · owed ${fmtUsd(mine.outstandingCents)} · could send up to ${fmtUsd(ceiling, { whole: true })}
PayPal capture ${captureId}
${new Date().toISOString()}`,
        viewer.member.email,
      );
      if (!sent.ok) console.error("lasd26/your-share: owner email failed", sent.error);
      return NextResponse.json({
        ok: true,
        status: "paid",
        captureId,
        paidCents,
        paid: fmtUsd(paidCents),
      });
    } catch (err) {
      console.error("lasd26/your-share: paypal capture failed", err);
      return bad("Couldn't finish the payment — if your card shows it went through, tell Mikian and he'll mark you paid.", 502);
    }
  }

  return bad("action must be create or capture.");
}
