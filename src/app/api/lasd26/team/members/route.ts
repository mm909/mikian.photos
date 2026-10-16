import { NextResponse } from "next/server";
import { ensureOwnerMember, getTeamViewer } from "@/lib/lasd26/team";
import { dueFor } from "@/lib/lasd26/settle";

/**
 * GET /api/lasd26/team/members — the roster against the bill, for the
 * team. Members see names, roles, join times and where each person stands
 * (share, fronted, net, status — the same numbers as the expenses page,
 * so the group can see who has settled and who is owed); only the owner
 * gets emails and the paid / paid-out details (when, how much, via).
 * The owner's row carries pool: true and status "pool" (2026-10-16:
 * "People will be paying me") — it never owes, is never owed, never paid.
 * Outsiders get 403, signed-out 401.
 */
export const runtime = "nodejs";

export async function GET() {
  const viewer = await ensureOwnerMember(await getTeamViewer());
  if (!viewer.actor) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!viewer.onTeam) return NextResponse.json({ ok: false, error: "Not on the team." }, { status: 403 });

  try {
    const due = await dueFor();
    const members = due.members.map((m) => {
      const base = {
        id: m.memberId,
        name: m.name,
        role: m.role,
        shareCents: m.shareCents,
        frontedCents: m.frontedCents,
        netCents: m.netCents,
        status: m.status,
        pool: m.pool,
        paid: m.status === "paid",
      };
      if (!viewer.owner) return base;
      return {
        ...base,
        paidAt: m.paidAt ? m.paidAt.toISOString() : null,
        paidCents: m.paidAt ? m.paidCents : null,
        paidVia: m.paidVia,
        settledAt: m.settledAt ? m.settledAt.toISOString() : null,
        settledCents: m.settledCents,
        outstandingCents: m.outstandingCents,
        owedCents: m.owedCents,
      };
    });
    return NextResponse.json({
      ok: true,
      members,
      count: members.length,
      totalCents: due.totalCents,
      perPersonCents: due.perPersonCents,
      splitCount: due.splitCount,
      settleOpen: due.settleOpen,
    });
  } catch (err) {
    console.error("lasd26/team/members failed", err);
    return NextResponse.json({ ok: false, error: "Could not read the roster." }, { status: 500 });
  }
}
