import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import { CHALLENGE, MONTH } from "@/lib/row100k";

export const runtime = "nodejs";

/* THE MONTH'S 100K — opt in (owner, 2026-10-01, the board redesign: "the
 * board should be for specifically the 100K monthly challenge with the
 * opt-in").
 *
 * POST    opt in to this month: one row per rower per month. Asking twice
 *         is the same answer.
 *
 * POST ONLY. There is no way out (owner, 2026-10-01, on the first version,
 * which had a NOT THIS MONTH and a DELETE here: "don't include not this
 * month. There's no opt out. Once you opt in, you're opted in"). The
 * cancelledAt column stays in the table and nothing stamps it any more; a
 * row let go under that first version comes back the next time its rower
 * opts in (the stamp is cleared, the row is kept).
 *
 * This month only — the board is the month the clock is in. Signed in AND
 * on the roster (a participant row), the shirt pre-orders' rule.
 *
 * LIVE with the board (owner, 2026-10-01: "Same with the board. Let's make
 * that live"): any signed-in rower on the roster. */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST() {
  const actor = await getEffectiveActor();
  if (!actor) return bad("Sign in first.", 401);
  const p = await db.rowParticipant.findUnique({
    where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
    select: { id: true, rowerNumber: true },
  });
  if (!p) return bad("Join Rowtember first.", 403);
  const limit = await rateLimit({ key: `row100k-month-optin:${p.id}`, limit: 30, windowSec: 3600 });
  if (!limit.ok) return bad("Too many tries at once. Try again in a bit.", 429);
  try {
    await db.rowMonthOptIn.upsert({
      where: { challenge_participantId_month: { challenge: CHALLENGE, participantId: p.id, month: MONTH.key } },
      create: { challenge: CHALLENGE, participantId: p.id, rowerNumber: p.rowerNumber, month: MONTH.key },
      update: { cancelledAt: null },
    });
    const count = await db.rowMonthOptIn.count({
      where: { challenge: CHALLENGE, month: MONTH.key, cancelledAt: null },
    });
    return NextResponse.json({ ok: true, in: true, month: MONTH.key, count });
  } catch (err) {
    console.error("row100k month opt-in: failed (table pushed?)", err);
    return bad("Could not take that. Try again.", 503);
  }
}
