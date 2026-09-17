import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { deleteErgSession, getErgSession } from "@/lib/pm5/store";
import { ergApiDenial, ergViewer } from "@/app/erg/gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ONE SAVED ERG SESSION (owner, 2026-09-17).
 *
 * GET    /api/erg/sessions/[id]  -> { ok, row, doc }   own row, or admin
 * DELETE /api/erg/sessions/[id]  -> { ok }             own row, or admin
 *
 * A row outside the viewer scope is 404, never 403: the id says nothing
 * about whose it is. 401 signed out, 403 shut, 429 the limit, 503 the
 * database. The GET is what the post-hoc screen and a playback read. */

const NO_STORE = { "Cache-Control": "no-store" };

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });

function failed(err: unknown, what: string) {
  console.error(`erg sessions: ${what} failed`, err);
  return bad("Couldn't reach the database — try again.", 503);
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const v = await ergViewer();
  const denied = ergApiDenial(v);
  if (denied) return bad(denied.error, denied.status);
  const id = ctx.params.id;
  if (!id) return bad("Which session?");
  try {
    const found = await getErgSession({ userId: v.userId as string, isAdmin: v.isAdmin, id });
    if (!found) return bad("No such session.", 404);
    return NextResponse.json({ ok: true, row: found.row, doc: found.doc }, { headers: NO_STORE });
  } catch (err) {
    return failed(err, "fetch");
  }
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const v = await ergViewer();
  const denied = ergApiDenial(v);
  if (denied) return bad(denied.error, denied.status);
  const userId = v.userId as string;

  const limit = await rateLimit({ key: `erg-session-del:${userId}`, limit: 60, windowSec: 3600 });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many deletes at once — try again in a bit." },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
    );
  }

  const id = ctx.params.id;
  if (!id) return bad("Which session?");
  try {
    const gone = await deleteErgSession({ userId, isAdmin: v.isAdmin, id });
    if (!gone) return bad("No such session.", 404);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    return failed(err, "delete");
  }
}
