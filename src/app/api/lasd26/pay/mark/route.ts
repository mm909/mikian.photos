import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTeamViewer, TEAM } from "@/lib/lasd26/team";
import { dueFor } from "@/lib/lasd26/settle";

export const runtime = "nodejs";

/* The owner's hand on the ledger — both directions (owner, 2026-10-16:
 * someone who fronted gas is OWED; "prevent me from having to reimburse
 * someone for them to just pay it back").
 *
 *   POST { memberId, paid: true, cents? }  → paidAt now, paidCents = cents
 *                                            (whole cents; what they still
 *                                            owe — share minus what they
 *                                            fronted — when left out),
 *                                            paidVia "manual". Cash, Venmo,
 *                                            Zelle.
 *   POST { memberId, settled: true }       → the owner has paid them out
 *                                            of the pool: settledAt now,
 *                                            settledCents = what the pool
 *                                            owed them (0 when it did not).
 *   POST { memberId, paid: false }         → clears BOTH marks — paidAt,
 *        (or settled: false)                 paidCents, paidVia, any
 *                                            PayPal capture id, settledAt,
 *                                            settledCents.
 *
 * Owner only. Clearing a card payment does not refund it (nothing on this
 * site refunds a share); it only lets the row be paid again, which is
 * what you want when a capture was recorded against the wrong person. */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

const MEMBER_OUT = { id: true, name: true, paidAt: true, paidCents: true, paidVia: true, settledAt: true, settledCents: true } as const;

export async function POST(req: Request) {
  const viewer = await getTeamViewer(TEAM);
  if (!viewer.actor) return bad("Sign in with Google first.", 401);
  if (!viewer.owner) return bad("Owner only.", 403);

  let body: { memberId?: unknown; paid?: unknown; settled?: unknown; cents?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return bad("Send JSON.");
  }

  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  if (!memberId) return bad("memberId required.");
  const paid = typeof body.paid === "boolean" ? body.paid : null;
  const settled = typeof body.settled === "boolean" ? body.settled : null;
  if (paid === null && settled === null) return bad("Send paid or settled, true or false.");

  const member = await db.teamMember.findFirst({ where: { id: memberId, team: TEAM }, select: { id: true, name: true } });
  if (!member) return bad("No such member on this team.", 404);

  // Either flag false: unmark everything.
  if (paid !== true && settled !== true) {
    const row = await db.teamMember.update({
      where: { id: member.id },
      data: { paidAt: null, paidCents: null, paidVia: null, paypalCaptureId: null, settledAt: null, settledCents: null },
      select: MEMBER_OUT,
    });
    return NextResponse.json({ ok: true, member: row });
  }

  const due = await dueFor(TEAM);
  const mine = due.members.find((r) => r.memberId === member.id);

  if (paid === true) {
    let cents: number;
    if (body.cents === undefined || body.cents === null || body.cents === "") {
      // What they still owe: the share less what they fronted (never below 0).
      cents = Math.max(0, mine?.netCents ?? due.perPersonCents);
    } else if (typeof body.cents === "number" && Number.isInteger(body.cents) && body.cents >= 0) {
      cents = body.cents;
    } else if (typeof body.cents === "string" && /^\d+$/.test(body.cents.trim())) {
      cents = Number(body.cents.trim());
    } else {
      return bad("cents must be a whole number of cents.");
    }
    const row = await db.teamMember.update({
      where: { id: member.id },
      data: { paidAt: new Date(), paidCents: cents, paidVia: "manual", paypalCaptureId: null, settledAt: null, settledCents: null },
      select: MEMBER_OUT,
    });
    return NextResponse.json({ ok: true, member: row });
  }

  // settled: the pool owed them and the owner has sent it.
  const owed = Math.max(0, -(mine?.netCents ?? 0));
  const row = await db.teamMember.update({
    where: { id: member.id },
    data: { settledAt: new Date(), settledCents: owed },
    select: MEMBER_OUT,
  });
  return NextResponse.json({ ok: true, member: row });
}
