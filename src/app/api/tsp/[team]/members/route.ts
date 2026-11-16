import { NextResponse } from "next/server";
import { parseRole } from "@/lib/lasd26/team";
import { bad, badJson, readJson, requireTspCaptain } from "@/lib/tsp/guard";
import { addPlaceholder, parsePace, parseSquad } from "@/lib/tsp/team";

/**
 * POST /api/tsp/[team]/members — a captain puts a NAME on the roster before
 * the person has joined (owner, 2026-11-16: "Allow me to add runners to my
 * team and have people 'accept' to be a runner when they use the link").
 * Body: { name, role?: "runner" | "crew", paceSec?: number | null, squad? }.
 * The row has no account until someone claims the name from the invite link
 * (POST …/join with `claim`).
 */
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { team: string } }) {
  const gate = await requireTspCaptain(params.team);
  if (gate.res) return gate.res;
  const body = await readJson(req);
  if (!body) return badJson();
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ").slice(0, 80) : "";
  if (!name) return bad("Give the runner a name.");
  const role = body.role === undefined ? "runner" : parseRole(body.role);
  if (!role) return bad("Pick runner or crew.");
  const paceSec = body.paceSec === undefined ? null : parsePace(body.paceSec);
  if (paceSec === undefined) return bad("Write the pace as minutes:seconds a mile, between 4:00 and 25:00.");
  const squad = body.squad === undefined ? 0 : parseSquad(body.squad);
  if (squad === undefined) return bad("Pick a shift from the list.");
  try {
    const m = await addPlaceholder(gate.viewer.team.slug, { name, role, paceSec, squad });
    return NextResponse.json({ ok: true, member: { id: m.id, name: m.name, role: m.role, paceSec: m.paceSec, squad: m.squad, placeholder: true } });
  } catch (err) {
    console.error("tsp/members: add failed", err);
    return bad("Could not add them right now — try again in a minute.", 500);
  }
}
