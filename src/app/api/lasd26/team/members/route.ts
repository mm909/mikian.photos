import { NextResponse } from "next/server";
import { getTeamViewer, listMembers } from "@/lib/lasd26/team";

/**
 * GET /api/lasd26/team/members — the roster, for the team.
 * Members see names, roles, join times and a paid yes/no (so the group can
 * see who has settled); only the owner gets emails and the paid details
 * (when, how much, via). Outsiders get 403, signed-out 401.
 */
export const runtime = "nodejs";

export async function GET() {
  const viewer = await getTeamViewer();
  if (!viewer.actor) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!viewer.onTeam) return NextResponse.json({ ok: false, error: "Not on the team." }, { status: 403 });

  try {
    const rows = await listMembers();
    const members = rows.map((m) => {
      const base = { id: m.id, name: m.name, role: m.role, joinedAt: m.joinedAt.toISOString(), paid: m.paidAt !== null };
      if (!viewer.owner) return base;
      return {
        ...base,
        email: m.email,
        paidAt: m.paidAt ? m.paidAt.toISOString() : null,
        paidCents: m.paidCents,
        paidVia: m.paidVia,
      };
    });
    return NextResponse.json({ ok: true, members, count: members.length });
  } catch (err) {
    console.error("lasd26/team/members failed", err);
    return NextResponse.json({ ok: false, error: "Could not read the roster." }, { status: 500 });
  }
}
