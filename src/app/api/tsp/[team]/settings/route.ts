import { NextResponse } from "next/server";
import { updateSettings } from "@/lib/lasd26/team";
import { bad, badJson, readJson, requireTspCaptain } from "@/lib/tsp/guard";
import { updateTeam, type TeamPatch } from "@/lib/tsp/team";
import { ROUTES } from "@/app/tsp/lalv/course";

/**
 * PATCH /api/tsp/[team]/settings — a captain's knobs, only the fields sent:
 *   name, route (which course), secrets (run the checkpoint course), shareVan (show our van to
 *   the other teams), startAt (ISO or null), planPaceSec (240–1200), and
 *   splitCount (how many ways the expenses divide; TeamSettings).
 */
export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: { team: string } }) {
  const gate = await requireTspCaptain(params.team);
  if (gate.res) return gate.res;
  const body = await readJson(req);
  if (!body) return badJson();
  const patch: TeamPatch = {};
  if (typeof body.name === "string") {
    const name = body.name.trim().replace(/\s+/g, " ").slice(0, 60);
    if (name.length < 2) return bad("Give the team a name.");
    patch.name = name;
  }
  if (typeof body.secrets === "boolean") patch.secrets = body.secrets;
  if (typeof body.shareVan === "boolean") patch.shareVan = body.shareVan;
  if (body.route !== undefined) {
    const route = ROUTES.find((r) => r.id === body.route);
    if (!route) return bad("Pick one of the routes.");
    patch.route = route.id;
  }
  if (body.startAt === null) patch.startAt = null;
  else if (typeof body.startAt === "string") {
    const t = Date.parse(body.startAt);
    if (!Number.isFinite(t)) return bad("That start time does not read as a date.");
    patch.startAt = new Date(t).toISOString();
  }
  if (body.planPaceSec !== undefined) {
    const n = Number(body.planPaceSec);
    if (!Number.isFinite(n) || n < 240 || n > 1200) return bad("The planned pace runs from 4:00 to 20:00 a mile.");
    patch.planPaceSec = Math.round(n);
  }
  let splitCount: number | undefined;
  if (body.splitCount !== undefined) {
    const n = Number(body.splitCount);
    if (!Number.isInteger(n) || n < 1 || n > 60) return bad("The split is a whole number from 1 to 60.");
    splitCount = n;
  }
  if (Object.keys(patch).length === 0 && splitCount === undefined) return bad("Nothing to change.");
  try {
    const team = Object.keys(patch).length ? await updateTeam(params.team, patch) : gate.viewer.team;
    const settings = splitCount !== undefined ? await updateSettings({ splitCount }, params.team) : null;
    return NextResponse.json({ ok: true, team, splitCount: settings?.splitCount ?? null });
  } catch (err) {
    console.error("tsp/settings PATCH failed", err);
    return bad("Could not save.", 500);
  }
}
