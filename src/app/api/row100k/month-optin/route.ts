import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import { CHALLENGE, MONTH, isRow100kAdmin } from "@/lib/row100k";

export const runtime = "nodejs";

/* THE MONTH'S 100K — opt in, or not this month (owner, 2026-10-01, the
 * board redesign: "the board should be for specifically the 100K monthly
 * challenge with the opt-in").
 *
 * POST    opt in to this month: one row per rower per month, revived if
 *         it was let go (the stamp is cleared, the row is kept).
 * DELETE  not this month: stamps cancelledAt. Nothing is deleted.
 *
 * This month only — the board is the month the clock is in. Signed in AND
 * on the board (a participant row), the shirt pre-orders' rule.
 *
 * IN DEVELOPMENT with the page (CLAUDE.md): admin-only in production, a
 * 404 for anyone else, the same answer the page gives. Open in local dev. */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

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
  if (!p) return { res: bad("Opt in to the challenge first.", 403) };
  const limit = await rateLimit({ key: `row100k-month-optin:${p.id}`, limit: 30, windowSec: 3600 });
  if (!limit.ok) return { res: bad("Too many changes at once — try again in a bit.", 429) };
  return { actor, p };
}

async function count(): Promise<number> {
  return db.rowMonthOptIn.count({ where: { challenge: CHALLENGE, month: MONTH.key, cancelledAt: null } });
}

export async function POST() {
  const g = await me();
  if ("res" in g) return g.res;
  try {
    await db.rowMonthOptIn.upsert({
      where: { challenge_participantId_month: { challenge: CHALLENGE, participantId: g.p.id, month: MONTH.key } },
      create: { challenge: CHALLENGE, participantId: g.p.id, rowerNumber: g.p.rowerNumber, month: MONTH.key },
      update: { cancelledAt: null },
    });
    return NextResponse.json({ ok: true, in: true, month: MONTH.key, count: await count() });
  } catch (err) {
    console.error("row100k month opt-in: failed (table pushed?)", err);
    return bad("Couldn't take that — has the table been pushed?", 503);
  }
}

export async function DELETE() {
  const g = await me();
  if ("res" in g) return g.res;
  try {
    await db.rowMonthOptIn.updateMany({
      where: { challenge: CHALLENGE, participantId: g.p.id, month: MONTH.key, cancelledAt: null },
      data: { cancelledAt: new Date() },
    });
    return NextResponse.json({ ok: true, in: false, month: MONTH.key, count: await count() });
  } catch (err) {
    console.error("row100k month opt-in: let go failed", err);
    return bad("Couldn't take that — has the table been pushed?", 503);
  }
}
