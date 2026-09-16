import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import { CHALLENGE, isRow100kAdmin } from "@/lib/row100k";
import { BLACKOUT_TAG, listBlackouts } from "@/lib/blackout";

export const runtime = "nodejs";

/* Blackout windows (src/lib/blackout.ts) — list, set, edit, clear. Admin
 * only on every verb, JSON 401/403 like the other moderation routes; the
 * page that calls this already 404s everyone else, so a 403 here is someone
 * poking the API directly. Every write revalidates the blackout tag so the
 * very next board render masks (or unmasks). PATCH (owner, 2026-09-16:
 * "allow me to edit a black out that is already set") takes the POST body
 * plus the window id. */

type Guarded = { actor: { photographerId: string; email: string } } | { res: NextResponse };

async function guard(): Promise<Guarded> {
  const actor = await getEffectiveActor();
  if (!actor) {
    return {
      res: NextResponse.json({ ok: false, error: "Sign in with Google first." }, { status: 401 }),
    };
  }
  if (!isRow100kAdmin(actor.email, actor.roles)) {
    return { res: NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 }) };
  }
  const limit = await rateLimit({
    key: `row100k-blackout:${actor.photographerId}`,
    limit: 30,
    windowSec: 3600,
  });
  if (!limit.ok) {
    return {
      res: NextResponse.json(
        { ok: false, error: "Too many changes at once — try again in a bit." },
        { status: 429, headers: { "Retry-After": String(Math.max(1, limit.retryAfterSec)) } },
      ),
    };
  }
  return { actor };
}

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

const parseIso = (v: unknown): Date | null => {
  if (typeof v !== "string") return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? new Date(ms) : null;
};

export async function GET() {
  const g = await guard();
  if ("res" in g) return g.res;
  try {
    return NextResponse.json({ ok: true, windows: await listBlackouts() });
  } catch (err) {
    console.error("row100k blackout: list failed", err);
    return bad("Couldn't read the blackout table — has it been pushed?", 503);
  }
}

type WindowBody = { id?: unknown; startsAt?: unknown; endsAt?: unknown; reason?: unknown; rampDays?: unknown };
type WindowFields = { startsAt: Date; endsAt: Date; reason: string; rampDays: number };

/* The window fields as POST and PATCH both take them, or the 400 to send
 * back. One validator so an edit can never save what a create would
 * refuse. */
function parseWindow(body: WindowBody): WindowFields | NextResponse {
  const startsAt = parseIso(body.startsAt);
  const endsAt = parseIso(body.endsAt);
  if (!startsAt || !endsAt) return bad("Both times are needed, as ISO strings.");
  if (endsAt.getTime() <= startsAt.getTime()) return bad("The end has to come after the start.");
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : "";
  // The run-up, in days. Capped at a fortnight: it is a tease before the
  // window, not a second challenge.
  const rampDays = Math.min(14, Math.max(0, Math.floor(Number(body.rampDays) || 0)));
  return { startsAt, endsAt, reason, rampDays };
}

async function readBody(req: Request): Promise<WindowBody | null> {
  try {
    return (await req.json()) as WindowBody;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const g = await guard();
  if ("res" in g) return g.res;

  const body = await readBody(req);
  if (!body) return bad("Send JSON.");
  const fields = parseWindow(body);
  if (fields instanceof NextResponse) return fields;

  try {
    // Namespace-scoped like every other Row* write, so a demo-mode admin
    // cannot black out the live board (and vice versa).
    const row = await db.rowBlackout.create({
      data: { challenge: CHALLENGE, ...fields, createdBy: g.actor.email },
      select: { id: true },
    });
    revalidateTag(BLACKOUT_TAG);
    return NextResponse.json({ ok: true, id: row.id });
  } catch (err) {
    console.error("row100k blackout: create failed", err);
    return bad("Couldn't save the window — has the table been pushed?", 503);
  }
}

export async function PATCH(req: Request) {
  const g = await guard();
  if ("res" in g) return g.res;

  const body = await readBody(req);
  if (!body) return bad("Send JSON.");
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return bad("Which window?");
  const fields = parseWindow(body);
  if (fields instanceof NextResponse) return fields;

  try {
    // updateMany, scoped by challenge like the delete: an id from the other
    // namespace matches nothing and reads as gone.
    const res = await db.rowBlackout.updateMany({
      where: { id, challenge: CHALLENGE },
      data: fields,
    });
    if (res.count === 0) return bad("That window is gone.", 404);
    revalidateTag(BLACKOUT_TAG);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("row100k blackout: update failed", err);
    return bad("Couldn't save the window — try again.", 503);
  }
}

export async function DELETE(req: Request) {
  const g = await guard();
  if ("res" in g) return g.res;

  let body: { id?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return bad("Send JSON.");
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return bad("Which window?");

  try {
    // deleteMany so a double-tap is a no-op rather than a throw.
    const res = await db.rowBlackout.deleteMany({ where: { id, challenge: CHALLENGE } });
    if (res.count === 0) return bad("That window is already gone.", 404);
    revalidateTag(BLACKOUT_TAG);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("row100k blackout: delete failed", err);
    return bad("Couldn't remove the window — try again.", 503);
  }
}
