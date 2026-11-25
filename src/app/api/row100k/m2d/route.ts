import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { resolveViewer } from "@/lib/row100kViewer";
import { readM2dBody, saveM2d } from "@/app/row100k/m2d";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* M2D ON THE SITE (owner, 2026-11-25: "I need this sign up page ... on the
 * Rowtember website as well ... because the app still isn't live yet"):
 * the /m2d page's one call. The app's twin is api/row100k/app/m2d; both
 * save through saveM2d (row100k/m2d.ts), which emails the owner on every
 * save.
 *
 * POST { in, choice? }: a signed-in rower on the roster says they are
 * registered for the Concept2 Holiday Challenge, or takes it back, and
 * picks the charity ROWTEMBER's match goes to (row100k/m2d.ts CHARITIES). */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const viewer = await resolveViewer();
  if (!viewer.actor) return bad("Sign in first.", 401);
  if (!viewer.me) return bad("Join Rowtember first.", 403);
  const body = readM2dBody(await req.json().catch(() => null));
  if (typeof body === "string") return bad(body);
  const limit = await rateLimit({ key: `row100k-m2d:${viewer.me.id}`, limit: 30, windowSec: 3600 });
  if (!limit.ok) return bad("Too many tries at once. Try again in a bit.", 429);
  try {
    await saveM2d(viewer.me, body.in, body.choice, viewer.actor.email, "rowtember.com");
  } catch (err) {
    console.error("row100k M2D: not saved", err);
    return bad("Could not take that. Try again.", 503);
  }
  return NextResponse.json({ ok: true, in: body.in, choice: body.choice ?? null });
}
