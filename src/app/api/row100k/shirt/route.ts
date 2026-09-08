import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPlainEmail } from "@/lib/email";
import { getEffectiveActor } from "@/lib/permissions";
import { rateLimit } from "@/lib/rateLimit";
import { CHALLENGE, isRow100kAdmin } from "@/lib/row100k";
import { SHIRT_PRICE_USD, nextKind, parseSize, receiptEmail, shirtCounts, shopOpenFor } from "@/app/row100k/shirt";

export const runtime = "nodejs";

/* THE SHIRT — buy and read. Dev surface (owner, 2026-09-08).
 *
 * GET   the per-size counts and the caller's own shirt, if any.
 * POST  { size } — buy one, pay later: a shelf spot while the size has one
 *       left, a pre-order once it does not. One shirt per rower; buying
 *       again moves the size. A receipt goes out by email with their total
 *       meters, the month-end reminder and the pick-up reminder.
 *
 * There is no cancel and no paying early (owner call): the shirt is
 * settled against the rower's meters at the end of the month by
 * ./settle, and only a billed shirt can be paid (./paypal). */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

async function me() {
  const actor = await getEffectiveActor();
  if (!actor) return { res: bad("Sign in with Google first.", 401) };
  if (!shopOpenFor(isRow100kAdmin(actor.email, actor.roles))) {
    return { res: bad("The shirt is not on sale yet.", 403) };
  }
  const p = await db.rowParticipant.findUnique({
    where: { challenge_userId: { challenge: CHALLENGE, userId: actor.photographerId } },
    select: { id: true, rowerNumber: true, displayName: true },
  });
  if (!p) return { res: bad("Opt in to Rowtember first.", 403) };
  return { actor, p };
}

async function listOrders() {
  return db.rowShirtOrder.findMany({
    where: { challenge: CHALLENGE },
    select: { participantId: true, size: true, kind: true, status: true, amountUsd: true, paidAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function GET() {
  const g = await me();
  const orders = await listOrders();
  const mine = "p" in g && g.p ? (orders.find((o) => o.participantId === g.p.id) ?? null) : null;
  return NextResponse.json({
    ok: true,
    counts: shirtCounts(orders),
    mine: mine ? { size: mine.size, kind: mine.kind, status: mine.status, amountUsd: mine.amountUsd, paidAt: mine.paidAt } : null,
  });
}

export async function POST(req: Request) {
  const g = await me();
  if ("res" in g) return g.res;
  const limit = await rateLimit({ key: `row100k-shirt:${g.p.id}`, limit: 20, windowSec: 3600 });
  if (!limit.ok) return bad("Too many changes at once — try again in a bit.", 429);

  let body: { size?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return bad("Send JSON.");
  }
  const size = parseSize(body.size);
  if (!size) return bad("Pick a size.");

  try {
    const existing = await db.rowShirtOrder.findUnique({
      where: { challenge_participantId: { challenge: CHALLENGE, participantId: g.p.id } },
      select: { id: true, status: true, size: true },
    });
    if (existing && existing.status !== "reserved") {
      return bad("Your shirt is already settled — email to change the size.", 409);
    }

    // The shelf without this rower's own row: moving sizes must not count
    // the spot being given up.
    const others = (await listOrders()).filter((o) => o.participantId !== g.p.id);
    const kind = nextKind(size, shirtCounts(others));

    const row = existing
      ? await db.rowShirtOrder.update({
          where: { id: existing.id },
          data: { size, kind },
          select: { size: true, kind: true, status: true },
        })
      : await db.rowShirtOrder.create({
          data: {
            challenge: CHALLENGE,
            participantId: g.p.id,
            rowerNumber: g.p.rowerNumber,
            size,
            kind,
            status: "reserved",
            amountUsd: SHIRT_PRICE_USD,
          },
          select: { size: true, kind: true, status: true },
        });

    // The receipt — best effort, never in the way of the order.
    let emailed = false;
    try {
      const rows = await db.rowEntry.findMany({
        where: { participantId: g.p.id },
        select: { meters: true },
      });
      const meters = rows.reduce((s, r) => s + r.meters, 0);
      const mail = receiptEmail({
        name: g.p.displayName,
        rowerNumber: g.p.rowerNumber,
        size,
        kind: kind as "stock" | "preorder",
        meters,
      });
      const sent = await sendPlainEmail(g.actor.email, mail.subject, mail.text);
      emailed = sent.ok;
      if (!sent.ok) console.error("row100k shirt: receipt email failed", sent.error);
    } catch (err) {
      console.error("row100k shirt: receipt email failed", err);
    }

    return NextResponse.json({ ok: true, mine: row, emailed, counts: shirtCounts(await listOrders()) });
  } catch (err) {
    console.error("row100k shirt: buy failed", err);
    return bad("Couldn't take that — has the table been pushed?", 503);
  }
}
