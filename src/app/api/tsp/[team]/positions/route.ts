import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bad, badJson, readJson, requireTsp, requireTspWrite } from "@/lib/tsp/guard";
import { checkIn, otherVans, parseKind, teamPositions } from "@/lib/tsp/positions";

/**
 * /api/tsp/[team]/positions — where everyone is (lib/tsp/positions.ts).
 *   GET  → { positions, others, legs, team: { startAt, planPaceSec } }: the
 *          team's dots, the vans other teams chose to show, and the plan,
 *          in one poll (the route page asks every 20 s).
 *   POST { lat, lon, accuracyM?, kind: "runner" | "van" | "crew" | "off" }
 *          → a check-in from this phone. "off" needs no position: it is the
 *          row that hides the dot. A member row is required — the platform
 *          owner looking in on someone else's team has no dot to place.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { team: string } }) {
  const gate = await requireTsp(params.team);
  if (gate.res) return gate.res;
  try {
    const [positions, others, legs] = await Promise.all([
      teamPositions(params.team),
      otherVans(params.team),
      db.teamLeg.findMany({ where: { team: params.team }, orderBy: { startCm: "asc" }, select: { startCm: true, endCm: true, memberId: true } }),
    ]);
    const t = gate.viewer.team;
    return NextResponse.json({ ok: true, positions, others, legs, team: { startAt: t.startAt, planPaceSec: t.planPaceSec, shareVan: t.shareVan } }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("tsp/positions GET failed", err);
    return bad("Could not read the positions.", 500);
  }
}

export async function POST(req: Request, { params }: { params: { team: string } }) {
  const gate = await requireTspWrite(params.team, "position");
  if (gate.res) return gate.res;
  const member = gate.viewer.member;
  if (!member) return bad("Join the team through the invite link to share a location.", 403);
  const body = await readJson(req);
  if (!body) return badJson();
  const kind = parseKind(body.kind);
  if (!kind) return bad("Say what you are: runner, van or crew.");
  const lat = Number(body.lat);
  const lon = Number(body.lon);
  if (kind !== "off" && (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)) return bad("That is not a position.");
  const acc = Number(body.accuracyM);
  try {
    // The baton is one person: whoever says RUNNER takes it from whoever had it.
    if (kind === "runner") {
      for (const h of await teamPositions(params.team)) {
        if (h.kind === "runner" && h.memberId !== member.id) await checkIn({ team: params.team, memberId: h.memberId, name: h.name, kind: "crew", lat: h.lat, lon: h.lon, accuracyM: h.accuracyM });
      }
    }
    await checkIn({ team: params.team, memberId: member.id, name: member.name, kind, lat: kind === "off" && !Number.isFinite(lat) ? 0 : lat, lon: kind === "off" && !Number.isFinite(lon) ? 0 : lon, accuracyM: Number.isFinite(acc) ? Math.max(0, Math.min(100000, Math.round(acc))) : 0 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("tsp/positions POST failed", err);
    return bad("Could not save the position.", 500);
  }
}
