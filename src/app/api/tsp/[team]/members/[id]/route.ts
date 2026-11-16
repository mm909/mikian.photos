import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseRole } from "@/lib/lasd26/team";
import { bad, badJson, readJson, requireTspWrite } from "@/lib/tsp/guard";
import { parsePace, parseSquad } from "@/lib/tsp/team";

/**
 * /api/tsp/[team]/members/[id] — a captain's hand on the roster.
 *   PATCH  { captain?: boolean, role?: "runner" | "crew", name?, paceSec?:
 *          number | null, squad?: number } — make or unmake a captain
 *          (owner, 2026-11-16: "multiple team captains"), fix a role or a
 *          name, set the target pace (owner: "8 runners and target paces")
 *          or the shift. The LAST captain cannot be unmade. Captains change
 *          anyone; a member may set their OWN pace and nothing else.
 *   DELETE — take someone off the team (a name nobody claimed included).
 *          Their expenses stay on the sheet (the payer goes blank), their
 *          legs go back to nobody. The last captain cannot be removed.
 */
export const runtime = "nodejs";

async function lastCaptain(team: string, id: string): Promise<boolean> {
  const others = await db.teamMember.count({ where: { team, captain: true, NOT: { id } } });
  return others === 0;
}

export async function PATCH(req: Request, { params }: { params: { team: string; id: string } }) {
  const gate = await requireTspWrite(params.team, "team");
  if (gate.res) return gate.res;
  const body = await readJson(req);
  if (!body) return badJson();
  const member = await db.teamMember.findFirst({ where: { id: params.id, team: params.team }, select: { id: true, captain: true, placeholder: true } });
  if (!member) return bad("No such member.", 404);
  if (!gate.viewer.captain) {
    const own = gate.viewer.member?.id === member.id;
    const onlyPace = Object.keys(body).every((k) => k === "paceSec");
    if (!own || !onlyPace) return bad("Only a team captain can do that.", 403);
  }
  const data: { captain?: boolean; role?: string; name?: string; paceSec?: number | null; squad?: number } = {};
  if (body.paceSec !== undefined) {
    const pace = parsePace(body.paceSec);
    if (pace === undefined) return bad("Write the pace as minutes:seconds a mile, between 4:00 and 25:00.");
    data.paceSec = pace;
  }
  if (body.squad !== undefined) {
    const squad = parseSquad(body.squad);
    if (squad === undefined) return bad("Pick a shift from the list.");
    data.squad = squad;
  }
  if (typeof body.captain === "boolean") {
    if (body.captain && member.placeholder) return bad("They need to join before they can be a captain.");
    if (!body.captain && member.captain && (await lastCaptain(params.team, member.id))) return bad("A team needs a captain — make someone else one first.");
    data.captain = body.captain;
  }
  if (body.role !== undefined) {
    const role = parseRole(body.role);
    if (!role) return bad("Pick runner or crew.");
    data.role = role;
  }
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().replace(/\s+/g, " ").slice(0, 80);
  if (Object.keys(data).length === 0) return bad("Nothing to change.");
  await db.teamMember.update({ where: { id: member.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { team: string; id: string } }) {
  const gate = await requireTspWrite(params.team, "team");
  if (gate.res) return gate.res;
  if (!gate.viewer.captain) return bad("Only a team captain can do that.", 403);
  const member = await db.teamMember.findFirst({ where: { id: params.id, team: params.team }, select: { id: true, captain: true } });
  if (!member) return bad("No such member.", 404);
  if (member.captain && (await lastCaptain(params.team, member.id))) return bad("A team needs a captain — make someone else one first.");
  await db.$transaction([
    db.teamLeg.updateMany({ where: { team: params.team, memberId: member.id }, data: { memberId: null } }),
    db.teamMember.delete({ where: { id: member.id } }),
  ]);
  return NextResponse.json({ ok: true });
}
