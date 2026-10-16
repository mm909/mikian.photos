import { NextResponse } from "next/server";
import { currentInvite, inviteUrl, rotateInvite } from "@/lib/lasd26/team";
import { getEffectiveActor, isOwner } from "@/lib/permissions";
import { originFrom } from "@/app/lasd26/team/fmt";

/**
 * /api/lasd26/team/invite — the owner's link.
 *   GET  → the live invite (token, uses, createdAt) and its full URL, or
 *          invite: null when none has been made.
 *   POST → rotate: a new token; every older link stops working at once
 *          (owner's only revocation). Returns the new invite + URL.
 * Owner only, both verbs: the token IS the key to the team pages.
 */
export const runtime = "nodejs";

async function ownerOr403() {
  const actor = await getEffectiveActor();
  if (!actor) return { actor: null, res: NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 }) };
  if (!isOwner(actor)) return { actor: null, res: NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 }) };
  return { actor, res: null };
}

export async function GET(req: Request) {
  const gate = await ownerOr403();
  if (gate.res) return gate.res;
  try {
    const invite = await currentInvite();
    const origin = originFrom((k) => req.headers.get(k));
    return NextResponse.json({
      ok: true,
      invite: invite ? { token: invite.token, uses: invite.uses, createdAt: invite.createdAt.toISOString() } : null,
      url: invite ? inviteUrl(origin, invite.token) : null,
    });
  } catch (err) {
    console.error("lasd26/team/invite GET failed", err);
    return NextResponse.json({ ok: false, error: "Could not read the invite." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await ownerOr403();
  if (gate.res || !gate.actor) return gate.res;
  try {
    const made = await rotateInvite(gate.actor.photographerId);
    const origin = originFrom((k) => req.headers.get(k));
    return NextResponse.json({
      ok: true,
      invite: { token: made.token, uses: 0, createdAt: new Date().toISOString() },
      url: inviteUrl(origin, made.token),
    });
  } catch (err) {
    console.error("lasd26/team/invite POST failed", err);
    return NextResponse.json({ ok: false, error: "Could not make a link." }, { status: 500 });
  }
}
