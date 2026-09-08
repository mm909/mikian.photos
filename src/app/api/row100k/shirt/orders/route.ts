import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEffectiveActor } from "@/lib/permissions";
import { CHALLENGE, isRow100kAdmin } from "@/lib/row100k";
import { listShirtOrders } from "@/app/row100k/shirtOrders";

export const runtime = "nodejs";

/* THE ORDERS — the owner's list (owner, 2026-09-08: "a place to review
 * orders that have come in, also mark delivered"). Admin only.
 *
 * GET    every shirt on the books, newest first (shirtOrders.ts).
 * PATCH  { id, delivered: boolean } — the pick-up happened (or did not). */

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

async function admin() {
  const actor = await getEffectiveActor();
  if (!actor) return { res: bad("Sign in with Google first.", 401) };
  if (!isRow100kAdmin(actor.email, actor.roles)) return { res: bad("Not allowed.", 403) };
  return { actor };
}

export async function GET() {
  const g = await admin();
  if ("res" in g) return g.res;
  try {
    return NextResponse.json({ ok: true, orders: await listShirtOrders() });
  } catch (err) {
    console.error("row100k shirt: orders list failed", err);
    return bad("Couldn't read the orders.", 503);
  }
}

export async function PATCH(req: Request) {
  const g = await admin();
  if ("res" in g) return g.res;
  let body: { id?: unknown; delivered?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return bad("Send JSON.");
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return bad("Which order?");
  const delivered = body.delivered === true;
  try {
    const res = await db.rowShirtOrder.updateMany({
      where: { id, challenge: CHALLENGE },
      data: { deliveredAt: delivered ? new Date() : null },
    });
    if (res.count === 0) return bad("No such order.", 404);
    return NextResponse.json({ ok: true, delivered });
  } catch (err) {
    console.error("row100k shirt: mark delivered failed", err);
    return bad("Couldn't update that.", 503);
  }
}
