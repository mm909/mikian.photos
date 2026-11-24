import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CHALLENGE, nowMs, pacificDay, validateEntry } from "@/lib/row100k";
import { rateLimit } from "@/lib/rateLimit";
import { columnsFrom, validateTelemetryDoc, type TelemetryDoc } from "@/lib/pm5/session";
import { ErgStoreError, insertErgSession } from "@/lib/pm5/store";
import { ergAppDenial, ergViewer, type ErgViewer } from "@/app/erg/gate";
import { saveRow } from "@/app/row100k/logEntry";

/* THE PIECE BEHIND A LOGGED ROW (2026-11-20). The phone app logs a row
 * through /api/row100k/rows like everybody else, then, when the row came
 * off a connected erg, posts the whole recording here with the row's id:
 * { doc, entryId }. The piece is saved as an erg session of the account
 * (the same table and validation as /api/erg/sessions) and tied to that
 * row, which is how the feed and the profile know a row has the monitor's
 * figures behind it.
 *
 * AND THE ROW ITSELF, WITH NO PHOTOS (owner, 2026-11-23: "Strava does this
 * thing where it's like it automatically logs the row and then lets you add
 * the photos ... the intention is that every row gets logged"; 2026-11-24,
 * asked whether to build it: "Yes, build every single thing you need").
 * { doc, log: {} } and no entryId: the row is made HERE, out of the
 * recording, the moment the piece ends on the phone, and the recording is
 * tied to it in the same breath. The two photos are added afterwards
 * through the row's own edit (api/row100k/rows/[id]); a row logged by hand
 * still needs its two (api/row100k/rows).
 *
 *   WHAT THE ROW IS comes off the recording and nothing else: its meters,
 *     its time, and the Pacific day it finished on. The phone names none of
 *     them, so a row cannot come in here saying more than its recording.
 *   THE SAME RULES as any row: validateEntry, then app/row100k/logEntry.ts
 *     (the caps, the title, the note to the owner, the word to followers).
 *   NEVER A DEMO: a recording the simulator made is refused.
 *   ONCE: a phone that lost the answer asks again, and the recording it
 *     sends starts at the same instant as the one already tied to a row, so
 *     it is told of that row and no second one is made. If the rower has
 *     deleted that row since, it stays deleted (410).
 *
 * Open to any signed-in account (app/erg/gate.ts ergAppDenial). The row
 * must be the caller's own. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const viewer = await ergViewer();
  const denied = ergAppDenial(viewer);
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
    if (!entryId && body.log && typeof body.log === "object") return await logOffTheMonitor(viewer, userId, doc);
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

/* Under this many strokes a recording is a few pulls, not a row to log by
 * itself (the phone makes no document under it either). */
const LOG_MIN_STROKES = 8;

async function logOffTheMonitor(viewer: ErgViewer, userId: string, doc: TelemetryDoc): Promise<NextResponse> {
  if (doc.device.simulated) return no("A demo row is not logged.", 400);
  const cols = columnsFrom(doc);
  if (cols.strokes < LOG_MIN_STROKES) return no("That recording is too short to log by itself.", 400);

  const participant = await db.rowParticipant.findUnique({ where: { challenge_userId: { challenge: CHALLENGE, userId } } });
  if (!participant) return no("Join the challenge first — it takes 30 seconds.", 400);

  /* ASKED BEFORE? The same piece off the same account starts at the same
   * instant. */
  const had = await db.rowTelemetry.findFirst({ where: { userId, startedAt: cols.startedAt, simulated: false, entryId: { not: null } }, select: { id: true, entryId: true } });
  if (had?.entryId) {
    const e = await db.rowEntry.findFirst({ where: { id: had.entryId, participantId: participant.id }, select: { id: true, day: true, meters: true, seconds: true, title: true } });
    if (!e) return no("That row was logged and then deleted.", 410);
    return NextResponse.json({ ok: true, id: had.id, entryId: e.id, day: e.day, meters: e.meters, seconds: e.seconds, title: e.title, recorded: true, again: true });
  }

  /* The day it finished, Pacific, as the boards count days. A phone whose
   * clock runs ahead cannot date a row into tomorrow; and the clock the
   * rest of the site is on (lib/row100k nowMs: shifted in the demo copy,
   * not at all on the live site) is the one the day is read against. */
  const end = Math.min(cols.startedAt.getTime() + cols.tenths * 100, Date.now());
  const day = pacificDay(end + (nowMs() - Date.now()));
  const check = validateEntry({ day, meters: Math.floor(cols.meters), seconds: Math.max(1, Math.round(cols.tenths / 10)), title: "" }, nowMs(), { admin: viewer.isAdmin });
  if (!check.ok) return no(check.error, 400);

  const saved = await saveRow(participant, check.value, []);
  if (!saved.ok) return no(saved.error, saved.status);

  /* The recording, tied to the row. The row is logged whether or not this
   * lands: the phone keeps its own copy of the recording and is told. */
  let recId: string | null = null;
  try {
    const rec = await insertErgSession({ userId, doc, title: saved.title, rower: { participantId: participant.id, rowerNumber: participant.rowerNumber, challenge: CHALLENGE } });
    await db.rowTelemetry.update({ where: { id: rec.id }, data: { entryId: saved.id } });
    recId = rec.id;
  } catch (err) {
    console.error("row app: a monitor row was logged and its recording could not be saved", err);
  }
  return NextResponse.json({ ok: true, id: recId, entryId: saved.id, day: check.value.day, meters: check.value.meters, seconds: check.value.seconds, title: saved.title, recorded: recId !== null });
}

/* ONE SAVED SESSION, by its own id (2026-11-22; owner: "I should be able to
 * click on these ... and see the stat page", of erg pieces on a profile
 * that were saved before the app tied a session to a row). GET ?id=. The
 * rower's own, or anybody's for an admin; the same gate as saving one. */
export async function GET(req: Request) {
  const viewer = await ergViewer();
  const denied = ergAppDenial(viewer);
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
