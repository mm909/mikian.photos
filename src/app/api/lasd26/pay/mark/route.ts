import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTeamViewer, TEAM } from "@/lib/lasd26/team";
import { dueFor } from "@/lib/lasd26/settle";

export const runtime = "nodejs";

/* The owner's hand on the ledger (the pay page: "Prefer Venmo/Zelle? Tell
 * Mikian and he'll mark you paid.").
 *
 *   POST { memberId, paid: true, cents? }  → paidAt now, paidCents = cents
 *                                            (whole cents; the live share
 *                                            when left out), paidVia "manual"
 *   POST { memberId, paid: false }         → clears the mark — paidAt,
 *                                            paidCents, paidVia and any
 *                                            PayPal capture id
 *
 * Owner only. Clearing a PayPal payment does not refund it (nothing on
 * this site refunds a share); it only lets the row be paid again, which
 * is what you want when a capture was recorded against the wrong person. */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const viewer = await getTeamViewer(TEAM);
  if (!viewer.actor) return bad("Sign in with Google first.", 401);
  if (!viewer.owner) return bad("Owner only.", 403);

  let body: { memberId?: unknown; paid?: unknown; cents?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return bad("Send JSON.");
  }

  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  if (!memberId) return bad("memberId required.");
  if (typeof body.paid !== "boolean") return bad("paid must be true or false.");

  const member = await db.teamMember.findFirst({ where: { id: memberId, team: TEAM }, select: { id: true, name: true } });
  if (!member) return bad("No such member on this team.", 404);

  if (!body.paid) {
    const row = await db.teamMember.update({
      where: { id: member.id },
      data: { paidAt: null, paidCents: null, paidVia: null, paypalCaptureId: null },
      select: { id: true, name: true, paidAt: true, paidCents: true, paidVia: true },
    });
    return NextResponse.json({ ok: true, member: row });
  }

  let cents: number;
  if (body.cents === undefined || body.cents === null || body.cents === "") {
    cents = (await dueFor(TEAM)).perPersonCents;
  } else if (typeof body.cents === "number" && Number.isInteger(body.cents) && body.cents >= 0) {
    cents = body.cents;
  } else if (typeof body.cents === "string" && /^\d+$/.test(body.cents.trim())) {
    cents = Number(body.cents.trim());
  } else {
    return bad("cents must be a whole number of cents.");
  }

  const row = await db.teamMember.update({
    where: { id: member.id },
    data: { paidAt: new Date(), paidCents: cents, paidVia: "manual", paypalCaptureId: null },
    select: { id: true, name: true, paidAt: true, paidCents: true, paidVia: true },
  });
  return NextResponse.json({ ok: true, member: row });
}
