import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { CAPS, validateTelemetryDoc } from "@/lib/pm5/session";
import { ErgStoreError, insertErgSession, listErgSessions } from "@/lib/pm5/store";
import { ergApiDenial, ergViewer } from "@/app/erg/gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* SAVED ERG SESSIONS (owner, 2026-09-17: the telemetry product moves out
 * of Rowtember; sessions belong to the account, not to a rower).
 *
 * POST { doc, title? } -> { ok, id, saved }   30/h per account; the
 *      document validated with hard caps before anything touches the
 *      database.
 * GET  [?all=1]        -> { ok, rows }        the account own rows; all=1
 *      for an admin lists everyone.
 *
 * THE SAME DOOR THE PAGES WEAR (gate.ts): signed in always, and in
 * production an admin account — otherwise any signed-in account could post
 * megabytes into RowTelemetry against a page it cannot even open. When
 * /erg opens to other people that one helper changes and this route comes
 * along with it, with a per-account ceiling in place of the admin check.
 *
 * Errors: 400 the body or the document, 401 signed out, 403 shut, 413 a
 * body past the cap, 429 the limit, 503 the database — every one JSON with
 * a printable line, never cached. */

const NO_STORE = { "Cache-Control": "no-store" };

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });

function failed(err: unknown, what: string) {
  if (err instanceof ErgStoreError) return bad(err.message, err.status);
  console.error(`erg sessions: ${what} failed`, err);
  return bad("Couldn't reach the database — try again.", 503);
}

export async function GET(req: Request) {
  const v = await ergViewer();
  const denied = ergApiDenial(v);
  if (denied) return bad(denied.error, denied.status);
  const all = new URL(req.url).searchParams.get("all") === "1" && v.isAdmin;
  try {
    const rows = await listErgSessions({ userId: v.userId as string, isAdmin: all });
    return NextResponse.json({ ok: true, rows }, { headers: NO_STORE });
  } catch (err) {
    return failed(err, "list");
  }
}

export async function POST(req: Request) {
  const v = await ergViewer();
  const denied = ergApiDenial(v);
  if (denied) return bad(denied.error, denied.status);
  const userId = v.userId as string;

  const limit = await rateLimit({ key: `erg-session-save:${userId}`, limit: 30, windowSec: 3600 });
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
    const saved = await insertErgSession({ userId, doc, title: body.title });
    return NextResponse.json({ ok: true, id: saved.id, saved }, { headers: NO_STORE });
  } catch (err) {
    return failed(err, "save");
  }
}
