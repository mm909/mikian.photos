import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import { CHALLENGE, isRow100kAdmin } from "@/lib/row100k";
import { parseColor, parseSize } from "@/app/row100k/shirtPreorder";
import { preorderState } from "@/app/row100k/shirtPreorders";

export const runtime = "nodejs";

/* THE SHIRT PRE-ORDERS — reserve, change, let go (owner, 2026-09-30).
 *
 * GET     the public counts per colour and size, and — signed in and
 *         opted in — the caller's own live reservations by colour.
 * POST    { color, size } — reserve, or change the size of a shirt already
 *         reserved. One row per rower per colour: posting the other size
 *         rewrites the row, and posting to a row that was let go revives
 *         it (the stamp is cleared, the row is kept).
 * DELETE  { color } — let it go: stamps cancelledAt. Nothing is deleted.
 *
 * No money anywhere in here (the shirts are paid when they arrive) and
 * nothing to settle, so no email either. Colour and size are checked
 * server-side against the two lists in shirtPreorder.ts.
 *
 * IN DEVELOPMENT, with the page (owner, 2026-10-01: "The shirts page
 * should not be live"): the page is admin-only in production, and so are
 * the writes here — a 404 for anyone else, the same answer the page
 * gives, so nothing reserves through the API that could not reserve
 * through the page. Open in local dev. The GET stays open: the counts
 * only an admin can move, and nothing a rower can do with them. */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

/* Who is reserving: signed in AND on the board. The participant row is what
 * a rower number hangs off, and the row needs one. */
async function me() {
  const actor = await getEffectiveActor();
  if (process.env.NODE_ENV === "production" && !(actor && isRow100kAdmin(actor.email, actor.roles))) {
    return { res: new NextResponse(null, { status: 404 }) };
  }
  if (!actor) return { res: bad("Sign in first.", 401) };
  const p = await db.rowParticipant.findUnique({
    where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
    select: { id: true, rowerNumber: true },
  });
  if (!p) return { res: bad("Opt in to Rowtember first.", 403) };
  return { actor, p };
}

async function readJson<T extends object>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export async function GET() {
  let pid: string | null = null;
  try {
    const actor = await getEffectiveActor();
    if (actor) {
      const p = await db.rowParticipant.findUnique({
        where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
        select: { id: true },
      });
      pid = p?.id ?? null;
    }
  } catch {
    /* cosmetic — the counts still answer, as to a stranger */
  }
  try {
    const state = await preorderState(pid);
    return NextResponse.json({ ok: true, ...state });
  } catch (err) {
    console.error("row100k shirts: read failed (table pushed?)", err);
    return bad("Couldn't read the list just now.", 503);
  }
}

export async function POST(req: Request) {
  const g = await me();
  if ("res" in g) return g.res;
  const limit = await rateLimit({ key: `row100k-shirts:${g.p.id}`, limit: 30, windowSec: 3600 });
  if (!limit.ok) return bad("Too many changes at once — try again in a bit.", 429);

  const body = await readJson<{ color?: unknown; size?: unknown }>(req);
  if (!body) return bad("Send JSON.");
  const color = parseColor(body.color);
  if (!color) return bad("Pick a shirt.");
  const size = parseSize(body.size);
  if (!size) return bad("Pick a size.");

  try {
    /* One row per rower per colour, whatever its state: reserve, change
     * and revive are the same upsert, and the stamp comes off. */
    await db.rowShirtPreorder.upsert({
      where: { challenge_participantId_color: { challenge: CHALLENGE, participantId: g.p.id, color } },
      create: { challenge: CHALLENGE, participantId: g.p.id, rowerNumber: g.p.rowerNumber, color, size },
      update: { size, cancelledAt: null },
    });
    const state = await preorderState(g.p.id);
    return NextResponse.json({ ok: true, ...state });
  } catch (err) {
    console.error("row100k shirts: reserve failed", err);
    return bad("Couldn't take that — has the table been pushed?", 503);
  }
}

export async function DELETE(req: Request) {
  const g = await me();
  if ("res" in g) return g.res;
  const limit = await rateLimit({ key: `row100k-shirts:${g.p.id}`, limit: 30, windowSec: 3600 });
  if (!limit.ok) return bad("Too many changes at once — try again in a bit.", 429);

  const body = await readJson<{ color?: unknown }>(req);
  if (!body) return bad("Send JSON.");
  const color = parseColor(body.color);
  if (!color) return bad("Pick a shirt.");

  try {
    /* Letting go a shirt that was never reserved, or one already let go, is
     * nothing to do — the answer is the list as it stands. */
    await db.rowShirtPreorder.updateMany({
      where: { challenge: CHALLENGE, participantId: g.p.id, color, cancelledAt: null },
      data: { cancelledAt: new Date() },
    });
    const state = await preorderState(g.p.id);
    return NextResponse.json({ ok: true, ...state });
  } catch (err) {
    console.error("row100k shirts: let go failed", err);
    return bad("Couldn't take that — has the table been pushed?", 503);
  }
}
