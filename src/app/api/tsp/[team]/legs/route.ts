import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bad, badJson, readJson, requireTsp, requireTspWrite } from "@/lib/tsp/guard";
import { checkLegs, sortLegs, type Leg } from "@/lib/tsp/legs";

/**
 * /api/tsp/[team]/legs — who runs what (lib/tsp/legs.ts).
 *   GET → { legs } for the team, in course order.
 *   PUT { legs: [{ startCm, endCm, memberId | null }] } → the WHOLE plan,
 *       replaced in one transaction. ANY member may save it, not only a
 *       captain: the plan changes in the van at 3 AM (owner, 2026-11-16:
 *       "we're gonna have to call an audible"). The rules (no overlaps,
 *       inside the course, a real member of this team) answer 400.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function read(team: string): Promise<Leg[]> {
  const rows = await db.teamLeg.findMany({ where: { team }, orderBy: { startCm: "asc" }, select: { startCm: true, endCm: true, memberId: true } });
  return rows;
}

export async function GET(_req: Request, { params }: { params: { team: string } }) {
  const gate = await requireTsp(params.team);
  if (gate.res) return gate.res;
  return NextResponse.json({ ok: true, legs: await read(params.team) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: Request, { params }: { params: { team: string } }) {
  const gate = await requireTspWrite(params.team, "legs");
  if (gate.res) return gate.res;
  const body = await readJson(req);
  if (!body || !Array.isArray(body.legs)) return badJson();
  const legs: Leg[] = [];
  for (const raw of body.legs as unknown[]) {
    const r = raw as { startCm?: unknown; endCm?: unknown; memberId?: unknown };
    if (!r || typeof r.startCm !== "number" || typeof r.endCm !== "number") return bad("A leg needs a start and an end.");
    legs.push({ startCm: r.startCm, endCm: r.endCm, memberId: typeof r.memberId === "string" && r.memberId ? r.memberId : null });
  }
  const problem = checkLegs(legs);
  if (problem) return bad(problem);
  const ids = Array.from(new Set(legs.map((l) => l.memberId).filter((x): x is string => x !== null)));
  if (ids.length) {
    const known = await db.teamMember.findMany({ where: { team: params.team, id: { in: ids } }, select: { id: true } });
    if (known.length !== ids.length) return bad("A leg names someone who is not on the team any more — refresh and try again.");
  }
  const sorted = sortLegs(legs);
  await db.$transaction([db.teamLeg.deleteMany({ where: { team: params.team } }), db.teamLeg.createMany({ data: sorted.map((l) => ({ team: params.team, ...l })) })]);
  return NextResponse.json({ ok: true, legs: sorted });
}
