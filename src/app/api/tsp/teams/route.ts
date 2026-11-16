import { NextResponse } from "next/server";
import { sendOwnerNotification } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";
import { bad, badJson, readJson } from "@/lib/tsp/guard";
import { teamPath } from "@/lib/tsp/paths";
import { createTeam, tspActor, tspGateOpen } from "@/lib/tsp/team";

/**
 * POST /api/tsp/teams — MAKE A TEAM (owner, 2026-11-16: "someone make the
 * team and then getting a link to join the team"). Body: { name, secrets?,
 * yourName? }. Signed in required; the maker becomes the first captain and
 * the first invite link is made on the way. Every new team emails the owner
 * (CLAUDE.md, "Every sign-up emails the owner").
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  const actor = await tspActor();
  if (!tspGateOpen(actor)) return bad("Not found.", 404);
  if (!actor) return bad("Sign in with Google first.", 401);
  const body = await readJson(req);
  if (!body) return badJson();
  const limit = await rateLimit({ key: `tsp-team-create:${actor.photographerId}`, limit: 5, windowSec: 3600 });
  if (!limit.ok) return bad("That is a lot of teams — give it a bit.", 429);
  try {
    const made = await createTeam({
      actor,
      name: typeof body.name === "string" ? body.name : "",
      secrets: body.secrets === true,
      yourName: typeof body.yourName === "string" ? body.yourName : undefined,
    });
    if (!made.ok) return bad(made.error, made.status);
    try {
      const sent = await sendOwnerNotification(
        `TSP: new team "${made.team.name}"`,
        `${actor.name} <${actor.email}> made the TSP LA → Las Vegas team "${made.team.name}"${made.team.secrets ? " (secrets)" : ""}.\n${teamPath(made.team.slug, "/team")}`,
        actor.email,
      );
      if (!sent.ok) console.error("tsp/teams: owner email failed", sent.error);
    } catch (err) {
      console.error("tsp/teams: owner email threw", err);
    }
    return NextResponse.json({ ok: true, slug: made.team.slug }, { status: 201 });
  } catch (err) {
    console.error("tsp/teams POST failed", err);
    return bad("Could not make the team right now — try again in a minute.", 500);
  }
}
