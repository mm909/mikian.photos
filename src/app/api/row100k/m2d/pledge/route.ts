import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { resolveViewer } from "@/lib/row100kViewer";
import { m2dWindow } from "@/app/row100k/m2d";
import { pledgeGated, readPledgeBody } from "@/app/row100k/m2dPledges";
import { pledgeViews, savePledge } from "@/app/row100k/m2dPledgeActions";

/* A GIVER'S M2D PLEDGE (owner, 2026-11-26; row100k/m2dPledges.ts), the
 * /m2d/pledge page's one call. A Google account is required ("let's make
 * sure they created an account"); a rower number is not.
 *
 *   GET                              the signed-in giver's pledges.
 *   POST { cents, cap, name, note? } a pledge, saved pending; a pending
 *                                    one of theirs is changed instead.
 *                                    Emails the owner every time.
 *
 * IN DEVELOPMENT (CLAUDE.md): admin-only in production, like its page,
 * until the owner says it goes live. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });

export async function GET() {
  const viewer = await resolveViewer();
  if (pledgeGated(viewer.isAdmin)) return bad("Not here.", 404);
  if (!viewer.actor) return bad("Sign in first.", 401);
  try {
    return NextResponse.json({ ok: true, pledges: await pledgeViews(viewer.actor.photographerId) }, { headers: NO_STORE });
  } catch (err) {
    console.error("M2D pledge: not read", err);
    return bad("Your pledges could not be read.", 503);
  }
}

export async function POST(req: Request) {
  const viewer = await resolveViewer();
  if (pledgeGated(viewer.isAdmin)) return bad("Not here.", 404);
  if (!viewer.actor) return bad("Sign in first.", 401);
  if (m2dWindow().over) return bad("M2D closed on Dec 24.");
  const body = readPledgeBody(await req.json().catch(() => null));
  if (typeof body === "string") return bad(body);
  const limit = await rateLimit({ key: `row100k-m2d-pledge:${viewer.actor.photographerId}`, limit: 10, windowSec: 3600 });
  if (!limit.ok) return bad("Too many tries at once. Try again in a bit.", 429);
  try {
    await savePledge(viewer.actor, body);
    return NextResponse.json({ ok: true, pledges: await pledgeViews(viewer.actor.photographerId) }, { headers: NO_STORE });
  } catch (err) {
    console.error("M2D pledge: not saved", err);
    return bad("Your pledge did not save. Try again.", 503);
  }
}
