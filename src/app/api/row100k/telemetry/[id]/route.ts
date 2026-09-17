import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { CHALLENGE } from "@/lib/row100k";
import { resolveViewer } from "@/lib/row100kViewer";
import { deleteTelemetry, getTelemetry } from "@/app/row100k/pm5/telemetry/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ONE SAVED SESSION (owner, 2026-09-17: the option to save the live
 * telemetry of a row).
 *
 * GET    /api/row100k/telemetry/[id]  -> { ok, row, doc }  own row, or admin
 * DELETE /api/row100k/telemetry/[id]  -> { ok }            own row, or admin
 *
 * A row outside the viewer's scope is 404, never 403: the id says nothing
 * about whose it is. 401 signed out, 403 not joined and not an admin, 429
 * the limit, 503 the database. */

const NO_STORE = { "Cache-Control": "no-store" };

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });

/* The scope: null for an admin (any row), the viewer's own id otherwise. */
type Scoped = { participantId: string | null; key: string } | { res: NextResponse };

async function scope(): Promise<Scoped> {
  const viewer = await resolveViewer();
  if (!viewer.actor) return { res: bad("Sign in with Google first.", 401) };
  if (viewer.isAdmin) return { participantId: null, key: viewer.actor.photographerId };
  /* Admin-only in production, the same door the console wears (review,
   * 2026-09-17); open in local dev, where the page is. */
  if (process.env.NODE_ENV === "production") return { res: bad("Not allowed.", 403) };
  if (!viewer.myParticipantId) return { res: bad("Opt in to Rowtember first.", 403) };
  return { participantId: viewer.myParticipantId, key: viewer.myParticipantId };
}

function failed(err: unknown, what: string) {
  console.error(`row100k telemetry: ${what} failed`, err);
  return bad("Couldn't reach the database — try again.", 503);
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const s = await scope();
  if ("res" in s) return s.res;
  const id = ctx.params.id;
  if (!id) return bad("Which session?");
  try {
    const found = await getTelemetry({ challenge: CHALLENGE, id, participantId: s.participantId });
    if (!found) return bad("No such session.", 404);
    return NextResponse.json({ ok: true, row: found.row, doc: found.doc }, { headers: NO_STORE });
  } catch (err) {
    return failed(err, "fetch");
  }
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const s = await scope();
  if ("res" in s) return s.res;
  const limit = await rateLimit({ key: `row100k-telemetry-del:${s.key}`, limit: 60, windowSec: 3600 });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many deletes at once — try again in a bit." },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
    );
  }
  const id = ctx.params.id;
  if (!id) return bad("Which session?");
  try {
    const gone = await deleteTelemetry({ challenge: CHALLENGE, id, participantId: s.participantId });
    if (!gone) return bad("No such session.", 404);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    return failed(err, "delete");
  }
}
