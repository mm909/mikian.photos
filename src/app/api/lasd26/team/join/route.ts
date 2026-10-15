import { NextResponse } from "next/server";
import { joinTeam, parseRole } from "@/lib/lasd26/team";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";

/**
 * POST /api/lasd26/team/join — the JOIN button on /lasd26/join.
 * Body: { token, role: "runner" | "crew", name? }. Signed in required (the
 * membership is keyed by the Google account); the token must name a live
 * invite or joinTeam answers 403. Joining twice just updates name + role,
 * which is how "change role" works too.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  const actor = await getEffectiveActor();
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Sign in with Google first." }, { status: 401 });
  }

  let body: { token?: unknown; role?: unknown; name?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "That invite link is not valid — ask for a fresh one." }, { status: 400 });
  }
  const role = parseRole(body.role);
  if (!role) {
    return NextResponse.json({ ok: false, error: "Pick runner or crew." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : undefined;

  // A signed-in account that hammers this is guessing tokens; 10/hour is
  // plenty for a human who changes their mind about runner vs crew.
  const limit = await rateLimit({ key: `lasd26-team-join:${actor.photographerId}`, limit: 10, windowSec: 3600 });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many tries — give it a bit." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
    );
  }

  try {
    const r = await joinTeam({ actor, token, role, name });
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
    return NextResponse.json({
      ok: true,
      created: r.created,
      member: { id: r.member.id, name: r.member.name, role: r.member.role },
    });
  } catch (err) {
    console.error("lasd26/team/join failed", err);
    return NextResponse.json({ ok: false, error: "Could not join right now — try again in a minute." }, { status: 500 });
  }
}
