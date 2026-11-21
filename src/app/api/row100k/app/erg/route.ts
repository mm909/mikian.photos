import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CHALLENGE } from "@/lib/row100k";
import { rateLimit } from "@/lib/rateLimit";
import { validateTelemetryDoc } from "@/lib/pm5/session";
import { ErgStoreError, insertErgSession } from "@/lib/pm5/store";
import { ergApiDenial, ergViewer } from "@/app/erg/gate";

/* THE PIECE BEHIND A LOGGED ROW (2026-11-20). The phone app logs a row
 * through /api/row100k/rows like everybody else, then, when the row came
 * off a connected erg, posts the whole recording here with the row's id:
 * { doc, entryId }. The piece is saved as an erg session of the account
 * (the same table and validation as /api/erg/sessions) and tied to that
 * row, which is how the feed and the profile know a row has the monitor's
 * figures behind it.
 *
 * Wears the erg gate (app/erg/gate.ts): the erg product is in development,
 * so in production this answers admins only, as /api/erg/sessions does. The
 * row must be the caller's own. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const viewer = await ergViewer();
  const denied = ergApiDenial(viewer);
  if (denied) return no(denied.error, denied.status);
  const userId = viewer.userId as string;

  const rl = await rateLimit({ key: `row-app-erg:${userId}`, limit: 30, windowSec: 3600 });
  if (!rl.ok) return no("Too many saves. Try again later.", 429);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return no("invalid JSON body", 400);
  }
  const entryId = typeof body.entryId === "string" ? body.entryId : "";

  try {
    const doc = validateTelemetryDoc(body.doc);
    if (typeof doc === "string") return no(doc, 400);
    const entry = entryId
      ? await db.rowEntry.findFirst({
          where: { id: entryId, challenge: CHALLENGE, participant: { userId } },
          select: { id: true, title: true, participant: { select: { id: true, rowerNumber: true } } },
        })
      : null;
    if (!entry) return no("That row is not yours.", 404);
    const saved = await insertErgSession({
      userId,
      doc,
      title: entry.title,
      rower: { participantId: entry.participant.id, rowerNumber: entry.participant.rowerNumber, challenge: CHALLENGE },
    });
    await db.rowTelemetry.update({ where: { id: saved.id }, data: { entryId: entry.id } });
    return NextResponse.json({ ok: true, id: saved.id });
  } catch (err) {
    if (err instanceof ErgStoreError) return no(err.message, err.status);
    console.error("row app: failed to save the piece behind a row", err);
    return no("The recording could not be saved just now.", 500);
  }
}

/* ONE SAVED SESSION, by its own id (2026-11-22; owner: "I should be able to
 * click on these ... and see the stat page", of erg pieces on a profile
 * that were saved before the app tied a session to a row). GET ?id=. The
 * rower's own, or anybody's for an admin; the same gate as saving one. */
export async function GET(req: Request) {
  const viewer = await ergViewer();
  const denied = ergApiDenial(viewer);
  if (denied) return no(denied.error, denied.status);
  try {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!/^[a-z0-9]{1,40}$/i.test(id)) return no("No such session.", 404);
    const t = await db.rowTelemetry.findFirst({ where: { id }, select: { id: true, userId: true, startedAt: true, meters: true, entryId: true, data: true } });
    if (!t || (!viewer.isAdmin && t.userId !== viewer.userId)) return no("No such session.", 404);
    const doc = validateTelemetryDoc(t.data);
    if (typeof doc === "string") return no("That recording could not be read.", 500);
    const day = new Date(t.startedAt.getTime() - 7 * 3600_000).toISOString().slice(0, 10);
    return NextResponse.json({ ok: true, session: { id: t.id, day, meters: t.meters, entryId: t.entryId, doc } }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("row app: failed to read a saved session", err);
    return no("That session could not be read just now.", 500);
  }
}
