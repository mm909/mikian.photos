import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { CHALLENGE } from "@/lib/row100k";
import { resolveViewer, type Viewer } from "@/lib/row100kViewer";
import { CAPS, validateTelemetryDoc } from "@/app/row100k/pm5/telemetry/session";
import { TelemetryStoreError, insertTelemetry, listTelemetry } from "@/app/row100k/pm5/telemetry/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* SAVED TELEMETRY (owner, 2026-09-17: the option to save the live
 * telemetry of a row). The console posts the document session.ts built;
 * the list comes back for SAVED ROWS.
 *
 * POST { doc, title?, entryId? }  -> { ok, id, saved }   signed in AND
 *      joined; 30/h per participant; the doc validated with hard caps
 *      before anything touches the database.
 * GET  [?all=1]                   -> { ok, rows }   the viewer's own rows;
 *      all=1 for a challenge admin lists everyone's.
 *
 * Errors: 400 the doc or the body, 401 signed out, 403 not joined, 404 a
 * linked row that is not theirs, 413 a body past the cap, 429 the limit,
 * 503 the database — every one JSON with a printable line, never cached. */

const NO_STORE = { "Cache-Control": "no-store" };

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });

/* Shut to everyone but an admin in production; open in local dev, where the
 * console itself is. One rule, read by every verb here. */
const shut = (viewer: Viewer) => process.env.NODE_ENV === "production" && !viewer.isAdmin;

type Guarded = { viewer: Viewer; participantId: string; rowerNumber: number } | { res: NextResponse };

/* Signed in and joined, or the reason. resolveViewer never throws — a
 * database hiccup there reads as signed out, which is the safe side. */
async function guard(): Promise<Guarded> {
  const viewer = await resolveViewer();
  if (!viewer.actor) return { res: bad("Sign in with Google first.", 401) };
  /* THE SAME DOOR THE PAGE WEARS. The console is admin-only in production
   * (pm5/telemetry/page.tsx) and open in local dev, so the route that
   * writes for it is too — otherwise any signed-in account could post
   * megabytes into RowTelemetry against a page it cannot even open
   * (review, 2026-09-17). When the console opens to rowers, this goes with
   * it and a per-rower ceiling takes its place. */
  if (shut(viewer)) return { res: bad("Not allowed.", 403) };
  if (!viewer.myParticipantId || !viewer.me) return { res: bad("Opt in to Rowtember first.", 403) };
  return { viewer, participantId: viewer.myParticipantId, rowerNumber: viewer.me.rowerNumber };
}

function failed(err: unknown, what: string) {
  if (err instanceof TelemetryStoreError) return bad(err.message, err.status);
  console.error(`row100k telemetry: ${what} failed`, err);
  return bad("Couldn't reach the database — try again.", 503);
}

export async function GET(req: Request) {
  const viewer = await resolveViewer();
  if (!viewer.actor) return bad("Sign in with Google first.", 401);
  if (shut(viewer)) return bad("Not allowed.", 403);
  const all = new URL(req.url).searchParams.get("all") === "1" && viewer.isAdmin;
  if (!all && !viewer.myParticipantId) return bad("Opt in to Rowtember first.", 403);
  try {
    const rows = await listTelemetry({ challenge: CHALLENGE, participantId: all ? null : viewer.myParticipantId });
    return NextResponse.json({ ok: true, rows }, { headers: NO_STORE });
  } catch (err) {
    return failed(err, "list");
  }
}

export async function POST(req: Request) {
  const g = await guard();
  if ("res" in g) return g.res;

  const limit = await rateLimit({ key: `row100k-telemetry-save:${g.participantId}`, limit: 30, windowSec: 3600 });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many saves at once — try again in a bit." },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
    );
  }

  /* The body is read as text first so a runaway one is refused by length
   * before JSON.parse spends anything on it. */
  let text: string;
  try {
    text = await req.text();
  } catch {
    return bad("Send JSON.");
  }
  if (text.length > CAPS.jsonBytes + 4_096) return bad(`That session is over the ${CAPS.jsonBytes / 1_000_000} MB cap.`, 413);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return bad("Send JSON.");
  }
  if (typeof body !== "object" || body === null) return bad("Send JSON.");

  const doc = validateTelemetryDoc(body.doc);
  if (typeof doc === "string") return bad(`Can't save that session: ${doc}.`);
  if (!doc.strokes.length && !doc.samples.length) return bad("Nothing to save yet — row a stroke first.");

  try {
    const saved = await insertTelemetry({
      challenge: CHALLENGE,
      participantId: g.participantId,
      rowerNumber: g.rowerNumber,
      doc,
      title: body.title,
      entryId: body.entryId,
    });
    return NextResponse.json({ ok: true, id: saved.id, saved }, { headers: NO_STORE });
  } catch (err) {
    return failed(err, "save");
  }
}
