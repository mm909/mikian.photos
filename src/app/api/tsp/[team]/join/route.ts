import { NextResponse } from "next/server";
import { sendOwnerNotification } from "@/lib/email";
import { joinTeam, parseRole } from "@/lib/lasd26/team";
import { rateLimit } from "@/lib/rateLimit";
import { bad, badJson, readJson } from "@/lib/tsp/guard";
import { claimPlaceholder, getTeam, tspActor, tspGateOpen } from "@/lib/tsp/team";

/**
 * POST /api/tsp/[team]/join — the JOIN button behind a captain's invite
 * link. Body: { token, role: "runner" | "crew", name? }. Signed in; the
 * token must name a live invite OF THIS TEAM. Joining twice updates name and
 * role (and never touches the captain flag). Every join emails the owner.
 *
 * With `claim: <memberId>` (owner, 2026-11-16: "pick one of the already
 * given names or just sign in as usual") the account takes over a name a
 * captain put on the roster: that row's role, pace, shift and legs stay, so
 * `role` is not needed; `name` only if they want it spelled differently.
 */
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { team: string } }) {
  const actor = await tspActor();
  if (!tspGateOpen(actor)) return bad("Not found.", 404);
  if (!actor) return bad("Sign in with Google first.", 401);
  const team = await getTeam(params.team);
  if (!team) return bad("No such team.", 404);
  const body = await readJson(req);
  if (!body) return badJson();
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) return bad("That invite link is not valid — ask your captain for a fresh one.");
  const claim = typeof body.claim === "string" ? body.claim.trim() : "";
  const role = parseRole(body.role);
  if (!claim && !role) return bad("Pick runner or crew.");
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : undefined;
  const limit = await rateLimit({ key: `tsp-team-join:${actor.photographerId}`, limit: 10, windowSec: 3600 });
  if (!limit.ok) return bad("Too many tries — give it a bit.", 429);
  if (claim) {
    try {
      const r = await claimPlaceholder({ actor, slug: team.slug, token, memberId: claim, name });
      if (!r.ok) return bad(r.error, r.status);
      try {
        const sent = await sendOwnerNotification(
          `TSP ${team.name}: ${r.member.name} joined (${r.member.role})`,
          `${actor.name} <${actor.email}> joined the TSP team "${team.name}" as ${r.member.role}, taking the name "${r.member.name}" their captain had put on the roster.`,
          actor.email,
        );
        if (!sent.ok) console.error("tsp/join: owner email failed", sent.error);
      } catch (err) {
        console.error("tsp/join: owner email threw", err);
      }
      return NextResponse.json({ ok: true, created: true, claimed: true, member: { id: r.member.id, name: r.member.name, role: r.member.role } });
    } catch (err) {
      console.error("tsp/join: claim failed", err);
      return bad("Could not join right now — try again in a minute.", 500);
    }
  }
  if (!role) return bad("Pick runner or crew.");
  try {
    const r = await joinTeam({ actor, token, role, name, team: team.slug });
    if (!r.ok) return bad(r.error, r.status);
    try {
      const sent = await sendOwnerNotification(
        `TSP ${team.name}: ${r.member.name} ${r.created ? "joined" : "updated"} (${r.member.role})`,
        `${r.member.name} <${actor.email}> ${r.created ? "joined" : "updated their place on"} the TSP team "${team.name}" as ${r.member.role}.`,
        actor.email,
      );
      if (!sent.ok) console.error("tsp/join: owner email failed", sent.error);
    } catch (err) {
      console.error("tsp/join: owner email threw", err);
    }
    return NextResponse.json({ ok: true, created: r.created, member: { id: r.member.id, name: r.member.name, role: r.member.role } });
  } catch (err) {
    console.error("tsp/join failed", err);
    return bad("Could not join right now — try again in a minute.", 500);
  }
}
