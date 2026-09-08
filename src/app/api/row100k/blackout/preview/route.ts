import { NextResponse } from "next/server";
import { getEffectiveActor } from "@/lib/permissions";
import { isRow100kAdmin } from "@/lib/row100k";
import { BO_PREVIEW_COOKIE, parsePreview } from "@/lib/row100kViewer";

export const runtime = "nodejs";

/* The admin's test blackout, on and off (owner, 2026-09-06). Sets the one
 * cookie row100kViewer reads — "elite" to see the site as one OF the
 * elite, "public" to see it as everybody else, null to stop.
 *
 * Admin only, like every other verb on the blackout route. The cookie can
 * only make a page hide MORE than it would, so a stray value is harmless,
 * but it is a debugging lever and it belongs to the owner: resolveViewer
 * refuses to read it for anyone who is not a challenge admin, and this
 * route refuses to set it.
 *
 * A session cookie on purpose — closing the browser ends the test, so a
 * forgotten switch cannot follow the owner into next week. */
export async function POST(req: Request) {
  const actor = await getEffectiveActor();
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Sign in with Google first." }, { status: 401 });
  }
  if (!isRow100kAdmin(actor.email, actor.roles)) {
    return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 });
  }

  let body: { mode?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Send JSON." }, { status: 400 });
  }

  const mode = parsePreview(body.mode);
  const res = NextResponse.json({ ok: true, mode });
  if (mode) {
    res.cookies.set({
      name: BO_PREVIEW_COOKIE,
      value: mode,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
  } else {
    res.cookies.set({ name: BO_PREVIEW_COOKIE, value: "", path: "/", maxAge: 0 });
  }
  return res;
}
