import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { TEAM, getTeamViewer } from "@/lib/lasd26/team";

export const runtime = "nodejs";

/* DELETE /api/lasd26/team/members/<id> — the owner takes someone off the
 * team (owner, 2026-10-16: "let me remove users", after the seed had put
 * him on the roster twice). The row goes; the costs they paid for or
 * added stay on the sheet and lose their name (the schema's SetNull on
 * TeamExpense.paidById / addedById), receipts keep their addedById as a
 * plain column. Anyone removed can join again through the invite link. */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const viewer = await getTeamViewer();
  if (!viewer.actor) return bad("Sign in first.", 401);
  if (!viewer.owner) return bad("Only the owner can remove a member.", 403);
  const id = (params.id ?? "").trim();
  if (!id) return bad("Member id required.");
  const member = await db.teamMember.findFirst({ where: { id, team: TEAM }, select: { id: true, name: true } });
  if (!member) return bad("No such member on this team.", 404);
  const [paid, added] = await Promise.all([
    db.teamExpense.count({ where: { team: TEAM, paidById: member.id, deletedAt: null } }),
    db.teamExpense.count({ where: { team: TEAM, addedById: member.id, deletedAt: null } }),
  ]);
  await db.teamMember.delete({ where: { id: member.id } });
  return NextResponse.json({ ok: true, removed: member.name, detached: { paid, added } });
}
